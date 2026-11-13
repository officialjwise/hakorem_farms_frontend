import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';
import { usePortalContainer } from '../ui-provider/UIProvider';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type DialogProps<T extends string = string, C extends string = string> = {
  /** Radix's convention exactly (ADR 0004): controlled with `open` + `onOpenChange`, or uncontrolled with `defaultOpen`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  /** The element that opens the dialog, rendered with asChild so it keeps its own semantics. */
  trigger?: ReactElement;
  /** Required. The dialog's accessible name, already translated. */
  title: NonEmpty<T>;
  /** When absent the dialog carries no description, rather than a dangling reference. */
  description?: string;
  /** Required. The accessible name of the close button, for example "Close". */
  closeLabel: NonEmpty<C>;
  children?: ReactNode;
  /** Buttons for the action row. A failed action also puts words in `children`, so it persists (ADR 0006). */
  footer?: ReactNode;
  className?: string;
};

/**
 * Dialog (ADR 0004). A modal on Radix Dialog, portaled into the themed target
 * from UIProvider so it carries the app's theme and density. Radix owns the
 * focus trap and focus return: focus moves in on open and goes back to the
 * trigger on close. Nothing here overrides either.
 *
 * Before the portal target mounts it renders nothing, because Radix treats a
 * null container as <body>, which is unthemed.
 *
 * A failed action must leave persistent text inside the dialog (a role="alert"
 * message in `children`), never only a toast.
 */
export function Dialog<T extends string, C extends string>({
  open,
  onOpenChange,
  defaultOpen,
  trigger,
  title,
  description,
  closeLabel,
  children,
  footer,
  className,
}: DialogProps<T, C>) {
  const container = usePortalContainer();
  if (title.trim() === '') throw new Error('Dialog needs a non-empty title.');
  if (closeLabel.trim() === '') throw new Error('Dialog needs a non-empty closeLabel.');

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      {container ? (
        <DialogPrimitive.Portal container={container}>
          <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className="fixed inset-0 z-overlay bg-scrim"
          />
          <DialogPrimitive.Content
            data-slot="dialog"
            {...(description ? {} : { 'aria-describedby': undefined })}
            className={cn(
              'fixed inset-0 z-modal m-auto flex h-fit max-h-[calc(100%-2rem)] w-[min(32rem,calc(100%-2rem))] flex-col',
              'rounded-lg border border-border-strong bg-surface text-fg shadow-lg',
              className,
            )}
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
            {children ? <div className="min-h-0 overflow-auto px-4 py-2">{children}</div> : null}
            {footer ? (
              <div className="flex flex-wrap justify-end gap-2 p-4 pt-2">{footer}</div>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}
