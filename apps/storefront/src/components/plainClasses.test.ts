import { describe, expect, it } from 'vitest';
import { buttonVariants, cn, inputVariants } from '@hakorem/ui';
import { CART_BUTTON_CLASSES, SEARCH_INPUT_CLASSES } from './plainClasses';

describe('the header controls without Button and Input (the owner, 2026-11-18)', () => {
  it("the basket button carries exactly Button's primary, medium classes", () => {
    expect(CART_BUTTON_CLASSES).toBe(buttonVariants());
  });

  it("the search box carries exactly Input's medium classes, filling its row", () => {
    expect(SEARCH_INPUT_CLASSES).toBe(cn(inputVariants(), 'min-w-0 flex-1'));
  });
});
