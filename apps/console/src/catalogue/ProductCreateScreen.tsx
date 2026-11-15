import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import type { components, OperationInput } from '@hakorem/api-client';
import {
  Card,
  CardBody,
  ErrorState,
  Form,
  FormField,
  FormSubmitButton,
  Input,
  QueryBoundary,
  Select,
  Skeleton,
  Textarea,
  WeightInput,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { PAGE_CAP_EXCEEDED, useApiAllPages, useApiMutation } from '../data/api';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { bothQueries, uniqueById, useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';
import { ONLINE_MODES } from './ProductScreen';

type StockPolicy = components['schemas']['StockPolicy'];
type Category = components['schemas']['Category'];
type Uom = components['schemas']['Uom'];
type Species = components['schemas']['Species'];
export const POLICIES: readonly StockPolicy[] = [
  'SERIALISED',
  'CATCH_WEIGHT',
  'COUNTABLE',
  'NON_STOCK',
];
const NO_SPECIES = 'NONE';

/** FR-MDM: a new product with its stock-keeping policy, which cannot change once it has stock history. */
export function ProductCreateScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  // Short reference lists the form must offer whole (ADR 0028): seeded and rarely changed.
  const categories = useApiAllPages(
    'listCategories',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const units = useApiAllPages(
    'listUnitsOfMeasure',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const species = useApiAllPages(
    'listSpeciesList',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const labels = useStateLabels({
    loading: t('create.loading'),
    emptyTitle: t('create.referenceMissing'),
    errorTitle: t('create.referenceError'),
    deniedTitle: t('create.referenceDenied'),
  });
  const capped = [categories, units, species].some((q) => q.error?.code === PAGE_CAP_EXCEEDED);

  return (
    <article aria-labelledby="product-new-title" className="grid gap-4">
      <div className="grid gap-2">
        <Link to="/products" className="text-accent-text underline">
          {t('product.back')}
        </Link>
        <PageHeader title={t('create.title')} titleId="product-new-title" />
      </div>
      {capped ? (
        <ErrorState title={t('create.tooMany')} description={t('create.tooManyBody')} />
      ) : (
        <QueryBoundary
          query={bothQueries(bothQueries(categories, units), species)}
          labels={labels}
          isEmpty={([[c, u]]) => c.items.length === 0 || u.items.length === 0}
          loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-96" />}
        >
          {([[c, u], s]) => (
            <CreateForm
              categories={uniqueById(c.items)}
              units={u.items}
              species={uniqueById(s.items)}
            />
          )}
        </QueryBoundary>
      )}
    </article>
  );
}

function CreateForm({
  categories,
  units,
  species,
}: {
  categories: Category[];
  units: Uom[];
  species: Species[];
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const navigate = useNavigate();
  const create = useApiMutation('createProduct');
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const required = t('common:field.required');
  const schema = useMemo(
    () =>
      z.object({
        sku: z.string().trim().min(1, required),
        name: z.string().trim().min(1, required),
        categoryId: z.string().min(1, required),
        stockPolicy: z.enum(['SERIALISED', 'CATCH_WEIGHT', 'COUNTABLE', 'NON_STOCK']),
        speciesId: z.string(),
        baseUom: z.string().min(1, required),
        saleUom: z.string().min(1, required),
        onlineMode: z.enum(['HIDDEN', 'LISTED', 'REQUEST_TO_BUY']),
        nominalPackKg: z.string().nullable(),
        barcode: z.string().trim(),
        description: z.string().trim(),
      }),
    [required],
  );
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: '',
      name: '',
      categoryId: '',
      stockPolicy: 'COUNTABLE',
      speciesId: NO_SPECIES,
      baseUom: '',
      saleUom: '',
      onlineMode: 'HIDDEN',
      nominalPackKg: null,
      barcode: '',
      description: '',
    },
  });
  const toFailure = useWriteFailure(form);
  const guard = useLeaveGuard(form.formState.isDirty && !form.formState.isSubmitSuccessful);
  const unitOptions = units.map((u) => ({
    value: u.code,
    label: t('create.unit', { name: u.name, code: u.code }),
  }));
  const pick = (
    name: 'categoryId' | 'stockPolicy' | 'speciesId' | 'baseUom' | 'saleUom' | 'onlineMode',
    options: { value: string; label: string }[],
    extra: { hint?: string; required?: boolean } = {},
  ) => {
    const control = (field: {
      ref: (el: HTMLButtonElement | null) => void;
      name: string;
      value: string;
      onChange: (value: string) => void;
    }) => (
      <Select
        ref={field.ref}
        name={field.name}
        value={field.value}
        onValueChange={field.onChange}
        placeholder={t('create.choose')}
        options={options}
      />
    );
    const hint = extra.hint === undefined ? {} : { hint: extra.hint };
    return extra.required === true ? (
      <FormField
        name={name}
        label={t(`create.fields.${name}`)}
        {...hint}
        required
        requiredLabel={required}
      >
        {control}
      </FormField>
    ) : (
      <FormField name={name} label={t(`create.fields.${name}`)} {...hint}>
        {control}
      </FormField>
    );
  };

  return (
    <Card>
      <CardBody>
        <Form
          form={form}
          className="grid gap-4"
          onSubmit={async (values) => {
            setFailure(null);
            const body: OperationInput<'createProduct'>['body'] = {
              sku: values.sku,
              name: values.name,
              categoryId: values.categoryId,
              stockPolicy: values.stockPolicy,
              baseUom: values.baseUom,
              saleUom: values.saleUom,
              onlineMode: values.onlineMode,
              ...(values.speciesId === NO_SPECIES ? {} : { speciesId: values.speciesId }),
              ...(values.nominalPackKg === null ? {} : { nominalPackKg: values.nominalPackKg }),
              ...(values.barcode === '' ? {} : { barcode: values.barcode }),
              ...(values.description === '' ? {} : { description: values.description }),
            };
            const created = await create.mutateAsync({ body }, { idempotencyKey: keyFor(body) });
            await navigate(`/products/${created.id}`);
          }}
          onSubmitError={(error) => setFailure(toFailure(error))}
        >
          <p className="text-control-sm text-fg-muted">{t('create.hint')}</p>
          <WriteFailureView failure={failure} title={t('create.failed')} />
          <FormField name="sku" label={t('create.fields.sku')} required requiredLabel={required}>
            {(field) => <Input {...field} autoComplete="off" autoCapitalize="characters" />}
          </FormField>
          <FormField name="name" label={t('create.fields.name')} required requiredLabel={required}>
            {(field) => <Input {...field} autoComplete="off" />}
          </FormField>
          {pick(
            'categoryId',
            categories.map((c) => ({ value: c.id, label: c.name })),
            { required: true },
          )}
          {pick(
            'stockPolicy',
            POLICIES.map((p) => ({ value: p, label: t(`policy.${p}`) })),
            { hint: t('create.policyHint'), required: true },
          )}
          {pick('speciesId', [
            { value: NO_SPECIES, label: t('create.noSpecies') },
            ...species.map((s) => ({ value: s.id, label: s.name })),
          ])}
          {pick('baseUom', unitOptions, { hint: t('create.baseUomHint'), required: true })}
          {pick('saleUom', unitOptions, { required: true })}
          <FormField
            name="nominalPackKg"
            label={t('create.fields.nominalPackKg')}
            hint={t('create.packHint')}
          >
            {(field) => (
              <WeightInput
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                value={field.value ?? null}
                onValueChange={field.onChange}
              />
            )}
          </FormField>
          {pick(
            'onlineMode',
            ONLINE_MODES.map((m) => ({ value: m, label: t(`online.${m}`) })),
            { hint: t('product.onlineHint') },
          )}
          <FormField name="barcode" label={t('product.fields.barcode')}>
            {(field) => <Input {...field} autoComplete="off" inputMode="numeric" />}
          </FormField>
          <FormField name="description" label={t('product.fields.description')}>
            {(field) => <Textarea {...field} rows={3} />}
          </FormField>
          <div>
            <FormSubmitButton loadingLabel={t('create.creating')}>
              {t('create.submit')}
            </FormSubmitButton>
          </div>
        </Form>
        <LeaveGuardDialog guard={guard} />
      </CardBody>
    </Card>
  );
}
