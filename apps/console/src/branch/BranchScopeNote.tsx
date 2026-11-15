import { useTranslation } from 'react-i18next';
import { useBranchScope } from './branchScope';

/**
 * Under the title of a list the contract cannot narrow to one branch yet (CR-015): says so while one
 * branch is chosen in the header, so nobody reads another branch's documents as this one's.
 */
export function BranchScopeNote() {
  const { t } = useTranslation('shell');
  const scope = useBranchScope();
  if (scope.branchId === null) return null;
  return <span className="text-control-sm text-fg-muted">{t('branch.unscoped')}</span>;
}
