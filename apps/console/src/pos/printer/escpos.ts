/**
 * The receipt as a 58 mm ESC/POS printer takes it (ADR 0045): 32 characters a line in font A, plain ASCII
 * (the cedi sign is not in a thermal printer's code pages, so money is written `GHS 1,234.50`, the
 * formatters' document form), the sale reference printed and labelled as a sale reference, never as a
 * receipt number, and a QR code the printer draws itself (`GS ( k`), so the till needs no QR library.
 *
 * Pure: words in, bytes out. The words come from the caller in the till's language; nothing here
 * computes money, it prints the receipt's own figures.
 */
import { formatDateTime, formatMoney, formatQuantity, formatWeight } from '@hakorem/ui';
import type { ReceiptContent } from '../offline/types';

export const COLUMNS = 32;

export interface PrintWords {
  business: string;
  copy: string;
  register: string;
  cashier: string;
  saleReference: string;
  receiptNo: string;
  receiptNoFollows: string;
  total: string;
  change: string;
  handed: (tender: string) => string;
  unverified: string;
  reference: string;
  scan: string;
  saleId: string;
  thanks: string;
}

export interface PrintInput {
  receipt: ReceiptContent;
  officialNo: string | null;
  /** A reprint: printed as a copy at the top, never a new receipt. */
  copy: boolean;
  /** The customer's receipt page (CR-033), or null: the QR then carries the sale id (OFFLINE_SYNC 4.3). */
  link: string | null;
  words: PrintWords;
}

/** Plain ASCII: accents dropped, anything else a question mark, so a printer never prints garbage. */
export function ascii(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '?');
}

const money = (pesewas: number) => formatMoney(pesewas, { context: 'document' });

/** Words wrapped to the line, breaking a word longer than a line. Leading spaces indent every line. */
export function wrap(text: string, width = COLUMNS): string[] {
  const indent = /^ */.exec(text)?.[0] ?? '';
  if (indent !== '')
    return wrap(text.slice(indent.length), width - indent.length).map((l) => indent + l);
  const lines: string[] = [];
  let line = '';
  for (const word of ascii(text)
    .split(/\s+/)
    .filter((w) => w !== '')) {
    let rest = word;
    while (rest.length > width) {
      if (line !== '') {
        lines.push(line);
        line = '';
      }
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    if (line === '') line = rest;
    else if (line.length + 1 + rest.length <= width) line = `${line} ${rest}`;
    else {
      lines.push(line);
      line = rest;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** A label on the left and a figure on the right of one line; the label wraps above when both cannot fit. */
export function pair(label: string, value: string, width = COLUMNS): string[] {
  const left = ascii(label);
  const right = ascii(value);
  if (left.length + 1 + right.length <= width) {
    return [`${left}${' '.repeat(width - left.length - right.length)}${right}`];
  }
  return [...wrap(left, width), right.padStart(width)];
}

const RULE = '-'.repeat(COLUMNS);

/** The receipt's lines, as they print. Exported for its tests and for the on-screen preview's words. */
export function receiptLines(input: PrintInput): {
  header: string[];
  body: string[];
  footer: string[];
} {
  const { receipt, officialNo, copy, words } = input;
  const header = [
    ...(copy ? wrap(words.copy) : []),
    ...wrap(words.business),
    ...wrap(words.register),
    ascii(formatDateTime(receipt.occurredAt)),
    ...wrap(words.cashier),
  ];
  const body: string[] = [
    RULE,
    ...pair(words.saleReference, receipt.provisionalRef),
    ...pair(words.receiptNo, officialNo ?? words.receiptNoFollows),
    RULE,
  ];
  for (const line of receipt.lines) {
    body.push(...wrap(line.name));
    const detail = [
      line.stockUnitIdentifier,
      `${line.weightKg !== null ? formatWeight(line.weightKg) : `${formatQuantity(line.quantity, { places: 0 })} ${line.saleUom.toLowerCase()}`} @ ${money(line.unitPricePesewas)}`,
    ]
      .filter((part) => part !== null)
      .join(' ');
    body.push(...pair(`  ${detail}`, money(line.amountPesewas)));
  }
  body.push(RULE, ...pair(words.total, money(receipt.totalPesewas)));
  for (const tender of receipt.tenders) {
    body.push(...pair(tender.name, money(tender.amountPesewas)));
    if (tender.unverified === true) {
      body.push(...wrap(`  ${words.unverified}`));
      if (tender.reference !== undefined && tender.reference !== null) {
        body.push(...wrap(`  ${words.reference} ${tender.reference}`));
      }
    }
    if (tender.tenderedPesewas !== null) {
      body.push(...pair(words.handed(tender.name), money(tender.tenderedPesewas)));
    }
  }
  body.push(...pair(words.change, money(receipt.changePesewas)), RULE);
  const footer = [
    ...wrap(words.scan),
    ...wrap(words.saleId),
    ...wrap(receipt.saleId),
    ...wrap(words.thanks),
  ];
  return { header, body, footer };
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const INIT = [ESC, 0x40];
const ALIGN = { left: [ESC, 0x61, 0], centre: [ESC, 0x61, 1] } as const;
const BOLD = (on: boolean) => [ESC, 0x45, on ? 1 : 0];
/** Feed four lines past the tear bar; most 58 mm printers have no cutter. */
const FEED = [ESC, 0x64, 4];

function text(lines: readonly string[]): number[] {
  return lines.flatMap((line) => [...Array.from(line, (c) => c.charCodeAt(0)), LF]);
}

/** A QR code drawn by the printer (model 2, module size 5, error correction M). */
export function qrCommand(data: string): number[] {
  const bytes = Array.from(ascii(data), (c) => c.charCodeAt(0));
  const length = bytes.length + 3;
  return [
    ...[GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0],
    ...[GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 5],
    ...[GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31],
    ...[GS, 0x28, 0x6b, length & 0xff, length >> 8, 0x31, 0x50, 0x30, ...bytes],
    ...[GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30],
  ];
}

export function encodeReceipt(input: PrintInput): Uint8Array {
  const { header, body, footer } = receiptLines(input);
  const [first, ...restOfHeader] = header;
  return new Uint8Array([
    ...INIT,
    ...ALIGN.centre,
    ...BOLD(true),
    ...text(first === undefined ? [] : [first]),
    ...BOLD(false),
    ...text(restOfHeader),
    ...ALIGN.left,
    ...text(body),
    ...ALIGN.centre,
    ...qrCommand(input.link ?? input.receipt.saleId),
    LF,
    ...text(footer),
    ...FEED,
  ]);
}
