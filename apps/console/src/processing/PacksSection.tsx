import { Printer } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Barcode,
  Button,
  Field,
  MutationFailure,
  Pagination,
  QueryBoundary,
  Select,
  StatusBadge,
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
  isCode128B,
  type BadgeTone,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { lookup, UNKNOWN } from '../lib/lookup';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { WEIGHT_SOURCES, type Order, type WeightSource } from './presentation';

type Pack = components['schemas']['Pack'];
type LabelFormat = components['schemas']['LabelPrintRequest']['format'];

const KILOGRAMS = /^(0|[1-9][0-9]{0,6})\.[0-9]{3}$/;
const FORMATS = ['PDF_LABEL_50x30', 'ZPL'] as const;
const PACK_STATUS: Record<Pack['status'], { tone: BadgeTone }> = {
  IN_STOCK: { tone: 'good' },
  PICKED: { tone: 'info' },
  SOLD: { tone: 'slate' },
  WRITTEN_OFF: { tone: 'critical' },
  REVERSED: { tone: 'slate' },
};

/**
 * The packs cut from a completed order's saleable outputs, each with its weight and barcode, and labels
 * printed for them. `listPacks`, `createPacks` and `printPackLabels` answer from the real API (backend
 * changelog 1.26.0).
 */
export function PacksSection({ order }: { order: Order }) {
  const { t } = useTranslation(['processing', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const packs = useApiQuery('listPacks', {
    path: { id: order.id },
    query: pages.cursor === undefined ? {} : { cursor: pages.cursor },
  });
  const labels = useStateLabels({
    loading: t('packs.loading'),
    emptyTitle: t('packs.empty'),
    emptyDescription: t('packs.emptyBody'),
    errorTitle: t('packs.error'),
    deniedTitle: t('packs.denied'),
  });
  const canProcess = auth.can('prc.order.process');
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('packs.columns.pack')}</TableHead>
        <TableHead>{t('packs.columns.lot')}</TableHead>
        <TableHead numeric>{t('packs.columns.weight')}</TableHead>
        <TableHead>{t('packs.columns.barcode')}</TableHead>
        <TableHead>{t('packs.columns.status')}</TableHead>
        <TableHead>{t('packs.columns.label')}</TableHead>
      </TableRow>
    </TableHeader>
  );
  return (
    <section aria-labelledby="packs-title" className="grid gap-3">
      <h2 id="packs-title" className="text-xl font-semibold">
        {t('packs.title')}
      </h2>
      {canProcess ? <CreatePacks order={order} /> : null}
      <QueryBoundary
        query={packs}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('packs.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={6} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <div className="grid gap-3">
            <TableContainer aria-label={t('packs.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((pack) => (
                    <TableRow key={pack.id}>
                      <TableRowHeader>{t('packs.packNo', { number: pack.packNo })}</TableRowHeader>
                      <TableCell label={t('packs.columns.lot')}>
                        <code>{pack.stockUnit.identifier}</code>
                      </TableCell>
                      <TableCell numeric label={t('packs.columns.weight')}>
                        <WeightDisplay kilograms={pack.weightKg} />
                      </TableCell>
                      <TableCell label={t('packs.columns.barcode')}>
                        <code>{pack.barcode}</code>
                      </TableCell>
                      <TableCell label={t('packs.columns.status')}>
                        <StatusBadge
                          tone={lookup(PACK_STATUS, pack.status, UNKNOWN).tone}
                          label={t(`packStatus.${pack.status}`, { defaultValue: pack.status })}
                        />
                      </TableCell>
                      <TableCell label={t('packs.columns.label')}>
                        <When instant={pack.labelPrintedAt} empty={t('packs.notPrinted')} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('packs.pages')}
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
            {canProcess ? <PrintLabels order={order} packs={page.data} /> : null}
          </div>
        )}
      </QueryBoundary>
    </section>
  );
}

/** Packs for one saleable output line, each weighed. The API checks they add up to the output's weight. */
function CreatePacks({ order }: { order: Order }) {
  const { t } = useTranslation(['processing', 'common']);
  const saleable = order.outputs.filter(
    (output) => output.outputKind !== 'WASTE' && output.stockUnit !== null,
  );
  const [lineNo, setLineNo] = useState(saleable[0] === undefined ? '' : String(saleable[0].lineNo));
  const [weights, setWeights] = useState<(string | null)[]>([null]);
  const [source, setSource] = useState<WeightSource>('SCALE');
  const [checked, setChecked] = useState(false);
  const [made, setMade] = useState<number | null>(null);
  const create = useApiMutation('createPacks');
  const keyFor = useIntentKey();
  const failure = useStateLabels({
    loading: t('packs.creating'),
    emptyTitle: t('packs.notCreated'),
    errorTitle: t('packs.notCreated'),
    deniedTitle: t('packs.notCreated'),
  });
  if (saleable.length === 0) return null;
  const chosen = saleable.find((output) => String(output.lineNo) === lineNo);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    setMade(null);
    if (chosen === undefined || weights.some((w) => w === null || !KILOGRAMS.test(w))) return;
    const body = {
      outputLineNo: chosen.lineNo,
      packs: weights.map((weightKg) => ({ weightKg: weightKg ?? '', weightSource: source })),
    };
    create
      .mutateAsync({ path: { id: order.id }, body }, { idempotencyKey: keyFor(body) })
      .then((answer) => {
        setMade(answer.packs.length);
        setWeights([null]);
        setChecked(false);
      })
      .catch(() => undefined);
  };
  return (
    <form
      className="grid gap-3 rounded-md border border-border p-3"
      onSubmit={submit}
      noValidate
      aria-label={t('packs.createTitle')}
    >
      <h3 className="font-semibold">{t('packs.createTitle')}</h3>
      {made === null ? null : <Alert severity="good" title={t('packs.created', { count: made })} />}
      <MutationFailure error={create.error} labels={failure} />
      <Field label={t('packs.output')}>
        <Select
          value={lineNo}
          onValueChange={setLineNo}
          options={saleable.map((output) => ({
            value: String(output.lineNo),
            label: t('packs.outputOption', {
              number: output.lineNo,
              product: output.product.name,
            }),
          }))}
        />
      </Field>
      {chosen === undefined ? null : (
        <p className="text-control-sm text-fg-muted">
          {t('packs.outputWeight')} <WeightDisplay kilograms={chosen.weightKg} />
        </p>
      )}
      <Field label={t('packs.weightSource')}>
        <Select
          value={source}
          onValueChange={(value) => setSource(WEIGHT_SOURCES.find((s) => s === value) ?? 'SCALE')}
          options={WEIGHT_SOURCES.map((value) => ({ value, label: t(`weightSource.${value}`) }))}
        />
      </Field>
      <ol className="grid gap-2">
        {weights.map((weight, index) => {
          const number = index + 1;
          return (
            <li key={number} className="flex flex-wrap items-end gap-2">
              <Field
                label={t('packs.weight', { number })}
                required
                requiredLabel={t('common:field.required')}
                error={
                  checked && (weight === null || !KILOGRAMS.test(weight))
                    ? t('outputs.weightMissing')
                    : undefined
                }
              >
                <WeightInput
                  value={weight}
                  onValueChange={(value) =>
                    setWeights((now) => now.map((w, i) => (i === index ? value : w)))
                  }
                />
              </Field>
              {weights.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setWeights((now) => now.filter((_, i) => i !== index))}
                >
                  {t('packs.remove', { number })}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeights((now) => [...now, null])}
        >
          {t('packs.addPack')}
        </Button>
        <Button type="submit" loading={create.isPending} loadingLabel={t('packs.creating')}>
          {t('packs.create')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Labels for the packs on this page. `printPackLabels` answers the label data (contract 1.26.0,
 * `PackLabelSheet`), and the sheet is drawn here with a Code 128 barcode per pack and printed by the
 * browser. Each request is one intent with its own Idempotency-Key, so "Try again" cannot record a second
 * first print. A label printed before comes back marked as a reprint, and says so on the paper.
 */
function PrintLabels({ order, packs }: { order: Order; packs: readonly Pack[] }) {
  const { t } = useTranslation(['processing', 'common']);
  const [format, setFormat] = useState<LabelFormat>('PDF_LABEL_50x30');
  const print = useApiMutation('printPackLabels');
  const keyFor = useIntentKey();
  const failure = useStateLabels({
    loading: t('labels.pending'),
    emptyTitle: t('labels.failed'),
    errorTitle: t('labels.failed'),
    deniedTitle: t('labels.failed'),
  });
  const body = { packIds: packs.map((pack) => pack.id), format };
  const sheet = print.data?.labels ?? [];
  return (
    <div className="grid gap-3 rounded-md border border-border p-3">
      <h3 className="font-semibold print:hidden">{t('labels.title')}</h3>
      <MutationFailure error={print.error} labels={failure} />
      <div className="grid gap-3 print:hidden">
        <Field label={t('labels.format')}>
          <Select
            value={format}
            onValueChange={(value) =>
              setFormat(FORMATS.find((f) => f === value) ?? 'PDF_LABEL_50x30')
            }
            options={FORMATS.map((value) => ({ value, label: t(`labels.formats.${value}`) }))}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={print.isPending}
            loadingLabel={t('labels.pending')}
            onClick={() =>
              print.mutate({ path: { id: order.id }, body }, { idempotencyKey: keyFor(body) })
            }
          >
            <Printer aria-hidden="true" />
            {t('labels.action', { count: packs.length })}
          </Button>
          {sheet.length === 0 ? null : (
            <Button onClick={() => window.print()}>{t('labels.print')}</Button>
          )}
        </div>
      </div>
      {sheet.length === 0 ? null : (
        // Labels are always drawn light, dark bars on a light ground, so they scan on screen and on paper.
        <ul
          data-theme="light"
          aria-label={t('labels.sheet')}
          className="grid grid-cols-1 gap-2 rounded-md bg-surface-sunken p-2 sm:grid-cols-2 print:grid-cols-3 print:bg-surface print:p-0"
        >
          {sheet.map((label) => (
            <li
              key={label.pack.id}
              className="grid break-inside-avoid justify-items-center gap-1 rounded-md border border-border-strong bg-surface p-3 text-center text-fg"
            >
              <span className="font-semibold break-words">{label.product.name}</span>
              {label.reprint ? (
                <span className="text-xs font-semibold uppercase">{t('labels.reprint')}</span>
              ) : null}
              {isCode128B(label.barcode.payload) ? (
                <Barcode value={label.barcode.payload} label={t('labels.barcode')} />
              ) : (
                <Alert
                  severity="warning"
                  title={t('labels.cannot', { code: label.barcode.payload })}
                />
              )}
              <span className="font-mono text-xs">{label.line}</span>
              <dl className="grid w-full grid-cols-[auto_1fr] gap-x-2 text-start text-xs">
                <dt className="text-fg-muted">{t('labels.lines.weight')}</dt>
                <dd>
                  <WeightDisplay kilograms={label.weightKg} />
                </dd>
                <dt className="text-fg-muted">{t('labels.lines.produced')}</dt>
                <dd>{label.producedOn}</dd>
                {label.expiresOn === null ? null : (
                  <>
                    <dt className="text-fg-muted">{t('labels.lines.expires')}</dt>
                    <dd>{label.expiresOn}</dd>
                  </>
                )}
                {label.storageTempClass === null ? null : (
                  <>
                    <dt className="text-fg-muted">{t('labels.lines.storage')}</dt>
                    <dd>{t(`labels.storage.${label.storageTempClass}`)}</dd>
                  </>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
