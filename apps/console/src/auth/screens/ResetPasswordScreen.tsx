import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button, Form, FormField, FormSubmitButton, Input } from '@hakorem/ui';
import { useAuth } from '../AuthProvider';
import { AuthLayout } from './AuthLayout';
import { AuthFailureView, useAuthFailure, type AuthFailure } from './failure';

export function ResetPasswordScreen() {
  const { t } = useTranslation('auth');
  const auth = useAuth();
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        token: z.string().trim().min(1, t('common.required')),
        newPassword: z.string().min(12, t('common.newPasswordHint')),
      }),
    [t],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { token: '', newPassword: '' },
  });
  const toFailure = useAuthFailure(form);

  if (done) {
    return (
      <AuthLayout title={t('reset.doneTitle')} subtitle={t('reset.doneBody')}>
        <Button asChild>
          <Link to="/login">{t('reset.toSignIn')}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('reset.title')} subtitle={t('reset.body')}>
      <Form
        form={form}
        onSubmit={async ({ token, newPassword }) => {
          setFailure(null);
          await auth.resetPassword(token, newPassword);
          setDone(true);
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <AuthFailureView failure={failure} />
        <FormField
          name="token"
          label={t('reset.token')}
          required
          requiredLabel={t('common.required')}
        >
          {(field) => (
            <Input
              {...field}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              spellCheck={false}
            />
          )}
        </FormField>
        <FormField
          name="newPassword"
          label={t('common.newPassword')}
          hint={t('common.newPasswordHint')}
          required
          requiredLabel={t('common.required')}
        >
          {(field) => <Input {...field} type="password" autoComplete="new-password" />}
        </FormField>
        <FormSubmitButton fullWidth loadingLabel={t('reset.submit')}>
          {t('reset.submit')}
        </FormSubmitButton>
      </Form>
      <Button asChild variant="secondary">
        <Link to="/login">{t('common.back')}</Link>
      </Button>
    </AuthLayout>
  );
}
