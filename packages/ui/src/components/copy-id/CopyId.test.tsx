import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyId } from './CopyId';

const LABELS = {
  copyLabel: 'Copy cus_8F3K2M9Q7X4T1V6B',
  copiedLabel: 'Copied',
  failedLabel: 'Could not copy: select it',
} as const;

function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

describe('CopyId', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('shows the id in full, in the monospace face, wrapping anywhere', () => {
    render(<CopyId value="cus_8F3K2M9Q7X4T1V6B" {...LABELS} />);
    const code = screen.getByText('cus_8F3K2M9Q7X4T1V6B');
    expect(code.tagName).toBe('CODE');
    expect(code).toHaveClass('font-mono', 'break-all');
  });

  it('shows what it is given to show, and copies the whole value (a request reference)', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    clipboard(writeText);
    render(
      <CopyId
        value="019a7b1d-f4de-751c-aa55-5aa0965fd37e"
        shown="965f d37e"
        copyLabel="Copy the full reference"
        copiedLabel="Copied"
        failedLabel="Could not copy"
      />,
    );
    expect(screen.getByText('965f d37e').tagName).toBe('CODE');
    expect(screen.queryByText(/019a7b1d/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Copy the full reference' }));
    expect(writeText).toHaveBeenCalledWith('019a7b1d-f4de-751c-aa55-5aa0965fd37e');
  });

  it('refuses a blank shown text', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CopyId value="cus_8F3K2M9Q7X4T1V6B" shown=" " {...LABELS} />)).toThrow(
      /shown/,
    );
  });

  it('copies the id by the keyboard and says so in words', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    // After setup: user-event puts its own clipboard on navigator.
    const user = userEvent.setup();
    clipboard(writeText);
    render(<CopyId value="cus_8F3K2M9Q7X4T1V6B" {...LABELS} />);
    await user.tab();
    expect(screen.getByRole('button', { name: LABELS.copyLabel })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(writeText).toHaveBeenCalledWith('cus_8F3K2M9Q7X4T1V6B');
    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
  });

  it('says in words when the browser refuses the clipboard, and when it has none', async () => {
    const user = userEvent.setup();
    clipboard(() => Promise.reject(new Error('denied')));
    const { unmount } = render(<CopyId value="sup_4D2N7Q9X1K3M5P8R" {...LABELS} />);
    await user.click(screen.getByRole('button', { name: LABELS.copyLabel }));
    expect(await screen.findByRole('status')).toHaveTextContent('Could not copy: select it');
    unmount();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    render(<CopyId value="sup_4D2N7Q9X1K3M5P8R" {...LABELS} />);
    await user.click(screen.getByRole('button', { name: LABELS.copyLabel }));
    expect(screen.getByRole('status')).toHaveTextContent('Could not copy: select it');
  });

  it('reads as it did again after a moment', async () => {
    vi.useFakeTimers();
    clipboard(() => Promise.resolve());
    render(<CopyId value="EGG-0003" {...LABELS} />);
    await act(async () => {
      screen.getByRole('button', { name: LABELS.copyLabel }).click();
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('status')).toHaveTextContent('');
    vi.useRealTimers();
  });

  it('throws on a blank value or a blank button name', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CopyId value=" " {...LABELS} />)).toThrow(/value/);
    expect(() => render(<CopyId value="EGG-0003" {...LABELS} copyLabel=" " />)).toThrow(
      /copyLabel/,
    );
    quiet.mockRestore();
  });
});
