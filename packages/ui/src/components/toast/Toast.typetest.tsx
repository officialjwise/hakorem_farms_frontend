/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { useToast } from '../ui-provider/UIProvider';

export function Valid() {
  const { show } = useToast();
  show({ tone: 'good', title: 'Sale saved' });
  show({
    tone: 'info',
    title: 'Receipt sent',
    description: 'By SMS to +233244512876',
    action: { label: 'Undo', onAction: () => undefined },
    persistent: true,
  });
  return null;
}

export function Invalid() {
  const { show } = useToast();

  // A toast with no words is colour alone.
  // @ts-expect-error title is required
  show({ tone: 'good' });

  // @ts-expect-error title cannot be an empty string
  show({ tone: 'good', title: '' });

  // @ts-expect-error "success" is not a tone
  show({ tone: 'success', title: 'Saved' });

  // @ts-expect-error tone is required
  show({ title: 'Saved' });
  return null;
}
