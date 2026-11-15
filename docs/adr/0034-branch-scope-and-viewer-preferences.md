# 0034. The header's branch scopes every screen; viewer preferences live in small stores, not a provider

- Status: proposed
- Date: 2026-11-15
- Session: F5b

## Context

The owner asked for a branch switcher in the console header that scopes every screen, as HaKorem opens selling points at Kasoa and KNUST beside the farm. The same session adds a theme toggle and a sidebar that narrows and folds its groups. Each of these choices must reach screens far from the header. CLAUDE.md treats a new context or provider as a question for the owner; the owner asked for the behaviour, and this records how it is built.

## Options considered

1. **A React context and provider per choice.** The usual shape. But it adds three providers to the root, and a screen reading the branch re-renders through the context.
2. **The branch in the URL** (`?branch=`). Shareable, but every link in the app would have to carry it, and a lost parameter silently shows another branch.
3. **Small external stores** (`lib/preferences.ts`) read with `useSyncExternalStore`, backed by localStorage in try/catch. No provider. Each store is one key, a closed set of values (or an id) and a default.

## Decision

Option 3.

- **The stores.** `themePreference` (system, light, dark), `sidebarPreference` (wide, narrow), `foldedGroups` and `branchPreference`.
  - These are per-viewer conveniences, so localStorage is the right home.
  - Blocked storage (a private window) falls back to the default for the page's life.
- **`useBranchScope()`** (`branch/branchScope.ts`) is the only way a screen learns the branch.
  - **The choices** are the branches in the session's grants. Their names come from `listBranches` when the person may read it; otherwise the code is shown.
  - **The first choice** is the first grant's branch. "All branches" is offered only to someone holding more than one.
  - **A stored choice the person no longer holds** is ignored.
- **Scoping.** A read that takes `branchId` spreads `scope.query` into its input, so its cache key changes and it re-reads. This applies to the 21 reads that take it: today the dashboard, stock on hand, every location picker and the header's notifications.
  - A list the contract cannot narrow says so under its title (`BranchScopeNote`), and CR-015 asks for the parameter.
  - The server still decides what each read returns. The switcher narrows; it grants nothing.
- **The till** ignores the theme preference and stays light (A-F0-03).

## Consequences

- Nothing wraps the app, and tests need no extra provider. The stores are module singletons, so a test that changes one must set it back.
- The choice is per browser, not per person: a second device starts from the default branch.
- Revisit if a choice must follow the person across devices (a server-side preference), or if a link must open a specific branch (then add `?branch=` on top of this).
