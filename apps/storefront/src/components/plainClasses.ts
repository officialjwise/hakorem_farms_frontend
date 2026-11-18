/**
 * Two controls in every page's first load, written as plain class strings (the owner, 2026-11-18): the
 * header's basket button and its search box. `Button` and `Input` would bring `cn`, tailwind-merge and
 * Radix Slot into the layout's scripts for two fixed looks. `plainClasses.test.ts` fails if either drifts
 * from what `buttonVariants()` and `inputVariants()` give.
 */

/** `Button`'s primary, medium look, as `buttonVariants()` gives it. */
export const CART_BUTTON_CLASSES =
  'relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none transition-colors duration-fast ease-standard outline-focus outline-offset-2 focus-visible:outline-2 press:translate-y-px motion-reduce:press:translate-y-0 disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface-sunken disabled:text-fg-disabled aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0 bg-accent text-accent-fg hover-enabled:bg-accent-hover h-control-md px-control-md text-control-md [&_svg]:size-icon-md';

/** `Input`'s medium look, filling the search row, as `cn(inputVariants(), 'min-w-0 flex-1')` gives it. */
export const SEARCH_INPUT_CLASSES =
  'w-full rounded-full border border-border-strong bg-surface text-fg tabular-nums placeholder:text-fg-muted outline-focus outline-offset-2 focus-visible:outline-2 transition-colors duration-fast ease-standard read-only:bg-surface-sunken disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-disabled aria-invalid:border-2 aria-invalid:border-critical h-control-md px-control-md text-control-md min-w-0 flex-1';
