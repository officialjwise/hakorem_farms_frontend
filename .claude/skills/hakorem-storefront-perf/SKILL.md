---
name: hakorem-storefront-perf
description: Use when changing any public storefront page, layout, image, font, script, route or dependency in apps/storefront, or when adding a dependency to packages/ui that the storefront will import. Fires on next/image, dynamic imports, "use client", web fonts and bundle size. Enforces image handling, the bundle budget, server against client components and the Lighthouse gate.
---

# Public pages on a slow connection

The storefront opens on cheap Android phones over 3G. Read `docs/PERFORMANCE_BUDGET.md` for the numbers and `docs/SHARED_BRIEF.md` ("Non-functional requirements", "Low-bandwidth discipline").

## What exists today

- The budget is **recorded, not enforced**: `lighthouse/budget.json`, `lighthouse/lighthouserc.json` and `docs/PERFORMANCE_BUDGET.md`, plus a unit test that keeps them equal to the brief.
- **Not built yet:** `apps/storefront` (F1), `@lhci/cli` and the `pnpm lighthouse` script (F13).

## The budget

| Target                            | Budget                                                             |
| --------------------------------- | ------------------------------------------------------------------ |
| Largest contentful paint          | under 2.5 s on simulated 3G (300 ms RTT, 700 Kbps, 4x CPU, 360 px) |
| Listing page, compressed transfer | under 300 KB                                                       |
| Script / fonts / stylesheets      | under 120 / 20 / 30 KB (A-F0-06)                                   |
| Accessibility                     | axe clean on every route                                           |

Fix a miss by **cutting payload**, never by gaming the metric.

## Rules

1. **Server components by default.** `"use client"` only where interactivity demands it, and push it to the smallest leaf.
2. **Images are responsive and lazy.** Use the API's `ImageVariant` set (`thumb`, `card`, `full`) with `width` and `height` so nothing shifts. Only the largest image above the fold loads eagerly.
3. **No web fonts for UI.** Type is the system stack (ADR 0001). The cedi glyph face is 1.3 KB and loads only when `GH₵` appears, through `unicode-range`. A display typeface is storefront-only, subset, and an owner decision (A-F0-02).
4. **Import only what a page uses.** `@hakorem/ui` exports are named and tree-shakeable. Do not import the whole barrel into a server component that needs one function, and do not add a dependency to `packages/ui` without checking what it costs the storefront.
5. **Paginate lists** with cursor `Pagination`. No screen needs more than one round trip to become useful.
6. **Marketing colours are scoped.** `brand-marketing*` tokens are allowed only in `apps/storefront/src/marketing/` and `packages/ui/src/marketing/`; the console and POS stay on the muted accent.
7. **Route-level code splitting**, and translation namespaces split per page so a page loads only its own strings (ADR 0008).
8. **Metadata, Open Graph and the sitemap** are built from the start, not as an SEO pass later.
9. **Check at 360 px** and on a throttled connection before calling a page done.

## Correct

```tsx
// Server component: no JavaScript shipped for the list. Interactivity is one small client leaf.
export default async function Category({ params }: Props) {
  const products = await listProducts(params.slug); // through the generated client (F2)
  return (
    <ul>
      {products.items.map((p, i) => (
        <li key={p.id}>
          <img
            src={p.images[0].card.url}
            width={p.images[0].card.width}
            height={p.images[0].card.height}
            loading={i === 0 ? 'eager' : 'lazy'}
            alt={p.name}
          />
          <MoneyDisplay pesewas={p.priceBand.listPricePesewas} />
        </li>
      ))}
    </ul>
  );
}
```

## Incorrect

```tsx
'use client';
// A client component for a static list, a full-size image for a thumbnail slot, a web font for body text.
import '@fontsource/inter';
import * as UI from '@hakorem/ui';
export default function Category() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then(setItems);
  }, []);
  return items.map((p) => <img src={p.images[0].full.url} />);
}
```

It ships the whole page as client JavaScript, fetches after load, loads the full image everywhere with no dimensions, and adds a font and the entire UI barrel.
