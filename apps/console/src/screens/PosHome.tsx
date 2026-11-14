import { ScanBarcode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@hakorem/ui';

/** The POS start screen. Selling is F9: until then it is the empty state under the scan bar. */
export function PosHome() {
  const { t } = useTranslation('shell');
  return (
    <EmptyState icon={ScanBarcode} title={t('pos.empty.title')} description={t('pos.empty.body')} />
  );
}
