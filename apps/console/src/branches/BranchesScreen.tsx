import { Plus, Store } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Button,
  IconChip,
  NOT_APPLICABLE,
  StatusBadge,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { BranchDialog } from './BranchDialog';

type Branch = components['schemas']['Branch'];

/** The status of a branch in words and shape. Closed is a state, not a deletion: its records stay. */
export function BranchStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('branches');
  return status === 'ACTIVE' ? (
    <StatusBadge tone="good" label={t('status.ACTIVE')} />
  ) : (
    <StatusBadge tone="slate" label={t(`status.${status}`, { defaultValue: status })} />
  );
}

/** FR-IAM branch scoping and FR-MDM locations: the farm and its selling points. */
export function BranchesScreen() {
  const { t } = useTranslation(['branches', 'common']);
  const auth = useAuth();
  const navigate = useNavigate();
  const pages = useCursorPages();
  const [creating, setCreating] = useState(false);
  // Branches change rarely: `reference`.
  const branches = useApiQuery(
    'listBranches',
    { query: pages.cursor === undefined ? {} : { cursor: pages.cursor } },
    { staleClass: 'reference' },
  );
  const labels = useStateLabels({
    loading: t('list.loading'),
    emptyTitle: t('list.empty'),
    emptyDescription: t('list.emptyBody'),
    errorTitle: t('list.error'),
    deniedTitle: t('list.denied'),
  });
  const columns: TableColumn<Branch>[] = [
    {
      id: 'branch',
      rowHeader: true,
      head: t('list.columns.branch'),
      sortValue: (branch) => branch.name,
      cell: (branch) => (
        <span className="flex items-center gap-3">
          <IconChip icon={Store} tone="accent" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/branches/${branch.id}`} className="text-accent-text hover:underline">
              {branch.name}
            </Link>
            <code className="text-control-sm font-normal text-fg-muted">{branch.code}</code>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('list.columns.status'),
      sortValue: (branch) => branch.status,
      cell: (branch) => (
        <span className="flex flex-wrap gap-1">
          <BranchStatusBadge status={branch.status} />
          {branch.isTest ? <StatusBadge tone="info" label={t('list.test')} /> : null}
        </span>
      ),
    },
    {
      id: 'address',
      head: t('list.columns.address'),
      sortValue: (branch) => branch.address,
      cell: (branch) => branch.address ?? NOT_APPLICABLE,
    },
    {
      id: 'phone',
      head: t('list.columns.phone'),
      cell: (branch) => branch.phone ?? NOT_APPLICABLE,
    },
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="branches-title" className="grid gap-4">
      <PageHeader
        title={t('list.title')}
        titleId="branches-title"
        description={t('list.description')}
        actions={
          auth.can('mdm.branch.create') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              {t('list.new')}
            </Button>
          ) : undefined
        }
      />
      <TableCard
        view={view}
        query={branches}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(branch) => branch.id}
        tableLabel={t('list.table')}
        exportName={t('list.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('list.pages') }}
      />
      {creating ? (
        <BranchDialog
          branch={null}
          onClose={() => setCreating(false)}
          onDone={(saved) => void navigate(`/branches/${saved.id}`)}
        />
      ) : null}
    </section>
  );
}
