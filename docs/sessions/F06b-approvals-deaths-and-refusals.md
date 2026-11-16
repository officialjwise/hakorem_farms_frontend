# F6b: the approvals inbox, death reports from the pen, photographs and refusals in words

- **Session:** F6b, on branch `claude/dazzling-einstein-1sazsj`, from `main` at `648ad26` (F6 merged).
- **Date:** 2026-11-15
- **Scope:** the owner's decisions on top of the F6 report's opening message. F7 moves to the next session (A-F6b-05).
  1. TOTP enrolment, issue #4, and the test fake's roles.
  2. Photo uploads.
  3. Death reports from farm hands.
  4. The approvals inbox.
  5. Refusal codes in words.
  6. An issue for the F5b dashboard flake.

## First: F6 merged

- **PR:** [officialjwise/hakorem_farms_frontend#12](https://github.com/officialjwise/hakorem_farms_frontend/pull/12).
- **Its CI run** (`checks`, run 43770087071) was green on the first attempt, and it was merged at `648ad26`.
- **`main`'s push run** after the merge (run 43770921260) was green too.
- **"Both CI runs"** was read as the PR's run and `main`'s push run (A-F6b-01). CI runs on `pull_request` and on `push` to `main` only, so an unmerged branch has one run.

## The contract, 1.24.0 to 1.28.0

Synced with `pnpm sync-contract:github`: backend `7c5ff132`, 630 operations. The build broke, as it should, and these were answered first:

- **1.26.0, LOUD, `printPackLabels`.** It answers `PackLabelSheet`, not a PDF link. The order's packs section now draws each label from the API's data:
  - a Code 128 barcode, the printed line, dates and storage;
  - a reprint marked on the paper;
  - printed with the browser, with an `Idempotency-Key`.

  `Pack` gains `REVERSED`.

- **1.26.0, LOUD, the Farm hand's care operations.** The full writes refuse a caller without the read.
  - The health and feed forms use their care twins for such a role.
  - The animal picker searches `listCareAnimals` (`q`), which answers **CR-021**.
  - The feed form offers `listCareRations`.
- **1.26.0, reversal.** A completed processing order can be reversed by the Owner and the Manager (`prc.order.reverse`).
  - A confirmation names the order's total cost and each output's weight first.
  - A reversed order says by whom, when and why.
- **1.25.0, corrected examples.** The integration tests follow the new daily gain (0.159) and the breeding records.
- **1.28.0, purchase to pay.** There are no PUR screens yet. The inbox shows its `PURCHASE_ORDER` and `SUPPLIER_PAYMENT` requests.

## What was built

| Route                    | Screen                                                                                                                                               | Permission             | Reads / writes                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/login/enrol`           | TOTP enrolment on a first sign-in: the server's QR image, the key in text, a first code, then the recovery codes kept on screen until ticked as kept | none (sign-in)         | `startTotpEnrolment`, `confirmTotpEnrolment` (challenge in the body, CR-006), then `getCurrentSession`                            |
| `/report-death`          | A death or cull reported with its photograph and sent for approval in one step, from the pen                                                         | `liv.mortality.report` | `uploadFile` (multipart), `reportMortality` / `reportCareMortality`, `submitMortalityRecord` / `submitCareMortalityRecord`        |
| `/approvals`             | The approvals inbox: waiting on me, asked by me, all; every kind, `MORTALITY_WRITE_OFF` first                                                        | `iam.approval.read`    | `listApprovals`                                                                                                                   |
| `/approvals/:id`         | One request with its evidence: amount, who asked, the record, the photograph, a death's own record; approve, reject, withdraw                        | `iam.approval.read`    | `getApproval`, `getFile`, `createFileSignedUrl`, `getMortalityRecord`, `approveRequest`, `rejectRequest`, `cancelApprovalRequest` |
| `/processing-orders/:id` | Gains the reversal of a completed order, and draws pack labels                                                                                       | as before              | `cancelProcessingOrder` (reverse), `printPackLabels`                                                                              |

### 1. TOTP enrolment, issue #4 and the fake's roles

- **Enrolment.** It is built in both documents and loaded on demand. The test fake gains an Accountant who must enrol, and who is asked for a code from then on.
- **Issue #4.** F3 had already rewritten the spec against the real client and the fake's refresh. What was left was its exit condition: ten loaded full suites in a row with traces kept. **All ten were green, and the spec is out of quarantine** (below).
- **The fake's roles.** They follow what the contract says each role holds, since the seed itself is not readable here:
  - **Farm hand:** the writes it "holds but not the read" (1.26.0, nine of them), `liv.care.read`, and breeding and growth (1.25.0).
  - **Manager:** the four approving permissions from the `listRoles` example, the inbox, and `prc.order.reverse`.
  - **Accountant:** the four from the example.
  - **Still assumed** (A-F6b-02, CR-023): the Farm hand's location, product and reason reads, and its file upload.
- **The role matrix.** A search of the backend repository for the matrix was refused by the environment's safety check ("Unauthorized Access"). It was not attempted another way.

### 2. Photo uploads (A-F6-03: yes)

- **The generated client sends multipart** (ADR 0037). The generator marks each operation's body kind and types `format: binary` as `Blob`. `call()` builds the `FormData`, and keeps the key, the CSRF token and the refresh. An integration test uploads through Prism, which validates the body against the contract.
- **`PhotoInput` in `packages/ui`.**
  - The native file input is laid over a button face, so on a phone it opens the rear camera.
  - The picture is turned upright and shrunk in the browser to 1,600 px as a JPEG at 0.8, typically 150 to 400 KB, so it goes up on 3G.
  - It has six states, a story each, axe clean in both themes and densities.
  - The app passes the upload; the package never calls the API.
- **Purpose.** The contract has no purpose for a death photograph. It is uploaded as `EVIDENCE`, and **CR-022** asks.

### 3. Death reports from farm hands (A-F6-06)

- **The permission.** The contract says outright that the Farm hand holds the submit: "the Farm hand, who holds the write but not the read, uses `submitCareMortalityRecord`". No contract request was needed for it. **CR-023** asks the backend to confirm it in the published matrix.
- **The page.** `/report-death` is one page for every reporter (ADR 0039). The animal page, the deaths list and the weights page open it. The report and its submit go in one step, so the reporter is the maker.
- **It never dead-ends:**
  - the photograph is required on every report (A-F6b-03);
  - a refusal stays on screen in words;
  - a report whose submit did not get through stays on the page with "Send it again", and is remembered on the device until it is answered (A-F6b-04).
- **The gap left** is a lost phone with an unsent report. **CR-024** asks for the reporter's own records without the value.

### 4. The approvals inbox

- **Scope.** Every kind the contract names is in the filter, `MORTALITY_WRITE_OFF` included. "Waiting on me" is the server's `decidableByMe`, so it never holds the maker's own requests.
- **The evidence.** A request shows, before any decision:
  - the amount, who asked, when it lapses, and the record;
  - the photograph, through a five-minute signed link once it is `CLEAN`;
  - for a death, the record with the value written off.
- **The maker** sees neither Approve nor Reject on their own request, only why, and Withdraw. If the server still refuses (`MAKER_CANNOT_CHECK`), the refusal stays in the dialog in words; the e2e spec proves it.
- **Processing reversals** do not reach the inbox. The contract makes a reversal immediate for the Owner and the Manager, with no approval. **CR-025** asks whether it should wait for a second person.
- **Transfer write-offs, purchase orders and supplier payments** arrive with a `STOCK_ADJUSTMENT` subject in their examples. **CR-026** asks for the right subjects.

### 5. Refusal codes in words (ADR 0038)

- **Words for every code.** `common:refusals` covers all 83 codes the contract lists in `x-error-codes`, and the rule codes it names in `details[]`.
- **Applied once.** The console's API client says every refusal in those words where it throws, so every failure on every screen shows them. The server's sentence is used for any code or rule without words.
- **Guarded by a test.** A unit test reads the contract and fails if a documented code has no words.
- **A-F6-07 is resolved.** A refused branch close now names the farm and the stock.

### 6. The dashboard flake

- **Issue:** [officialjwise/hakorem_farms_frontend#13](https://github.com/officialjwise/hakorem_farms_frontend/issues/13). It records what is known and what is not: the F6 report named neither the test nor its error.
- **CI:** it did not fail on the PR #12 run, nor in this session's ten full runs.

## Moved from the mock to the real API

**None.** CI and e2e build against `/mock`, and no backend runs here. Per the changelog, these answer from the real API and are ready to move once a live check is possible:

- the care operations (1.26.0);
- packs and labels (1.26.0);
- the remaining livestock operations (1.25.0);
- the purchase-to-pay operations (1.28.0).

## Contract requests added

- **CR-022:** a death photograph's purpose and scan, and who may open it.
- **CR-023:** publish the seeded role matrix, and confirm the Farm hand's role.
- **CR-024:** a reporter's own deaths and culls, without the value.
- **CR-025:** should reversing a completed processing order need a second person?
- **CR-026:** the approval examples name the wrong subject.

CR-021 is marked answered (1.26.0), and CR-006 built.

## Assumptions

A-F6-02 is partly resolved; A-F6-03, A-F6-06 and A-F6-07 are resolved. A-F6b-01 to 06 are new, and the ones that need an answer are:

- **A-F6b-02:** the Farm hand's reads and upload.
- **A-F6b-03:** a photograph on every report.
- **A-F6b-06:** flocks are reported from the deaths list, not from the pen page.

## Decisions recorded

- ADR 0037: photographs shrunk in the browser, uploaded as multipart through the generated client.
- ADR 0038: every refusal in the console's words, once, where the client throws.
- ADR 0039: a death reported and sent in one step from its own page; an unsent one remembered on the device.

## Gates, each run on its own

| Check                                                               | Exit | Count                                                                                                               |
| ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`                                 | 0    |                                                                                                                     |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0    |                                                                                                                     |
| `test:unit`                                                         | 0    | ui 812, console 172, data 28, api-client 26, storefront 14, i18n 6                                                  |
| `test:integration`                                                  | 0    | 225, against the real Prism                                                                                         |
| `test:a11y`                                                         | 0    | 297 stories, axe, both themes and densities                                                                         |
| `build-storybook`, `build:console`, `build:storefront`              | 0    |                                                                                                                     |
| `budget:console`                                                    | 0    | back office 277.0 of 300 kB initial script (was 271.4); till 207.9 of 250 kB (was 202.8)                            |
| `test:e2e`, ten full runs in a row (issue #4)                       | 0    | 232 of 232 in each of ten runs, the quarantined spec included, 3.7 to 4.1 minutes a run, at `901f6af`               |
| `pnpm screenshots`                                                  | 0    | 214 shots. Only `docs/screenshots/F06b/` is committed; the earlier phases keep the shots taken when they were built |

### What the gates found, and what was done

- **Integration, under load:** the dashboard's first case and three F6/F6b cases waited only 1 second for a cold, lazily loaded screen. F5b had given its files 5 seconds for that, so they failed under load and passed alone. The cause is named in `5e28887`, which gives the first wait per cold screen the same allowance. There is no retry.
- **The first full e2e run found a real bug:** a refused branch close lost its rule words. The contract's details name the field `/status`, which the close confirmation does not have, and the refusal words left every detail with a field to the form. That was fixed in `901f6af` with a unit test, and ADR 0038 says so. The ten runs were then started again from scratch on the fixed build.
- **Issue #4:** the spec leaves quarantine (`bcbb79e`, `closes #4`), and the evidence is on the issue. Its intermittent failure was never reproduced after F3's rewrite, so its cause is still unconfirmed.
- **Issue #13 (the dashboard flake):** it did not recur in the ten runs, and that is recorded on the issue. It stays open.

## For the owner

- **The first load.** The back office's is 277.0 of 300 kB (5.6 kB more, mostly the refusal words) and the till's 207.9 of 250 kB.

## The owner's decisions after the session (2026-11-16)

1. **Pull requests:** every phase opens its PR and merges it once CI is green, without asking. This is now in `CLAUDE.md`, and this branch's PR was opened under it.
2. **A-F6b-02:** the Farm hand reads the death reasons, and the backend has been asked to grant it.
3. **A-F6b-03:** approved, a photograph on every death report. The backend is being asked to enforce it for Farm hand reports too.
4. **A-F6b-05:** F7 runs in its own session.
5. **CR-022:** `EVIDENCE` is the intended purpose; the backend confirmed it, and the request is closed.
6. **CR-024:** closed as a known gap. A phone lost with an unsent report shows up as a missing animal at the next stock take.
7. **CR-025:** a processing reversal at or above the threshold will need a second approver, which the backend adds in B06r. The inbox takes it when the contract carries it.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F06b-approvals-deaths-and-refusals.md.

First: pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 1.28.0. Answer
what it changes before anything else: B06r's approval for processing reversals (CR-025, wire it into the
order page and the inbox), CR-023 (align the test fake's roles with the matrix if it is published) and CR-026.

Then F7 as BUILD_PROMPT describes: storefront catalogue, search, filters, product detail, cart, checkout and
delivery slots. Gate: checkout completes on a throttled 3G connection and the catch-weight estimate is
unmissable. Re-measure the storefront budget.
```
