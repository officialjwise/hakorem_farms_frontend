/**
 * The table on screen as CSV, exactly as it reads: the visible columns, in their order, with every value
 * already formatted by the formatters (money as "GH₵612.50", weight to three places). Nothing is
 * recomputed. A cell of two lines (a name over its code) keeps both, joined by " · ".
 */
export function tableToCsv(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll('tr')).filter(
    (row) => !row.hasAttribute('data-loading-row') && row.dataset.slot !== 'table-message-row',
  );
  return rows
    .map((row) =>
      Array.from(row.querySelectorAll<HTMLElement>(':scope > th, :scope > td'))
        .map((cell) => quote(text(cell)))
        .join(','),
    )
    .join('\r\n');
}

function text(cell: HTMLElement): string {
  // innerText follows layout (a block is a new line); jsdom has only textContent.
  const raw = typeof cell.innerText === 'string' ? cell.innerText : (cell.textContent ?? '');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' · ');
}

function quote(value: string): string {
  // A leading =, +, - or @ would run as a formula in a spreadsheet: prefix it so it stays text. A plain
  // negative number ("-0.400") is left alone.
  const formula = /^[=+\-@\t]/.test(value) && !/^-\d[\d,.]*$/.test(value);
  const safe = formula ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Saves the CSV with a byte order mark, so a spreadsheet reads GH₵ and accents correctly. */
export function downloadCsv(name: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replaceAll(/[\\/:*?"<>|]/g, '-')}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
