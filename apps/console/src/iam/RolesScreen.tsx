import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import { Button, IconChip, StatusBadge, useTableView, type TableColumn } from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';

type Role = components['schemas']['Role'];

/** FR-IAM-008: the seeded roles and any the owner added, with what each carries. */
export function RolesScreen() {
  const { t } = useTranslation(['iam', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  // Roles change rarely and nobody acts on a figure here: `reference` (DATA_CONVENTIONS).
  const roles = useApiQuery(
    'listRoles',
    { query: pages.cursor === undefined ? {} : { cursor: pages.cursor } },
    { staleClass: 'reference' },
  );
  const labels = useStateLabels({
    loading: t('roles.loading'),
    emptyTitle: t('roles.empty'),
    emptyDescription: t('roles.emptyBody'),
    errorTitle: t('roles.error'),
    deniedTitle: t('roles.denied'),
  });

  const columns: TableColumn<Role>[] = [
    {
      id: 'name',
      rowHeader: true,
      head: t('roles.columns.name'),
      sortValue: (role) => role.name,
      cell: (role) => (
        <span className="flex items-center gap-3">
          <IconChip icon={ShieldCheck} tone={role.isSystem ? 'slate' : 'clay'} size="sm" />
          <span className="grid min-w-0">
            <Link to={`/roles/${role.id}`} className="text-accent-text hover:underline">
              {role.name}
            </Link>
            <code className="text-control-sm font-normal text-fg-muted">{role.code}</code>
          </span>
        </span>
      ),
    },
    {
      id: 'kind',
      head: t('roles.columns.kind'),
      sortValue: (role) => (role.isSystem ? 0 : 1),
      cell: (role) =>
        role.isSystem ? (
          <StatusBadge tone="slate" label={t('roles.system')} />
        ) : (
          <StatusBadge tone="clay" label={t('roles.custom')} />
        ),
    },
    {
      id: 'totp',
      head: t('roles.columns.totp'),
      sortValue: (role) => (role.requiresTotp ? 0 : 1),
      cell: (role) => (role.requiresTotp ? t('roles.totpRequired') : t('roles.totpOptional')),
    },
    {
      id: 'permissions',
      head: t('roles.columns.permissions'),
      numeric: true,
      sortValue: (role) => role.permissions.length,
      cell: (role) => role.permissions.length,
    },
    {
      id: 'users',
      head: t('roles.columns.users'),
      numeric: true,
      sortValue: (role) => role.userCount,
      cell: (role) => role.userCount,
    },
  ];
  const view = useTableView(columns);

  return (
    <section aria-labelledby="roles-title" className="grid gap-4">
      <PageHeader
        title={t('roles.title')}
        titleId="roles-title"
        actions={
          <>
            {auth.can('iam.role.manage') ? (
              <Button asChild>
                <Link to="/roles/new">{t('roles.new')}</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <TableCard
        view={view}
        query={roles}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(role) => role.id}
        tableLabel={t('roles.table')}
        exportName={t('roles.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('roles.pages') }}
      />
    </section>
  );
}
