import { useTranslation } from 'react-i18next';
import { CopyId } from '@hakorem/ui';

/**
 * A readable id a person reads, copies and searches by: a SKU, a public id (`cus_…`, `sup_…`), a document
 * number. In the monospace face, wrapping at 360 px, with a copy button (owner, 2026-11-17). Never a UUID.
 */
export function ReadableId({ value }: { value: string }) {
  const { t } = useTranslation('common');
  return (
    <CopyId
      value={value}
      copyLabel={t('copyId.label', { id: value })}
      copiedLabel={t('copyId.copied')}
      failedLabel={t('copyId.failed')}
    />
  );
}
