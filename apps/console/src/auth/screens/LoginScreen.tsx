import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Form, FormField, FormSubmitButton, Input, StatusBadge } from '@hakorem/ui';
import { CheckCircle2 } from 'lucide-react';
import { safeNext } from '../../lib/safeNext';
import { useAuth } from '../AuthProvider';
import { AuthLayout } from './AuthLayout';
import { AuthFailureView, useAuthFailure, type AuthFailure } from './failure';

export function LoginScreen() {
  const { t } = useTranslation('auth');
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        identifier: z.string().trim().min(1, t('common.required')),
        password: z.string().min(1, t('common.required')),
      }),
    [t],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '' },
  });
  const toFailure = useAuthFailure(form);

  // Already signed in: carry on to where they were going.
  if (auth.status === 'authenticated') return <Navigate to={next} replace />;

  const suffix = next === '/' ? '' : `?next=${encodeURIComponent(next)}`;
  const changed =
    (location.state as { passwordChanged?: boolean } | null)?.passwordChanged === true;

  return (
    <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')}>
      {changed ? (
        <StatusBadge tone="good" icon={CheckCircle2} label={t('login.passwordChanged')} />
      ) : null}
      <Form
        form={form}
        onSubmit={async ({ identifier, password }) => {
          setFailure(null);
          const status = await auth.login(identifier, password);
          if (status === 'TOTP_REQUIRED') navigate(`/login/totp${suffix}`, { replace: true });
          else if (status === 'TOTP_ENROLMENT_REQUIRED')
            navigate(`/login/enrol${suffix}`, { replace: true });
          else if (status === 'PASSWORD_CHANGE_REQUIRED')
            navigate('/change-password', { replace: true });
          else navigate(next, { replace: true });
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <AuthFailureView failure={failure} />
        <FormField
          name="identifier"
          label={t('common.identifier')}
          hint={t('common.identifierHint')}
          required
          requiredLabel={t('common.required')}
        >
          {(field) => (
            <Input
              {...field}
              type="text"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </FormField>
        <FormField
          name="password"
          label={t('common.password')}
          required
          requiredLabel={t('common.required')}
        >
          {(field) => <Input {...field} type="password" autoComplete="current-password" />}
        </FormField>
        <FormSubmitButton fullWidth loadingLabel={t('login.submit')}>
          {t('login.submit')}
        </FormSubmitButton>
      </Form>
      <p className="text-sm">
        <Link className="text-accent-text underline" to="/forgot-password">
          {t('login.forgot')}
        </Link>
      </p>
      <p className="text-sm text-fg-muted">{t('login.noAccount')}</p>
    </AuthLayout>
  );
}
