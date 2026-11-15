import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Avatar,
  Button,
  Field,
  FilterMenu,
  Select,
  ToolbarSearch,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import {
  contactOf,
  rolesOf,
  UserStatusBadge,
  When,
  type UserAccount,
  type UserStatus,
} from './presentation';

const STATUSES: readonly UserStatus[] = ['ACTIVE', 'LOCKED', 'DISABLED'];
const ANY = 'ANY';

/** FR-IAM-001, 015, 017: the staff accounts, filtered by status and a search, a page at a time. */
export function UsersScreen() {
  const { t } = useTranslation(['iam', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [status, setStatus] = useState<UserStatus | typeof ANY>(ANY);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  // A list people browse and filter: `working` (30 s), never a figure anyone acts on (DATA_CONVENTIONS).
  const users = useApiQuery(
    'listUsers',
    {
      query: {
        realm: 'STAFF',
        ...(status === ANY ? {} : { status }),
        ...(search === '' ? {} : { q: search }),
        ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
      },
    },
    { staleClass: 'working' },
  );

  const labels = useStateLabels({
    loading: t('users.loading'),
    emptyTitle: t('users.empty'),
    emptyDescription: t('users.emptyBody'),
    errorTitle: t('users.error'),
    deniedTitle: t('users.denied'),
  });

  const columns: TableColumn<UserAccount>[] = [
    {
      id: 'name',
      rowHeader: true,
      head: t('users.columns.name'),
      sortValue: (user) => user.displayName,
      cell: (user) => (
        <span className="flex items-center gap-3">
          <Avatar name={user.displayName} size="sm" />
          <Link to={`/users/${user.id}`} className="min-w-0 text-accent-text hover:underline">
            {user.displayName}
          </Link>
        </span>
      ),
    },
    {
      id: 'contact',
      head: t('users.columns.contact'),
      sortValue: (user) => contactOf(user),
      cell: (user) => contactOf(user),
    },
    {
      id: 'roles',
      head: t('users.columns.roles'),
      cell: (user) => {
        const roles = rolesOf(user.grants);
        return roles.length === 0 ? t('users.noRole') : roles.join(', ');
      },
    },
    {
      id: 'status',
      head: t('users.columns.status'),
      sortValue: (user) => user.status,
      cell: (user) => <UserStatusBadge status={user.status} />,
    },
    {
      id: 'lastLogin',
      head: t('users.columns.lastLogin'),
      // ISO instants sort as text.
      sortValue: (user) => user.lastLoginAt,
      cell: (user) => <When instant={user.lastLoginAt} empty={t('common:time.never')} />,
    },
  ];
  const view = useTableView(columns);

  return (
    <section aria-labelledby="users-title" className="grid gap-4">
      <PageHeader
        title={t('users.title')}
        titleId="users-title"
        actions={
          <>
            {auth.can('iam.user.create') ? (
              <Button asChild>
                <Link to="/users/new">{t('users.new')}</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <TableCard
        view={view}
        query={users}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(user) => user.id}
        tableLabel={t('users.table')}
        exportName={t('users.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('users.pages') }}
        toolbar={
          <>
            <ToolbarSearch
              label={t('users.searchLabel')}
              placeholder={t('users.searchPlaceholder')}
              value={draft}
              onValueChange={setDraft}
              onSubmit={(value) => {
                setSearch(value);
                pages.reset();
              }}
            />
            <FilterMenu
              label={t('common:table.filter')}
              active={status === ANY ? 0 : 1}
              reset={{
                label: t('common:table.resetFilters'),
                onReset: () => {
                  setStatus(ANY);
                  pages.reset();
                },
              }}
            >
              <Field label={t('users.filters.status')}>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(STATUSES.find((s) => s === value) ?? ANY);
                    pages.reset();
                  }}
                  options={[
                    { value: ANY, label: t('users.filters.anyStatus') },
                    ...STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
                  ]}
                />
              </Field>
            </FilterMenu>
          </>
        }
      />
    </section>
  );
}
