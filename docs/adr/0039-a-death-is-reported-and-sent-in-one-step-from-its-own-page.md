# 0039. Report and send a death in one step, from its own page, and remember an unsent one on the device

- Status: accepted
- Date: 2026-11-15
- Session: F6b

## Context

The owner's rule for F6b: a death report must never dead-end. The farm hand is the maker. They record the death with its photograph at the pen and submit it from a page they can open, and a manager approves it.

F6 left four dead ends:

1. **Submitting needed the record's own page,** which needs `liv.mortality.read`. The Farm hand does not hold it, and only the reporter may submit (A-F6-06).
2. **The full writes now refuse the Farm hand** (contract 1.26.0, `x-answer-permission`). The care twins `reportCareMortality` and `submitCareMortalityRecord` are their door. The contract says the role "holds the write but not the read".
3. **A photograph could not be attached** (A-F6-03), and a loss at or above the threshold is refused without one. There is no edit, so the record stayed stuck.
4. **The contract has no cost-free read of a reporter's own records.** So a report whose submit is lost on a weak signal has no page to be sent from (CR-024).

## Options considered

1. **Report on one page, submit on another.** This is F6's shape. It needs a read the Farm hand does not have, and a second trip on one bar of signal.
2. **Report and submit in one action, on a page every reporter can open** (`/report-death`, `liv.mortality.report`). The reporter is the maker, and the server decides what follows: written off below the threshold, or 202 to a manager above it.
3. **Queue the whole report offline,** as the till will (ADR, F9). It is heavier, and the photograph must reach the server first anyway.

## Decision

- **One page for every reporter.** `/report-death` (`liv.mortality.report`) asks for:
  - the animal, from the care register for a role without `liv.animal.read`;
  - what happened and the reason;
  - a required photograph;
  - a disposal note.

  The animal page and the deaths list open it, the animal page with that animal fixed. The weights page links to it for the Farm hand.

- **The photograph is required for every report** (A-F6b-03). The reporter cannot see the value (the care shapes carry none), and a report above the threshold without one cannot be mended. It goes up first as `EVIDENCE` (ADR 0037).
- **"Send the report" does both writes in order.** A confirmation names the animal, the kind, the reason and that the photograph is attached; there is no amount, because the server values the loss. Then `report…Mortality` runs with a client UUIDv7, so a retry returns the first record, then `submit…Mortality` runs on that record. A role holding `liv.mortality.read` uses the full pair; anyone else uses the care pair.
- **Each answer gets persistent words:**
  - 202: sent for approval, nothing written off yet, a manager decides it in the approvals inbox;
  - 200: written off;
  - a refusal or a lost connection stays on screen in words (ADR 0038).
- **An unsent report is remembered on the device.** When the report is saved but the submit is not answered, the page keeps `{id, tag, kind, reportedAt}` in `localStorage`, under the reporter, and shows it with "Send it again". That button repeats the same submit with the same key. A reload, a closed tab and a lost signal lose nothing. Each entry is dropped once its submit is answered. Only what is needed to send the report is kept; the record is the server's.
- **The record page keeps its own submit** for a reported record that a reader opens.

## Consequences

- **The Farm hand reports and sends from the pen, and is never left without a next step.** The one gap left is a lost phone with an unsent report. The owner accepted it (CR-024, closed): the missing animal shows up at the next stock take.
- **No reason list means no report.** If a role cannot read the death reasons, the page says so in words and sends nothing. The owner confirmed that the Farm hand reads them (A-F6b-02).
- **The photograph is required even below the threshold,** which costs a cheap cull one picture. Revisit if the care shapes ever say whether a photograph is needed.
- **Revisit** when F9's offline queue exists, which could carry the whole report.
