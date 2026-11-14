import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, CardTitle } from '@hakorem/ui';
import { getT } from '../i18n/server';
import { CATEGORIES } from '../lib/catalogue';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('storefront');
  return { title: { absolute: t('meta.title') }, alternates: { canonical: '/' } };
}

export default async function HomePage() {
  const t = await getT('storefront');
  return (
    <section aria-labelledby="home-title" className="grid gap-6">
      <div className="grid gap-2">
        <h1 id="home-title" className="text-3xl font-semibold text-balance">
          {t('home.title')}
        </h1>
        <p className="max-w-prose text-fg-muted">{t('home.body')}</p>
      </div>
      <div className="grid gap-3">
        <h2 className="text-xl font-semibold">{t('home.browse')}</h2>
        <ul className="grid grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-3">
          {CATEGORIES.map(({ slug, key }) => (
            <li key={slug}>
              <Card interactive asChild>
                <Link href={`/c/${slug}`}>
                  <CardBody>
                    <CardTitle>{t(`categories.${key}`)}</CardTitle>
                  </CardBody>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
