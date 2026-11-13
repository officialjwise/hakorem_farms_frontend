import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { formatMoney, formatWeight, type FormatContext } from './format';

const meta = {
  title: 'Foundations/Formatting',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const CONTEXTS: { context: FormatContext; name: string }[] = [
  { context: 'interface', name: 'Interface' },
  { context: 'document', name: 'Document' },
  { context: 'export', name: 'Export (CSV)' },
];

/** Story fixture values: integer pesewas and kilogram decimal strings, as the API sends them. */
const MONEY = [123450, -123450, 0, 100000000, null] as const;
const WEIGHT = ['38.4', '1250.5', '-1.5', null] as const;

function Cell({ children }: { children: string }) {
  return (
    <td className="border-b border-border px-3 py-1.5 text-end font-mono tabular-nums">
      {children}
    </td>
  );
}

/** The three contexts of ADR 0007, side by side, in both themes and densities. */
export const MoneyAndWeight: Story = {
  parameters: { matrix: true, matrixLayout: 'stack' },
  render: () => (
    <div className="overflow-x-auto">
      <table className="text-cell text-fg">
        <caption className="pb-2 text-start text-sm text-fg-muted">
          Money from integer pesewas, weight from kilogram strings.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="px-3 text-start text-head text-fg-muted uppercase">
              Context
            </th>
            {[...MONEY.map(String), ...WEIGHT.map((w) => `${w} kg`)].map((h) => (
              <th key={h} scope="col" className="px-3 text-end text-head text-fg-muted uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CONTEXTS.map(({ context, name }) => (
            <tr key={context}>
              <th
                scope="row"
                className="border-b border-border px-3 py-1.5 text-start font-semibold"
              >
                {name}
              </th>
              {MONEY.map((p) => (
                <Cell key={String(p)}>{formatMoney(p, { context })}</Cell>
              ))}
              {WEIGHT.map((w) => (
                <Cell key={String(w)}>{formatWeight(w, { context })}</Cell>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};

const CEDI = '₵';

/** Width of the cedi sign when drawn in the given font list. */
function cediWidth(fontList: string): number {
  const context = document.createElement('canvas').getContext('2d');
  if (context === null) throw new Error('Canvas 2D is unavailable.');
  context.font = `100px ${fontList}`;
  return context.measureText(CEDI).width;
}

/**
 * GH₵ rendered in the subset face, in the system sans stack and the mono stack.
 * The face must load for U+20B5, and must actually contain the glyph: if it did
 * not, the browser would fall back silently and draw the device's glyph (or
 * none), so the width with the face would equal the width without it.
 */
export const CediSignInSubsetFace: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid gap-2">
      <p className="text-3xl font-semibold text-fg" data-testid="cedi-sans">
        {formatMoney(123450)}
      </p>
      <p className="font-mono text-xl text-fg" data-testid="cedi-mono">
        {formatMoney(-98000)}
      </p>
      <p className="text-sm text-fg-muted">
        The sign is U+20B5, shipped in a 1.3 KB glyph-only face.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const loaded = await document.fonts.load('100px "HaKorem Cedi"', CEDI);
    await expect(loaded).toHaveLength(1);
    await expect(loaded[0]?.status).toBe('loaded');
    await expect(document.fonts.check('100px "HaKorem Cedi"', CEDI)).toBe(true);

    await expect(cediWidth('"HaKorem Cedi", monospace')).not.toBe(cediWidth('monospace'));

    for (const el of within(canvasElement).getAllByTestId(/cedi-/)) {
      await expect(getComputedStyle(el).fontFamily.startsWith('"HaKorem Cedi"')).toBe(true);
    }
  },
};
