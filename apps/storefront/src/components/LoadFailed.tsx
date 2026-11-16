import Link from 'next/link';
import type { ApiError } from '@hakorem/api-client';
import { Button, ErrorState } from '@hakorem/ui';
import type { ShopT } from '../lib/present';

/**
 * A server read that failed: what failed, a way to try again (the same address, so it works with no
 * script), and the reference from the error envelope. A public page has no permission-denied state.
 */
export function LoadFailed({
  error,
  title,
  retryHref,
  t,
}: {
  error: ApiError;
  title: string;
  retryHref: string;
  t: ShopT;
}) {
  const action = (
    <Button asChild>
      <Link href={retryHref}>{t('listing.error.retry')}</Link>
    </Button>
  );
  const description = t('listing.error.body');
  return error.correlationId === '' ? (
    <ErrorState title={title} description={description} action={action} />
  ) : (
    <ErrorState
      title={title}
      description={description}
      reference={error.correlationId}
      referenceLabel={t('listing.error.reference')}
      action={action}
    />
  );
}
