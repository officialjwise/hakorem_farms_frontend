import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  MoneyDisplay,
  QuantityDisplay,
  QueryBoundary,
  Skeleton,
  StatusBadge,
  Textarea,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { ReadableId } from '../lib/ReadableId';
import { useStateLabels } from '../lib/states';
import { useUnits } from './units';

type S = components['schemas'];
type Claim = S['SupplierClaim'];

/**
 * The claim for goods turned away at the door (CR-036, contract 2.4.0): from a posted purchase receipt
 * against an order, raised in one step. The value is the server's, from the order's price; the screen
 * sends only a note and shows what came back. One claim per receipt, open until the supplier's invoice
 * or credit note settles it.
 */
export function ReceiptClaims({
  receipt,
  reasonName,
}: {
  receipt: S['GoodsReceipt'];
  reasonName: (code: string) => string;
}) {
  const { t } = useTranslation(['stock', 'common']);
  const auth = useAuth();
  const canRead = auth.can('pur.supplier_invoice.read');
  const canRaise = auth.can('pur.supplier_invoice.create');
  const claimable =
    receipt.kind === 'PURCHASE' && receipt.status === 'POSTED' && receipt.purchaseOrder !== null;
  const claims = useApiQuery(
    'listGoodsReceiptClaims',
    { path: { id: receipt.id } },
    { enabled: claimable && canRead },
  );
  // The answer to the raise, kept on screen above the claim the receipt then reads back.
  const [raised, setRaised] = useState<Claim | null>(null);
  const labels = useStateLabels({
    loading: t('claims.loading'),
    emptyTitle: t('claims.none'),
    errorTitle: t('claims.error'),
    deniedTitle: t('claims.denied'),
  });
  if (receipt.status === 'DRAFT') {
    return <p className="text-fg-muted">{t('claims.afterPosting')}</p>;
  }
  if (!claimable) return <p className="text-fg-muted">{t('claims.notClaimable')}</p>;
  if (!canRead) return <p className="text-fg-muted">{t('claims.whoRaises')}</p>;
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('claims.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-3">
        {raised === null ? null : (
          <Alert severity="good" title={t('claims.raised', { supplier: raised.supplier.name })}>
            {t('claims.claimed')} <MoneyDisplay pesewas={raised.claimedPesewas} strong />
          </Alert>
        )}
        <QueryBoundary
          query={claims}
          labels={labels}
          isEmpty={() => false}
          loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-24" />}
        >
          {(page) => {
            const claim = page.data[0];
            if (claim !== undefined) return <ClaimView claim={claim} reasonName={reasonName} />;
            return canRaise ? (
              <RaiseClaim receipt={receipt} reasonName={reasonName} onRaised={setRaised} />
            ) : (
              <p>{t('claims.noneYet')}</p>
            );
          }}
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}

function ClaimView({ claim, reasonName }: { claim: Claim; reasonName: (code: string) => string }) {
  const { t } = useTranslation('stock');
  const units = useUnits();
  return (
    <div className="grid gap-3">
      <p className="flex flex-wrap items-center gap-2">
        <StatusBadge
          tone={claim.status === 'OPEN' ? 'warning' : 'good'}
          label={t(`claims.status.${claim.status}`)}
        />
        <span>
          {t('claims.claimed')} <MoneyDisplay pesewas={claim.claimedPesewas} strong />
        </span>
      </p>
      <p className="text-fg-muted">
        {claim.status === 'OPEN'
          ? t('claims.openBody', { supplier: claim.supplier.name })
          : t('claims.settledBody', {
              by: claim.settledBy?.supplierInvoiceNo ?? '',
            })}{' '}
        <ReadableId value={claim.supplier.publicId} />
      </p>
      <ul className="grid list-disc gap-1 ps-5">
        {claim.lines.map((line) => (
          <li key={line.id}>
            {line.product.name}, {reasonName(line.rejectionReasonCode)}:{' '}
            <QuantityDisplay
              quantity={line.qtyRejectedBase}
              unit={units.name(line.baseUom)}
              places={units.places(line.baseUom)}
            />
            , <MoneyDisplay pesewas={line.claimedValuePesewas} />
          </li>
        ))}
      </ul>
      {claim.note === null ? null : <p>{t('claims.noteShown', { note: claim.note })}</p>}
      {/* F10g: the claim's own page, where it is settled by an invoice or turned into a credit note. */}
      <Link to={`/supplier-claims/${claim.id}`} className="text-accent-text underline">
        {t('claims.open')}
      </Link>
    </div>
  );
}

function RaiseClaim({
  receipt,
  reasonName,
  onRaised,
}: {
  receipt: S['GoodsReceipt'];
  reasonName: (code: string) => string;
  onRaised: (claim: Claim) => void;
}) {
  const { t } = useTranslation(['stock', 'common']);
  const units = useUnits();
  const keyFor = useIntentKey();
  const raise = useApiMutation('raiseSupplierClaim');
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const rejected = receipt.lines.filter((l) => l.rejectionReasonCode !== null);
  return (
    <div className="grid gap-3">
      <p>{t('claims.intro')}</p>
      <div>
        <Button onClick={() => setOpen(true)}>{t('claims.raise')}</Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('claims.raiseTitle', { supplier: receipt.supplier?.name ?? '' })}
        body={t('claims.raiseBody')}
        confirmLabel={t('claims.raise')}
        pendingLabel={t('claims.raising')}
        pending={raise.isPending}
        error={shownFailure(raise.error)}
        failedTitle={t('claims.notRaised')}
        onConfirm={() => {
          const input = {
            path: { id: receipt.id },
            body: note.trim() === '' ? {} : { note: note.trim() },
          };
          raise
            .mutateAsync(input, { idempotencyKey: keyFor(input) })
            .then((claim) => {
              setOpen(false);
              onRaised(claim);
            })
            .catch(() => undefined);
        }}
      >
        <ul className="grid list-disc gap-1 ps-5">
          {rejected.map((line) => (
            <li key={line.id}>
              {line.product.name}, {reasonName(line.rejectionReasonCode ?? '')}:{' '}
              <QuantityDisplay
                quantity={line.qtyRejected}
                unit={units.name(line.uom)}
                places={units.places(line.uom)}
              />
            </li>
          ))}
        </ul>
        <Field label={t('claims.note')} hint={t('claims.noteHint')}>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={500}
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
