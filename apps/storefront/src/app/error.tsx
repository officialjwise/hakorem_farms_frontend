'use client';

import { useEffect } from 'react';
import { Button, ErrorState } from '@hakorem/ui';

/**
 * The route error boundary. It is a client component (Next requires that), so its words come from the
 * server as a small constant here rather than the translation layer: an error page cannot depend on the
 * very machinery that may have failed. English only until a second language ships (ADR 0015).
 */
const WORDS = {
  title: 'Something went wrong',
  body: 'This page stopped working. Try again.',
  retry: 'Try again',
  reference: 'Reference',
  copy: 'Copy the full reference',
  copied: 'Copied',
  copyFailed: 'Could not copy. Select it to copy by hand.',
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[storefront] route error', error);
  }, [error]);
  const action = <Button onClick={reset}>{WORDS.retry}</Button>;
  return error.digest ? (
    <ErrorState
      title={WORDS.title}
      description={WORDS.body}
      reference={error.digest}
      referenceLabel={WORDS.reference}
      referenceCopy={{ copy: WORDS.copy, copied: WORDS.copied, failed: WORDS.copyFailed }}
      action={action}
    />
  ) : (
    <ErrorState title={WORDS.title} description={WORDS.body} action={action} />
  );
}
