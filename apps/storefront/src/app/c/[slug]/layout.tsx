import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getShopCategories } from '../../../lib/api';
import { categoryBySlug } from '../../../lib/shop';

/**
 * The category is looked up here, above the page's loading boundary, so an unknown one is a real 404
 * (ADR 0015's known limit, closed in F7). The read is the header's own, shared for the request, so it
 * costs nothing more. If the categories cannot be read, the page says so in its error state instead.
 */
export default async function CategoryLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: ReactNode;
}) {
  const [{ slug }, categories] = await Promise.all([params, getShopCategories()]);
  if (categories.ok && categoryBySlug(categories.data.data, slug) === undefined) notFound();
  return children;
}
