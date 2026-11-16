'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { usePortalContainer } from '../ui-provider/UIProvider';
import type * as TooltipRadixModule from './TooltipRadix';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type TooltipProps<L extends string = string> = {
  /** Required. Short text, already translated. */
  content: NonEmpty<L>;
  /** The trigger, rendered with asChild. It must be focusable, so keyboard users see the tooltip too. */
  children: ReactElement;
  className?: string;
};

type Radix = typeof TooltipRadixModule;

/** The Radix half, once loaded: one download for every tooltip on the page. */
let radix: Radix | null = null;
let loading: Promise<Radix> | null = null;

function loadRadix(): Promise<Radix> {
  loading ??= import('./TooltipRadix').then((module) => {
    radix = module;
    return module;
  });
  return loading;
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

/**
 * Tooltip (ADR 0004). TOOLTIPS DO NOT EXIST ON TOUCH, AND THE POS IS TOUCH. A
 * tooltip is never the only route to a fact: the same information must also
 * live on screen as a visible label or hint. Use it for a shortcut or a
 * clarification, not for anything the operator needs.
 *
 * Radix Tooltip loads the first time any Tooltip mounts (ADR 0042), so a page
 * with none never downloads it. Until then the trigger renders on its own; if
 * it holds focus when the tooltip arrives, focus is put back on it, so the
 * tooltip opens for a keyboard user. It is portaled into the themed target
 * and opens on hover or keyboard focus.
 */
export function Tooltip<L extends string>({ content, children, className }: TooltipProps<L>) {
  const container = usePortalContainer();
  const [loaded, setLoaded] = useState<Radix | null>(radix);
  const anchor = useRef<HTMLSpanElement>(null);
  // Whether keyboard focus is inside the anchor, kept by focus events, not read once when Radix arrives:
  // a person can tab onto the trigger after Radix has loaded and before React swaps the trigger in.
  const focused = useRef(false);
  if (content.trim() === '') throw new Error('Tooltip needs non-empty content.');

  useEffect(() => {
    const node = anchor.current;
    if (node === null) return undefined;
    const enter = () => {
      focused.current = true;
    };
    // Focus moving to another element inside the anchor is still inside it.
    const leave = (event: FocusEvent) => {
      focused.current = node.contains(event.relatedTarget as Node | null);
    };
    node.addEventListener('focusin', enter);
    node.addEventListener('focusout', leave);
    return () => {
      node.removeEventListener('focusin', enter);
      node.removeEventListener('focusout', leave);
    };
  }, []);

  useEffect(() => {
    if (loaded !== null) return;
    let live = true;
    void loadRadix().then((module) => {
      if (!live) return;
      setLoaded(module);
    });
    return () => {
      live = false;
    };
  }, [loaded]);

  // The trigger remounts inside Radix's. Removing the focused trigger drops focus onto the page without a
  // blur, so `focused` still says it was here: put focus back where the person left it.
  useLayoutEffect(() => {
    if (loaded === null || !focused.current) return;
    // Only from the page itself: never take focus from wherever else it now is.
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const target = anchor.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  }, [loaded]);

  return (
    <span ref={anchor} data-slot="tooltip-anchor" className="contents">
      {loaded === null ? (
        children
      ) : (
        <loaded.TooltipRadix content={content} className={className} container={container}>
          {children}
        </loaded.TooltipRadix>
      )}
    </span>
  );
}
