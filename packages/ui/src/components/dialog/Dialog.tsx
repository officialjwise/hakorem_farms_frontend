'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentType, ReactElement, ReactNode, SVGProps } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';
import { IconChip, type IconChipTone } from '../icon-chip/IconChip';
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
  /** Buttons for the action row: DialogActions. A failed action also puts words in `children`, so it persists (ADR 0006). */
  footer?: ReactNode;
  /** A decorative icon on a tinted chip beside the title, as the reference's modals carry. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  iconTone?: IconChipTone;
  /**
   * What the red asterisk means, for a dialog whose fields use `requiredMark="asterisk"`, for example
   * "Required field". Shown once under the title, after an asterisk.
   */
  requiredNote?: string;
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
  icon,
  iconTone,
  requiredNote,
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
              'rounded-xl border border-border bg-surface text-fg shadow-lg',
              className,
            )}
          >
            <div className="flex items-start gap-3 px-5 pt-5 pb-3">
              {icon === undefined ? null : <IconChip icon={icon} tone={iconTone} />}
              <div className="grid min-w-0 flex-1 gap-1">
                <DialogPrimitive.Title className="text-xl font-bold text-balance">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="text-control-sm text-fg-muted">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
                {requiredNote === undefined ? null : (
                  <p className="text-control-sm text-fg-muted">
                    <span aria-hidden="true" className="me-1 text-critical-fg">
                      *
                    </span>
                    {requiredNote}
                  </p>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  iconOnly
                  aria-label={closeLabel}
                  className="bg-surface-sunken"
                >
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
            {children ? (
              <div className="min-h-0 overflow-auto px-5 pt-2 pb-5">{children}</div>
            ) : null}
            {footer ? <div className="px-5 pb-4">{footer}</div> : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}

export interface DialogActionsProps {
  /** Cancel's words, for example "Cancel". It closes the dialog with its X icon, on the left. */
  cancelLabel: string;
  onCancel: () => void;
  /** The primary action (and any second action), on the right, each with its icon. */
  children: ReactNode;
  className?: string;
}

/**
 * DialogActions (ADR 0036). The reference's modal footer: a rule across the dialog, Cancel on the left with
 * its icon, the primary action on the right. Put it last in the dialog's body (inside a form, so the
 * primary can submit) or in Dialog's `footer`.
 */
export function DialogActions({ cancelLabel, onCancel, children, className }: DialogActionsProps) {
  return (
    <div
      data-slot="dialog-actions"
      className={cn(
        '-mx-5 mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 pt-4',
        className,
      )}
    >
      <Button type="button" variant="secondary" onClick={onCancel}>
        <X aria-hidden="true" />
        {cancelLabel}
      </Button>
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}
