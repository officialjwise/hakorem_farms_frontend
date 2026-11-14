import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { Button } from './Button';

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('calls onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  describe('loading', () => {
    it('announces the loading label instead of the visible label', () => {
      render(
        <Button loading loadingLabel="Saving sale">
          Save
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Saving sale' });
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('ignores clicks, however many arrive', async () => {
      const onClick = vi.fn();
      render(
        <Button loading loadingLabel="Saving" onClick={onClick}>
          Save
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Saving' });
      await userEvent.click(button);
      await userEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('blocks form submission by click and by keyboard', async () => {
      const onSubmit = vi.fn((e: SubmitEvent) => e.preventDefault());
      render(
        <form onSubmit={(e) => onSubmit(e.nativeEvent as SubmitEvent)}>
          <label htmlFor="weight">Weight</label>
          <input id="weight" />
          <Button type="submit" loading loadingLabel="Saving">
            Save
          </Button>
        </form>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Saving' }));
      await userEvent.type(screen.getByLabelText('Weight'), '38.4{Enter}');
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('keeps keyboard focus, so a keyboard user is not dropped to the page', async () => {
      const { rerender } = render(
        <Button loading={false} loadingLabel="Saving">
          Save
        </Button>,
      );
      await userEvent.tab();
      const button = screen.getByRole('button', { name: 'Save' });
      expect(button).toHaveFocus();
      rerender(
        <Button loading loadingLabel="Saving">
          Save
        </Button>,
      );
      expect(screen.getByRole('button', { name: 'Saving' })).toHaveFocus();
    });
  });

  it('gives an icon-only button its accessible name from aria-label', () => {
    render(
      <Button iconOnly aria-label="Add item">
        <Plus />
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument();
  });

  it('renders the child element with asChild', () => {
    render(
      <Button asChild variant="secondary">
        <a href="/stock">Stock on hand</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Stock on hand' });
    expect(link).toHaveAttribute('href', '/stock');
    expect(link.className).toContain('border-border-strong');
  });
});
