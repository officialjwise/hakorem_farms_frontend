import type { components } from '@hakorem/api-client';
import { Link2Off } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, CardBody, type FailureLike } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure, useStepUp } from '../auth/StepUp';
import { useApiMutation } from '../data/api';
import { When } from '../iam/presentation';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { RequestReference } from '../lib/RequestReference';
import { useStateLabels } from '../lib/states';

type BillingDocument = components['schemas']['BillingDocument'];
type Revocation = components['schemas']['ReceiptLinkRevocation'];

/**
 * Whether a receipt can hold the till's receipt link: a counter sale's receipt that came from the till's
 * offline sync names its order (2.24.0). The server answers 404 for a sale that holds none (an online counter
 * sale, a token refused, one never synced), with the same words as a sale it cannot find.
 */
export function mayHoldReceiptLink(
  document: Pick<BillingDocument, 'kind' | 'status' | 'order' | 'syncedFromOffline'>,
): boolean {
  return (
    document.kind === 'RECEIPT' &&
    document.status === 'ISSUED' &&
    document.order !== null &&
    document.syncedFromOffline === true
  );
}

/**
 * A supervisor revokes the receipt link a till made for a counter sale (2.26.0, `revokeReceiptLink`): sent to
 * the wrong number, shown to the wrong customer. With a reason and a fresh step-up; once revoked the link opens
 * nothing, and the shop answers it as it answers a guessed one. The token is never shown here. The answer and
 * any refusal stay on the page in words.
 */
export function ReceiptLinkRevoke({ document }: { document: BillingDocument }) {
  const { t } = useTranslation('billing');
  const auth = useAuth();
  const stepUp = useStepUp();
  const revoke = useApiMutation('revokeReceiptLink');
  const keyFor = useIntentKey();
  const [open, setOpen] = useState(false);
  const [revoked, setRevoked] = useState<Revocation | null>(null);
  const failureLabels = useStateLabels({
    loading: t('receiptLink.revoking'),
    emptyTitle: t('receiptLink.failed'),
    errorTitle: t('receiptLink.failed'),
    deniedTitle: t('receiptLink.denied'),
  });
  if (!mayHoldReceiptLink(document) || !auth.can('pos.shift.close.approve')) return null;
  const order = document.order;
  if (order === null) return null;
  const failure = shownFailure(revoke.error);

  return (
    <Card>
      <CardBody className="grid gap-3" data-slot="receipt-link-revoke">
        <h2 className="text-lg font-semibold">{t('receiptLink.title')}</h2>
        <p>{t('receiptLink.body')}</p>
        {revoked !== null ? (
          <Alert severity="good" title={t('receiptLink.revoked')}>
            <p>
              {t('receiptLink.revokedBody', {
                name: revoked.revokedBy.displayName,
                reason: revoked.reason,
              })}{' '}
              <When instant={revoked.revokedAt} empty="" />
            </p>
          </Alert>
        ) : (
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                revoke.reset();
                setOpen(true);
              }}
            >
              <Link2Off aria-hidden="true" />
              {t('receiptLink.action')}
            </Button>
          </div>
        )}
        {!open ? <Refused error={failure} /> : null}
        <ReasonDialog
          open={open}
          onOpenChange={setOpen}
          title={t('receiptLink.confirmTitle', { number: document.documentNo ?? '' })}
          body={t('receiptLink.confirmBody')}
          submitLabel={t('receiptLink.confirm')}
          fieldHint={t('receiptLink.reasonHint')}
          error={failure}
          failureLabels={failureLabels}
          destructive
          onConfirm={async (why) => {
            const body = { reason: why };
            const answer = await stepUp.run(() =>
              revoke.mutateAsync(
                { path: { id: order.id }, body },
                { idempotencyKey: keyFor({ revoke: order.id, ...body }) },
              ),
            );
            if (answer === null) return;
            setRevoked(answer);
            setOpen(false);
          }}
        />
        {stepUp.dialog}
      </CardBody>
    </Card>
  );
}

function Refused({ error }: { error: FailureLike | null }) {
  const { t } = useTranslation(['billing', 'common']);
  if (error === null) return null;
  const noLink = error.status === 404;
  return (
    <Alert severity="critical" title={t('receiptLink.failed')}>
      {noLink ? t('receiptLink.noLink') : error.message}
      {error.correlationId !== '' ? (
        <>
          {' '}
          {t('common:states.reference')} <RequestReference value={error.correlationId} />
        </>
      ) : null}
    </Alert>
  );
}
