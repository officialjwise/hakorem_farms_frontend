import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useBarcodeTrap } from './useBarcodeTrap';

/**
 * A page with the trap, a button, a text field the operator uses on purpose, and a plain modal.
 * The modal here is jsdom's stand-in for markup only; the REAL trap against the REAL Radix Dialog is
 * proved in Chromium by e2e/specs/pos-barcode-dialog.spec.ts, which is the gate (ADR 0004, 0014).
 */
function Page() {
  const barcode = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  useBarcodeTrap(barcode);
  return (
    <div>
      <label>
        Barcode <input ref={barcode} />
      </label>
      <label>
        Note <input />
      </label>
      <button onClick={() => setOpen(true)}>Open</button>
      <p data-testid="plain">plain text</p>
      {open ? (
        <div role="dialog" aria-label="Confirm">
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      ) : null}
    </div>
  );
}

describe('useBarcodeTrap', () => {
  it('focuses the barcode field on mount', () => {
    render(<Page />);
    expect(screen.getByLabelText('Barcode')).toHaveFocus();
  });

  it('takes focus back when it falls to the page', async () => {
    render(<Page />);
    screen.getByLabelText('Barcode').blur();
    await userEvent.click(screen.getByTestId('plain'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByLabelText('Barcode')).toHaveFocus();
  });

  it('lets a scan land in the field when focus is on the page, not on a control', async () => {
    render(<Page />);
    document.body.focus();
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('4006381333931');
    expect(screen.getByLabelText('Barcode')).toHaveValue('4006381333931');
  });

  it('never steals a keystroke from a field the operator chose, or from a button', async () => {
    render(<Page />);
    await userEvent.click(screen.getByLabelText('Note'));
    await userEvent.keyboard('half a kilo');
    expect(screen.getByLabelText('Note')).toHaveValue('half a kilo');
    expect(screen.getByLabelText('Barcode')).toHaveValue('');
  });

  it('does nothing while a modal is open, and takes focus back to the field when it closes', async () => {
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    await userEvent.keyboard('x');
    expect(screen.getByLabelText('Barcode')).toHaveValue('');
    expect(close).toHaveFocus();

    await userEvent.click(close);
    // The control that opened the modal would get focus back in a real Radix dialog; the trap takes it on.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByLabelText('Barcode')).toHaveFocus();
  });
});
