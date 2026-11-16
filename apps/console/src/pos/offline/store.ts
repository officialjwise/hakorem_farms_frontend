/**
 * The till's store (OFFLINE_SYNC.md section 3), in IndexedDB so it survives a reload, a crash and a dead
 * battery, with an in-memory twin for unit tests. The one write that must be atomic is a completed sale:
 * the device counter's increment and the queue record are written in the same transaction (section 4.2),
 * so a sale that fails to save does not consume a counter, and a counter is never reused.
 */
import {
  EMPTY_META,
  type DeviceRecord,
  type HeldLocal,
  type OfflinePack,
  type QueueEntry,
  type SaleEntry,
  type ShiftRecord,
  type SyncLogEntry,
  type TillMeta,
  type TillSnapshot,
} from './types';

export interface TillStore {
  read(): Promise<TillSnapshot>;
  saveDevice(device: DeviceRecord | null): Promise<void>;
  savePack(pack: OfflinePack | null): Promise<void>;
  saveShift(shift: ShiftRecord | null): Promise<void>;
  saveMeta(meta: TillMeta): Promise<void>;
  putEntries(entries: readonly QueueEntry[]): Promise<void>;
  removeEntries(ids: readonly string[]): Promise<void>;
  /**
   * Writes the sale and moves the shift's counter to its `deviceCounter` in one transaction. Refuses
   * (and writes nothing) unless the stored counter is the one before it, so two tabs cannot both use it.
   */
  commitSale(entry: SaleEntry, discountGivenPesewas: number): Promise<void>;
  putHeld(held: HeldLocal): Promise<void>;
  removeHeld(id: string): Promise<void>;
  appendSyncLog(entry: SyncLogEntry, keepAfter: string): Promise<void>;
}

export class CounterTakenError extends Error {
  constructor() {
    super('The device counter moved on: another window on this till completed a sale.');
    this.name = 'CounterTakenError';
  }
}

/** Creation order; two sales made in the same millisecond keep their counter order. */
function sortEntries(entries: QueueEntry[]): QueueEntry[] {
  return entries.sort((a, b) => {
    if (a.createdLocalAt !== b.createdLocalAt) return a.createdLocalAt < b.createdLocalAt ? -1 : 1;
    if (a.kind === 'SALE' && b.kind === 'SALE')
      return a.payload.deviceCounter - b.payload.deviceCounter;
    return a.id < b.id ? -1 : 1;
  });
}

function checkCounter(shift: ShiftRecord | null, entry: SaleEntry): ShiftRecord {
  if (shift === null || shift.id !== entry.shiftId) throw new CounterTakenError();
  if (entry.payload.deviceCounter !== shift.lastCounter + 1) throw new CounterTakenError();
  return shift;
}

/** For unit tests and anywhere IndexedDB is missing. Copies on the way in and out, as IndexedDB does. */
export function memoryStore(initial?: Partial<TillSnapshot>): TillStore {
  const copy = <T>(value: T): T => structuredClone(value);
  let device = initial?.device ?? null;
  let pack = initial?.pack ?? null;
  let shift = initial?.shift ?? null;
  let meta: TillMeta = initial?.meta ?? { ...EMPTY_META };
  const queue = new Map<string, QueueEntry>((initial?.entries ?? []).map((e) => [e.id, e]));
  const held = new Map<string, HeldLocal>((initial?.held ?? []).map((h) => [h.id, h]));
  let syncLog: SyncLogEntry[] = initial?.syncLog ?? [];
  return {
    read: async () =>
      copy({
        device,
        pack,
        shift,
        meta,
        entries: sortEntries([...queue.values()]),
        held: [...held.values()],
        syncLog,
      }),
    saveDevice: async (value) => void (device = copy(value)),
    savePack: async (value) => void (pack = copy(value)),
    saveShift: async (value) => void (shift = copy(value)),
    saveMeta: async (value) => void (meta = copy(value)),
    putEntries: async (entries) => entries.forEach((e) => queue.set(e.id, copy(e))),
    removeEntries: async (ids) => ids.forEach((id) => queue.delete(id)),
    commitSale: async (entry, discountGivenPesewas) => {
      const current = checkCounter(shift, entry);
      shift = { ...current, lastCounter: entry.payload.deviceCounter, discountGivenPesewas };
      queue.set(entry.id, copy(entry));
    },
    putHeld: async (value) => void held.set(value.id, copy(value)),
    removeHeld: async (id) => void held.delete(id),
    appendSyncLog: async (entry, keepAfter) => {
      syncLog = [...syncLog.filter((e) => e.at >= keepAfter), copy(entry)];
    },
  };
}

const DB_NAME = 'hakorem-till';
const RECORDS = 'records';
const QUEUE = 'queue';
const HELD = 'held';
const SYNC_LOG = 'sync_log';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed.'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new CounterTakenError());
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
  });
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore(RECORDS);
      db.createObjectStore(QUEUE, { keyPath: 'id' });
      db.createObjectStore(HELD, { keyPath: 'id' });
      db.createObjectStore(SYNC_LOG, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('The till store could not be opened.'));
  });
}

/** The browser's store. One database, `hakorem-till`, per origin. */
export function indexedDbStore(): TillStore {
  let db: Promise<IDBDatabase> | null = null;
  const database = () => (db ??= open());

  async function put(name: 'device' | 'pack' | 'shift' | 'meta', value: unknown) {
    const tx = (await database()).transaction(RECORDS, 'readwrite');
    tx.objectStore(RECORDS).put(value, name);
    await done(tx);
  }

  return {
    async read() {
      const tx = (await database()).transaction([RECORDS, QUEUE, HELD, SYNC_LOG], 'readonly');
      const records = tx.objectStore(RECORDS);
      const [device, pack, shift, meta, entries, held, syncLog] = await Promise.all([
        request(records.get('device')),
        request(records.get('pack')),
        request(records.get('shift')),
        request(records.get('meta')),
        request(tx.objectStore(QUEUE).getAll()),
        request(tx.objectStore(HELD).getAll()),
        request(tx.objectStore(SYNC_LOG).getAll()),
      ]);
      return {
        device: (device as DeviceRecord | undefined) ?? null,
        pack: (pack as OfflinePack | undefined) ?? null,
        shift: (shift as ShiftRecord | undefined) ?? null,
        meta: { ...EMPTY_META, ...((meta as TillMeta | undefined) ?? {}) },
        entries: sortEntries(entries as QueueEntry[]),
        held: held as HeldLocal[],
        syncLog: syncLog as SyncLogEntry[],
      };
    },
    saveDevice: (value) => put('device', value),
    savePack: (value) => put('pack', value),
    saveShift: (value) => put('shift', value),
    saveMeta: (value) => put('meta', value),
    async putEntries(entries) {
      const tx = (await database()).transaction(QUEUE, 'readwrite');
      entries.forEach((entry) => tx.objectStore(QUEUE).put(entry));
      await done(tx);
    },
    async removeEntries(ids) {
      const tx = (await database()).transaction(QUEUE, 'readwrite');
      ids.forEach((id) => tx.objectStore(QUEUE).delete(id));
      await done(tx);
    },
    async commitSale(entry, discountGivenPesewas) {
      const tx = (await database()).transaction([RECORDS, QUEUE], 'readwrite');
      const records = tx.objectStore(RECORDS);
      const read = records.get('shift');
      read.onsuccess = () => {
        try {
          const current = checkCounter((read.result as ShiftRecord | undefined) ?? null, entry);
          records.put(
            { ...current, lastCounter: entry.payload.deviceCounter, discountGivenPesewas },
            'shift',
          );
          tx.objectStore(QUEUE).put(entry);
        } catch {
          tx.abort();
        }
      };
      await done(tx);
    },
    async putHeld(value) {
      const tx = (await database()).transaction(HELD, 'readwrite');
      tx.objectStore(HELD).put(value);
      await done(tx);
    },
    async removeHeld(id) {
      const tx = (await database()).transaction(HELD, 'readwrite');
      tx.objectStore(HELD).delete(id);
      await done(tx);
    },
    async appendSyncLog(entry, keepAfter) {
      const tx = (await database()).transaction(SYNC_LOG, 'readwrite');
      const log = tx.objectStore(SYNC_LOG);
      const cursor = log.openCursor();
      cursor.onsuccess = () => {
        const at = cursor.result;
        if (at === null) {
          log.add(entry);
          return;
        }
        if ((at.value as SyncLogEntry).at < keepAfter) at.delete();
        at.continue();
      };
      await done(tx);
    },
  };
}
