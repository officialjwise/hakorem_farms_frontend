import { CircleCheck, Scale } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Dialog,
  DialogActions,
  Field,
  Input,
  MutationFailure,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ProductPicker, type ProductChoice } from './pickers';
import { PERCENT, PercentText } from './presentation';

type Standard = components['schemas']['YieldStandard'];

/**
 * FR-PRC yield standards: the expected weight of an output product as a percentage of an input product's
 * live weight, and the tolerance outside which a completed order is flagged. Percentages are shown exactly
 * as the API sends them, in their shortest form ("48", not "48.00"). Creating and changing one needs
 * `prc.yield_standard.manage`; a change does not reach orders already completed.
 */
export function YieldStandardsScreen() {
  const { t } = useTranslation(['processing', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Standard | null>(null);
  const canManage = auth.can('prc.yield_standard.manage');
  // Standards change rarely and are read beside the orders they judge: `working`.
  const standards = useApiQuery(
    'listYieldStandards',
    { query: pages.cursor === undefined ? {} : { cursor: pages.cursor } },
    { staleClass: 'working' },
  );
  const labels = useStateLabels({
    loading: t('standards.loading'),
    emptyTitle: t('standards.empty'),
    emptyDescription: t('standards.emptyBody'),
    errorTitle: t('standards.error'),
    deniedTitle: t('standards.denied'),
  });
  const columns: TableColumn<Standard>[] = [
    {
      id: 'input',
      rowHeader: true,
      head: t('standards.columns.input'),
      sortValue: (standard) => standard.inputProduct.name,
      cell: (standard) => standard.inputProduct.name,
    },
    {
      id: 'output',
      head: t('standards.columns.output'),
      sortValue: (standard) => standard.outputProduct.name,
      cell: (standard) => standard.outputProduct.name,
    },
    {
      id: 'expected',
      head: t('standards.columns.expected'),
      numeric: true,
      cell: (standard) => <PercentText value={standard.expectedPercent} />,
    },
    {
      id: 'tolerance',
      head: t('standards.columns.tolerance'),
      numeric: true,
      cell: (standard) => t('standards.plusMinus', { value: standard.tolerancePercent }),
    },
    ...(canManage
      ? [
          {
            id: 'change',
            head: t('standards.columns.change'),
            cell: (standard: Standard) => (
              <Button size="sm" variant="secondary" onClick={() => setEditing(standard)}>
                {t('standards.edit', {
                  input: standard.inputProduct.name,
                  output: standard.outputProduct.name,
                })}
              </Button>
            ),
          },
        ]
      : []),
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="standards-title" className="grid gap-4">
      <PageHeader
        title={t('standards.title')}
        titleId="standards-title"
        description={t('standards.description')}
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>{t('standards.new')}</Button>
          ) : undefined
        }
      />
      <TableCard
        view={view}
        query={standards}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(standard) => standard.id}
        tableLabel={t('standards.table')}
        exportName={t('standards.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('standards.pages') }}
      />
      {creating ? <NewStandard onClose={() => setCreating(false)} /> : null}
      {editing === null ? null : (
        <EditStandard standard={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

function PercentField({
  label,
  hint,
  value,
  onChange,
  required,
  invalid,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  required: boolean;
  invalid: boolean;
}) {
  const { t } = useTranslation(['processing', 'common']);
  return (
    <Field
      label={label}
      hint={hint}
      {...(required
        ? {
            required: true as const,
            requiredLabel: t('common:field.required'),
            requiredMark: 'asterisk' as const,
          }
        : { required: false as const })}
      error={invalid ? t('standards.percentInvalid') : undefined}
    >
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
        inputMode="decimal"
        autoComplete="off"
      />
    </Field>
  );
}

function NewStandard({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['processing', 'common']);
  const [input, setInput] = useState<ProductChoice | null>(null);
  const [output, setOutput] = useState<ProductChoice | null>(null);
  const [expected, setExpected] = useState('');
  const [tolerance, setTolerance] = useState('');
  const [checked, setChecked] = useState(false);
  const create = useApiMutation('createYieldStandard');
  const keyFor = useIntentKey();
  const failure = useStateLabels({
    loading: t('standards.saving'),
    emptyTitle: t('standards.notCreated'),
    errorTitle: t('standards.notCreated'),
    deniedTitle: t('standards.denied'),
  });
  const required = t('common:field.required');
  const expectedBad = !PERCENT.test(expected);
  const toleranceBad = tolerance !== '' && !PERCENT.test(tolerance);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (input === null || output === null || expectedBad || toleranceBad) return;
    const body = {
      inputProductId: input.id,
      outputProductId: output.id,
      expectedPercent: expected,
      ...(tolerance === '' ? {} : { tolerancePercent: tolerance }),
    };
    create
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then(onClose)
      .catch(() => undefined);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('standards.newTitle')}
      description={t('standards.newBody')}
      closeLabel={t('common:actions.cancel')}
      icon={Scale}
      requiredNote={t('common:field.requiredNote')}
    >
      <form className="grid gap-3 pb-2" onSubmit={submit} noValidate>
        <MutationFailure error={create.error} labels={failure} />
        <ProductPicker
          label={t('standards.inputProduct')}
          hint={t('standards.inputProductHint')}
          value={input}
          onChange={setInput}
          {...(checked && input === null ? { error: required } : {})}
        />
        <ProductPicker
          label={t('standards.outputProduct')}
          value={output}
          onChange={setOutput}
          {...(checked && output === null ? { error: required } : {})}
        />
        <PercentField
          label={t('standards.expected')}
          hint={t('standards.expectedHint')}
          value={expected}
          onChange={setExpected}
          required
          invalid={checked && expectedBad}
        />
        <PercentField
          label={t('standards.tolerance')}
          hint={t('standards.toleranceDefault')}
          value={tolerance}
          onChange={setTolerance}
          required={false}
          invalid={checked && toleranceBad}
        />
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit" loading={create.isPending} loadingLabel={t('standards.saving')}>
            <CircleCheck aria-hidden="true" />
            {t('standards.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function EditStandard({ standard, onClose }: { standard: Standard; onClose: () => void }) {
  const { t } = useTranslation(['processing', 'common']);
  const [expected, setExpected] = useState(standard.expectedPercent);
  const [tolerance, setTolerance] = useState(standard.tolerancePercent);
  const [checked, setChecked] = useState(false);
  const update = useApiMutation('updateYieldStandard');
  const keyFor = useIntentKey();
  const failure = useStateLabels({
    loading: t('standards.saving'),
    emptyTitle: t('standards.notSaved'),
    errorTitle: t('standards.notSaved'),
    deniedTitle: t('standards.denied'),
  });
  const expectedBad = !PERCENT.test(expected);
  const toleranceBad = !PERCENT.test(tolerance);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (expectedBad || toleranceBad) return;
    // Only what changed is sent, with the version read (a stale one is the API's 409).
    const body = {
      version: standard.version,
      ...(expected === standard.expectedPercent ? {} : { expectedPercent: expected }),
      ...(tolerance === standard.tolerancePercent ? {} : { tolerancePercent: tolerance }),
    };
    update
      .mutateAsync({ path: { id: standard.id }, body }, { idempotencyKey: keyFor(body) })
      .then(onClose)
      .catch(() => undefined);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('standards.editTitle', {
        input: standard.inputProduct.name,
        output: standard.outputProduct.name,
      })}
      description={t('standards.editBody')}
      closeLabel={t('common:actions.cancel')}
      icon={Scale}
      requiredNote={t('common:field.requiredNote')}
    >
      <form className="grid gap-3 pb-2" onSubmit={submit} noValidate>
        <MutationFailure error={update.error} labels={failure} />
        <PercentField
          label={t('standards.expected')}
          hint={t('standards.expectedHint')}
          value={expected}
          onChange={setExpected}
          required
          invalid={checked && expectedBad}
        />
        <PercentField
          label={t('standards.tolerance')}
          hint={t('standards.toleranceHint')}
          value={tolerance}
          onChange={setTolerance}
          required
          invalid={checked && toleranceBad}
        />
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit" loading={update.isPending} loadingLabel={t('standards.saving')}>
            <CircleCheck aria-hidden="true" />
            {t('standards.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
