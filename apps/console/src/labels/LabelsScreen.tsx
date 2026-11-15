import { Minus, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Barcode,
  Button,
  Field,
  Input,
  isCode128B,
  PageHeader,
  QueryBoundary,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  WeightDisplay,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { useStateLabels } from '../lib/states';

type Product = components['schemas']['Product'];
type StockUnit = components['schemas']['StockUnit'];

/** One label to print: what it says, the code its barcode carries, and how many copies. */
interface LabelItem {
  key: string;
  kind: 'product' | 'lot';
  title: string;
  code: string;
  lines: { label: string; value: ReactNode }[];
  copies: number;
}

const MAX_COPIES = 50;

/**
 * Labels for products and lots, with Code 128 barcodes the POS scanner and the cold room read (FR-PRC
 * label and barcode generation; F5b). Until CR-016 gives a server-rendered label, the labels are drawn
 * here from the API's own fields (Product.barcode or SKU, StockUnit.identifier) and printed with the
 * browser; nothing is written to the API. Pack labels from a processing order stay with F6's
 * `printPackLabels`.
 */
export function LabelsScreen() {
  const { t } = useTranslation(['labels', 'common']);
  const auth = useAuth();
  const [items, setItems] = useState<LabelItem[]>([]);
  const add = (item: Omit<LabelItem, 'copies'>) =>
    setItems((current) =>
      current.some((existing) => existing.key === item.key)
        ? current.map((existing) =>
            existing.key === item.key
              ? { ...existing, copies: Math.min(MAX_COPIES, existing.copies + 1) }
              : existing,
          )
        : [...current, { ...item, copies: 1 }],
    );
  const setCopies = (key: string, copies: number) =>
    setItems((current) =>
      current
        .map((item) => (item.key === key ? { ...item, copies } : item))
        .filter((item) => item.copies > 0),
    );
  const sheet = items.flatMap((item) =>
    Array.from({ length: item.copies }, (_, copy) => ({ ...item, copy })),
  );

  return (
    <section aria-labelledby="labels-title" className="grid gap-4">
      <div className="print:hidden">
        <PageHeader
          title={t('title')}
          titleId="labels-title"
          description={t('description')}
          actions={
            <Button onClick={() => window.print()} disabled={sheet.length === 0}>
              <Printer aria-hidden="true" />
              {t('print', { count: sheet.length })}
            </Button>
          }
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] print:block">
        <div className="grid content-start gap-4 print:hidden">
          <Tabs defaultValue="product">
            <TabsList aria-label={t('choose')}>
              <TabsTrigger value="product">{t('tabs.product')}</TabsTrigger>
              {auth.can('inv.stock.read') ? (
                <TabsTrigger value="lot">{t('tabs.lot')}</TabsTrigger>
              ) : null}
            </TabsList>
            <TabsContent value="product">
              <ProductPicker onAdd={add} />
            </TabsContent>
            {auth.can('inv.stock.read') ? (
              <TabsContent value="lot">
                <LotPicker onAdd={add} />
              </TabsContent>
            ) : null}
          </Tabs>
          <section aria-labelledby="chosen-title" className="grid gap-2">
            <h2 id="chosen-title" className="text-lg font-semibold">
              {t('chosen.title')}
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-fg-muted">{t('chosen.none')}</p>
            ) : (
              <ul className="grid gap-2">
                {items.map((item) => (
                  <li
                    key={item.key}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-2"
                  >
                    <span className="grid min-w-0 flex-1">
                      <span className="font-semibold break-words">{item.title}</span>
                      <code className="text-control-sm text-fg-muted">{item.code}</code>
                    </span>
                    <span className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        iconOnly
                        aria-label={t('chosen.fewer', { name: item.title })}
                        onClick={() => setCopies(item.key, item.copies - 1)}
                      >
                        <Minus />
                      </Button>
                      <span
                        aria-live="polite"
                        className="min-w-16 text-center text-sm tabular-nums"
                      >
                        {t('chosen.copies', { count: item.copies })}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        iconOnly
                        disabled={item.copies >= MAX_COPIES}
                        aria-label={t('chosen.more', { name: item.title })}
                        onClick={() => setCopies(item.key, item.copies + 1)}
                      >
                        <Plus />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        aria-label={t('chosen.remove', { name: item.title })}
                        onClick={() => setCopies(item.key, 0)}
                      >
                        <Trash2 />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <section aria-labelledby="sheet-title" className="grid content-start gap-2">
          <h2 id="sheet-title" className="text-lg font-semibold print:sr-only">
            {t('sheet.title')}
          </h2>
          {sheet.length === 0 ? (
            <p className="text-sm text-fg-muted print:hidden">{t('sheet.none')}</p>
          ) : (
            // Labels are always drawn light, dark bars on a light ground, so they scan on screen and on paper.
            <ul
              data-theme="light"
              aria-label={t('sheet.title')}
              className="grid grid-cols-1 gap-2 rounded-md bg-surface-sunken p-2 sm:grid-cols-2 print:grid-cols-3 print:bg-surface print:p-0"
            >
              {sheet.map((label) => (
                <li
                  key={`${label.key}-${label.copy}`}
                  className="grid break-inside-avoid justify-items-center gap-1 rounded-md border border-border-strong bg-surface p-3 text-center text-fg"
                >
                  <span className="font-semibold break-words">{label.title}</span>
                  {isCode128B(label.code) ? (
                    <Barcode
                      value={label.code}
                      label={label.kind === 'lot' ? t('barcode.lot') : t('barcode.product')}
                    />
                  ) : (
                    <Alert severity="warning" title={t('barcode.cannot', { code: label.code })} />
                  )}
                  <dl className="grid w-full grid-cols-[auto_1fr] gap-x-2 text-start text-xs">
                    {label.lines.map((line) => (
                      <div key={line.label} className="contents">
                        <dt className="text-fg-muted">{line.label}</dt>
                        <dd>{line.value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

function SearchBox({ label, onSearch }: { label: string; onSearch: (q: string) => void }) {
  const { t } = useTranslation('labels');
  const [typed, setTyped] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(typed.trim());
  };
  return (
    <form role="search" aria-label={label} onSubmit={submit} className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <Field label={label}>
          <Input type="search" value={typed} onChange={(event) => setTyped(event.target.value)} />
        </Field>
      </div>
      <Button type="submit" variant="secondary">
        <Search aria-hidden="true" />
        {t('search')}
      </Button>
    </form>
  );
}

function ResultRow({
  title,
  code,
  detail,
  addLabel,
  addText,
  onAdd,
}: {
  title: string;
  code: string;
  detail?: string;
  addLabel: string;
  addText: string;
  onAdd: () => void;
}) {
  return (
    <li className="flex items-center gap-2 border-b border-border py-2">
      <span className="grid min-w-0 flex-1">
        <span className="break-words">{title}</span>
        <span className="text-control-sm text-fg-muted">
          <code>{code}</code>
          {detail === undefined ? null : ` · ${detail}`}
        </span>
      </span>
      <Button size="sm" variant="secondary" onClick={onAdd} aria-label={addLabel}>
        <Plus aria-hidden="true" />
        <span className="hidden sm:inline">{addText}</span>
      </Button>
    </li>
  );
}

function ProductPicker({ onAdd }: { onAdd: (item: Omit<LabelItem, 'copies'>) => void }) {
  const { t } = useTranslation(['labels', 'common']);
  const [q, setQ] = useState('');
  // A list people browse: `working`.
  const products = useApiQuery(
    'listProducts',
    { query: { status: 'ACTIVE', ...(q === '' ? {} : { q }) } },
    { staleClass: 'working' },
  );
  const labels = useStateLabels({
    loading: t('products.loading'),
    emptyTitle: t('products.empty'),
    errorTitle: t('products.error'),
    deniedTitle: t('products.denied'),
  });
  const item = (product: Product): Omit<LabelItem, 'copies'> => ({
    key: `product-${product.id}`,
    kind: 'product',
    title: product.name,
    // The product's own barcode when it has one, otherwise its SKU: both are the API's fields.
    code: product.barcode ?? product.sku,
    lines: [
      { label: t('fields.sku'), value: product.sku },
      { label: t('fields.soldBy'), value: product.saleUom },
    ],
  });
  return (
    <div className="grid gap-2 pt-3">
      <SearchBox label={t('products.search')} onSearch={setQ} />
      <QueryBoundary
        query={products}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={<Skeleton label={labels.loading} />}
      >
        {(page) => (
          <ul aria-label={t('products.results')}>
            {page.data.map((product) => (
              <ResultRow
                key={product.id}
                title={product.name}
                code={product.barcode ?? product.sku}
                addLabel={t('add', { name: product.name })}
                addText={t('addShort')}
                onAdd={() => onAdd(item(product))}
              />
            ))}
          </ul>
        )}
      </QueryBoundary>
    </div>
  );
}

function LotPicker({ onAdd }: { onAdd: (item: Omit<LabelItem, 'copies'>) => void }) {
  const { t } = useTranslation(['labels', 'common']);
  const [q, setQ] = useState('');
  // Lots on hand are acted on: `live`.
  const lots = useApiQuery('listStockUnits', { query: q === '' ? {} : { q } });
  const labels = useStateLabels({
    loading: t('lots.loading'),
    emptyTitle: t('lots.empty'),
    errorTitle: t('lots.error'),
    deniedTitle: t('lots.denied'),
  });
  const item = (lot: StockUnit): Omit<LabelItem, 'copies'> => ({
    key: `lot-${lot.id}`,
    kind: 'lot',
    title: lot.product.name,
    code: lot.identifier,
    lines: [
      ...(lot.producedOn === null ? [] : [{ label: t('fields.produced'), value: lot.producedOn }]),
      ...(lot.expiresOn === null ? [] : [{ label: t('fields.expires'), value: lot.expiresOn }]),
      ...(lot.storageTempClass === null
        ? []
        : [
            {
              label: t('fields.keep'),
              value: t(`temp.${lot.storageTempClass}`, { defaultValue: lot.storageTempClass }),
            },
          ]),
      ...(lot.lastWeightKg === null
        ? []
        : [{ label: t('fields.weight'), value: <WeightDisplay kilograms={lot.lastWeightKg} /> }]),
    ],
  });
  return (
    <div className="grid gap-2 pt-3">
      <SearchBox label={t('lots.search')} onSearch={setQ} />
      <QueryBoundary
        query={lots}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={<Skeleton label={labels.loading} />}
      >
        {(page) => (
          <ul aria-label={t('lots.results')}>
            {page.data.map((lot) => (
              <ResultRow
                key={lot.id}
                title={lot.product.name}
                code={lot.identifier}
                detail={lot.currentLocation?.name}
                addLabel={t('add', { name: `${lot.product.name} ${lot.identifier}` })}
                addText={t('addShort')}
                onAdd={() => onAdd(item(lot))}
              />
            ))}
          </ul>
        )}
      </QueryBoundary>
    </div>
  );
}
