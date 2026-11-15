import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import type { components } from '@hakorem/api-client';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DatePicker,
  EmptyState,
  Form,
  FormField,
  FormSubmitButton,
  Pagination,
  QueryBoundary,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
  Textarea,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';
import { AppliesTo } from './PriceListsScreen';
import { VersionStatusBadge } from './presentation';

type PriceList = components['schemas']['PriceList'];
const COLUMNS = 5;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar day picked on screen as the instant it starts in Accra. Africa/Accra is UTC+0 all year with no
 * daylight saving, so the day starts at 00:00Z (A-F4-03). No arithmetic: the string is the instant.
 */
export function startOfAccraDay(date: string): string {
  return `${date}T00:00:00Z`;
}

/** FR-MDM: one price list, its versions with their effective dates, and drafting the next one. */
export function PriceListScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  const { id = '' } = useParams();
  const list = useApiQuery('getPriceList', { path: { id } });
  const labels = useStateLabels({
    loading: t('priceList.loading'),
    emptyTitle: t('priceList.notFound'),
    errorTitle: t('priceList.error'),
    deniedTitle: t('priceList.denied'),
  });
  const back = (
    <Link to="/price-lists" className="text-accent-text underline">
      {t('priceLists.back')}
    </Link>
  );
  if (list.error?.status === 404) {
    return (
      <EmptyState
        title={t('priceList.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={list}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => (
        <article aria-labelledby="price-list-title" className="grid gap-4">
          <div className="grid gap-2">
            {back}
            <h1 id="price-list-title" className="text-2xl font-semibold">
              {current.name}
            </h1>
            <p className="text-fg-muted">
              <code>{current.code}</code> · {t(`kind.${current.kind}`)} ·{' '}
              <AppliesTo list={current} /> ·{' '}
              {current.taxInclusive ? t('priceList.taxInclusive') : t('priceList.taxExclusive')}
            </p>
          </div>
          <Versions list={current} />
          <NewVersion list={current} />
        </article>
      )}
    </QueryBoundary>
  );
}

function Versions({ list }: { list: PriceList }) {
  const { t } = useTranslation(['catalogue', 'common']);
  const pages = useCursorPages();
  const versions = useApiQuery('listPriceListVersions', {
    path: { id: list.id },
    query: pages.cursor === undefined ? {} : { cursor: pages.cursor },
  });
  const labels = useStateLabels({
    loading: t('priceList.loadingVersions'),
    emptyTitle: t('priceList.noVersions'),
    emptyDescription: t('priceList.noVersionsBody'),
    errorTitle: t('priceList.versionsError'),
    deniedTitle: t('priceList.denied'),
  });
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('priceList.columns.version')}</TableHead>
        <TableHead>{t('priceList.columns.status')}</TableHead>
        <TableHead>{t('priceList.columns.validFrom')}</TableHead>
        <TableHead>{t('priceList.columns.validTo')}</TableHead>
        <TableHead numeric>{t('priceList.columns.entries')}</TableHead>
      </TableRow>
    </TableHeader>
  );
  return (
    <section aria-labelledby="versions-title" className="grid gap-3">
      <h2 id="versions-title" className="text-xl font-semibold">
        {t('priceList.versions')}
      </h2>
      <p className="text-control-sm text-fg-muted">{t('common:time.zone')}</p>
      <QueryBoundary
        query={versions}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('priceList.versions')}>
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
            <TableContainer aria-label={t('priceList.versions')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((version) => (
                    <TableRow key={version.id}>
                      <TableRowHeader>
                        <Link
                          to={`/price-list-versions/${version.id}`}
                          className="text-accent-text underline"
                        >
                          {t('priceLists.versionNo', { number: version.versionNo })}
                        </Link>
                        {version.notes === null ? null : (
                          <span className="block text-control-sm text-fg-muted">
                            {version.notes}
                          </span>
                        )}
                      </TableRowHeader>
                      <TableCell label={t('priceList.columns.status')}>
                        <VersionStatusBadge status={version.status} />
                      </TableCell>
                      <TableCell label={t('priceList.columns.validFrom')}>
                        <When instant={version.validFrom} />
                      </TableCell>
                      <TableCell label={t('priceList.columns.validTo')}>
                        <When instant={version.validTo} empty={t('version.openEnded')} />
                      </TableCell>
                      <TableCell numeric label={t('priceList.columns.entries')}>
                        {version.entryCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('priceList.versionPages')}
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

/**
 * Drafting the next version, copied from the one in force so a person changes only what moves. One draft
 * at a time: when the list already has one, the link opens it instead.
 */
function NewVersion({ list }: { list: PriceList }) {
  const { t } = useTranslation(['catalogue', 'common']);
  const auth = useAuth();
  const navigate = useNavigate();
  const create = useApiMutation('createPriceListVersion', { invalidates: ['getPriceList'] });
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        validFrom: z.string().regex(DATE, t('common:field.required')),
        notes: z.string().trim().max(500),
      }),
    [t],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { validFrom: '', notes: '' },
  });
  const toFailure = useWriteFailure(form);
  const guard = useLeaveGuard(form.formState.isDirty);

  if (!auth.can('mdm.price_list.update')) return null;
  if (list.draftVersionId !== null) {
    return (
      <p>
        {t('priceList.hasDraft')}{' '}
        <Link
          to={`/price-list-versions/${list.draftVersionId}`}
          className="text-accent-text underline"
        >
          {t('priceLists.previewDraft')}
        </Link>
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('priceList.newVersion')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <Form
          form={form}
          className="grid gap-4"
          onSubmit={async (values) => {
            setFailure(null);
            const body = {
              validFrom: startOfAccraDay(values.validFrom),
              ...(values.notes === '' ? {} : { notes: values.notes }),
              ...(list.activeVersion === null ? {} : { copyFromVersionId: list.activeVersion.id }),
            };
            const created = await create.mutateAsync(
              { path: { id: list.id }, body },
              { idempotencyKey: keyFor(body) },
            );
            form.reset(values);
            await navigate(`/price-list-versions/${created.id}`);
          }}
          onSubmitError={(error) => setFailure(toFailure(error))}
        >
          <p className="text-control-sm text-fg-muted">
            {list.activeVersion === null
              ? t('priceList.newVersionEmpty')
              : t('priceList.newVersionCopies', { number: list.activeVersion.versionNo })}
          </p>
          <WriteFailureView failure={failure} title={t('priceList.newVersionFailed')} />
          <FormField
            name="validFrom"
            label={t('priceList.validFromDay')}
            hint={t('priceList.validFromHint')}
            required
            requiredLabel={t('common:field.required')}
          >
            {(field) => (
              <DatePicker
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          </FormField>
          <FormField name="notes" label={t('priceList.notes')}>
            {(field) => <Textarea {...field} rows={2} maxLength={500} />}
          </FormField>
          <div>
            <FormSubmitButton loadingLabel={t('priceList.creating')}>
              {t('priceList.createDraft')}
            </FormSubmitButton>
          </div>
        </Form>
        <LeaveGuardDialog guard={guard} />
      </CardBody>
    </Card>
  );
}
