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

## Consequences

- F0b sets up the catalogue location, the namespace layout and loading for both apps, and records them in this ADR.
- A hard-coded user-facing string in an app is a review blocker.
