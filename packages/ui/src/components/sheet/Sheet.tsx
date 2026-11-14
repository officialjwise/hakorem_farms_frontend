'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';
import { usePortalContainer } from '../ui-provider/UIProvider';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/** Logical edges, so a sheet opens from the correct side in a right-to-left language. */
export type SheetSide = 'start' | 'end' | 'bottom';

export const sheetVariants = cva(
  ['fixed z-modal flex flex-col bg-surface text-fg shadow-lg', 'border-border-strong'],
  {
    variants: {
      side: {
        start: 'inset-y-0 start-0 w-[min(24rem,100%)] border-e',
        end: 'inset-y-0 end-0 w-[min(24rem,100%)] border-s',
        bottom: 'inset-x-0 bottom-0 max-h-[90%] rounded-t-lg border-t',
      },
    },
  },
);

export type SheetProps<T extends string = string, C extends string = string> = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  trigger?: ReactElement;
  side: SheetSide;
  /** Required. The sheet's accessible name, already translated. */
  title: NonEmpty<T>;
  description?: string;
  /** Required. The accessible name of the close button. */
  closeLabel: NonEmpty<C>;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Sheet (ADR 0004). A panel that slides from an edge, on the same Radix Dialog
 * primitive as Dialog, so focus trapping and return are Radix's. It does not
 * animate. A failed action must leave persistent text inside the sheet, never
 * only a toast (ADR 0006).
 */
export function Sheet<T extends string, C extends string>({
  open,
  onOpenChange,
  defaultOpen,
  trigger,
  side,
  title,
  description,
  closeLabel,
  children,
  footer,
  className,
}: SheetProps<T, C>) {
  const container = usePortalContainer();
  if (title.trim() === '') throw new Error('Sheet needs a non-empty title.');
  if (closeLabel.trim() === '') throw new Error('Sheet needs a non-empty closeLabel.');

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      {container ? (
        <DialogPrimitive.Portal container={container}>
          <DialogPrimitive.Overlay
            data-slot="sheet-overlay"
            className="fixed inset-0 z-overlay bg-scrim"
          />
          <DialogPrimitive.Content
            data-slot="sheet"
            data-side={side}
            {...(description ? {} : { 'aria-describedby': undefined })}
            className={cn(sheetVariants({ side }), className)}
          >
            <div className="flex items-start gap-3 p-4 pb-2">
              <div className="grid min-w-0 flex-1 gap-1">
                <DialogPrimitive.Title className="text-lg font-semibold text-balance">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="text-control-sm text-fg-muted">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="sm" iconOnly aria-label={closeLabel}>
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
            {children ? (
              <div className="min-h-0 flex-1 overflow-auto px-4 py-2">{children}</div>
            ) : null}
            {footer ? (
              <div className="flex flex-wrap justify-end gap-2 p-4 pt-2">{footer}</div>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}
