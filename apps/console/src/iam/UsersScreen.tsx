import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Button,
  Field,
  Input,
  Pagination,
  QueryBoundary,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { contactOf, rolesOf, UserStatusBadge, When, type UserStatus } from './presentation';

const STATUSES: readonly UserStatus[] = ['ACTIVE', 'LOCKED', 'DISABLED'];
const ANY = 'ANY';
const COLUMNS = 5;

/** FR-IAM-001, 015, 017: the staff accounts, filtered by status and a search, a page at a time. */
export function UsersScreen() {
  const { t } = useTranslation(['iam', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [status, setStatus] = useState<string>(ANY);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  // A list people browse and filter: `working` (30 s), never a figure anyone acts on (DATA_CONVENTIONS).
  const users = useApiQuery(
    'listUsers',
    {
      query: {
        realm: 'STAFF',
        ...(status === ANY ? {} : { status: status as UserStatus }),
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

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(draft.trim());
    pages.reset();
  };

  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('users.columns.name')}</TableHead>
        <TableHead>{t('users.columns.contact')}</TableHead>
        <TableHead>{t('users.columns.roles')}</TableHead>
        <TableHead>{t('users.columns.status')}</TableHead>
        <TableHead>{t('users.columns.lastLogin')}</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <section aria-labelledby="users-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="users-title" className="text-2xl font-semibold">
          {t('users.title')}
        </h1>
        {auth.can('iam.user.create') ? (
          <Button asChild>
            <Link to="/users/new">{t('users.new')}</Link>
          </Button>
        ) : null}
      </div>

      <form
        role="search"
        aria-label={t('users.filters.label')}
        onSubmit={onSearch}
        className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end"
      >
        <Field label={t('users.filters.status')}>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              pages.reset();
            }}
            options={[
              { value: ANY, label: t('users.filters.anyStatus') },
              ...STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
            ]}
          />
        </Field>
        <Field label={t('users.filters.search')}>
          <Input type="search" value={draft} onChange={(event) => setDraft(event.target.value)} />
        </Field>
        <Button type="submit" variant="secondary">
          {t('common:actions.search')}
        </Button>
      </form>

      <QueryBoundary
        query={users}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('users.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={COLUMNS} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <div className="grid gap-3">
            <TableContainer aria-label={t('users.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((user) => {
                    const roles = rolesOf(user.grants);
                    return (
                      <TableRow key={user.id}>
                        <TableRowHeader>
                          <Link to={`/users/${user.id}`} className="text-accent-text underline">
                            {user.displayName}
                          </Link>
                        </TableRowHeader>
                        <TableCell label={t('users.columns.contact')}>{contactOf(user)}</TableCell>
                        <TableCell label={t('users.columns.roles')}>
                          {roles.length === 0 ? t('users.noRole') : roles.join(', ')}
                        </TableCell>
                        <TableCell label={t('users.columns.status')}>
                          <UserStatusBadge status={user.status} />
                        </TableCell>
                        <TableCell label={t('users.columns.lastLogin')}>
                          <When instant={user.lastLoginAt} empty={t('common:time.never')} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('users.pages')}
                hasPrevious={pages.hasPrevious}
                hasNext={page.page.hasMore && page.page.nextCursor !== null}
                onPrevious={pages.previous}
                onNext={() => {
                  if (page.page.nextCursor !== null) pages.next(page.page.nextCursor);
                }}
                previousLabel={t('common:pagination.previous')}
                nextLabel={t('common:pagination.next')}
                summary={t('common:pagination.page', { page: pages.page })}
              />
            ) : null}
          </div>
        )}
      </QueryBoundary>
    </section>
  );
}
