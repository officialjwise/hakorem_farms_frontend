/**
 * The optional receipt printer (ADR 0045): a 58 mm ESC/POS printer over Bluetooth Low Energy, through Web
 * Bluetooth. Detected, never required. Safari on iOS has no Web Bluetooth at all, so there the till offers
 * no printing and says so; the sale is never held up by a printer, and nothing here waits on the network.
 *
 * Most cheap thermal printers expose one of a handful of serial-over-BLE services. The till asks for any of
 * them, then writes to the first characteristic that takes a write.
 */
import { useSyncExternalStore } from 'react';

/** The services the common 58 mm printers expose (the vendor-neutral 0x18F0, and two serial bridges). */
export const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
] as const;

/** Bytes per write: small enough for a printer that never raised its MTU. */
export const CHUNK_BYTES = 100;

/** The slice of Web Bluetooth the till uses. TypeScript's DOM library does not describe it. */
export interface BleCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  writeValue: (value: BufferSource) => Promise<void>;
}
interface BleService {
  getCharacteristics: () => Promise<BleCharacteristic[]>;
}
interface BleServer {
  connected: boolean;
  getPrimaryService: (uuid: string) => Promise<BleService>;
}
export interface BleDevice {
  name?: string;
  gatt?: { connected: boolean; connect: () => Promise<BleServer> };
}
export interface BleNavigator {
  bluetooth?: {
    getAvailability?: () => Promise<boolean>;
    requestDevice: (options: {
      filters: { services: string[] }[];
      optionalServices: string[];
    }) => Promise<BleDevice>;
  };
}

/** `unsupported`: no Web Bluetooth (Safari on iOS, Firefox). `off`: it exists but the radio is off or absent. */
export type PrinterSupport = 'unsupported' | 'off' | 'available';

export async function printerSupport(nav: BleNavigator): Promise<PrinterSupport> {
  if (nav.bluetooth === undefined) return 'unsupported';
  if (nav.bluetooth.getAvailability === undefined) return 'available';
  return (await nav.bluetooth.getAvailability().catch(() => false)) ? 'available' : 'off';
}

export interface ConnectedPrinter {
  name: string;
  write: (bytes: Uint8Array) => Promise<void>;
}

async function writable(server: BleServer): Promise<BleCharacteristic> {
  for (const uuid of PRINTER_SERVICES) {
    const service = await server.getPrimaryService(uuid).catch(() => null);
    if (service === null) continue;
    const found = (await service.getCharacteristics()).find(
      (c) => c.properties.writeWithoutResponse || c.properties.write,
    );
    if (found !== undefined) return found;
  }
  throw new Error('NO_WRITABLE_CHARACTERISTIC');
}

/** Writes the bytes in order, a chunk at a time, each written before the next is sent. */
export async function writeChunks(
  characteristic: BleCharacteristic,
  bytes: Uint8Array,
): Promise<void> {
  for (let start = 0; start < bytes.length; start += CHUNK_BYTES) {
    const chunk = bytes.slice(start, start + CHUNK_BYTES);
    if (
      characteristic.properties.writeWithoutResponse &&
      characteristic.writeValueWithoutResponse
    ) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
  }
}

/** Asks the person to choose a printer (the browser's own chooser, which needs a tap) and connects it. */
export async function connectPrinter(nav: BleNavigator): Promise<ConnectedPrinter> {
  if (nav.bluetooth === undefined) throw new Error('UNSUPPORTED');
  const device = await nav.bluetooth.requestDevice({
    filters: PRINTER_SERVICES.map((uuid) => ({ services: [uuid] })),
    optionalServices: [...PRINTER_SERVICES],
  });
  if (device.gatt === undefined) throw new Error('NO_GATT');
  const gatt = device.gatt;
  let characteristic = await writable(await gatt.connect());
  return {
    name: device.name ?? '',
    write: async (bytes) => {
      // A printer that slept or was switched off and on reconnects on the next print.
      if (!gatt.connected) characteristic = await writable(await gatt.connect());
      await writeChunks(characteristic, bytes);
    },
  };
}

/** What the till's screens show about the printer. */
export type PrinterState =
  | { status: 'none' }
  | { status: 'connecting' }
  | { status: 'ready'; name: string }
  | { status: 'printing'; name: string }
  | { status: 'failed'; name: string | null; reason: 'cancelled' | 'connect' | 'print' };

/**
 * The printer this till document has connected, one per document like the till (ADR 0043): read with
 * `usePrinter()`. A failure stays on screen until the next attempt; a sale never waits for it.
 */
export class Printer {
  private state: PrinterState = { status: 'none' };
  private printer: ConnectedPrinter | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly nav: BleNavigator) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getState = (): PrinterState => this.state;
  support = (): Promise<PrinterSupport> => printerSupport(this.nav);

  private set(state: PrinterState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  async connect(): Promise<void> {
    this.set({ status: 'connecting' });
    try {
      this.printer = await connectPrinter(this.nav);
      this.set({ status: 'ready', name: this.printer.name });
    } catch (error) {
      this.printer = null;
      const cancelled = error instanceof DOMException && error.name === 'NotFoundError';
      this.set({ status: 'failed', name: null, reason: cancelled ? 'cancelled' : 'connect' });
    }
  }

  async print(bytes: Uint8Array): Promise<boolean> {
    const printer = this.printer;
    if (printer === null) return false;
    this.set({ status: 'printing', name: printer.name });
    try {
      await printer.write(bytes);
      this.set({ status: 'ready', name: printer.name });
      return true;
    } catch {
      this.set({ status: 'failed', name: printer.name, reason: 'print' });
      return false;
    }
  }
}

let instance: Printer | null = null;

export function getPrinter(): Printer {
  instance ??= new Printer(globalThis.navigator as unknown as BleNavigator);
  return instance;
}

export function usePrinter(): PrinterState {
  const printer = getPrinter();
  return useSyncExternalStore(printer.subscribe, printer.getState, printer.getState);
}
