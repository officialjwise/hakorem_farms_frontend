# 0051. A request reference shows its last eight characters and copies in full

- Status: accepted (owner, 2026-11-17, answering the F10d report's second question)
- Date: 2026-11-17
- Session: F10e

## Context

Every failed request carries the error envelope's `correlationId`, a UUIDv7, so a support call starts with a reference instead of a guess (SHARED_BRIEF, observability). ADR 0050 put no UUID on screen, and left this one for the owner: error states across the console and the storefront showed the whole 36 characters. The owner (2026-11-17): show the last eight characters of the request reference, grouped for reading, with CopyId copying the full reference for support. Take the end, not the start: the start of a UUIDv7 encodes the time, so two failures a moment apart share it, and the random part is at the end.

## Options considered

1. **Each screen cuts the reference itself.** Repeats the rule in a dozen places, and a new error state would show the whole UUID again.
2. **One formatter, and the error components take the copy button's words.** `formatReference` in `packages/ui` beside the other formatters. `CopyId` takes an optional `shown`, the text shown when it is not the whole value. `ErrorState`, `QueryBoundary`, `MutationFailure`, `FormError` and `TableMessageRow` show a request reference through `CopyId`, and their labels carry its words. No new stylesheet, context or variant mechanism: strings stay props (ADR 0008).

## Decision

Option 2.

- **`formatReference(reference)`**: hyphens and spaces left out, the last eight characters, in two groups of four (`019a7b1d-f4de-751c-aa55-5aa0965fd37e` reads `965f d37e`). A reference of eight characters or fewer is shown whole.
- **`CopyId`'s `shown`**: what is shown. `value` is still what is copied, in full. A blank `shown` is refused at render.
- **`ErrorState`'s `referenceCopy`** (`CopyLabels`: copy, copied, failed): given for a request reference, always. With it the reference is the short form and a copy button; without it, a reference a person reads in full, such as a permission's name on the permission-denied screen, is shown whole as before. A blank reference shows nothing. `QueryBoundaryLabels.referenceCopy`, `FormError`'s `referenceCopy` and `TableMessageRow`'s are required, so a screen cannot leave them out.
- **In a sentence** (the till's queue and payment alerts, the storefront's checkout alerts, the audit event's request reference), the console's `RequestReference` and the storefront's do the same.
- **Words**: `common.states.referenceCopy` ("Copy the full reference") with `copyId.copied` and `copyId.failed` in the console; `cart.referenceCopy…` and `listing.error.copy…` in the storefront; the route error page keeps its own constant words (ADR 0015).
- The console's own render-error reference (`ErrorBoundary`) and the storefront's route error digest are shown the same way, so every reference on screen reads alike.

## Consequences

- No UUID shows on any error state. Support asks for the eight characters or, better, for the pasted full reference. Eight hexadecimal characters are about four thousand million values, enough to find one request in a day's logs.
- A support search by the short form is a search on the end of the id. The logs keep the full id.
- The till's initial load carries `CopyId` through `ErrorState`.
- Revisit if the backend gives a shorter reference of its own.
