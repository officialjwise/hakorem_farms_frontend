'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type CopyIdProps<V extends string = string, L extends string = string> = {
  /** Required. The readable id, shown in full: a SKU, a public id (`cus_…`, `sup_…`) or a document number. */
  value: NonEmpty<V>;
  /** Required, already translated: the copy button's name, for example "Copy cus_8F3K2M9Q7X4T1V6B". */
  copyLabel: NonEmpty<L>;
  /** Already translated: said once the id is on the clipboard, for example "Copied". */
  copiedLabel: string;
  /** Already translated: said when the browser refuses the clipboard, for example "Could not copy: select it". */
  failedLabel: string;
  className?: string;
  /** Not accepted: value is the only content. */
  children?: never;
};

type Outcome = 'idle' | 'copied' | 'failed';

/** How long "Copied" stays before the button reads as it did. */
const SAID_MS = 2000;

/**
 * CopyId. A readable id in the monospace face, wrapping anywhere so it fits at 360 px, with a button that
 * copies it (owner, 2026-11-17: every id gets a copy button). What happened is said in words beside it.
 * Never a UUID: the caller passes a code a person reads.
 */
export function CopyId<V extends string, L extends string>({
  value,
  copyLabel,
  copiedLabel,
  failedLabel,
  className,
}: CopyIdProps<V, L>) {
  if (value.trim() === '') throw new Error('CopyId needs a non-empty value.');
  if (copyLabel.trim() === '') throw new Error('CopyId needs a non-empty copyLabel.');
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  const copy = () => {
    const done = (next: Outcome) => {
      setOutcome(next);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setOutcome('idle'), SAID_MS);
    };
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard === undefined) {
      done('failed');
      return;
    }
    clipboard.writeText(value).then(
      () => done('copied'),
      () => done('failed'),
    );
  };
  return (
    <span
      data-slot="copy-id"
      className={cn('inline-flex max-w-full flex-wrap items-center gap-1 align-middle', className)}
    >
      <code className="min-w-0 font-mono font-semibold break-all text-fg">{value}</code>
      <Button size="sm" variant="ghost" iconOnly aria-label={copyLabel} onClick={copy}>
        {outcome === 'copied' ? <Check /> : <Copy />}
      </Button>
      <span
        role="status"
        className={cn(
          'text-control-sm',
          outcome === 'failed' ? 'text-critical-fg' : 'text-fg-muted',
        )}
      >
        {outcome === 'copied' ? copiedLabel : outcome === 'failed' ? failedLabel : ''}
      </span>
    </span>
  );
}
