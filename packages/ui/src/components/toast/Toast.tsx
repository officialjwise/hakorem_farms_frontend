import * as ToastPrimitive from '@radix-ui/react-toast';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '../../lib/cn';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type ToastTone = 'good' | 'warning' | 'critical' | 'info';

/** What a screen passes to `useToast().show`. Every string is already translated. */
export interface ToastInput<T extends string = string> {
  tone: ToastTone;
  /** Required. A toast with no words would be colour alone. */
  title: NonEmpty<T>;
  description?: string;
  /** One follow-up action, for example "Undo" or "View receipt". */
  action?: { label: string; onAction: () => void };
  /**
   * Stays until dismissed. Critical and warning toasts are always persistent;
   * good and info dismiss after six seconds unless this is set.
   */
  persistent?: boolean;
}

export const TOAST_AUTO_DISMISS_MS = 6000;

const TONES: Record<
  ToastTone,
  { box: string; icon: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  good: { box: 'bg-good-subtle text-good-fg border-good', icon: 'stroke-good', Icon: CircleCheck },
  warning: {
    box: 'bg-warning-subtle text-warning-fg border-warning',
    icon: 'stroke-warning',
    Icon: TriangleAlert,
  },
  critical: {
    box: 'bg-critical-subtle text-critical-fg border-critical',
    icon: 'stroke-critical',
    Icon: CircleAlert,
  },
  info: { box: 'bg-info-subtle text-info-fg border-info', icon: 'stroke-info', Icon: Info },
};

export function toastDuration({ tone, persistent }: Pick<ToastInput, 'tone' | 'persistent'>) {
  return persistent === true || tone === 'critical' || tone === 'warning'
    ? Infinity
    : TOAST_AUTO_DISMISS_MS;
}

export interface ToastItemProps {
  toast: ToastInput;
  closeLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Toast. Rendered by UIProvider for each entry in its queue; screens raise one
 * with `useToast().show(...)` and never render this themselves (ADR 0010).
 *
 * A TOAST IS NEVER THE ONLY RECORD OF A FAILED MONEY OR STOCK OPERATION
 * (ADR 0006). It vanishes, a failed sale, payment, adjustment or transfer must
 * also leave persistent text on screen, such as an inline ErrorState or a
 * failed row that stays until dealt with.
 *
 * Critical toasts are announced assertively (Radix `foreground`); the rest are
 * polite. Tone is icon + words + colour, never colour alone.
 */
export function ToastItem({ toast, closeLabel, open, onOpenChange }: ToastItemProps) {
  if (toast.title.trim() === '') {
    throw new Error('Toast needs a non-empty title: colour must never carry state alone.');
  }
  const { box, icon, Icon } = TONES[toast.tone];
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      data-tone={toast.tone}
      type={toast.tone === 'critical' ? 'foreground' : 'background'}
      duration={toastDuration(toast)}
      open={open}
      onOpenChange={onOpenChange}
      className={cn(
        'flex items-start gap-3 rounded-lg border-2 p-3 text-control-md shadow-lg',
        box,
      )}
    >
      <Icon
        aria-hidden="true"
        focusable="false"
        strokeWidth={2.5}
        className={cn('mt-0.5 size-icon-md shrink-0', icon)}
      />
      <div className="grid min-w-0 flex-1 gap-1">
        <ToastPrimitive.Title className="font-semibold">{toast.title}</ToastPrimitive.Title>
        {toast.description ? (
          <ToastPrimitive.Description className="text-control-sm">
            {toast.description}
          </ToastPrimitive.Description>
        ) : null}
        {toast.action ? (
          <ToastPrimitive.Action
            altText={toast.action.label}
            onClick={toast.action.onAction}
            className="mt-1 w-fit rounded-sm px-1 font-semibold underline outline-focus outline-offset-2 focus-visible:outline-2"
          >
            {toast.action.label}
          </ToastPrimitive.Action>
        ) : null}
      </div>
      <ToastPrimitive.Close
        aria-label={closeLabel}
        className="inline-flex h-control-sm w-control-sm shrink-0 items-center justify-center rounded-md outline-focus outline-offset-2 hover-enabled:bg-surface-hover focus-visible:outline-2"
      >
        <X aria-hidden="true" className="size-icon-md" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}
