import { useEffect, type RefObject } from 'react';

/** What counts as an open modal. Radix Dialog and Sheet content both carry role="dialog". */
const OVERLAY = '[role="dialog"], [role="alertdialog"]';
/** An element the operator is deliberately using. A scan must never steal a keystroke from one of these. */
const INTERACTIVE =
  'button, a[href], input, textarea, select, summary, [contenteditable="true"], [role="button"], [role="menuitem"], [role="tab"], [tabindex]:not([tabindex="-1"])';
/** After a modal closes, how long to wait for Radix to hand focus back to its trigger before taking it. */
const RETURN_GRACE_MS = 150;

/**
 * The POS barcode focus trap (ADR 0004, ADR 0014). A scanner types into whatever has focus, so the barcode
 * field must own focus whenever nothing else deliberately does:
 *
 * 1. It takes focus on mount.
 * 2. If focus falls to the page (a click on blank space), it takes it back.
 * 3. A printable key pressed while focus is on the page, not on a control, moves focus to the field first,
 *    so the keystroke lands in it. A key on a button or link is left alone (Space activates a button).
 * 4. While a modal (Dialog, Sheet) is open it does nothing at all: Radix owns the modal's focus trap.
 * 5. When the modal closes, Radix returns focus to the control that opened it. The trap then takes it from
 *    there, because the next scan must land in the field and not on a button.
 *
 * It never overrides Radix's trap or its focus return; it acts after them.
 */
export function useBarcodeTrap(field: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const input = field.current;
    if (input === null) return;

    const overlayOpen = () => document.querySelector(OVERLAY) !== null;
    const take = () => {
      if (!overlayOpen() && document.activeElement !== input) input.focus({ preventScroll: true });
    };

    let wasOpen = overlayOpen();
    let returning = false;
    let returnTimer: ReturnType<typeof setTimeout> | undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (overlayOpen() || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      const target = event.target;
      if (!(target instanceof Element) || target === input || target.closest(INTERACTIVE) !== null)
        return;
      input.focus({ preventScroll: true });
    };

    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget === null) setTimeout(take, 0);
    };

    // Rule 5: focus arriving anywhere but the field right after a modal closed is Radix's return. Redirect it.
    const onFocusIn = (event: FocusEvent) => {
      if (returning && event.target !== input && !overlayOpen()) {
        returning = false;
        clearTimeout(returnTimer);
        input.focus({ preventScroll: true });
      }
    };

    const observer = new MutationObserver(() => {
      const open = overlayOpen();
      if (wasOpen && !open) {
        returning = true;
        clearTimeout(returnTimer);
        returnTimer = setTimeout(() => {
          returning = false;
          take();
        }, RETURN_GRACE_MS);
      }
      wasOpen = open;
    });
    observer.observe(document.body, { childList: true, subtree: true });

    take();
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    input.addEventListener('focusout', onFocusOut);
    return () => {
      observer.disconnect();
      clearTimeout(returnTimer);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      input.removeEventListener('focusout', onFocusOut);
    };
  }, [field]);
}
