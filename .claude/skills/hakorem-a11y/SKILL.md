---
name: hakorem-a11y
description: Use for any interactive work: a control, form, dialog, menu, table, focus handling, keyboard behaviour, colour or contrast change, or an accessibility fix. Fires on aria-* attributes, tabIndex, focus, onKeyDown, role, label, error and status colour. Enforces the WCAG 2.2 AA checklist, the keyboard path, focus management, labels and contrast in both themes.
---

# Accessibility

WCAG 2.2 level AA is a requirement, and daylight on a counter screen makes contrast functional, not cosmetic. Read ADR 0001 (contrast), 0004 (focus, tooltips), 0005 and 0009 (labels) and `docs/BUILD_PROMPT.md` ("Set the budgets").

## What the repo already enforces

- **axe runs on every Storybook story in Chromium** in light and dark and fails on any WCAG 2.2 AA violation (`pnpm test:a11y`). Never suppress a finding; fix the component.
- **Contrast is tested**: every foreground/background pair is in `contrastPairs` and checked in both themes. Body text is 7:1, other text 4.5:1, control boundaries, focus rings and marks 3:1. A new text or surface token with no pair fails a coverage test.
- **`useRequireLabel`** throws after mount if a control has no `<label>`, `aria-label` or `aria-labelledby`.
- **`hakorem/token-usage`** keeps mark tokens (`critical`, `good`...) off text.

## The checklist

1. **A label on everything.** Controls go in `Field` (one control) or `FieldGroup` (radio or checkbox group, on `fieldset` and `legend`). A placeholder is never a label. Icon-only buttons need `aria-label`.
2. **Colour never carries state alone.** Status is icon plus words (`StatusBadge` requires both). An error is words (`Field error`), never only a red border. A required field has visible text (`requiredLabel`), not an asterisk. Selection is shape as well as colour (the accent edge on a selected row).
3. **A keyboard path through every interactive component.** Each has a `KeyboardPath` story and unit test with real key presses. Tab order follows reading order, nothing is a keyboard trap, and the focus ring (`outline-focus outline-offset-2 focus-visible:outline-2`) is always visible.
4. **Focus belongs to Radix in overlays.** Do not override focus trapping or return (ADR 0004). Focus moves into a Dialog on open and returns to the trigger on close.
5. **A Tooltip is never the only route to information.** Touch has no hover, and the POS is touch. Give a control a visible label or hint.
6. **Names and live regions.** Loading is announced once (`Skeleton label`, `Spinner label`, `TableLoadingRows label`). An error uses `role="alert"` (`ErrorState`). A toast is announced, but it is never the only record of a failed money or stock operation (ADR 0006).
7. **Target size** at least 24 px (WCAG 2.5.8). The smallest compact control is 28 px.
8. **Reflow at 360 px** with no sideways scroll. Tables stack (ADR 0003), and a scrollable region is focusable.
9. **Motion.** Respect `prefers-reduced-motion` (`motion-reduce:` variants and the duration tokens). Overlays do not animate.
10. **Language and direction.** Use logical utilities (`ps-`, `text-start`, `inline-start`) so RTL works.

## Contrast in both themes

Never pick a colour by eye. Use a token with the right role, and if a new pairing is needed add it to `contrastPairs` in `palette.ts` and run `pnpm test:unit`. Text on a status tint is `-fg` on `-subtle`; text on a solid fill is `-on` on `-strong`.

## Checks before done

`pnpm test:a11y`, then walk the primary flow with the keyboard only, then check 360 px in both themes. A screen reader pass on checkout and the POS sale screen is F13 work.

## Correct

```tsx
<Field label={t('weight.label')} hint={t('weight.hint')} error={errors.weight} required requiredLabel={t('field.required')}>
  <WeightInput value={weight} onValueChange={setWeight} />
</Field>

<StatusBadge tone="warning" icon={Clock} label={t('lot.expiringSoon')} />
```

## Incorrect

```tsx
// A placeholder as the label, an asterisk as the only required marker,
// colour as the only error, and a tooltip as the only explanation.
<div>
  <input placeholder="Weight" style={{ borderColor: 'red' }} />
  <span>*</span>
  <Tooltip content="From the scale, to three decimals">
    <span>?</span>
  </Tooltip>
</div>
```
