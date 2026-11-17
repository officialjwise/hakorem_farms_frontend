# 0045. Every sale gets a digital receipt; a printer is optional, and the till never waits on the network

- Status: accepted (owner, 2026-11-16, answering the F9 report). Amends ADR 0043's receipt bullet. Amended by the owner 2026-11-17: no QR code anywhere but the TOTP enrolment image, so the link is shown and printed as text, never as a QR code.
- Date: 2026-11-16
- Session: F9 (after merge)

## Context

F9 built the till to print every receipt for an 80 mm roll through the browser's print, the printer being the device's (ADR 0043, A-F9-03), and asked the owner which printer the shop uses and whether an online sale should wait for its official number before printing.

The owner's answer rests on the stack. The till runs in a phone's browser. Web Bluetooth exists in Chrome on Android and does not exist in Safari on iOS, so an iPhone cannot drive a Bluetooth printer from the browser at all, and the business does not control which phones staff bring. A till designed around a printer fails on those phones.

## Options considered

1. **A printer at every till** (F9's design). Fails on every iPhone, and on any till whose printer is flat, out of paper or missing.
2. **A digital receipt for every sale, a printer where one happens to be.** The receipt goes by SMS or as a link, which works on every phone with no hardware. A till that finds a printer it can drive also prints.
3. **Wait for the official number when online, then print.** Rejected by the owner: a till that usually answers at once and sometimes waits on a round trip is worse than one that never waits, because staff cannot tell which moment they are in and a queue forms while they wonder.

## Decision

Option 2, and never option 3.

- **Every sale produces a digital receipt.** By SMS to the customer's number (`customerPhone`, which the contract already carries on a sale "for an SMS or WhatsApp receipt"), or as a link the customer opens on their own phone. The contract has no receipt page a customer can open from a link yet: CR-033.
- **A printer is a capability the till detects, never one it requires.** Where it exists, the till supports **58 mm ESC/POS over Bluetooth** (Web Bluetooth): the command set almost every cheap thermal printer speaks, which keeps the shop off any single model. On a browser with no Web Bluetooth (Safari on iOS), the till offers no printing and says so in words; the sale is unaffected. The F9 print-to-page path is not the receipt design.
- **The till never blocks a sale on the network, online or not.** The sale completes the moment the cashier confirms it, the same way every time.
- **What is printed or shown at once is the sale reference, labelled as a sale reference, never as a receipt number** (`P-T1-312-0001`, OFFLINE_SYNC 4.3). The server assigns the official receipt number at sync. The official number appears on the digital receipt and in the records, with the sale reference beside it on both, so the two can always be tied together (`BillingDocument.provisionalRef` already carries it).
- Whether a farm selling retail at the shop's volumes must issue a numbered receipt or a VAT invoice is **not decided here**. It is a question for whoever answers the business's tax questions (`docs/OPEN_QUESTIONS.md`, Q-TAX-01), and its answer may add to what the digital receipt must say; it does not change this design.

## Consequences

- The till sells on any phone, with or without a printer, and behaves the same online and offline.
- To build next, against the mock until CR-033 lands (see the F9 report's opening message): sending the digital receipt on sync and showing its link or QR code at the counter (needs CR-033); detecting a Bluetooth printer and printing 58 mm ESC/POS with the sale reference marked as such; removing the F9 80 mm print-to-page receipt.
- F9's receipt already labels the reference "Sale reference" and the official number "Receipt no. … Follows when sent" (changed with this ADR).
- Revisit if the shop standardises on Android devices with a known printer, or if Q-TAX-01 requires a printed document at the point of sale.
