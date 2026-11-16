import { MoveRight, PencilLine, Scale, Syringe } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogActions,
  Field,
  formatQuantity,
  formatWeight,
  Input,
  MoneyDisplay,
  MoneyInput,
  MutationFailure,
  NumberInput,
  Select,
  Textarea,
  WeightInput,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation } from '../data/api';
import { newRecordId } from '../lib/clientId';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { ProductPicker, type ProductRef } from '../stock/LinesEditor';
import { useLocations } from '../stock/locations';
import { toQuantity, useUnits } from '../stock/units';
import { AnimalPicker, animalName, type Animal, type PickedAnimal } from './animals';

const WEIGHT_SOURCES = ['SCALE', 'MANUAL', 'ESTIMATE'] as const;
const HEALTH_KINDS = ['VACCINATION', 'TREATMENT', 'CHECK', 'DEWORMING'] as const;
const SEXES = ['MALE', 'FEMALE', 'UNKNOWN'] as const;
const PURPOSES = ['GROWING', 'BREEDING'] as const;

/** One opening of a record form: the client's record id and the event's time stay fixed across retries. */
function useRecordIntent() {
  const [intent] = useState(() => ({ id: newRecordId(), at: new Date().toISOString() }));
  return intent;
}

function useFailureLabels(failed: string, denied: string) {
  return useStateLabels({
    loading: failed,
    emptyTitle: failed,
    errorTitle: failed,
    deniedTitle: denied,
  });
}

function required(t: (key: 'common:field.required') => string) {
  return { required: true as const, requiredLabel: t('common:field.required') };
}

/**
 * Weigh one animal. A weight is a fact, not a stock or money write, so it is sent without a confirmation,
 * with a client id so a resubmission returns the first result (`recordWeights`, offline-safe).
 */
export function RecordWeightDialog({
  animal,
  onClose,
  onDone,
}: {
  animal: PickedAnimal;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t } = useTranslation(['livestock', 'common']);
  const intent = useRecordIntent();
  const [weightKg, setWeightKg] = useState<string | null>(null);
  const [source, setSource] = useState<(typeof WEIGHT_SOURCES)[number]>('SCALE');
  const [missing, setMissing] = useState(false);
  const record = useApiMutation('recordWeights');
  const keyFor = useIntentKey();
  const failure = useFailureLabels(t('weigh.failed'), t('weigh.denied'));
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('weigh.title', { animal: animalName(animal) })}
      description={t('weigh.body')}
      closeLabel={t('common:actions.cancel')}
      icon={Scale}
      requiredNote={t('common:field.requiredNote')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (weightKg === null || /^0+\.0+$/.test(weightKg)) {
            setMissing(true);
            return;
          }
          const body = {
            records: [
              {
                id: intent.id,
                stockUnitId: animal.id,
                weightKg,
                weightSource: source,
                measuredAt: intent.at,
              },
            ],
          };
          record
            .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
            .then(() =>
              onDone(t('weigh.done', { animal: animal.tagNo, weight: formatWeight(weightKg) })),
            )
            .catch(() => undefined);
        }}
      >
        <MutationFailure error={record.error} labels={failure} />
        <Field
          label={t('weigh.weight')}
          {...required(t)}
          requiredMark="asterisk"
          error={missing ? t('weigh.weightMissing') : undefined}
        >
          <WeightInput
            value={weightKg}
            onValueChange={(value) => {
              setWeightKg(value);
              setMissing(false);
            }}
          />
        </Field>
        <Field label={t('weigh.source')}>
          <Select
            value={source}
            onValueChange={(value) => setSource(WEIGHT_SOURCES.find((s) => s === value) ?? 'SCALE')}
            options={WEIGHT_SOURCES.map((value) => ({ value, label: t(`weightSource.${value}`) }))}
          />
        </Field>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit" loading={record.isPending} loadingLabel={t('weigh.saving')}>
            <Scale aria-hidden="true" />
            {t('weigh.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/**
 * A vaccination, treatment, check or deworming, of one animal or of every animal in a pen. A medicine used
 * leaves the store and its cost lands on the animals, and a withdrawal period stops them being sold, so it
 * is confirmed with the exact quantity, cost and withdrawal first. The API spreads a pen's cost by head-days
 * (1.24.0); the screen never divides it.
 */
export function HealthEventDialog({
  animal,
  onClose,
  onDone,
}: {
  /** Fixed when the form opens from an animal's page; chosen in the form otherwise. */
  animal: PickedAnimal | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t } = useTranslation(['livestock', 'common']);
  const intent = useRecordIntent();
  const units = useUnits();
  const locations = useLocations();
  const [target, setTarget] = useState<'ANIMAL' | 'PEN'>('ANIMAL');
  const [picked, setPicked] = useState<PickedAnimal | null>(animal);
  const [locationId, setLocationId] = useState('');
  const [kind, setKind] = useState<(typeof HEALTH_KINDS)[number]>('TREATMENT');
  const [medicine, setMedicine] = useState<ProductRef | null>(null);
  const [dose, setDose] = useState('');
  const [qty, setQty] = useState('');
  const [withdrawal, setWithdrawal] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [by, setBy] = useState('');
  const [notes, setNotes] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  // The Farm hand records but cannot read health events, so the full write refuses them (contract 1.26.0,
  // `x-answer-permission`): they record through the care twin, whose answer carries no cost.
  const auth = useAuth();
  const full = useApiMutation('recordHealthEvent');
  const care = useApiMutation('recordCareHealthEvent');
  const record = auth.can('liv.health.read') ? full : care;
  const keyFor = useIntentKey();
  const qtyUsed = qty === '' ? null : toQuantity(qty);
  const location = locations.items.find((row) => row.id === locationId);
  const body = {
    id: intent.id,
    kind,
    occurredAt: intent.at,
    ...(target === 'ANIMAL' && picked !== null ? { stockUnitId: picked.id } : {}),
    ...(target === 'PEN' && locationId !== '' ? { locationId } : {}),
    ...(medicine === null ? {} : { productId: medicine.id }),
    ...(dose.trim() === '' ? {} : { dose: dose.trim() }),
    ...(qtyUsed === null ? {} : { qtyUsed }),
    ...(withdrawal === '' ? {} : { withdrawalDays: Number.parseInt(withdrawal, 10) }),
    ...(cost === null ? {} : { costPesewas: cost }),
    ...(by.trim() === '' ? {} : { administeredBy: by.trim() }),
    ...(notes.trim() === '' ? {} : { notes: notes.trim() }),
  };
  const who =
    target === 'ANIMAL'
      ? picked === null
        ? ''
        : animalName(picked)
      : t('health.wholePen', { pen: location?.name ?? '' });
  const send = () =>
    record
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then((saved) =>
        onDone(
          saved.holdsPlaced > 0
            ? t('health.doneHeld', { count: saved.holdsPlaced })
            : t('health.done', { kind: t(`healthKind.${kind}`) }),
        ),
      )
      .catch(() => undefined);
  if (confirming) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => (open ? undefined : setConfirming(false))}
        title={t('health.confirmTitle', { kind: t(`healthKind.${kind}`), who })}
        body={t('health.confirmBody')}
        changes={[
          ...(medicine === null
            ? []
            : [
                {
                  label: t('health.medicine'),
                  after:
                    qtyUsed === null
                      ? medicine.name
                      : t('health.medicineUsed', {
                          qty: `${formatQuantity(qtyUsed, { places: units.places(medicine.baseUom) })} ${units.name(medicine.baseUom)}`,
                          product: medicine.name,
                        }),
                },
              ]),
          ...(cost === null
            ? []
            : [{ label: t('health.cost'), after: <MoneyDisplay pesewas={cost} /> }]),
          {
            label: t('health.withdrawal'),
            after:
              withdrawal === ''
                ? t('health.withdrawalDefault')
                : t('health.withdrawalDays', { count: Number.parseInt(withdrawal, 10) }),
          },
        ]}
        consequence={t('health.consequence')}
        confirmLabel={t('health.save')}
        pendingLabel={t('health.saving')}
        pending={record.isPending}
        error={record.error}
        failedTitle={t('health.failed')}
        icon={Syringe}
        confirmIcon={Syringe}
        onConfirm={() => void send()}
      />
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={
        animal === null ? t('health.title') : t('health.titleFor', { animal: animalName(animal) })
      }
      description={t('health.body')}
      closeLabel={t('common:actions.cancel')}
      icon={Syringe}
      requiredNote={t('common:field.requiredNote')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          const found: string[] = [];
          if (target === 'ANIMAL' && picked === null) found.push('animal');
          if (target === 'PEN' && locationId === '') found.push('pen');
          if (qty !== '' && qtyUsed === null) found.push('qty');
          setProblems(found);
          if (found.length === 0) setConfirming(true);
        }}
      >
        <Field label={t('health.kind')} {...required(t)} requiredMark="asterisk">
          <Select
            value={kind}
            onValueChange={(value) => setKind(HEALTH_KINDS.find((k) => k === value) ?? 'TREATMENT')}
            options={HEALTH_KINDS.map((value) => ({ value, label: t(`healthKind.${value}`) }))}
          />
        </Field>
        {animal === null ? (
          <>
            <Field label={t('health.target')}>
              <Select
                value={target}
                onValueChange={(value) => setTarget(value === 'PEN' ? 'PEN' : 'ANIMAL')}
                options={[
                  { value: 'ANIMAL', label: t('health.oneAnimal') },
                  { value: 'PEN', label: t('health.aPen') },
                ]}
              />
            </Field>
            {target === 'ANIMAL' ? (
              <AnimalPicker
                label={t('health.animal')}
                value={picked}
                onChange={setPicked}
                error={problems.includes('animal') ? t('common:field.required') : undefined}
              />
            ) : (
              <Field
                label={t('health.pen')}
                {...required(t)}
                requiredMark="asterisk"
                hint={t('health.penHint')}
                error={problems.includes('pen') ? t('common:field.required') : undefined}
              >
                <Select
                  value={locationId}
                  onValueChange={setLocationId}
                  placeholder={t('health.choosePen')}
                  options={locations.options}
                />
              </Field>
            )}
          </>
        ) : null}
        <ProductPicker
          label={t('health.medicine')}
          value={medicine}
          onChange={setMedicine}
          required={false}
        />
        <Field label={t('health.dose')}>
          <Input value={dose} onChange={(event) => setDose(event.target.value)} />
        </Field>
        <Field
          label={t('health.qty')}
          hint={t('health.qtyHint')}
          error={problems.includes('qty') ? t('health.qtyInvalid') : undefined}
        >
          <NumberInput value={qty} onValueChange={setQty} decimals={3} />
        </Field>
        <Field label={t('health.withdrawalField')} hint={t('health.withdrawalHint')}>
          <NumberInput value={withdrawal} onValueChange={setWithdrawal} />
        </Field>
        <Field label={t('health.cost')} hint={t('health.costHint')}>
          <MoneyInput value={cost} onValueChange={setCost} />
        </Field>
        <Field label={t('health.by')}>
          <Input value={by} onChange={(event) => setBy(event.target.value)} />
        </Field>
        <Field label={t('health.notes')}>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit">{t('health.review')}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** Move an animal to another pen: a stock movement, so the from and to are confirmed first. */
export function MoveAnimalDialog({
  animal,
  onClose,
  onDone,
}: {
  animal: Animal;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t } = useTranslation(['livestock', 'common']);
  const locations = useLocations();
  const [toLocationId, setTo] = useState('');
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const move = useApiMutation('moveAnimal');
  const keyFor = useIntentKey();
  const options = locations.options.filter((option) => option.value !== animal.currentLocation?.id);
  const to = locations.items.find((row) => row.id === toLocationId);
  const body = { toLocationId, ...(note.trim() === '' ? {} : { note: note.trim() }) };
  if (confirming) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => (open ? undefined : setConfirming(false))}
        title={t('move.confirmTitle', { animal: animal.tagNo })}
        body={t('move.confirmBody')}
        changes={[
          {
            label: t('move.location'),
            before: animal.currentLocation?.name ?? t('animals.noLocation'),
            after: to?.name ?? '',
          },
        ]}
        confirmLabel={t('move.save')}
        pendingLabel={t('move.saving')}
        pending={move.isPending}
        error={move.error}
        failedTitle={t('move.failed')}
        icon={MoveRight}
        confirmIcon={MoveRight}
        onConfirm={() =>
          void move
            .mutateAsync({ path: { id: animal.id }, body }, { idempotencyKey: keyFor(body) })
            .then((saved) =>
              onDone(
                t('move.done', { animal: saved.tagNo, to: saved.currentLocation?.name ?? '' }),
              ),
            )
            .catch(() => undefined)
        }
      />
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('move.title', { animal: animalName(animal) })}
      description={t('move.body', {
        from: animal.currentLocation?.name ?? t('animals.noLocation'),
      })}
      closeLabel={t('common:actions.cancel')}
      icon={MoveRight}
      requiredNote={t('common:field.requiredNote')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (toLocationId === '') {
            setMissing(true);
            return;
          }
          setConfirming(true);
        }}
      >
        {locations.query.isError ? <p role="alert">{t('move.locationsError')}</p> : null}
        <Field
          label={t('move.to')}
          {...required(t)}
          requiredMark="asterisk"
          error={missing ? t('common:field.required') : undefined}
        >
          <Select
            value={toLocationId}
            onValueChange={(value) => {
              setTo(value);
              setMissing(false);
            }}
            placeholder={t('move.choose')}
            options={options}
          />
        </Field>
        <Field label={t('move.note')}>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit">{t('move.review')}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/**
 * Correct an animal's tag, breed, sex or purpose (`updateAnimal`, with its version). A corrected tag is
 * audited by the server. Nothing here moves stock or money.
 */
export function EditAnimalDialog({
  animal,
  onClose,
  onDone,
}: {
  animal: Animal;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t } = useTranslation(['livestock', 'common']);
  const [tagNo, setTagNo] = useState(animal.tagNo);
  const [breed, setBreed] = useState(animal.breed ?? '');
  const [sex, setSex] = useState(animal.sex);
  const [purpose, setPurpose] = useState(animal.purpose);
  const [missing, setMissing] = useState(false);
  const update = useApiMutation('updateAnimal');
  const keyFor = useIntentKey();
  const failure = useFailureLabels(t('edit.failed'), t('edit.denied'));
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t('edit.title', { animal: animalName(animal) })}
      description={t('edit.body')}
      closeLabel={t('common:actions.cancel')}
      icon={PencilLine}
      requiredNote={t('common:field.requiredNote')}
    >
      <form
        className="grid gap-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (tagNo.trim() === '') {
            setMissing(true);
            return;
          }
          const body = {
            version: animal.version,
            ...(tagNo.trim() === animal.tagNo ? {} : { tagNo: tagNo.trim() }),
            ...(breed.trim() === (animal.breed ?? '') || breed.trim() === ''
              ? {}
              : { breed: breed.trim() }),
            ...(sex === animal.sex ? {} : { sex }),
            ...(purpose === animal.purpose ? {} : { purpose }),
          };
          update
            .mutateAsync({ path: { id: animal.id }, body }, { idempotencyKey: keyFor(body) })
            .then((saved) => onDone(t('edit.done', { animal: saved.tagNo })))
            .catch(() => undefined);
        }}
      >
        <MutationFailure error={update.error} labels={failure} />
        <Field
          label={t('edit.tag')}
          {...required(t)}
          requiredMark="asterisk"
          hint={t('edit.tagHint')}
          error={missing ? t('common:field.required') : undefined}
        >
          <Input value={tagNo} onChange={(event) => setTagNo(event.target.value)} />
        </Field>
        <Field label={t('edit.breed')}>
          <Input value={breed} onChange={(event) => setBreed(event.target.value)} />
        </Field>
        <Field label={t('edit.sex')}>
          <Select
            value={sex}
            onValueChange={(value) => setSex(SEXES.find((s) => s === value) ?? animal.sex)}
            options={SEXES.map((value) => ({ value, label: t(`sex.${value}`) }))}
          />
        </Field>
        <Field label={t('edit.purpose')}>
          <Select
            value={purpose}
            onValueChange={(value) =>
              setPurpose(PURPOSES.find((p) => p === value) ?? animal.purpose)
            }
            options={PURPOSES.map((value) => ({ value, label: t(`purpose.${value}`) }))}
          />
        </Field>
        <DialogActions cancelLabel={t('common:actions.cancel')} onCancel={onClose}>
          <Button type="submit" loading={update.isPending} loadingLabel={t('edit.saving')}>
            {t('edit.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** A dialog the page opens, by name: one at a time. */
export type OpenDialog = null | 'weigh' | 'health' | 'mortality' | 'move' | 'edit';
export type DialogSlot = (open: OpenDialog) => ReactNode;
