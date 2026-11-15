import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { components, OperationInput } from '@hakorem/api-client';
import { Dialog, Form, FormField, FormSubmitButton, Input } from '@hakorem/ui';
import { useApiMutation } from '../data/api';
import { useIntentKey } from '../lib/queries';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';

type Branch = components['schemas']['Branch'];

/**
 * Create a branch, or change what may change after: name, address, phone. The code appears in document
 * numbers, so it is set once. Checks here are only the contract's shapes; the server decides the rest and
 * its refusal is shown in its words.
 */
export function BranchDialog({
  branch,
  onClose,
  onDone,
}: {
  branch: Branch | null;
  onClose: () => void;
  onDone: (saved: Branch) => void;
}) {
  const { t } = useTranslation(['branches', 'common']);
  const required = t('common:field.required');
  const create = useApiMutation('createBranch');
  const update = useApiMutation('updateBranch');
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .regex(/^[A-Z0-9]{2,5}$/, t('form.codeRule')),
        name: z.string().trim().min(1, required),
        address: z.string().trim(),
        phone: z
          .string()
          .trim()
          .regex(/^$|^\+?[0-9][0-9 -]{6,22}$/, t('form.phoneRule')),
      }),
    [required, t],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: branch?.code ?? '',
      name: branch?.name ?? '',
      address: branch?.address ?? '',
      phone: branch?.phone ?? '',
    },
  });
  const toFailure = useWriteFailure(form);
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={branch === null ? t('form.newTitle') : t('form.editTitle', { name: branch.name })}
      description={branch === null ? t('form.newBody') : t('form.editBody')}
      closeLabel={t('common:actions.cancel')}
    >
      <Form
        form={form}
        className="grid gap-3 pb-2"
        onSubmit={async (values) => {
          setFailure(null);
          const optional = {
            ...(values.address === '' ? {} : { address: values.address }),
            ...(values.phone === '' ? {} : { phone: values.phone }),
          };
          if (branch === null) {
            const body: OperationInput<'createBranch'>['body'] = {
              code: values.code,
              name: values.name,
              ...optional,
            };
            onDone(await create.mutateAsync({ body }, { idempotencyKey: keyFor(body) }));
          } else {
            const body: OperationInput<'updateBranch'>['body'] = {
              version: branch.version,
              name: values.name,
              ...optional,
            };
            onDone(
              await update.mutateAsync(
                { path: { id: branch.id }, body },
                { idempotencyKey: keyFor(body) },
              ),
            );
          }
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <WriteFailureView failure={failure} title={t('form.notSaved')} />
        {branch === null ? (
          <FormField
            name="code"
            label={t('form.code')}
            hint={t('form.codeHint')}
            required
            requiredLabel={required}
          >
            {(field) => <Input {...field} autoComplete="off" autoCapitalize="characters" />}
          </FormField>
        ) : null}
        <FormField name="name" label={t('form.name')} required requiredLabel={required}>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormField>
        <FormField name="address" label={t('form.address')}>
          {(field) => <Input {...field} autoComplete="street-address" />}
        </FormField>
        <FormField name="phone" label={t('form.phone')} hint={t('form.phoneHint')}>
          {(field) => <Input {...field} type="tel" autoComplete="tel" />}
        </FormField>
        <div className="flex justify-end">
          <FormSubmitButton loadingLabel={t('form.saving')}>
            {branch === null ? t('form.create') : t('form.save')}
          </FormSubmitButton>
        </div>
      </Form>
    </Dialog>
  );
}
