import { CircleCheck, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Dialog,
  DialogActions,
  Field,
  IconChip,
  MutationFailure,
  Select,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { BranchScopeNote } from '../branch/BranchScopeNote';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { useLocations } from './locations';
import { StockTakeStatusBadge } from './presentation';

type Take = components['schemas']['StockTake'];

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
  const columns: TableColumn<Take>[] = [
    {
      id: 'take',
      rowHeader: true,
      head: t('takes.columns.take'),
      sortValue: (take) => take.location.name,
      cell: (take) => (
        <span className="flex items-center gap-3">
          <IconChip icon={ClipboardCheck} tone="info" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/stock-takes/${take.id}`} className="text-accent-text underline">
              {take.location.name}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">
              {take.stockTakeNo ?? t('take.unnumbered')} · {t(`scope.${take.scope}`)}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('takes.columns.status'),
      sortValue: (take) => take.status,
      cell: (take) => <StockTakeStatusBadge status={take.status} />,
    },
    {
      id: 'progress',
      head: t('takes.columns.progress'),
      numeric: true,
      // The API's count of lines counted, compared as it is.
      sortValue: (take) => take.countedLineCount,
      cell: (take) => t('take.progress', { counted: take.countedLineCount, total: take.lineCount }),
    },
    {
      id: 'created',
      head: t('takes.columns.created'),
      // ISO instants sort as text.
      sortValue: (take) => take.createdAt,
      cell: (take) => (
        <>
          {take.createdBy.displayName} · <When instant={take.createdAt} />
        </>
      ),
    },
  ];
  const view = useTableView(columns);
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
      <TableCard
        view={view}
        query={takes}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(take) => take.id}
        tableLabel={t('takes.table')}
        exportName={t('takes.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('takes.pages') }}
      />
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
      icon={ClipboardCheck}
      requiredNote={t('common:field.requiredNote')}
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
          requiredMark="asterisk"
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
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit" loading={create.isPending} loadingLabel={t('takes.creating')}>
            <CircleCheck aria-hidden="true" />
            {t('takes.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
