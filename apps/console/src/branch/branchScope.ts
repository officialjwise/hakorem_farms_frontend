import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { openPreference, usePreference } from '../lib/preferences';

/** The stored choice. Empty means "not chosen yet"; ALL means every branch the person holds. */
export const branchPreference = openPreference('hk.branch');
export const ALL_BRANCHES = 'ALL';

export interface BranchOption {
  id: string;
  code: string;
  /** The branch's name from `listBranches` when the person may read it, else its code. */
  name: string;
}

export interface BranchScope {
  /** The branches the person holds a role at, from the session's grants. */
  branches: BranchOption[];
  /** The chosen branch, or null for all of them. */
  branchId: string | null;
  /** Spread into a read's query: `{ branchId }` for one branch, nothing for all. */
  query: { branchId?: string };
  choose: (id: string) => void;
}

/**
 * Which branch the back office is looking at (ADR 0034). The choices are the branches the person holds a
 * role at (`SessionInfo.grants`); the server still decides what each read returns. One branch is chosen
 * at first (the first grant's); someone with more than one may pick "all branches". Every read that takes
 * `branchId` spreads `query` into its input, so its cache key changes with the choice and it re-reads.
 */
export function useBranchScope(): BranchScope {
  const auth = useAuth();
  const stored = usePreference(branchPreference);
  const grants = auth.session?.grants;
  // Branch names are reference data (DATA_CONVENTIONS): they change rarely.
  const names = useApiQuery(
    'listBranches',
    { query: { limit: 100 } },
    { staleClass: 'reference', enabled: auth.can('mdm.branch.read') },
  );
  const branches = useMemo(() => {
    const seen = new Map<string, BranchOption>();
    for (const grant of grants ?? []) {
      if (!seen.has(grant.branchId)) {
        const named = names.data?.data.find((branch) => branch.id === grant.branchId);
        seen.set(grant.branchId, {
          id: grant.branchId,
          code: grant.branchCode,
          name: named?.name ?? grant.branchCode,
        });
      }
    }
    return [...seen.values()];
  }, [grants, names.data]);

  const valid =
    (stored === ALL_BRANCHES && branches.length > 1) ||
    branches.some((branch) => branch.id === stored);
  const chosen = valid ? stored : (branches[0]?.id ?? ALL_BRANCHES);
  const branchId = chosen === ALL_BRANCHES ? null : chosen;
  return {
    branches,
    branchId,
    query: branchId === null ? {} : { branchId },
    choose: branchPreference.set,
  };
}
