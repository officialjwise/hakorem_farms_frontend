import { ArrowRight, Beef, Egg, PawPrint } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@hakorem/ui';
import type { ShopT } from '../lib/present';

/**
 * The home page's opening (ADR 0040): words on the deeper sand band, so the largest paint is text that
 * arrives with the HTML, and three tiles in the farm's tints for what it sells. No photograph to wait for
 * and no web font. The brand's loud print colours are not used until their values arrive (A-F0-01).
 */
export function Hero({ t }: { t: ShopT }) {
  const tiles = [
    { icon: Beef, tile: 'bg-clay-subtle', stroke: 'stroke-clay' },
    { icon: Egg, tile: 'bg-warning-subtle', stroke: 'stroke-series-2' },
    { icon: PawPrint, tile: 'bg-good-subtle', stroke: 'stroke-good' },
  ];
  return (
    <section aria-labelledby="hero-title" className="bg-shop-band">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-8 md:grid-cols-[3fr_2fr] md:py-12">
        <div className="grid gap-4">
          <p className="text-sm font-semibold tracking-wide text-accent-text uppercase">
            {t('home.eyebrow')}
          </p>
          <h1 id="hero-title" className="text-3xl leading-tight font-bold text-balance md:text-5xl">
            {t('home.title')}
          </h1>
          <p className="max-w-prose text-lg text-fg-muted">{t('home.body')}</p>
          <div>
            <Button asChild size="lg">
              <Link href="/search">
                {t('home.shopAll')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
        <ul aria-hidden="true" className="grid grid-cols-3 gap-3">
          {tiles.map(({ icon: Icon, tile, stroke }, index) => (
            <li
              key={tile}
              className={`grid aspect-square place-items-center rounded-2xl shadow-sm ${tile} ${index === 1 ? 'md:-translate-y-4' : ''}`}
            >
              <Icon strokeWidth={1.25} className={`size-1/2 ${stroke}`} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
