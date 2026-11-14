import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactElement } from 'react';
import { cn } from '../../lib/cn';
import { usePortalContainer } from '../ui-provider/UIProvider';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type TooltipProps<L extends string = string> = {
  /** Required. Short text, already translated. */
  content: NonEmpty<L>;
  /** The trigger, rendered with asChild. It must be focusable, so keyboard users see the tooltip too. */
  children: ReactElement;
  className?: string;
};

/**
 * Tooltip (ADR 0004). TOOLTIPS DO NOT EXIST ON TOUCH, AND THE POS IS TOUCH. A
 * tooltip is never the only route to a fact: the same information must also
 * live on screen as a visible label or hint. Use it for a shortcut or a
 * clarification, not for anything the operator needs.
 *
 * Needs the single Tooltip provider UIProvider already mounts (ADR 0006). It
 * is portaled into the themed target and opens on hover or keyboard focus.
 */
export function Tooltip<L extends string>({ content, children, className }: TooltipProps<L>) {
  const container = usePortalContainer();
  if (content.trim() === '') throw new Error('Tooltip needs non-empty content.');

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      {container ? (
        <TooltipPrimitive.Portal container={container}>
          <TooltipPrimitive.Content
            data-slot="tooltip"
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              'z-tooltip max-w-xs rounded-md border border-border-strong bg-surface px-2 py-1 text-control-sm font-medium text-fg shadow-md',
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      ) : null}
    </TooltipPrimitive.Root>
  );
}
