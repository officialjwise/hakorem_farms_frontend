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
  // Wholesale accounts and the ageing (B10 continued, CR-046 item 5; A-F10-10). The quote grants are
  // seeded from 2.12.0.
  'whl.account.read': 'B10',
  'whl.account.manage': 'B10',
  'whl.account.hold': 'B10',
  'whl.ageing.read': 'B10',
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
      const beyond = user.permissions.filter((p) => !holds.has(p) && !(p in NOT_SEEDED));
      expect(beyond).toEqual([]);
    },
  );

  it('asks a role for TOTP exactly when the seed does', () => {
    for (const user of Object.values(FAKE_USERS)) {
      const role = seededRoles.find((r) => r.code === user.roleCode);
      if (role?.requiresTotp === true) expect(user.totp || user.mustEnrolTotp === true).toBe(true);
    }
  });

  it.each(Object.entries(NOT_SEEDED))(
    '%s is still not seeded, and the contract names it (%s)',
    (permission) => {
      expect(seeded.has(permission)).toBe(false);
      expect(named.has(permission)).toBe(true);
    },
  );
});
