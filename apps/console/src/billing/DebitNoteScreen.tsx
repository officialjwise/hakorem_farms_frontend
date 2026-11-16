import { FilePlus, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  MoneyDisplay,
  MoneyInput,
  QueryBoundary,
  Select,
  Skeleton,
  Textarea,
} from '@hakorem/ui';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey, uniqueById } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import type { DocumentNotice } from './BillingDocumentScreen';
import { isCorrectable, useDocumentName, type BillingDocument } from './presentation';

const NOTE_MAX = 500;
/** `DebitNoteLineInput.description`: no limit in the contract, so the form keeps to a line. */
const DESCRIPTION_MAX = 200;

interface Charge {
  key: number;
  description: string;
  amount: number | null;
  taxCategoryId: string;
}

/**
 * FR-BIL-007: a debit note adds a charge to an issued invoice or receipt. Each charge is an amount in the
 * original's terms with a tax category; the API taxes it by today's scheme, numbers it and posts it at once
 * (201). The confirmation lists each charge as entered and says the API adds the tax: nothing is computed
 * or totalled here.
 */
export function DebitNoteScreen() {
  const { t } = useTranslation(['billing', 'common']);
  const { id = '' } = useParams();
  const document = useApiQuery('getBillingDocument', { path: { id } });
  const labels = useStateLabels({
    loading: t('debit.loading'),
    emptyTitle: t('doc.notFound'),
    errorTitle: t('debit.error'),
    deniedTitle: t('debit.denied'),
  });
  if (document.error?.status === 404) {
    return <EmptyState title={t('doc.notFound')} description={t('common:states.notFoundBody')} />;
  }
  return (
    <QueryBoundary
      query={document}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => <DebitNoteForm key={current.id} document={current} />}
    </QueryBoundary>
  );
}

function DebitNoteForm({ document }: { document: BillingDocument }) {
  const { t } = useTranslation(['billing', 'common']);
  const navigate = useNavigate();
  const name = useDocumentName()(document);
  const reasons = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'BILLING_ADJUSTMENT', limit: 100 } },
    { staleClass: 'reference' },
  );
  const categories = useApiAllPages(
    'listTaxCategories',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const reasonList = (reasons.data?.items ?? []).filter(
    (r, i, all) =>
      r.domain === 'BILLING_ADJUSTMENT' && all.findIndex((o) => o.code === r.code) === i,
  );
  const categoryList = uniqueById(categories.data?.items ?? []);
  const nextKey = useRef(1);
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [charges, setCharges] = useState<Charge[]>([
    { key: 0, description: '', amount: null, taxCategoryId: '' },
  ]);
  const [checked, setChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const issue = useApiMutation('issueDebitNote', { invalidates: ['listBillingDocuments'] });
  const keyFor = useIntentKey();
  const backHref = `/billing-documents/${document.id}`;
  if (!isCorrectable(document)) {
    return (
      <EmptyState
        title={t('debit.notCorrectable')}
        action={
          <Link to={backHref} className="text-accent-text underline">
            {t('debit.cancel')}
          </Link>
        }
      />
    );
  }
  const reason = reasonList.find((r) => r.code === reasonCode);
  const noteMissing = reason?.requiresNote === true && note.trim() === '';
  const chargeWrong = (charge: Charge) =>
    charge.description.trim() === '' ||
    charge.amount === null ||
    charge.amount <= 0 ||
    charge.taxCategoryId === '';
  const change = (key: number, next: Partial<Charge>) =>
    setCharges((now) => now.map((c) => (c.key === key ? { ...c, ...next } : c)));
  const body = {
    reasonCode,
    ...(note.trim() === '' ? {} : { note: note.trim() }),
    lines: charges.map((charge) => ({
      description: charge.description.trim(),
      amountPesewas: charge.amount ?? 0,
      taxCategoryId: charge.taxCategoryId,
    })),
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (reasonCode === '' || noteMissing || charges.some(chargeWrong)) return;
    issue.reset();
    setConfirming(true);
  };
  const required = t('common:field.required');
  return (
    <article aria-labelledby="debit-title" className="grid gap-4">
      <Link to={backHref} className="text-accent-text underline">
        {t('debit.cancel')}
      </Link>
      <PageHeader title={t('debit.title', { name })} titleId="debit-title" />
      <p className="text-fg-muted">{t('debit.intro')}</p>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <Card>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('debit.reason')}
              required
              requiredLabel={required}
              error={checked && reasonCode === '' ? t('debit.reasonMissing') : undefined}
            >
              <Select
                value={reasonCode}
                onValueChange={setReasonCode}
                placeholder={t('debit.reason')}
                options={reasonList.map((r) => ({ value: r.code, label: r.description }))}
              />
            </Field>
            <Field
              label={t('debit.note')}
              error={checked && noteMissing ? t('debit.noteRequired') : undefined}
            >
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={NOTE_MAX}
                rows={2}
              />
            </Field>
          </CardBody>
        </Card>
        <section aria-labelledby="charges-title" className="grid gap-3">
          <h2 id="charges-title" className="text-xl font-semibold">
            {t('debit.chargesTitle')}
          </h2>
          {charges.map((charge, index) => {
            const number = index + 1;
            return (
              <Card key={charge.key}>
                <CardBody className="grid gap-3 sm:grid-cols-3">
                  <Field
                    label={t('debit.description', { number })}
                    required
                    requiredLabel={required}
                    error={
                      checked && charge.description.trim() === ''
                        ? t('debit.descriptionMissing')
                        : undefined
                    }
                  >
                    <Input
                      value={charge.description}
                      onChange={(event) => change(charge.key, { description: event.target.value })}
                      maxLength={DESCRIPTION_MAX}
                      autoComplete="off"
                    />
                  </Field>
                  <Field
                    label={t('debit.amount', { number })}
                    hint={
                      document.taxInclusive
                        ? t('debit.amountHintInclusive')
                        : t('debit.amountHintExclusive')
                    }
                    required
                    requiredLabel={required}
                    error={
                      checked && (charge.amount === null || charge.amount <= 0)
                        ? t('debit.amountInvalid')
                        : undefined
                    }
                  >
                    <MoneyInput
                      value={charge.amount}
                      onValueChange={(amount) => change(charge.key, { amount })}
                    />
                  </Field>
                  <Field
                    label={t('debit.taxCategory', { number })}
                    hint={categories.isPending ? t('debit.taxLoading') : undefined}
                    required
                    requiredLabel={required}
                    error={
                      checked && charge.taxCategoryId === ''
                        ? t('debit.taxCategoryMissing')
                        : undefined
                    }
                  >
                    <Select
                      value={charge.taxCategoryId}
                      onValueChange={(taxCategoryId) => change(charge.key, { taxCategoryId })}
                      placeholder={t('debit.taxCategory', { number })}
                      options={categoryList.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </Field>
                  {charges.length > 1 ? (
                    <div className="sm:col-span-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setCharges((now) => now.filter((other) => other.key !== charge.key))
                        }
                      >
                        <Trash2 aria-hidden="true" />
                        {t('debit.removeCharge', { number })}
                      </Button>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const key = nextKey.current;
                nextKey.current += 1;
                setCharges((now) => [
                  ...now,
                  { key, description: '', amount: null, taxCategoryId: '' },
                ]);
              }}
            >
              {t('debit.addCharge')}
            </Button>
          </div>
        </section>
        <div>
          <Button type="submit">
            <FilePlus aria-hidden="true" />
            {t('debit.review')}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('debit.confirmTitle')}
        body={t('debit.confirmBody')}
        consequence={t('debit.confirmTax')}
        confirmLabel={t('debit.send')}
        pendingLabel={t('debit.pending')}
        pending={issue.isPending}
        error={issue.error}
        failedTitle={t('debit.failed')}
        icon={FilePlus}
        onConfirm={() => {
          issue
            .mutateAsync(
              { path: { id: document.id }, body },
              { idempotencyKey: keyFor({ debit: document.id, ...body }) },
            )
            .then((answer) => {
              setConfirming(false);
              const notice: DocumentNotice = { notice: 'debitIssued' };
              void navigate(`/billing-documents/${answer.id}`, { state: notice });
            })
            .catch(() => undefined);
        }}
      >
        <div className="grid gap-2">
          <p className="font-semibold">{name}</p>
          <ul className="grid list-disc gap-1 ps-5">
            {charges.map((charge) => (
              <li key={charge.key}>
                {t('debit.confirmCharge', {
                  description: charge.description.trim(),
                  category:
                    categoryList.find((c) => c.id === charge.taxCategoryId)?.name ??
                    charge.taxCategoryId,
                })}{' '}
                <MoneyDisplay pesewas={charge.amount ?? 0} strong />
              </li>
            ))}
          </ul>
          <p>{t('credit.confirmReason', { reason: reason?.description ?? reasonCode })}</p>
        </div>
      </ConfirmDialog>
    </article>
  );
}
