import { CirclePlay, CircleX, PackageCheck, Undo2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
  MoneyDisplay,
  MoneyInput,
  Select,
  WeightDisplay,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation } from '../data/api';
import { isApprovalPending } from '../lib/approval';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { useStateLabels } from '../lib/states';
import { COST_KINDS, SetAtCompletion, type CostKind, type Order } from './presentation';

/** What a lifecycle action tells the page once the API has answered. */
export type Notice =
  | 'started'
  | 'completed'
  | 'cancelled'
  | 'reversed'
  | 'reversalPending'
  | 'costAdded'
  | 'outputsSaved';

/** `ProcessingCostCreate.description`: the contract sets no limit, so the form keeps to a line. */
const DESCRIPTION_MAX = 200;

/**
 * The order's lifecycle by status and permission (completeProcessingOrder's description): a PLANNED order
 * is started (`prc.order.process`), an IN_PROGRESS one completed, and either cancelled with a reason
 * (`prc.order.create`). A COMPLETED order is reversed by the same cancel, which then also needs
 * `prc.order.reverse` (contract 1.26.0). At or above the adjustment threshold the reversal answers 202 and
 * waits for a second person (1.31.0, CR-025); while it waits (`pendingReversal`) it is not offered again.
 */
export function OrderActions({
  order,
  onNotice,
}: {
  order: Order;
  onNotice: (notice: Notice) => void;
}) {
  const { t } = useTranslation(['processing', 'common']);
  const auth = useAuth();
  const canProcess = auth.can('prc.order.process');
  const canCancel = auth.can('prc.order.create');
  const open = order.status === 'PLANNED' || order.status === 'IN_PROGRESS';
  if (order.status === 'COMPLETED' && order.reversal === null && canCancel) {
    if (!auth.can('prc.order.reverse') || order.pendingReversal !== null) return null;
    return (
      <Card>
        <CardBody className="grid gap-3">
          <h2 className="text-lg font-semibold">{t('reverse.heading')}</h2>
          <p className="text-fg-muted">{t('reverse.hint')}</p>
          <div>
            <ReverseOrder order={order} onDone={onNotice} />
          </div>
        </CardBody>
      </Card>
    );
  }
  if (!open || (!canProcess && !canCancel)) return null;
  return (
    <Card>
      <CardBody className="grid gap-3">
        <h2 className="text-lg font-semibold">{t('actions.title')}</h2>
        <p className="text-fg-muted">
          {order.status === 'PLANNED' ? t('actions.plannedHint') : t('actions.inProgressHint')}
        </p>
        <div className="flex flex-wrap gap-2">
          {order.status === 'PLANNED' && canProcess ? (
            <StartOrder order={order} onDone={() => onNotice('started')} />
          ) : null}
          {order.status === 'IN_PROGRESS' && canProcess ? (
            <CompleteOrder order={order} onDone={() => onNotice('completed')} />
          ) : null}
          {canCancel ? <CancelOrder order={order} onDone={() => onNotice('cancelled')} /> : null}
        </div>
      </CardBody>
    </Card>
  );
}

function StartOrder({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useTranslation('processing');
  const [open, setOpen] = useState(false);
  const start = useApiMutation('startProcessingOrder');
  const keyFor = useIntentKey();
  return (
    <>
      <Button
        onClick={() => {
          start.reset();
          setOpen(true);
        }}
      >
        <CirclePlay aria-hidden="true" />
        {t('start.action')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('start.title')}
        body={t('start.body')}
        confirmLabel={t('start.action')}
        pendingLabel={t('start.pending')}
        pending={start.isPending}
        error={start.error}
        failedTitle={t('start.failed')}
        icon={CirclePlay}
        onConfirm={() => {
          start
            .mutateAsync(
              { path: { id: order.id } },
              { idempotencyKey: keyFor({ start: order.id, version: order.version }) },
            )
            .then(() => {
              setOpen(false);
              onDone();
            })
            .catch(() => undefined);
        }}
      >
        <InputsSummary order={order} />
      </ConfirmDialog>
    </>
  );
}

/** The animals on the order with their weights and the cost each would carry now, as the API gives them. */
function InputsSummary({ order }: { order: Order }) {
  const { t } = useTranslation('processing');
  return (
    <ul className="grid list-disc gap-1 ps-5">
      {order.inputs.map((input) => (
        <li key={input.id}>
          {t('confirm.input', { tag: input.stockUnit.identifier, product: input.product.name })}{' '}
          <WeightDisplay kilograms={input.weightKg} />
          {', '}
          {t('confirm.costNow')}{' '}
          {input.costPesewas === null ? (
            <SetAtCompletion />
          ) : (
            <MoneyDisplay pesewas={input.costPesewas} />
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Completing writes stock and money: the animals are consumed at their whole cost pool, each saleable
 * output becomes a lot at its allocated cost, and the direct costs go to the ledger. The confirmation shows
 * every figure the API has given so far. The total and each output's share are the API's to work out at
 * completion (largest-remainder allocation by sales value), so they are named, never estimated here.
 */
function CompleteOrder({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useTranslation('processing');
  const [open, setOpen] = useState(false);
  const complete = useApiMutation('completeProcessingOrder', {
    invalidates: ['listStockOnHand', 'listStockUnits', 'listAnimals', 'getAnimal'],
  });
  const keyFor = useIntentKey();
  const nothingWeighed = order.outputs.length === 0;
  return (
    <>
      <div className="grid gap-1">
        <div>
          <Button
            disabled={nothingWeighed}
            onClick={() => {
              complete.reset();
              setOpen(true);
            }}
          >
            <PackageCheck aria-hidden="true" />
            {t('complete.action')}
          </Button>
        </div>
        {nothingWeighed ? (
          <p className="text-control-sm text-fg-muted">{t('complete.needsOutputs')}</p>
        ) : null}
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('complete.title')}
        body={t('complete.body')}
        consequence={t('complete.consequence')}
        confirmLabel={t('complete.action')}
        pendingLabel={t('complete.pending')}
        pending={complete.isPending}
        error={complete.error}
        failedTitle={t('complete.failed')}
        icon={PackageCheck}
        onConfirm={() => {
          complete
            .mutateAsync(
              { path: { id: order.id } },
              { idempotencyKey: keyFor({ complete: order.id, version: order.version }) },
            )
            .then(() => {
              setOpen(false);
              onDone();
            })
            .catch(() => undefined);
        }}
      >
        <div className="grid gap-3">
          <section className="grid gap-1" aria-label={t('complete.consumed')}>
            <h3 className="font-semibold">{t('complete.consumed')}</h3>
            <InputsSummary order={order} />
          </section>
          <section className="grid gap-1" aria-label={t('complete.outputs')}>
            <h3 className="font-semibold">{t('complete.outputs')}</h3>
            <ul className="grid list-disc gap-1 ps-5">
              {order.outputs.map((output) => (
                <li key={output.id}>
                  {t('confirm.output', {
                    product: output.product.name,
                    kind: t(`outputKind.${output.outputKind}`),
                  })}{' '}
                  <WeightDisplay kilograms={output.weightKg} />
                </li>
              ))}
            </ul>
          </section>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
            <dt className="text-fg-muted">{t('facts.directCost')}</dt>
            <dd>
              <MoneyDisplay pesewas={order.directCostPesewas} />
            </dd>
            <dt className="text-fg-muted">{t('facts.inputCost')}</dt>
            <dd>
              {order.inputCostPesewas === null ? (
                <SetAtCompletion />
              ) : (
                <MoneyDisplay pesewas={order.inputCostPesewas} />
              )}
            </dd>
            <dt className="text-fg-muted">{t('facts.totalCost')}</dt>
            <dd>
              {order.totalCostPesewas === null ? (
                <SetAtCompletion />
              ) : (
                <MoneyDisplay pesewas={order.totalCostPesewas} />
              )}
            </dd>
          </dl>
          <p>{t('complete.allocation')}</p>
        </div>
      </ConfirmDialog>
    </>
  );
}

function CancelOrder({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useTranslation(['processing', 'common']);
  const [open, setOpen] = useState(false);
  const cancel = useApiMutation('cancelProcessingOrder');
  const keyFor = useIntentKey();
  const failure = useStateLabels({
    loading: t('cancel.pending'),
    emptyTitle: t('cancel.failed'),
    errorTitle: t('cancel.failed'),
    deniedTitle: t('cancel.failed'),
  });
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          cancel.reset();
          setOpen(true);
        }}
      >
        <CircleX aria-hidden="true" />
        {t('cancel.action')}
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={t('cancel.title')}
        body={t('cancel.body')}
        submitLabel={t('cancel.action')}
        error={cancel.error}
        failureLabels={failure}
        destructive
        onConfirm={async (reason) => {
          const body = { reason };
          await cancel.mutateAsync(
            { path: { id: order.id }, body },
            { idempotencyKey: keyFor({ cancel: order.id, ...body }) },
          );
          setOpen(false);
          onDone();
        }}
      />
    </>
  );
}

/**
 * Reverses a completed order (FR-PRC-011): every movement its completion posted is undone, the animal back
 * in its pen at its prior cost and the output lots emptied. It writes stock and cost back, so the dialog
 * names the order's total cost and every output's weight before it is sent. A refusal (an output sold,
 * reserved or changed) stays on screen in the dialog, in words.
 */
function ReverseOrder({
  order,
  onDone,
}: {
  order: Order;
  onDone: (notice: 'reversed' | 'reversalPending') => void;
}) {
  const { t } = useTranslation(['processing', 'common']);
  const [open, setOpen] = useState(false);
  const reverse = useApiMutation('cancelProcessingOrder');
  const keyFor = useIntentKey();
  const failure = useStateLabels({
    loading: t('reverse.pending'),
    emptyTitle: t('reverse.failed'),
    errorTitle: t('reverse.failed'),
    deniedTitle: t('reverse.failed'),
  });
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          reverse.reset();
          setOpen(true);
        }}
      >
        <Undo2 aria-hidden="true" />
        {t('reverse.action')}
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={t('reverse.title')}
        body={t('reverse.body')}
        submitLabel={t('reverse.action')}
        error={reverse.error}
        failureLabels={failure}
        destructive
        warning={
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-fg-muted">{t('reverse.totalCost')}</dt>
            <dd>
              {order.totalCostPesewas === null ? (
                t('facts.notYet')
              ) : (
                <MoneyDisplay pesewas={order.totalCostPesewas} />
              )}
            </dd>
            {order.outputs.map((output) => (
              <div key={output.lineNo} className="contents">
                <dt className="text-fg-muted">{output.product.name}</dt>
                <dd>
                  <WeightDisplay kilograms={output.weightKg} />
                </dd>
              </div>
            ))}
          </dl>
        }
        onConfirm={async (reason) => {
          const body = { reason };
          const answer = await reverse.mutateAsync(
            { path: { id: order.id }, body },
            { idempotencyKey: keyFor({ reverse: order.id, ...body }) },
          );
          setOpen(false);
          onDone(isApprovalPending(answer) ? 'reversalPending' : 'reversed');
        }}
      />
    </>
  );
}

/**
 * A direct cost on a PLANNED or IN_PROGRESS order (`addProcessingCost`), in pesewas. It reaches the ledger
 * only when the order completes, but it is money, so the exact amount is confirmed before it is sent.
 */
export function AddCost({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useTranslation(['processing', 'common']);
  const [costKind, setCostKind] = useState<CostKind>('LABOUR');
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [checked, setChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const add = useApiMutation('addProcessingCost');
  const keyFor = useIntentKey();
  const required = t('common:field.required');
  const body = { costKind, amountPesewas: amount ?? 0, description: description.trim() };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (amount === null || amount <= 0 || body.description === '') return;
    add.reset();
    setConfirming(true);
  };
  return (
    <section aria-labelledby="add-cost-title" className="grid gap-3">
      <h3 id="add-cost-title" className="font-semibold">
        {t('addCost.title')}
      </h3>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={submit} noValidate>
        <Field label={t('addCost.kind')}>
          <Select
            value={costKind}
            onValueChange={(value) =>
              setCostKind(COST_KINDS.find((kind) => kind === value) ?? 'LABOUR')
            }
            options={COST_KINDS.map((value) => ({ value, label: t(`costKind.${value}`) }))}
          />
        </Field>
        <Field
          label={t('addCost.amount')}
          required
          requiredLabel={required}
          error={
            checked && (amount === null || amount <= 0) ? t('addCost.amountMissing') : undefined
          }
        >
          <MoneyInput value={amount} onValueChange={setAmount} />
        </Field>
        <Field
          label={t('addCost.description')}
          hint={t('addCost.descriptionHint')}
          required
          requiredLabel={required}
          error={checked && body.description === '' ? required : undefined}
        >
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={DESCRIPTION_MAX}
            autoComplete="off"
          />
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" variant="secondary">
            {t('addCost.action')}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('addCost.confirmTitle')}
        body={t('addCost.confirmBody')}
        confirmLabel={t('addCost.action')}
        pendingLabel={t('addCost.pending')}
        pending={add.isPending}
        error={add.error}
        failedTitle={t('addCost.failed')}
        onConfirm={() => {
          add
            .mutateAsync(
              { path: { id: order.id }, body },
              { idempotencyKey: keyFor({ order: order.id, ...body }) },
            )
            .then(() => {
              setConfirming(false);
              setAmount(null);
              setDescription('');
              setChecked(false);
              onDone();
            })
            .catch(() => undefined);
        }}
      >
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
          <dt className="text-fg-muted">{t('addCost.kind')}</dt>
          <dd>{t(`costKind.${costKind}`)}</dd>
          <dt className="text-fg-muted">{t('addCost.description')}</dt>
          <dd>{body.description}</dd>
          <dt className="text-fg-muted">{t('addCost.amount')}</dt>
          <dd>
            <MoneyDisplay pesewas={body.amountPesewas} strong />
          </dd>
        </dl>
      </ConfirmDialog>
    </section>
  );
}
