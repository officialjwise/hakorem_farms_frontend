# 0009. FieldGroup labels a group of options; Field stays one control

- Status: accepted (owner decision 2026-11-13). The details under "Details that follow from Field" are proposed, and the owner reviews them at F0c's gate.
- Date: 2026-11-13
- Session: F0b (owner decision), built in F0c

## Context

Field (ADR 0005) wires exactly one control: one id, one label, one `aria-describedby`.

A radio group or checkbox group is different. It asks one question with several options:

- the question needs a group label, a hint and an error;
- each option needs its own label.

HTML's answer is `fieldset` and `legend`. Field cannot cover both cases without a mode that changes what each of its props means.

None of the reference components or foundations labels a group, so this is a new pattern.

## Options considered

1. **A Field variant**, for example `<Field group>`. Ruled out by the owner. One component with two kinds of wiring is the drift ADR 0005 exists to prevent.
2. **A separate FieldGroup** on `fieldset` and `legend`. Chosen.

## Decision

These are the owner's rules:

- **Structure:** FieldGroup renders a `fieldset` whose `legend` is the group label.
- **What it owns:** the group label, the hint, the error and the group's `aria-describedby`.
- **Options:** each option keeps its own label. A radio or checkbox inside a FieldGroup is labelled by its own visible text, not by FieldGroup and not by Field.
- **Field stays as it is:** Field is not stretched to cover groups. Field wires one control; FieldGroup labels a group.

## Details that follow from Field (proposed)

These mirror ADR 0005 so that the two components read the same.

- **Label required:** `label` is typed `NonEmpty`, so an empty literal is a compile error, and a blank label throws.
- **Description order:** the error id first, then the hint id, on the fieldset's `aria-describedby`.
- **Errors carry text:** the group is invalid exactly when `error` has text.
  - The options carry no `aria-invalid`.
  - The error reaches screen readers through the group's description.
- **Required:** a visible `requiredLabel` inside the legend, so it is part of the group's name.
  - No `required` attribute on the options, because on checkboxes it would make every box required.
  - The form system (Zod) enforces "choose at least one".
- **One group, one name:** Radix RadioGroup renders its own `radiogroup` element.
  - A FieldGroup must appear in the accessibility tree as exactly one named group, and the Chromium story asserts it.
  - F0c gets there with mechanisms that already exist, such as Slot and `asChild`. If it cannot, it asks the owner first.

## Consequences

- **Where each control goes:**
  - Radio groups and checkbox groups always go in a FieldGroup.
  - A single Checkbox or Switch is one control with one label, so it goes in a Field.
- **Form errors:** the form system maps a group's error onto FieldGroup's `error`, the same way it maps a single control's error onto Field's.
- **Reference shape:** FieldGroup follows it, with:
  - every string as a prop;
  - a `.typetest.tsx`;
  - a matrix story;
  - a Chromium wiring story covering the name, description, validity and required state.
