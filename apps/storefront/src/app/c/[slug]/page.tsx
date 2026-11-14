import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, EmptyState } from '@hakorem/ui';
import { getT } from '../../../i18n/server';
import { CATEGORIES, getCategory } from '../../../lib/catalogue';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return CATEGORIES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = getCategory((await params).slug);
  if (category === undefined) return {};
  const t = await getT('storefront');
  const name = t(`categories.${category.key}`);
  return {
    title: name,
    description: t('meta.categoryDescription', { category: name }),
    alternates: { canonical: `/c/${category.slug}` },
    openGraph: { title: name, url: `/c/${category.slug}` },
  };
}

/**
 * A category listing. The products arrive with the catalogue (F2 client, F7 screens), so today the page is
 * its empty state. Its loading and error states are loading.tsx and error.tsx beside it. A public page has
 * no permission-denied state: there is nothing to deny.
 */
export default async function CategoryPage({ params }: Props) {
  const category = getCategory((await params).slug);
  if (category === undefined) notFound();
  const t = await getT('storefront');
  return (
    <section aria-labelledby="category-title" className="grid gap-4">
      <h1 id="category-title" className="text-3xl font-semibold">
        {t('category.title', { category: t(`categories.${category.key}`) })}
      </h1>
      <EmptyState
        title={t('category.empty.title')}
        description={t('category.empty.body')}
        action={
          <Button asChild variant="secondary">
            <Link href="/">{t('category.back')}</Link>
          </Button>
        }
      />
    </section>
  );
}
