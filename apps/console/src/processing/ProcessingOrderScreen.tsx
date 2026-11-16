import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import {
  Alert,
  Card,
  CardBody,
  EmptyState,
  MoneyDisplay,
  NOT_APPLICABLE,
  QueryBoundary,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  WeightDisplay,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { AddCost, OrderActions, type Notice } from './OrderActions';
import { OutputsEditor } from './OutputsEditor';
import { PacksSection } from './PacksSection';
import {
  CompletionMoney,
  CompletionWeight,
  OrderStatusBadge,
  PercentText,
  SetAtCompletion,
  useOrderName,
  YieldFlag,
  type Order,
} from './presentation';

/**
 * FR-PRC processing order: what went in (each animal, linked to its record), what came out (each saleable
 * output linked to the lot it became), the direct costs, the yield against its standard, and the costs, all
 * as the API gives them. Figures the API sets only at completion (the input and total cost, the yield, each
 * output's reference price, allocated cost and lot) read "Set at completion" until then, never zero. The
 * lifecycle actions follow the status and the person's permissions.
 */
export function ProcessingOrderScreen() {
  const { t } = useTranslation(['processing', 'common']);
  const { id = '' } = useParams();
  const order = useApiQuery('getProcessingOrder', { path: { id } });
  const labels = useStateLabels({
    loading: t('order.loading'),
    emptyTitle: t('order.notFound'),
    errorTitle: t('order.error'),
    deniedTitle: t('order.denied'),
  });
  if (order.error?.status === 404) {
    return (
      <EmptyState
        title={t('order.notFound')}
        description={t('common:states.notFoundBody')}
        action={<BackLink />}
      />
    );
  }
  return (
    <QueryBoundary
      query={order}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => <OrderDetail order={current} />}
    </QueryBoundary>
  );
}

function BackLink() {
  const { t } = useTranslation('processing');
  return (
    <Link to="/processing-orders" className="text-accent-text underline">
      {t('orders.back')}
    </Link>
  );
}

/** One fact in the order's summary: its name, and the value or words for none. */
function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** The order on screen. Exported for the screen's tests, which give it an order in each status. */
export function OrderDetail({ order }: { order: Order }) {
  const { t } = useTranslation(['processing', 'common']);
  const auth = useAuth();
  const orderName = useOrderName();
  const [notice, setNotice] = useState<Notice | null>(null);
  const settled = order.status === 'COMPLETED';
  const canProcess = auth.can('prc.order.process');
  const open = order.status === 'PLANNED' || order.status === 'IN_PROGRESS';
  return (
    <article aria-labelledby="order-title" className="grid gap-4">
      <div className="grid gap-2">
        <BackLink />
        <div className="flex flex-wrap items-center gap-3">
          <PageHeader title={t('order.title', { name: orderName(order) })} titleId="order-title" />
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-fg-muted">
          {t('orders.route', { from: order.location.name, to: order.outputLocation.name })}
        </p>
      </div>
      {notice === null ? null : <Alert severity="good" title={t(`notice.${notice}`)} />}
      {order.reversal === null ? null : (
        <Alert
          severity="warning"
          title={t('reverse.done', { name: order.reversal.reversedBy.displayName })}
        >
          <p>
            <When instant={order.reversal.reversedAt} />
          </p>
          <p>{t('reverse.reason', { reason: order.reversal.reason })}</p>
        </Alert>
      )}
      <OrderActions order={order} onNotice={setNotice} />

      <Card>
        <CardBody className="grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="facts-title" className="grid content-start gap-2">
            <h2 id="facts-title" className="text-lg font-semibold">
              {t('facts.title')}
            </h2>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
              <Fact term={t('facts.number')}>{orderName(order)}</Fact>
              <Fact term={t('facts.location')}>{order.location.name}</Fact>
              <Fact term={t('facts.outputLocation')}>{order.outputLocation.name}</Fact>
              <Fact term={t('facts.created')}>
                {order.createdBy.displayName} · <When instant={order.createdAt} />
              </Fact>
              <Fact term={t('facts.started')}>
                <When instant={order.startedAt} empty={t('facts.notYet')} />
              </Fact>
              <Fact term={t('facts.completed')}>
                <When instant={order.completedAt} empty={t('facts.notYet')} />
              </Fact>
              <Fact term={t('facts.posted')}>
                {order.postedBy === null ? (
                  t('facts.notYet')
                ) : (
                  <>
                    {order.postedBy.displayName} ·{' '}
                    <When instant={order.postedAt} empty={t('facts.notYet')} />
                  </>
                )}
              </Fact>
            </dl>
          </section>
          <section aria-labelledby="yield-title" className="grid content-start gap-2">
            <h2 id="yield-title" className="text-lg font-semibold">
              {t('yield.title')}
            </h2>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
              <Fact term={t('facts.inputWeight')}>
                <CompletionWeight kilograms={order.inputWeightKg} />
              </Fact>
              <Fact term={t('facts.outputWeight')}>
                <CompletionWeight kilograms={order.outputWeightKg} />
              </Fact>
              <Fact term={t('facts.wasteWeight')}>
                <CompletionWeight kilograms={order.wasteWeightKg} />
              </Fact>
              <Fact term={t('yield.expected')}>
                {order.expectedYieldPercent === null ? (
                  <SetAtCompletion />
                ) : (
                  <PercentText value={order.expectedYieldPercent} />
                )}
              </Fact>
              <Fact term={t('yield.actual')}>
                {order.actualYieldPercent === null ? (
                  <SetAtCompletion />
                ) : (
                  <PercentText value={order.actualYieldPercent} />
                )}
              </Fact>
              <Fact term={t('yield.against')}>
                <YieldFlag order={order} />
              </Fact>
            </dl>
            <h2 className="text-lg font-semibold">{t('facts.costsTitle')}</h2>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
              <Fact term={t('facts.inputCost')}>
                <CompletionMoney pesewas={order.inputCostPesewas} settled={settled} />
              </Fact>
              <Fact term={t('facts.directCost')}>
                <MoneyDisplay pesewas={order.directCostPesewas} />
              </Fact>
              <Fact term={t('facts.totalCost')}>
                <CompletionMoney pesewas={order.totalCostPesewas} settled={settled} strong />
              </Fact>
            </dl>
          </section>
        </CardBody>
      </Card>

      <Inputs order={order} />
      {order.status === 'IN_PROGRESS' && canProcess ? (
        <OutputsEditor order={order} onSaved={() => setNotice('outputsSaved')} />
      ) : null}
      <Outputs order={order} />
      <Costs order={order} />
      {open && canProcess ? <AddCost order={order} onDone={() => setNotice('costAdded')} /> : null}
      {settled ? <PacksSection order={order} /> : null}
    </article>
  );
}

function Inputs({ order }: { order: Order }) {
  const { t } = useTranslation('processing');
  const settled = order.status === 'COMPLETED';
  const costHead = settled ? t('inputs.columns.costConsumed') : t('inputs.columns.costNow');
  return (
    <section aria-labelledby="inputs-title" className="grid gap-3">
      <h2 id="inputs-title" className="text-xl font-semibold">
        {t('inputs.title')}
      </h2>
      <TableContainer aria-label={t('inputs.title')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('inputs.columns.animal')}</TableHead>
              <TableHead>{t('inputs.columns.product')}</TableHead>
              <TableHead numeric>{t('inputs.columns.weight')}</TableHead>
              <TableHead>{t('inputs.columns.source')}</TableHead>
              <TableHead numeric>{costHead}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.inputs.map((input) => (
              <TableRow key={input.id}>
                <TableRowHeader>
                  {/* An animal's id is its stock unit's id (Animal.id), so the tag opens its record. */}
                  <Link
                    to={`/animals/${input.stockUnit.id}`}
                    className="font-mono text-accent-text underline"
                  >
                    {input.stockUnit.identifier}
                  </Link>
                </TableRowHeader>
                <TableCell label={t('inputs.columns.product')}>{input.product.name}</TableCell>
                <TableCell numeric label={t('inputs.columns.weight')}>
                  <WeightDisplay kilograms={input.weightKg} />
                </TableCell>
                <TableCell label={t('inputs.columns.source')}>
                  {t(`weightSource.${input.weightSource}`, { defaultValue: input.weightSource })}
                </TableCell>
                <TableCell numeric label={costHead}>
                  {input.costPesewas === null ? (
                    <SetAtCompletion />
                  ) : (
                    <MoneyDisplay pesewas={input.costPesewas} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {settled ? null : <p className="text-control-sm text-fg-muted">{t('inputs.costHint')}</p>}
    </section>
  );
}

function Outputs({ order }: { order: Order }) {
  const { t } = useTranslation('processing');
  const settled = order.status === 'COMPLETED';
  return (
    <section aria-labelledby="outputs-title" className="grid gap-3">
      <h2 id="outputs-title" className="text-xl font-semibold">
        {t('outputs.title')}
      </h2>
      {order.outputs.length === 0 ? (
        <p className="text-fg-muted">
          {order.status === 'PLANNED' ? t('outputs.noneUntilStarted') : t('outputs.none')}
        </p>
      ) : (
        <TableContainer aria-label={t('outputs.title')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('outputs.columns.output')}</TableHead>
                <TableHead>{t('outputs.columns.kind')}</TableHead>
                <TableHead>{t('outputs.columns.lot')}</TableHead>
                <TableHead numeric>{t('outputs.columns.weight')}</TableHead>
                <TableHead numeric>{t('outputs.columns.packs')}</TableHead>
                <TableHead>{t('outputs.columns.expires')}</TableHead>
                <TableHead numeric>{t('outputs.columns.referencePrice')}</TableHead>
                <TableHead numeric>{t('outputs.columns.allocatedCost')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.outputs.map((output) => (
                <TableRow key={output.id}>
                  <TableRowHeader>
                    <span className="grid">
                      <span>{output.product.name}</span>
                      <span className="text-control-sm font-normal text-fg-muted">
                        {t('outputs.lineNo', { number: output.lineNo })}
                      </span>
                    </span>
                  </TableRowHeader>
                  <TableCell label={t('outputs.columns.kind')}>
                    {t(`outputKind.${output.outputKind}`, { defaultValue: output.outputKind })}
                  </TableCell>
                  <TableCell label={t('outputs.columns.lot')}>
                    {output.stockUnit !== null ? (
                      <Link
                        to={`/lots?q=${encodeURIComponent(output.stockUnit.identifier)}`}
                        className="font-mono text-accent-text underline"
                      >
                        {output.stockUnit.identifier}
                      </Link>
                    ) : output.outputKind === 'WASTE' ? (
                      t('outputs.noLotForWaste')
                    ) : (
                      <SetAtCompletion />
                    )}
                  </TableCell>
                  <TableCell numeric label={t('outputs.columns.weight')}>
                    <WeightDisplay kilograms={output.weightKg} />
                  </TableCell>
                  <TableCell numeric label={t('outputs.columns.packs')}>
                    {output.packCount ?? NOT_APPLICABLE}
                  </TableCell>
                  <TableCell label={t('outputs.columns.expires')}>
                    {output.expiresOn ?? NOT_APPLICABLE}
                  </TableCell>
                  <TableCell numeric label={t('outputs.columns.referencePrice')}>
                    {settled ? (
                      <>
                        <MoneyDisplay pesewas={output.referencePricePesewasPerKg} />{' '}
                        {t('outputs.perKg')}
                      </>
                    ) : (
                      <SetAtCompletion />
                    )}
                  </TableCell>
                  <TableCell numeric label={t('outputs.columns.allocatedCost')}>
                    <CompletionMoney pesewas={output.allocatedCostPesewas} settled={settled} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </section>
  );
}

function Costs({ order }: { order: Order }) {
  const { t } = useTranslation('processing');
  return (
    <section aria-labelledby="costs-title" className="grid gap-3">
      <h2 id="costs-title" className="text-xl font-semibold">
        {t('costs.title')}
      </h2>
      {order.costs.length === 0 ? (
        <p className="text-fg-muted">{t('costs.none')}</p>
      ) : (
        <TableContainer aria-label={t('costs.title')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('costs.columns.description')}</TableHead>
                <TableHead>{t('costs.columns.kind')}</TableHead>
                <TableHead numeric>{t('costs.columns.amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.costs.map((cost) => (
                <TableRow key={cost.id}>
                  <TableRowHeader>{cost.description}</TableRowHeader>
                  <TableCell label={t('costs.columns.kind')}>
                    {t(`costKind.${cost.costKind}`, { defaultValue: cost.costKind })}
                  </TableCell>
                  <TableCell numeric label={t('costs.columns.amount')}>
                    <MoneyDisplay pesewas={cost.amountPesewas} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <p className="text-control-sm text-fg-muted">
        {t('costs.total')} <MoneyDisplay pesewas={order.directCostPesewas} strong />
      </p>
    </section>
  );
}
