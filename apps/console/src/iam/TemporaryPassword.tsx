import { KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardBody, CardHeader, CardTitle } from '@hakorem/ui';

/**
 * A temporary password, shown once (FR-IAM-001). It is never stored in the cache or the URL: the screen holds
 * it in component state from the write's answer, and it is gone when the person leaves the page.
 */
export function TemporaryPassword({ name, password }: { name: string; password: string }) {
  const { t } = useTranslation('iam');
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2 className="flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-icon-md" />
            {t('user.temporary.title')}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-2">
        <p>{t('user.temporary.body', { name })}</p>
        <p>
          <span className="sr-only">{t('user.temporary.label', { name })}: </span>
          <code className="rounded-sm border border-border-strong bg-surface-sunken px-2 py-1 font-mono text-lg tracking-wide break-all">
            {password}
          </code>
        </p>
      </CardBody>
    </Card>
  );
}
