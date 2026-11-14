# 0027. Show every timestamp in Accra time, numerically, through one formatter

- Status: accepted
- Date: 2026-11-14
- Session: F3

## Context

F3 is the first session with timestamps on screen: last sign-in, session last seen, grant validity and the audit log. The shared brief says every timestamp is stored in UTC and rendered in Africa/Accra. ADR 0007 keeps formatting out of `Intl` because ICU data differs between runtimes. `packages/ui` never calls `t()` (ADR 0008), so it cannot produce month names.

## Options considered

1. **`Intl.DateTimeFormat` with `timeZone: 'Africa/Accra'`.** It produces familiar text, but output depends on the runtime's ICU data, and the month names would come from the browser's locale rather than the catalogue.
2. **A date library such as date-fns-tz.** That is a new dependency for a zone that never changes.
3. **One formatter in `packages/ui/src/format`, reading the UTC fields.** Africa/Accra is UTC+0 all year with no daylight saving, so Accra wall time is the UTC fields. The output is `YYYY-MM-DD HH:mm`, numeric and largest unit first.

## Decision

Option 3. Screens render timestamps through `formatDateTime(instant)` inside a `<time dateTime={instant}>`, so the exact instant stays in the markup.

- `null` gives an en dash; in an export cell it gives an empty string, as `formatMoney` does.
- Anything other than an ISO 8601 instant with an offset throws.
- Seconds are dropped. The audit event screen shows the raw instant beside the formatted one, because a dispute may need the second.

`BUSINESS_TIME_ZONE` names the zone, so a screen can say which one the times are in.

## Consequences

- No new dependency, and no difference between the server and the browser.
- The format is unambiguous to everyone and sorts as text, but it is less friendly than "14 Nov". If the owner wants words, add translated month names through `t()` in the apps, not in `packages/ui`.
- If Ghana ever adopts daylight saving or a new offset, this formatter is the one place to change, and its tests pin the current rule.
