import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { Button, Dialog, MoneyDisplay, WeightDisplay } from '@hakorem/ui';
import { unitName, usePackUnits } from '../presentation';
import { stockUnitBand, unpricedReason, type SellingUnit } from './catalogue';

type OfflineProduct = components['schemas']['OfflineProduct'];
type OfflineStockUnit = components['schemas']['OfflineStockUnit'];

export type Choice =
  | { kind: 'unit'; product: OfflineProduct; units: OfflineStockUnit[] }
  /** CR-038: which unit a product is sold in, a crate or a single egg, each at its own price. */
  | { kind: 'sellingUnit'; product: OfflineProduct; units: SellingUnit[] };

/** Which animal or lot of a product is being sold: a goat by its tag, never "a goat". */
export function ChooseDialog({
  choice,
  onClose,
  onChoose,
  onChooseSellingUnit,
}: {
  choice: Choice;
  onClose: () => void;
  onChoose: (product: OfflineProduct, unit: OfflineStockUnit | null) => void;
  onChooseSellingUnit?: (product: OfflineProduct, unit: SellingUnit) => void;
}) {
  const { t } = useTranslation('pos');
  const units = usePackUnits();
  if (choice.kind === 'sellingUnit') {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={t('choose.sellingUnitTitle', { name: choice.product.product.name })}
        description={t('choose.sellingUnitBody')}
        closeLabel={t('close')}
        icon={ListChecks}
      >
        <ul className="grid gap-2">
          {choice.units.map((unit) => (
            <li key={unit.uom}>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                disabled={unit.priceBand === null || unit.quoteOnly}
                onClick={() => onChooseSellingUnit?.(choice.product, unit)}
              >
                <span>{t('choose.sellingUnit', { unit: unitName(unit.uom, units, 'one') })}</span>
                <span className="text-fg-muted">
                  {unit.priceBand === null || unit.quoteOnly ? (
                    t('choose.sellingUnitNoPrice')
                  ) : (
                    <MoneyDisplay pesewas={unit.priceBand.listPricePesewas} />
                  )}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>
    );
  }
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
        {choice.units.map((unit) => {
          // 2.28.0 (CR-052): each animal at its own band, or the reason it has none here.
          const band = stockUnitBand(choice.product, unit);
          const reason = unpricedReason(choice.product, unit);
          return (
            <li key={unit.id}>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                className="h-auto min-h-control-lg flex-wrap whitespace-normal py-2"
                disabled={reason !== null}
                onClick={() => onChoose(choice.product, unit)}
              >
                <span>{unit.identifier}</span>
                <span className="text-fg-muted">
                  <WeightDisplay
                    kilograms={unit.lastWeightKg}
                    notApplicableLabel={t('line.noWeight')}
                  />
                </span>
                <span className="text-fg-muted" data-slot="unit-price">
                  {band !== null ? (
                    <MoneyDisplay pesewas={band.listPricePesewas} />
                  ) : (
                    t(`choose.unpriced.${reason ?? 'NO_PRICE'}`)
                  )}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
