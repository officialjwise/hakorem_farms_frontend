import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  NumberInput,
  QuantityDisplay,
  Select,
  StatusBadge,
  formatQuantity,
} from '@hakorem/ui';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useApiAllPages, useApiMutation } from '../data/api';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { compareQuantity, gapBetween, toQuantity, useUnits } from './units';

type Transfer = components['schemas']['StockTransfer'];
type Line = Transfer['lines'][number];

/** What the person entered for one line: the quantity that arrived, and a reason when it is short. */
interface Arrival {
  received: string;
  reason: string;
}

type LineState =
  | { kind: 'invalid' }
  | { kind: 'more' }
  | { kind: 'full'; quantity: string }
  | { kind: 'short'; quantity: string };

/**
 * One line's arrival judged against what was sent (FR-INV-011). "Short" and "more than was sent" are
 * comparisons of the two quantities; the variance itself is the API's, shown once the receipt is posted.
 */
function judge(line: Line, arrival: Arrival): LineState {
  const quantity = toQuantity(arrival.received);
  if (quantity === null || line.qtyDispatched === null) return { kind: 'invalid' };
  const order = compareQuantity(quantity, line.qtyDispatched);
  if (order > 0) return { kind: 'more' };
  return order === 0 ? { kind: 'full', quantity } : { kind: 'short', quantity };
}

/**
 * Receiving a transfer at its destination: every dispatched line is answered with what actually arrived.
 * A vehicle that left with twenty crates and arrived with eighteen records eighteen, with a reason; the
 * server posts the two from in-transit as a loss and raises a TRANSFER_VARIANCE stock exception (contract
 * `receiveStockTransfer`). An animal arrives whole or not at all, so its line is a yes or no.
 */
export function ReceiveTransfer({ transfer }: { transfer: Transfer }) {
  const { t } = useTranslation(['stock', 'common']);
  const units = useUnits();
  const lines = transfer.lines.filter((line) => line.qtyDispatched !== null);
  const [arrivals, setArrivals] = useState<Record<string, Arrival>>(() =>
    Object.fromEntries(
      // Empty, never the quantity sent: the person counts what came off the vehicle, so nothing is
      // received by confirming a figure nobody checked.
      lines.map((line) => [line.id, { received: '', reason: '' }]),
    ),
  );
  const [checked, setChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<{ short: number } | null>(null);
  // A shortfall's reason comes from the stock adjustment or wastage list (the contract's rule): `reference`.
  const adjust = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'STOCK_ADJUSTMENT', limit: 100 } },
    { staleClass: 'reference' },
  );
  const waste = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'WASTAGE', limit: 100 } },
    { staleClass: 'reference' },
  );
  const reasons = [...(adjust.data?.items ?? []), ...(waste.data?.items ?? [])].filter(
    (r, i, all) =>
      all.findIndex((s) => s.code === r.code) === i &&
      (r.domain === 'STOCK_ADJUSTMENT' || r.domain === 'WASTAGE'),
  );
  const receive = useApiMutation('receiveStockTransfer', {
    invalidates: ['listStockOnHand', 'listStockExceptions'],
  });
  const keyFor = useIntentKey();

  const states = Object.fromEntries(
    lines.map((line) => [line.id, judge(line, arrivals[line.id] ?? { received: '', reason: '' })]),
  );
  const shortLines = lines.filter((line) => states[line.id]?.kind === 'short');
  const problem = (line: Line): string | undefined => {
    const state = states[line.id];
    if (state?.kind === 'invalid') return t('receive.invalid', { count: units.places(line.uom) });
    if (state?.kind === 'more') return t('receive.more');
    return undefined;
  };
  const reasonMissing = (line: Line) =>
    states[line.id]?.kind === 'short' && (arrivals[line.id]?.reason ?? '') === '';
  const ready = lines.every((line) => problem(line) === undefined && !reasonMissing(line));
  const set = (lineId: string, change: Partial<Arrival>) =>
    setArrivals((now) => ({
      ...now,
      [lineId]: { ...(now[lineId] ?? { received: '', reason: '' }), ...change },
    }));
  const amount = (value: string, line: Line) => (
    <QuantityDisplay
      quantity={value}
      unit={units.after(line.uom, value)}
      places={units.places(line.uom)}
    />
  );

  if (outcome !== null) {
    return (
      <p role="status" className="font-semibold">
        {outcome.short === 0
          ? t('receive.doneFull')
          : t('receive.doneShort', { count: outcome.short })}
      </p>
    );
  }

  const body = {
    lines: lines.map((line) => {
      const state = states[line.id];
      const quantity =
        state?.kind === 'full' || state?.kind === 'short'
          ? state.quantity
          : (line.qtyDispatched ?? '');
      const reason = arrivals[line.id]?.reason ?? '';
      // Counted in the unit the line was sent in (crates or eggs); the server converts to the base unit.
      return {
        lineId: line.id,
        uom: line.uom,
        qtyReceived: quantity,
        ...(state?.kind === 'short' && reason !== '' ? { varianceReasonCode: reason } : {}),
      };
    }),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('receive.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <form
          aria-label={t('receive.form')}
          className="grid gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setChecked(true);
            if (!ready) return;
            receive.reset();
            setConfirming(true);
          }}
        >
          <p>{t('receive.hint')}</p>
          {adjust.isError || waste.isError ? (
            <p role="alert">{t('adjustments.reasonsError')}</p>
          ) : null}
          <ol className="grid gap-3">
            {lines.map((line) => {
              const sent = line.qtyDispatched ?? '';
              const state = states[line.id];
              // An individual animal (SERIAL) arrives whole or not at all; a lot is weighed like any other line.
              const animal = line.stockUnit?.tracking === 'SERIAL';
              const label = animal
                ? t('receive.animalArrived', {
                    name: line.product.name,
                    tag: line.stockUnit?.identifier ?? '',
                  })
                : t('receive.received', { name: line.product.name, unit: units.many(line.uom) });
              return (
                <li key={line.id} className="grid gap-2 rounded-md border border-border p-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{line.product.name}</span>
                    <code className="text-control-sm text-fg-muted">{line.product.sku}</code>
                    <span>
                      {t('receive.sent')} {amount(sent, line)}
                    </span>
                    {state?.kind === 'full' ? (
                      <StatusBadge tone="good" icon={CircleCheck} label={t('receive.allArrived')} />
                    ) : null}
                    {state?.kind === 'short' ? (
                      <StatusBadge tone="warning" icon={TriangleAlert} label={t('receive.short')} />
                    ) : null}
                  </p>
                  {animal ? (
                    <Field label={label}>
                      <Select
                        value={state?.kind === 'short' ? 'NO' : 'YES'}
                        onValueChange={(value) =>
                          set(line.id, { received: value === 'NO' ? '0' : sent })
                        }
                        options={[
                          { value: 'YES', label: t('receive.yes') },
                          { value: 'NO', label: t('receive.no') },
                        ]}
                      />
                    </Field>
                  ) : (
                    <Field
                      label={label}
                      required
                      requiredLabel={t('common:field.required')}
                      error={checked ? problem(line) : undefined}
                    >
                      <NumberInput
                        size="lg"
                        decimals={units.places(line.uom)}
                        value={arrivals[line.id]?.received ?? ''}
                        onValueChange={(received) => set(line.id, { received })}
                      />
                    </Field>
                  )}
                  {!animal && (state?.kind === 'short' || state?.kind === 'more') ? (
                    // Input feedback while typing: the gap between sent and typed. The variance on
                    // record is the API's, shown once the transfer is received.
                    <p
                      aria-live="polite"
                      className={
                        state.kind === 'short'
                          ? 'text-sm font-semibold text-warning-fg'
                          : 'text-sm font-semibold text-critical-fg'
                      }
                    >
                      {state.kind === 'short'
                        ? t('receive.gapShort', {
                            gap: formatQuantity(gapBetween(sent, state.quantity), {
                              places: units.places(line.uom),
                            }),
                            unit: units.after(line.uom, gapBetween(sent, state.quantity)),
                          })
                        : t('receive.gapMore', {
                            gap: formatQuantity(
                              gapBetween(
                                sent,
                                toQuantity(arrivals[line.id]?.received ?? '') ?? sent,
                              ),
                              { places: units.places(line.uom) },
                            ),
                            unit: units.after(
                              line.uom,
                              gapBetween(
                                sent,
                                toQuantity(arrivals[line.id]?.received ?? '') ?? sent,
                              ),
                            ),
                          })}
                    </p>
                  ) : null}
                  {state?.kind === 'short' ? (
                    <Field
                      label={t('receive.reason', { name: line.product.name })}
                      hint={t('receive.reasonHint')}
                      required
                      requiredLabel={t('common:field.required')}
                      error={
                        checked && reasonMissing(line) ? t('receive.reasonRequired') : undefined
                      }
                    >
                      <Select
                        value={arrivals[line.id]?.reason ?? ''}
                        onValueChange={(reason) => set(line.id, { reason })}
                        placeholder={t('adjustments.chooseReason')}
                        options={reasons.map((r) => ({ value: r.code, label: r.description }))}
                      />
                    </Field>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div>
            <Button type="submit" size="lg">
              {t('receive.check')}
            </Button>
          </div>
        </form>
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t('receive.confirmTitle')}
          body={
            shortLines.length === 0
              ? t('receive.confirmFull')
              : t('receive.confirmShort', { count: shortLines.length })
          }
          confirmLabel={t('receive.confirm')}
          pendingLabel={t('move.sending')}
          pending={receive.isPending}
          error={receive.error}
          failedTitle={t('transfers.notReceived')}
          onConfirm={() => {
            receive
              .mutateAsync({ path: { id: transfer.id }, body }, { idempotencyKey: keyFor(body) })
              .then(() => {
                setConfirming(false);
                setOutcome({ short: shortLines.length });
              })
              .catch(() => undefined);
          }}
        >
          <ul className="grid list-disc gap-1 ps-5">
            {lines.map((line) => {
              const state = states[line.id];
              const got = state?.kind === 'full' || state?.kind === 'short' ? state.quantity : null;
              const reason = reasons.find((r) => r.code === arrivals[line.id]?.reason);
              return (
                <li key={line.id}>
                  {line.product.name}: {t('receive.sent')} {amount(line.qtyDispatched ?? '', line)},{' '}
                  {t('receive.arrived')} {got === null ? '' : amount(got, line)}
                  {state?.kind === 'short'
                    ? ` · ${t('receive.short')}${reason === undefined ? '' : `, ${reason.description}`}`
                    : ''}
                </li>
              );
            })}
          </ul>
        </ConfirmDialog>
      </CardBody>
    </Card>
  );
}
