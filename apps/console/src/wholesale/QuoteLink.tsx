import { MessageCircle } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, CopyId } from '@hakorem/ui';
import { quoteLink, shopUrl, whatsAppLink } from '../lib/shopAddress';

/**
 * A quote's link, shown once (the owner, 2026-11-18). `issueQuoteVersion` answers the link's token only in
 * the answer that made it, and the server keeps only its hash, so this is the one time anyone sees it:
 * the salesperson copies it, or opens WhatsApp with the customer's number and a short message carrying it.
 * The words say so, and that a new link can be made from the quote; links already given keep working.
 */
export function QuoteLink({
  token,
  phone,
  contactName,
  quoteNo,
}: {
  token: string;
  phone: string;
  contactName: string;
  quoteNo: string;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const titleId = useId();
  const shop = shopUrl();
  if (shop === null) {
    // Only a build against the mock can lack the address: a build for a real API fails without it.
    return (
      <Alert severity="critical" title={t('link.noShop')}>
        {t('link.again')}
      </Alert>
    );
  }
  const link = quoteLink(shop, token);
  const message = t('link.message', { name: contactName, number: quoteNo, link });
  return (
    <Card asChild>
      <section aria-labelledby={titleId}>
        <CardHeader>
          <CardTitle asChild>
            <h2 id={titleId}>{t('link.title')}</h2>
          </CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3">
          <Alert severity="warning" title={t('link.once')}>
            {t('link.again')}
          </Alert>
          <CopyId
            value={link}
            copyLabel={t('link.copy')}
            copiedLabel={t('common:copyId.copied')}
            failedLabel={t('common:copyId.failed')}
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-auto min-h-control-md py-2 whitespace-normal">
              <a href={whatsAppLink(phone, message)} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                {t('link.whatsApp', { phone })}
              </a>
            </Button>
          </div>
          <p className="min-w-0 text-control-sm break-words text-fg-muted">
            {t('link.messageIs', { message })}
          </p>
        </CardBody>
      </section>
    </Card>
  );
}
