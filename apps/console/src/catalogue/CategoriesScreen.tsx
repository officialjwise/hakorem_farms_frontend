import { zodResolver } from '@hookform/resolvers/zod';
import {
  Beef,
  CircleCheck,
  Drumstick,
  Egg,
  FolderTree,
  Package,
  PawPrint,
  Tag,
  Wheat,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { components, OperationInput } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  Form,
  FormField,
  FormSubmitButton,
  IconChip,
  Input,
  NumberInput,
  Select,
  useTableView,
  type IconChipTone,
  type TableColumn,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { uniqueById, useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { useStateLabels } from '../lib/states';
import { lookup } from '../lib/lookup';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';

type Category = components['schemas']['Category'];
type ProductLine = components['schemas']['ProductLine'];
type GlGroup = components['schemas']['GlGroup'];
const LINES = [
  'LIVE',
  'MEAT',
  'PRODUCE',
  'BY_PRODUCT',
  'FEED',
  'SUPPLY',
  'SERVICE',
] as const satisfies readonly ProductLine[];
const GL_GROUPS = [
  'LIVE_ANIMALS',
  'MEAT',
  'OFFAL',
  'PRODUCE_EGGS',
  'FEED_MEDICATION',
  'SUPPLIES',
  'SERVICE',
] as const satisfies readonly GlGroup[];

/** Each product line's icon and tint, matching the products' accounting groups (ProductPicture). */
const LINE_LOOK = {
  LIVE: { icon: PawPrint, tone: 'accent' },
  MEAT: { icon: Beef, tone: 'clay' },
  PRODUCE: { icon: Egg, tone: 'sand' },
  BY_PRODUCT: { icon: Drumstick, tone: 'plum' },
  FEED: { icon: Wheat, tone: 'good' },
  SUPPLY: { icon: Package, tone: 'info' },
  SERVICE: { icon: Wrench, tone: 'violet' },
} as const satisfies Record<ProductLine, { icon: typeof Tag; tone: IconChipTone }>;
const OTHER_LINE = { icon: Tag, tone: 'slate' } as const;

/** FR-MDM: product categories, the product line and ledger group each carries, and its tax category. */
export function CategoriesScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [archiving, setArchiving] = useState<Category | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Seeded and rarely changed: `reference`.
  const categories = useApiQuery(
    'listCategories',
    { query: pages.cursor === undefined ? {} : { cursor: pages.cursor } },
    { staleClass: 'reference' },
  );
  const archive = useApiMutation('archiveCategory');
  const keyFor = useIntentKey();
  const labels = useStateLabels({
    loading: t('categories.loading'),
    emptyTitle: t('categories.empty'),
    emptyDescription: t('categories.emptyBody'),
    errorTitle: t('categories.error'),
    deniedTitle: t('categories.denied'),
  });
  const failureLabels = useStateLabels({
    loading: t('categories.saving'),
    emptyTitle: t('categories.notArchived'),
    errorTitle: t('categories.notArchived'),
    deniedTitle: t('categories.denied'),
  });
  const canUpdate = auth.can('mdm.category.update');
  const canArchive = auth.can('mdm.category.archive');

  const columns: TableColumn<Category>[] = [
    {
      id: 'name',
      rowHeader: true,
      head: t('categories.columns.name'),
      sortValue: (category) => category.name,
      cell: (category) => {
        const look = lookup(LINE_LOOK, category.productLine, OTHER_LINE);
        return (
          <span className="flex items-center gap-3">
            <IconChip icon={look.icon} tone={look.tone} size="sm" />
            <span className="grid min-w-0">
              <span>{category.name}</span>
              <code className="text-control-sm font-normal text-fg-muted">{category.code}</code>
            </span>
          </span>
        );
      },
    },
    {
      id: 'line',
      head: t('categories.columns.line'),
      sortValue: (category) => t(`line.${category.productLine}`),
      cell: (category) => t(`line.${category.productLine}`),
    },
    {
      id: 'tax',
      head: t('categories.columns.tax'),
      sortValue: (category) => category.taxCategory.name,
      cell: (category) => category.taxCategory.name,
    },
    {
      id: 'online',
      head: t('categories.columns.online'),
      sortValue: (category) => (category.isOnlineVisible ? 0 : 1),
      cell: (category) =>
        category.isOnlineVisible ? t('categories.shown') : t('categories.hidden'),
    },
    {
      id: 'products',
      head: t('categories.columns.products'),
      numeric: true,
      sortValue: (category) => category.productCount,
      cell: (category) => category.productCount,
    },
    {
      id: 'actions',
      head: t('categories.columns.actions'),
      cell: (category) => (
        <span className="flex flex-wrap gap-2">
          {canUpdate ? (
            <Button
              size="sm"
              variant="secondary"
              aria-label={t('categories.editFor', { name: category.name })}
              onClick={() => {
                setNotice(null);
                setEditing(category);
              }}
            >
              {t('categories.edit')}
            </Button>
          ) : null}
          {canArchive ? (
            <Button
              size="sm"
              variant="secondary"
              aria-label={t('categories.archiveFor', { name: category.name })}
              onClick={() => {
                archive.reset();
                setNotice(null);
                setArchiving(category);
              }}
            >
              {t('categories.archive')}
            </Button>
          ) : null}
        </span>
      ),
    },
  ];
  const view = useTableView(columns);

  return (
    <section aria-labelledby="categories-title" className="grid gap-4">
      <PageHeader
        title={t('categories.title')}
        titleId="categories-title"
        actions={
          <>
            {auth.can('mdm.category.create') ? (
              <Button
                onClick={() => {
                  setNotice(null);
                  setEditing('new');
                }}
              >
                {t('categories.new')}
              </Button>
            ) : null}
          </>
        }
      />
      {notice !== null ? <Alert severity={'good'} title={notice} /> : null}
      <TableCard
        view={view}
        query={categories}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(category) => category.id}
        tableLabel={t('categories.table')}
        exportName={t('categories.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('categories.pages') }}
      />
      {editing !== null ? (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(name) => {
            setEditing(null);
            setNotice(t('categories.saved', { name }));
          }}
        />
      ) : null}
      <ReasonDialog
        open={archiving !== null}
        onOpenChange={(open) => (open ? undefined : setArchiving(null))}
        title={t('categories.archiveTitle', { name: archiving?.name ?? '' })}
        body={t('categories.archiveBody')}
        submitLabel={t('categories.archiveConfirm')}
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
          setNotice(t('categories.archived', { name: archiving.name }));
          setArchiving(null);
        }}
      />
    </section>
  );
}

/** Create, or change what may change after creation: name, order, tax category and online visibility. */
function CategoryDialog({
  category,
  onClose,
  onDone,
}: {
  category: Category | null;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const { t } = useTranslation(['catalogue', 'common']);
  const required = t('common:field.required');
  const taxes = useApiAllPages(
    'listTaxCategories',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const create = useApiMutation('createCategory');
  const update = useApiMutation('updateCategory');
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        code: z.string().trim(),
        name: z.string().trim().min(1, required),
        productLine: z.enum(LINES),
        glGroup: z.enum(GL_GROUPS),
        taxCategoryId: z.string().min(1, required),
        sortOrder: z.string().regex(/^\d*$/),
        isOnlineVisible: z.boolean(),
      }),
    [required],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: category?.code ?? '',
      name: category?.name ?? '',
      productLine: category?.productLine ?? 'LIVE',
      glGroup: category?.glGroup ?? 'LIVE_ANIMALS',
      taxCategoryId: category?.taxCategory.id ?? '',
      sortOrder: category === null ? '' : String(category.sortOrder),
      isOnlineVisible: category?.isOnlineVisible ?? true,
    },
  });
  const toFailure = useWriteFailure(form);
  const taxOptions = uniqueById(taxes.data?.items ?? []).map((tax) => ({
    value: tax.id,
    label: tax.name,
  }));
  const select = (
    name: 'productLine' | 'glGroup' | 'taxCategoryId',
    options: { value: string; label: string }[],
  ) => (
    <FormField
      name={name}
      label={t(`categories.fields.${name}`)}
      required
      requiredLabel={required}
      requiredMark="asterisk"
    >
      {(field) => (
        <Select
          ref={field.ref}
          name={field.name}
          value={field.value}
          onValueChange={field.onChange}
          placeholder={t('create.choose')}
          options={options}
        />
      )}
    </FormField>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={
        category === null
          ? t('categories.newTitle')
          : t('categories.editTitle', { name: category.name })
      }
      description={category === null ? t('categories.newBody') : t('categories.editBody')}
      closeLabel={t('common:actions.cancel')}
      icon={FolderTree}
      requiredNote={t('common:field.requiredNote')}
    >
      <Form
        form={form}
        className="grid gap-3 pb-2"
        onSubmit={async (values) => {
          setFailure(null);
          const sortOrder = values.sortOrder === '' ? {} : { sortOrder: Number(values.sortOrder) };
          if (category === null) {
            const body: OperationInput<'createCategory'>['body'] = {
              code: values.code,
              name: values.name,
              productLine: values.productLine,
              glGroup: values.glGroup,
              taxCategoryId: values.taxCategoryId,
              isOnlineVisible: values.isOnlineVisible,
              ...sortOrder,
            };
            await create.mutateAsync({ body }, { idempotencyKey: keyFor(body) });
          } else {
            const body: OperationInput<'updateCategory'>['body'] = {
              version: category.version,
              name: values.name,
              taxCategoryId: values.taxCategoryId,
              isOnlineVisible: values.isOnlineVisible,
              ...sortOrder,
            };
            await update.mutateAsync(
              { path: { id: category.id }, body },
              { idempotencyKey: keyFor(body) },
            );
          }
          onDone(values.name);
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <WriteFailureView failure={failure} title={t('categories.notSaved')} />
        {taxes.isError ? <p role="alert">{t('categories.taxError')}</p> : null}
        {category === null ? (
          <FormField
            name="code"
            label={t('categories.fields.code')}
            required
            requiredLabel={required}
            requiredMark="asterisk"
          >
            {(field) => <Input {...field} autoComplete="off" autoCapitalize="characters" />}
          </FormField>
        ) : null}
        <FormField
          name="name"
          label={t('categories.fields.name')}
          required
          requiredLabel={required}
          requiredMark="asterisk"
        >
          {(field) => <Input {...field} autoComplete="off" />}
        </FormField>
        {category === null
          ? select(
              'productLine',
              LINES.map((line) => ({ value: line, label: t(`line.${line}`) })),
            )
          : null}
        {category === null
          ? select(
              'glGroup',
              GL_GROUPS.map((group) => ({ value: group, label: t(`gl.${group}`) })),
            )
          : null}
        {select('taxCategoryId', taxOptions)}
        <FormField name="sortOrder" label={t('categories.fields.sortOrder')}>
          {(field) => (
            <NumberInput
              ref={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        </FormField>
        <FormField name="isOnlineVisible" label={t('categories.fields.isOnlineVisible')}>
          {(field) => (
            <Checkbox
              ref={field.ref}
              name={field.name}
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        </FormField>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <FormSubmitButton loadingLabel={t('categories.saving')}>
            <CircleCheck aria-hidden="true" />
            {t('categories.save')}
          </FormSubmitButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
