import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import type { components, OperationInput } from '@hakorem/api-client';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Form,
  FormField,
  FormSubmitButton,
  Input,
  NOT_APPLICABLE,
  QueryBoundary,
  Select,
  Skeleton,
  Textarea,
  WeightDisplay,
  PageHeader,
  Alert,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { useStateLabels } from '../lib/states';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';
import { ProductStatusBadge } from './presentation';

type Product = components['schemas']['Product'];
type OnlineMode = components['schemas']['OnlineMode'];
const STATUSES = ['DRAFT', 'ACTIVE', 'DISCONTINUED'] as const;
export const ONLINE_MODES: readonly OnlineMode[] = ['HIDDEN', 'LISTED', 'REQUEST_TO_BUY'];

/** FR-MDM: one product, its stock-keeping facts, its editable details, and archiving it. */
export function ProductScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  const { id = '' } = useParams();
  const product = useApiQuery('getProduct', { path: { id } });
  const labels = useStateLabels({
    loading: t('product.loading'),
    emptyTitle: t('product.notFound'),
    errorTitle: t('product.error'),
    deniedTitle: t('product.denied'),
  });
  const back = (
    <Link to="/products" className="text-accent-text underline">
      {t('product.back')}
    </Link>
  );
  if (product.error?.status === 404) {
    return (
      <EmptyState
        title={t('product.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={product}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => (
        <ProductDetail product={current} back={back} onReload={() => void product.refetch()} />
      )}
    </QueryBoundary>
  );
}

function ProductDetail({
  product,
  back,
  onReload,
}: {
  product: Product;
  back: React.ReactNode;
  onReload: () => void;
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const auth = useAuth();
  const days = (value: number | null) =>
    value === null ? NOT_APPLICABLE : t('product.days', { count: value });
  const facts: [string, React.ReactNode][] = [
    [t('product.sku'), <code key="sku">{product.sku}</code>],
    [t('product.category'), product.category.name],
    [t('product.policy'), t(`policy.${product.stockPolicy}`)],
    [t('product.tracking'), t(`tracking.${product.tracking}`)],
    [t('product.species'), product.species?.name ?? NOT_APPLICABLE],
    [t('product.baseUom'), product.baseUom],
    [t('product.saleUom'), product.saleUom],
    [
      t('product.nominalPack'),
      <WeightDisplay
        key="pack"
        kilograms={product.nominalPackKg}
        notApplicableLabel={t('product.noPack')}
      />,
    ],
    [t('product.tolerance'), t('product.percent', { value: product.weightTolerancePercent })],
    [t('product.taxCategory'), product.taxCategory.name],
    [
      t('product.storage'),
      product.storageTempClass === null ? NOT_APPLICABLE : t(`storage.${product.storageTempClass}`),
    ],
    [t('product.shelfLife'), days(product.shelfLifeDays)],
    [t('product.withdrawal'), days(product.withdrawalDays)],
    [t('product.barcode'), product.barcode ?? NOT_APPLICABLE],
    [t('product.online'), t(`online.${product.onlineMode}`)],
    [
      t('product.trading'),
      [
        product.isSellable ? t('product.sellable') : t('product.notSellable'),
        product.isPurchasable ? t('product.purchasable') : t('product.notPurchasable'),
      ].join(' · '),
    ],
  ];

  return (
    <article aria-labelledby="product-title" className="grid gap-4">
      <div className="grid gap-2">
        {back}
        <div className="flex flex-wrap items-center gap-3">
          <PageHeader title={product.name} titleId="product-title" />
          <ProductStatusBadge status={product.status} />
        </div>
        {product.description === null ? null : <p>{product.description}</p>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('product.facts')}</h2>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
            {facts.map(([term, value]) => (
              <div key={term} className="contents">
                <dt className="text-fg-muted">{term}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-control-sm text-fg-muted">{t('product.policyFixed')}</p>
        </CardBody>
      </Card>
      {auth.can('mdm.product.update') ? (
        <ProductForm key={product.version} product={product} onReload={onReload} />
      ) : null}
      {auth.can('mdm.product.archive') ? <ArchiveProduct product={product} /> : null}
    </article>
  );
}

function ProductForm({ product, onReload }: { product: Product; onReload: () => void }) {
  const { t } = useTranslation(['catalogue', 'common']);
  const update = useApiMutation('updateProduct');
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t('common:field.required')),
        description: z.string().trim(),
        barcode: z.string().trim(),
        status: z.enum(STATUSES),
        onlineMode: z.enum(['HIDDEN', 'LISTED', 'REQUEST_TO_BUY']),
        isSellable: z.boolean(),
        isPurchasable: z.boolean(),
      }),
    [t],
  );
  const defaults = {
    name: product.name,
    description: product.description ?? '',
    barcode: product.barcode ?? '',
    status: product.status,
    onlineMode: product.onlineMode,
    isSellable: product.isSellable,
    isPurchasable: product.isPurchasable,
  };
  const form = useForm({ resolver: zodResolver(schema), defaultValues: defaults });
  const toFailure = useWriteFailure(form);
  const guard = useLeaveGuard(form.formState.isDirty);
  const flag = (name: 'isSellable' | 'isPurchasable') => (
    <FormField name={name} label={t(`product.fields.${name}`)}>
      {(field) => (
        <Checkbox
          ref={field.ref}
          name={field.name}
          checked={field.value === true}
          onCheckedChange={(checked) => field.onChange(checked === true)}
        />
      )}
    </FormField>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('product.edit')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <Form
          form={form}
          className="grid gap-4"
          onSubmit={async (values) => {
            setFailure(null);
            setSaved(false);
            // Only what changed, with the version it was read at (409 on a stale version).
            const body: OperationInput<'updateProduct'>['body'] = { version: product.version };
            if (values.name !== defaults.name) body.name = values.name;
            if (values.description !== defaults.description && values.description !== '')
              body.description = values.description;
            if (values.barcode !== defaults.barcode && values.barcode !== '')
              body.barcode = values.barcode;
            if (values.status !== defaults.status) body.status = values.status;
            if (values.onlineMode !== defaults.onlineMode) body.onlineMode = values.onlineMode;
            if (values.isSellable !== defaults.isSellable) body.isSellable = values.isSellable;
            if (values.isPurchasable !== defaults.isPurchasable)
              body.isPurchasable = values.isPurchasable;
            await update.mutateAsync(
              { path: { id: product.id }, body },
              { idempotencyKey: keyFor(body) },
            );
            setSaved(true);
          }}
          onSubmitError={(error) => setFailure(toFailure(error))}
        >
          <p className="text-control-sm text-fg-muted">{t('product.editHint')}</p>
          <WriteFailureView failure={failure} title={t('product.notSaved')} onReload={onReload} />
          {saved ? <Alert severity={'good'} title={t('product.saved')} /> : null}
          <FormField
            name="name"
            label={t('product.fields.name')}
            required
            requiredLabel={t('common:field.required')}
          >
            {(field) => <Input {...field} autoComplete="off" />}
          </FormField>
          <FormField name="description" label={t('product.fields.description')}>
            {(field) => <Textarea {...field} rows={3} />}
          </FormField>
          <FormField name="barcode" label={t('product.fields.barcode')}>
            {(field) => <Input {...field} autoComplete="off" inputMode="numeric" />}
          </FormField>
          <FormField name="status" label={t('product.fields.status')}>
            {(field) => (
              <Select
                ref={field.ref}
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                options={STATUSES.map((s) => ({ value: s, label: t(`productStatus.${s}`) }))}
              />
            )}
          </FormField>
          <FormField
            name="onlineMode"
            label={t('product.fields.onlineMode')}
            hint={t('product.onlineHint')}
          >
            {(field) => (
              <Select
                ref={field.ref}
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                options={ONLINE_MODES.map((m) => ({ value: m, label: t(`online.${m}`) }))}
              />
            )}
          </FormField>
          {flag('isSellable')}
          {flag('isPurchasable')}
          <div>
            <FormSubmitButton loadingLabel={t('product.saving')}>
              {t('product.save')}
            </FormSubmitButton>
          </div>
        </Form>
        <LeaveGuardDialog guard={guard} />
      </CardBody>
    </Card>
  );
}

function ArchiveProduct({ product }: { product: Product }) {
  const { t } = useTranslation(['catalogue', 'common']);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const archive = useApiMutation('archiveProduct');
  const keyFor = useIntentKey();
  const failureLabels = useStateLabels({
    loading: t('product.archiving'),
    emptyTitle: t('product.notArchived'),
    errorTitle: t('product.notArchived'),
    deniedTitle: t('product.denied'),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('product.archive')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-3">
        <p>{t('product.archiveHint')}</p>
        {done ? (
          <Alert severity={'good'} title={t('product.archived')} />
        ) : (
          <div>
            <Button
              variant="danger"
              onClick={() => {
                archive.reset();
                setOpen(true);
              }}
            >
              {t('product.archive')}
            </Button>
          </div>
        )}
        <ReasonDialog
          open={open}
          onOpenChange={setOpen}
          title={t('product.archiveTitle', { name: product.name })}
          body={t('product.archiveBody')}
          submitLabel={t('product.archiveConfirm')}
          destructive
          error={archive.error}
          failureLabels={failureLabels}
          onConfirm={async (reason) => {
            const body = { version: product.version, reason };
            await archive.mutateAsync(
              { path: { id: product.id }, body },
              { idempotencyKey: keyFor(body) },
            );
            setOpen(false);
            setDone(true);
          }}
        />
      </CardBody>
    </Card>
  );
}
