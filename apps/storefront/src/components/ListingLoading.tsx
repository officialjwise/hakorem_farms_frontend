import { ProductCardSkeleton, Skeleton } from '@hakorem/ui';

/** A listing while it loads: the title, the filters and eight cards in the grid's shape, announced once. */
export function ListingLoading({ label }: { label: string }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6">
      <Skeleton label={label} className="h-8 w-48" />
      <Skeleton shape="block" className="h-28" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
