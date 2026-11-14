'use client';

import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

export const avatarVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    'border border-border-strong bg-surface-sunken font-semibold text-fg select-none',
  ],
  {
    variants: {
      size: {
        sm: 'h-control-sm w-control-sm text-control-sm',
        md: 'h-control-md w-control-md text-control-md',
        lg: 'h-control-lg w-control-lg text-control-lg',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type AvatarProps<L extends string = string> = VariantProps<typeof avatarVariants> & {
  /** Required. The person's name: it is the accessible name, and the initials come from it. */
  name: NonEmpty<L>;
  src?: string;
  /** Milliseconds to wait before showing the initials while the image loads. Default: show at once. */
  fallbackDelay?: number;
  className?: string;
};

/**
 * Up to two initials: the first character of the first and last word.
 * Plain string code, so it cannot differ between runtimes. A single word gives
 * one initial.
 */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((w) => w !== '');
  const first = words[0];
  const last = words[words.length - 1];
  if (first === undefined || last === undefined) return '';
  const pick = (w: string) => Array.from(w)[0] ?? '';
  return words.length === 1 ? pick(first) : `${pick(first)}${pick(last)}`;
}

/** Avatar. A photo with a fallback to initials, named by the person's name. */
export function Avatar<L extends string>({
  name,
  src,
  size,
  fallbackDelay,
  className,
}: AvatarProps<L>) {
  if (name.trim() === '') {
    throw new Error('Avatar needs a non-empty name: it is the accessible name.');
  }
  return (
    <AvatarPrimitive.Root
      role="img"
      aria-label={name}
      data-slot="avatar"
      className={cn(avatarVariants({ size }), className)}
    >
      {src !== undefined ? (
        <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback aria-hidden="true" delayMs={fallbackDelay}>
        {initialsOf(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
