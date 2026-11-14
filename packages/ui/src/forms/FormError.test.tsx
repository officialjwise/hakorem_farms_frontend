import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormError } from './FormError';
import type { ServerFailure } from './serverErrors';

const failure: ServerFailure = {
  code: 'STOCK_HELD',
  message: 'The sale could not be completed.',
  correlationId: '0b6e0e1c-6c0f-4a35-9b8e-2a1f0d9d1c11',
  unmapped: [{ field: null, code: 'STOCK_HELD', message: 'GT-0142 is under a withdrawal hold.' }],
};

describe('FormError', () => {
  it('is an alert with the message, the unmapped details and the reference', () => {
    render(
      <FormError failure={failure} title="The sale was not saved" referenceLabel="Reference" />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The sale was not saved');
    expect(alert).toHaveTextContent('The sale could not be completed.');
    expect(alert).toHaveTextContent('GT-0142 is under a withdrawal hold.');
    expect(alert).toHaveTextContent(`Reference ${failure.correlationId}`);
  });

  it('renders nothing without a failure', () => {
    const { container } = render(
      <FormError failure={null} title="The sale was not saved" referenceLabel="Reference" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('stays until its owner clears it, and offers a dismiss only when asked', async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <FormError failure={failure} title="Not saved" referenceLabel="Reference" />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    rerender(
      <FormError
        failure={failure}
        title="Not saved"
        referenceLabel="Reference"
        onDismiss={onDismiss}
        dismissLabel="Dismiss"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('throws on a blank title', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(<FormError failure={failure} title="  " referenceLabel="Reference" />),
    ).toThrow(/title/);
    quiet.mockRestore();
  });
});
