/**
 * CR-045, a quote line's unit, as `docs/CONTRACT_REQUESTS.md` asks for it (ADR 0046). `QuoteLineInput` has
 * no `uom` yet, so a quote cannot say whether a line of big eggs is in crates or single eggs. Only a build
 * switched on for CR-045 sends it; this file goes when the contract carries `QuoteLineInput.uom`.
 */
import type { components } from '@hakorem/api-client';
import { requestedOn } from './switch';

type Schemas = components['schemas'];

/** `QuoteLineInput` with the requested unit: the product's sale unit when left out (CR-045). */
export type QuoteLineInputWithUnit = Schemas['QuoteLineInput'] & { uom?: string };

/** Whether this build may send a line's unit, and so offer a line by the single egg. */
export function quoteLineUnitOn(): boolean {
  return requestedOn('CR-045');
}

/** The line as sent: with its unit only in a build switched on for CR-045. */
export function withQuoteLineUnit(
  line: Schemas['QuoteLineInput'],
  uom: string,
): QuoteLineInputWithUnit {
  return quoteLineUnitOn() ? { ...line, uom } : line;
}
