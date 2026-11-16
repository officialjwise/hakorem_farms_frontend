/**
 * The till on this device (ADR 0043): what is stored (store.ts), the one place it changes, and when the
 * queue is sent (sync.ts). It is a module-level store that screens read with `useTill()`
 * (`useSyncExternalStore`, as `useOnlineStatus` does), not a React context: the till document has one
 * till, and the barcode bar in the shell and the sale screen under it share it without a provider.
 *
 * When the queue is sent: as soon as a record is queued; when the browser says it is online again; and,
 * while records wait and the server cannot be reached, after a backoff (5 s doubling to 5 min, with
 * jitter) and on a health probe every 30 seconds (OFFLINE_SYNC 6.4). One pass at a time.
 */
import { useSyncExternalStore } from 'react';
import type { ApiClient, components } from '@hakorem/api-client';
import { newRecordId } from '../../lib/clientId';
import { requestedOn } from '../../requested/switch';
import { listTillPinVerifiers, type PinApproval, type PinVerifier } from '../../requested/tillPin';
import { NO_ATTEMPTS, afterFailure, lockoutRemainingMs, pinMatches, pinShapeOk } from '../pin/pin';
import type { CartLine, OtherTender } from './cart';
import { buildSale } from './sale';
import { indexedDbStore, memoryStore, type TillStore } from './store';
import { backoffMs, flushQueue, pendingCount, type FlushOutcome } from './sync';
import type {
  CashMovementCreate,
  CashMovementEntry,
  DeviceRecord,
  EntryFailure,
  HeldLocal,
  PinApprovalRecord,
  SaleEntry,
  ShiftOpenEntry,
  ShiftRecord,
  TillSnapshot,
} from './types';

type PaymentMethodRef = components['schemas']['PaymentMethodRef'];

export interface SyncStatus {
  sending: boolean;
  /** When the next attempt is planned, while records wait and the server cannot be reached. */
  nextAttemptAt: string | null;
  /** The queue is stopped until a person acts (an ended session, a revoked device). */
  blocked: EntryFailure | null;
  /** The last pass could not reach the server. */
  unreachable: boolean;
  lastPassAt: string | null;
}

export interface TillState {
  /** Null while the store is read at start. */
  snapshot: TillSnapshot | null;
  sync: SyncStatus;
  /** The store could not be opened (private browsing, storage full). Nothing can be sold. */
  storeError: string | null;
}

const PROBE_MS = 30_000;

/** How a PIN fared (CR-032). A wrong one says how many tries are left; a lockout says until when. */
export type PinOutcome =
  | { kind: 'ok'; verifier: PinVerifier; record: PinApprovalRecord | null }
  | { kind: 'wrong'; attemptsLeft: number }
  | { kind: 'locked-out'; until: string }
  | { kind: 'not-a-pin' }
  | { kind: 'no-verifier' };

export interface TillDeps {
  store: TillStore;
  call: ApiClient['call'];
  /** For the operations the contract does not list yet (ADR 0046). */
  callRequested?: ApiClient['callRequested'];
  now?: () => Date;
  random?: () => number;
  /** Timers, for tests. */
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class Till {
  private state: TillState = {
    snapshot: null,
    sync: {
      sending: false,
      nextAttemptAt: null,
      blocked: null,
      unreachable: false,
      lastPassAt: null,
    },
    storeError: null,
  };
  private readonly listeners = new Set<() => void>();
  private readonly store: TillStore;
  private readonly call: ApiClient['call'];
  private readonly callRequested: ApiClient['callRequested'] | null;
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly setTimer: (run: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private running: Promise<FlushOutcome> | null = null;
  private queued: Promise<FlushOutcome> | null = null;
  private failures = 0;
  private retryTimer: unknown = null;
  private probeTimer: unknown = null;
  private ready: Promise<void> | null = null;

  constructor(deps: TillDeps) {
    this.store = deps.store;
    this.call = deps.call;
    this.callRequested = deps.callRequested ?? null;
    this.now = deps.now ?? (() => new Date());
    this.random =
      deps.random ?? (() => (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) / 2 ** 32);
    this.setTimer = deps.setTimer ?? ((run, ms) => setTimeout(run, ms));
    this.clearTimer =
      deps.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): TillState => this.state;

  private set(change: Partial<TillState>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }

  private setSync(change: Partial<SyncStatus>) {
    this.set({ sync: { ...this.state.sync, ...change } });
  }

  private async reload(): Promise<TillSnapshot> {
    const snapshot = await this.store.read();
    this.set({ snapshot });
    return snapshot;
  }

  /** Reads the store once. A record left SENDING by a crash or a closed tab goes back to QUEUED (6.1). */
  start(): Promise<void> {
    this.ready ??= (async () => {
      try {
        const snapshot = await this.store.read();
        const stale = snapshot.entries.filter((entry) => entry.localStatus === 'SENDING');
        if (stale.length > 0) {
          await this.store.putEntries(
            stale.map((entry) => ({ ...entry, localStatus: 'QUEUED' as const })),
          );
        }
        await this.reload();
        this.kick();
      } catch (error) {
        this.set({ storeError: error instanceof Error ? error.message : String(error) });
      }
    })();
    return this.ready;
  }

  /** Sends the queue now, or as soon as the pass under way ends. */
  kick(): void {
    void this.flush();
  }

  /** One pass, or the one already running followed by another. Resolves with how the last pass ended. */
  flush(): Promise<FlushOutcome> {
    if (this.running !== null) {
      // Asked for during a pass: one more pass after it, shared by everyone who asks meanwhile, so a
      // record queued during a pass is sent by the pass the caller waits for.
      this.queued ??= this.running.then(() => {
        this.queued = null;
        return this.flush();
      });
      return this.queued;
    }
    this.running = this.pass().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** One pass, from the first request to the state on screen. Never two at once in one till. */
  private async pass(): Promise<FlushOutcome> {
    const snapshot = this.state.snapshot;
    if (snapshot === null || snapshot.device === null) return { kind: 'done' };
    if (this.retryTimer !== null) {
      this.clearTimer(this.retryTimer);
      this.retryTimer = null;
    }
    this.setSync({ sending: true, nextAttemptAt: null });
    const outcome = await flushQueue({ store: this.store, call: this.call, now: this.now }).catch(
      (): FlushOutcome => ({ kind: 'unreachable' }),
    );
    const after = await this.reload();
    this.settle(outcome, after);
    return outcome;
  }

  private settle(outcome: FlushOutcome, snapshot: TillSnapshot) {
    const passAt = this.now().toISOString();
    const waiting = pendingCount(snapshot) > 0;
    if (outcome.kind === 'done' || !waiting) {
      this.failures = 0;
      this.stopProbe();
      this.setSync({
        sending: false,
        unreachable: false,
        blocked: null,
        nextAttemptAt: null,
        lastPassAt: passAt,
      });
      return;
    }
    if (outcome.kind === 'blocked') {
      this.stopProbe();
      this.setSync({
        sending: false,
        unreachable: false,
        blocked: outcome.failure,
        nextAttemptAt: null,
        lastPassAt: passAt,
      });
      return;
    }
    const wait =
      outcome.kind === 'rate-limited'
        ? outcome.seconds * 1000
        : backoffMs(this.failures, this.random());
    this.failures += 1;
    const next = new Date(this.now().getTime() + wait).toISOString();
    this.retryTimer = this.setTimer(() => {
      this.retryTimer = null;
      this.kick();
    }, wait);
    this.startProbe();
    this.setSync({
      sending: false,
      unreachable: outcome.kind === 'unreachable',
      blocked: null,
      nextAttemptAt: next,
      lastPassAt: passAt,
    });
  }

  private startProbe() {
    if (this.probeTimer !== null) return;
    const probe = () => {
      this.probeTimer = this.setTimer(() => {
        void this.call('getHealth')
          .then(() => {
            this.stopProbe();
            this.kick();
          })
          .catch(() => probe());
      }, PROBE_MS);
    };
    probe();
  }

  private stopProbe() {
    if (this.probeTimer !== null) this.clearTimer(this.probeTimer);
    this.probeTimer = null;
  }

  /** The browser says the network is back. */
  online(): void {
    this.failures = 0;
    this.kick();
  }

  private snapshotOrThrow(): TillSnapshot {
    const snapshot = this.state.snapshot;
    if (snapshot === null) throw new Error('The till has not started.');
    return snapshot;
  }

  async enrol(device: DeviceRecord): Promise<void> {
    await this.store.saveDevice(device);
    await this.reload();
  }

  /** Forgets this till's enrolment, for a device a manager revoked. The queue is kept (section 11). */
  async forgetDevice(): Promise<void> {
    await this.store.saveDevice(null);
    await this.reload();
  }

  async refreshPack(): Promise<void> {
    const { device, meta } = this.snapshotOrThrow();
    if (device === null) throw new Error('This till is not enrolled.');
    const pack = await this.call('getOfflinePack', { path: { id: device.registerId } });
    await this.store.savePack(pack);
    const at = this.now().toISOString();
    await this.store.saveMeta({ ...meta, packFetchedAt: at, lastReachedServerAt: at });
    await this.refreshPins(device.registerId);
    await this.reload();
  }

  /**
   * The PIN verifiers for this till, fetched with the pack while a staff session and the network are here
   * (CR-032, `local_auth`). A refusal keeps what the till already holds; the lock screen says when there
   * is no verifier to check a PIN against.
   */
  private async refreshPins(registerId: string): Promise<void> {
    if (!requestedOn('CR-032') || this.callRequested === null) return;
    const callRequested = this.callRequested;
    try {
      const issued = await listTillPinVerifiers({ callRequested }, registerId);
      await this.store.saveLocalAuth(issued);
    } catch {
      // Kept as it was: an earlier verifier still checks a PIN, and none means no PIN on this till.
    }
  }

  /** The verifier of the person, if the till holds one. */
  private verifierFor(principalId: string): PinVerifier | null {
    return (
      this.state.snapshot?.localAuth?.verifiers.find((v) => v.principalId === principalId) ?? null
    );
  }

  /**
   * Checks one person's PIN on this till, counting a wrong one against them and locking them out at the
   * policy's limit. With `approval`, the person must hold it, and the record of what approved it is made.
   */
  async checkPin(principalId: string, pin: string, approval?: PinApproval): Promise<PinOutcome> {
    const { meta, localAuth } = this.snapshotOrThrow();
    const verifier = this.verifierFor(principalId);
    if (localAuth === null || verifier === null) return { kind: 'no-verifier' };
    if (approval !== undefined && !verifier.approves.includes(approval)) {
      return { kind: 'no-verifier' };
    }
    const now = this.now();
    const attempts = meta.pinAttempts[principalId] ?? NO_ATTEMPTS;
    if (lockoutRemainingMs(attempts, now) > 0 && attempts.lockedUntil !== null) {
      return { kind: 'locked-out', until: attempts.lockedUntil };
    }
    if (!pinShapeOk(pin, localAuth.policy)) return { kind: 'not-a-pin' };
    const matches = await pinMatches(pin, verifier);
    const { meta: current } = this.snapshotOrThrow();
    if (!matches) {
      const next = afterFailure(attempts, localAuth.policy, now);
      await this.store.saveMeta({
        ...current,
        pinAttempts: { ...current.pinAttempts, [principalId]: next },
      });
      await this.reload();
      return next.lockedUntil !== null
        ? { kind: 'locked-out', until: next.lockedUntil }
        : { kind: 'wrong', attemptsLeft: localAuth.policy.maxAttempts - next.failures };
    }
    await this.store.saveMeta({
      ...current,
      pinAttempts: { ...current.pinAttempts, [principalId]: NO_ATTEMPTS },
    });
    await this.reload();
    return {
      kind: 'ok',
      verifier,
      record:
        approval === undefined
          ? null
          : {
              approval,
              principalId,
              displayName: verifier.displayName,
              verifierVersion: verifier.version,
              at: now.toISOString(),
            },
    };
  }

  /** Whether the shift's cashier can lock this till: only with a verifier to open it again. */
  canLock(): boolean {
    const shift = this.state.snapshot?.shift ?? null;
    return shift !== null && this.verifierFor(shift.cashierId) !== null;
  }

  /** Locks the till until the shift's cashier enters their PIN. Selling, scanning and paying stop. */
  async lock(): Promise<void> {
    if (!this.canLock()) return;
    const { meta } = this.snapshotOrThrow();
    if (meta.locked) return;
    await this.store.saveMeta({ ...meta, locked: true });
    await this.reload();
  }

  /** Opens the till with the shift's cashier's PIN, on the device, with or without the network. */
  async unlock(pin: string): Promise<PinOutcome> {
    const { shift } = this.snapshotOrThrow();
    if (shift === null) return { kind: 'no-verifier' };
    const outcome = await this.checkPin(shift.cashierId, pin);
    if (outcome.kind === 'ok') {
      const { meta } = this.snapshotOrThrow();
      await this.store.saveMeta({ ...meta, locked: false });
      await this.reload();
    }
    return outcome;
  }

  /** Forgets the PIN verifiers and the lock: at shift close and at sign-out (OFFLINE_SYNC section 3). */
  async forgetPins(): Promise<void> {
    const snapshot = this.state.snapshot;
    if (snapshot === null) return;
    await this.store.saveLocalAuth(null);
    await this.store.saveMeta({ ...snapshot.meta, pinAttempts: {}, locked: false });
    await this.reload();
  }

  /**
   * Opens a shift on this till with its float (section 10): the record is made here with a client id and
   * queued, so it opens offline too, and is sent at once.
   */
  async openShift(input: {
    cashierId: string;
    cashierName: string;
    openingFloatPesewas: number;
  }): Promise<ShiftRecord> {
    const { device, meta, shift: current } = this.snapshotOrThrow();
    if (device === null) throw new Error('This till is not enrolled.');
    if (current !== null) throw new Error('A shift is already open on this till.');
    const now = this.now();
    const id = newRecordId(now.getTime());
    const shift: ShiftRecord = {
      id,
      registerId: device.registerId,
      cashierId: input.cashierId,
      cashierName: input.cashierName,
      openingFloatPesewas: input.openingFloatPesewas,
      openedAt: now.toISOString(),
      shiftSeq: null,
      shiftNo: null,
      referenceSeq: (meta.lastShiftSeq ?? 0) + 1,
      lastCounter: 0,
      discountGivenPesewas: 0,
      confirmed: false,
    };
    const entry: ShiftOpenEntry = {
      kind: 'SHIFT_OPEN',
      id,
      shiftId: id,
      localStatus: 'QUEUED',
      attempts: 0,
      createdLocalAt: shift.openedAt,
      lastAttemptAt: null,
      confirmedAt: null,
      failure: null,
      payload: {
        id,
        registerId: device.registerId,
        openingFloatPesewas: input.openingFloatPesewas,
        openedAt: shift.openedAt,
      },
      serverResult: null,
    };
    await this.store.saveShift(shift);
    await this.store.putEntries([entry]);
    await this.reload();
    await this.flush();
    return shift;
  }

  /** Completes a sale: counter, queue record and receipt in one write, then sends it. */
  async completeSale(input: {
    lines: CartLine[];
    cashMethod: PaymentMethodRef;
    others: (OtherTender & { method: PaymentMethodRef })[];
    cashHandedPesewas: number;
    customerPhone: string | null;
    approvals?: PinApprovalRecord[];
  }): Promise<SaleEntry> {
    const { device, shift } = this.snapshotOrThrow();
    if (device === null || shift === null) throw new Error('There is no open shift on this till.');
    const { approvals = [], ...sale } = input;
    const built = await buildSale({ device, shift, ...sale, now: this.now() });
    const entry: SaleEntry = approvals.length > 0 ? { ...built.entry, approvals } : built.entry;
    const { discountGivenPesewas } = built;
    await this.store.commitSale(entry, discountGivenPesewas);
    await this.reload();
    this.kick();
    return entry;
  }

  /** A cash drop, pay-out or pay-in (section 10), queued like a sale. */
  async recordCashMovement(
    input: Omit<CashMovementCreate, 'id' | 'occurredAt'>,
    approvals: PinApprovalRecord[] = [],
  ): Promise<CashMovementEntry> {
    const { shift } = this.snapshotOrThrow();
    if (shift === null) throw new Error('There is no open shift on this till.');
    const now = this.now();
    const id = newRecordId(now.getTime());
    const entry: CashMovementEntry = {
      kind: 'CASH_MOVEMENT',
      id,
      shiftId: shift.id,
      localStatus: 'QUEUED',
      attempts: 0,
      createdLocalAt: now.toISOString(),
      lastAttemptAt: null,
      confirmedAt: null,
      failure: null,
      payload: { ...input, id, occurredAt: now.toISOString() },
      serverResult: null,
      ...(approvals.length > 0 ? { approvals } : {}),
    };
    await this.store.putEntries([entry]);
    await this.reload();
    this.kick();
    return entry;
  }

  async holdLocally(lines: CartLine[], label: string | null): Promise<HeldLocal> {
    const held: HeldLocal = {
      id: newRecordId(this.now().getTime()),
      label,
      lines,
      heldAt: this.now().toISOString(),
    };
    await this.store.putHeld(held);
    await this.reload();
    return held;
  }

  async removeHeld(id: string): Promise<void> {
    await this.store.removeHeld(id);
    await this.reload();
  }

  /** The shift's close was signed off by the server: the till is free for the next one. */
  async endShift(): Promise<void> {
    const { shift, meta } = this.snapshotOrThrow();
    await this.store.saveShift(null);
    await this.store.saveLocalAuth(null);
    await this.store.saveMeta({
      ...meta,
      counterGaps: [],
      lastShiftSeq: shift?.shiftSeq ?? meta.lastShiftSeq,
      pinAttempts: {},
      locked: false,
    });
    await this.reload();
  }
}

let instance: Till | null = null;

/** The till document's one till, made on first use with the browser's store and the console's API. */
export function configureTill(deps: TillDeps): Till {
  instance = new Till(deps);
  return instance;
}

export function getTill(): Till {
  if (instance === null) throw new Error('The till is not configured. Call configureTill first.');
  return instance;
}

export function hasTill(): boolean {
  return instance !== null;
}

/** The browser's store, or memory where IndexedDB is missing (the store error says so on screen). */
export function browserStore(): TillStore {
  return typeof indexedDB === 'undefined' ? memoryStore() : indexedDbStore();
}

const NO_TILL: TillState = {
  snapshot: null,
  sync: {
    sending: false,
    nextAttemptAt: null,
    blocked: null,
    unreachable: false,
    lastPassAt: null,
  },
  storeError: null,
};

export function useTill(): TillState {
  const till = instance;
  return useSyncExternalStore(
    till?.subscribe ?? (() => () => undefined),
    till?.getState ?? (() => NO_TILL),
    () => NO_TILL,
  );
}
