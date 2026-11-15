import { HeartCrack, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import {
  Alert,
  Button,
  Card,
  CardBody,
  ErrorState,
  Field,
  MutationFailure,
  Select,
  Skeleton,
  Textarea,
  type PhotoValue,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation } from '../data/api';
import { isApprovalPending, type ApprovalPending } from '../lib/approval';
import { newRecordId } from '../lib/clientId';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { EvidencePhotoField } from '../lib/photo';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { AnimalPicker, animalName, useMortalityReasons, type PickedAnimal } from './animals';
import { useUnsentReports, type UnsentReport } from './unsentReports';

type Kind = 'DEATH' | 'CULL';

/** What happened to the report once it was sent: written off at once, or waiting for a manager. */
type Outcome =
  | { kind: 'posted'; tagNo: string; recordKind: Kind }
  | { kind: 'pending'; tagNo: string; recordKind: Kind; approval: ApprovalPending };

/**
 * Report a death or a cull from the pen, and send it in the same step (FR-LIV mortality, abuse case 2).
 * The reporter is the maker: the report goes in with its photograph, and the reporter submits it at once,
 * because only the reporter may (contract 1.24.0). At or above the value threshold the submit answers 202
 * and a manager decides it in the approvals inbox; below it, the loss is written off.
 *
 * It never dead-ends (owner, F6b):
 * - **The photograph is required for every report.** The reporter cannot see the value, and a loss above
 *   the threshold without one is refused with no way to add it later (A-F6b-03).
 * - **The roles that cannot read mortality records** (the Farm hand) report and submit through the care
 *   operations, which answer without the value.
 * - **A report whose submit did not get through stays on this page,** remembered on this device, with
 *   "Send it again", which repeats the same submit (ADR 0039).
 * - **A refusal stays on screen in words** (ADR 0038), never only a toast.
 */
export function ReportDeathScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const location = useLocation();
  const fixed = (location.state as { animal?: PickedAnimal } | null)?.animal ?? null;
  const principalId = auth.session?.principal.id ?? 'anonymous';
  const unsent = useUnsentReports(principalId);
  const canRead = auth.can('liv.mortality.read');

  const [intent, setIntent] = useState(() => ({ id: newRecordId(), at: new Date().toISOString() }));
  const [animal, setAnimal] = useState<PickedAnimal | null>(fixed);
  const [kind, setKind] = useState<Kind>('DEATH');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<PhotoValue | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [stuck, setStuck] = useState<UnsentReport | null>(null);

  const reasons = useMortalityReasons(kind);
  const reportFull = useApiMutation('reportMortality');
  const reportCare = useApiMutation('reportCareMortality');
  const submitFull = useApiMutation('submitMortalityRecord');
  const submitCare = useApiMutation('submitCareMortalityRecord');
  const report = canRead ? reportFull : reportCare;
  const submit = canRead ? submitFull : submitCare;
  const keyFor = useIntentKey();
  const submitKeyFor = useIntentKey();
  const submitFailure = useStateLabels({
    loading: t('reportDeath.sending'),
    emptyTitle: t('reportDeath.notSent'),
    errorTitle: t('reportDeath.notSent'),
    deniedTitle: t('mortality.denied'),
  });

  const body =
    animal === null || photo === null
      ? null
      : {
          id: intent.id,
          kind,
          stockUnitId: animal.id,
          reasonCode: reason,
          foundAt: intent.at,
          photoFileId: photo.fileId,
          ...(note.trim() === '' ? {} : { disposalNote: note.trim() }),
        };

  /** Sends a reported record for approval. Same record, same key: a retry repeats the same submit. */
  const send = async (row: UnsentReport) => {
    const answer = await submit.mutateAsync(
      { path: { id: row.id } },
      { idempotencyKey: submitKeyFor({ submit: row.id }) },
    );
    unsent.forget(row.id);
    setStuck(null);
    setOutcome(
      isApprovalPending(answer)
        ? { kind: 'pending', tagNo: row.tagNo, recordKind: row.kind, approval: answer }
        : { kind: 'posted', tagNo: row.tagNo, recordKind: row.kind },
    );
  };

  const startAnother = () => {
    setIntent({ id: newRecordId(), at: new Date().toISOString() });
    setAnimal(null);
    setReason('');
    setNote('');
    setPhoto(null);
    setProblems([]);
    setOutcome(null);
    report.reset();
    submit.reset();
  };

  const reasonsDenied = reasons.query.isError && reasons.query.error?.status === 403;
  const others = unsent.rows.filter((row) => row.id !== stuck?.id);

  return (
    <section aria-labelledby="report-death-title" className="grid max-w-2xl gap-4">
      <PageHeader
        title={t('reportDeath.title')}
        titleId="report-death-title"
        description={t('reportDeath.description')}
      />

      {outcome === null ? null : (
        <Alert
          severity={outcome.kind === 'pending' ? 'info' : 'good'}
          title={t(
            outcome.kind === 'pending' ? 'reportDeath.pendingTitle' : 'reportDeath.postedTitle',
            {
              kind: t(`mortalityKind.${outcome.recordKind}`),
              tag: outcome.tagNo,
            },
          )}
        >
          <p>
            {t(outcome.kind === 'pending' ? 'reportDeath.pendingBody' : 'reportDeath.postedBody')}
          </p>
          <Button variant="secondary" onClick={startAnother} className="mt-2">
            {t('reportDeath.another')}
          </Button>
        </Alert>
      )}

      {stuck === null ? null : (
        <Alert
          severity="critical"
          title={t('reportDeath.stuckTitle', {
            kind: t(`mortalityKind.${stuck.kind}`),
            tag: stuck.tagNo,
          })}
        >
          <p>{t('reportDeath.stuckBody')}</p>
          <MutationFailure error={submit.error} labels={submitFailure} />
          <Button
            className="mt-2"
            loading={submit.isPending}
            loadingLabel={t('reportDeath.sending')}
            onClick={() => void send(stuck).catch(() => undefined)}
          >
            <Send aria-hidden="true" />
            {t('reportDeath.sendAgain')}
          </Button>
        </Alert>
      )}

      {others.length === 0 ? null : (
        <section aria-labelledby="unsent-title" className="grid gap-2">
          <h2 id="unsent-title" className="text-lg font-semibold">
            {t('reportDeath.unsentTitle')}
          </h2>
          <p className="text-fg-muted">{t('reportDeath.unsentBody')}</p>
          <ul className="grid gap-2">
            {others.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <span>
                  {t('reportDeath.unsentRow', {
                    kind: t(`mortalityKind.${row.kind}`),
                    tag: row.tagNo,
                  })}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStuck(row);
                    void send(row).catch(() => undefined);
                  }}
                >
                  <Send aria-hidden="true" />
                  {t('reportDeath.sendAgain')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outcome !== null ? null : (
        <Card>
          <CardBody>
            {/* Our words on each field, not the browser's bubble: the checks are done in onSubmit. */}
            <form
              noValidate
              aria-labelledby="report-death-title"
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const found: string[] = [];
                if (animal === null) found.push('animal');
                if (reason === '') found.push('reason');
                if (photo === null) found.push('photo');
                setProblems(found);
                if (found.length === 0) setConfirming(true);
              }}
            >
              {fixed === null ? (
                <AnimalPicker
                  label={t('mortality.animal')}
                  value={animal}
                  onChange={setAnimal}
                  error={problems.includes('animal') ? t('common:field.required') : undefined}
                />
              ) : (
                <p className="font-semibold">{animalName(fixed)}</p>
              )}
              <Field
                label={t('mortality.kind')}
                required
                requiredLabel={t('common:field.required')}
              >
                <Select
                  value={kind}
                  onValueChange={(value) => {
                    setKind(value === 'CULL' ? 'CULL' : 'DEATH');
                    setReason('');
                  }}
                  options={[
                    { value: 'DEATH', label: t('mortalityKind.DEATH') },
                    { value: 'CULL', label: t('mortalityKind.CULL') },
                  ]}
                />
              </Field>
              {reasons.query.isPending ? (
                <Skeleton label={t('reportDeath.loadingReasons')} className="h-control-md" />
              ) : reasonsDenied ? (
                <ErrorState
                  compact
                  title={t('reportDeath.reasonsDenied')}
                  description={t('reportDeath.reasonsDeniedBody')}
                />
              ) : reasons.query.isError ? (
                <ErrorState
                  compact
                  title={t('mortality.reasonsError')}
                  action={
                    <Button variant="secondary" onClick={() => void reasons.query.refetch()}>
                      {t('common:states.retry')}
                    </Button>
                  }
                />
              ) : (
                <Field
                  label={t('mortality.reason')}
                  required
                  requiredLabel={t('common:field.required')}
                  error={problems.includes('reason') ? t('common:field.required') : undefined}
                >
                  <Select
                    value={reason}
                    onValueChange={setReason}
                    placeholder={t('mortality.chooseReason')}
                    options={reasons.options}
                  />
                </Field>
              )}
              <EvidencePhotoField
                label={t('reportDeath.photo')}
                hint={t('reportDeath.photoHint')}
                value={photo}
                onChange={setPhoto}
                required
                missing={problems.includes('photo')}
              />
              <Field label={t('mortality.disposal')} hint={t('mortality.disposalHint')}>
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
              <div>
                <Button type="submit" disabled={reasonsDenied}>
                  <HeartCrack aria-hidden="true" />
                  {t('reportDeath.review')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {confirming && body !== null && animal !== null ? (
        <ConfirmDialog
          open
          onOpenChange={setConfirming}
          title={t('reportDeath.confirmTitle', {
            kind: t(`mortalityKind.${kind}`),
            animal: animalName(animal),
          })}
          body={t('reportDeath.confirmBody')}
          consequence={t('reportDeath.confirmConsequence')}
          confirmLabel={t('reportDeath.send')}
          pendingLabel={t('reportDeath.sending')}
          pending={report.isPending || submit.isPending}
          error={report.error}
          failedTitle={t('reportDeath.notReported')}
          destructive
          icon={HeartCrack}
          confirmIcon={Send}
          onConfirm={() =>
            void (async () => {
              const record = await report.mutateAsync({ body }, { idempotencyKey: keyFor(body) });
              const row: UnsentReport = {
                id: record.id,
                tagNo: animal.tagNo,
                kind,
                reportedAt: intent.at,
              };
              unsent.remember(row);
              setConfirming(false);
              try {
                await send(row);
              } catch {
                setStuck(row);
              }
            })().catch(() => undefined)
          }
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-fg-muted">{t('mortality.animal')}</dt>
            <dd>{animalName(animal)}</dd>
            <dt className="text-fg-muted">{t('mortality.kind')}</dt>
            <dd>{t(`mortalityKind.${kind}`)}</dd>
            <dt className="text-fg-muted">{t('mortality.reason')}</dt>
            <dd>{reasons.options.find((option) => option.value === reason)?.label ?? reason}</dd>
            <dt className="text-fg-muted">{t('reportDeath.photo')}</dt>
            <dd>{t('reportDeath.photoAttached')}</dd>
          </dl>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
