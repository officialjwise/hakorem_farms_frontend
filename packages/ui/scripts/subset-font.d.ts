// subset-font ships without type declarations. Only the calls this repo makes are typed.
declare module 'subset-font' {
  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: {
      targetFormat?: 'woff2' | 'woff' | 'truetype' | 'sfnt';
      /** A number pins the axis; a range keeps only that part of it. */
      variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
    },
  ): Promise<Buffer>;
}
