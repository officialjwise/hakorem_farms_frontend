import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  Field,
  Input,
  MoneyDisplay,
  MoneyInput,
  formatMoney,
  Select,
  WeightInput,
} from '@hakorem/ui';
import {
  approvalStands,
  cartDiscount,
  checkAgreedPrice,
  lineAmount,
  lineDiscount,
  toThreePlaces,
  type CartLine,
  type PriceRefusal,
  type WeightSource,
} from '../offline/cart';
import { useTill } from '../offline/till';
import type { OfflinePack } from '../offline/types';
import { PinApprovalField } from '../pin/PinCheck';
import { priceApprovers } from '../pin/pin';
import { unitName, usePackUnits } from '../presentation';

/** What stops a line being paid for, before the price rules: a weighed line with no weight. */
export function lineProblem(line: CartLine): 'NO_WEIGHT' | null {
  return line.priceBasis === 'PER_KG' && line.weightKg === null ? 'NO_WEIGHT' : null;
}

const SOURCES: WeightSource[] = ['MANUAL', 'SCALE', 'ESTIMATE'];

/**
 * One line's quantity, weight and agreed price. The agreed price is checked as the server will check it
 * (OFFLINE_SYNC 9.6): inside the band, a reason for any price but the list price, and a discount within the
 * cashier's cached limits, per line and for the shift (counting the other lines of this sale). A discount
 * beyond the cashier's limits may be approved on the till by a supervisor's PIN, up to that supervisor's
 * own per-line limit (2.17.0, `overrideApproval`); the server checks the approval at sync and raises every
 * such price on the daily exception report. Never a price outside the band.
 */
export function LineDialog({
  line,
  pack,
  shiftDiscountSoFar,
  otherLines,
  onClose,
  onSave,
}: {
  line: CartLine;
  pack: OfflinePack;
  shiftDiscountSoFar: number;
  otherLines: CartLine[];
  onClose: () => void;
  onSave: (line: CartLine) => void;
}) {
  const { t } = useTranslation('pos');
  const units = usePackUnits();
  const [quantity, setQuantity] = useState(line.quantity.replace(/\.?0+$/, ''));
  const [weight, setWeight] = useState<string | null>(line.weightKg);
  const [source, setSource] = useState<WeightSource>(line.weightSource ?? 'MANUAL');
  const [price, setPrice] = useState<number | null>(line.agreedUnitPricePesewas);
  const [reason, setReason] = useState<string>(line.varianceReasonCode ?? '');
  const [approval, setApproval] = useState<CartLine['overrideApproval']>(
    line.overrideApproval ?? null,
  );
  const [tried, setTried] = useState(false);
  const { snapshot } = useTill();

  const serialised = line.stockUnitId !== null;
  const weighed = line.priceBasis === 'PER_KG';
  const parsedQuantity = serialised ? '1.000' : toThreePlaces(quantity);
  const reasons = pack.reasonCodes.filter((code) => code.domain === 'PRICE_OVERRIDE');
  const candidate: CartLine | null =
    parsedQuantity === null || price === null || (weighed && weight === null)
      ? null
      : {
          ...line,
          quantity: parsedQuantity,
          weightKg: weight,
          weightSource: weight === null ? null : source,
          agreedUnitPricePesewas: price,
          varianceReasonCode: reason === '' || price === line.listUnitPricePesewas ? null : reason,
          overrideApproval:
            approval !== null && approval?.approvedPricePesewas === price ? approval : null,
        };
  const shiftSoFar = shiftDiscountSoFar + cartDiscount(otherLines);
  const refusal: PriceRefusal | null =
    candidate === null ? null : checkAgreedPrice(candidate, pack.policy, shiftSoFar);
  // What the cashier alone may do: past their limits, a supervisor's PIN may approve the price.
  const cashierRefusal: PriceRefusal | null =
    candidate === null
      ? null
      : checkAgreedPrice({ ...candidate, overrideApproval: null }, pack.policy, shiftSoFar);
  const approved = candidate !== null && approvalStands(candidate);
  const needsSupervisor =
    !approved && (cashierRefusal === 'OVER_LINE_LIMIT' || cashierRefusal === 'OVER_SHIFT_LIMIT');
  const discount = candidate === null ? 0 : lineDiscount(candidate);
  const localAuth = snapshot?.localAuth ?? null;
  const cashierId = snapshot?.shift?.cashierId ?? '';
  const supervisors =
    localAuth === null ? [] : priceApprovers(localAuth.verifiers, cashierId, discount);
  const quantityError =
    !serialised && parsedQuantity === null ? t('line.errors.quantity') : undefined;
  const weightError = weighed && weight === null ? t('line.errors.weight') : undefined;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('line.title', { name: line.stockUnitIdentifier ?? line.productName })}
      closeLabel={t('close')}
      icon={Pencil}
      footer={
        <DialogActions cancelLabel={t('cancel')} onCancel={onClose}>
          <Button
            onClick={() => {
              setTried(true);
              if (candidate !== null && refusal === null) onSave(candidate);
            }}
          >
            {t('line.save')}
          </Button>
        </DialogActions>
      }
    >
      <div className="grid gap-4">
        {serialised ? (
          <p>{t('line.oneAnimal', { name: line.stockUnitIdentifier })}</p>
        ) : (
          <Field
            label={t('line.quantity', { uom: unitName(line.saleUom, units, 'many') })}
            error={tried ? quantityError : undefined}
          >
            <Input
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
        )}
        {weighed || serialised ? (
          <>
            <Field
              label={t('line.weight')}
              hint={weighed ? t('line.weightHintPerKg') : t('line.weightHint')}
              error={tried ? weightError : undefined}
            >
              <WeightInput value={weight} onValueChange={setWeight} />
            </Field>
            <Field label={t('line.source')}>
              <Select
                value={source}
                onValueChange={(value) => setSource(value as WeightSource)}
                options={SOURCES.map((value) => ({ value, label: t(`line.sources.${value}`) }))}
              />
            </Field>
          </>
        ) : null}
        <div className="grid gap-1">
          <p className="text-sm text-fg-muted">{t('line.band')}</p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-fg-muted">{t('line.floor')}</dt>
              <dd>
                <MoneyDisplay pesewas={line.floorUnitPricePesewas} />
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('line.list')}</dt>
              <dd className="font-semibold">
                <MoneyDisplay pesewas={line.listUnitPricePesewas} />
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('line.ceiling')}</dt>
              <dd>
                <MoneyDisplay pesewas={line.ceilingUnitPricePesewas} />
              </dd>
            </div>
          </dl>
        </div>
        <Field label={t(`line.priceLabel.${line.priceBasis}`)} hint={t('line.priceHint')}>
          <MoneyInput value={price} onValueChange={setPrice} />
        </Field>
        {price !== null && price !== line.listUnitPricePesewas ? (
          <Field
            label={t('line.reason')}
            error={tried && refusal === 'REASON_REQUIRED' ? t('line.errors.reason') : undefined}
          >
            <Select
              value={reason}
              onValueChange={setReason}
              placeholder={t('line.reasonPlaceholder')}
              options={reasons.map((code) => ({ value: code.code, label: code.description }))}
            />
          </Field>
        ) : null}
        {candidate !== null ? (
          <p className="text-lg font-semibold">
            {t('line.amount')} <MoneyDisplay pesewas={lineAmount(candidate)} />
          </p>
        ) : null}
        {tried && refusal !== null && refusal !== 'REASON_REQUIRED' ? (
          <Alert severity="critical" title={t(`line.refusal.${refusal}`)}>
            {approval != null && approved
              ? t('line.overSupervisorLimit', {
                  name: approval.approvedByName,
                  limit: formatMoney(approval.limitPesewas),
                })
              : t('line.refusalBody', {
                  line: formatMoney(pack.policy.priceOverrideLimitPerLinePesewas),
                  shift: formatMoney(pack.policy.priceOverrideLimitPerShiftPesewas),
                })}
          </Alert>
        ) : null}
        {approved && candidate.overrideApproval != null ? (
          <p role="status" data-slot="price-approved">
            {t('line.approvedBy', {
              name: candidate.overrideApproval.approvedByName,
              discount: formatMoney(discount),
            })}
          </p>
        ) : null}
        {needsSupervisor && candidate?.varianceReasonCode != null ? (
          <fieldset
            className="grid gap-3 rounded-md border border-border p-3"
            data-slot="price-approval"
          >
            <legend className="px-1 font-semibold">{t('line.supervisorTitle')}</legend>
            <p>{t('line.supervisorBody', { discount: formatMoney(discount) })}</p>
            {localAuth === null || supervisors.length === 0 ? (
              <Alert
                severity="warning"
                title={t('line.noSupervisor', { discount: formatMoney(discount) })}
              />
            ) : (
              <PinApprovalField
                key={price ?? 'none'}
                approval="PRICE_OVERRIDE"
                approvers={supervisors}
                policy={localAuth.policy}
                label={t('line.supervisor')}
                onApproved={(record) => {
                  const supervisor = supervisors.find((v) => v.principalId === record.principalId);
                  if (price === null || supervisor === undefined) return;
                  setApproval({
                    approvedById: record.principalId,
                    approvedByPinVersion: record.verifierVersion,
                    approvedByName: record.displayName,
                    approvedAt: record.at,
                    approvedPricePesewas: price,
                    limitPesewas: supervisor.priceOverrideLimitPerLinePesewas ?? 0,
                  });
                }}
              />
            )}
          </fieldset>
        ) : null}
      </div>
    </Dialog>
  );
}
