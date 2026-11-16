import {
  Baby,
  Beef,
  CircleDollarSign,
  HeartCrack,
  HeartPulse,
  MoveRight,
  PackageCheck,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Skull,
  Syringe,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge, type BadgeTone, type IconChipTone } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

type S = components['schemas'];
type Look = { tone: BadgeTone };

const ANIMAL: Record<S['Animal']['status'], Look> = {
  ALIVE: { tone: 'good' },
  SOLD: { tone: 'info' },
  SLAUGHTERED: { tone: 'slate' },
  DEAD: { tone: 'critical' },
  CULLED: { tone: 'warning' },
};
const MORTALITY: Record<S['MortalityRecord']['status'], Look> = {
  REPORTED: { tone: 'info' },
  PENDING_APPROVAL: { tone: 'warning' },
  POSTED: { tone: 'good' },
  REJECTED: { tone: 'critical' },
  RETURNED: { tone: 'warning' },
};
const BREEDING: Record<S['BreedingRecord']['status'], Look> = {
  MATED: { tone: 'info' },
  CONFIRMED: { tone: 'warning' },
  BORN: { tone: 'good' },
  FAILED: { tone: 'slate' },
};

/** Alive, sold, slaughtered, dead or culled: in words, never colour alone. */
export function AnimalStatusBadge({ status }: { status: S['Animal']['status'] }) {
  const { t } = useTranslation('livestock');
  return (
    <StatusBadge
      tone={lookup(ANIMAL, status, UNKNOWN).tone}
      label={t(`animalStatus.${status}`, { defaultValue: status })}
    />
  );
}

/** Whether the counter may sell the animal now (the API's `sellable`), and why not when it is under withdrawal. */
export function SellableBadge({ animal }: { animal: Pick<S['Animal'], 'sellable' | 'status'> }) {
  const { t } = useTranslation('livestock');
  if (animal.status !== 'ALIVE') return null;
  return animal.sellable ? (
    <StatusBadge tone="good" label={t('animal.sellable')} />
  ) : (
    <StatusBadge tone="warning" label={t('animal.notSellable')} />
  );
}

export function MortalityStatusBadge({ status }: { status: S['MortalityRecord']['status'] }) {
  const { t } = useTranslation('livestock');
  return (
    <StatusBadge
      tone={lookup(MORTALITY, status, UNKNOWN).tone}
      label={t(`mortalityStatus.${status}`, { defaultValue: status })}
    />
  );
}

export function BreedingStatusBadge({ status }: { status: S['BreedingRecord']['status'] }) {
  const { t } = useTranslation('livestock');
  return (
    <StatusBadge
      tone={lookup(BREEDING, status, UNKNOWN).tone}
      label={t(`breedingStatus.${status}`, { defaultValue: status })}
    />
  );
}

/** Each kind of event in an animal's history: an icon and a tint that say which area it belongs to. */
export const EVENT_LOOK: Record<
  S['AnimalEvent']['kind'],
  { icon: LucideIcon; tone: IconChipTone }
> = {
  ACQUIRED: { icon: Truck, tone: 'info' },
  BORN: { icon: Baby, tone: 'good' },
  WEIGHED: { icon: Scale, tone: 'sand' },
  TREATED: { icon: Syringe, tone: 'warning' },
  VACCINATED: { icon: ShieldCheck, tone: 'good' },
  MOVED: { icon: MoveRight, tone: 'slate' },
  MATED: { icon: HeartPulse, tone: 'info' },
  GAVE_BIRTH: { icon: Baby, tone: 'good' },
  RESERVED: { icon: PackageCheck, tone: 'info' },
  SOLD: { icon: ShoppingBag, tone: 'good' },
  SLAUGHTERED: { icon: Beef, tone: 'slate' },
  DIED: { icon: HeartCrack, tone: 'critical' },
  CULLED: { icon: Skull, tone: 'warning' },
  COST_ADDED: { icon: CircleDollarSign, tone: 'sand' },
};
