/**
 * What the barcode bar (in the till's shell, ADR 0014) read, for the screen under it. A scan is an event,
 * not state: each one adds an item once, even the same code twice in a row.
 */
type Listener = (code: string) => void;
const listeners = new Set<Listener>();

export function emitScan(code: string): void {
  listeners.forEach((listener) => listener(code));
}

/** Listens for scans; returns how to stop. Whether anyone listened is the caller's to know. */
export function onScan(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasScanListener(): boolean {
  return listeners.size > 0;
}
