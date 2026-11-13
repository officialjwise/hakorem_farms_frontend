import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** `system` follows the device's light or dark preference. */
export type ThemePreference = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

interface UIContextValue {
  /** The themed element every overlay portals into. Null until it has mounted. */
  portalContainer: HTMLElement | null;
}

const UIContext = createContext<UIContextValue | null>(null);

export interface UIProviderProps {
  theme: ThemePreference;
  /** Comfortable for the storefront; compact for the back office and POS. */
  density: Density;
  children: ReactNode;
  className?: string;
}

/**
 * UIProvider. Mount exactly one, at each app root (ADR 0006). It carries
 * theme, density and the themed portal target (ADR 0004), and will carry the
 * Toast viewport once Toast exists.
 *
 * Overlays render into the portal target, a sibling of the app root that
 * carries the same data-theme and data-density. Content portaled to <body>
 * would sit outside every themed element and render unthemed.
 */
export function UIProvider({ theme, density, children, className }: UIProviderProps) {
  if (useContext(UIContext) !== null) {
    throw new Error(
      'UIProvider is already mounted. Mount exactly one UIProvider, at the app root.',
    );
  }
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ portalContainer }), [portalContainer]);
  const themeAttr = theme === 'system' ? undefined : theme;

  return (
    <UIContext.Provider value={value}>
      <div data-slot="ui-root" data-theme={themeAttr} data-density={density} className={className}>
        {children}
      </div>
      <div
        ref={setPortalContainer}
        data-slot="ui-portal"
        data-theme={themeAttr}
        data-density={density}
      />
    </UIContext.Provider>
  );
}

/**
 * The themed element overlays portal into, passed as Radix `Portal`'s
 * `container`. It is null on the first render, before the target mounts. An
 * overlay must render nothing until then, because Radix treats a null container
 * as <body>, which is exactly the unthemed fallback this exists to prevent.
 */
export function usePortalContainer(): HTMLElement | null {
  const ctx = useContext(UIContext);
  if (ctx === null) {
    throw new Error('usePortalContainer must be used inside UIProvider.');
  }
  return ctx.portalContainer;
}
