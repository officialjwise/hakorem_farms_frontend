import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import {
  Button,
  Checkbox,
  Field,
  Form,
  FormField,
  FormSubmitButton,
  Input,
  Spinner,
} from '@hakorem/ui';
import { safeNext } from '../../lib/safeNext';
import { useAuth } from '../AuthProvider';
import type { TotpEnrolment } from '../types';
import { AuthLayout } from './AuthLayout';
import { AuthFailureView, useAuthFailure, type AuthFailure } from './failure';

/** "JBSW Y3DP EHPK 3PXP": the key in groups of four, easier to copy by hand. Spaces are ignored by apps. */
function grouped(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ');
}

/**
 * First sign-in for a role that must use TOTP (Owner, Accountant, Manager) and has not set it up: the
 * sign-in answered TOTP_ENROLMENT_REQUIRED with a challenge token (CR-006, answered by the contract). Three
 * steps on one screen:
 *
 * 1. `startTotpEnrolment` with the challenge shows the QR image the server drew (`qrCodeDataUri`, so the
 *    console takes no QR dependency) and the key in text, kept on screen for a phone that cannot scan.
 * 2. A first code confirms it (`confirmTotpEnrolment`); the server sets the session cookies.
 * 3. The recovery codes, shown once, stay until the person says they have kept them. Only then is the
 *    session read and adopted, so nothing navigates away from the codes.
 *
 * A reload loses the challenge on purpose (it is not a session), and the screen sends the person back to
 * sign in.
 */
export function TotpEnrolScreen() {
  const { t } = useTranslation('auth');
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null);
  const [startFailure, setStartFailure] = useState<AuthFailure | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [kept, setKept] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishFailure, setFinishFailure] = useState<AuthFailure | null>(null);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const started = useRef(false);

  const schema = useMemo(
    () => z.object({ code: z.string().trim().min(1, t('common.required')) }),
    [t],
  );
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { code: '' } });
  const toFailure = useAuthFailure(form);
  const pendingEnrolment = auth.pending?.kind === 'totp-enrolment';
  const { startTotpEnrolment } = auth;

  // The secret is asked for once per challenge: a second start would show a different key.
  useEffect(() => {
    if (!pendingEnrolment || started.current) return;
    started.current = true;
    startTotpEnrolment()
      .then(setEnrolment)
      .catch((error: unknown) => setStartFailure(toFailure(error)));
  }, [pendingEnrolment, startTotpEnrolment, toFailure]);

  if (auth.status === 'authenticated') return <Navigate to={next} replace />;
  if (!pendingEnrolment) return <Navigate to="/login" replace />;

  const startAgain = (
    <Button
      variant="secondary"
      onClick={() => {
        auth.cancelPending();
        navigate('/login', { replace: true });
      }}
    >
      {t('enrol.cancel')}
    </Button>
  );

  if (codes !== null) {
    return (
      <AuthLayout title={t('enrol.codesTitle')} subtitle={t('enrol.codesBody')}>
        <ul
          aria-label={t('enrol.codesList')}
          className="grid grid-cols-2 gap-2 rounded-md border border-border-strong bg-surface-sunken p-3 font-mono text-base"
        >
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <AuthFailureView failure={finishFailure} />
        <Field label={t('enrol.kept')}>
          <Checkbox checked={kept} onCheckedChange={(value) => setKept(value === true)} />
        </Field>
        <Button
          fullWidth
          disabled={!kept}
          loading={finishing}
          loadingLabel={t('enrol.finishing')}
          onClick={() => {
            setFinishing(true);
            setFinishFailure(null);
            auth
              .finishTotpEnrolment()
              .then(() => navigate(next, { replace: true }))
              .catch((error: unknown) => {
                setFinishing(false);
                setFinishFailure(toFailure(error));
              });
          }}
        >
          {t('enrol.finish')}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('enrol.title')} subtitle={t('enrol.body')}>
      <AuthFailureView failure={startFailure} />
      {enrolment === null ? (
        startFailure === null ? (
          <Spinner label={t('enrol.loading')} />
        ) : null
      ) : (
        <>
          <section aria-labelledby="enrol-scan" className="grid gap-2">
            <h2 id="enrol-scan" className="font-semibold">
              {t('enrol.scanTitle')}
            </h2>
            {/* Drawn light whatever the theme, so a phone camera can read it. */}
            <div
              data-theme="light"
              className="w-fit rounded-md border border-border bg-surface p-2"
            >
              <img
                src={enrolment.qrCodeDataUri}
                alt={t('enrol.qrAlt')}
                width={192}
                height={192}
                className="size-48"
              />
            </div>
            <p className="text-sm text-fg-muted">{t('enrol.cannotScan')}</p>
            <p>
              <span className="text-sm text-fg-muted">{t('enrol.key')} </span>
              <code
                aria-label={t('enrol.keyLabel', { key: enrolment.secretBase32 })}
                className="font-mono text-base font-semibold break-all select-all"
              >
                {grouped(enrolment.secretBase32)}
              </code>
            </p>
          </section>
          <Form
            form={form}
            onSubmit={async ({ code }) => {
              setFailure(null);
              setCodes(await auth.confirmTotpEnrolment(code));
            }}
            onSubmitError={(error) => setFailure(toFailure(error))}
          >
            <h2 className="font-semibold">{t('enrol.confirmTitle')}</h2>
            <AuthFailureView failure={failure} />
            <FormField
              name="code"
              label={t('enrol.code')}
              hint={t('enrol.codeHint')}
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
            <FormSubmitButton fullWidth loadingLabel={t('enrol.confirming')}>
              {t('enrol.confirm')}
            </FormSubmitButton>
          </Form>
        </>
      )}
      {startAgain}
    </AuthLayout>
  );
}
