import { describe, expect, it } from 'vitest';
import { newRecordId } from './clientId';

describe('newRecordId', () => {
  it('is a UUIDv7: version 7, variant 10, the contract’s uuid format', () => {
    const id = newRecordId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('carries the time it was made in its first 48 bits, so ids sort by time', () => {
    const at = Date.UTC(2026, 10, 15, 9, 30);
    const id = newRecordId(at);
    expect(Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(at);
    expect(newRecordId(at) < newRecordId(at + 1)).toBe(true);
  });

  it('is different every time', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newRecordId(0)));
    expect(ids.size).toBe(200);
  });
});
