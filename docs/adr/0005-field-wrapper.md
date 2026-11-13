# 0005. One Field wrapper owns labelling, description and validity

- Status: accepted
- Date: 2026-11-13
- Session: F0 (owner decision), implemented in F0b

## Context

Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, DatePicker, NumberInput, MoneyInput and WeightInput all need a label, hint and error linked to the control. If each input wires its own, the wiring drifts.

## Decision

- **Field owns all of it:** a generated id (`useId`), label association, `aria-describedby` for hint and error, `aria-invalid`, and required marking. Individual inputs never wire their own; they read what Field provides.
- **Label is a required prop.** A field without one is a compile error, as with StatusBadge, and an empty literal label is rejected too. A placeholder is never a label.
- **Errors carry text.** An error always shows a message. A red border alone is colour carrying state, which ADR 0001 rules out.
- **Required fields** use the `required` attribute plus visible text, never an asterisk alone.

## Consequences

- Inputs used outside a Field are a review blocker. F0b should make that hard to do by accident, for example an input that throws or is typed to need Field context. If that needs a new pattern, F0b asks the owner first.
- Field is the seam the form system (react-hook-form + Zod) maps field errors and server errors onto.
- Field wires exactly one control. A group of options (radio group, checkbox group) goes in FieldGroup (ADR 0009), never in Field. Field is not stretched to cover groups.
