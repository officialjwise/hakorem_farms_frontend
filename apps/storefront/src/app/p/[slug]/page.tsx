import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct } from '../../../lib/catalogue';

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The product detail route. No catalogue exists until F2 and F7, so every slug is unknown and the route
 * answers a real 404 (not a 200 that says "not found", which search engines treat as a soft 404). When the
 * product exists F7 fills this page: image variants with width and height, the price band, the catch-weight
 * note and add to cart.
 */
export default async function ProductPage({ params }: Props) {
  const product = await getProduct((await params).slug);
  if (product === null) notFound();
  return null;
}
