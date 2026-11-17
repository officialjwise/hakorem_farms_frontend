import { NetworkError, type components } from '@hakorem/api-client';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  Input,
  formatDateTime,
} from '@hakorem/ui';
import { useApiMutation, useApiQuery } from '../../data/api';
import { newRecordId } from '../../lib/clientId';
import type { CartLine } from '../offline/cart';
import { getTill } from '../offline/till';
import type { HeldLocal, OfflinePack, TillSnapshot } from '../offline/types';
import { bandFor, productById } from './catalogue';

type HeldSale = components['schemas']['HeldSale'];

/** The lines a held sale carries, as the till wrote them (`HeldSale.payload` is the till's own shape). */
function linesOf(payload: Record<string, unknown>): CartLine[] {
  const lines = payload['lines'];
  return Array.isArray(lines) ? (lines as CartLine[]) : [];
}

/**
 * Prices are re-resolved on recall (`HeldSale.payload`): each line takes the price list price from the pack
 * the till holds now, and any agreed price is asked again. A product no longer in the pack is dropped.
 */
export function repriced(lines: CartLine[], pack: OfflinePack): CartLine[] {
  return lines.flatMap((line) => {
    const product = productById(pack, line.productId);
    // A crate is re-priced as a crate and a single egg as an egg (CR-038).
    const band = product === null ? null : bandFor(product, line.soldInUom);
    if (band === null) return [];
    return [
      {
        ...line,
        key: newRecordId(),
        listUnitPricePesewas: band.listPricePesewas,
        floorUnitPricePesewas: band.floorPricePesewas,
        ceilingUnitPricePesewas: band.ceilingPricePesewas,
        agreedUnitPricePesewas: band.listPricePesewas,
        varianceReasonCode: null,
      },
    ];
  });
}

/**
 * Hold and recall (FR-POS). Online, a held sale is kept on the register (`holdSale`), where any till of
 * it can recall it; offline, or if the register cannot be reached, it is kept on this till only
 * (OFFLINE_SYNC section 2). The recall list shows both, and says which is which.
 */
export function HeldSales({
  lines,
  pack,
  snapshot,
  online,
  onHeld,
  onRecall,
}: {
  lines: CartLine[];
  pack: OfflinePack;
  snapshot: TillSnapshot;
  online: boolean;
  onHeld: () => void;
  onRecall: (lines: CartLine[]) => void;
}) {
  const { t } = useTranslation('pos');
  const [holding, setHolding] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [label, setLabel] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const registerId = snapshot.device?.registerId ?? '';
  const hold = useApiMutation('holdSale', { invalidates: ['listHeldSales'] });
  const recall = useApiMutation('recallHeldSale', { invalidates: ['listHeldSales'] });
  const onRegister = useApiQuery(
    'listHeldSales',
    { path: { id: registerId } },
    { enabled: recalling && online && registerId !== '' },
  );

  const holdNow = async () => {
    setFailed(null);
    const id = newRecordId();
    const name = label.trim() === '' ? null : label.trim();
    try {
      if (!online) throw new NetworkError();
      await hold.mutateAsync(
        {
          path: { id: registerId },
          body: { id, ...(name !== null ? { label: name } : {}), payload: { lines } },
        },
        { idempotencyKey: id },
      );
    } catch (error) {
      if (!(error instanceof NetworkError)) {
        setFailed(error instanceof Error ? error.message : String(error));
        return;
      }
      // No register to hold it on: keep it on this till.
      await getTill().holdLocally(lines, name);
    }
    setHolding(false);
    setLabel('');
    onHeld();
  };

  const recallServer = (held: HeldSale) => {
    setFailed(null);
    recall
      .mutateAsync({ path: { id: held.id } }, { idempotencyKey: newRecordId() })
      .then((answer) => {
        setRecalling(false);
        onRecall(repriced(linesOf(answer.payload), pack));
      })
      .catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
  };

  const recallLocal = (held: HeldLocal) => {
    void getTill()
      .removeHeld(held.id)
      .then(() => {
        setRecalling(false);
        onRecall(repriced(held.lines, pack));
      });
  };

  const serverHeld = onRegister.data?.data ?? [];
  const localHeld = snapshot.held;

  return (
    <>
      {lines.length > 0 ? (
        <Button size="lg" variant="secondary" fullWidth onClick={() => setHolding(true)}>
          <Archive aria-hidden="true" />
          {t('held.hold')}
        </Button>
      ) : (
        <Button size="lg" variant="secondary" fullWidth onClick={() => setRecalling(true)}>
          <ArchiveRestore aria-hidden="true" />
          {t('held.recall')}
        </Button>
      )}
      <Dialog
        open={holding}
        onOpenChange={setHolding}
        title={t('held.holdTitle')}
        description={online ? t('held.holdBody') : t('held.holdOffline')}
        closeLabel={t('close')}
        icon={Archive}
        footer={
          <DialogActions cancelLabel={t('cancel')} onCancel={() => setHolding(false)}>
            <Button
              loading={hold.isPending}
              loadingLabel={t('held.holding')}
              onClick={() => void holdNow()}
            >
              {t('held.hold')}
            </Button>
          </DialogActions>
        }
      >
        <Field label={t('held.label')} hint={t('held.labelHint')}>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            autoComplete="off"
          />
        </Field>
        {failed !== null ? (
          <Alert severity="critical" title={t('held.failed')}>
            {failed}
          </Alert>
        ) : null}
      </Dialog>
      <Dialog
        open={recalling}
        onOpenChange={setRecalling}
        title={t('held.recallTitle')}
        description={t('held.recallBody')}
        closeLabel={t('close')}
        icon={ArchiveRestore}
      >
        <div className="grid gap-3">
          {localHeld.length === 0 && serverHeld.length === 0 ? (
            <EmptyState
              compact
              title={t('held.none')}
              description={online ? undefined : t('held.offlineList')}
            />
          ) : null}
          <ul className="grid gap-2">
            {localHeld.map((held) => (
              <li key={held.id}>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  className="h-auto whitespace-normal py-2"
                  onClick={() => recallLocal(held)}
                >
                  {t('held.row', {
                    label: held.label ?? t('held.unnamed'),
                    count: held.lines.length,
                    at: formatDateTime(held.heldAt),
                  })}
                  <span className="text-fg-muted">{t('held.onTill')}</span>
                </Button>
              </li>
            ))}
            {serverHeld.map((held) => (
              <li key={held.id}>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  className="h-auto whitespace-normal py-2"
                  onClick={() => recallServer(held)}
                >
                  {t('held.row', {
                    label: held.label ?? t('held.unnamed'),
                    count: linesOf(held.payload).length,
                    at: formatDateTime(held.heldAt),
                  })}
                  <span className="text-fg-muted">
                    {t('held.onRegister', { name: held.heldBy.displayName })}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          {onRegister.isError ? (
            <Alert severity="warning" title={t('held.registerUnreachable')} />
          ) : null}
          {failed !== null ? (
            <Alert severity="critical" title={t('held.recallFailed')}>
              {failed}
            </Alert>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
