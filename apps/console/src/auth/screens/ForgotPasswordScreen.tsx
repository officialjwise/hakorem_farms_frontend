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

export function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');
  const auth = useAuth();
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const schema = useMemo(
    () => z.object({ identifier: z.string().trim().min(1, t('common.required')) }),
    [t],
  );
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { identifier: '' } });
  const toFailure = useAuthFailure(form);

  if (sent) {
    return (
      <AuthLayout title={t('forgot.sentTitle')} subtitle={t('forgot.sentBody')}>
        <Button asChild>
          <Link to="/reset-password">{t('forgot.haveCode')}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/login">{t('common.back')}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('forgot.title')} subtitle={t('forgot.body')}>
      <Form
        form={form}
        onSubmit={async ({ identifier }) => {
          setFailure(null);
          await auth.requestPasswordReset(identifier);
          setSent(true);
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
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </FormField>
        <FormSubmitButton fullWidth loadingLabel={t('forgot.submit')}>
          {t('forgot.submit')}
        </FormSubmitButton>
      </Form>
      <Button asChild variant="secondary">
        <Link to="/login">{t('common.back')}</Link>
      </Button>
    </AuthLayout>
  );
}
