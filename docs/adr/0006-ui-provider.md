# 0006. Exactly one UIProvider at each app root

- Status: accepted
- Date: 2026-11-13
- Session: F0 (owner decision), implemented in F0b

## Context

Theme, density, the Toast viewport and the themed portal target (ADR 0004) all need app-level setup. Three apps (storefront, back office, POS) must mount it. Every extra provider is one more thing to forget.

## Decision

- **One provider:** exactly one `UIProvider` at each app root, carrying theme, density, the Toast viewport and the themed portal target. Not several nested providers.
- **Toast viewport:** added to UIProvider when F0c builds Toast, never as a separate provider. Owner confirmed 2026-11-13. Inside UIProvider it is within a themed element, so toasts carry the app's theme and density.
- **Forms stay separate:** react-hook-form's `FormProvider` is per form, never app level.
- **Toast is not a record:** a toast is never the only record of a failed money or stock operation. A toast that vanishes in five seconds is not an audit trail. Those failures also leave something persistent on screen, such as an inline ErrorState or a failed row that stays until dealt with.

## Consequences

- A screen that only toasts a failed sale, payment, adjustment or transfer fails review.
- Storybook's decorator mounts `UIProvider` too, so stories exercise the same setup as the apps.

- Amended by ADR 0042 (F8): the viewport and Radix Toast load with the first toast, and the tooltip provider moved into Tooltip, which loads Radix on first use. One provider at each root still holds.
