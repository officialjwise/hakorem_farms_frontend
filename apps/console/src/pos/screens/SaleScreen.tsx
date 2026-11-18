import {
  Banknote,
  PackageSearch,
  Pencil,
  ShoppingBasket,
  Store,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  MoneyDisplay,
  Skeleton,
  WeightDisplay,
} from '@hakorem/ui';
import { useAuth } from '../../auth/AuthProvider';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { cartTotal, lineAmount, type CartLine } from '../offline/cart';
import { getTill, useTill } from '../offline/till';
import type { OfflinePack, SaleEntry, TillSnapshot } from '../offline/types';
import { quantityText } from '../presentation';
import {
  findInPack,
  isSoldByUnit,
  newLine,
  unitChoices,
  sellableUnits,
  soldThroughQuotes,
  sellingBlock,
  tiles,
  type SellingBlock,
} from '../sale/catalogue';
import { ChooseDialog, type Choice } from '../sale/ChooseDialog';
import { HeldSales } from '../sale/HeldSales';
import { LineDialog, lineProblem } from '../sale/LineDialog';
import { PayDialog } from '../sale/PayDialog';
import { SaleDone } from '../sale/SaleDone';

/**
 * The sale screen (FR-POS, F9), the till's index route, loaded with the document so it works with the
 * network off. Everything it sells comes from the offline pack; a completed sale goes to the queue on this
 * device first and is sent from there (ADR 0043). Its states: the till's store loading; the store missing
 * (nothing can be kept); the till not set up; no shift open; another cashier's shift; no usable pack; and
 * selling. Permission denied is the route's (`pos.sale.create`).
 */
export function SaleScreen() {
  const { t } = useTranslation('pos');
  const auth = useAuth();
  const till = useTill();
  const online = useOnlineStatus();

  if (till.storeError !== null) {
    return (
      <ErrorState
        title={t('sale.storeError.title')}
        description={t('sale.storeError.body')}
        reference={till.storeError}
        referenceLabel={t('reference')}
      />
    );
  }
  const snapshot = till.snapshot;
  if (snapshot === null) return <Skeleton label={t('sale.loading')} shape="block" />;
  if (snapshot.device === null) {
    return (
      <EmptyState
        icon={Store}
        title={t('sale.noDevice.title')}
        description={
          auth.can('pos.device.enrol') ? t('sale.noDevice.body') : t('sale.noDevice.askManager')
        }
        action={
          auth.can('pos.device.enrol') ? (
            <Button asChild size="lg">
              <Link to="/pos/setup">{t('sale.noDevice.action')}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (snapshot.shift === null) {
    return (
      <EmptyState
        icon={Banknote}
        title={t('sale.noShift.title')}
        description={t('sale.noShift.body', { register: snapshot.device.registerName })}
        action={
          auth.can('pos.shift.open') ? (
            <Button asChild size="lg">
              <Link to="/pos/shift/open">{t('sale.noShift.action')}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (snapshot.shift.cashierId !== auth.session?.principal.id) {
    return (
      <ErrorState
        icon={TriangleAlert}
        title={t('sale.otherCashier.title', { name: snapshot.shift.cashierName })}
        description={t('sale.otherCashier.body')}
      />
    );
  }
  const block = sellingBlock(snapshot, new Date());
  if (block !== null && snapshot.pack === null) return <NoPack online={online} />;
  return (
    <Selling
      snapshot={snapshot}
      pack={snapshot.pack as OfflinePack}
      block={block}
      online={online}
    />
  );
}

function NoPack({ online }: { online: boolean }) {
  const { t } = useTranslation('pos');
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-4">
      <ErrorState
        icon={PackageSearch}
        title={t('sale.noPack.title')}
        description={online ? t('sale.noPack.body') : t('sale.noPack.offline')}
        action={
          <Button
            size="lg"
            disabled={!online}
            loading={busy}
            loadingLabel={t('sale.noPack.pending')}
            onClick={() => {
              setBusy(true);
              getTill()
                .refreshPack()
                .then(() => setFailed(null))
                .catch((error: unknown) =>
                  setFailed(error instanceof Error ? error.message : String(error)),
                )
                .finally(() => setBusy(false));
            }}
          >
            {t('sale.noPack.action')}
          </Button>
        }
      />
      {failed !== null ? (
        <Alert severity="critical" title={t('sale.noPack.failed')}>
          {failed}
        </Alert>
      ) : null}
    </div>
  );
}

/** A tile's name, and in words beneath it why it is not sold here as it is (never colour alone). */
function TileWords({ name, note }: { name: string; note: string | null }) {
  return (
    <span className="grid gap-0.5">
      <span>{name}</span>
      {note === null ? null : (
        <span className="text-control-sm font-normal text-fg-muted">{note}</span>
      )}
    </span>
  );
}

type Notice = { severity: 'warning' | 'critical' | 'info'; title: string; body?: string } | null;

function Selling({
  snapshot,
  pack,
  block,
  online,
}: {
  snapshot: TillSnapshot;
  pack: OfflinePack;
  block: SellingBlock | null;
  online: boolean;
}) {
  const { t } = useTranslation('pos');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const shift = snapshot.shift;

  const add = useCallback(
    (line: CartLine | null, name: string) => {
      if (line === null) {
        setNotice({ severity: 'warning', title: t('sale.notice.noPrice', { name }) });
        return;
      }
      setLines((current) => {
        if (line.stockUnitId !== null && current.some((l) => l.stockUnitId === line.stockUnitId)) {
          setNotice({
            severity: 'warning',
            title: t('sale.notice.alreadyOn', { name: line.stockUnitIdentifier ?? name }),
          });
          return current;
        }
        setNotice({
          severity: 'info',
          title: t('sale.notice.added', { name: line.stockUnitIdentifier ?? name }),
        });
        return [...current, line];
      });
      // A weighed line cannot be paid for until it has its weight: open it at once.
      if (line.priceBasis === 'PER_KG' && line.weightKg === null) setEditing(line.key);
    },
    [t],
  );

  const pick = useCallback(
    (productId: string) => {
      const product = pack.products.find((p) => p.product.id === productId);
      if (product === undefined) return;
      if (product.quoteOnly) {
        setNotice({
          severity: 'warning',
          title: t('sale.notice.quoteOnly', { name: product.product.name }),
        });
        return;
      }
      if (soldThroughQuotes(pack, product)) {
        setNotice({
          severity: 'warning',
          title: t('sale.notice.throughQuotes', { name: product.product.name }),
          body: t('sale.notice.throughQuotesBody'),
        });
        return;
      }
      if (isSoldByUnit(pack, product)) {
        const units = sellableUnits(pack, product).filter(
          (unit) => !lines.some((l) => l.stockUnitId === unit.id),
        );
        if (units.length === 0) {
          setNotice({
            severity: 'warning',
            title: t('sale.notice.noUnits', { name: product.product.name }),
          });
          return;
        }
        setChoice({ kind: 'unit', product, units });
        return;
      }
      // A crate or a single egg (CR-038): the cashier says which, each at its own price.
      const choices = unitChoices(product);
      if (choices.length > 1) {
        setChoice({ kind: 'sellingUnit', product, units: choices });
        return;
      }
      add(newLine(product, null), product.product.name);
    },
    [pack, lines, add, t],
  );

  const total = useMemo(
    () => cartTotal(lines.filter((l) => lineProblem(l) !== 'NO_WEIGHT')),
    [lines],
  );
  const blocked = lines.some((l) => lineProblem(l) !== null);
  const results = findInPack(
    pack,
    query,
    lines.flatMap((l) => (l.stockUnitId !== null ? [l.stockUnitId] : [])),
  );
  const found = results.units.length + results.unsellable.length + results.products.length;
  const editingLine = lines.find((l) => l.key === editing) ?? null;
  const completed =
    snapshot.entries.find((e): e is SaleEntry => e.kind === 'SALE' && e.id === done) ?? null;

  if (completed !== null) {
    return <SaleDone entry={completed} onNext={() => setDone(null)} />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(20rem,28rem)]">
      <div className="grid content-start gap-4">
        {block !== null ? (
          <Alert severity="critical" title={t(`sale.block.${block}.title`)}>
            {t(`sale.block.${block}.body`)}
          </Alert>
        ) : null}
        {notice !== null ? (
          <Alert severity={notice.severity} title={notice.title}>
            {notice.body}
          </Alert>
        ) : null}
        <section aria-labelledby="find-title" className="grid gap-3">
          <h2 id="find-title" className="text-lg font-semibold">
            {t('sale.find.title')}
          </h2>
          <Field label={t('sale.find.search')} hint={t('sale.find.searchHint')}>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
          </Field>
          {query.trim() !== '' ? (
            found === 0 ? (
              <p className="text-fg-muted" role="status">
                {t('sale.find.none', { query: query.trim() })}
              </p>
            ) : (
              <ul className="grid gap-2" aria-label={t('sale.find.results')}>
                {results.unsellable.map((unit) => (
                  <li key={unit.id}>
                    <Alert
                      severity="critical"
                      title={t('sale.notice.unsellable', { name: unit.identifier })}
                    >
                      {t('sale.notice.unsellableBody')}
                    </Alert>
                  </li>
                ))}
                {results.units.map(({ product, unit }) => (
                  <li key={unit.id}>
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      disabled={block !== null}
                      onClick={() => {
                        if (soldThroughQuotes(pack, product)) pick(product.product.id);
                        else add(newLine(product, unit), product.product.name);
                        setQuery('');
                      }}
                    >
                      <TileWords
                        name={t('sale.find.unit', {
                          name: product.product.name,
                          tag: unit.identifier,
                        })}
                        note={
                          soldThroughQuotes(pack, product) ? t('sale.tile.throughQuotes') : null
                        }
                      />
                    </Button>
                  </li>
                ))}
                {results.products.map((product) => (
                  <li key={product.product.id}>
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      disabled={block !== null}
                      onClick={() => {
                        pick(product.product.id);
                        setQuery('');
                      }}
                    >
                      {product.product.name}
                    </Button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
          {tiles(pack).map((group) => (
            <div key={group.category ?? 'other'} className="grid gap-2">
              <h3 className="text-sm font-semibold text-fg-muted">
                {group.category ?? t('sale.find.other')}
              </h3>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.products.map((product) => (
                  <li key={product.product.id}>
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      className="h-auto min-h-control-lg whitespace-normal py-2 text-start"
                      disabled={block !== null || product.quoteOnly}
                      onClick={() => pick(product.product.id)}
                    >
                      <TileWords
                        name={product.product.name}
                        note={
                          product.quoteOnly
                            ? t('sale.tile.quoteOnly')
                            : soldThroughQuotes(pack, product)
                              ? t('sale.tile.throughQuotes')
                              : null
                        }
                      />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>

      <section
        aria-labelledby="cart-title"
        className="order-first grid content-start gap-3 rounded-lg border border-border bg-surface p-4 lg:order-none"
        data-slot="cart"
      >
        <h2 id="cart-title" className="text-lg font-semibold">
          {t('sale.cart.title')}
        </h2>
        {lines.length === 0 ? (
          <EmptyState
            compact
            icon={ShoppingBasket}
            title={t('sale.cart.emptyTitle')}
            description={t('sale.cart.emptyBody')}
          />
        ) : (
          <ul className="grid gap-2" aria-label={t('sale.cart.lines')}>
            {lines.map((line) => (
              <CartRow
                key={line.key}
                line={line}
                onEdit={() => setEditing(line.key)}
                onRemove={() => setLines((c) => c.filter((l) => l.key !== line.key))}
              />
            ))}
          </ul>
        )}
        <dl className="flex items-baseline justify-between border-t border-border pt-3 text-xl font-bold">
          <dt>{t('sale.cart.total')}</dt>
          <dd data-slot="cart-total">
            <MoneyDisplay pesewas={total} />
          </dd>
        </dl>
        {blocked ? <p className="text-sm text-warning-fg">{t('sale.cart.fixLines')}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            size="lg"
            fullWidth
            disabled={lines.length === 0 || blocked || block !== null}
            onClick={() => setPaying(true)}
          >
            <Banknote aria-hidden="true" />
            {t('sale.cart.pay')}
          </Button>
          <HeldSales
            lines={lines}
            pack={pack}
            snapshot={snapshot}
            online={online}
            onHeld={() => {
              setLines([]);
              setNotice({ severity: 'info', title: t('held.done') });
            }}
            onRecall={(recalled) => {
              setLines(recalled);
              setNotice({ severity: 'info', title: t('held.recalled') });
            }}
          />
        </div>
      </section>

      {choice !== null ? (
        <ChooseDialog
          choice={choice}
          onClose={() => setChoice(null)}
          onChoose={(product, unit) => {
            setChoice(null);
            if (unit === null) pick(product.product.id);
            else add(newLine(product, unit), product.product.name);
          }}
          onChooseSellingUnit={(product, unit) => {
            setChoice(null);
            add(newLine(product, null, unit), product.product.name);
          }}
        />
      ) : null}
      {editingLine !== null && shift !== null ? (
        <LineDialog
          line={editingLine}
          pack={pack}
          shiftDiscountSoFar={shift.discountGivenPesewas}
          otherLines={lines.filter((l) => l.key !== editingLine.key)}
          onClose={() => setEditing(null)}
          onSave={(changed) => {
            setLines((current) => current.map((l) => (l.key === changed.key ? changed : l)));
            setEditing(null);
          }}
        />
      ) : null}
      {paying ? (
        <PayDialog
          lines={lines}
          pack={pack}
          online={online}
          shiftId={shift !== null && shift.confirmed ? shift.id : null}
          onClose={() => setPaying(false)}
          onDone={(entry) => {
            setPaying(false);
            setLines([]);
            setNotice(null);
            setDone(entry.id);
          }}
        />
      ) : null}
    </div>
  );
}

function CartRow({
  line,
  onEdit,
  onRemove,
}: {
  line: CartLine;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('pos');
  const problem = lineProblem(line);
  // A crate and single eggs of one product are two lines, told apart by their unit (CR-038).
  const name =
    line.stockUnitIdentifier !== null
      ? `${line.productName} ${line.stockUnitIdentifier}`
      : line.soldInUom !== null && line.soldInUom !== undefined
        ? t('line.byUnit', { name: line.productName, unit: line.soldInUom.toLowerCase() })
        : line.productName;
  return (
    <li className="grid gap-1 rounded-md border border-border p-3" data-slot="cart-line">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold">{name}</p>
        <p className="font-semibold">
          {problem === 'NO_WEIGHT' ? (
            t('line.needsWeight')
          ) : (
            <MoneyDisplay pesewas={lineAmount(line)} />
          )}
        </p>
      </div>
      <p className="text-sm text-fg-muted">
        {line.priceBasis === 'PER_KG' || line.weightKg !== null ? (
          <WeightDisplay kilograms={line.weightKg} notApplicableLabel={t('line.noWeight')} />
        ) : (
          quantityText(line.quantity, line.saleUom)
        )}
        {' · '}
        {t(`line.basis.${line.priceBasis}`, { price: '' })}
        <MoneyDisplay pesewas={line.agreedUnitPricePesewas} />
        {line.agreedUnitPricePesewas !== line.listUnitPricePesewas ? (
          <>
            {' · '}
            {t('line.listWas')} <MoneyDisplay pesewas={line.listUnitPricePesewas} />
          </>
        ) : null}
      </p>
      {problem !== null ? (
        <p className="text-sm font-semibold text-warning-fg">{t(`line.problem.${problem}`)}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onEdit} aria-label={t('line.editNamed', { name })}>
          <Pencil aria-hidden="true" />
          {t('line.edit')}
        </Button>
        <Button variant="ghost" onClick={onRemove} aria-label={t('line.removeNamed', { name })}>
          <Trash2 aria-hidden="true" />
          {t('line.remove')}
        </Button>
      </div>
    </li>
  );
}
