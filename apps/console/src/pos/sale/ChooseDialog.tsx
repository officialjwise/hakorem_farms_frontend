import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { Button, Dialog, WeightDisplay } from '@hakorem/ui';

type OfflineProduct = components['schemas']['OfflineProduct'];
type OfflineStockUnit = components['schemas']['OfflineStockUnit'];

export type Choice = { kind: 'unit'; product: OfflineProduct; units: OfflineStockUnit[] };

/** Which animal or lot of a product is being sold: a goat by its tag, never "a goat". */
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
  const title = t('choose.unitTitle', { name: choice.product.product.name });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={t('choose.unitBody')}
      closeLabel={t('close')}
      icon={ListChecks}
    >
      <ul className="grid gap-2">
        {choice.units.map((unit) => (
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
