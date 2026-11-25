import { FileMinus, FilePlus, FileSearch } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router';
import {
  Alert,
  Button,
  Card,
  CardBody,
  EmptyState,
  formatDateTime,
  MoneyDisplay,
  MutationFailure,
  QuantityDisplay,
  QueryBoundary,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  WeightDisplay,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { documentHref } from '../lib/documents';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { useUnits } from '../stock/units';
import {
  DocumentStatusBadge,
  isCorrectable,
  PaymentBadge,
  useCustomerWords,
  useDocumentName,
  type BillingDocument,
} from './presentation';
import { ReceiptLinkRevoke } from './ReceiptLink';
import { ReprintButton, ReprintCopy, type ReprintResult } from './Reprint';
import { ReadableId } from '../lib/ReadableId';

/** What the credit and debit note screens tell this page when they bring the person back to it. */
export interface DocumentNotice {
  notice: 'debitIssued' | 'creditIssued';
}

function isNotice(state: unknown): state is DocumentNotice {
  return typeof state === 'object' && state !== null && 'notice' in state;
}

/**
 * FR-BIL document viewer: one billing document exactly as the API issued it. Its lines, its tax breakdown
 * (each levy's total and each line's levy rows, including those at zero), its totals and billing's payment
 * summary are the API's figures, shown and never summed. An issued document never changes; it is corrected by
 * a credit or debit note, raised from here. A reprint comes from the archive with the API's marker and copy
 * number, and the page leads with it, so a reprint can never pass for the original (the F8 gate).
 */
export function BillingDocumentScreen() {
  const { t } = useTranslation(['billing', 'common']);
  const { id = '' } = useParams();
  const document = useApiQuery('getBillingDocument', { path: { id } });
  const labels = useStateLabels({
    loading: t('doc.loading'),
    emptyTitle: t('doc.notFound'),
    errorTitle: t('doc.error'),
    deniedTitle: t('doc.denied'),
  });
  if (document.error?.status === 404) {
    return (
      <EmptyState
        title={t('doc.notFound')}
        description={t('common:states.notFoundBody')}
        action={<BackLink />}
      />
    );
  }
  return (
    <QueryBoundary
      query={document}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => <DocumentView key={current.id} document={current} />}
    </QueryBoundary>
  );
}

export function BackLink() {
  const { t } = useTranslation('billing');
  return (
    <Link to="/billing-documents" className="text-accent-text underline">
      {t('doc.back')}
    </Link>
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

const FACTS = 'grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]';

/** The document on screen. Exported for the screen's tests. */
export function DocumentView({ document }: { document: BillingDocument }) {
  const { t } = useTranslation(['billing', 'common']);
  const location = useLocation();
  const documentName = useDocumentName();
  const customerWords = useCustomerWords();
  const name = documentName(document);
  const [reprint, setReprint] = useState<ReprintResult | null>(null);
  const notice = isNotice(location.state) ? location.state.notice : null;
  const original =
    document.originalDocument === null ? undefined : documentHref(document.originalDocument);
  return (
    <article aria-labelledby="document-title" className="grid gap-4">
      <div className="grid gap-2">
        <BackLink />
        <div className="flex flex-wrap items-center gap-3">
          <PageHeader title={name} titleId="document-title" />
          <DocumentStatusBadge document={document} />
          <PaymentBadge status={document.settlement.paymentStatus} />
        </div>
        <p className="text-fg-muted">{customerWords(document)}</p>
      </div>
      {notice === null ? null : <Alert severity="good" title={t(noticeKey(notice))} />}
      {reprint === null ? null : (
        <ReprintCopy
          result={reprint}
          name={name}
          documentNo={document.documentNo ?? document.provisionalRef ?? t('doc.facts.unnumbered')}
        />
      )}
      <Actions document={document} name={name} onReprinted={setReprint} />
      <ReceiptLinkRevoke document={document} />

      <Card>
        <CardBody className="grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="facts-title" className="grid content-start gap-2">
            <h2 id="facts-title" className="text-lg font-semibold">
              {t('doc.facts.title')}
            </h2>
            <dl className={FACTS}>
              <Fact term={t('doc.facts.number')}>{document.documentNo ?? t('draftCredit')}</Fact>
              {document.provisionalRef === null ? null : (
                <Fact term={t('doc.facts.provisional')}>{document.provisionalRef}</Fact>
              )}
              <Fact term={t('doc.facts.customer')}>
                {document.customer === null ? (
                  customerWords(document)
                ) : (
                  <>
                    {customerWords(document)} <ReadableId value={document.customer.publicId} />
                  </>
                )}
              </Fact>
              {document.customerTin === null ? null : (
                <Fact term={t('doc.facts.tin')}>{document.customerTin}</Fact>
              )}
              {document.billingAddress === null ? null : (
                <Fact term={t('doc.facts.address')}>{document.billingAddress}</Fact>
              )}
              <Fact term={t('doc.facts.issueDate')}>
                {document.issueDate ?? t('doc.facts.notIssued')}
              </Fact>
              <Fact term={t('doc.facts.dueDate')}>
                {document.dueDate ?? t('doc.facts.noDueDate')}
              </Fact>
              {document.order === null ? null : (
                <Fact term={t('doc.facts.order')}>
                  {document.order.number ?? t('doc.facts.noNumber')}
                </Fact>
              )}
              {document.originalDocument === null ? null : (
                <Fact term={t('doc.facts.corrects')}>
                  {original === undefined ? (
                    (document.originalDocument.number ?? t('doc.facts.noNumber'))
                  ) : (
                    <Link to={original} className="text-accent-text underline">
                      {document.originalDocument.number ?? t('doc.facts.noNumber')}
                    </Link>
                  )}
                </Fact>
              )}
              {document.reasonCode === null ? null : (
                <Fact term={t('doc.facts.reason')}>{document.reasonCode}</Fact>
              )}
              <Fact term={t('doc.facts.pricesAre')}>
                {document.taxInclusive ? t('doc.facts.taxInclusive') : t('doc.facts.taxExclusive')}
              </Fact>
              <Fact term={t('doc.facts.issuedAt')}>
                <When instant={document.issuedAt} empty={t('doc.facts.notIssued')} />
              </Fact>
              <Fact term={t('doc.facts.reprints')}>
                {t('doc.facts.reprintCount', { count: document.reprintCount })}
              </Fact>
            </dl>
          </section>
          <Settlement document={document} />
        </CardBody>
      </Card>

      <Lines document={document} />
      <TaxBreakdown document={document} />
      <Archive document={document} />
      {document.status === 'ISSUED' ? <Reprints document={document} /> : null}
      <p className="text-control-sm text-fg-muted">{t('doc.issuedNever')}</p>
    </article>
  );
}

function noticeKey(notice: DocumentNotice['notice']) {
  return notice === 'debitIssued' ? 'debit.issuedTitle' : 'credit.issuedTitle';
}

/**
 * What the person may do with the document, by its state and their permissions: reprint it from the
 * archive, credit it, or add a charge to it.
 */
function Actions({
  document,
  name,
  onReprinted,
}: {
  document: BillingDocument;
  name: string;
  onReprinted: (result: ReprintResult) => void;
}) {
  const { t } = useTranslation('billing');
  const auth = useAuth();
  if (document.status === 'DRAFT') {
    return (
      <Alert severity="warning" title={t('draftCredit')}>
        {t('doc.actions.draftHint')}
      </Alert>
    );
  }
  const canReprint = auth.can('bil.document.reprint');
  const archived = document.archivedDocumentId !== null;
  const correctable = isCorrectable(document);
  const canCredit = correctable && auth.can('bil.credit_note.create');
  const canDebit = correctable && auth.can('bil.debit_note.create');
  if (!canReprint && !canCredit && !canDebit) return null;
  return (
    <Card>
      <CardBody className="grid gap-3">
        <h2 className="text-lg font-semibold">{t('doc.actions.title')}</h2>
        <div className="flex flex-wrap gap-2">
          {canReprint && archived ? (
            <ReprintButton document={document} name={name} onDone={onReprinted} />
          ) : null}
          {canCredit ? (
            <Button asChild variant="secondary">
              <Link to={`/billing-documents/${document.id}/credit-note`}>
                <FileMinus aria-hidden="true" />
                {t('credit.action')}
              </Link>
            </Button>
          ) : null}
          {canDebit ? (
            <Button asChild variant="secondary">
              <Link to={`/billing-documents/${document.id}/debit-note`}>
                <FilePlus aria-hidden="true" />
                {t('debit.action')}
              </Link>
            </Button>
          ) : null}
        </div>
        {canReprint && !archived ? (
          <p className="text-control-sm text-fg-muted">{t('reprint.unavailable')}</p>
        ) : null}
        {canReprint && document.kind === 'RECEIPT' ? (
          <p className="text-control-sm text-fg-muted">{t('reprint.thermalOnTill')}</p>
        ) : null}
        {document.kind === 'PROFORMA' ? (
          <p className="text-control-sm text-fg-muted">{t('doc.actions.proformaHint')}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Billing's payment summary, a few seconds behind the payments ledger (`Settlement`). */
function Settlement({ document }: { document: BillingDocument }) {
  const { t } = useTranslation('billing');
  const settlement = document.settlement;
  return (
    <section aria-labelledby="settlement-title" className="grid content-start gap-2">
      <h2 id="settlement-title" className="text-lg font-semibold">
        {t('doc.settlement.title')}
      </h2>
      <dl className={FACTS}>
        <Fact term={t('doc.settlement.status')}>
          <PaymentBadge status={settlement.paymentStatus} />
        </Fact>
        <Fact term={t('doc.settlement.allocated')}>
          <MoneyDisplay pesewas={settlement.allocatedPesewas} />
        </Fact>
        <Fact term={t('doc.settlement.credited')}>
          <MoneyDisplay pesewas={settlement.creditedPesewas} />
        </Fact>
        <Fact term={t('doc.settlement.outstanding')}>
          <MoneyDisplay pesewas={settlement.outstandingPesewas} strong />
        </Fact>
        <Fact term={t('doc.settlement.settledAt')}>
          <When instant={settlement.settledAt} empty={t('doc.settlement.notSettled')} />
        </Fact>
      </dl>
      <p className="text-control-sm text-fg-muted">
        {t('doc.settlement.behind', { when: formatDateTime(settlement.asOf) })}
      </p>
    </section>
  );
}

function Lines({ document }: { document: BillingDocument }) {
  const { t } = useTranslation('billing');
  const units = useUnits();
  const c = (key: string) => t(`doc.lines.columns.${key}` as 'doc.lines.columns.net');
  return (
    <section aria-labelledby="lines-title" className="grid gap-3">
      <h2 id="lines-title" className="text-xl font-semibold">
        {t('doc.lines.title')}
      </h2>
      <TableContainer aria-label={t('doc.lines.table')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{c('line')}</TableHead>
              <TableHead numeric>{c('quantity')}</TableHead>
              <TableHead numeric>{c('unitPrice')}</TableHead>
              <TableHead numeric>{c('discount')}</TableHead>
              <TableHead numeric>{c('net')}</TableHead>
              <TableHead numeric>{c('tax')}</TableHead>
              <TableHead numeric>{c('gross')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {document.lines.map((line) => (
              <TableRow key={line.id}>
                <TableRowHeader>
                  <span className="grid">
                    <span>{line.description}</span>
                    <span className="text-control-sm font-normal text-fg-muted">
                      {t('doc.lines.lineNo', { number: line.lineNo })} ·{' '}
                      {t(`doc.lines.kind.${line.lineKind}`, { defaultValue: line.lineKind })}
                      {line.stockUnit === null ? null : (
                        <>
                          {' · '}
                          <span className="font-mono">{line.stockUnit.identifier}</span>
                        </>
                      )}
                    </span>
                    {line.weightKg === null ? null : (
                      <span className="text-control-sm font-normal text-fg-muted">
                        {t('doc.lines.weighed')} <WeightDisplay kilograms={line.weightKg} />
                      </span>
                    )}
                  </span>
                </TableRowHeader>
                <TableCell numeric label={c('quantity')}>
                  <QuantityDisplay
                    quantity={line.quantity}
                    unit={units.after(line.uom, line.quantity)}
                    places={units.places(line.uom)}
                  />
                </TableCell>
                <TableCell numeric label={c('unitPrice')}>
                  <span className="grid">
                    <MoneyDisplay
                      pesewas={line.unitPricePesewas ?? line.resolvedUnitPricePesewas}
                    />
                    {line.unitPricePesewas !== null &&
                    line.unitPricePesewas !== line.resolvedUnitPricePesewas ? (
                      <span className="text-control-sm text-fg-muted">
                        {t('doc.lines.priceList')}{' '}
                        <MoneyDisplay pesewas={line.resolvedUnitPricePesewas} />
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell numeric label={c('discount')}>
                  <MoneyDisplay pesewas={line.discountPesewas} />
                </TableCell>
                <TableCell numeric label={c('net')}>
                  <MoneyDisplay pesewas={line.lineNetPesewas} />
                </TableCell>
                <TableCell numeric label={c('tax')}>
                  <MoneyDisplay pesewas={line.lineTaxPesewas} />
                </TableCell>
                <TableCell numeric label={c('gross')}>
                  <MoneyDisplay pesewas={line.lineGrossPesewas} strong />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </section>
  );
}

/**
 * The tax breakdown the brief asks for on every document (FR-BIL-004): each levy's total as issued, then the
 * document's net, tax and gross, then each line's levy rows with their treatment, rate and base. All the
 * API's. A document whose totals are `taxPesewas` 7,650 shows 7,650: this screen never adds the levies up.
 */
function TaxBreakdown({ document }: { document: BillingDocument }) {
  const { t } = useTranslation('billing');
  const c = (key: string) => t(`doc.tax.columns.${key}` as 'doc.tax.columns.levy');
  const levyRows = document.lines.flatMap((line) => line.levies.map((levy) => ({ line, levy })));
  return (
    <section aria-labelledby="tax-title" className="grid gap-3">
      <h2 id="tax-title" className="text-xl font-semibold">
        {t('doc.tax.title')}
      </h2>
      <p className="text-fg-muted">{t('doc.tax.intro')}</p>
      <Card>
        <CardBody>
          <dl className={FACTS} aria-label={t('doc.tax.table')}>
            {document.levyTotals.length === 0 ? (
              <Fact term={t('doc.tax.levy')}>{t('doc.tax.none')}</Fact>
            ) : (
              document.levyTotals.map((levy) => (
                <Fact key={levy.levyCode} term={`${levy.levyName} (${levy.levyCode})`}>
                  <MoneyDisplay pesewas={levy.amountPesewas} />
                </Fact>
              ))
            )}
            <Fact term={t('doc.tax.net')}>
              <MoneyDisplay pesewas={document.netPesewas} />
            </Fact>
            <Fact term={t('doc.tax.taxTotal')}>
              <MoneyDisplay pesewas={document.taxPesewas} />
            </Fact>
            <Fact term={t('doc.tax.gross')}>
              <MoneyDisplay pesewas={document.grossPesewas} strong />
            </Fact>
          </dl>
        </CardBody>
      </Card>
      {levyRows.length === 0 ? null : (
        <>
          <h3 className="text-lg font-semibold">{t('doc.tax.byLine')}</h3>
          <TableContainer aria-label={t('doc.tax.byLineTable')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{c('line')}</TableHead>
                  <TableHead>{c('levy')}</TableHead>
                  <TableHead>{c('treatment')}</TableHead>
                  <TableHead numeric>{c('rate')}</TableHead>
                  <TableHead numeric>{c('base')}</TableHead>
                  <TableHead numeric>{c('amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levyRows.map(({ line, levy }) => (
                  <TableRow key={`${line.id}-${levy.levyCode}`}>
                    <TableRowHeader>
                      {t('doc.lines.lineNo', { number: line.lineNo })}, {line.description}
                    </TableRowHeader>
                    <TableCell label={c('levy')}>{levy.levyName}</TableCell>
                    <TableCell label={c('treatment')}>
                      {t(`doc.tax.treatment.${levy.treatment}`, { defaultValue: levy.treatment })}
                    </TableCell>
                    <TableCell numeric label={c('rate')}>
                      {t('doc.tax.rate', { rate: levy.ratePercent })}
                    </TableCell>
                    <TableCell numeric label={c('base')}>
                      <MoneyDisplay pesewas={levy.basePesewas} />
                    </TableCell>
                    <TableCell numeric label={c('amount')}>
                      <MoneyDisplay pesewas={levy.amountPesewas} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </section>
  );
}

/**
 * The archived rendering (FR-DOC-001, FR-DOC-003): while it is drawn up after issue, it says so; once
 * archived, its fingerprint, and for those who may open the archive, the template version, revision and a
 * signed link to the original (`downloadArchivedDocument`, five minutes, logged). Viewing the original is
 * not a copy for a customer: that is a reprint.
 */
function Archive({ document }: { document: BillingDocument }) {
  const { t } = useTranslation('billing');
  const auth = useAuth();
  return (
    <section aria-labelledby="archive-title" className="grid gap-3">
      <h2 id="archive-title" className="text-xl font-semibold">
        {t('doc.archive.title')}
      </h2>
      {document.status === 'DRAFT' ? (
        <p className="text-fg-muted">{t('doc.archive.draft')}</p>
      ) : document.archivedDocumentId === null ? (
        <p className="text-fg-muted">{t('doc.archive.rendering')}</p>
      ) : (
        <Card>
          <CardBody className="grid gap-3">
            <dl className={FACTS}>
              <Fact term={t('doc.archive.hash')}>
                <span className="font-mono text-control-sm break-all">
                  {document.contentHash ?? t('doc.archive.rendering')}
                </span>
              </Fact>
            </dl>
            <p className="text-control-sm text-fg-muted">{t('doc.archive.hashHint')}</p>
            {auth.can('doc.document.read') ? (
              <ArchivedRecord id={document.archivedDocumentId} />
            ) : (
              <p className="text-control-sm text-fg-muted">{t('doc.archive.noAccess')}</p>
            )}
          </CardBody>
        </Card>
      )}
    </section>
  );
}

function ArchivedRecord({ id }: { id: string }) {
  const { t } = useTranslation('billing');
  const record = useApiQuery('getArchivedDocument', { path: { id } }, { staleClass: 'reference' });
  const open = useApiMutation('downloadArchivedDocument');
  const labels = useStateLabels({
    loading: t('doc.archive.loading'),
    emptyTitle: t('doc.archive.error'),
    errorTitle: t('doc.archive.error'),
    deniedTitle: t('doc.archive.noAccess'),
  });
  const failure = useStateLabels({
    loading: t('doc.archive.opening'),
    emptyTitle: t('doc.archive.openFailed'),
    errorTitle: t('doc.archive.openFailed'),
    deniedTitle: t('doc.archive.openFailed'),
  });
  return (
    <QueryBoundary
      query={record}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="line" />}
    >
      {(archived) => (
        <div className="grid gap-3">
          <dl className={FACTS}>
            <Fact term={t('doc.archive.revision')}>{archived.revision}</Fact>
            <Fact term={t('doc.archive.archivedAt')}>
              <When instant={archived.createdAt} />
            </Fact>
          </dl>
          <div>
            <Button
              variant="secondary"
              disabled={open.isPending}
              onClick={() => {
                open.mutate({ path: { id }, body: { reprint: false } });
              }}
            >
              <FileSearch aria-hidden="true" />
              {open.isPending ? t('doc.archive.opening') : t('doc.archive.open')}
            </Button>
          </div>
          {open.error === null ? null : <MutationFailure error={open.error} labels={failure} />}
          {open.data === undefined ? null : (
            <p>
              <a
                href={open.data.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-accent-text underline"
              >
                {t('doc.archive.link')}
              </a>{' '}
              <span className="text-control-sm text-fg-muted">
                {t('doc.archive.linkExpires', {
                  when: formatDateTime(open.data.expiresAt),
                })}
              </span>
            </p>
          )}
          <p className="text-control-sm text-fg-muted">{t('doc.archive.viewNotCopy')}</p>
        </div>
      )}
    </QueryBoundary>
  );
}

/** Every reprint of the document by copy number, with who and when (`listBillingDocumentReprints`). */
function Reprints({ document }: { document: BillingDocument }) {
  const { t } = useTranslation('billing');
  const reprints = useApiQuery('listBillingDocumentReprints', { path: { id: document.id } });
  const labels = useStateLabels({
    loading: t('doc.reprints.loading'),
    emptyTitle: t('doc.reprints.none'),
    errorTitle: t('doc.reprints.error'),
    deniedTitle: t('doc.reprints.error'),
  });
  const c = (key: string) => t(`doc.reprints.columns.${key}` as 'doc.reprints.columns.copy');
  return (
    <section aria-labelledby="reprints-title" className="grid gap-3">
      <h2 id="reprints-title" className="text-xl font-semibold">
        {t('doc.reprints.title')}
      </h2>
      <QueryBoundary
        query={reprints}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={<Skeleton label={labels.loading} shape="line" />}
      >
        {(page) => (
          <TableContainer aria-label={t('doc.reprints.table')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{c('copy')}</TableHead>
                  <TableHead>{c('channel')}</TableHead>
                  <TableHead>{c('who')}</TableHead>
                  <TableHead>{c('when')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.data.map((log) => (
                  <TableRow key={log.copyNo}>
                    <TableRowHeader>
                      {t('doc.reprints.copy', { number: log.copyNo })}
                    </TableRowHeader>
                    <TableCell label={c('channel')}>
                      {t(`doc.reprints.channel.${log.channel}`, { defaultValue: log.channel })}
                    </TableCell>
                    <TableCell label={c('who')}>{log.actor.displayName}</TableCell>
                    <TableCell label={c('when')}>
                      <When instant={log.recordedAt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </QueryBoundary>
    </section>
  );
}
