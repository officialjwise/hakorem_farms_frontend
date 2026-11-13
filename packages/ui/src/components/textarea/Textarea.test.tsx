import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '../field/Field';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('takes its name, description and validity from Field', () => {
    render(
      <Field label="Health notes" hint="Anything the vet should know." error="Add a note.">
        <Textarea />
      </Field>,
    );
    const box = screen.getByRole('textbox', { name: 'Health notes' });
    expect(box).toBeInvalid();
    expect(box).toHaveAccessibleDescription('Add a note. Anything the vet should know.');
  });

  it('defaults to three rows and accepts rows', () => {
    const { rerender } = render(
      <Field label="Notes">
        <Textarea />
      </Field>,
    );
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '3');
    rerender(
      <Field label="Notes">
        <Textarea rows={6} />
      </Field>,
    );
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '6');
  });

  it('resizes vertically only', () => {
    render(
      <Field label="Notes">
        <Textarea />
      </Field>,
    );
    expect(screen.getByRole('textbox').className).toContain('resize-y');
  });

  it('keyboard path: tab reaches it and typing works, Enter adds a line', async () => {
    render(
      <Field label="Notes">
        <Textarea />
      </Field>,
    );
    await userEvent.tab();
    const box = screen.getByRole('textbox', { name: 'Notes' });
    expect(box).toHaveFocus();
    await userEvent.keyboard('limping{Enter}left foreleg');
    expect(box).toHaveValue('limping\nleft foreleg');
  });

  it('ignores typing when disabled', async () => {
    render(
      <Field label="Notes">
        <Textarea disabled defaultValue="kept" />
      </Field>,
    );
    await userEvent.type(screen.getByRole('textbox'), 'x');
    expect(screen.getByRole('textbox')).toHaveValue('kept');
  });

  it('forwards its ref', () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    render(
      <Field label="Notes">
        <Textarea ref={ref} />
      </Field>,
    );
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('throws without a label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Textarea />)).toThrow(/no label/);
    quiet.mockRestore();
  });
});
