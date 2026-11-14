import type { components } from '@hakorem/api-client';

export type Permission = components['schemas']['Permission'];

/** The areas the catalogue has a name for (`iam:role.module.*`). Anything else is shown under "Other". */
export const KNOWN_MODULES = [
  'api',
  'aud',
  'bil',
  'cap',
  'cst',
  'del',
  'doc',
  'fin',
  'iam',
  'inv',
  'liv',
  'mdm',
  'ntf',
  'ord',
  'pay',
  'platform',
  'pos',
  'prc',
  'pur',
  'quo',
  'rpt',
  'whl',
] as const;
export type KnownModule = (typeof KNOWN_MODULES)[number];

export function isKnownModule(module: string): module is KnownModule {
  return (KNOWN_MODULES as readonly string[]).includes(module);
}

export interface PermissionGroup {
  /** The module code, or `other`. */
  module: KnownModule | 'other';
  permissions: Permission[];
}

/**
 * Groups permissions by area for the role screen, with each area's permissions in code order and the areas
 * in catalogue order. Duplicate codes are dropped: the mock answers every page with the same example rows
 * (ADR 0028), and a picker must not show one permission twice.
 */
export function groupPermissions(all: readonly Permission[]): PermissionGroup[] {
  const seen = new Set<string>();
  const byModule = new Map<KnownModule | 'other', Permission[]>();
  for (const permission of all) {
    if (seen.has(permission.code)) continue;
    seen.add(permission.code);
    const key = isKnownModule(permission.module) ? permission.module : 'other';
    byModule.set(key, [...(byModule.get(key) ?? []), permission]);
  }
  const order: (KnownModule | 'other')[] = [...KNOWN_MODULES, 'other'];
  return order.flatMap((module) => {
    const permissions = byModule.get(module);
    if (permissions === undefined) return [];
    return [{ module, permissions: [...permissions].sort((a, b) => a.code.localeCompare(b.code)) }];
  });
}
