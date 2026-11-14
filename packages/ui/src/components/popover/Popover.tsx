import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { usePortalContainer } from '../ui-provider/UIProvider';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type PopoverProps<L extends string = string> = {
  /** Radix's convention exactly (ADR 0004). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  /** The element that opens it, rendered with asChild. */
  trigger: ReactElement;
  /** Required. The accessible name of the popover content, already translated. */
  label: NonEmpty<L>;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'start' | 'end';
  align?: 'start' | 'center' | 'end';
  className?: string;
};

/** Radix sides are physical; map the logical ones so the popover flips in a right-to-left language. */
const SIDE = { top: 'top', bottom: 'bottom', start: 'left', end: 'right' } as const;

/**
 * Popover (ADR 0004). Interactive content anchored to a trigger, on Radix
 * Popover, portaled into the themed target. The content is a dialog named by
 * `label`; Radix owns focus in and focus return. Unlike a Tooltip it holds
 * things a touch user can reach.
 */
export function Popover<L extends string>({
  open,
  onOpenChange,
  defaultOpen,
  trigger,
  label,
  children,
  side = 'bottom',
  align = 'center',
  className,
}: PopoverProps<L>) {
  const container = usePortalContainer();
  if (label.trim() === '') throw new Error('Popover needs a non-empty label.');

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      {container ? (
        <PopoverPrimitive.Portal container={container}>
          <PopoverPrimitive.Content
            data-slot="popover"
            aria-label={label}
            side={SIDE[side]}
            align={align}
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              'z-popover max-w-[min(24rem,calc(100vw-1rem))] rounded-lg border border-border-strong bg-surface p-3 text-control-md text-fg shadow-md',
              'outline-focus outline-offset-2 focus-visible:outline-2',
              className,
            )}
          >
            {children}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      ) : null}
    </PopoverPrimitive.Root>
  );
}
