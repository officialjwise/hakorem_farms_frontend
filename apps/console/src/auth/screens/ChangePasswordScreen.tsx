import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { Form, FormField, FormSubmitButton, Input } from '@hakorem/ui';
import { useAuth } from '../AuthProvider';
import { AuthLayout } from './AuthLayout';
import { AuthFailureView, useAuthFailure, type AuthFailure } from './failure';

/** First login with a temporary password: the only screen a user in that state can reach (SessionGate sends them here). */
export function ChangePasswordScreen() {
  const { t } = useTranslation('auth');
  const auth = useAuth();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  // Once the change is saved the pending step is dropped; this keeps the guard below from redirecting before navigate lands.
  const [saved, setSaved] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t('common.required')),
          newPassword: z.string().min(12, t('common.newPasswordHint')),
          confirm: z.string().min(1, t('common.required')),
        })
        .refine((v) => v.newPassword === v.confirm, {
          path: ['confirm'],
          message: t('change.mismatch'),
        }),
    [t],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const toFailure = useAuthFailure(form);

  const allowed =
    saved || auth.pending?.kind === 'password-change' || auth.session?.mustChangePassword === true;
  if (!allowed) return <Navigate to="/login" replace />;

  return (
    <AuthLayout title={t('change.title')} subtitle={t('change.body')}>
      <Form
        form={form}
        onSubmit={async ({ currentPassword, newPassword }) => {
          setFailure(null);
          await auth.changePassword(currentPassword, newPassword);
          setSaved(true);
          navigate('/login', { replace: true, state: { passwordChanged: true } });
          auth.cancelPending();
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <AuthFailureView failure={failure} />
        <FormField
          name="currentPassword"
          label={t('common.currentPassword')}
          required
          requiredLabel={t('common.required')}
        >
          {(field) => <Input {...field} type="password" autoComplete="current-password" />}
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
        <FormField
          name="confirm"
          label={t('common.confirmPassword')}
          required
          requiredLabel={t('common.required')}
        >
          {(field) => <Input {...field} type="password" autoComplete="new-password" />}
        </FormField>
        <FormSubmitButton fullWidth loadingLabel={t('change.submit')}>
          {t('change.submit')}
        </FormSubmitButton>
      </Form>
    </AuthLayout>
  );
}
