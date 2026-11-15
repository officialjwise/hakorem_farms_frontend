import { useSyncExternalStore } from 'react';

/**
 * Per-viewer conveniences kept in this browser: the theme, whether the sidebar is narrow, which groups
 * are folded, and the chosen branch. Nothing here is state anyone else needs, so it lives in
 * localStorage, and every read and write survives storage being blocked (a private window): the console
 * then starts from the defaults.
 */
type Listener = () => void;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

export interface Preference<T extends string> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: Listener) => () => void;
}

/** One stored choice from a closed set, with its default. An unknown stored value reads as the default. */
export function preference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): Preference<T> {
  const listeners = new Set<Listener>();
  let memory: T | null = null;
  return {
    get: () => {
      const stored = memory ?? read(key);
      return stored !== null && (allowed as readonly string[]).includes(stored)
        ? (stored as T)
        : fallback;
    },
    set: (value) => {
      memory = value;
      write(key, value);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A stored choice of any string (an id), or null. */
export function openPreference(key: string): Preference<string> & { clear: () => void } {
  const listeners = new Set<Listener>();
  let memory: string | null | undefined;
  const notify = () => listeners.forEach((listener) => listener());
  return {
    get: () => (memory === undefined ? read(key) : memory) ?? '',
    set: (value) => {
      memory = value;
      write(key, value);
      notify();
    },
    clear: () => {
      memory = null;
      write(key, null);
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function usePreference<T extends string>(store: Preference<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEMES)[number];
/** The back office theme. The till ignores it and stays light in daylight (A-F0-03). */
export const themePreference = preference<ThemeChoice>('hk.theme', THEMES, 'system');

export const sidebarPreference = preference<'wide' | 'narrow'>(
  'hk.sidebar',
  ['wide', 'narrow'],
  'wide',
);

/** Groups the person folded, as a comma-separated list of group keys. */
export const foldedGroups = openPreference('hk.sidebar.folded');
