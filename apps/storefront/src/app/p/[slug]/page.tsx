import { Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CatchWeightNotice,
  MoneyDisplay,
  ProductPhoto,
  StatusBadge,
  WeightDisplay,
} from '@hakorem/ui';
import { AddToBasket } from '../../../components/AddToBasket';
import { AskTheShop } from '../../../components/AskTheShop';
import { LoadFailed } from '../../../components/LoadFailed';
import { PriceLine } from '../../../components/PriceLine';
import { getT, getWords } from '../../../i18n/server';
import { getShopCategories, getShopProduct, getShopProfile } from '../../../lib/api';
import { percentText, priceWords } from '../../../lib/present';
import { AVAILABILITY, categorySlug, tileFor, type ProductDetail } from '../../../lib/shop';

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * The metadata reads the product first, before the page streams: a crawler is answered a real 404 for a
 * slug that is not listed, and every product gets its own title, description and photograph to share.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getShopProduct(slug);
  if (!product.ok) {
    if (product.error.status === 404) notFound();
    return { robots: { index: false, follow: false } };
  }
  const p = product.data;
  const photo = p.images[0]?.variants.find((v) => v.variant === 'full') ?? p.images[0]?.variants[0];
  const title = p.seo.title ?? p.name;
  return {
    title: { absolute: title },
    description: p.seo.description ?? p.description ?? undefined,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: {
      type: 'website',
      title,
      description: p.seo.description ?? p.description ?? undefined,
      url: `/p/${p.slug}`,
      images:
        photo === undefined
          ? undefined
          : [
              {
                url: photo.fallbackUrl,
                width: photo.width,
                height: photo.height,
                alt: p.images[0]?.alt,
              },
            ],
    },
  };
}

/**
 * A product (FR-SHP-002): its photograph, name, price and what it buys, whether it can be bought, and for
 * a weighed item how it is charged, in a notice beside the price that cannot be missed. A live animal sold
 * by request says so instead of offering the basket, with the shop's phone and WhatsApp (CR-028). One
 * product read, shared with the metadata.
 */
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [t, product, categories, words] = await Promise.all([
    getT('storefront'),
    getShopProduct(slug),
    getShopCategories(),
    getWords('addToBasket', 'refusals'),
  ]);
  if (!product.ok) {
    if (product.error.status === 404) notFound();
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <LoadFailed
          error={product.error}
          title={t('product.error.title')}
          retryHref={`/p/${slug}`}
          t={t}
        />
      </div>
    );
  }
  const p = product.data;
  const tile = tileFor(p);
  const category = categories.ok
    ? categories.data.data.find((c) => c.name === p.categoryPath.at(-1))
    : undefined;
  const photo = p.images[0] ?? null;
  // Read only for a live animal sold by request, the one place this page gives the shop's numbers.
  const profile = p.onlineMode === 'REQUEST_TO_BUY' ? await getShopProfile() : null;
  const buyable =
    p.onlineMode === 'LISTED' && p.availability !== 'OUT_OF_STOCK' && p.priceFromPesewas !== null;
  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6">
      <nav aria-label={t('product.breadcrumb')} className="text-sm">
        <ol className="flex flex-wrap gap-1 text-fg-muted">
          <li>
            <Link href="/" className="text-accent-text underline underline-offset-4">
              {t('product.shop')}
            </Link>
            <span aria-hidden="true"> / </span>
          </li>
          {category === undefined ? null : (
            <li>
              <Link
                href={`/c/${categorySlug(category.code)}`}
                className="text-accent-text underline underline-offset-4"
              >
                {category.name}
              </Link>
              <span aria-hidden="true"> / </span>
            </li>
          )}
          <li aria-current="page">{p.name}</li>
        </ol>
      </nav>
      <article aria-labelledby="product-title" className="grid gap-6 md:grid-cols-2 md:items-start">
        <ProductPhoto
          photo={photo}
          placeholderIcon={tile.icon}
          placeholderLabel={p.name}
          tone={tile.tone}
          sizes="(min-width: 48rem) 36rem, 100vw"
          eager
          shape="wide"
          className="aspect-video rounded-2xl border border-border md:aspect-square"
        />
        <div className="grid gap-4">
          <div className="grid gap-2">
            <h1 id="product-title" className="text-3xl leading-tight font-bold text-balance">
              {p.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xl">
                <PriceLine item={p} words={priceWords(t, p)} size="page" />
              </p>
              <StatusBadge
                tone={AVAILABILITY[p.availability]}
                label={t(`availability.${p.availability}`)}
              />
            </div>
          </div>
          {p.catchWeight ? <Weighed p={p} t={t} /> : null}
          {profile !== null ? (
            <AskTheShop profile={profile} t={t} />
          ) : buyable ? (
            <AddToBasket
              productId={p.productId}
              unitPlural={t(`price.uomPlural.${p.saleUom}` as 'price.uomPlural.UNIT', {
                defaultValue: t('price.uomPlural.UNIT'),
              })}
              words={words}
            />
          ) : (
            <p className="font-medium text-fg-muted">{t('product.unavailable')}</p>
          )}
          <section aria-labelledby="about-title" className="grid gap-2">
            <h2 id="about-title" className="text-lg font-semibold">
              {t('product.about')}
            </h2>
            <p className="max-w-prose text-pretty">{p.description ?? t('product.noDescription')}</p>
          </section>
          <section
            aria-labelledby="delivery-title"
            className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <Truck aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 stroke-accent" />
            <div className="grid gap-1">
              <h2 id="delivery-title" className="font-semibold">
                {t('product.delivery.title')}
              </h2>
              <p className="text-fg-muted">{t('product.delivery.body')}</p>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}

/** A weighed item: the price per kg, what a unit weighs, how much more it can be, and the API's rule. */
function Weighed({
  p,
  t,
}: {
  p: ProductDetail;
  t: Awaited<ReturnType<typeof getT<'storefront'>>>;
}) {
  const unit = t(`price.unitTitle.${p.saleUom}` as 'price.unitTitle.PACK', {
    defaultValue: t('price.unitTitle.PACK'),
  });
  const facts = [
    ...(p.priceBasis === 'PER_KG' && p.priceFromPesewas !== null
      ? [
          {
            term: t('product.weighed.pricePerKg'),
            value: <MoneyDisplay pesewas={p.priceFromPesewas} />,
          },
        ]
      : []),
    ...(p.nominalPackKg === null
      ? []
      : [
          {
            term: t('product.weighed.unitWeighs', { unit }),
            value: <WeightDisplay kilograms={p.nominalPackKg} />,
          },
        ]),
    ...(p.weightTolerancePercent === null
      ? []
      : [
          {
            term: t('product.weighed.upTo'),
            value: t('product.weighed.upToValue', {
              percent: percentText(p.weightTolerancePercent),
            }),
          },
        ]),
  ];
  return (
    <CatchWeightNotice title={t('product.weighed.title')} facts={facts}>
      {p.finalChargeRule ?? t('product.weighed.rule')}
    </CatchWeightNotice>
  );
}
