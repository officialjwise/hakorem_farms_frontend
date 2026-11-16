'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactElement } from 'react';
import { cn } from '../../lib/cn';

/**
 * The Radix half of Tooltip, loaded the first time a Tooltip mounts (ADR 0042). Each tooltip carries its
 * own provider with the house delays, since UIProvider no longer mounts one for every page.
 */
export function TooltipRadix({
  content,
  children,
  className,
  container,
}: {
  content: string;
  children: ReactElement;
  className: string | undefined;
  container: HTMLElement | null;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={200}>
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
    </TooltipPrimitive.Provider>
  );
}
