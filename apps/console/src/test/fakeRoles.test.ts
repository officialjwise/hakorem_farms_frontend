import { describe, expect, it } from 'vitest';
import { operationManifest, seededRoles } from '@hakorem/api-client';
import { FAKE_USERS } from './fakeAuthServer';

/**
 * Permissions the contract names on an operation but no seeded role holds yet: their module's grants come
 * with its backend phase (CR-023, checked against `components.x-seeded-roles` in 2.2.0). The fake may give
 * them to the role named here. When the seed grants one, its line below fails: delete it and match the seed.
 */
const NOT_SEEDED: Readonly<Record<string, string>> = {
  // The audit log: `listAuditEvents` says "readable by Owner and Accountant only"; no role is seeded with it.
  'aud.audit.read': 'the audit log',
  // Reports and the exception list.
  'rpt.exceptions.read': 'reporting',
  'rpt.report.read': 'reporting',
  'rpt.report.export': 'reporting',
};

/**
 * Permissions the seed grants other roles but not yet this one, which its B11 work needs (CR-056): the
 * Driver's proof photograph and failure reasons. When the seed grants one to the role, its line fails:
 * delete it. (The Storekeeper's read of the order it picks is seeded from 2.29.0 as its own permission,
 * `ord.order.read.fulfilment`, and the fake holds that instead of `ord.order.read`.)
 */
const NOT_SEEDED_FOR_ROLE: Readonly<Record<string, readonly string[]>> = {
  DRIVER: ['platform.file.upload'],
};

/**
 * Permissions a contract request asks for, which the contract does not name yet (ADR 0046). The fake may
 * hold them so an e2e build switched on for the request can use it. When the contract names one, its line
 * fails: move it to NOT_SEEDED until the seed grants it, then delete it.
 */
const REQUESTED: Readonly<Record<string, string>> = {
  'rpt.exceptions.review': 'CR-059',
};

const seeded = new Set<string>(seededRoles.flatMap((role) => [...role.permissions]));

/** Every permission named on an operation, including a compound one ("rpt.report.read, plus rpt.report.export"). */
const named = new Set(
  Object.values(operationManifest).flatMap((row) =>
    row.permission === null ? [] : (row.permission.match(/[a-z_]+(?:\.[a-z_]+)+/g) ?? []),
  ),
);

describe('the test fake holds the seeded roles (CR-023)', () => {
  it.each(Object.entries(FAKE_USERS))(
    '%s holds only what the seed gives the role, or a permission not seeded yet',
    (_, user) => {
      const role = seededRoles.find((r) => r.code === user.roleCode);
      expect(role, `${user.roleCode} is a seeded role`).toBeDefined();
      const holds = new Set<string>(role?.permissions ?? []);
      const planned = NOT_SEEDED_FOR_ROLE[user.roleCode] ?? [];
      const beyond = user.permissions.filter(
        (p) => !holds.has(p) && !(p in NOT_SEEDED) && !(p in REQUESTED) && !planned.includes(p),
      );
      expect(beyond).toEqual([]);
    },
  );

  it('gives the Storekeeper the store’s view of an order and not the order with its money (2.29.0)', () => {
    const storekeepers = Object.values(FAKE_USERS).filter((u) => u.roleCode === 'STOREKEEPER');
    expect(storekeepers.length).toBeGreaterThan(0);
    for (const user of storekeepers) {
      expect(user.permissions).toContain('ord.order.read.fulfilment');
      expect(user.permissions).not.toContain('ord.order.read');
    }
  });

  it('asks a role for TOTP exactly when the seed does', () => {
    for (const user of Object.values(FAKE_USERS)) {
      const role = seededRoles.find((r) => r.code === user.roleCode);
      if (role?.requiresTotp === true) expect(user.totp || user.mustEnrolTotp === true).toBe(true);
    }
  });

  it.each(
    Object.entries(NOT_SEEDED_FOR_ROLE).flatMap(([role, codes]) =>
      codes.map((code) => [role, code] as const),
    ),
  )('%s is still not seeded with %s, which another role holds', (role, permission) => {
    const seededRole = seededRoles.find((r) => r.code === role);
    expect(seededRole?.permissions as readonly string[] | undefined).not.toContain(permission);
    expect(seeded.has(permission)).toBe(true);
  });

  it.each(Object.entries(NOT_SEEDED))(
    '%s is still not seeded, and the contract names it (%s)',
    (permission) => {
      expect(seeded.has(permission)).toBe(false);
      expect(named.has(permission)).toBe(true);
    },
  );

  it.each(Object.entries(REQUESTED))(
    '%s is not in the contract yet (%s asks for it)',
    (permission) => {
      expect(named.has(permission)).toBe(false);
      expect(seeded.has(permission)).toBe(false);
    },
  );
});
