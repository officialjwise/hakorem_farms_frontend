# 0008. react-i18next for the translation layer, split by namespace

- Status: accepted (owner decision 2026-11-13)
- Date: 2026-11-13
- Session: F0 (owner decision), implemented in F0b

## Context

The brief requires every user-facing string to go through a translation layer from day one. The storefront is Next.js and the console is Vite. They should share one catalogue.

## Options considered

1. **react-i18next.** A mature library that works in both Next.js and Vite from one catalogue.
2. **next-intl.** Next.js only, so the console would need a second library and a second catalogue. Ruled out.
3. **A hand-rolled `t()`.** Ruled out by the owner.

## Decision

- **Library:** react-i18next, with one catalogue shared by the storefront and the console.
- **Namespaces:** split by namespace, so the storefront loads only what a page needs and a slow connection does not pay for console strings.
- **Labels only:** numbers, money and weight never go through translation (ADR 0007).
- **packages/ui stays translation-free:** components keep taking every string as a prop (the reference-component rule). Apps call `t()` and pass the result in. The UI package never imports i18next.

## Built in F0

- **Package:** `packages/i18n` (`@hakorem/i18n`). `packages/ui` does not depend on it.
- **Catalogue:** `packages/i18n/locales/<language>/<namespace>.json`. English ships first, with the `common` namespace.
- **Namespaces:** each one is a dynamic import, so bundlers split it into its own chunk. Pages load only the namespaces they ask for, and can add more with `instance.loadNamespaces`.
- **`createI18n({ namespaces, language? })`:** returns a fresh i18next instance with react-i18next initialised. It never uses the global singleton, so server renders cannot leak language between requests. Apps wrap their tree in react-i18next's `I18nextProvider`.
- **Typed keys:** keys are checked through i18next's `CustomTypeOptions`. A misspelt key or an unknown namespace is a compile error.
- **Labels only:** a test fails if any catalogue string uses i18next's number, currency, date or list formatting, and another fails if any language is missing keys.

## Consequences

- Each feature session adds its own namespace (for example `stock`, `checkout`) rather than growing `common`.
- A hard-coded user-facing string in an app is a review blocker.
