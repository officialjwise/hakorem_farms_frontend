import { Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@hakorem/ui';
import { useOnlineStatus } from '../lib/useOnlineStatus';

/**
 * The connection state in the POS header: icon and words, never colour alone. While offline a persistent
 * line below the header also says what that means for sales. The queue itself arrives in F9.
 */
export function OfflineIndicator() {
  const { t } = useTranslation('shell');
  const online = useOnlineStatus();
  return (
    <div role="status" data-slot="offline-indicator">
      {online ? (
        <StatusBadge tone="good" icon={Wifi} label={t('offline.online')} />
      ) : (
        <StatusBadge tone="warning" icon={WifiOff} label={t('offline.offline')} variant="strong" />
      )}
    </div>
  );
}

/** The persistent explanation under the header while offline. Renders nothing when online. */
export function OfflineBanner() {
  const { t } = useTranslation('shell');
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <p
      data-slot="offline-banner"
      className="border-b border-warning bg-warning-subtle px-4 py-2 text-sm text-warning-fg"
    >
      {t('offline.offlineBody')}
    </p>
  );
}
