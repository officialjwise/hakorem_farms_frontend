import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { SEVERITY, severityRole, type Severity } from '../../lib/severity';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type AlertProps<T extends string = string> = {
  severity: Severity;
  /** Required. What happened, in words, already translated. */
  title: NonEmpty<T>;
  /** What it means or what to do next. */
  children?: ReactNode;
  /** Buttons or links that act on it, such as "Try again" or "View the transfer". */
  actions?: ReactNode;
  className?: string;
};

/**
 * Alert. Persistent words on the page: the pattern a failed money or stock operation must leave behind
 * (a toast alone fails review). Severity is shown three ways: words, icon shape and colour. Warning and
 * critical are announced at once (role="alert"); good and info politely (role="status").
 */
export function Alert<T extends string>({
  severity,
  title,
  children,
  actions,
  className,
}: AlertProps<T>) {
  if (title.trim() === '') {
    throw new Error('Alert needs a non-empty title: colour must never carry severity alone.');
  }
  const { box, icon, Icon } = SEVERITY[severity];
  return (
    <div
      data-slot="alert"
      data-severity={severity}
      role={severityRole(severity)}
      className={cn('flex gap-3 rounded-md border border-s-4 px-3 py-2.5', box, className)}
    >
      <Icon
        aria-hidden="true"
        focusable="false"
        strokeWidth={2.5}
        className={cn('mt-0.5 size-icon-md shrink-0', icon)}
      />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="font-semibold">{title}</p>
        {children === undefined ? null : <div className="text-sm">{children}</div>}
        {actions === undefined ? null : <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
      </div>
    </div>
  );
}
