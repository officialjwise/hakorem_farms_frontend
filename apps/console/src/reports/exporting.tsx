import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MutationFailure, type ExportMenuItem } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';

/** What a report's Export menu offers beyond the page as CSV, and what came of the last export. */
export interface ReportExporting {
  items: ExportMenuItem[];
  status: ReactNode;
}

/**
 * The codes `listReportDefinitions` lists for the caller: which reports the API answers. A request's code
 * runs only once it is here; a statement offers its file only once its code is.
 */
export function useListedCodes() {
  // The reports a person may run change with a deploy or a grant, not by the minute: reference data.
  const listing = useApiQuery(
    'listReportDefinitions',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const codes = new Set((listing.data?.data ?? []).map((definition) => definition.code));
  return { listing, codes };
}

/**
 * Export as a spreadsheet or PDF: the API builds the file (rpt.report.export). The formats go in the table
 * card's Export menu; what came of the last export (the link, "being prepared", or the failure) stays on
 * the page in words.
 */
export function useReportExport(code: string, parameters: Record<string, string>): ReportExporting {
  const { t } = useTranslation(['reports', 'common']);
  const auth = useAuth();
  const run = useApiMutation('runReport');
  const keyFor = useIntentKey();
  const labels = useStateLabels({
    loading: t('exporting'),
    emptyTitle: t('notExported'),
    errorTitle: t('notExported'),
    deniedTitle: t('notExported'),
  });
  if (!auth.can('rpt.report.export')) return { items: [], status: null };
  const go = (format: 'XLSX' | 'PDF') => {
    const body = { parameters, format };
    void run
      .mutateAsync({ path: { code }, body }, { idempotencyKey: keyFor(body) })
      .catch(() => undefined);
  };
  const items: ExportMenuItem[] = [
    { id: 'xlsx', label: t('xlsx'), onSelect: () => go('XLSX'), disabled: run.isPending },
    { id: 'pdf', label: t('pdf'), onSelect: () => go('PDF'), disabled: run.isPending },
  ];
  const file = run.data && 'file' in run.data ? run.data.file : null;
  const status = run.isPending ? (
    <p role="status" className="text-sm text-fg-muted">
      {t('exporting')}
    </p>
  ) : run.isError ? (
    <MutationFailure error={run.error} labels={labels} />
  ) : run.isSuccess ? (
    file === null || file === undefined ? (
      <p role="status" className="text-sm text-fg-muted">
        {t('queued')}
      </p>
    ) : (
      <p role="status" className="text-sm">
        <a href={file.url} className="text-accent-text underline" target="_blank" rel="noreferrer">
          {t('download')}
        </a>
      </p>
    )
  ) : null;
  return { items, status };
}

/**
 * A statement's file, through `runReport` under its own code (CR-061), offered only once
 * `listReportDefinitions` lists that code. Until then its Export menu has the page as CSV alone. The exception report's file
 * (`DAILY_EXCEPTIONS`) is offered the same way.
 */
export function useStatementExport(
  code: string,
  parameters: Record<string, string>,
): ReportExporting {
  const { codes } = useListedCodes();
  const exporting = useReportExport(code, parameters);
  return codes.has(code) ? exporting : { items: [], status: null };
}
