import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { z } from 'zod';
import type { OperationInput } from '@hakorem/api-client';
import {
  Button,
  Form,
  FormField,
  FormSubmitButton,
  Input,
  QueryBoundary,
  Select,
  Skeleton,
} from '@hakorem/ui';
import { useStepUp } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { bothQueries, uniqueById, useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';
import { TemporaryPassword } from './TemporaryPassword';

/** `PhoneNumber` in the contract: E.164. */
export const E164 = /^\+[1-9][0-9]{7,14}$/;
const PAGE_OF_OPTIONS = 100;

type UserCreateBody = OperationInput<'createUser'>['body'];

/**
 * FR-IAM-001: a staff account with an email, a phone or both, a full name, and a role at a branch. The
 * server generates the temporary password and it is shown once, here, after the account exists. This is the
 * first form screen, so it is where the dirty-state guard meets the router (`useLeaveGuard`).
 */
export function UserCreateScreen() {
  const { t } = useTranslation(['iam', 'common']);
  // Roles and branches change rarely: `reference` (10 min, DATA_CONVENTIONS).
  const roles = useApiQuery(
    'listRoles',
    { query: { limit: PAGE_OF_OPTIONS } },
    { staleClass: 'reference' },
  );
  const branches = useApiQuery(
    'listBranches',
    { query: { limit: PAGE_OF_OPTIONS } },
    { staleClass: 'reference' },
  );
  const labels = useStateLabels({
    loading: t('create.loadingOptions'),
    emptyTitle: t('create.optionsError'),
    errorTitle: t('create.optionsError'),
    deniedTitle: t('create.optionsDenied'),
  });

  return (
    <section aria-labelledby="user-new-title" className="grid max-w-2xl gap-4">
      <h1 id="user-new-title" className="text-2xl font-semibold">
        {t('create.title')}
      </h1>
      <p className="text-fg-muted">{t('create.intro')}</p>
      <QueryBoundary
        query={bothQueries(roles, branches)}
        labels={labels}
        isEmpty={([r, b]) => r.data.length === 0 || b.data.length === 0}
        loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
      >
        {([rolePage, branchPage]) => (
          <CreateUserForm
            roles={uniqueById(rolePage.data).map((role) => ({ value: role.id, label: role.name }))}
            branches={uniqueById(branchPage.data)
              .filter((branch) => branch.status === 'ACTIVE')
              .map((branch) => ({ value: branch.id, label: `${branch.name} (${branch.code})` }))}
          />
        )}
      </QueryBoundary>
    </section>
  );
}

function CreateUserForm({
  roles,
  branches,
}: {
  roles: { value: string; label: string }[];
  branches: { value: string; label: string }[];
}) {
  const { t } = useTranslation(['iam', 'common']);
  const create = useApiMutation('createUser');
  const stepUp = useStepUp();
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string; password: string } | null>(
    null,
  );

  const schema = useMemo(
    () =>
      z
        .object({
          displayName: z.string().trim().min(1, t('common:field.required')),
          email: z
            .string()
            .trim()
            .refine((v) => v === '' || z.email().safeParse(v).success, t('create.invalidEmail')),
          phone: z
            .string()
            .trim()
            .refine((v) => v === '' || E164.test(v), t('create.invalidPhone')),
          roleId: z.string().min(1, t('common:field.required')),
          branchId: z.string().min(1, t('common:field.required')),
        })
        .refine((v) => v.email !== '' || v.phone !== '', {
          message: t('create.needContact'),
          path: ['email'],
        }),
    [t],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      email: '',
      phone: '',
      roleId: '',
      branchId: branches.length === 1 ? (branches[0]?.value ?? '') : '',
    },
  });
  const toFailure = useWriteFailure(form);
  const guard = useLeaveGuard(form.formState.isDirty);

  if (created !== null) {
    return (
      <div className="grid gap-4">
        <p role="status" className="font-semibold">
          {t('create.created', { name: created.name })}
        </p>
        <TemporaryPassword name={created.name} password={created.password} />
        <div>
          <Button asChild>
            <Link to={`/users/${created.id}`}>{t('create.openUser', { name: created.name })}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Form
        form={form}
        className="grid gap-4"
        onSubmit={async (values) => {
          setFailure(null);
          const body: UserCreateBody = {
            displayName: values.displayName,
            realm: 'STAFF',
            ...(values.email === '' ? {} : { email: values.email }),
            ...(values.phone === '' ? {} : { phone: values.phone }),
            grants: [{ roleId: values.roleId, branchId: values.branchId }],
          };
          const answer = await stepUp.run(() =>
            create.mutateAsync({ body }, { idempotencyKey: keyFor(body) }),
          );
          if (answer === null) return;
          setCreated({
            id: answer.user.id,
            name: answer.user.displayName,
            password: answer.temporaryPassword,
          });
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <WriteFailureView failure={failure} title={t('create.failed')} />
        <FormField
          name="displayName"
          label={t('create.displayName')}
          required
          requiredLabel={t('common:field.required')}
        >
          {(field) => <Input {...field} autoComplete="off" />}
        </FormField>
        <FormField name="email" label={t('create.email')} hint={t('create.emailHint')}>
          {(field) => (
            <Input
              {...field}
              type="email"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
            />
          )}
        </FormField>
        <FormField name="phone" label={t('create.phone')} hint={t('create.phoneHint')}>
          {(field) => <Input {...field} type="tel" inputMode="tel" autoComplete="off" />}
        </FormField>
        <FormField
          name="roleId"
          label={t('create.role')}
          required
          requiredLabel={t('common:field.required')}
        >
          {(field) => (
            <Select
              ref={field.ref}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={roles}
            />
          )}
        </FormField>
        <FormField
          name="branchId"
          label={t('create.branch')}
          required
          requiredLabel={t('common:field.required')}
        >
          {(field) => (
            <Select
              ref={field.ref}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={branches}
            />
          )}
        </FormField>
        <div>
          <FormSubmitButton loadingLabel={t('create.submit')}>
            {t('create.submit')}
          </FormSubmitButton>
        </div>
      </Form>
      {stepUp.dialog}
      <LeaveGuardDialog guard={guard} />
    </>
  );
}
