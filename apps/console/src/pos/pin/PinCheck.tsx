import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field, Input, Select } from '@hakorem/ui';
import type { PinApproval, PinVerifier, TillPinPolicy } from '../../requested/tillPin';
import { getTill, type PinOutcome } from '../offline/till';
import type { PinApprovalRecord } from '../offline/types';

/** A PIN outcome in words, persistent on screen (CLAUDE.md: a refusal is never only a toast). */
export function PinOutcomeAlert({
  outcome,
  name,
  policy,
}: {
  outcome: PinOutcome | null;
  name: string;
  policy: TillPinPolicy;
}) {
  const { t } = useTranslation('pos');
  if (outcome === null || outcome.kind === 'ok') return null;
  const words =
    outcome.kind === 'wrong'
      ? t('pin.wrong', { count: outcome.attemptsLeft, name })
      : outcome.kind === 'locked-out'
        ? t('pin.lockedOut', { name })
        : outcome.kind === 'not-a-pin'
          ? t('pin.notAPin', { min: policy.minDigits, max: policy.maxDigits })
          : outcome.kind === 'weak-verifier'
            ? t('pin.weakVerifier', { name })
            : t('pin.noVerifier', { name });
  return <Alert severity="critical" title={words} />;
}

/** The PIN field: masked, digits, never remembered by the browser. */
export function PinInput({
  value,
  onChange,
  policy,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  policy: TillPinPolicy;
  label?: string;
}) {
  const { t } = useTranslation('pos');
  return (
    <Field
      label={label ?? t('pin.label')}
      hint={t('pin.hint', { min: policy.minDigits, max: policy.maxDigits })}
    >
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={policy.maxDigits}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
      />
    </Field>
  );
}

/**
 * A second person's approval on the till (CR-032): they choose themselves, enter their PIN, and the till
 * checks it on the device. Only people whose verifier lists the approval are offered. The record names
 * who approved and which verifier, and goes on what it approved.
 */
export function PinApprovalField({
  approval,
  approvers,
  policy,
  label,
  onApproved,
}: {
  approval: PinApproval;
  approvers: readonly PinVerifier[];
  policy: TillPinPolicy;
  label: string;
  onApproved: (record: PinApprovalRecord) => void;
}) {
  const { t } = useTranslation('pos');
  const [who, setWho] = useState(approvers[0]?.principalId ?? '');
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<PinOutcome | null>(null);
  const person = approvers.find((v) => v.principalId === who) ?? null;
  if (approvers.length === 0) return <Alert severity="warning" title={t('pin.noneHere')} />;
  return (
    <div className="grid gap-3">
      <Field label={label}>
        <Select
          value={who}
          onValueChange={(value) => {
            setWho(value);
            setOutcome(null);
          }}
          options={approvers.map((v) => ({ value: v.principalId, label: v.displayName }))}
        />
      </Field>
      <PinInput value={pin} onChange={setPin} policy={policy} />
      <Button
        variant="secondary"
        disabled={person === null || pin === ''}
        loading={checking}
        loadingLabel={t('pin.checking')}
        onClick={() => {
          const entered = pin;
          setPin('');
          setChecking(true);
          void getTill()
            .checkPin(who, entered, approval)
            .then((result) => {
              setOutcome(result);
              if (result.kind === 'ok' && result.record !== null) onApproved(result.record);
            })
            .finally(() => setChecking(false));
        }}
      >
        <KeyRound aria-hidden="true" />
        {t('pin.approve')}
      </Button>
      <PinOutcomeAlert outcome={outcome} name={person?.displayName ?? ''} policy={policy} />
    </div>
  );
}
