# 0040. Make the storefront read as a farm shop: a sand page, a pine header, photographs first

- Status: accepted (owner review asked for in F7; the look is the owner's to judge on the screenshots)
- Date: 2026-11-16
- Session: F7

## Context

F5c moved the whole design system to a light grey page with white cards (ADR 0001, amended), modelled on the reference dashboards. The storefront inherited it, and the owner accepted that only provisionally (A-F5c-02). For F7 the owner asked that the shop "read as a farm shop selling fresh meat, eggs and live animals, and feel fast on a cheap phone", and that it be judged on the phone view first.

A grey page and white cards read as a back office. The F0 brand direction was "Pine & Sand": green and earth tones, warm, farm to table. The console should keep its grey page: the change is for the public shop only.

Two constraints hold:

- **No new mechanism without the owner** (CLAUDE.md). A storefront theme that re-skins every component (a `data-brand` attribute redefining `--color-accent` and friends) would be a variant mechanism, and a second palette to keep contrast-checked.
- **Fast on 3G** (ADR 0015, `hakorem-storefront-perf`). No web font, no hero image the page waits for, server components by default.

## Options considered

1. **Keep the grey page.** Nothing new, and it still reads as a back office.
2. **A storefront theme:** redefine the app tokens under an attribute on `<html>`. Every component follows, including buttons, but it is a new variant mechanism and doubles the contrast matrix.
3. **Two storefront-only page surfaces, plus parts the system already has.** A warm sand page and a deeper sand band, as tokens with their own scope, `storefront`. The header is the existing deep pine `panel`, rendered as a dark island (`data-theme="dark"`, as the dashboard's stock health already is). Buttons, cards, badges and inputs stay the design system's own.

## Decision

Option 3.

- **Tokens.** `shop-bg` (light `#F6F0E3`, dark `#15130E`) and `shop-band` (light `#EBDFC6`, dark `#231D13`), surfaces only, scope `storefront`.
  - The contrast matrix checks what sits on them in both themes: body text at 7:1, secondary and link text and the status text at 4.5:1, control boundaries, focus, the primary button and the status marks at 3:1. The tightest is the good mark on the band in light, 3.27:1.
  - `hakorem/token-usage` allows a `storefront` token only under `apps/storefront/`. The console and `packages/ui` are refused, with a message naming this ADR.
- **The header** is a deep pine band (`bg-panel`, `data-theme="dark"`): the wordmark in cream, the category links, and the basket as a filled button. It carries no bordered control, because the panel's pairs have no control boundary (ADR 0001). The search field sits under it, on the sand page.
- **Photographs first.** Product cards and the product page lead with the API's photographs (`thumb`, `card`, `full`, WebP with the JPEG fallback, width and height set). Only the first row loads eagerly.
  - A product with no photograph, or one that fails to load, shows a warm tile with the product line's line icon (meat, eggs, poultry, live animals, produce), never a broken image.
- **Words carry the farm.** Prices say what they buy ("a pack, about 15 kg", "a crate", "a head").
  - Weighed items say how they are charged before anything else on the card, the product page and the checkout.
  - Live animals say they are sold by request.
- **No web font and no marketing image.** The hero is type on the sand band, so the largest paint is text that arrives with the HTML. The brand's loud green and yellow (`brand-marketing*`, still provisional, A-F0-01) are not used: the print values have not arrived.

## Consequences

- The console is unchanged. A future screen in `packages/ui` cannot reach for the sand by accident: the lint rule refuses it.
- The shop's buttons are the system's pine green on sand. **The owner decided on 2026-11-16 that they stay pine green, with no separate shop theme** (F8), so option 2 is not taken.
- When the brand's print colours arrive (A-F0-01), the hero band and promotional surfaces can take them in `apps/storefront/src/marketing/` without touching this.
- Revisit if the owner wants the shop to look more different from the console than surfaces and photographs allow.
