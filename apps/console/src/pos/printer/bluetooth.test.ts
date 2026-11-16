import { describe, expect, it } from 'vitest';
import {
  CHUNK_BYTES,
  PRINTER_SERVICES,
  Printer,
  printerSupport,
  type BleCharacteristic,
  type BleNavigator,
} from './bluetooth';

function fakePrinter(options: { withoutResponse?: boolean; failWrite?: boolean } = {}) {
  const written: number[][] = [];
  const asked: unknown[] = [];
  const characteristic: BleCharacteristic = {
    properties: { write: true, writeWithoutResponse: options.withoutResponse ?? false },
    writeValue: async (value) => {
      if (options.failWrite) throw new Error('GATT write failed');
      written.push([...new Uint8Array(value as ArrayBuffer)]);
    },
    ...(options.withoutResponse
      ? {
          writeValueWithoutResponse: async (value: BufferSource) => {
            written.push([...new Uint8Array(value as ArrayBuffer)]);
          },
        }
      : {}),
  };
  let connected = false;
  const nav: BleNavigator = {
    bluetooth: {
      getAvailability: async () => true,
      requestDevice: async (request) => {
        asked.push(request);
        return {
          name: 'MTP-II',
          gatt: {
            get connected() {
              return connected;
            },
            connect: async () => {
              connected = true;
              return {
                connected: true,
                getPrimaryService: async (uuid: string) => {
                  if (uuid !== PRINTER_SERVICES[1]) throw new Error('not here');
                  return { getCharacteristics: async () => [characteristic] };
                },
              };
            },
          },
        };
      },
    },
  };
  return { nav, written, asked, drop: () => (connected = false) };
}

describe('the optional Bluetooth printer (ADR 0045)', () => {
  it('is unsupported where the browser has no Web Bluetooth, as Safari on iOS has none', async () => {
    expect(await printerSupport({})).toBe('unsupported');
    expect(
      await printerSupport({
        bluetooth: { requestDevice: async () => ({}), getAvailability: async () => false },
      }),
    ).toBe('off');
    expect(await printerSupport(fakePrinter().nav)).toBe('available');
  });

  it('asks for the common printer services, finds the writable one, and writes in chunks in order', async () => {
    const fake = fakePrinter();
    const printer = new Printer(fake.nav);
    await printer.connect();
    expect(printer.getState()).toEqual({ status: 'ready', name: 'MTP-II' });
    expect(fake.asked[0]).toEqual({
      filters: PRINTER_SERVICES.map((uuid) => ({ services: [uuid] })),
      optionalServices: [...PRINTER_SERVICES],
    });
    const bytes = Uint8Array.from({ length: CHUNK_BYTES * 2 + 7 }, (_, i) => i % 256);
    expect(await printer.print(bytes)).toBe(true);
    expect(fake.written.map((chunk) => chunk.length)).toEqual([CHUNK_BYTES, CHUNK_BYTES, 7]);
    expect(fake.written.flat()).toEqual([...bytes]);
  });

  it('prefers a write without response, and reconnects a printer that dropped before printing', async () => {
    const fake = fakePrinter({ withoutResponse: true });
    const printer = new Printer(fake.nav);
    await printer.connect();
    fake.drop();
    expect(await printer.print(new Uint8Array([1, 2, 3]))).toBe(true);
    expect(fake.written).toEqual([[1, 2, 3]]);
  });

  it('says a print failed, and keeps the printer to try again; prints nothing with no printer', async () => {
    const fake = fakePrinter({ failWrite: true });
    const printer = new Printer(fake.nav);
    expect(await printer.print(new Uint8Array([1]))).toBe(false);
    expect(printer.getState()).toEqual({ status: 'none' });
    await printer.connect();
    expect(await printer.print(new Uint8Array([1]))).toBe(false);
    expect(printer.getState()).toEqual({ status: 'failed', name: 'MTP-II', reason: 'print' });
  });

  it('tells a chooser the person closed from a printer that would not connect', async () => {
    const cancelled = new Printer({
      bluetooth: {
        requestDevice: async () => {
          throw new DOMException('User cancelled the requestDevice() chooser.', 'NotFoundError');
        },
      },
    });
    await cancelled.connect();
    expect(cancelled.getState()).toEqual({ status: 'failed', name: null, reason: 'cancelled' });
    const broken = new Printer({ bluetooth: { requestDevice: async () => ({ name: 'X' }) } });
    await broken.connect();
    expect(broken.getState()).toEqual({ status: 'failed', name: null, reason: 'connect' });
  });
});
