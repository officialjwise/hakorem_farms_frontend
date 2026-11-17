# 0014. The POS shell owns the barcode field and its focus trap

- Status: superseded by 0048 (owner, 2026-11-17: no barcode scanning at the till)
- Date: 2026-11-14
- Session: F1 (implements the required story from ADR 0004)

## Context

A barcode scanner types into whatever has focus. ADR 0004 requires a story proving the POS barcode focus trap and an open Dialog work together, built against the real trap and never a stand-in. Radix owns the Dialog's focus trap and returns focus to the control that opened it, and ADR 0004 says we do not override either.

## Decision

- The barcode field lives in `PosShell`, not in a screen, so every POS screen built later inherits it.
- `src/pos/useBarcodeTrap.ts` is the trap. Its rules, all tested:
  1. The field takes focus on mount.
  2. When focus falls to the page (a click on blank space) it takes focus back. **Not** when the operator pressed Tab (a trap there would be a WCAG 2.1.2 keyboard trap), and not when the window lost focus.
  3. A printable key pressed while focus is on the page, not on a control, moves focus to the field first, so the keystroke lands in it. A key on a button, link or other field is left alone.
  4. While a modal (`[role="dialog"]`, `[role="alertdialog"]`) is open the trap does nothing. Radix's trap holds focus.
  5. When the modal closes, Radix hands focus back to its trigger. The trap then moves it on to the field, because the next scan must land there. It watches the DOM for the modal leaving, redirects the first focus that arrives anywhere else, and falls back after 150 ms. It acts after Radix and never changes Radix's code or props.
- The required proof is `e2e/specs/console/pos-barcode-dialog.spec.ts`, in Chromium against the production build of the real shell, the real trap and the real `@hakorem/ui` Dialog (the POS sign-out confirmation). It asserts: focus inside the Dialog on open, a typed scan does not reach the field, Tab and Shift+Tab never leave the Dialog, and on Escape, Stay signed in, and the close button focus returns to the barcode field and not to the opener. A jsdom test covers the hook's rules with a plain `role="dialog"`; it is not the gate.
- The POS defaults to the light theme (A-F0-03), compact density, `lg` buttons, no sidebar, and shows the connection state as icon and words with a persistent line while offline.

## Consequences

- A POS screen that adds its own text field (a weight entry, a note) keeps the trap out of the way, because a key on a field is left alone. Such a field must be a deliberate focus target, and closing its panel returns focus to the barcode field.
- The fallback delay (150 ms) is a heuristic. If a slower device needs more, the redirect on first focus already handles the normal case.
