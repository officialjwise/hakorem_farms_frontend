/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { PriceBandDisplay } from './PriceBandDisplay';

declare const maybe: {
  floorPricePesewas: number;
  ceilingPricePesewas: number;
  listPricePesewas: number;
} | null;

const band = { floorPricePesewas: 1, ceilingPricePesewas: 2, listPricePesewas: 2 };

export const valid = [
  <PriceBandDisplay key="1" band={band} basisLabel="per head" toLabel="to" listPriceLabel="List" />,
  <PriceBandDisplay
    key="2"
    band={maybe}
    notApplicableLabel="Quote only"
    basisLabel="per kg"
    toLabel="to"
    listPriceLabel="List"
  />,
];

export const invalid = [
  // @ts-expect-error basisLabel is required
  <PriceBandDisplay key="a" band={band} toLabel="to" listPriceLabel="List" />,

  // @ts-expect-error basisLabel cannot be an empty string
  <PriceBandDisplay key="b" band={band} basisLabel="" toLabel="to" listPriceLabel="List" />,

  // @ts-expect-error notApplicableLabel is required when band can be null
  <PriceBandDisplay key="c" band={maybe} basisLabel="per kg" toLabel="to" listPriceLabel="List" />,

  // Cost has no place here.
  <PriceBandDisplay
    key="d"
    band={band}
    basisLabel="per head"
    toLabel="to"
    listPriceLabel="List"
    // @ts-expect-error unknown prop: this component shows selling prices only
    unitCostPesewas={100}
  />,
];
