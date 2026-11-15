import { ConfirmChanges } from './ConfirmChanges';

const base = {
  open: true,
  onOpenChange: () => undefined,
  description: 'd',
  confirmLabel: 'Post',
  cancelLabel: 'Cancel',
  pendingLabel: 'Posting',
  pending: false,
  onConfirm: () => undefined,
} as const;
// @ts-expect-error The question must be asked in words.
export const blank = <ConfirmChanges {...base} title="" />;
// @ts-expect-error Danger or default only: no free colour.
export const colour = <ConfirmChanges {...base} title="Post?" tone="red" />;
