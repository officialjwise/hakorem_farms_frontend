/**
 * jsdom has no ResizeObserver (Radix's popper positioning reads it) and no
 * pointer-capture methods (Radix Toast reads them on pointer-up). These stubs
 * only silence the missing APIs; real behaviour is proved in the Chromium story tests.
 */
export function stubResizeObserver(): void {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  if (typeof globalThis.ResizeObserver !== 'undefined') return;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
