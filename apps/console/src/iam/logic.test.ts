import { describe, expect, it } from 'vitest';
import { changeRows, dayEnd, dayStart, show } from '../audit/presentation';
import { bothQueries, uniqueById } from '../lib/queries';
import { groupPermissions, type Permission } from './permissions';
import { contactOf, rolesOf } from './presentation';

const permission = (code: string, requiresStepUp = false): Permission => ({
  code,
  module: code.split('.')[0] ?? '',
  description: code,
  requiresStepUp,
});

describe('groupPermissions', () => {
  it('groups by area in catalogue order, each area in code order, unknown areas last as "other"', () => {
    const groups = groupPermissions([
      permission('pos.sale.create'),
      permission('iam.user.read'),
      permission('iam.role.manage'),
      permission('zzz.thing.do'),
      permission('aud.audit.read'),
    ]);
    expect(groups.map((g) => g.module)).toEqual(['aud', 'iam', 'pos', 'other']);
    expect(groups[1]?.permissions.map((p) => p.code)).toEqual(['iam.role.manage', 'iam.user.read']);
  });

  it('shows each permission once, even when the answer repeats it (the mock does, ADR 0028)', () => {
    const groups = groupPermissions([permission('iam.user.read'), permission('iam.user.read')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.permissions).toHaveLength(1);
  });
});

describe('user presentation', () => {
  it('shows email, phone or both', () => {
    expect(contactOf({ email: 'a@b.com', phone: null })).toBe('a@b.com');
    expect(contactOf({ email: null, phone: '+233244100201' })).toBe('+233244100201');
    expect(contactOf({ email: 'a@b.com', phone: '+233244100201' })).toBe('a@b.com · +233244100201');
  });

  it('names each grant with its branch, and its location when it has one', () => {
    expect(
      rolesOf([
        {
          roleCode: 'CASHIER',
          roleName: 'Cashier',
          branchId: 'b',
          branchCode: 'DDW',
          locationId: null,
          locationCode: null,
        },
        {
          roleCode: 'STOREKEEPER',
          roleName: 'Storekeeper',
          branchId: 'b',
          branchCode: 'DDW',
          locationId: 'l',
          locationCode: 'COLD',
        },
      ]),
    ).toEqual(['Cashier (DDW)', 'Storekeeper (DDW, COLD)']);
  });
});

describe('audit presentation', () => {
  it('turns a picked Accra day into the whole UTC day (Accra is UTC+0)', () => {
    expect(dayStart('2026-11-14')).toBe('2026-11-14T00:00:00.000Z');
    expect(dayEnd('2026-11-14')).toBe('2026-11-14T23:59:59.999Z');
  });

  it('lines up before and after field by field, marking what changed', () => {
    expect(
      changeRows(
        { name: 'Goat', price: 1200, gone: 'x' },
        { name: 'Goat, Boer', price: 1200, added: true },
      ),
    ).toEqual([
      { field: 'added', before: null, after: 'true', changed: true },
      { field: 'gone', before: 'x', after: null, changed: true },
      { field: 'name', before: 'Goat', after: 'Goat, Boer', changed: true },
      { field: 'price', before: '1200', after: '1200', changed: false },
    ]);
  });

  it('handles a creation (no before), a deletion (no after) and an event with neither', () => {
    expect(changeRows(null, { a: 1 })).toEqual([
      { field: 'a', before: null, after: '1', changed: true },
    ]);
    expect(changeRows({ a: 1 }, null)).toEqual([
      { field: 'a', before: '1', after: null, changed: true },
    ]);
    expect(changeRows(null, null)).toEqual([]);
  });

  it('shows the server’s own words for erased and redacted values, and objects as JSON', () => {
    expect(show('[erased]')).toBe('[erased]');
    expect(show('[redacted]')).toBe('[redacted]');
    expect(show({ a: [1, 2] })).toBe('{"a":[1,2]}');
    expect(show(null)).toBeNull();
  });
});

describe('query helpers', () => {
  const ok = <T>(data: T) => ({
    status: 'success' as const,
    data,
    error: null,
    refetch: () => undefined,
  });
  const pending = {
    status: 'pending' as const,
    data: undefined,
    error: null,
    refetch: () => undefined,
  };
  const failed = (status: number) => ({
    status: 'error' as const,
    data: undefined,
    error: { status, code: 'X', message: 'm', correlationId: 'c' },
    refetch: () => undefined,
  });

  it('sees two reads as one: pending until both answer, the first failure, then both answers', () => {
    expect(bothQueries(ok(1), pending).status).toBe('pending');
    expect(bothQueries(ok(1), failed(403)).error?.status).toBe(403);
    expect(bothQueries(failed(500), failed(403)).error?.status).toBe(500);
    expect(bothQueries(ok(1), ok('a')).data).toEqual([1, 'a']);
  });

  it('keeps each id once, first row kept', () => {
    expect(
      uniqueById([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
        { id: 'a', n: 3 },
      ]),
    ).toEqual([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]);
  });
});
