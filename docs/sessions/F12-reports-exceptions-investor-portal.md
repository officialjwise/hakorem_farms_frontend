# F12: the daily exception report, the ledger's statements, egg and VAT reports, exports and the investor portal

- **Session:** F12, on branch `claude/gallant-hawking-li9tmk`, from `main` at `5242161` (F10m, PR #35), rebased onto `a7b1513` (F10n, PR #36, contract 2.17.0).
- **Date:** 2026-11-19 to 2026-11-22
- **Ran beside:** F10n, the till's and quotes' session.
  - It synced 2.17.0 and took CR-058, so this session's requests are **CR-059 to CR-062**. They were written as CR-058 to CR-061 and renumbered at the rebase (`bb9824d`).
  - It took ADR 0057, so this session's is **0058**.
- **Not touched:** quotes, wholesale, credit, dunning, orders and the till's screens.
  - Shared files changed, small: the switch list, `landed.ts`, the builds' `HK_REQUESTED_CONTRACT`, `CLAUDE.md`, `DEPLOYMENT.md`, `PERFORMANCE_BUDGET.md` and the auth seam (below).
  - Also the header's exception list (a link), the dashboard (a link) and `ReasonDialog` (an optional field label).
- **Screenshots:** none were taken, opened or committed. Every screen is checked by its spec: 360 px, no sideways scroll, axe, in both themes.

## The gate

The owner reads today's position, including what went wrong today, without asking anyone.

- **Today's position** is the dashboard (F5b), unchanged. Its "exceptions today" line now links to the report.
- **What went wrong today** is `e2e/specs/console/exceptions.spec.ts`, against the production build, in both themes:
  1. The owner signs in, opens the header's exception list and follows "Open the daily exception report".
  2. Today's report lists every item urgent first: severity, branch, who, when, the amount and the record behind it (a voided sale links to its order).
  3. The owner marks the urgent stock conflict reviewed with a note. An empty note is refused in words.
  4. The item then says "Reviewed by Ama Mensah" with the note. It stays among the urgent items, after the one nobody has reviewed.
  5. One `reviewException` reached the fake, for that item.
- A day with nothing raised says so. A cashier gets the permission-denied state on the same URL.

## What was built

### The daily exception report (`/exceptions`)

- One `getDailyExceptionReport` call for a business day (today in Accra by default) and the header's branch.
- **What went wrong:** each item is a card. It shows its severity in words (urgent is the strong badge), the control in words, the API's summary, branch, who, when and amount. It links to the record behind it where the back office has a screen for that document type (`exceptions/records.ts`), and names the record in words where it has none. It also names its threat model cases.
- **The order:** urgent, then review, then information. Within each, what nobody has reviewed comes first, then the newest (A-F12-03). The screen orders; it counts nothing.
- **What each control raised:** the API's `counts`, by control, with their amounts.
- **Who, and how often:** each non-empty `RateByUser` group (voids, overrides, refunds, tills over or short, driver short, deaths by handler, adjustments, exports), with the person's rate and the role average, and who approved whom.
- **Reviewing (CR-059):** an Owner or a Manager (`rpt.exceptions.review`) marks an item reviewed with a note of up to 500 characters, in `ReasonDialog`.
  - It is a requested write (`requested/exceptionReview.ts`, ADR 0046, ADR 0053), switched on in the e2e and CI builds.
  - Without the switch the report says once that reviewing waits for the backend, and offers no button.
- **Its file (CR-062):** XLSX and PDF of `DAILY_EXCEPTIONS` appear once `listReportDefinitions` lists the code.
- **Words** for the five controls the owner named that have no kind yet (CASH_DROP and the rest, CR-059). A kind the build does not know shows its code.
- The sidebar has "Exception report" under Reports, behind `rpt.exceptions.read`.

### Reports (`/reports`)

The list is in four groups: sales and stock, the ledger, eggs, and tax.

- **Profit and loss, the balance sheet and the trial balance**, each from its own operation, by branch (the header's) and period.
  - Profit and loss and the balance sheet share one statement view: section totals as tiles, the lines in the statement's own order, and a negative amount said in words. The API's checks show as passed, or as failed and in red.
  - The balance sheet is "as at" a day (`getBalanceSheet`).
  - The trial balance (`getTrialBalance`) shows each account's opening, period and closing debits and credits, a page at a time. Its totals come from the API, never from the page, and "balances" or "does not balance" is said in words.
- **The four egg reports (CR-060) and the VAT return (CR-061)** run on `runReport` like every other report, once `listReportDefinitions` lists their code.
  - Until then the card and the page say they wait for the backend. No console change is needed when they land.
  - The egg valuation is "as at" a day.
- **Exports:** every `runReport` report keeps XLSX and PDF. Profit and loss, the balance sheet and the trial balance offer them once their codes are listed (CR-062). Every table also offers "This page as CSV".

### The investor portal (ADR 0058, proposed)

- **A third console document**, `investor.html`, for `/investor` and below. It imports nothing from the back office's or the till's routes.
  - Its router's base is `/investor`, so the shared sign-in screens serve it unchanged at `/investor/login`. They sign in with `loginInvestor`: `AuthProvider` takes a `realm`, and `AuthClient` gains `loginInvestor`.
  - Five pages:
    - the summary (share, units, capital, allocated, paid, outstanding, and the returns from the API with "not yet meaningful" for a null);
    - contributions and withdrawals;
    - distributions;
    - the capital statement for a period, with its PDF when the API gives one;
    - documents, each by a signed link asked for on a click.
- **Isolation:**
  - The pages call only the `/investor/*` operations, which the server scopes to the session.
  - The e2e spec checks that every operation the investor's browser called is one of them, and that the back office's entry script never loaded.
  - A staff session in the portal, and an investor's in the back office or the till, see "You are signed in as …" in words with "Sign out", and nothing behind it.
  - The staff sign-in refuses an investor, and the portal's refuses staff.
- **The mock:** the dev and preview proxy and the integration setup add the investor cookie beside the staff one. The e2e fake holds one investor, Esi Bonsu. It refuses an investor operation to a staff session, and a staff operation to an investor's, with the contract's 401.

## The contract

- **Built on 2.16.0, merged on 2.17.0.**
  - The first sync (backend `475378e`, 2.17.0) carried CR-032 and CR-050, the till's, so it was not committed here; F10n took it (PR #36).
  - After the rebase every check ran again on 2.17.0. 2.17.0 changes no reporting, ledger or investor shape.
- **Moved from the mock to the real API: none.** The contract says `runReport`, the exception report and the reports "are not answered by the API until B12". The ledger statements and the investor operations have no backend session report saying they are live. Every F12 screen runs against the mock.

## Contract requests added

| Id     | What                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CR-059 | Marking a daily exception reviewed (`reviewException`, `ExceptionItem.review`, `listExceptions?reviewed`); five kinds for controls with none; `rpt.exceptions.*` seeded for the Owner and the Manager. |
| CR-060 | Four egg report codes: sales by shop, margin per crate after breakage, breakage by reason and shop, stock valuation.                                                                                   |
| CR-061 | `VAT_RETURN`: VAT, NHIL and GETFund, output, input and net due, per levy.                                                                                                                              |
| CR-062 | The statements and the exception report as files (`PROFIT_AND_LOSS`, `BALANCE_SHEET`, `TRIAL_BALANCE`, `DAILY_EXCEPTIONS` on `runReport`); `rpt.report.*` seeded.                                      |

## Decisions recorded

- **ADR 0058 (proposed):** the investor portal is a third console document under `/investor`.
- **A-F12-01:** where the portal lives, until the owner confirms.
- **A-F12-02:** the portal's budget is the till's, 250 kB.
- **A-F12-03:** the exception report's order.
- **`fakeRoles.test.ts`** has a `REQUESTED` list for permissions a request asks for and the contract does not name yet (`rpt.exceptions.review`). Its line fails when the contract names it.

## Gates, each run on its own

| Check                                                     | Exit | Count                                                                                      |
| --------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| `format:check`, `lint`, `typecheck` (every package)       | 0    |                                                                                            |
| `sync-contract:check`                                     | 0    | 2.17.0, backend `475378e` (from main, PR #36)                                              |
| `test:unit`                                               | 0    | console 352, ui 901, storefront 42, data 33, api-client 30, i18n 6                         |
| `test:integration`                                        | 0    | console 280 (the exception report's 2, the reports' 5, the portal's 4); storefront 20      |
| `budget:console`                                          | 0    | till 247.4 of 250 kB; back office 291.6 of 300 kB; investor portal 225.2 of 250 kB (below) |
| `test:e2e`, full run                                      | —    | see the PR                                                                                 |
| `tokens:check`, `fonts:check`, `icons:check`, `test:a11y` | n/r  | not run: no token, font, icon or `packages/ui` change                                      |

**Fixed while getting here:**

- **The header's exception list stayed open** after its new link navigated, and axe found its scrolling list unreachable. The list now closes when the link is followed.
- **An export's formats are buttons, not menu items.** An integration assertion that looked for a "PDF" menu item passed against nothing. It now looks for the buttons, and for "This page as CSV" too.

## For the owner

1. **Where the investor portal lives (ADR 0058, proposed).** It is a third console document at `/investor`, so an investor's browser never loads the back office. A production host needs one more rewrite (DEPLOYMENT.md section 7). Say if you want it elsewhere; the screens move as they are.
2. **The third document costs the till 2.5 kB.** The shared code splits into more, smaller chunks, so the till is at 247.4 of 250 kB and the back office at 291.6 of 300 kB. Merging the small chunks is a bundler setting, Rolldown's `codeSplitting` groups. Say if the next session should try it; it changes ADR 0030's build.
3. **Until B12 is seeded, no role can open the reports or the exception report against the real API.** No seeded role holds `rpt.report.read` or `rpt.exceptions.read` (CR-059, CR-062).
4. **Five controls have no kind of their own** in the contract: cash drops, reused photographs, quotes accepted in a staff session, cash handed in late, and negative stock (CR-059). The report shows whatever kind the backend raises them under. The words for the five are ready.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F12-reports-exceptions-investor-portal.md.
Read ADR 0046, 0053 and 0058. No screenshots until F13.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.17.0.
   - CR-059 landed (landed.ts fails): delete requested/exceptionReview.ts and its id, call
     useApiMutation('reviewException'), and read ExceptionItem.review from the generated type; delete
     rpt.exceptions.review from REQUESTED in fakeRoles.test.ts.
   - CR-060, CR-061, CR-062 landed: nothing to switch. The reports run once listReportDefinitions lists
     their codes; check each code's columns in its named example.
   - B12 seeded: delete the rpt.* lines in NOT_SEEDED as they fail.
2. The owner's answers to this report's "For the owner": the portal's place; merging the small chunks.
3. F13, as BUILD_PROMPT says: the smoke suite opens /investor and expects the portal's sign-in.
```
