---
name: hakorem-screen
description: Use when building or changing any screen, page, route or view in apps/storefront or apps/console. Fires before writing the first line of a screen, and again before calling it done. Enforces the four states, the permission declaration, reuse of packages/ui, the 360 px check and a Playwright spec.
---

# Building a screen

A screen is assembled from `packages/ui`. It does not invent components, call the network directly, or compute money. Read `docs/BUILD_PROMPT.md` ("The recipe every screen session follows") first.

## The four states

Every screen ships all four. A screen with only a happy path is not finished.

| State             | What to render                                                       | Component                                        |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| Loading           | Placeholder with the same shape, announced once                      | `Skeleton label="…"`, `TableLoadingRows`         |
| Empty             | Why it is empty and the next action                                  | `EmptyState` (or `TableMessageRow tone="empty"`) |
| Error             | What failed, a retry, and the correlation id from the error envelope | `ErrorState reference referenceLabel`            |
| Permission denied | Words, not a redirect. The route declares the permission it needs    | `ErrorState icon={Lock}`                         |

`ErrorState` is the permission-denied component: pass a lock icon. Never redirect a user silently to a dashboard.

## Rules

- **Declare the permission.** Every route names the permission it needs, and renders permission denied when the user lacks it.
- **Build from existing components.** A new component goes into `packages/ui` with a story (skill `hakorem-ui-component`), never inline in a screen.
- **No direct `fetch`, no hand-written API types.** See `hakorem-api-call`.
- **No business calculation.** Totals, tax, margin and distributions come from the API. The screen formats. See `hakorem-money-ui`.
- **A failed money or stock operation leaves persistent words on screen** (an `ErrorState`, an inline `role="alert"` message, a failed row that stays). A toast alone fails review (ADR 0006).
- **A write to money or stock asks for confirmation first**, showing the exact amounts, in a `Dialog`.
- **Strings come from `t()`** in the app and are passed to components as props (ADR 0008). Each screen session adds its own namespace.
- **A Tooltip is never the only route to a fact** (ADR 0004). Touch has no hover.
- **Tables stack at 360 px.** Pass `label` on every `TableCell` (ADR 0003).
- **Mount one `UIProvider` at the app root**, with the required `toastLabels` (ADR 0006).

## Before you call it done

1. Walk the keyboard path through the primary flow, then run axe (`pnpm test:a11y`).
2. Check the screen at **360 px** wide in both themes and both densities.
3. Add a Playwright spec for each primary flow (Playwright arrives in F1/F2; until then record the flow in the session report).
4. Write the session report lines the other track needs: which screens moved from the mock to the real API, and what you added to `docs/CONTRACT_REQUESTS.md`.

## Correct

```tsx
function StockScreen({ query, t }: Props) {
  if (query.isPending) {
    return (
      <Table>
        <TableBody>
          <TableLoadingRows columns={4} label={t('stock.loading')} />
        </TableBody>
      </Table>
    );
  }
  if (query.error?.status === 403) {
    return (
      <ErrorState
        icon={Lock}
        title={t('error.denied.title')}
        description={t('error.denied.body')}
      />
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title={t('stock.error')}
        reference={query.error.correlationId}
        referenceLabel={t('error.reference')}
        action={<Button onClick={() => query.refetch()}>{t('error.tryAgain')}</Button>}
      />
    );
  }
  if (query.data.items.length === 0) {
    return (
      <EmptyState
        title={t('stock.empty.title')}
        action={
          <Button asChild>
            <a href="/receive">{t('stock.receive')}</a>
          </Button>
        }
      />
    );
  }
  return <StockTable rows={query.data.items} />;
}
```

## Incorrect

```tsx
// Only the happy path, a raw fetch, an inline string, and a toast as the only record of failure.
function StockScreen() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    fetch('/api/stock')
      .then((r) => r.json())
      .then(setRows);
  }, []);
  const save = () => adjust().catch(() => toast.show({ tone: 'critical', title: 'Failed' }));
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id}>{r.qty * r.price}</div>
      ))}
    </div>
  );
}
```

It has no loading, empty, error or denied state, calls `fetch`, multiplies quantity by price on the client, hard-codes copy, and loses the failure when the toast vanishes.
