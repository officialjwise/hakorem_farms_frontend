import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Field,
  FilterMenu,
  Select,
  ToolbarSearch,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ProductPicture, ProductStatusBadge } from './presentation';

type Product = components['schemas']['Product'];
type Status = Product['status'];
type Policy = Product['stockPolicy'];
const STATUSES: readonly Status[] = ['ACTIVE', 'DRAFT', 'DISCONTINUED'];
const POLICIES: readonly Policy[] = ['SERIALISED', 'CATCH_WEIGHT', 'COUNTABLE', 'NON_STOCK'];

/** FR-MDM: the product catalogue, searched by name or SKU and filtered by status and stock policy. */
export function ProductsScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [status, setStatus] = useState<Status | 'ALL'>('ALL');
  const [policy, setPolicy] = useState<Policy | 'ALL'>('ALL');
  // The header's search lands here with `?q=`; a new search from the header replaces the current one.
  const [params] = useSearchParams();
  const fromHeader = params.get('q') ?? '';
  const [typed, setTyped] = useState(fromHeader);
  const [q, setQ] = useState(fromHeader);
  const [seen, setSeen] = useState(fromHeader);
  if (seen !== fromHeader) {
    setSeen(fromHeader);
    setTyped(fromHeader);
    setQ(fromHeader);
    pages.reset();
  }
  // A list people browse and filter: `working` (DATA_CONVENTIONS).
  const products = useApiQuery(
    'listProducts',
    {
      query: {
        ...(status === 'ALL' ? {} : { status }),
        ...(policy === 'ALL' ? {} : { stockPolicy: policy }),
        ...(q === '' ? {} : { q }),
        ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
      },
    },
    { staleClass: 'working' },
  );
  const labels = useStateLabels({
    loading: t('products.loading'),
    emptyTitle: t('products.empty'),
    emptyDescription: t('products.emptyBody'),
    errorTitle: t('products.error'),
    deniedTitle: t('products.denied'),
  });
  const columns: TableColumn<Product>[] = [
    {
      id: 'name',
      rowHeader: true,
      head: t('products.columns.name'),
      sortValue: (product) => product.name,
      cell: (product) => (
        <span className="flex items-center gap-3">
          <ProductPicture product={product} />
          <span className="grid min-w-0">
            <Link to={`/products/${product.id}`} className="text-accent-text hover:underline">
              {product.name}
            </Link>
            <code className="text-control-sm font-normal text-fg-muted">{product.sku}</code>
          </span>
        </span>
      ),
    },
    {
      id: 'category',
      head: t('products.columns.category'),
      sortValue: (product) => product.category.name,
      cell: (product) => product.category.name,
    },
    {
      id: 'policy',
      head: t('products.columns.policy'),
      sortValue: (product) => t(`policy.${product.stockPolicy}`),
      cell: (product) => t(`policy.${product.stockPolicy}`),
    },
    {
      id: 'sold',
      head: t('products.columns.sold'),
      sortValue: (product) => product.saleUom,
      cell: (product) => t('products.soldAs', { uom: product.saleUom }),
    },
    {
      id: 'online',
      head: t('products.columns.online'),
      sortValue: (product) => t(`online.${product.onlineMode}`),
      cell: (product) => t(`online.${product.onlineMode}`),
    },
    {
      id: 'status',
      head: t('products.columns.status'),
      sortValue: (product) => product.status,
      cell: (product) => <ProductStatusBadge status={product.status} />,
    },
  ];
  const view = useTableView(columns);
  const active = (status === 'ALL' ? 0 : 1) + (policy === 'ALL' ? 0 : 1);

  return (
    <section aria-labelledby="products-title" className="grid gap-4">
      <PageHeader
        title={t('products.title')}
        titleId="products-title"
        actions={
          auth.can('mdm.product.create') ? (
            <Button asChild>
              <Link to="/products/new">{t('products.new')}</Link>
            </Button>
          ) : undefined
        }
      />
      <TableCard
        view={view}
        query={products}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(product) => product.id}
        tableLabel={t('products.table')}
        exportName={t('products.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('products.pages') }}
        toolbar={
          <>
            <ToolbarSearch
              label={t('products.searchLabel')}
              placeholder={t('products.searchPlaceholder')}
              value={typed}
              onValueChange={setTyped}
              onSubmit={(value) => {
                setQ(value);
                pages.reset();
              }}
            />
            <FilterMenu
              label={t('common:table.filter')}
              active={active}
              reset={{
                label: t('common:table.resetFilters'),
                onReset: () => {
                  setStatus('ALL');
                  setPolicy('ALL');
                  pages.reset();
                },
              }}
            >
              <Field label={t('products.filterStatus')}>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(STATUSES.find((s) => s === value) ?? 'ALL');
                    pages.reset();
                  }}
                  options={[
                    { value: 'ALL', label: t('products.allStatuses') },
                    ...STATUSES.map((s) => ({ value: s, label: t(`productStatus.${s}`) })),
                  ]}
                />
              </Field>
              <Field label={t('products.filterPolicy')}>
                <Select
                  value={policy}
                  onValueChange={(value) => {
                    setPolicy(POLICIES.find((p) => p === value) ?? 'ALL');
                    pages.reset();
                  }}
                  options={[
                    { value: 'ALL', label: t('products.allPolicies') },
                    ...POLICIES.map((p) => ({ value: p, label: t(`policy.${p}`) })),
                  ]}
                />
              </Field>
            </FilterMenu>
          </>
        }
      />
    </section>
  );
}
