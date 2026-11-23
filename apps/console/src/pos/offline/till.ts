/**
 * The till on this device (ADR 0043): what is stored (store.ts), the one place it changes, and when the
 * queue is sent (sync.ts). It is a module-level store that screens read with `useTill()`
 * (`useSyncExternalStore`, as `useOnlineStatus` does), not a React context: the till document has one
 * till, and the shell and the sale screen under it share it without a provider.
 *
 * When the queue is sent: as soon as a record is queued; when the browser says it is online again; and,
 * while records wait and the server cannot be reached, after a backoff (5 s doubling to 5 min, with
 * jitter) and on a health probe every 30 seconds (OFFLINE_SYNC 6.4). One pass at a time.
 */
import { useSyncExternalStore } from 'react';
import type { ApiClient, components } from '@hakorem/api-client';
import { newRecordId } from '../../lib/clientId';
import {
  afterFailure,
  attemptsFor,
  fromContract,
  makeVerifier,
  pinMatches,
  pinShapeOk,
  purposeOf,
  tillPolicy,
  verifierStrength,
  type PinApproval,
  type PinVerifier,
  type TillPinEvent,
  type TillPinVerifierList,
  type TillSignOut,
} from '../pin/pin';
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
  LocalAuth,
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
/** `TillPinReport`'s limits (2.17.0). */
const PIN_EVENTS_PER_REPORT = 500;
const PIN_SIGN_OUTS_PER_REPORT = 50;

/**
 * How a PIN fared (CR-032). A wrong one says how many tries are left. A lockout has no end time: it ends
 * when the server says so or a supervisor signs the cashier out. A weak verifier was refused, so that
 * person's PIN is not checked on this till (owner, 2026-11-17).
 */
export type PinOutcome =
  | { kind: 'ok'; verifier: PinVerifier; record: PinApprovalRecord | null }
  | { kind: 'wrong'; attemptsLeft: number }
  | { kind: 'locked-out' }
  | { kind: 'not-a-pin' }
  | { kind: 'weak-verifier' }
  | { kind: 'no-verifier' };

export interface TillDeps {
  store: TillStore;
  call: ApiClient['call'];
  now?: () => Date;
  random?: () => number;
  /** Timers, for tests. */
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/** The server refused a shift as it opened; the till holds no shift. Its words are the refusal's. */
export class ShiftRefused extends Error {
  constructor(readonly failure: EntryFailure) {
    super(failure.message);
    this.name = 'ShiftRefused';
  }
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
  private pinReport: Promise<boolean> | null = null;

  constructor(deps: TillDeps) {
    this.store = deps.store;
    this.call = deps.call;
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
    // The PIN tries go first, so the sales' and drops' approvals are checked against them (2.17.0).
    await this.reportPins(snapshot.device.registerId);
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
   * Tells the server every PIN try and sign-out it has not heard (`reportTillPinEvents`, 2.17.0), in the
   * contract's batches, oldest first. Each is taken off the till once the server answers for it, whatever
   * its outcome: `APPLIED` and `DUPLICATE` are counted, and a `REJECTED` one the server raises itself. False
   * when the server could not be reached; what was not answered waits on the device.
   */
  private reportPins(registerId: string): Promise<boolean> {
    if (this.pinReport !== null) return this.pinReport;
    const report = (async () => {
      try {
        for (;;) {
          const { meta } = this.snapshotOrThrow();
          const events = meta.pinEvents.slice(0, PIN_EVENTS_PER_REPORT);
          // A sign-out goes once every try before it is told, so the server holds the cashier locked first.
          const signOuts =
            events.length < meta.pinEvents.length
              ? []
              : meta.pinSignOuts.slice(0, PIN_SIGN_OUTS_PER_REPORT);
          if (events.length === 0 && signOuts.length === 0) return true;
          const result = await this.call('reportTillPinEvents', {
            path: { id: registerId },
            body: signOuts.length > 0 ? { events, signOuts } : { events },
          });
          const answered = new Set([
            ...result.eventResults.map((item) => item.id),
            ...result.signOutResults.map((item) => item.id),
          ]);
          const { meta: current } = await this.reload();
          await this.store.saveMeta({
            ...current,
            pinEvents: current.pinEvents.filter((event) => !answered.has(event.id)),
            pinSignOuts: current.pinSignOuts.filter((signOut) => !answered.has(signOut.id)),
            lastReachedServerAt: this.now().toISOString(),
          });
          await this.reload();
          // An answer that names none of what was sent would loop for ever: stop, and try next time.
          if (answered.size === 0) return true;
        }
      } catch {
        return false;
      }
    })();
    // Cleared once it ends, never before it is set: a report with nothing to send ends at once.
    this.pinReport = report.finally(() => {
      this.pinReport = null;
    });
    return this.pinReport;
  }

  /**
   * The PIN verifiers for this till, read while a staff session and the network are here (2.17.0,
   * `local_auth`), after the tries the server has not heard. A failure keeps what the till already holds;
   * the lock screen says when there is no verifier to check a PIN against.
   */
  private async refreshPins(registerId: string): Promise<boolean> {
    if (!(await this.reportPins(registerId))) return false;
    try {
      const issued = await this.call('listTillPinVerifiers', { path: { id: registerId } });
      await this.adoptVerifiers(issued);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Keeps what the server sent, on the owner's terms (2026-11-17): a verifier below the floor is refused
   * and named, never stored; at most five tries. Each person's tries are the server's count against the
   * version it sent and this till's not yet reported, so a lockout ends only with a new PIN (2.17.0).
   */
  private async adoptVerifiers(issued: TillPinVerifierList) {
    const all = issued.data.map(fromContract);
    const policy = tillPolicy(issued.policy.maxWrongTries);
    const local: LocalAuth = {
      registerId: issued.registerId,
      asOf: issued.asOf,
      policy,
      verifiers: all.filter((v) => verifierStrength(v) !== 'weak'),
      refused: all
        .filter((v) => verifierStrength(v) === 'weak')
        .map(({ principalId, displayName }) => ({ principalId, displayName })),
    };
    await this.store.saveLocalAuth(local);
    // Read again: a PIN checked while the server answered may have added a try since.
    const { meta } = await this.reload();
    const pinAttempts = { ...meta.pinAttempts };
    for (const verifier of all) {
      pinAttempts[verifier.principalId] = attemptsFor(verifier, meta.pinEvents, policy);
    }
    await this.store.saveMeta({ ...meta, pinAttempts });
  }

  /**
   * Tells the server what it has not heard about the till's PINs and reads the verifiers again, when it can
   * be reached (a staff session and the network). False when it could not be reached.
   */
  async reachServer(): Promise<boolean> {
    const { device } = this.snapshotOrThrow();
    if (device === null) return false;
    const reached = await this.refreshPins(device.registerId);
    await this.reload();
    return reached;
  }

  /**
   * Sets the signed-in person's own till PIN (`setTillPin`, 2.17.0): the till derives the verifier and sends
   * only that, then reads the verifiers again so the new PIN works here at once. A new PIN is a new version
   * with no tries against it, which is the only way a locked PIN opens again.
   */
  async setOwnPin(pin: string, idempotencyKey: string): Promise<'set' | 'not-a-pin'> {
    const { device } = this.snapshotOrThrow();
    if (device === null) throw new Error('This till is not enrolled.');
    if (!pinShapeOk(pin, tillPolicy(undefined))) return 'not-a-pin';
    const body = await makeVerifier(pin);
    await this.call('setTillPin', { body }, { idempotencyKey });
    await this.refreshPins(device.registerId);
    await this.reload();
    return 'set';
  }

  /** One PIN try, made on the till with its own id and time, for the server. */
  private pinTry(
    verifier: PinVerifier,
    outcome: TillPinEvent['outcome'],
    approval: PinApproval | undefined,
  ): TillPinEvent {
    return {
      id: newRecordId(),
      principalId: verifier.principalId,
      pinVersion: verifier.version,
      outcome,
      purpose: purposeOf(approval),
      occurredAt: this.now().toISOString(),
    };
  }

  /** The verifier of the person, if the till holds one. */
  private verifierFor(principalId: string): PinVerifier | null {
    return (
      this.state.snapshot?.localAuth?.verifiers.find((v) => v.principalId === principalId) ?? null
    );
  }

  /** Whether the server sent this person's verifier below the floor, so the till refused it. */
  refusedVerifier(principalId: string): boolean {
    return (
      this.state.snapshot?.localAuth?.refused.some((r) => r.principalId === principalId) ?? false
    );
  }

  /** Whether this person's PIN is locked on this till until they set a new one. */
  pinLocked(principalId: string): boolean {
    const verifier = this.verifierFor(principalId);
    const attempts = this.state.snapshot?.meta.pinAttempts[principalId];
    return (
      verifier?.locked === true ||
      (attempts !== undefined && attempts.version === verifier?.version && attempts.lockedOut)
    );
  }

  /**
   * Checks one person's PIN on this till. Every try is kept for the server, right or wrong; a wrong one
   * counts against that PIN version and the one that reaches the limit locks it. With `approval`, the
   * person's role must allow it, and the record of what approved it is made.
   */
  async checkPin(principalId: string, pin: string, approval?: PinApproval): Promise<PinOutcome> {
    const { meta, localAuth } = this.snapshotOrThrow();
    if (this.refusedVerifier(principalId)) return { kind: 'weak-verifier' };
    const verifier = this.verifierFor(principalId);
    if (localAuth === null || verifier === null) return { kind: 'no-verifier' };
    if (approval !== undefined && !verifier.approves.includes(approval)) {
      return { kind: 'no-verifier' };
    }
    if (this.pinLocked(principalId)) return { kind: 'locked-out' };
    // The floor again, on what is stored: a verifier kept by an earlier build is checked the same way.
    if (verifierStrength(verifier) !== 'strong') return { kind: 'weak-verifier' };
    const now = this.now();
    const policy = localAuth.policy;
    const stored = meta.pinAttempts[principalId];
    const attempts =
      stored !== undefined && stored.version === verifier.version
        ? stored
        : attemptsFor(verifier, meta.pinEvents, policy);
    if (!pinShapeOk(pin, policy)) return { kind: 'not-a-pin' };
    const matches = await pinMatches(pin, verifier);
    const { meta: current } = this.snapshotOrThrow();
    const pinEvents = [
      ...current.pinEvents,
      this.pinTry(verifier, matches ? 'SUCCEEDED' : 'FAILED', approval),
    ];
    // Told at once where the server can be reached; otherwise it waits on the device for the next sync.
    const tell = () => this.kick();
    if (!matches) {
      const next = afterFailure(attempts, policy);
      await this.store.saveMeta({
        ...current,
        pinAttempts: { ...current.pinAttempts, [principalId]: next },
        pinEvents,
      });
      await this.reload();
      tell();
      if (next.lockedOut) return { kind: 'locked-out' };
      return { kind: 'wrong', attemptsLeft: policy.maxAttempts - next.failures };
    }
    // A right PIN does not wipe a wrong try (2.17.0): the count stays.
    await this.store.saveMeta({
      ...current,
      pinAttempts: { ...current.pinAttempts, [principalId]: attempts },
      pinEvents,
    });
    await this.reload();
    tell();
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

  /** Whether the shift's cashier can lock this till: only with a PIN here to open it again. */
  canLock(): boolean {
    const shift = this.state.snapshot?.shift ?? null;
    if (shift === null) return false;
    const verifier = this.verifierFor(shift.cashierId);
    return (
      verifier !== null &&
      verifierStrength(verifier) === 'strong' &&
      !this.pinLocked(shift.cashierId)
    );
  }

  /** Locks the till until the shift's cashier enters their PIN. Selling and paying stop. */
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

  /**
   * The supervisors who may sign this locked till's cashier out with their PIN: never the cashier.
   */
  signOutSupervisors(): PinVerifier[] {
    const { shift, localAuth } = this.state.snapshot ?? { shift: null, localAuth: null };
    if (shift === null || localAuth === null) return [];
    return localAuth.verifiers.filter(
      (v) => v.approves.includes('SUPERVISOR_SIGN_OUT') && v.principalId !== shift.cashierId,
    );
  }

  /**
   * Signs the locked-out cashier out on a supervisor's PIN, checked the same way as any PIN, and does
   * nothing else: it never opens the till or sells as them (owner, 2026-11-17). It is offered only once the
   * cashier's PIN is locked, as the server takes it only then (`CASHIER_NOT_LOCKED`). It is recorded with
   * who did it and when, then sent to the server after the tries that locked the cashier. The cashier's PIN
   * stays locked until they set a new one. The caller then signs the session out.
   */
  async supervisorSignOut(supervisorId: string, pin: string): Promise<PinOutcome> {
    const { shift, meta } = this.snapshotOrThrow();
    if (shift === null || !meta.locked || !this.pinLocked(shift.cashierId)) {
      return { kind: 'no-verifier' };
    }
    if (!this.signOutSupervisors().some((v) => v.principalId === supervisorId)) {
      return this.refusedVerifier(supervisorId)
        ? { kind: 'weak-verifier' }
        : { kind: 'no-verifier' };
    }
    const outcome = await this.checkPin(supervisorId, pin, 'SUPERVISOR_SIGN_OUT');
    if (outcome.kind !== 'ok') return outcome;
    const { meta: current } = this.snapshotOrThrow();
    const signOut: TillSignOut = {
      id: newRecordId(),
      cashierId: shift.cashierId,
      shiftId: shift.id,
      supervisorId,
      supervisorPinVersion: outcome.verifier.version,
      occurredAt: this.now().toISOString(),
    };
    await this.store.saveMeta({ ...current, pinSignOuts: [...current.pinSignOuts, signOut] });
    await this.reload();
    // Sent while the session is still here; kept on the device if the server cannot be reached.
    await this.reachServer().catch(() => false);
    return outcome;
  }

  /**
   * Forgets the PIN verifiers and the lock: at shift close and at sign-out (OFFLINE_SYNC section 3). The
   * tries, the lockouts and what the server has not heard stay on the till (owner, 2026-11-17).
   */
  async forgetPins(): Promise<void> {
    const snapshot = this.state.snapshot;
    if (snapshot === null) return;
    await this.store.saveLocalAuth(null);
    await this.store.saveMeta({ ...snapshot.meta, locked: false });
    await this.reload();
  }

  /**
   * Opens a shift on this till with its float (section 10): the record is made here with a client id and
   * queued, so it opens offline too, and is sent at once. If the server refuses it at once (2.5.0: another
   * shift of the cashier's or the till's is not closed, the till is retired, the clock is out), nothing was
   * sold on it, so the till lets it go and throws the refusal for the screen to say; the refused record stays
   * on the queue for a manager, as every refusal does.
   */
  async openShift(input: {
    cashierId: string;
    cashierName: string;
    openingFloatPesewas: number;
  }): Promise<ShiftRecord> {
    const { device, meta, shift: current, pack } = this.snapshotOrThrow();
    if (device === null) throw new Error('This till is not enrolled.');
    if (current !== null) throw new Error('A shift is already open on this till.');
    const now = this.now();
    const id = newRecordId(now.getTime());
    // The sequence the receipts print until the server answers (2.15.0, OFFLINE_SYNC 10): the last pack's
    // `nextShiftSeq`, or one past the last shift this till heard of when that is later (an older pack).
    const referenceSeq = Math.max(pack?.nextShiftSeq ?? 0, (meta.lastShiftSeq ?? 0) + 1);
    const shift: ShiftRecord = {
      id,
      registerId: device.registerId,
      cashierId: input.cashierId,
      cashierName: input.cashierName,
      openingFloatPesewas: input.openingFloatPesewas,
      openedAt: now.toISOString(),
      shiftSeq: null,
      shiftNo: null,
      referenceSeq,
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
        // Sent so the server can flag a sequence that differs from its own; the server's stands.
        shiftSeq: referenceSeq,
      },
      serverResult: null,
    };
    await this.store.saveShift(shift);
    await this.store.putEntries([entry]);
    await this.reload();
    await this.flush();
    const sent = this.snapshotOrThrow().entries.find((e) => e.id === id);
    if (sent?.localStatus === 'FAILED_PERMANENT' && sent.failure !== null) {
      await this.store.saveShift(null);
      await this.reload();
      throw new ShiftRefused(sent.failure);
    }
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
    const { device, shift, pack } = this.snapshotOrThrow();
    if (device === null || shift === null) throw new Error('There is no open shift on this till.');
    const { approvals = [], ...sale } = input;
    const built = await buildSale({
      device,
      shift,
      ...sale,
      receiptLinkTemplate: pack?.receiptLinkTemplate ?? null,
      now: this.now(),
    });
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
      // The tries, lockouts and unsent PIN events stay: a lockout does not end with the shift.
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
