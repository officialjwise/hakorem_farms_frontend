import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormError } from './FormError';
import type { ServerFailure } from './serverErrors';
import { formatReference } from '../format/format';

const failure: ServerFailure = {
  code: 'STOCK_HELD',
  message: 'The sale could not be completed.',
  correlationId: '0b6e0e1c-6c0f-4a35-9b8e-2a1f0d9d1c11',
  unmapped: [{ field: null, code: 'STOCK_HELD', message: 'GT-0142 is under a withdrawal hold.' }],
};

describe('FormError', () => {
  it('is an alert with the message, the unmapped details and the reference', () => {
    render(
      <FormError
        failure={failure}
        title="The sale was not saved"
        referenceLabel="Reference"
        referenceCopy={{
          copy: 'Copy the full reference',
          copied: 'Copied',
          failed: 'Could not copy',
        }}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The sale was not saved');
    expect(alert).toHaveTextContent('The sale could not be completed.');
    expect(alert).toHaveTextContent('GT-0142 is under a withdrawal hold.');
    // The last eight characters, grouped; the copy button copies all of it (ADR 0051).
    expect(alert).toHaveTextContent(`Reference ${formatReference(failure.correlationId)}`);
    expect(alert).not.toHaveTextContent(failure.correlationId);
  });

  it('renders nothing without a failure', () => {
    const { container } = render(
      <FormError
        failure={null}
        title="The sale was not saved"
        referenceLabel="Reference"
        referenceCopy={{
          copy: 'Copy the full reference',
          copied: 'Copied',
          failed: 'Could not copy',
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('stays until its owner clears it, and offers a dismiss only when asked', async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <FormError
        failure={failure}
        title="Not saved"
        referenceLabel="Reference"
        referenceCopy={{
          copy: 'Copy the full reference',
          copied: 'Copied',
          failed: 'Could not copy',
        }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    rerender(
      <FormError
        failure={failure}
        title="Not saved"
        referenceLabel="Reference"
        referenceCopy={{
          copy: 'Copy the full reference',
          copied: 'Copied',
          failed: 'Could not copy',
        }}
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
      render(
        <FormError
          failure={failure}
          title="  "
          referenceLabel="Reference"
          referenceCopy={{
            copy: 'Copy the full reference',
            copied: 'Copied',
            failed: 'Could not copy',
          }}
        />,
      ),
    ).toThrow(/title/);
    quiet.mockRestore();
  });
});
