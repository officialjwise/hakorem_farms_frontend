import {
  Beef,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Drumstick,
  Egg,
  Package,
  PawPrint,
  Tag,
  Wheat,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { IconChip, StatusBadge, type IconChipTone } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

type Product = components['schemas']['Product'];
type ProductStatus = Product['status'];

/** Each accounting group's icon and tint: what kind of thing a product is, at a glance. */
const GROUP = {
  LIVE_ANIMALS: { icon: PawPrint, tone: 'accent' },
  MEAT: { icon: Beef, tone: 'clay' },
  OFFAL: { icon: Drumstick, tone: 'plum' },
  PRODUCE_EGGS: { icon: Egg, tone: 'sand' },
  FEED_MEDICATION: { icon: Wheat, tone: 'good' },
  SUPPLIES: { icon: Package, tone: 'info' },
  SERVICE: { icon: Wrench, tone: 'violet' },
} as const satisfies Record<string, { icon: typeof Tag; tone: IconChipTone }>;
const OTHER = { icon: Tag, tone: 'slate' } as const;

/**
 * A product's picture: its thumbnail when it has one and it loads, otherwise an icon chip for its group
 * (the reference's row without an image). Decorative: the product's name sits beside it.
 */
export function ProductPicture({ product }: { product: Pick<Product, 'glGroup' | 'images'> }) {
  const thumb = product.images[0]?.variants.find((variant) => variant.variant === 'thumb');
  // A thumbnail that does not load (offline, a stale link) gives way to the chip, never a blank box.
  const [failed, setFailed] = useState(false);
  if (thumb !== undefined && !failed) {
    return (
      <img
        src={thumb.url}
        alt=""
        width={32}
        height={32}
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-8 shrink-0 rounded-md border border-border object-cover"
      />
    );
  }
  const look = lookup(GROUP, product.glGroup, OTHER);
  return <IconChip icon={look.icon} tone={look.tone} size="sm" />;
}

const BADGE = {
  ACTIVE: { tone: 'good', icon: CircleCheck },
  DRAFT: { tone: 'info', icon: CircleDashed },
  DISCONTINUED: { tone: 'slate', icon: CircleSlash },
} as const;

/** A product's status in words and an icon, never colour alone. */
export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { t } = useTranslation('catalogue');
  const { tone, icon } = lookup(BADGE, status, UNKNOWN);
  return (
    <StatusBadge
      tone={tone}
      icon={icon}
      label={t(`productStatus.${status}`, { defaultValue: status })}
    />
  );
}
