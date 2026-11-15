import { Slot } from '@radix-ui/react-slot';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/cn';

type StyleProps = {
  /** Shape as well as colour: an accent edge and tint, as a selected table row has. */
  selected?: boolean;
};

/**
 * An interactive card is a link or a button, so it must be `asChild`: a plain
 * div that looks clickable but cannot be reached by keyboard is not allowed.
 */
type Behaviour = { interactive?: false; asChild?: boolean } | { interactive: true; asChild: true };

export type CardProps = ComponentPropsWithRef<'div'> & StyleProps & Behaviour;

/** Card. A bordered surface. Pass `asChild` with a link or button to make the whole card the target. */
export function Card({
  className,
  selected = false,
  interactive = false,
  asChild = false,
  ...props
}: CardProps) {
  const Comp = asChild ? Slot : 'div';
  return (
    <Comp
      data-slot="card"
      data-selected={selected || undefined}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'block rounded-lg border border-border bg-surface text-fg shadow-sm',
        interactive && [
          'cursor-pointer transition-colors duration-fast',
          'hover-enabled:bg-surface-hover',
          'outline-focus outline-offset-2 focus-visible:outline-2',
        ],
        selected && 'edge-accent bg-accent-subtle hover-enabled:bg-accent-subtle',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1 px-cell pt-4 pb-2', className)}
      {...props}
    />
  );
}

/** Use `asChild` to pick the heading level: `<CardTitle asChild><h3>Goats</h3></CardTitle>`. */
export function CardTitle({
  className,
  asChild = false,
  ...props
}: ComponentPropsWithRef<'p'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'p';
  return (
    <Comp
      data-slot="card-title"
      className={cn('text-base font-semibold text-fg', className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="card-body"
      className={cn('px-cell py-2 text-sm text-fg', className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center gap-2 border-t border-border px-cell py-3', className)}
      {...props}
    />
  );
}
