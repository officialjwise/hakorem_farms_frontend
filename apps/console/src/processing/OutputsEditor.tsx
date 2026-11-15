import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DatePicker,
  Field,
  MutationFailure,
  NumberInput,
  Select,
  WeightInput,
} from '@hakorem/ui';
import { useApiMutation } from '../data/api';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { ProductPicker, type ProductChoice } from './pickers';
import {
  OUTPUT_KINDS,
  WEIGHT_SOURCES,
  type Order,
  type OutputKind,
  type WeightSource,
} from './presentation';

const KILOGRAMS = /^(0|[1-9][0-9]{0,6})\.[0-9]{3}$/;
const WHOLE = /^[1-9][0-9]{0,5}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface DraftOutput {
  key: string;
  product: ProductChoice | null;
  outputKind: OutputKind;
  weightKg: string | null;
  weightSource: WeightSource;
  /** Typed digits; sent as the contract's integer only when given. */
  packCount: string;
  expiresOn: string;
}

let next = 0;
function newKey(): string {
  next += 1;
  return `output-${next}`;
}

function emptyOutput(): DraftOutput {
  return {
    key: newKey(),
    product: null,
    outputKind: 'MEAT',
    weightKg: null,
    weightSource: 'SCALE',
    packCount: '',
    expiresOn: '',
  };
}

function fromOrder(order: Order): DraftOutput[] {
  if (order.outputs.length === 0) return [emptyOutput()];
  return order.outputs.map((output) => ({
    key: newKey(),
    product: output.product,
    outputKind: output.outputKind,
    weightKg: output.weightKg,
    weightSource: output.weightSource,
    packCount: output.packCount === null ? '' : String(output.packCount),
    expiresOn: output.expiresOn ?? '',
  }));
}

/** Which lines are not ready to send, and why, by key. Format checks only: the API judges the weights. */
function problems(lines: DraftOutput[]): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const line of lines) {
    const wrong: string[] = [];
    if (line.product === null) wrong.push('product');
    if (line.weightKg === null || !KILOGRAMS.test(line.weightKg)) wrong.push('weight');
    if (line.outputKind !== 'WASTE' && line.packCount !== '' && !WHOLE.test(line.packCount))
      wrong.push('packs');
    if (line.outputKind !== 'WASTE' && line.expiresOn !== '' && !DATE.test(line.expiresOn))
      wrong.push('expiry');
    if (wrong.length > 0) found[line.key] = wrong;
  }
  return found;
}

/**
 * The weighed outputs of an IN_PROGRESS order (`recordProcessingOutputs`), replaced whole on every save
 * with the `version` read. Each is a product, its kind, its weight and where the weight came from; waste
 * names no pack count or expiry. The API holds the rules (a saleable output kept in lots and sold by the
 * kilogram, the outputs weighing no more than the inputs) and its refusal stays here in its words. Nothing
 * moves until the order completes: reference prices, allocation and lots are made then.
 */
export function OutputsEditor({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const { t } = useTranslation(['processing', 'common']);
  const [lines, setLines] = useState<DraftOutput[]>(() => fromOrder(order));
  const [found, setFound] = useState<Record<string, string[]>>({});
  const [dirty, setDirty] = useState(false);
  const record = useApiMutation('recordProcessingOutputs');
  const keyFor = useIntentKey();
  const guard = useLeaveGuard(dirty);
  const required = t('common:field.required');
  const failure = useStateLabels({
    loading: t('outputs.saving'),
    emptyTitle: t('outputs.notSaved'),
    errorTitle: t('outputs.notSaved'),
    deniedTitle: t('outputs.notSaved'),
  });
  const change = (key: string, update: Partial<DraftOutput>) => {
    setDirty(true);
    setLines((now) => now.map((line) => (line.key === key ? { ...line, ...update } : line)));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const wrong = problems(lines);
    setFound(wrong);
    if (Object.keys(wrong).length > 0) return;
    const body = {
      version: order.version,
      outputs: lines.map((line) => {
        const waste = line.outputKind === 'WASTE';
        return {
          productId: line.product?.id ?? '',
          outputKind: line.outputKind,
          weightKg: line.weightKg ?? '',
          weightSource: line.weightSource,
          ...(waste || line.packCount === '' ? {} : { packCount: Number(line.packCount) }),
          ...(waste || line.expiresOn === '' ? {} : { expiresOn: line.expiresOn }),
        };
      }),
    };
    record
      .mutateAsync({ path: { id: order.id }, body }, { idempotencyKey: keyFor(body) })
      .then(() => {
        setDirty(false);
        onSaved();
      })
      .catch(() => undefined);
  };

  return (
    <section aria-labelledby="outputs-edit-title" className="grid gap-3">
      <h2 id="outputs-edit-title" className="text-xl font-semibold">
        {t('outputs.editTitle')}
      </h2>
      <p className="text-fg-muted">{t('outputs.editHint')}</p>
      <form className="grid gap-3" onSubmit={submit} noValidate aria-label={t('outputs.form')}>
        <MutationFailure error={record.error} labels={failure} />
        <ol className="grid gap-3">
          {lines.map((line, index) => {
            const number = index + 1;
            const wrong = found[line.key] ?? [];
            const waste = line.outputKind === 'WASTE';
            return (
              <li key={line.key} className="grid gap-2 rounded-md border border-border p-3">
                <p className="font-semibold">{t('outputs.line', { number })}</p>
                <ProductPicker
                  label={t('outputs.product', { number })}
                  value={line.product}
                  onChange={(product) => change(line.key, { product })}
                  {...(wrong.includes('product') ? { error: required } : {})}
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label={t('outputs.kind', { number })}>
                    <Select
                      value={line.outputKind}
                      onValueChange={(value) =>
                        change(line.key, {
                          outputKind: OUTPUT_KINDS.find((kind) => kind === value) ?? 'MEAT',
                        })
                      }
                      options={OUTPUT_KINDS.map((value) => ({
                        value,
                        label: t(`outputKind.${value}`),
                      }))}
                    />
                  </Field>
                  <Field
                    label={t('outputs.weight', { number })}
                    required
                    requiredLabel={required}
                    error={wrong.includes('weight') ? t('outputs.weightMissing') : undefined}
                  >
                    <WeightInput
                      value={line.weightKg}
                      onValueChange={(weightKg) => change(line.key, { weightKg })}
                    />
                  </Field>
                  <Field label={t('outputs.weightSource', { number })}>
                    <Select
                      value={line.weightSource}
                      onValueChange={(value) =>
                        change(line.key, {
                          weightSource: WEIGHT_SOURCES.find((s) => s === value) ?? 'SCALE',
                        })
                      }
                      options={WEIGHT_SOURCES.map((value) => ({
                        value,
                        label: t(`weightSource.${value}`),
                      }))}
                    />
                  </Field>
                </div>
                {waste ? (
                  <p className="text-control-sm text-fg-muted">{t('outputs.wasteHint')}</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field
                      label={t('outputs.packs', { number })}
                      hint={t('outputs.packsHint')}
                      error={wrong.includes('packs') ? t('outputs.packsInvalid') : undefined}
                    >
                      <NumberInput
                        value={line.packCount}
                        onValueChange={(packCount) => change(line.key, { packCount })}
                      />
                    </Field>
                    <Field
                      label={t('outputs.expires', { number })}
                      hint={t('outputs.expiresHint')}
                      error={wrong.includes('expiry') ? t('outputs.expiresInvalid') : undefined}
                    >
                      <DatePicker
                        value={line.expiresOn}
                        onChange={(event) => change(line.key, { expiresOn: event.target.value })}
                      />
                    </Field>
                  </div>
                )}
                {lines.length > 1 ? (
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setDirty(true);
                        setLines((now) => now.filter((other) => other.key !== line.key));
                      }}
                    >
                      {t('outputs.remove', { number })}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDirty(true);
              setLines((now) => [...now, emptyOutput()]);
            }}
          >
            {t('outputs.add')}
          </Button>
          <Button type="submit" loading={record.isPending} loadingLabel={t('outputs.saving')}>
            {t('outputs.save')}
          </Button>
        </div>
      </form>
      <LeaveGuardDialog guard={guard} />
    </section>
  );
}
