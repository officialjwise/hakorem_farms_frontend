import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Field,
  Input,
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
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { ProductStatusBadge } from './presentation';

type Status = components['schemas']['Product']['status'];
const STATUSES: readonly Status[] = ['ACTIVE', 'DRAFT', 'DISCONTINUED'];
const COLUMNS = 6;

/** FR-MDM: the product catalogue, searched by name, SKU or barcode and filtered by status. */
export function ProductsScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [status, setStatus] = useState<Status | 'ALL'>('ALL');
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  // A list people browse and filter: `working` (DATA_CONVENTIONS).
  const products = useApiQuery(
    'listProducts',
    {
      query: {
        ...(status === 'ALL' ? {} : { status }),
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

  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('products.columns.name')}</TableHead>
        <TableHead>{t('products.columns.category')}</TableHead>
        <TableHead>{t('products.columns.policy')}</TableHead>
        <TableHead>{t('products.columns.sold')}</TableHead>
        <TableHead>{t('products.columns.online')}</TableHead>
        <TableHead>{t('products.columns.status')}</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <section aria-labelledby="products-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="products-title" className="text-2xl font-semibold">
          {t('products.title')}
        </h1>
        {auth.can('mdm.product.create') ? (
          <Button asChild>
            <Link to="/products/new">{t('products.new')}</Link>
          </Button>
        ) : null}
      </div>
      <form
        role="search"
        aria-label={t('products.search')}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setQ(typed.trim());
          pages.reset();
        }}
      >
        <Field
          label={t('products.searchLabel')}
          hint={t('products.searchHint')}
          className="min-w-0 grow sm:max-w-sm"
        >
          <Input type="search" value={typed} onChange={(event) => setTyped(event.target.value)} />
        </Field>
        <Button type="submit" variant="secondary">
          {t('products.searchButton')}
        </Button>
        <Field label={t('products.filterStatus')} className="w-full sm:w-48">
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
      </form>
      <QueryBoundary
        query={products}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('products.table')}>
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
            <TableContainer aria-label={t('products.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((product) => (
                    <TableRow key={product.id}>
                      <TableRowHeader>
                        <Link to={`/products/${product.id}`} className="text-accent-text underline">
                          {product.name}
                        </Link>
                        <span className="block text-control-sm text-fg-muted">
                          <code>{product.sku}</code>
                        </span>
                      </TableRowHeader>
                      <TableCell label={t('products.columns.category')}>
                        {product.category.name}
                      </TableCell>
                      <TableCell label={t('products.columns.policy')}>
                        {t(`policy.${product.stockPolicy}`)}
                      </TableCell>
                      <TableCell label={t('products.columns.sold')}>
                        {t('products.soldAs', { uom: product.saleUom })}
                      </TableCell>
                      <TableCell label={t('products.columns.online')}>
                        {t(`online.${product.onlineMode}`)}
                      </TableCell>
                      <TableCell label={t('products.columns.status')}>
                        <ProductStatusBadge status={product.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('products.pages')}
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
    </section>
  );
}
