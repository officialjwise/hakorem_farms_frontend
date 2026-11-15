import { ShieldCheck, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Button,
  Pagination,
  QueryBoundary,
  StatusBadge,
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
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';

const COLUMNS = 6;

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

  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('roles.columns.name')}</TableHead>
        <TableHead>{t('roles.columns.code')}</TableHead>
        <TableHead>{t('roles.columns.kind')}</TableHead>
        <TableHead>{t('roles.columns.totp')}</TableHead>
        <TableHead numeric>{t('roles.columns.permissions')}</TableHead>
        <TableHead numeric>{t('roles.columns.users')}</TableHead>
      </TableRow>
    </TableHeader>
  );

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
      <QueryBoundary
        query={roles}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('roles.table')}>
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
            <TableContainer aria-label={t('roles.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((role) => (
                    <TableRow key={role.id}>
                      <TableRowHeader>
                        <Link to={`/roles/${role.id}`} className="text-accent-text underline">
                          {role.name}
                        </Link>
                      </TableRowHeader>
                      <TableCell label={t('roles.columns.code')}>
                        <code>{role.code}</code>
                      </TableCell>
                      <TableCell label={t('roles.columns.kind')}>
                        {role.isSystem ? (
                          <StatusBadge tone="slate" icon={ShieldCheck} label={t('roles.system')} />
                        ) : (
                          <StatusBadge tone="clay" icon={Wrench} label={t('roles.custom')} />
                        )}
                      </TableCell>
                      <TableCell label={t('roles.columns.totp')}>
                        {role.requiresTotp ? t('roles.totpRequired') : t('roles.totpOptional')}
                      </TableCell>
                      <TableCell numeric label={t('roles.columns.permissions')}>
                        {role.permissions.length}
                      </TableCell>
                      <TableCell numeric label={t('roles.columns.users')}>
                        {role.userCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('roles.pages')}
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
