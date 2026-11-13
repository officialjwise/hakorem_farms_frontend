---
name: hakorem-frontend-adr
description: Use when a structural or dependency decision is made in the frontend, including adding or replacing a library, a new component pattern, a new stylesheet or context, a change to a token role, a routing or data-layer choice, or any decision the owner has not already recorded. Fires before writing the code that depends on the decision. Enforces the house ADR format, the numbering and linking.
---

# Recording a decision

A decision that exists only in chat did not happen. Decide, record, then build. Read `docs/SHARED_BRIEF.md` (operating rule 2: "Decide, then record") and look at an existing ADR in `docs/adr/` before writing one.

## When an ADR is required

- A new dependency, or a version held back (see ADR 0002).
- A new pattern the references (Button, Table, StatusBadge, UIProvider, Field) do not have: a stylesheet, a context, a provider, a different way of passing strings, a new variant mechanism. **Ask the owner first**, then record their answer (ADR 0004 to 0010 each started as an owner decision).
- A change to the token model, a role, or a contrast rule (ADR 0001).
- A routing, data-layer or build choice.

Do not reopen a decision already recorded. If you believe one is wrong, write an ADR arguing the case and wait for the owner.

## The format

Copy `docs/adr/0000-template.md`. File name `docs/adr/NNNN-kebab-title.md`. **The next number is 0011**; check `ls docs/adr` and take the next free one.

```md
# NNNN. Title in the imperative

- Status: proposed | accepted | superseded by NNNN
- Date: YYYY-MM-DD
- Session: Fnn

## Context

What forces are at play, and what problem needs a decision.

## Options considered

1. Option, with its main trade-off.
2. Option, with its main trade-off.

## Decision

What we chose, stated so a reviewer can check code against it.

## Consequences

What becomes easier, what becomes harder, and what would make us revisit this.
```

## Rules

- **One decision per file.** Title in the imperative ("Tables stack below 40rem"), not a topic.
- **Status.** `proposed` until the owner agrees, `accepted` after (add who and when in the status line, as ADR 0007 does), `superseded by NNNN` when replaced. Never delete an ADR.
- **State the decision so code can be checked against it.** "Overlays portal into `usePortalContainer()`" can be reviewed; "overlays should be themed" cannot.
- **Record the assumption.** If you picked the cheapest-to-reverse option in place of an answer, say so in the ADR and add a row to `docs/ASSUMPTIONS.md` (id `A-<session>-NN`, who confirms).
- **Link it.** Cite the ADR in the code comment or story that implements it (as `Table.tsx` cites ADR 0003), and in the session report under "Decided".
- **Park, do not smuggle.** An idea outside the current phase goes to the backlog or the report, not into the code.

## Correct

An example, not a real ADR:

```md
# 0011. The storefront reads the theme from a cookie on the server

- Status: proposed (owner to confirm)
- Date: 2026-11-20
- Session: F1

## Context

Setting `data-theme` on the client causes a flash on first paint (F0b report, "Theme on `<html>`, for F1").

## Options considered

1. Client script after hydration. Simple, flashes.
2. A cookie read in the root layout. No flash, one cookie.

## Decision

Option 2. The root layout sets `data-theme` on `<html>` from the `theme` cookie.

## Consequences

Pages that read the cookie are dynamic. Revisit if the storefront needs static export.
```

## Incorrect

```md
# Theme thoughts

We should probably do something about the flash. Maybe a cookie? Will see.
```

It has no number, status, date or decision, and a reviewer cannot check any code against it.
