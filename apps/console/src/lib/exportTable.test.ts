import { tableToCsv } from './exportTable';

describe('tableToCsv', () => {
  it('writes the table as it reads: headers, formatted values, two-line cells joined, quotes escaped', () => {
    document.body.innerHTML = `
      <table>
        <thead><tr><th>Lot</th><th>Value at cost</th><th>Note</th></tr></thead>
        <tbody>
          <tr data-loading-row=""><td>…</td><td></td><td></td></tr>
          <tr><th><span>Goat</span>\n<code>G-0142</code></th><td>GH₵612.50</td><td>Said "fine", ok</td></tr>
          <tr><th>Beef</th><td>-0.400</td><td>=SUM(A1)</td></tr>
        </tbody>
      </table>`;
    const csv = tableToCsv(document.querySelector('table') as HTMLTableElement);
    expect(csv.split('\r\n')).toEqual([
      'Lot,Value at cost,Note',
      'Goat · G-0142,GH₵612.50,"Said ""fine"", ok"',
      // A plain negative number stays a number; a formula is defused.
      "Beef,-0.400,'=SUM(A1)",
    ]);
  });
});
