import { Printer, Stamp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { Alert, Button } from '@hakorem/ui';
import { useApiMutation } from '../data/api';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { objectUrl, pdfBlob, releaseUrl } from './pdf';
import type { BillingDocument } from './presentation';

export type ReprintResult = components['schemas']['ReprintResult'];

/**
 * Reprints an issued document from its archive as a PDF (FR-BIL-009, `reprintBillingDocument`): the archived
 * bytes, unchanged, with the API's reprint marker and copy number on the first page. Never a new document.
 * The till-printer copy of a receipt (`THERMAL`) is printed at the till, which drives the printer (F9).
 */
export function ReprintButton({
  document,
  name,
  onDone,
}: {
  document: BillingDocument;
  name: string;
  onDone: (result: ReprintResult) => void;
}) {
  const { t } = useTranslation('billing');
  const [open, setOpen] = useState(false);
  const reprint = useApiMutation('reprintBillingDocument', {
    invalidates: ['listBillingDocumentReprints', 'listBillingDocuments'],
  });
  const keyFor = useIntentKey();
  // One intent per opening of the dialog: "Try again" repeats the same copy, a new opening asks for a new one.
  const [opening, setOpening] = useState(0);
  return (
    <>
      <Button
        onClick={() => {
          reprint.reset();
          setOpening((n) => n + 1);
          setOpen(true);
        }}
      >
        <Printer aria-hidden="true" />
        {t('reprint.action')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('reprint.title')}
        body={t('reprint.body')}
        consequence={t('reprint.logged')}
        confirmLabel={t('reprint.action')}
        pendingLabel={t('reprint.pending')}
        pending={reprint.isPending}
        error={reprint.error}
        failedTitle={t('reprint.failed')}
        icon={Printer}
        confirmIcon={Printer}
        onConfirm={() => {
          const body = { channel: 'PDF' as const };
          reprint
            .mutateAsync(
              { path: { id: document.id }, body },
              { idempotencyKey: keyFor({ reprint: document.id, opening, ...body }) },
            )
            .then((result) => {
              setOpen(false);
              onDone(result);
            })
            .catch(() => undefined);
        }}
      >
        <p className="font-semibold">{name}</p>
      </ConfirmDialog>
    </>
  );
}

/**
 * The copy the API returned, marked on screen as what it is: "Reprint 2: a copy, not a new document", in a
 * named region that leads the page, with the PDF itself (which carries the API's own marker) and a file to
 * save whose name says it is a reprint. The marker's number is the API's `copyNo`, never counted here.
 */
export function ReprintCopy({
  result,
  name,
  documentNo,
}: {
  result: ReprintResult;
  name: string;
  documentNo: string;
}) {
  const { t } = useTranslation('billing');
  const blob = useMemo(
    () => (result.pdfBase64 === null ? null : pdfBlob(result.pdfBase64)),
    [result.pdfBase64],
  );
  const url = useMemo(() => (blob === null ? null : objectUrl(blob)), [blob]);
  // A newer copy replaces the older one's URL. The last one lives as long as the page, which keeps it
  // working through a development remount.
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== null && last.current !== url) releaseUrl(last.current);
    last.current = url;
  }, [url]);
  const copy = result.copyNo;
  const titleId = `reprint-${copy}-title`;
  if (result.pdfBase64 === null) {
    return (
      <Alert severity="critical" title={t('reprint.failed')}>
        {t('reprint.noPdf')}
      </Alert>
    );
  }
  return (
    <section
      aria-labelledby={titleId}
      data-slot="reprint-copy"
      className="grid gap-3 rounded-lg border-4 border-warning bg-warning-subtle p-4 text-warning-fg"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Stamp aria-hidden="true" className="size-icon-lg stroke-warning" />
        <h2 id={titleId} className="text-xl font-bold">
          {t('reprint.markerTitle', { number: copy })}
        </h2>
      </div>
      <p>{t('reprint.markerBody', { number: copy, name })}</p>
      {url === null ? null : (
        <>
          <iframe
            src={url}
            title={t('reprint.preview', { number: copy, name })}
            className="h-[28rem] w-full rounded-md border border-border-strong bg-surface"
          />
          <p>
            <a
              href={url}
              download={t('reprint.fileName', { number: documentNo, copy })}
              className="font-semibold underline"
            >
              {t('reprint.save', { number: copy })}
            </a>
          </p>
        </>
      )}
    </section>
  );
}
