import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import type { OperationInput } from '@hakorem/api-client';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Form,
  FormField,
  FormSubmitButton,
  Input,
  NOT_APPLICABLE,
  QueryBoundary,
  Skeleton,
  PageHeader,
  Alert,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure, useStepUp } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { useStateLabels } from '../lib/states';
import { useWriteFailure, WriteFailureView, type WriteFailure } from '../lib/writeFailure';
import { GrantsSection } from './GrantsSection';
import { UserStatusBadge, When, type UserAccount } from './presentation';
import { TemporaryPassword } from './TemporaryPassword';
import { E164 } from './UserCreateScreen';

type Action = 'disable' | 'enable' | 'unlock' | 'reset';

/** FR-IAM-001, 014, 015, 017, 020: one account, its profile, its state, and its roles at branches. */
export function UserDetailScreen() {
  const { t } = useTranslation(['iam', 'common']);
  const { id = '' } = useParams();
  const user = useApiQuery('getUser', { path: { id } });
  const labels = useStateLabels({
    loading: t('user.loading'),
    emptyTitle: t('user.notFound'),
    errorTitle: t('user.error'),
    deniedTitle: t('user.denied'),
  });

  const back = (
    <Link to="/users" className="text-accent-text underline">
      {t('user.back')}
    </Link>
  );

  // A 404 on a record is "not found", not an error page (DATA_CONVENTIONS).
  if (user.error?.status === 404) {
    return (
      <EmptyState
        title={t('user.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }

  return (
    <QueryBoundary
      query={user}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(account) => (
        <UserDetail account={account} back={back} onReload={() => void user.refetch()} />
      )}
    </QueryBoundary>
  );
}

function UserDetail({
  account,
  back,
  onReload,
}: {
  account: UserAccount;
  back: ReactNode;
  onReload: () => void;
}) {
  const { t } = useTranslation(['iam', 'common']);
  const auth = useAuth();

  return (
    <article aria-labelledby="user-title" className="grid gap-4">
      <div className="grid gap-2">
        {back}
        <div className="flex flex-wrap items-center gap-3">
          <PageHeader title={account.displayName} titleId="user-title" />
          <UserStatusBadge status={account.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('user.facts')}</h2>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
            <dt className="text-fg-muted">{t('user.email')}</dt>
            <dd className="break-all">{account.email ?? NOT_APPLICABLE}</dd>
            <dt className="text-fg-muted">{t('user.phone')}</dt>
            <dd>{account.phone ?? NOT_APPLICABLE}</dd>
            <dt className="text-fg-muted">{t('user.lastLogin')}</dt>
            <dd>
              <When instant={account.lastLoginAt} empty={t('common:time.never')} />
            </dd>
            <dt className="text-fg-muted">{t('user.totp')}</dt>
            <dd>
              {account.totpEnrolled ? t('user.totpOn') : t('user.totpOff')}
              {account.totpRequired ? ` · ${t('user.totpRequired')}` : ''}
            </dd>
          </dl>
          {account.mustChangePassword ? <p className="mt-2">{t('user.mustChange')}</p> : null}
          <p className="mt-2 text-control-sm text-fg-muted">{t('common:time.zone')}</p>
        </CardBody>
      </Card>

      {auth.can('iam.user.update') ? (
        <ProfileForm key={account.version} account={account} onReload={onReload} />
      ) : null}

      <AccountActions account={account} />

      <GrantsSection principal={account} />
    </article>
  );
}

function ProfileForm({ account, onReload }: { account: UserAccount; onReload: () => void }) {
  const { t } = useTranslation(['iam', 'common']);
  const update = useApiMutation('updateUser');
  const keyFor = useIntentKey();
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const schema = useMemo(
    () =>
      z.object({
        displayName: z.string().trim().min(1, t('common:field.required')),
        email: z
          .string()
          .trim()
          .refine((v) => v === '' || z.email().safeParse(v).success, t('create.invalidEmail')),
        phone: z
          .string()
          .trim()
          .refine((v) => v === '' || E164.test(v), t('create.invalidPhone')),
      }),
    [t],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: account.displayName,
      email: account.email ?? '',
      phone: account.phone ?? '',
    },
  });
  const toFailure = useWriteFailure(form);
  const guard = useLeaveGuard(form.formState.isDirty);

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('user.profile')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <Form
          form={form}
          className="grid gap-4"
          onSubmit={async (values) => {
            setFailure(null);
            setSaved(false);
            // Only what changed is sent, with the version it was read at (409 VERSION_CONFLICT otherwise).
            const body: OperationInput<'updateUser'>['body'] = {
              version: account.version,
              ...(values.displayName === account.displayName
                ? {}
                : { displayName: values.displayName }),
              ...(values.email === (account.email ?? '') || values.email === ''
                ? {}
                : { email: values.email }),
              ...(values.phone === (account.phone ?? '') || values.phone === ''
                ? {}
                : { phone: values.phone }),
            };
            await update.mutateAsync(
              { path: { id: account.id }, body },
              { idempotencyKey: keyFor(body) },
            );
            setSaved(true);
          }}
          onSubmitError={(error) => setFailure(toFailure(error))}
        >
          <p className="text-control-sm text-fg-muted">{t('user.profileHint')}</p>
          <WriteFailureView failure={failure} title={t('user.writeFailed')} onReload={onReload} />
          {saved ? <Alert severity={'good'} title={t('user.saved')} /> : null}
          <FormField
            name="displayName"
            label={t('user.displayName')}
            required
            requiredLabel={t('common:field.required')}
          >
            {(field) => <Input {...field} autoComplete="off" />}
          </FormField>
          <FormField name="email" label={t('create.email')}>
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
          <div>
            <FormSubmitButton loadingLabel={t('common:actions.save')}>
              {t('common:actions.save')}
            </FormSubmitButton>
          </div>
        </Form>
        <LeaveGuardDialog guard={guard} />
      </CardBody>
    </Card>
  );
}

function AccountActions({ account }: { account: UserAccount }) {
  const { t } = useTranslation(['iam', 'common']);
  const auth = useAuth();
  const [open, setOpen] = useState<Action | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const stepUp = useStepUp();
  const keyFor = useIntentKey();
  const disable = useApiMutation('disableUser');
  const enable = useApiMutation('enableUser');
  const unlock = useApiMutation('unlockUser');
  const reset = useApiMutation('resetUserPassword');
  const mutations = { disable, enable, unlock, reset };
  const failureLabels = useStateLabels({
    loading: t('user.loading'),
    emptyTitle: t('user.writeFailed'),
    errorTitle: t('user.writeFailed'),
    deniedTitle: t('user.denied'),
  });

  const offered: Action[] = [];
  if (auth.can('iam.user.disable') && account.status !== 'DISABLED') offered.push('disable');
  if (auth.can('iam.user.disable') && account.status === 'DISABLED') offered.push('enable');
  if (auth.can('iam.user.unlock') && account.status === 'LOCKED') offered.push('unlock');
  if (auth.can('iam.user.reset_password') && account.status !== 'DISABLED') offered.push('reset');
  if (offered.length === 0 && password === null && done === null) return null;

  const words = {
    disable: 'confirmDisable',
    enable: 'confirmEnable',
    unlock: 'confirmUnlock',
    reset: 'confirmReset',
  } as const;
  const name = account.displayName;

  const confirm = async (action: Action, reason: string) => {
    const input = { path: { id: account.id }, body: { reason } };
    const key = keyFor({ action, ...input });
    if (action === 'reset') {
      const answer = await stepUp.run(() => reset.mutateAsync(input, { idempotencyKey: key }));
      if (answer === null) return;
      setPassword(answer.temporaryPassword);
    } else {
      await mutations[action].mutateAsync(input, { idempotencyKey: key });
    }
    setDone(t(`user.${words[action]}.done`));
    setOpen(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('user.actions')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-3">
        {done !== null ? <Alert severity={'good'} title={done} /> : null}
        {password !== null ? <TemporaryPassword name={name} password={password} /> : null}
        <div className="flex flex-wrap gap-2">
          {offered.map((action) => (
            <Button
              key={action}
              variant={action === 'disable' ? 'danger' : 'secondary'}
              onClick={() => {
                mutations[action].reset();
                setDone(null);
                setOpen(action);
              }}
            >
              {t(`user.${action === 'reset' ? 'resetPassword' : action}`)}
            </Button>
          ))}
        </div>
        {offered.map((action) => (
          <ReasonDialog
            key={action}
            open={open === action}
            onOpenChange={(next) => setOpen(next ? action : null)}
            title={t(`user.${words[action]}.title`)}
            body={t(`user.${words[action]}.body`, { name })}
            submitLabel={t(`user.${words[action]}.submit`)}
            destructive={action === 'disable'}
            onConfirm={(reason) => confirm(action, reason)}
            error={shownFailure(mutations[action].error)}
            failureLabels={failureLabels}
          />
        ))}
        {stepUp.dialog}
      </CardBody>
    </Card>
  );
}
