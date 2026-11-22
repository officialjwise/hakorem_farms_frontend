/**
 * The server side of the contract request the e2e build is built against (ADR 0046): CR-033's receipt
 * fields, answered in exactly the requested shape. Nothing here is in the contract yet; it goes when the
 * request lands. CR-032's PINs and CR-050's witnesses landed in 2.17.0 (`tillPins.ts`, `till.ts`).
 */

/** CR-033: the receipt page the till builds the link from. */
export const RECEIPT_LINK_TEMPLATE = 'https://hakoremfarms.com/r/{saleId}';
