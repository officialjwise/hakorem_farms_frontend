/** WCAG 2.x relative luminance and contrast ratio for #RRGGBB colours. */

function channel(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  const [, r, g, b] = m ?? [];
  if (r === undefined || g === undefined || b === undefined)
    throw new Error(`Expected #RRGGBB, got "${hex}"`);
  return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)];
}

/**
 * A colour with an alpha channel: #RRGGBBAA. Used by the scrim token, whose
 * opacity lives in its value because opacity modifiers are banned (ADR 0004).
 */
export function parseHexAlpha(hex: string): { rgb: [number, number, number]; alpha: number } {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(hex);
  const [, rgbHex, alphaHex] = m ?? [];
  if (rgbHex === undefined || alphaHex === undefined)
    throw new Error(`Expected #RRGGBBAA, got "${hex}"`);
  return { rgb: parseHex(`#${rgbHex}`), alpha: parseInt(alphaHex, 16) / 255 };
}

function toHex(byte: number): string {
  return Math.round(byte).toString(16).padStart(2, '0').toUpperCase();
}

/**
 * The opaque colour a translucent #RRGGBBAA shows when painted over an opaque
 * #RRGGBB base: the "source over" composite, per channel.
 */
export function composite(top: string, base: string): string {
  const { rgb, alpha } = parseHexAlpha(top);
  const under = parseHex(base);
  const mixed = rgb.map((c, i) => c * alpha + (under[i] as number) * (1 - alpha));
  return `#${mixed.map(toHex).join('')}`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}
