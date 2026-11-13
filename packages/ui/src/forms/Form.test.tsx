import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { UIProvider } from '../components/ui-provider/UIProvider';
import { stubResizeObserver } from '../test/stubResizeObserver';
import { toastLabels } from '../test/toastLabels';
import { FarmFields, farmMessages, useFarmForm, type FarmValues } from './FarmForm.fixture';
import { Form, FormSubmitButton } from './Form';
import { useDirtyGuard } from './useDirtyGuard';

beforeAll(stubResizeObserver);

function Harness({
  onSubmit,
  onSubmitError,
}: {
  onSubmit: (values: FarmValues) => Promise<void> | void;
  onSubmitError?: (error: unknown) => void;
}) {
  const form = useFarmForm();
  const guard = useDirtyGuard(form.formState.isDirty);
  const [left, setLeft] = useState<boolean | null>(null);
  return (
    <UIProvider theme="light" density="comfortable" toastLabels={toastLabels}>
      <Form form={form} onSubmit={onSubmit} onSubmitError={onSubmitError} aria-label="Add animal">
        <FarmFields control={form.control} />
        <FormSubmitButton loadingLabel="Saving animal">Save animal</FormSubmitButton>
      </Form>
      <span data-testid="dirty">{String(form.formState.isDirty)}</span>
      <button type="button" onClick={() => setLeft(guard.requestLeave(() => undefined))}>
        Leave
      </button>
      <span data-testid="requested">{String(left)}</span>
    </UIProvider>
  );
}

/** Fills every field with the keyboard and real key presses. */
async function fillForm() {
  await userEvent.type(screen.getByRole('textbox', { name: 'Tag number Required' }), 'GT-0142');
  await userEvent.type(screen.getByRole('combobox', { name: 'Dam' }), 'GT-0207');
  await userEvent.keyboard('{ArrowDown}{Enter}');
  await userEvent.type(screen.getByRole('textbox', { name: 'Weight (kg)' }), '38.4');
  await userEvent.type(screen.getByRole('textbox', { name: 'Asking price (GH₵)' }), '12.5');
  await userEvent.click(screen.getByRole('radio', { name: 'Breeding' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'PPR' }));
}

describe('Form', () => {
  it("hands the schema's messages to Field, which owns aria-invalid and the description", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save animal' }));

    const tag = await screen.findByRole('textbox', { name: 'Tag number Required' });
    expect(tag).toBeInvalid();
    expect(tag).toHaveAccessibleDescription(farmMessages.tagNo);
    expect(screen.getByRole('textbox', { name: 'Weight (kg)' })).toHaveAccessibleDescription(
      `${farmMessages.weightKg} From the scale.`,
    );
    expect(screen.getByRole('textbox', { name: 'Asking price (GH₵)' })).toHaveAccessibleDescription(
      farmMessages.pricePesewas,
    );
    expect(screen.getByRole('radiogroup', { name: 'Purpose' })).toHaveAccessibleDescription(
      farmMessages.purpose,
    );
    expect(screen.getByRole('group', { name: 'Vaccinations given' })).toHaveAccessibleDescription(
      farmMessages.vaccines,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits exact values: pesewas as an integer, kilograms as a three-place string', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save animal' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      tagNo: 'GT-0142',
      damId: 'gt-0207',
      weightKg: '38.400',
      pricePesewas: 1250,
      purpose: 'BREEDING',
      vaccines: ['ppr'],
    });
  });

  it('ignores a second submit while the first is pending, and shows loading', async () => {
    let finish: () => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { container } = render(<Harness onSubmit={onSubmit} />);
    await fillForm();
    const form = container.querySelector('form');
    if (form === null) throw new Error('no form');

    // Two submits in the same tick: only a ref guard stops the second.
    fireEvent.submit(form);
    fireEvent.submit(form);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'Saving animal' })).toHaveAttribute(
      'aria-busy',
      'true',
    );

    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(await screen.findByRole('button', { name: 'Save animal' })).not.toHaveAttribute(
      'aria-busy',
    );
  });

  it('is clean after a successful submit, so leaving is not blocked', async () => {
    render(<Harness onSubmit={() => undefined} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Tag number Required' }), 'G');
    expect(screen.getByTestId('dirty')).toHaveTextContent('true');
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByTestId('requested')).toHaveTextContent('false');

    await userEvent.clear(screen.getByRole('textbox', { name: 'Tag number Required' }));
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save animal' }));
    await vi.waitFor(() => expect(screen.getByTestId('dirty')).toHaveTextContent('false'));
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByTestId('requested')).toHaveTextContent('true');
  });

  it('hands a rejection to onSubmitError, and the guard lets the next submit through', async () => {
    const failure = new Error('network down');
    const onSubmit = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const onSubmitError = vi.fn();
    render(<Harness onSubmit={onSubmit} onSubmitError={onSubmitError} />);
    await fillForm();

    await userEvent.click(screen.getByRole('button', { name: 'Save animal' }));
    await vi.waitFor(() => expect(onSubmitError).toHaveBeenCalledWith(failure));

    await userEvent.click(await screen.findByRole('button', { name: 'Save animal' }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });
});

describe('useDirtyGuard', () => {
  const beforeUnload = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('listens for beforeunload only while dirty', () => {
    const { rerender, unmount } = renderHook(({ dirty }) => useDirtyGuard(dirty), {
      initialProps: { dirty: false },
    });
    expect(beforeUnload()).toBe(false);
    rerender({ dirty: true });
    expect(beforeUnload()).toBe(true);
    rerender({ dirty: false });
    expect(beforeUnload()).toBe(false);
    rerender({ dirty: true });
    unmount();
    expect(beforeUnload()).toBe(false);
  });

  it('lets a clean form leave at once', () => {
    const { result } = renderHook(() => useDirtyGuard(false));
    const proceed = vi.fn();
    expect(result.current.requestLeave(proceed)).toBe(true);
    expect(proceed).toHaveBeenCalledTimes(1);
    expect(result.current.blocked).toBe(false);
  });

  it('holds a dirty leave until the operator answers', () => {
    const { result } = renderHook(() => useDirtyGuard(true));
    const proceed = vi.fn();
    act(() => {
      expect(result.current.requestLeave(proceed)).toBe(false);
    });
    expect(result.current.blocked).toBe(true);
    expect(proceed).not.toHaveBeenCalled();

    act(() => result.current.confirmLeave());
    expect(proceed).toHaveBeenCalledTimes(1);
    expect(result.current.blocked).toBe(false);
  });

  it('drops the held leave when the operator stays', () => {
    const { result } = renderHook(() => useDirtyGuard(true));
    const proceed = vi.fn();
    act(() => {
      result.current.requestLeave(proceed);
    });
    act(() => result.current.stay());
    act(() => result.current.confirmLeave());
    expect(proceed).not.toHaveBeenCalled();
    expect(result.current.blocked).toBe(false);
  });
});
