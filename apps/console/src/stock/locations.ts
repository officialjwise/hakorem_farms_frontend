import { useBranchScope } from '../branch/branchScope';
import { useApiAllPages } from '../data/api';
import { uniqueById } from '../lib/queries';

/**
 * The physical locations stock is held at, for a choice list (virtual ones such as LOSS are left out), in
 * the branch chosen in the header (ADR 0034). With "all branches" chosen, every branch's locations.
 */
export function useLocations() {
  const scope = useBranchScope();
  // Pens, rooms and stores change rarely and the list is short (ADR 0028): `reference`.
  const locations = useApiAllPages(
    'listLocations',
    { query: { ...scope.query, limit: 100 } },
    { staleClass: 'reference' },
  );
  const items = uniqueById(locations.data?.items ?? []);
  return {
    query: locations,
    items,
    options: items.map((location) => ({ value: location.id, label: location.name })),
  };
}
