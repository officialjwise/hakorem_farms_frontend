import { useTranslation } from 'react-i18next';
import { CopyId, formatReference, type CopyLabels } from '@hakorem/ui';

/**
 * The words of a request reference's copy button (ADR 0051), for ErrorState, FormError and QueryBoundary.
 */
export function useReferenceCopy(): CopyLabels {
  const { t } = useTranslation('common');
  return {
    copy: t('states.referenceCopy'),
    copied: t('copyId.copied'),
    failed: t('copyId.failed'),
  };
}

/**
 * A request reference (an error's `correlationId`) inside a sentence: its last eight characters in two
 * groups, with a button that copies all of it for support (owner, 2026-11-17; ADR 0051). Never the whole
 * UUID on screen. Renders nothing for a blank reference, which is a failure that had no answer.
 */
export function RequestReference({ value }: { value: string }) {
  const copy = useReferenceCopy();
  if (value.trim() === '') return null;
  return (
    <CopyId
      value={value}
      shown={formatReference(value)}
      copyLabel={copy.copy}
      copiedLabel={copy.copied}
      failedLabel={copy.failed}
    />
  );
}
