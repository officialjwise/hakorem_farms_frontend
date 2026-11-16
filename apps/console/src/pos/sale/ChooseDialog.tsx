import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { Button, Dialog, WeightDisplay } from '@hakorem/ui';

type OfflineProduct = components['schemas']['OfflineProduct'];
type OfflineStockUnit = components['schemas']['OfflineStockUnit'];

export type Choice =
  | { kind: 'product'; code: string; products: OfflineProduct[] }
  | { kind: 'unit'; product: OfflineProduct; units: OfflineStockUnit[] };

/** Which product a shared barcode meant, or which animal or lot of a product is being sold. */
export function ChooseDialog({
  choice,
  onClose,
  onChoose,
}: {
  choice: Choice;
  onClose: () => void;
  onChoose: (product: OfflineProduct, unit: OfflineStockUnit | null) => void;
}) {
  const { t } = useTranslation('pos');
  const title =
    choice.kind === 'product'
      ? t('choose.productTitle', { code: choice.code })
      : t('choose.unitTitle', { name: choice.product.product.name });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={choice.kind === 'product' ? t('choose.productBody') : t('choose.unitBody')}
      closeLabel={t('close')}
      icon={ListChecks}
    >
      <ul className="grid gap-2">
        {choice.kind === 'product'
          ? choice.products.map((product) => (
              <li key={product.product.id}>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => onChoose(product, null)}
                >
                  {product.product.name}
                </Button>
              </li>
            ))
          : choice.units.map((unit) => (
              <li key={unit.id}>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => onChoose(choice.product, unit)}
                >
                  <span>{unit.identifier}</span>
                  <span className="text-fg-muted">
                    <WeightDisplay
                      kilograms={unit.lastWeightKg}
                      notApplicableLabel={t('line.noWeight')}
                    />
                  </span>
                </Button>
              </li>
            ))}
      </ul>
    </Dialog>
  );
}
