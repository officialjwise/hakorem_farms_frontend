import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  Button,
  Dialog,
  Field,
  MutationFailure,
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
  PageHeader,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { BranchScopeNote } from '../branch/BranchScopeNote';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { useLocations } from './locations';
import { StockTakeStatusBadge } from './presentation';

const COLUMNS = 4;

/** FR-INV stock takes: each count, where, how far along, and its state. */
export function StockTakesScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [creating, setCreating] = useState(false);
  const takes = useApiQuery('listStockTakes', {
    query: pages.cursor === undefined ? {} : { cursor: pages.cursor },
  });
  const labels = useStateLabels({
    loading: t('takes.loading'),
    emptyTitle: t('takes.empty'),
    emptyDescription: t('takes.emptyBody'),
    errorTitle: t('takes.error'),
    deniedTitle: t('takes.denied'),
  });
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('takes.columns.take')}</TableHead>
        <TableHead>{t('takes.columns.status')}</TableHead>
        <TableHead numeric>{t('takes.columns.progress')}</TableHead>
        <TableHead>{t('takes.columns.created')}</TableHead>
      </TableRow>
    </TableHeader>
  );
  return (
    <section aria-labelledby="takes-title" className="grid gap-4">
      <PageHeader
        title={t('takes.title')}
        titleId="takes-title"
        description={<BranchScopeNote />}
        actions={
          <>
            {auth.can('inv.stock_take.create') ? (
              <Button onClick={() => setCreating(true)}>{t('takes.new')}</Button>
            ) : null}
          </>
        }
      />
      <QueryBoundary
        query={takes}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('takes.table')}>
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
            <TableContainer aria-label={t('takes.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((take) => (
                    <TableRow key={take.id}>
                      <TableRowHeader>
                        <Link to={`/stock-takes/${take.id}`} className="text-accent-text underline">
                          {take.location.name}
                        </Link>
                        <span className="block text-control-sm text-fg-muted">
                          {take.stockTakeNo ?? t('take.unnumbered')} · {t(`scope.${take.scope}`)}
                        </span>
                      </TableRowHeader>
                      <TableCell label={t('takes.columns.status')}>
                        <StockTakeStatusBadge status={take.status} />
                      </TableCell>
                      <TableCell numeric label={t('takes.columns.progress')}>
                        {t('take.progress', {
                          counted: take.countedLineCount,
                          total: take.lineCount,
                        })}
                      </TableCell>
                      <TableCell label={t('takes.columns.created')}>
                        {take.createdBy.displayName} · <When instant={take.createdAt} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('takes.pages')}
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
      {creating ? <NewTake onClose={() => setCreating(false)} /> : null}
    </section>
  );
}

/**
 * A new full count of one location. A cycle count of chosen products is the contract's other scope; it
 * needs a product picker and is not offered yet (A-F5-03).
 */
function NewTake({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['stock', 'common']);
  const navigate = useNavigate();
  const locations = useLocations();
  const [locationId, setLocationId] = useState('');
  const [missing, setMissing] = useState(false);
  const create = useApiMutation('createStockTake');
  const keyFor = useIntentKey();
  const failure = useStateLabels({
    loading: t('takes.creating'),
    emptyTitle: t('takes.notCreated'),
    errorTitle: t('takes.notCreated'),
    deniedTitle: t('takes.denied'),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('takes.newTitle')}
      description={t('takes.newBody')}
      closeLabel={t('common:actions.cancel')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (locationId === '') {
            setMissing(true);
            return;
          }
          const body = { locationId, scope: 'FULL' as const };
          create
            .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
            .then((take) => navigate(`/stock-takes/${take.id}`))
            .catch(() => undefined);
        }}
      >
        <MutationFailure error={create.error} labels={failure} />
        {locations.query.isError ? <p role="alert">{t('locations.error')}</p> : null}
        <Field
          label={t('takes.location')}
          required
          requiredLabel={t('common:field.required')}
          error={missing ? t('common:field.required') : undefined}
        >
          <Select
            value={locationId}
            onValueChange={(value) => {
              setLocationId(value);
              setMissing(false);
            }}
            placeholder={t('takes.chooseLocation')}
            options={locations.options}
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" loading={create.isPending} loadingLabel={t('takes.creating')}>
            {t('takes.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
