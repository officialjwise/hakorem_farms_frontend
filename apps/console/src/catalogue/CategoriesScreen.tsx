import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { components, OperationInput } from '@hakorem/api-client';
import {
  Button,
  Checkbox,
  Dialog,
  Form,
  FormField,
  FormSubmitButton,
  Input,
  NumberInput,
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
  Alert,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { uniqueById, useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { useStateLabels } from '../lib/states';
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
const COLUMNS = 6;

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

  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('categories.columns.name')}</TableHead>
        <TableHead>{t('categories.columns.line')}</TableHead>
        <TableHead>{t('categories.columns.tax')}</TableHead>
        <TableHead>{t('categories.columns.online')}</TableHead>
        <TableHead numeric>{t('categories.columns.products')}</TableHead>
        <TableHead>
          <span className="sr-only">{t('categories.columns.actions')}</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );

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
      <QueryBoundary
        query={categories}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('categories.table')}>
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
            <TableContainer aria-label={t('categories.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((category) => (
                    <TableRow key={category.id}>
                      <TableRowHeader>
                        {category.name}
                        <span className="block text-control-sm text-fg-muted">
                          <code>{category.code}</code>
                        </span>
                      </TableRowHeader>
                      <TableCell label={t('categories.columns.line')}>
                        {t(`line.${category.productLine}`)}
                      </TableCell>
                      <TableCell label={t('categories.columns.tax')}>
                        {category.taxCategory.name}
                      </TableCell>
                      <TableCell label={t('categories.columns.online')}>
                        {category.isOnlineVisible ? t('categories.shown') : t('categories.hidden')}
                      </TableCell>
                      <TableCell numeric label={t('categories.columns.products')}>
                        {category.productCount}
                      </TableCell>
                      <TableCell label={t('categories.columns.actions')}>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('categories.pages')}
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
    <FormField name={name} label={t(`categories.fields.${name}`)} required requiredLabel={required}>
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
          >
            {(field) => <Input {...field} autoComplete="off" autoCapitalize="characters" />}
          </FormField>
        ) : null}
        <FormField
          name="name"
          label={t('categories.fields.name')}
          required
          requiredLabel={required}
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
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <FormSubmitButton loadingLabel={t('categories.saving')}>
            {t('categories.save')}
          </FormSubmitButton>
        </div>
      </Form>
    </Dialog>
  );
}
