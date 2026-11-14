import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardBody, CardHeader, CardTitle } from '@hakorem/ui';

/** The frame every auth screen sits in: one centred card, readable at 360 px. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('shell');
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-4">
      <div className="grid w-full max-w-sm gap-4">
        <p className="text-center text-lg font-semibold">{t('app.name')}</p>
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h1 className="text-xl">{title}</h1>
            </CardTitle>
            {subtitle ? <p className="text-sm text-fg-muted">{subtitle}</p> : null}
          </CardHeader>
          <CardBody className="grid gap-4">{children}</CardBody>
        </Card>
      </div>
    </main>
  );
}
