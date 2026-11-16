# Open questions

Questions that are not design decisions and are not ours to answer: each names who answers it. A design that depends on an answer says so and links here. When a question is answered, record the answer, its date and its source, and update whatever depends on it.

## For whoever answers the business's tax questions

### Q-TAX-01. Must the farm issue a numbered receipt or a VAT invoice at the counter?

- **Raised:** 2026-11-16, by the owner, answering the F9 report.
- **The question:** whether a farm selling retail at the shop's volumes must issue each customer a numbered receipt, or a VAT invoice, and if so what it must carry and whether a digital copy (SMS or link) satisfies the obligation or a printed one is required.
- **Why it matters:** every till sale gets a digital receipt and a printer is optional (ADR 0045). The official receipt number is assigned by the server at sync, after the customer may have left with only the sale reference. If the law requires a numbered or certified document at the point of sale, or on paper, the receipt design must add to that.
- **Related:** the shared brief's note that the Ghana Revenue Authority's invoicing rules may require electronic invoice certification, recorded in the backend's `docs/security/COMPLIANCE.md`; ADR-0020 (the backend's optional certified-total fields).
- **Answer:** open.
