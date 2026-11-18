import { EyeOff, KeyRound, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Field,
  Input,
  MoneyDisplay,
  MoneyInput,
  Select,
  Skeleton,
  StatusBadge,
} from '@hakorem/ui';
import { useApiAllPages } from '../../data/api';
import { ConfirmDialog } from '../../lib/ConfirmDialog';
import { RequestReference } from '../../lib/RequestReference';
import { useShiftWitnesses, shiftWitnessesOn } from '../../requested/shiftWitnesses';
import { requestedOn } from '../../requested/switch';
import { getTill, useTill } from '../offline/till';
import {
  CONFIRMED_STATUSES,
  type CashMovementEntry,
  type LocalAuth,
  type OfflinePack,
  type PinApprovalRecord,
  type ShiftRecord,
} from '../offline/types';
import { approvers } from '../pin/pin';
import { PinApprovalField } from '../pin/PinCheck';
import { MOVEMENT_KINDS, reasonsFor, type MovementKind } from './reasons';

/** Who witnesses a drop, by the owner's rule (2026-11-17) and what this till can know. */
type WitnessSource =
  /** Online with CR-050: the supervisors signed in at the branch, from the server. */
  | 'signed-in'
  /** A supervisor's PIN on this till (CR-032), offline or where the till cannot see who is signed in. */
  | 'pin'
  /** Nobody the till can name: the drop goes ahead marked unwitnessed. */
  | 'offline'
  | 'cannot-see';

/** A named witness: chosen from those signed in, or proved by a PIN on this till. */
interface Witness {
  id: string;
  name: string;
  pin: PinApprovalRecord | null;
}

/**
 * A cash drop, pay-out or pay-in on the cashier's own open shift (2.5.0, FR-POS-016). Every kind takes a
 * reason from those that fit it (`reasons.ts`). A drop's witness is a supervisor signed in at the branch
 * when one is; when none is, the drop goes ahead and says plainly that it is unwitnessed (owner,
 * 2026-11-17). It is made on the till and sent at once (`recordCashMovement`), so it is kept offline too;
 * what the server said stays on screen until the next one.
 */
export function CashMovementForm({
  shift,
  pack,
  online,
}: {
  shift: ShiftRecord;
  pack: OfflinePack;
  online: boolean;
}) {
  const { t } = useTranslation(['posShift', 'pos']);
  const { snapshot } = useTill();
  const [kind, setKind] = useState<MovementKind>('CASH_DROP');
  const [amount, setAmount] = useState<number | null>(null);
  const [chosenReason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [chosenWitness, setChosenWitness] = useState('');
  const [pinWitness, setPinWitness] = useState<PinApprovalRecord | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [tried, setTried] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);

  const fetched = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'CASH_MOVEMENT' } },
    { enabled: online },
  );
  const reasons = reasonsFor(kind, [...pack.reasonCodes, ...(fetched.data?.items ?? [])]);
  // One reason fits a drop and a pay-in: it is chosen for the cashier.
  const reason =
    reasons.length === 1
      ? (reasons[0]?.code ?? '')
      : reasons.some((r) => r.code === chosenReason)
        ? chosenReason
        : '';
  const needsNote = reasons.find((r) => r.code === reason)?.requiresNote === true;

  const isDrop = kind === 'CASH_DROP';
  const localAuth = requestedOn('CR-032') ? (snapshot?.localAuth ?? null) : null;
  const pinApprovers =
    localAuth === null ? [] : approvers(localAuth.verifiers, 'CASH_DROP_WITNESS');
  const source: WitnessSource =
    online && shift.confirmed && shiftWitnessesOn()
      ? 'signed-in'
      : pinApprovers.length > 0
        ? 'pin'
        : online
          ? 'cannot-see'
          : 'offline';
  const signedIn = useShiftWitnesses(shift.id, isDrop && source === 'signed-in');
  const supervisors = signedIn.data?.data ?? [];
  const supervisor = supervisors.find((person) => person.id === chosenWitness);
  const named: Witness | null = !isDrop
    ? null
    : source === 'pin' && pinWitness !== null
      ? { id: pinWitness.principalId, name: pinWitness.displayName, pin: pinWitness }
      : source === 'signed-in' && supervisor !== undefined
        ? { id: supervisor.id, name: supervisor.displayName, pin: null }
        : null;
  // A witness must be named whenever the till can see one; otherwise the drop is unwitnessed.
  const witnessNeeded =
    isDrop && (source === 'pin' || (source === 'signed-in' && supervisors.length > 0));
  const witnessUnknown = isDrop && source === 'signed-in' && signedIn.data === undefined;
  const unwitnessed = isDrop && !witnessNeeded && !witnessUnknown;

  const kindLabel = t(`pos:queue.cash.${kind}`);
  const ready =
    amount !== null &&
    amount > 0 &&
    reason !== '' &&
    (!needsNote || note.trim() !== '') &&
    (!witnessNeeded || named !== null) &&
    !witnessUnknown;

  const sent = sentId === null ? null : (snapshot?.entries.find((e) => e.id === sentId) ?? null);

  return (
    <section
      aria-labelledby="cash-title"
      className="grid gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <h3 id="cash-title" className="text-lg font-semibold">
        {t('cash.title')}
      </h3>
      <Field label={t('cash.kind')}>
        <Select
          value={kind}
          onValueChange={(value) => {
            setKind(value as MovementKind);
            setReason('');
            setTried(false);
          }}
          options={MOVEMENT_KINDS.map((value) => ({
            value,
            label: t(`pos:queue.cash.${value}`),
          }))}
        />
      </Field>
      <Field
        label={t('cash.amount')}
        error={tried && (amount === null || amount === 0) ? t('cash.amountError') : undefined}
      >
        <MoneyInput value={amount} onValueChange={setAmount} />
      </Field>
      <Field
        label={t('cash.reason')}
        hint={reasons.length === 0 ? t('cash.noReasons', { kind: kindLabel }) : undefined}
        error={tried && reasons.length > 0 && reason === '' ? t('cash.reasonError') : undefined}
      >
        <Select
          value={reason}
          onValueChange={setReason}
          placeholder={t('cash.reasonPlaceholder')}
          options={reasons.map((code) => ({ value: code.code, label: code.description }))}
        />
      </Field>
      <Field
        label={t('cash.note')}
        hint={needsNote ? t('cash.noteRequired') : t('cash.noteOptional')}
        error={tried && needsNote && note.trim() === '' ? t('cash.noteError') : undefined}
      >
        <Input value={note} onChange={(event) => setNote(event.target.value)} autoComplete="off" />
      </Field>
      {isDrop ? (
        <WitnessPart
          source={source}
          query={signedIn}
          supervisors={supervisors}
          chosen={chosenWitness}
          onChoose={setChosenWitness}
          pin={{
            approvers: pinApprovers,
            localAuth,
            record: pinWitness,
            onApproved: setPinWitness,
          }}
          error={tried && witnessNeeded && named === null}
        />
      ) : null}
      <Button
        variant="secondary"
        onClick={() => {
          setTried(true);
          if (ready) setConfirming(true);
        }}
      >
        {t('cash.review')}
      </Button>
      {sent !== null && sent.kind === 'CASH_MOVEMENT' ? (
        <Outcome entry={sent} online={online} />
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('cash.confirmTitle', { kind: kindLabel })}
        body={online ? t('cash.confirmBody') : t('cash.confirmOffline')}
        confirmLabel={t('cash.record')}
        pendingLabel={t('cash.recording')}
        pending={false}
        error={null}
        failedTitle={t('cash.failed', { kind: kindLabel })}
        onConfirm={() => {
          if (amount === null) return;
          void getTill()
            .recordCashMovement(
              {
                kind,
                amountPesewas: amount,
                reasonCode: reason,
                ...(note.trim() !== '' ? { note: note.trim() } : {}),
                ...(named !== null ? { witnessId: named.id } : {}),
              },
              named?.pin ? [named.pin] : [],
            )
            .then((entry) => {
              setSentId(entry.id);
              setConfirming(false);
              setPinWitness(null);
              setChosenWitness('');
              setAmount(null);
              setReason('');
              setNote('');
              setTried(false);
            });
        }}
      >
        <p className="flex items-baseline justify-between text-xl font-bold">
          <span>{kindLabel}</span>
          <MoneyDisplay pesewas={amount ?? 0} />
        </p>
        <p>{reasons.find((r) => r.code === reason)?.description}</p>
        {named !== null ? <p>{t('cash.witnessed', { name: named.name })}</p> : null}
        {unwitnessed ? <UnwitnessedBadge /> : null}
      </ConfirmDialog>
    </section>
  );
}

function UnwitnessedBadge() {
  const { t } = useTranslation('posShift');
  return <StatusBadge tone="warning" icon={EyeOff} label={t('cash.unwitnessedShort')} />;
}

function WitnessPart({
  source,
  query,
  supervisors,
  chosen,
  onChoose,
  pin,
  error,
}: {
  source: WitnessSource;
  query: ReturnType<typeof useShiftWitnesses>;
  supervisors: { id: string; displayName: string }[];
  chosen: string;
  onChoose: (id: string) => void;
  pin: {
    approvers: ReturnType<typeof approvers>;
    localAuth: LocalAuth | null;
    record: PinApprovalRecord | null;
    onApproved: (record: PinApprovalRecord) => void;
  };
  error: boolean;
}) {
  const { t } = useTranslation('posShift');
  if (source === 'pin' && pin.localAuth !== null) {
    return pin.record !== null ? (
      <p className="flex items-center gap-2" data-slot="cash-witness">
        <KeyRound aria-hidden="true" className="size-icon-md" />
        {t('cash.witnessed', { name: pin.record.displayName })}
      </p>
    ) : (
      <div className="grid gap-2">
        <p className="text-sm text-fg-muted">{t('cash.witnessHint')}</p>
        <PinApprovalField
          approval="CASH_DROP_WITNESS"
          approvers={pin.approvers}
          policy={pin.localAuth.policy}
          label={t('cash.witness')}
          onApproved={pin.onApproved}
        />
        {error ? <p className="text-sm text-critical-fg">{t('cash.witnessError')}</p> : null}
      </div>
    );
  }
  if (source === 'signed-in') {
    if (query.isError) {
      return (
        <Alert
          severity="critical"
          title={t('cash.witnessesFailed')}
          actions={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              <RotateCw aria-hidden="true" />
              {t('cash.witnessesRetry')}
            </Button>
          }
        />
      );
    }
    if (query.data === undefined) {
      return <Skeleton label={t('cash.witnessesLoading')} shape="line" />;
    }
    if (supervisors.length > 0) {
      return (
        <Field
          label={t('cash.signedIn')}
          hint={t('cash.signedInHint')}
          error={error ? t('cash.signedInError') : undefined}
        >
          <Select
            value={chosen}
            onValueChange={onChoose}
            placeholder={t('cash.signedInPlaceholder')}
            options={supervisors.map((person) => ({ value: person.id, label: person.displayName }))}
          />
        </Field>
      );
    }
  }
  const why =
    source === 'signed-in' ? 'noneSignedIn' : source === 'offline' ? 'offline' : 'cannotSee';
  return (
    <div data-slot="cash-unwitnessed">
      <Alert severity="warning" title={t('cash.unwitnessed.title')}>
        {t(`cash.unwitnessed.${why}`)}
      </Alert>
    </div>
  );
}

/** What became of the last movement recorded here, in words, until the next one. */
function Outcome({ entry, online }: { entry: CashMovementEntry; online: boolean }) {
  const { t } = useTranslation(['posShift', 'pos']);
  const kind = t(`pos:queue.cash.${entry.payload.kind}`);
  const unwitnessed = entry.payload.kind === 'CASH_DROP' && entry.payload.witnessId === undefined;
  if (entry.failure !== null) {
    return (
      <div data-slot="cash-outcome">
        <Alert severity="critical" title={t('cash.failed', { kind })}>
          {entry.failure.message}
          {entry.failure.correlationId !== '' ? (
            <>
              {' '}
              {t('pos:referenceLabel')} <RequestReference value={entry.failure.correlationId} />
            </>
          ) : null}
        </Alert>
      </div>
    );
  }
  const title = CONFIRMED_STATUSES.includes(entry.localStatus)
    ? unwitnessed
      ? t('cash.recordedUnwitnessed', { kind })
      : t('cash.recorded', { kind })
    : online
      ? t('cash.sending', { kind })
      : t('cash.kept', { kind });
  return (
    <div data-slot="cash-outcome">
      <Alert
        severity={CONFIRMED_STATUSES.includes(entry.localStatus) ? 'good' : 'info'}
        title={title}
      />
    </div>
  );
}
