// subset-font ships without type declarations. Only the call this repo makes is typed.
declare module 'subset-font' {
  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: { targetFormat?: 'woff2' | 'woff' | 'truetype' | 'sfnt' },
  ): Promise<Buffer>;
}
