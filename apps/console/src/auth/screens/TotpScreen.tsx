import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button, Form, FormField, FormSubmitButton, Input } from '@hakorem/ui';
import { safeNext } from '../../lib/safeNext';
import { useAuth } from '../AuthProvider';
import { AuthLayout } from './AuthLayout';
import { AuthFailureView, useAuthFailure, type AuthFailure } from './failure';

export function TotpScreen() {
  const { t } = useTranslation('auth');
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  const schema = useMemo(
    () => z.object({ code: z.string().trim().min(1, t('common.required')) }),
    [t],
  );
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { code: '' } });
  const toFailure = useAuthFailure(form);
  const { setFocus } = form;
  // A new step: put the cursor where the next thing to type is.
  useEffect(() => setFocus('code'), [setFocus]);

  if (auth.status === 'authenticated') return <Navigate to={next} replace />;
  // No challenge (a reload loses it on purpose: it is not a session): start again.
  if (auth.pending?.kind !== 'totp') return <Navigate to="/login" replace />;

  return (
    <AuthLayout title={t('totp.title')} subtitle={t('totp.body')}>
      <Form
        form={form}
        onSubmit={async ({ code }) => {
          setFailure(null);
          await auth.verifyTotp(code);
          navigate(next, { replace: true });
        }}
        onSubmitError={(error) => setFailure(toFailure(error))}
      >
        <AuthFailureView failure={failure} />
        <FormField
          name="code"
          label={t('totp.code')}
          hint={t('totp.codeHint')}
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
        <FormSubmitButton fullWidth loadingLabel={t('totp.submit')}>
          {t('totp.submit')}
        </FormSubmitButton>
      </Form>
      <Button
        variant="secondary"
        onClick={() => {
          auth.cancelPending();
          navigate('/login', { replace: true });
        }}
      >
        {t('totp.cancel')}
      </Button>
    </AuthLayout>
  );
}
