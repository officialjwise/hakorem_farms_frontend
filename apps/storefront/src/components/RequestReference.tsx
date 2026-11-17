import { CopyId, formatReference, type CopyLabels } from '@hakorem/ui';
import { word, type Words } from '../lib/words';

/** The reference's copy button, in the `cart` slice's words (ADR 0051). */
export function referenceCopy(words: Words): CopyLabels {
  return {
    copy: word(words, 'cart.referenceCopy'),
    copied: word(words, 'cart.referenceCopied'),
    failed: word(words, 'cart.referenceCopyFailed'),
  };
}

/**
 * A request reference inside an alert: its last eight characters in two groups, with a button that copies
 * all of it for support (owner, 2026-11-17; ADR 0051). Never the whole UUID on screen.
 */
export function RequestReference({ value, words }: { value: string; words: Words }) {
  const copy = referenceCopy(words);
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
