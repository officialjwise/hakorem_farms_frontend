/**
 * THROWAWAY. The F2 gate proof: a products list read through the generated client and the data layer,
 * from the Prism mock, showing the four states on demand. It is deleted before F2 closes, and is not a
 * screen anyone builds on. The real products screen is F4.
 */
import type { ApiHooks } from '@hakorem/data';
import {
  QueryBoundary,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  type QueryBoundaryLabels,
} from '@hakorem/ui';

export const labels: QueryBoundaryLabels = {
  loading: 'Loading products',
  emptyTitle: 'No products yet',
  emptyDescription: 'Products you add will be listed here.',
  errorTitle: 'Products could not be loaded',
  errorDescription: 'Check the connection and try again.',
  retry: 'Try again',
  reference: 'Quote this reference to support:',
  deniedTitle: 'You do not have access to products',
  deniedDescription: 'Ask the owner to add the product permission to your role.',
};

export function ProductsGate({
  hooks,
  showEmpty = false,
}: {
  hooks: ApiHooks;
  /** Prism cannot return an empty list from this contract, so empty is shown from a success with no rows. */
  showEmpty?: boolean;
}) {
  const result = hooks.useApiQuery('listProducts', { query: { limit: 5 } });
  const query =
    showEmpty && result.data !== undefined
      ? {
          status: 'success' as const,
          data: { ...result.data, data: [] },
          error: null,
          refetch: result.refetch,
        }
      : result;

  return (
    <QueryBoundary
      query={query}
      labels={labels}
      isEmpty={(page) => page.data.length === 0}
      loadingFallback={
        <TableContainer aria-label="Products">
          <Table>
            <TableBody>
              <TableLoadingRows columns={3} label={labels.loading} />
            </TableBody>
          </Table>
        </TableContainer>
      }
    >
      {(page) => (
        <TableContainer aria-label="Products">
          <Table>
            <TableCaption visuallyHidden>Products</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Stock policy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.data.map((product) => (
                <TableRow key={product.id}>
                  <TableCell label="Name">{product.name}</TableCell>
                  <TableCell label="SKU">{product.sku}</TableCell>
                  <TableCell label="Stock policy">{product.stockPolicy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </QueryBoundary>
  );
}
