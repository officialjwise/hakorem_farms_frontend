import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Checkbox } from '../components/checkbox/Checkbox';
import { Radio, RadioGroup } from '../components/radio/Radio';
import { stubResizeObserver } from '../test/stubResizeObserver';
import { Form, FormSubmitButton } from './Form';
import { FormFieldGroup, toggleInList } from './FormFieldGroup';

const schema = z.object({
  purpose: z.string().min(1, 'Choose a purpose.'),
  vaccines: z.array(z.string()).min(1, 'Choose at least one vaccination.'),
});

beforeAll(stubResizeObserver);

function Harness({ onSubmit }: { onSubmit: (v: z.input<typeof schema>) => void }) {
  const form = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { purpose: '', vaccines: [] },
  });
  return (
    <Form form={form} onSubmit={onSubmit} aria-label="Group form">
      <FormFieldGroup
        control={form.control}
        name="purpose"
        label="Purpose"
        required
        requiredLabel="Required"
        wrap={(group, field) => (
          <RadioGroup asChild value={field.value} onValueChange={field.onChange}>
            {group}
          </RadioGroup>
        )}
      >
        {() => (
          <>
            <Radio value="GROWING" label="Growing" />
            <Radio value="BREEDING" label="Breeding" />
          </>
        )}
      </FormFieldGroup>
      <FormFieldGroup control={form.control} name="vaccines" label="Vaccinations">
        {(field) => (
          <>
            {['ppr', 'anthrax'].map((v) => (
              <Checkbox
                key={v}
                label={v.toUpperCase()}
                checked={field.value.includes(v)}
                onCheckedChange={(on) => field.onChange(toggleInList(field.value, v, on === true))}
              />
            ))}
          </>
        )}
      </FormFieldGroup>
      <FormSubmitButton loadingLabel="Saving">Save</FormSubmitButton>
    </Form>
  );
}

describe('FormFieldGroup', () => {
  it('puts the form error on the group, which stays one named group', async () => {
    render(<Harness onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const radios = await screen.findByRole('radiogroup', { name: 'Purpose Required' });
    expect(radios).toHaveAccessibleDescription('Choose a purpose.');
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Vaccinations' })).toHaveAccessibleDescription(
      'Choose at least one vaccination.',
    );
  });

  it('submits the chosen radio and the checked boxes, in the order checked', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Breeding' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'ANTHRAX' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'PPR' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      purpose: 'BREEDING',
      vaccines: ['anthrax', 'ppr'],
    });
  });
});

describe('toggleInList', () => {
  it('adds, removes and never duplicates, without changing the input', () => {
    const list = ['ppr'] as const;
    expect(toggleInList(list, 'anthrax', true)).toEqual(['ppr', 'anthrax']);
    expect(toggleInList(list, 'ppr', true)).toEqual(['ppr']);
    expect(toggleInList(list, 'ppr', false)).toEqual([]);
    expect(list).toEqual(['ppr']);
  });
});
