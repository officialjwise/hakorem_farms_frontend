import { Building2, CircleCheck, CircleX, FlaskConical, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  Button,
  PageHeader,
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
  NOT_APPLICABLE,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { BranchDialog } from './BranchDialog';

const COLUMNS = 4;

/** The status of a branch in words and shape. Closed is a state, not a deletion: its records stay. */
export function BranchStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('branches');
  return status === 'ACTIVE' ? (
    <StatusBadge tone="good" icon={CircleCheck} label={t('status.ACTIVE')} />
  ) : (
    <StatusBadge
      tone="slate"
      icon={CircleX}
      label={t(`status.${status}`, { defaultValue: status })}
    />
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
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('list.columns.branch')}</TableHead>
        <TableHead>{t('list.columns.status')}</TableHead>
        <TableHead>{t('list.columns.address')}</TableHead>
        <TableHead>{t('list.columns.phone')}</TableHead>
      </TableRow>
    </TableHeader>
  );
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
      <QueryBoundary
        query={branches}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('list.table')}>
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
            <TableContainer aria-label={t('list.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableRowHeader>
                        <span className="flex items-center gap-2">
                          <Building2
                            aria-hidden="true"
                            className="size-icon-md shrink-0 stroke-accent"
                          />
                          <span className="grid">
                            <Link
                              to={`/branches/${branch.id}`}
                              className="text-accent-text underline"
                            >
                              {branch.name}
                            </Link>
                            <code className="text-control-sm text-fg-muted">{branch.code}</code>
                          </span>
                        </span>
                      </TableRowHeader>
                      <TableCell label={t('list.columns.status')}>
                        <span className="flex flex-wrap gap-1">
                          <BranchStatusBadge status={branch.status} />
                          {branch.isTest ? (
                            <StatusBadge tone="info" icon={FlaskConical} label={t('list.test')} />
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell label={t('list.columns.address')}>
                        {branch.address ?? NOT_APPLICABLE}
                      </TableCell>
                      <TableCell label={t('list.columns.phone')}>
                        {branch.phone ?? NOT_APPLICABLE}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('list.pages')}
                hasPrevious={pages.hasPrevious}
                hasNext={page.page.hasMore && page.page.nextCursor !== null}
                onPrevious={pages.previous}
                onNext={() => {
                  if (page.page.nextCursor !== null) pages.next(page.page.nextCursor);
                }}
                previousLabel={t('common:pagination.previous')}
                nextLabel={t('common:pagination.next')}
              />
            ) : null}
          </div>
        )}
      </QueryBoundary>
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
