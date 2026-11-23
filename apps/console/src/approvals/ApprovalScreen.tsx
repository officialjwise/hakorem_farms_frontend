import { Check, Undo2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import {
  Alert,
  AnimalTag,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  MoneyDisplay,
  QueryBoundary,
  Skeleton,
  Textarea,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure, useStepUp } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { REASON_MAX_LENGTH, ReasonDialog } from '../lib/ReasonDialog';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import {
  ApprovalStatusBadge,
  subjectPage,
  useKindName,
  type ApprovalRequest,
} from './presentation';
import { useReferenceCopy } from '../lib/RequestReference';

/**
 * One approval request, with its evidence before the decision: what is asked, the amount, who asked and
 * when, the record it is about (opened where the console has its page), and the photograph attached to it.
 * For a death or cull the record itself is shown as well, to a role that can read it.
 *
 * Separation of duties: the person who asked never sees Approve or Reject on their own request; they may
 * withdraw it. If the server still refuses a decision (MAKER_CANNOT_CHECK, a request decided meanwhile,
 * one that lapsed or whose record changed), the refusal stays in the dialog, in words (ADR 0038).
 */
export function ApprovalScreen() {
  const { t } = useTranslation(['approvals', 'common']);
  const { id = '' } = useParams();
  const request = useApiQuery('getApproval', { path: { id } });
  const labels = useStateLabels({
    loading: t('detail.loading'),
    emptyTitle: t('detail.notFound'),
    errorTitle: t('detail.error'),
    deniedTitle: t('detail.denied'),
  });
  const back = (
    <Link to="/approvals" className="w-fit text-accent-text underline">
      {t('detail.back')}
    </Link>
  );
  if (request.error?.status === 404) {
    return (
      <EmptyState
        title={t('detail.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={request}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-48" />}
    >
      {(current) => <RequestDetail request={current} back={back} />}
    </QueryBoundary>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{term}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function RequestDetail({ request, back }: { request: ApprovalRequest; back: ReactNode }) {
  const { t } = useTranslation(['approvals', 'common']);
  const auth = useAuth();
  const kindName = useKindName();
  const [notice, setNotice] = useState<string | null>(null);
  const link = subjectPage(request.subject, auth.can);
  const doc = request.subject.number ?? t('detail.notNumbered');
  return (
    <article aria-labelledby="approval-title" className="grid gap-4">
      <div className="grid gap-2">
        {back}
        <PageHeader
          title={t('detail.title', { kind: kindName(request.kind) })}
          titleId="approval-title"
          description={<ApprovalStatusBadge status={request.status} />}
        />
      </div>
      {notice === null ? null : <Alert severity="good" title={notice} />}

      <Card>
        <CardBody className="grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="evidence-title" className="grid content-start gap-2">
            <h2 id="evidence-title" className="text-lg font-semibold">
              {t('detail.evidence')}
            </h2>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
              <Fact term={t('detail.summary')}>{request.summary}</Fact>
              <Fact term={t('detail.amount')}>
                {request.amountPesewas === null ? (
                  t('list.noAmount')
                ) : (
                  <MoneyDisplay pesewas={request.amountPesewas} strong />
                )}
              </Fact>
              <Fact term={t('detail.subject')}>
                {request.subject.docType === 'PROCESSING_REVERSAL' ? (
                  <ReversalOrderLink reversalId={request.subject.id} fallback={doc} />
                ) : link === null ? (
                  `${request.subject.docType} ${doc}`
                ) : (
                  <Link to={link} className="text-accent-text underline">
                    {request.subject.number === null
                      ? t('detail.openRecord')
                      : t('detail.openSubject', { doc: request.subject.number })}
                  </Link>
                )}
              </Fact>
              <Fact term={t('detail.askedBy')}>{request.requestedBy.displayName}</Fact>
              <Fact term={t('detail.askedAt')}>
                <When instant={request.requestedAt} />
              </Fact>
              <Fact term={t('detail.expires')}>
                <When instant={request.expiresAt} empty={t('detail.noExpiry')} />
              </Fact>
              {request.decidedBy === null ? null : (
                <>
                  <Fact term={t('detail.decidedBy')}>{request.decidedBy.displayName}</Fact>
                  <Fact term={t('detail.decidedAt')}>
                    <When instant={request.decidedAt} />
                  </Fact>
                  <Fact term={t('detail.decisionReason')}>{request.decisionReason ?? '—'}</Fact>
                </>
              )}
            </dl>
          </section>
          <section aria-labelledby="photo-title" className="grid content-start gap-2">
            <h2 id="photo-title" className="text-lg font-semibold">
              {t('detail.photo')}
            </h2>
            {request.evidenceFileId === null ? (
              <p className="text-fg-muted">{t('detail.photoNone')}</p>
            ) : (
              <EvidencePhoto fileId={request.evidenceFileId} />
            )}
          </section>
        </CardBody>
      </Card>

      {request.subject.docType === 'MORTALITY_RECORD' ? (
        <MortalityEvidence recordId={request.subject.id} />
      ) : null}

      <Decision request={request} onNotice={setNotice} />
    </article>
  );
}

/**
 * The photograph, through a signed link that lasts five minutes (`createFileSignedUrl`), once the file is
 * `CLEAN`. Until then, and when the role cannot open someone else's upload, it says so in words.
 */
function EvidencePhoto({ fileId }: { fileId: string }) {
  const { t } = useTranslation(['approvals', 'common']);
  const file = useApiQuery('getFile', { path: { id: fileId } });
  const signed = useApiMutation('createFileSignedUrl');
  const referenceCopy = useReferenceCopy();
  const clean = file.data?.scanStatus === 'CLEAN';
  const { mutate, status } = signed;
  useEffect(() => {
    if (clean && status === 'idle') mutate({ path: { id: fileId } });
  }, [clean, status, mutate, fileId]);

  if (file.isPending || (clean && (status === 'idle' || status === 'pending'))) {
    return <Skeleton label={t('detail.photoLoading')} shape="block" className="h-48" />;
  }
  const failure = file.error ?? signed.error;
  if (failure !== null) {
    return failure.correlationId === '' ? (
      <ErrorState compact title={t('detail.photoCannot')} description={failure.message} />
    ) : (
      <ErrorState
        compact
        title={t('detail.photoCannot')}
        description={failure.message}
        reference={failure.correlationId}
        referenceLabel={t('common:states.reference')}
        referenceCopy={referenceCopy}
      />
    );
  }
  if (!clean) return <p role="status">{t('detail.photoPending')}</p>;
  if (signed.data === undefined) return null;
  return (
    <figure className="grid gap-1">
      <img
        src={signed.data.url}
        alt={t('detail.photoAlt')}
        className="max-h-80 w-auto max-w-full rounded-md border border-border object-contain"
      />
      <figcaption className="text-control-sm text-fg-muted">
        {t('detail.photoLinkExpires')}
      </figcaption>
    </figure>
  );
}

/**
 * A processing reversal's approval names the reversal, not its order; `listProcessingOrders` finds the
 * order by `reversalId` in one read (CR-027, 1.53.0), so the inbox links to it. A role that cannot read
 * processing orders, or a reversal whose order is not found, sees the record in words.
 */
function ReversalOrderLink({ reversalId, fallback }: { reversalId: string; fallback: string }) {
  const { t } = useTranslation('approvals');
  const auth = useAuth();
  const canRead = auth.can('prc.order.read');
  const orders = useApiQuery(
    'listProcessingOrders',
    { query: { reversalId, limit: 1 } },
    { enabled: canRead },
  );
  const order = orders.data?.data[0];
  if (!canRead) return <>{t('detail.reversalOf', { doc: fallback })}</>;
  if (orders.isError) return <>{t('detail.reversalOrderError', { doc: fallback })}</>;
  if (orders.data === undefined) {
    return <Skeleton label={t('detail.reversalOrderLoading')} className="h-5 w-48" />;
  }
  if (order === undefined) return <>{t('detail.reversalOrderMissing', { doc: fallback })}</>;
  return (
    <Link to={`/processing-orders/${order.id}`} className="text-accent-text underline">
      {order.orderNo === null
        ? t('detail.openReversalOrderUnnumbered')
        : t('detail.openReversalOrder', { doc: order.orderNo })}
    </Link>
  );
}

/** A death or cull's own record, for a role that reads them: the animal, the reason and the value. */
function MortalityEvidence({ recordId }: { recordId: string }) {
  const { t } = useTranslation(['approvals', 'common']);
  const auth = useAuth();
  const canRead = auth.can('liv.mortality.read');
  const record = useApiQuery(
    'getMortalityRecord',
    { path: { id: recordId } },
    { enabled: canRead },
  );
  return (
    <Card>
      <CardBody className="grid gap-2">
        <h2 className="text-lg font-semibold">{t('detail.record')}</h2>
        {!canRead ? (
          <p className="text-fg-muted">{t('detail.recordUnavailable')}</p>
        ) : record.data === undefined ? (
          record.isError ? (
            <ErrorState compact title={t('detail.error')} description={record.error.message} />
          ) : (
            <Skeleton label={t('detail.loading')} className="h-24" />
          )
        ) : (
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
            <Fact term={t('detail.recordAnimal')}>
              <AnimalTag tagNo={record.data.animal?.tagNo ?? record.data.stockUnit.identifier} />
            </Fact>
            <Fact term={t('detail.recordReason')}>{record.data.reasonCode}</Fact>
            <Fact term={t('detail.recordFound')}>
              <When instant={record.data.foundAt} />
            </Fact>
            <Fact term={t('detail.recordLocation')}>{record.data.location?.name ?? '—'}</Fact>
            <Fact term={t('detail.recordValue')}>
              <MoneyDisplay pesewas={record.data.valuePesewas} strong />
            </Fact>
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

function Decision({
  request,
  onNotice,
}: {
  request: ApprovalRequest;
  onNotice: (message: string) => void;
}) {
  const { t } = useTranslation(['approvals', 'common']);
  const auth = useAuth();
  const kindName = useKindName();
  const stepUp = useStepUp();
  const [open, setOpen] = useState<'approve' | 'reject' | 'withdraw' | null>(null);
  const [reason, setReason] = useState('');
  const approve = useApiMutation('approveRequest');
  const reject = useApiMutation('rejectRequest');
  const withdraw = useApiMutation('cancelApprovalRequest');
  const keyFor = useIntentKey();
  const approveLabels = useStateLabels({
    loading: t('decide.approving'),
    emptyTitle: t('decide.approveFailed'),
    errorTitle: t('decide.rejectFailed'),
    deniedTitle: t('decide.cannot'),
  });
  const rejectLabels = useStateLabels({
    loading: t('decide.rejecting'),
    emptyTitle: t('decide.rejectFailed'),
    errorTitle: t('decide.rejectFailed'),
    deniedTitle: t('decide.cannot'),
  });
  const withdrawLabels = useStateLabels({
    loading: t('decide.withdrawing'),
    emptyTitle: t('decide.withdrawFailed'),
    errorTitle: t('decide.withdrawFailed'),
    deniedTitle: t('decide.withdrawFailed'),
  });
  const mine = request.requestedBy.id === auth.session?.principal.id;
  const kind = kindName(request.kind);
  const amount =
    request.amountPesewas === null ? null : <MoneyDisplay pesewas={request.amountPesewas} strong />;

  let body: ReactNode;
  if (request.status !== 'PENDING') {
    body = <p className="text-fg-muted">{t('decide.closed')}</p>;
  } else if (mine) {
    body = (
      <>
        <Alert severity="info" title={t('decide.yours')}>
          <p>{t('decide.yoursBody')}</p>
        </Alert>
        {auth.can('iam.approval.cancel.own') ? (
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                withdraw.reset();
                setOpen('withdraw');
              }}
            >
              <Undo2 aria-hidden="true" />
              {t('decide.withdraw')}
            </Button>
          </div>
        ) : null}
      </>
    );
  } else if (!request.canDecide) {
    body = (
      <Alert severity="info" title={t('decide.cannot')}>
        <p>{t('decide.cannotBody')}</p>
      </Alert>
    );
  } else {
    body = (
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            approve.reset();
            setReason('');
            setOpen('approve');
          }}
        >
          <Check aria-hidden="true" />
          {t('decide.approve')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            reject.reset();
            setOpen('reject');
          }}
        >
          <X aria-hidden="true" />
          {t('decide.reject')}
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardBody className="grid gap-3">
        <h2 className="text-lg font-semibold">{t('decide.title')}</h2>
        {body}
      </CardBody>
      {open === 'approve' ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => setOpen(next ? 'approve' : null)}
          title={t('decide.approveTitle', { kind })}
          body={
            // 2.19.0: a margin approval only approves; the salesperson then issues the version.
            request.kind === 'QUOTE_BELOW_MARGIN'
              ? t('decide.approveMarginBody')
              : t('decide.approveBody')
          }
          confirmLabel={t('decide.approve')}
          pendingLabel={t('decide.approving')}
          pending={approve.isPending}
          error={shownFailure(approve.error)}
          failedTitle={approveLabels.emptyTitle}
          icon={Check}
          onConfirm={() => {
            const decision = reason.trim() === '' ? {} : { reason: reason.trim() };
            void stepUp
              .run(() =>
                approve.mutateAsync(
                  { path: { id: request.id }, body: decision },
                  { idempotencyKey: keyFor({ approve: request.id, ...decision }) },
                ),
              )
              .then((done) => {
                if (done === null) return;
                setOpen(null);
                onNotice(t('decide.approved'));
              })
              .catch(() => undefined);
          }}
        >
          <div className="grid gap-3">
            <p className="text-sm">
              {request.summary}
              {amount === null ? null : <> · {amount}</>}
            </p>
            <Field label={t('decide.reason')} hint={t('decide.reasonHint')}>
              <Textarea
                value={reason}
                maxLength={REASON_MAX_LENGTH}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          </div>
        </ConfirmDialog>
      ) : null}
      <ReasonDialog
        open={open === 'reject'}
        onOpenChange={(next) => setOpen(next ? 'reject' : null)}
        title={t('decide.rejectTitle', { kind })}
        body={t('decide.rejectBody')}
        warning={
          <p className="text-sm">
            {request.summary}
            {amount === null ? null : <> · {amount}</>}
          </p>
        }
        submitLabel={t('decide.reject')}
        error={shownFailure(reject.error)}
        failureLabels={rejectLabels}
        destructive
        onConfirm={async (why) => {
          const decision = { reason: why };
          const done = await stepUp.run(() =>
            reject.mutateAsync(
              { path: { id: request.id }, body: decision },
              { idempotencyKey: keyFor({ reject: request.id, ...decision }) },
            ),
          );
          if (done === null) return;
          setOpen(null);
          onNotice(t('decide.rejected'));
        }}
      />
      <ReasonDialog
        open={open === 'withdraw'}
        onOpenChange={(next) => setOpen(next ? 'withdraw' : null)}
        title={t('decide.withdrawTitle')}
        body={t('decide.withdrawBody')}
        submitLabel={t('decide.withdraw')}
        error={withdraw.error}
        failureLabels={withdrawLabels}
        onConfirm={async (why) => {
          const body = { reason: why };
          await withdraw.mutateAsync(
            { path: { id: request.id }, body },
            { idempotencyKey: keyFor({ withdraw: request.id, ...body }) },
          );
          setOpen(null);
          onNotice(t('decide.withdrawn'));
        }}
      />
      {stepUp.dialog}
    </Card>
  );
}
