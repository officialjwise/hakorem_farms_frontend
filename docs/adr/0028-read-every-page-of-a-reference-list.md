# 0028. Read every page of a short reference list with one hook

- Status: accepted (owner, 2026-11-14, with a hard page cap that throws past the limit; amended below)
- Date: 2026-11-14
- Session: F3

## Context

The role screen must show every permission a role can hold, grouped by area, so the owner can tick the right ones. `listPermissions` is cursor paged with at most 100 rows a page, and contract 1.1.0 names 273 permissions. ADR 0022 and DATA_CONVENTIONS settle paging as Previous and Next, and say: "An infinite-scroll hook is not built; the first screen that needs one adds it here." A permission picker cut into pages would hide the permission someone is looking for on another page.

## Options considered

1. **Query per module** (`listPermissions?module=iam`). There is no list of modules to iterate, and it costs one round trip per area.
2. **TanStack `useInfiniteQuery` with a "Load more" button.** That is right for browsing, and wrong for a picker that must be whole before anyone can judge it.
3. **A hook in `packages/data` that reads the pages one after another into one cache entry, up to a cap.**

At the cap there were two choices: answer the rows read so far and flag them (`truncated`), which is what F3 first built, or fail. The owner chose to fail: pointed at a stock list, the hook must fail loudly, not hang the browser or hand a screen part of a list that looks whole.

## Decision

Option 3: `useApiAllPages(operationId, input, options)`.

- **Which operations:** only operations whose answer is `{ data: [...], page: PageInfo }`. The type `PagedOperationId` is derived from the contract.
- **How it reads:** it follows `nextCursor` while `hasMore`, for at most `MAX_ALL_PAGES` (5) pages, which is 500 rows at the maximum page size. It answers `{ items }`.
- **The cap is hard.** If the fifth page still says `hasMore`, the read throws `PageCapExceededError`: an `ApiError` with code `PAGE_CAP_EXCEEDED`, status 0 and the operation id in its message. It is not transient, so it is never retried. There is no partial answer. A screen checks the code and says in its own words that the list is too long, with no retry button, because reading the same pages again cannot help.
- **Cache:** the key is `[operationId, input, 'all-pages']`, its own entry, because the shape differs from one page's. The first element is still the operation id, so the usual same-resource invalidation reaches it.
- **Freshness:** the same stale classes apply. Permissions use `reference`.
- **Failure:** if any page fails, the whole read fails, with the normalised error. Retry and permission denied behave as they do for `useApiQuery`.

It is for short reference lists only. A list people browse keeps a cursor and `Pagination`.

## Consequences

- The role screen shows all 273 permissions grouped by area.
- Against Prism, every page answers with the same example, `hasMore: true` and the same cursor, so in a browser on `/mock` the hook reaches the cap and the role screen shows the too-long state (A-F3-16). The integration and e2e harnesses answer a page whose `nextCursor` is the cursor it was asked with as the last page, so tests see the example's permissions. The role screen removes the duplicates by permission code.
- If a reference list grows past 500, its screen stops working, in words, and that list needs a search instead. That is on purpose: a wrong choice of hook shows up the first time it runs.
