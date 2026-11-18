/**
 * The driver's run on this phone (ADR 0055): one object per document, read by the screens with
 * `useDriverRun()` through `useSyncExternalStore`, as the till's store is (ADR 0043). No context, no
 * provider, no library.
 *
 * What the screens show comes from the store, never only from the network: the run, each stop, the reasons
 * and the cash are read from the server when there is signal and kept, so a run goes on with none. What the
 * driver records is written to the store first, with its client id, and then sent.
 *
 * When the queue is sent: as soon as a record is queued; when the browser says it is online again; and,
 * while records wait and the server cannot be reached, after a backoff (5 s doubling to 5 min, with
 * jitter) and on a health probe every 30 seconds. One pass at a time.
 */
import { useSyncExternalStore } from 'react';
import { ApiError, type ApiClient } from '@hakorem/api-client';
import { newRecordId } from '../../lib/clientId';
import { indexedDbDriverStore, memoryDriverStore, type DriverStore } from './store';
import { driverBackoffMs, flushDriverQueue, isPending, type DriverFlushOutcome } from './sync';
import {
  type Delivery,
  type DriverEntry,
  type DriverRecords,
  type DriverSnapshot,
  type EntryFailure,
  type FailureEntry,
  type OnTheWayEntry,
  type ProofEntry,
} from './types';

const PROBE_MS = 30_000;
/** Records the server took are kept a day, so the run screen can say "Sent" for each. */
const KEEP_APPLIED_MS = 24 * 60 * 60 * 1000;

export interface DriverSyncStatus {
  sending: boolean;
  unreachable: boolean;
  blocked: EntryFailure | null;
  nextAttemptAt: string | null;
  lastPassAt: string | null;
}

/** The last read of the run from the server: what the screens' four states come from. */
export type ReadStatus =
  { kind: 'idle' } | { kind: 'reading' } | { kind: 'read' } | { kind: 'failed'; error: ApiError };

export interface DriverRunState {
  snapshot: DriverSnapshot | null;
  read: ReadStatus;
  sync: DriverSyncStatus;
  storeError: string | null;
}

export interface DriverRunDeps {
  store: DriverStore;
  call: ApiClient['call'];
  now?: () => Date;
  random?: () => number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface ProofInput {
  deliveryId: string;
  recipientName: string;
  photoLocalId: string;
  codCollectedPesewas: number;
  position: Position | null;
}

export interface FailureInput {
  deliveryId: string;
  failureReasonCode: string;
  nextAction: 'REATTEMPT' | 'RETURN_TO_STOCK';
  position: Position | null;
}

/** A reading of the phone's position, as the contract's `Coordinate` strings. */
export interface Position {
  latitude: string;
  longitude: string;
  accuracyM: number | null;
}

/** Thrown when a stop already has a proof or a failure on this phone: one record per stop per attempt. */
export class AlreadyRecorded extends Error {
  constructor() {
    super('This stop already has a record on this phone.');
    this.name = 'AlreadyRecorded';
  }
}

const IDLE_SYNC: DriverSyncStatus = {
  sending: false,
  unreachable: false,
  blocked: null,
  nextAttemptAt: null,
  lastPassAt: null,
};

export class DriverRun {
  private state: DriverRunState = {
    snapshot: null,
    read: { kind: 'idle' },
    sync: IDLE_SYNC,
    storeError: null,
  };
  private readonly listeners = new Set<() => void>();
  private readonly store: DriverStore;
  private readonly call: ApiClient['call'];
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly setTimer: (run: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private running: Promise<DriverFlushOutcome> | null = null;
  private queued: Promise<DriverFlushOutcome> | null = null;
  private failures = 0;
  private retryTimer: unknown = null;
  private probeTimer: unknown = null;
  private ready: Promise<void> | null = null;

  constructor(deps: DriverRunDeps) {
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

  getState = (): DriverRunState => this.state;

  private set(change: Partial<DriverRunState>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }

  private setSync(change: Partial<DriverSyncStatus>) {
    this.set({ sync: { ...this.state.sync, ...change } });
  }

  private async reload(): Promise<DriverSnapshot> {
    const snapshot = await this.store.read();
    this.set({ snapshot });
    return snapshot;
  }

  /**
   * Reads the store once, puts a record a crash left `SENDING` back in the queue, drops what the server
   * took more than a day ago, then reads the run from the server and sends the queue.
   */
  start(): Promise<void> {
    this.ready ??= (async () => {
      try {
        const snapshot = await this.store.read();
        const stale = snapshot.entries.filter((e) => e.localStatus === 'SENDING');
        if (stale.length > 0) {
          await this.store.putEntries(stale.map((e) => ({ ...e, localStatus: 'QUEUED' as const })));
        }
        await this.tidy(snapshot);
        await this.reload();
        this.kick();
        void this.refresh();
      } catch (error) {
        this.set({ storeError: error instanceof Error ? error.message : String(error) });
      }
    })();
    return this.ready;
  }

  /** Removes records applied a day ago and photographs no waiting record names. */
  private async tidy(snapshot: DriverSnapshot) {
    const cutoff = this.now().getTime() - KEEP_APPLIED_MS;
    const old = snapshot.entries.filter(
      (e) =>
        e.localStatus === 'APPLIED' &&
        e.confirmedAt !== null &&
        new Date(e.confirmedAt).getTime() < cutoff,
    );
    if (old.length > 0) await this.store.removeEntries(old.map((e) => e.id));
    const kept = new Set(
      snapshot.entries
        .filter((e): e is ProofEntry => e.kind === 'PROOF' && isPending(e))
        .flatMap((e) => (e.photoLocalId === null ? [] : [e.photoLocalId])),
    );
    const loose = snapshot.photoIds.filter((id) => !kept.has(id));
    // A photograph taken in the last hour may belong to a proof still being filled in.
    const hourAgo = this.now().getTime() - 60 * 60 * 1000;
    const stale = loose.filter((id) => timeOfId(id) < hourAgo);
    if (stale.length > 0) await this.store.removePhotos(stale);
  }

  /**
   * Reads the run, each stop's delivery, the cash summary and the failure reasons, and keeps them. With no
   * signal the kept copy stays on screen, and the failure says so.
   */
  async refresh(): Promise<void> {
    await this.ready;
    this.set({ read: { kind: 'reading' } });
    try {
      const route = await this.call('getMyRoute', {});
      const deliveries: Record<string, Delivery> = {};
      // Each stop's address, phone and cash due, read now so the run needs no signal later.
      for (const stop of route.stops) {
        deliveries[stop.delivery.id] = await this.call('getMyDelivery', {
          path: { id: stop.delivery.id },
        });
      }
      const [cash, reasons, units] = await Promise.all([
        this.call('getMyCashSummary', {}).catch(() => null),
        this.readReasons().catch(() => null),
        this.readUnits().catch(() => null),
      ]);
      const kept = (await this.store.read()).records;
      const records: DriverRecords = {
        route,
        deliveries,
        cash: cash ?? kept.cash,
        reasons: reasons ?? kept.reasons,
        units: units ?? kept.units,
        readAt: this.now().toISOString(),
        runDate: route.routeDate,
      };
      await this.store.saveRecords(records);
      await this.reload();
      this.set({ read: { kind: 'read' } });
    } catch (error) {
      const failure =
        error instanceof ApiError
          ? error
          : new ApiError({
              status: 0,
              code: 'NETWORK_ERROR',
              message: String(error),
              correlationId: '',
            });
      // No run today is a fact, not a failure: the server answers 404 and nothing is kept.
      if (failure.status === 404) {
        const kept = (await this.store.read()).records;
        await this.store.saveRecords({
          ...kept,
          route: null,
          deliveries: {},
          readAt: this.now().toISOString(),
        });
        await this.reload();
        this.set({ read: { kind: 'read' } });
        return;
      }
      this.set({ read: { kind: 'failed', error: failure } });
    }
  }

  /** Only the cash summary, after the queue took a proof, so "what you carry" follows the server. */
  private async refreshCash(): Promise<void> {
    try {
      const cash = await this.call('getMyCashSummary', {});
      const kept = (await this.store.read()).records;
      await this.store.saveRecords({ ...kept, cash });
      await this.reload();
    } catch {
      // Kept as it was; the screen says when it was read.
    }
  }

  private async readReasons() {
    const page = await this.call('listReasonCodes', {
      query: { domain: 'DELIVERY_FAILURE', limit: 100 },
    });
    return page.data.map((r) => ({
      code: r.code,
      description: r.description,
      requiresNote: r.requiresNote,
    }));
  }

  private async readUnits() {
    const page = await this.call('listUnitsOfMeasure', { query: { limit: 100 } });
    return page.data.map((u) => ({
      code: u.code,
      singularName: u.singularName,
      pluralName: u.pluralName,
      displayDecimals: u.displayDecimals,
    }));
  }

  /** Keeps a photograph on the phone until its proof is sent. Answers its id, for `PhotoInput`'s value. */
  async keepPhoto(blob: Blob): Promise<string> {
    const id = newRecordId(this.now().getTime());
    await this.store.putPhoto({ id, blob, fileId: null });
    await this.reload();
    return id;
  }

  /** The photograph kept for a proof, for its preview. */
  photo(id: string): Promise<Blob | null> {
    return this.store.getPhoto(id).then((p) => p?.blob ?? null);
  }

  /** The record on this phone that closes a stop (a proof, or a failed attempt), if any. */
  closing(deliveryId: string): ProofEntry | FailureEntry | null {
    const entries = this.state.snapshot?.entries ?? [];
    const found = entries.filter(
      (e): e is ProofEntry | FailureEntry =>
        e.deliveryId === deliveryId &&
        (e.kind === 'PROOF' || e.kind === 'FAILURE') &&
        e.localStatus !== 'REJECTED',
    );
    return found.at(-1) ?? null;
  }

  private base(deliveryId: string, id: string) {
    return {
      id,
      deliveryId,
      createdLocalAt: this.now().toISOString(),
      localStatus: 'QUEUED' as const,
      attempts: 0,
      lastAttemptAt: null,
      confirmedAt: null,
      serverOutcome: null,
      serverReason: null,
      failure: null,
    };
  }

  /** "On my way": written to the phone, then sent. */
  async markOnTheWay(deliveryId: string): Promise<OnTheWayEntry> {
    const id = newRecordId(this.now().getTime());
    const entry: OnTheWayEntry = {
      ...this.base(deliveryId, id),
      kind: 'ON_THE_WAY',
      payload: { occurredAt: this.now().toISOString() },
    };
    await this.store.commit(entry, null);
    await this.reload();
    this.kick();
    return entry;
  }

  /** The proof of delivery and the cash the customer paid: written to the phone, then sent. */
  async recordProof(input: ProofInput): Promise<ProofEntry> {
    await this.ready;
    if (this.closing(input.deliveryId) !== null) throw new AlreadyRecorded();
    const id = newRecordId(this.now().getTime());
    const entry: ProofEntry = {
      ...this.base(input.deliveryId, id),
      kind: 'PROOF',
      photoLocalId: input.photoLocalId,
      payload: {
        id,
        recipientName: input.recipientName.trim(),
        codCollectedPesewas: input.codCollectedPesewas,
        capturedAt: this.now().toISOString(),
        ...positionFields(input.position),
      },
    };
    await this.store.commit(entry, null);
    await this.reload();
    this.kick();
    return entry;
  }

  /** A failed attempt (refused, nobody in, wrong address), with its reason: written, then sent. */
  async recordFailure(input: FailureInput): Promise<FailureEntry> {
    await this.ready;
    if (this.closing(input.deliveryId) !== null) throw new AlreadyRecorded();
    const id = newRecordId(this.now().getTime());
    const position = positionFields(input.position);
    const entry: FailureEntry = {
      ...this.base(input.deliveryId, id),
      kind: 'FAILURE',
      payload: {
        id,
        failureReasonCode: input.failureReasonCode,
        nextAction: input.nextAction,
        occurredAt: this.now().toISOString(),
        ...(position.latitude === undefined
          ? {}
          : { latitude: position.latitude, longitude: position.longitude }),
      },
    };
    await this.store.commit(entry, null);
    await this.reload();
    this.kick();
    return entry;
  }

  /** Sends the queue now, or as soon as the pass under way ends. */
  kick(): void {
    void this.flush();
  }

  flush(): Promise<DriverFlushOutcome> {
    if (this.running !== null) {
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

  private async pass(): Promise<DriverFlushOutcome> {
    if (this.retryTimer !== null) {
      this.clearTimer(this.retryTimer);
      this.retryTimer = null;
    }
    const before = this.state.snapshot?.entries.filter(isPending).length ?? 0;
    if (before === 0) return { kind: 'done' };
    this.setSync({ sending: true, nextAttemptAt: null });
    const outcome = await flushDriverQueue({
      store: this.store,
      call: this.call,
      now: this.now,
    }).catch((): DriverFlushOutcome => ({ kind: 'unreachable' }));
    const after = await this.reload();
    this.settle(outcome, after.entries);
    if (after.entries.some((e) => e.kind === 'PROOF' && e.localStatus === 'APPLIED')) {
      void this.refreshCash();
    }
    return outcome;
  }

  private settle(outcome: DriverFlushOutcome, entries: readonly DriverEntry[]) {
    const passAt = this.now().toISOString();
    const waiting = entries.some(isPending);
    if (outcome.kind === 'done' || !waiting) {
      this.failures = 0;
      this.stopProbe();
      this.setSync({ ...IDLE_SYNC, lastPassAt: passAt });
      return;
    }
    if (outcome.kind === 'blocked') {
      this.stopProbe();
      this.setSync({ ...IDLE_SYNC, blocked: outcome.failure, lastPassAt: passAt });
      return;
    }
    const wait =
      outcome.kind === 'rate-limited'
        ? outcome.seconds * 1000
        : driverBackoffMs(this.failures, this.random());
    this.failures += 1;
    this.retryTimer = this.setTimer(() => {
      this.retryTimer = null;
      this.kick();
    }, wait);
    this.startProbe();
    this.setSync({
      sending: false,
      unreachable: outcome.kind === 'unreachable',
      blocked: null,
      nextAttemptAt: new Date(this.now().getTime() + wait).toISOString(),
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

  /** The browser says the network is back: send now, and read the run again. */
  online(): void {
    this.failures = 0;
    this.kick();
    void this.refresh();
  }

  /** The driver signed in again after the session ended: the queue goes on. */
  resume(): void {
    this.setSync({ blocked: null });
    this.online();
  }
}

/** The time a UUIDv7 was made, from its first 48 bits. */
function timeOfId(id: string): number {
  return Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}

function positionFields(position: Position | null): {
  latitude?: string;
  longitude?: string;
  positionAccuracyM?: number;
} {
  if (position === null) return {};
  return {
    latitude: position.latitude,
    longitude: position.longitude,
    ...(position.accuracyM === null ? {} : { positionAccuracyM: position.accuracyM }),
  };
}

let instance: DriverRun | null = null;

/** This document's one driver run, made on first use with the browser's store. */
export function configureDriverRun(deps: DriverRunDeps): DriverRun {
  instance = new DriverRun(deps);
  return instance;
}

export function getDriverRun(): DriverRun | null {
  return instance;
}

/** The browser's store, or memory where IndexedDB is missing (the screen says so). */
export function browserDriverStore(): DriverStore {
  return typeof indexedDB === 'undefined' ? memoryDriverStore() : indexedDbDriverStore();
}

const NO_RUN: DriverRunState = {
  snapshot: null,
  read: { kind: 'idle' },
  sync: IDLE_SYNC,
  storeError: null,
};

export function useDriverRun(): DriverRunState {
  const run = instance;
  return useSyncExternalStore(
    run?.subscribe ?? (() => () => undefined),
    run?.getState ?? (() => NO_RUN),
    () => NO_RUN,
  );
}
