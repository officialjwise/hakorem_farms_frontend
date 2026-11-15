import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import type { components, OperationInput } from '@hakorem/api-client';
import {
  Button,
  Dialog,
  EmptyState,
  Form,
  FormField,
  FormSubmitButton,
  Input,
  NOT_APPLICABLE,
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
  WeightDisplay,
  WeightInput,
  Alert,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';

type Species = components['schemas']['Species'];
type Grade = components['schemas']['Grade'];
type WeightBand = components['schemas']['WeightBand'];
/** `Kilograms` in the contract: exactly three places. */
const KILOGRAMS = /^(0|[1-9][0-9]{0,6})\.[0-9]{3}$/;
const PAGE = 100;

/** FR-MDM: one species with its grades and weight bands, the steps price bands are set against. */
export function SpeciesDetailScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  const { id = '' } = useParams();
  const species = useApiQuery('getSpecies', { path: { id } }, { staleClass: 'reference' });
  const labels = useStateLabels({
    loading: t('speciesDetail.loading'),
    emptyTitle: t('speciesDetail.notFound'),
    errorTitle: t('speciesDetail.error'),
    deniedTitle: t('speciesDetail.denied'),
  });
  const back = (
    <Link to="/species" className="text-accent-text underline">
      {t('speciesDetail.back')}
    </Link>
  );
  if (species.error?.status === 404) {
    return (
      <EmptyState
        title={t('speciesDetail.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={species}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => (
        <article aria-labelledby="species-detail-title" className="grid gap-6">
          <div className="grid gap-2">
            {back}
            <PageHeader title={current.name} titleId="species-detail-title" />
            <p className="text-fg-muted">
              <code>{current.code}</code> · {t(`tracking.${current.trackingDefault}`)}
            </p>
          </div>
          <Grades species={current} />
          <Bands species={current} />
        </article>
      )}
    </QueryBoundary>
  );
}

function Grades({ species }: { species: Species }) {
  const { t } = useTranslation(['catalogue', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [editing, setEditing] = useState<Grade | 'new' | null>(null);
  const [archiving, setArchiving] = useState<Grade | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const grades = useApiQuery(
    'listGrades',
    {
      query: {
        speciesId: species.id,
        limit: PAGE,
        ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
      },
    },
    { staleClass: 'reference' },
  );
  const archive = useApiMutation('archiveGrade');
  const keyFor = useIntentKey();
  const labels = useStateLabels({
    loading: t('grades.loading'),
    emptyTitle: t('grades.empty'),
    emptyDescription: t('grades.emptyBody'),
    errorTitle: t('grades.error'),
    deniedTitle: t('grades.denied'),
  });
  const failureLabels = useStateLabels({
    loading: t('grades.saving'),
    emptyTitle: t('grades.notArchived'),
    errorTitle: t('grades.notArchived'),
    deniedTitle: t('grades.denied'),
  });
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('grades.columns.name')}</TableHead>
        <TableHead>{t('grades.columns.description')}</TableHead>
        <TableHead numeric>{t('grades.columns.order')}</TableHead>
        <TableHead>
          <span className="sr-only">{t('grades.columns.actions')}</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
  return (
    <section aria-labelledby="grades-title" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="grades-title" className="text-xl font-semibold">
          {t('grades.title')}
        </h2>
        {auth.can('mdm.grade.create') ? (
          <Button
            variant="secondary"
            onClick={() => {
              setNotice(null);
              setEditing('new');
            }}
          >
            {t('grades.new')}
          </Button>
        ) : null}
      </div>
      {notice !== null ? <Alert severity={'good'} title={notice} /> : null}
      <QueryBoundary
        query={grades}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('grades.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={4} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <div className="grid gap-3">
            <TableContainer aria-label={t('grades.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableRowHeader>
                        {grade.name}
                        <span className="block text-control-sm text-fg-muted">
                          <code>{grade.code}</code>
                        </span>
                      </TableRowHeader>
                      <TableCell label={t('grades.columns.description')}>
                        {grade.description ?? NOT_APPLICABLE}
                      </TableCell>
                      <TableCell numeric label={t('grades.columns.order')}>
                        {grade.sortOrder}
                      </TableCell>
                      <TableCell label={t('grades.columns.actions')}>
                        <span className="flex flex-wrap gap-2">
                          {auth.can('mdm.grade.update') ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label={t('grades.editFor', { name: grade.name })}
                              onClick={() => {
                                setNotice(null);
                                setEditing(grade);
                              }}
                            >
                              {t('grades.edit')}
                            </Button>
                          ) : null}
                          {auth.can('mdm.grade.archive') ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label={t('grades.archiveFor', { name: grade.name })}
                              onClick={() => {
                                archive.reset();
                                setNotice(null);
                                setArchiving(grade);
                              }}
                            >
                              {t('grades.archive')}
                            </Button>
                          ) : null}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <MorePages pages={pages} page={page.page} label={t('grades.pages')} />
          </div>
        )}
      </QueryBoundary>
      {editing !== null ? (
        <GradeDialog
          species={species}
          grade={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(name) => {
            setEditing(null);
            setNotice(t('grades.saved', { name }));
          }}
        />
      ) : null}
      <ReasonDialog
        open={archiving !== null}
        onOpenChange={(open) => (open ? undefined : setArchiving(null))}
        title={t('grades.archiveTitle', { name: archiving?.name ?? '' })}
        body={t('grades.archiveBody')}
        submitLabel={t('grades.archiveConfirm')}
        destructive
        error={archive.error}
        failureLabels={failureLabels}
        onConfirm={async (reason) => {
          if (archiving === null) return;
          const body = { version: archiving.version, reason };
          await archive.mutateAsync(
            { path: { id: archiving.id }, body },
            { idempotencyKey: keyFor({ id: archiving.id, ...body }) },
          );
          setNotice(t('grades.archived', { name: archiving.name }));
          setArchiving(null);
        }}
      />
    </section>
  );
}

function GradeDialog({
  species,
  grade,
  onClose,
  onDone,
}: {
  species: Species;
  grade: Grade | null;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const required = t('common:field.required');
  const create = useApiMutation('createGrade');
  const update = useApiMutation('updateGrade');
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        code: z.string().trim(),
        name: z.string().trim().min(1, required),
        description: z.string().trim(),
      }),
    [required],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: grade?.code ?? '',
      name: grade?.name ?? '',
      description: grade?.description ?? '',
    },
  });
  const toFailure = useWriteFailure(form);
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={
        grade === null
          ? t('grades.newTitle', { species: species.name })
          : t('grades.editTitle', { name: grade.name })
      }
      description={t('grades.dialogBody')}
      closeLabel={t('common:actions.cancel')}
    >
      <Form
        form={form}
        className="grid gap-3 pb-2"
        onSubmit={async (values) => {
          setFailure(null);
          const description = values.description === '' ? {} : { description: values.description };
          if (grade === null) {
            const body: OperationInput<'createGrade'>['body'] = {
              speciesId: species.id,
              code: values.code,
              name: values.name,
              ...description,
            };
            await create.mutateAsync({ body }, { idempotencyKey: keyFor(body) });
          } else {
            const body: OperationInput<'updateGrade'>['body'] = {
              version: grade.version,
              name: values.name,
              ...description,
            };
            await update.mutateAsync(
              { path: { id: grade.id }, body },
              { idempotencyKey: keyFor(body) },
            );
          }
          onDone(values.name);
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <WriteFailureView failure={failure} title={t('grades.notSaved')} />
        {grade === null ? (
          <FormField name="code" label={t('grades.fields.code')} required requiredLabel={required}>
            {(field) => <Input {...field} autoComplete="off" autoCapitalize="characters" />}
          </FormField>
        ) : null}
        <FormField name="name" label={t('grades.fields.name')} required requiredLabel={required}>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormField>
        <FormField name="description" label={t('grades.fields.description')}>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormField>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <FormSubmitButton loadingLabel={t('grades.saving')}>{t('grades.save')}</FormSubmitButton>
        </div>
      </Form>
    </Dialog>
  );
}

function Bands({ species }: { species: Species }) {
  const { t } = useTranslation(['catalogue', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [editing, setEditing] = useState<WeightBand | 'new' | null>(null);
  const [archiving, setArchiving] = useState<WeightBand | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bands = useApiQuery(
    'listWeightBands',
    {
      query: {
        speciesId: species.id,
        limit: PAGE,
        ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
      },
    },
    { staleClass: 'reference' },
  );
  const archive = useApiMutation('archiveWeightBand');
  const keyFor = useIntentKey();
  const labels = useStateLabels({
    loading: t('bands.loading'),
    emptyTitle: t('bands.empty'),
    emptyDescription: t('bands.emptyBody'),
    errorTitle: t('bands.error'),
    deniedTitle: t('bands.denied'),
  });
  const failureLabels = useStateLabels({
    loading: t('bands.saving'),
    emptyTitle: t('bands.notArchived'),
    errorTitle: t('bands.notArchived'),
    deniedTitle: t('bands.denied'),
  });
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('bands.columns.code')}</TableHead>
        <TableHead numeric>{t('bands.columns.from')}</TableHead>
        <TableHead numeric>{t('bands.columns.to')}</TableHead>
        <TableHead>
          <span className="sr-only">{t('bands.columns.actions')}</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
  return (
    <section aria-labelledby="bands-title" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="bands-title" className="text-xl font-semibold">
          {t('bands.title')}
        </h2>
        {auth.can('mdm.weight_band.create') ? (
          <Button
            variant="secondary"
            onClick={() => {
              setNotice(null);
              setEditing('new');
            }}
          >
            {t('bands.new')}
          </Button>
        ) : null}
      </div>
      <p className="text-control-sm text-fg-muted">{t('bands.rule')}</p>
      {notice !== null ? <Alert severity={'good'} title={notice} /> : null}
      <QueryBoundary
        query={bands}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('bands.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={4} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <div className="grid gap-3">
            <TableContainer aria-label={t('bands.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((band) => (
                    <TableRow key={band.id}>
                      <TableRowHeader>
                        <code>{band.code}</code>
                      </TableRowHeader>
                      <TableCell numeric label={t('bands.columns.from')}>
                        <WeightDisplay kilograms={band.minKg} />
                      </TableCell>
                      <TableCell numeric label={t('bands.columns.to')}>
                        <WeightDisplay kilograms={band.maxKg} />
                      </TableCell>
                      <TableCell label={t('bands.columns.actions')}>
                        <span className="flex flex-wrap gap-2">
                          {auth.can('mdm.weight_band.update') ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label={t('bands.editFor', { code: band.code })}
                              onClick={() => {
                                setNotice(null);
                                setEditing(band);
                              }}
                            >
                              {t('bands.edit')}
                            </Button>
                          ) : null}
                          {auth.can('mdm.weight_band.archive') ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label={t('bands.archiveFor', { code: band.code })}
                              onClick={() => {
                                archive.reset();
                                setNotice(null);
                                setArchiving(band);
                              }}
                            >
                              {t('bands.archive')}
                            </Button>
                          ) : null}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <MorePages pages={pages} page={page.page} label={t('bands.pages')} />
          </div>
        )}
      </QueryBoundary>
      {editing !== null ? (
        <BandDialog
          species={species}
          band={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(code) => {
            setEditing(null);
            setNotice(t('bands.saved', { code }));
          }}
        />
      ) : null}
      <ReasonDialog
        open={archiving !== null}
        onOpenChange={(open) => (open ? undefined : setArchiving(null))}
        title={t('bands.archiveTitle', { code: archiving?.code ?? '' })}
        body={t('bands.archiveBody')}
        submitLabel={t('bands.archiveConfirm')}
        destructive
        error={archive.error}
        failureLabels={failureLabels}
        onConfirm={async (reason) => {
          if (archiving === null) return;
          const body = { version: archiving.version, reason };
          await archive.mutateAsync(
            { path: { id: archiving.id }, body },
            { idempotencyKey: keyFor({ id: archiving.id, ...body }) },
          );
          setNotice(t('bands.archived', { code: archiving.code }));
          setArchiving(null);
        }}
      />
    </section>
  );
}

/**
 * A band is `minKg` inclusive to `maxKg` exclusive. Whether bands overlap or leave a gap is the server's rule
 * (a 422 names the field); the form only checks each weight is a three-place kilogram string.
 */
function BandDialog({
  species,
  band,
  onClose,
  onDone,
}: {
  species: Species;
  band: WeightBand | null;
  onClose: () => void;
  onDone: (code: string) => void;
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const required = t('common:field.required');
  const create = useApiMutation('createWeightBand');
  const update = useApiMutation('updateWeightBand');
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const schema = useMemo(() => {
    const kg = z.string({ error: required }).regex(KILOGRAMS, t('bands.kgFormat'));
    return z.object({ code: z.string().trim(), minKg: kg, maxKg: kg });
  }, [required, t]);
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: band?.code ?? '', minKg: band?.minKg ?? '', maxKg: band?.maxKg ?? '' },
  });
  const toFailure = useWriteFailure(form);
  const weight = (name: 'minKg' | 'maxKg') => (
    <FormField name={name} label={t(`bands.fields.${name}`)} required requiredLabel={required}>
      {(field) => (
        <WeightInput
          ref={field.ref}
          name={field.name}
          onBlur={field.onBlur}
          value={field.value === '' ? null : field.value}
          onValueChange={(value) => field.onChange(value ?? '')}
        />
      )}
    </FormField>
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={
        band === null
          ? t('bands.newTitle', { species: species.name })
          : t('bands.editTitle', { code: band.code })
      }
      description={t('bands.rule')}
      closeLabel={t('common:actions.cancel')}
    >
      <Form
        form={form}
        className="grid gap-3 pb-2"
        onSubmit={async (values) => {
          setFailure(null);
          if (band === null) {
            const body: OperationInput<'createWeightBand'>['body'] = {
              speciesId: species.id,
              code: values.code,
              minKg: values.minKg,
              maxKg: values.maxKg,
            };
            await create.mutateAsync({ body }, { idempotencyKey: keyFor(body) });
            onDone(values.code);
          } else {
            const body: OperationInput<'updateWeightBand'>['body'] = {
              version: band.version,
              minKg: values.minKg,
              maxKg: values.maxKg,
            };
            await update.mutateAsync(
              { path: { id: band.id }, body },
              { idempotencyKey: keyFor(body) },
            );
            onDone(band.code);
          }
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <WriteFailureView failure={failure} title={t('bands.notSaved')} />
        {band === null ? (
          <FormField name="code" label={t('bands.fields.code')} required requiredLabel={required}>
            {(field) => <Input {...field} autoComplete="off" autoCapitalize="characters" />}
          </FormField>
        ) : null}
        {weight('minKg')}
        {weight('maxKg')}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <FormSubmitButton loadingLabel={t('bands.saving')}>{t('bands.save')}</FormSubmitButton>
        </div>
      </Form>
    </Dialog>
  );
}

function MorePages({
  pages,
  page,
  label,
}: {
  pages: ReturnType<typeof useCursorPages>;
  page: { hasMore: boolean; nextCursor: string | null };
  label: string;
}) {
  const { t } = useTranslation('common');
  if (!pages.hasPrevious && !page.hasMore) return null;
  return (
    <Pagination
      label={label}
      hasPrevious={pages.hasPrevious}
      hasNext={page.hasMore && page.nextCursor !== null}
      onPrevious={pages.previous}
      onNext={() => {
        if (page.nextCursor !== null) pages.next(page.nextCursor);
      }}
      previousLabel={t('pagination.previous')}
      nextLabel={t('pagination.next')}
      summary={t('pagination.page', { page: pages.page })}
    />
  );
}
