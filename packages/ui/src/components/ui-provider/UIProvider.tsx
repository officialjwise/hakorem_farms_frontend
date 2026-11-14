'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ToastItem, type ToastInput } from '../toast/Toast';

/** `system` follows the device's light or dark preference. */
export type ThemePreference = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

/**
 * The words Radix Toast would otherwise supply in English. UIProvider holds no
 * copy of its own, so the app passes them through its translation layer.
 */
export interface ToastLabels {
  /** The landmark name of the toast region. May contain `{hotkey}`, for example "Notifications ({hotkey})". */
  region: string;
  /** Prefix a screen reader hears before each toast, for example "Notification". */
  announcement: string;
  /** Accessible name of every toast's close button, for example "Dismiss notification". */
  close: string;
}

export interface ToastApi {
  /** Raises a toast and returns its id. A toast is never the only record of a failed money or stock operation (ADR 0006). */
  show: <T extends string>(toast: ToastInput<T>) => string;
  dismiss: (id: string) => void;
}

interface UIContextValue extends ToastApi {
  /** The themed element every overlay portals into. Null until it has mounted. */
  portalContainer: HTMLElement | null;
}

const UIContext = createContext<UIContextValue | null>(null);

export interface UIProviderProps {
  theme: ThemePreference;
  /** Comfortable for the storefront; compact for the back office and POS. */
  density: Density;
  toastLabels: ToastLabels;
  children: ReactNode;
  className?: string;
}

interface QueuedToast {
  id: string;
  toast: ToastInput;
}

/**
 * UIProvider. Mount exactly one, at each app root (ADR 0006). It carries
 * theme, density, the themed portal target (ADR 0004), the toast queue and
 * viewport, and the tooltip delay group.
 *
 * Overlays render into the portal target, a sibling of the app root that
 * carries the same data-theme and data-density. Content portaled to <body>
 * would sit outside every themed element and render unthemed. The toast
 * viewport lives inside that target, so toasts carry the app's theme and density.
 */
export function UIProvider({ theme, density, toastLabels, children, className }: UIProviderProps) {
  if (useContext(UIContext) !== null) {
    throw new Error(
      'UIProvider is already mounted. Mount exactly one UIProvider, at the app root.',
    );
  }
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((toast: ToastInput<string>) => {
    nextId.current += 1;
    const id = `toast-${nextId.current}`;
    setToasts((queue) => [...queue, { id, toast }]);
    return id;
  }, []);
  const dismiss = useCallback((id: string) => {
    setToasts((queue) => queue.filter((entry) => entry.id !== id));
  }, []);

  const value = useMemo(
    () => ({ portalContainer, show, dismiss }),
    [portalContainer, show, dismiss],
  );
  const themeAttr = theme === 'system' ? undefined : theme;

  return (
    <UIContext.Provider value={value}>
      <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={200}>
        <ToastPrimitive.Provider label={toastLabels.announcement} swipeDirection="right">
          <div
            data-slot="ui-root"
            data-theme={themeAttr}
            data-density={density}
            className={className}
          >
            {children}
          </div>
          <div
            ref={setPortalContainer}
            data-slot="ui-portal"
            data-theme={themeAttr}
            data-density={density}
          >
            {toasts.map(({ id, toast }) => (
              <ToastItem
                key={id}
                toast={toast}
                closeLabel={toastLabels.close}
                open
                onOpenChange={(open) => {
                  if (!open) dismiss(id);
                }}
              />
            ))}
            <ToastPrimitive.Viewport
              label={toastLabels.region}
              className="fixed inset-x-0 bottom-0 z-toast m-0 flex list-none flex-col gap-2 p-3 outline-none sm:start-auto sm:w-[26rem]"
            />
          </div>
        </ToastPrimitive.Provider>
      </TooltipPrimitive.Provider>
    </UIContext.Provider>
  );
}

function useUIContext(hook: string): UIContextValue {
  const ctx = useContext(UIContext);
  if (ctx === null) {
    throw new Error(`${hook} must be used inside UIProvider.`);
  }
  return ctx;
}

/**
 * The themed element overlays portal into, passed as Radix `Portal`'s
 * `container`. It is null on the first render, before the target mounts. An
 * overlay must render nothing until then, because Radix treats a null container
 * as <body>, which is exactly the unthemed fallback this exists to prevent.
 */
export function usePortalContainer(): HTMLElement | null {
  return useUIContext('usePortalContainer').portalContainer;
}

/** Raise and dismiss toasts. Throws outside UIProvider, like usePortalContainer. */
export function useToast(): ToastApi {
  const { show, dismiss } = useUIContext('useToast');
  return useMemo(() => ({ show, dismiss }), [show, dismiss]);
}
