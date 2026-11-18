/**
 * The driver's store (ADR 0055), in IndexedDB so a run survives a reload, a crash and a flat battery, with
 * an in-memory twin for unit tests. Its own database, `hakorem-driver`, beside the till's `hakorem-till`:
 * a phone is a driver's or a till's, and neither reads the other's records.
 */
import {
  EMPTY_RECORDS,
  type DriverEntry,
  type DriverRecords,
  type DriverSnapshot,
  type StoredPhoto,
} from './types';

export interface DriverStore {
  read(): Promise<DriverSnapshot>;
  saveRecords(records: DriverRecords): Promise<void>;
  putEntries(entries: readonly DriverEntry[]): Promise<void>;
  /** The record and its photograph in one transaction, so a proof is never queued without its picture. */
  commit(entry: DriverEntry, photo: StoredPhoto | null): Promise<void>;
  putPhoto(photo: StoredPhoto): Promise<void>;
  getPhoto(id: string): Promise<StoredPhoto | null>;
  removePhotos(ids: readonly string[]): Promise<void>;
  removeEntries(ids: readonly string[]): Promise<void>;
}

/** The order records are sent in: the order they were made. */
function sortEntries(entries: DriverEntry[]): DriverEntry[] {
  return entries.sort((a, b) =>
    a.createdLocalAt !== b.createdLocalAt
      ? a.createdLocalAt < b.createdLocalAt
        ? -1
        : 1
      : a.id < b.id
        ? -1
        : 1,
  );
}

/** For unit tests and anywhere IndexedDB is missing. Copies records as IndexedDB does; a Blob is kept as is. */
export function memoryDriverStore(initial?: Partial<DriverSnapshot>): DriverStore {
  const copy = <T>(value: T): T => structuredClone(value);
  let records: DriverRecords = { ...EMPTY_RECORDS, ...initial?.records };
  const queue = new Map<string, DriverEntry>((initial?.entries ?? []).map((e) => [e.id, e]));
  const photos = new Map<string, StoredPhoto>();
  return {
    read: async () => ({
      records: copy(records),
      entries: sortEntries([...queue.values()].map(copy)),
      photoIds: [...photos.keys()],
    }),
    saveRecords: async (value) => void (records = copy(value)),
    putEntries: async (entries) => entries.forEach((e) => queue.set(e.id, copy(e))),
    commit: async (entry, photo) => {
      if (photo !== null) photos.set(photo.id, { ...photo });
      queue.set(entry.id, copy(entry));
    },
    putPhoto: async (photo) => void photos.set(photo.id, { ...photo }),
    getPhoto: async (id) => {
      const photo = photos.get(id);
      return photo === undefined ? null : { ...photo };
    },
    removePhotos: async (ids) => ids.forEach((id) => photos.delete(id)),
    removeEntries: async (ids) => ids.forEach((id) => queue.delete(id)),
  };
}

const DB_NAME = 'hakorem-driver';
const RECORDS = 'records';
const QUEUE = 'queue';
const PHOTOS = 'photos';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed.'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
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
      db.createObjectStore(PHOTOS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('The driver store could not be opened.'));
  });
}

/** The browser's store. One database, `hakorem-driver`, per origin. */
export function indexedDbDriverStore(): DriverStore {
  let db: Promise<IDBDatabase> | null = null;
  const database = () => (db ??= open());

  return {
    async read() {
      const tx = (await database()).transaction([RECORDS, QUEUE, PHOTOS], 'readonly');
      const [records, entries, photoIds] = await Promise.all([
        request(tx.objectStore(RECORDS).get('records')),
        request(tx.objectStore(QUEUE).getAll()),
        request(tx.objectStore(PHOTOS).getAllKeys()),
      ]);
      return {
        records: { ...EMPTY_RECORDS, ...((records as DriverRecords | undefined) ?? {}) },
        entries: sortEntries(entries as DriverEntry[]),
        photoIds: photoIds.map(String),
      };
    },
    async saveRecords(value) {
      const tx = (await database()).transaction(RECORDS, 'readwrite');
      tx.objectStore(RECORDS).put(value, 'records');
      await done(tx);
    },
    async putEntries(entries) {
      const tx = (await database()).transaction(QUEUE, 'readwrite');
      entries.forEach((entry) => tx.objectStore(QUEUE).put(entry));
      await done(tx);
    },
    async commit(entry, photo) {
      const tx = (await database()).transaction([QUEUE, PHOTOS], 'readwrite');
      if (photo !== null) tx.objectStore(PHOTOS).put(photo);
      tx.objectStore(QUEUE).put(entry);
      await done(tx);
    },
    async putPhoto(photo) {
      const tx = (await database()).transaction(PHOTOS, 'readwrite');
      tx.objectStore(PHOTOS).put(photo);
      await done(tx);
    },
    async getPhoto(id) {
      const tx = (await database()).transaction(PHOTOS, 'readonly');
      const photo = await request(tx.objectStore(PHOTOS).get(id));
      return (photo as StoredPhoto | undefined) ?? null;
    },
    async removePhotos(ids) {
      const tx = (await database()).transaction(PHOTOS, 'readwrite');
      ids.forEach((id) => tx.objectStore(PHOTOS).delete(id));
      await done(tx);
    },
    async removeEntries(ids) {
      const tx = (await database()).transaction(QUEUE, 'readwrite');
      ids.forEach((id) => tx.objectStore(QUEUE).delete(id));
      await done(tx);
    },
  };
}
