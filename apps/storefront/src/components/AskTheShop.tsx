import { MessageCircle, Phone } from 'lucide-react';
import type { components } from '@hakorem/api-client';
import { Alert, Button } from '@hakorem/ui';
import type { Loaded } from '../lib/api';
import { phoneForDisplay, telHref, whatsAppHref } from '../lib/phone';
import type { ShopT } from '../lib/present';

type ShopProfile = components['schemas']['ShopProfile'];

/**
 * A live animal sold by request (FR-SHP, CR-028): how to ask for it. The shop's phone and, when the farm
 * has one, its WhatsApp number come from `getShopProfile`, as links a phone opens at once. A server
 * component: two plain links, no script. When the profile cannot be read (none set, or the read failed),
 * the page says to call or visit without a number, because none is invented.
 */
export function AskTheShop({ profile, t }: { profile: Loaded<ShopProfile>; t: ShopT }) {
  const shop = profile.ok ? profile.data : null;
  return (
    <div className="grid gap-3" data-slot="ask-the-shop">
      <Alert severity="info" title={t('product.request.title')}>
        {shop === null ? t('product.request.body') : t('product.request.bodyWithContact')}
      </Alert>
      {shop === null ? null : (
        <ul aria-label={t('product.request.contactLabel')} className="flex flex-wrap gap-3">
          <li>
            <Button asChild size="lg">
              <a href={telHref(shop.phone)}>
                <Phone aria-hidden="true" />
                {t('product.request.call', { phone: phoneForDisplay(shop.phone) })}
              </a>
            </Button>
          </li>
          {shop.whatsapp === null ? null : (
            <li>
              <Button asChild size="lg" variant="secondary">
                <a
                  href={whatsAppHref(shop.whatsapp)}
                  rel="noopener noreferrer"
                  target="_blank"
                  // The visible words first (WCAG 2.5.3), then that it leaves the shop for WhatsApp.
                  aria-label={t('product.request.whatsappLabel', {
                    phone: phoneForDisplay(shop.whatsapp),
                  })}
                >
                  <MessageCircle aria-hidden="true" />
                  {t('product.request.whatsapp', { phone: phoneForDisplay(shop.whatsapp) })}
                </a>
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
