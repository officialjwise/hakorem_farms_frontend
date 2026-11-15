import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  Button,
  Card,
  CardBody,
  Field,
  MutationFailure,
  QueryBoundary,
  Select,
  Skeleton,
  WeightDisplay,
  WeightInput,
} from '@hakorem/ui';
import { useApiMutation } from '../data/api';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { useLocations } from '../stock/locations';
import { AnimalPicker, type AnimalChoice } from './pickers';
import { WEIGHT_SOURCES, type WeightSource } from './presentation';

/** The contract's `Kilograms`: exactly three places. WeightInput hands back this shape or null. */
const KILOGRAMS = /^(0|[1-9][0-9]{0,6})\.[0-9]{3}$/;

interface DraftInput {
  animal: AnimalChoice;
  weightKg: string | null;
  weightSource: WeightSource;
}

const asSource = (value: string): WeightSource =>
  WEIGHT_SOURCES.find((source) => source === value) ?? 'SCALE';

/**
 * Plans a processing order (`createProcessingOrder`): the processing location, the output location (usually
 * the cold room), and the animals standing at the processing location, each with its weight at input and
 * where that weight came from. The contract's create takes no outputs: they are weighed and recorded once
 * the order is in progress. Saving makes a PLANNED order, which moves no stock, and opens it. A refusal
 * (an animal under a withdrawal hold, one not standing here) stays on screen in the API's own words.
 */
export function NewProcessingOrderScreen() {
  const { t } = useTranslation(['processing', 'common']);
  const navigate = useNavigate();
  const locations = useLocations();
  const [locationId, setLocationId] = useState('');
  const [outputLocationId, setOutputLocationId] = useState('');
  const [inputs, setInputs] = useState<DraftInput[]>([]);
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const create = useApiMutation('createProcessingOrder');
  const keyFor = useIntentKey();
  const dirty = !saved && (locationId !== '' || inputs.length > 0);
  const guard = useLeaveGuard(dirty);
  const required = t('common:field.required');
  const states = useStateLabels({
    loading: t('newOrder.loading'),
    emptyTitle: t('newOrder.noLocations'),
    emptyDescription: t('newOrder.noLocationsBody'),
    errorTitle: t('newOrder.locationsError'),
    deniedTitle: t('newOrder.locationsDenied'),
  });
  const failure = useStateLabels({
    loading: t('newOrder.saving'),
    emptyTitle: t('newOrder.notSaved'),
    errorTitle: t('newOrder.notSaved'),
    deniedTitle: t('newOrder.denied'),
  });
  const update = (id: string, change: Partial<DraftInput>) =>
    setInputs((now) =>
      now.map((input) => (input.animal.id === id ? { ...input, ...change } : input)),
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    const complete =
      locationId !== '' &&
      outputLocationId !== '' &&
      inputs.length > 0 &&
      inputs.every((input) => input.weightKg !== null && KILOGRAMS.test(input.weightKg));
    if (!complete) return;
    const body = {
      locationId,
      outputLocationId,
      inputs: inputs.map((input) => ({
        stockUnitId: input.animal.id,
        weightKg: input.weightKg ?? '',
        weightSource: input.weightSource,
      })),
    };
    create
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then((made) => {
        setSaved(true);
        return navigate(`/processing-orders/${made.id}`);
      })
      .catch(() => undefined);
  };

  return (
    <article aria-labelledby="new-order-title" className="grid gap-4">
      <div className="grid gap-2">
        <Link to="/processing-orders" className="text-accent-text underline">
          {t('orders.back')}
        </Link>
        <PageHeader title={t('newOrder.title')} titleId="new-order-title" />
        <p className="text-fg-muted">{t('newOrder.hint')}</p>
      </div>
      <QueryBoundary
        query={locations.query}
        labels={states}
        isEmpty={(all) => all.items.length === 0}
        loadingFallback={<Skeleton label={states.loading} shape="block" className="h-96" />}
      >
        {() => (
          <Card>
            <CardBody>
              <form
                className="grid gap-4"
                onSubmit={submit}
                noValidate
                aria-label={t('newOrder.form')}
              >
                <MutationFailure error={create.error} labels={failure} />
                <Field
                  label={t('newOrder.location')}
                  hint={t('newOrder.locationHint')}
                  required
                  requiredLabel={required}
                  error={checked && locationId === '' ? required : undefined}
                >
                  <Select
                    value={locationId}
                    onValueChange={(value) => {
                      setLocationId(value);
                      // The animals listed are the ones standing at the old location.
                      setInputs([]);
                    }}
                    placeholder={t('newOrder.chooseLocation')}
                    options={locations.options}
                  />
                </Field>
                <Field
                  label={t('newOrder.outputLocation')}
                  hint={t('newOrder.outputLocationHint')}
                  required
                  requiredLabel={required}
                  error={checked && outputLocationId === '' ? required : undefined}
                >
                  <Select
                    value={outputLocationId}
                    onValueChange={setOutputLocationId}
                    placeholder={t('newOrder.chooseLocation')}
                    options={locations.options}
                  />
                </Field>
                <fieldset className="grid gap-3">
                  <legend className="mb-2 text-lg font-semibold">{t('newOrder.inputs')}</legend>
                  <AnimalPicker
                    label={t('newOrder.addAnimal')}
                    locationId={locationId}
                    exclude={inputs.map((input) => input.animal.id)}
                    onPick={(animal) =>
                      setInputs((now) => [
                        ...now,
                        { animal, weightKg: null, weightSource: 'SCALE' },
                      ])
                    }
                    {...(checked && inputs.length === 0 ? { error: t('newOrder.noInputs') } : {})}
                  />
                  {inputs.length === 0 ? (
                    <p className="text-fg-muted">{t('newOrder.noneYet')}</p>
                  ) : (
                    <ol className="grid gap-3">
                      {inputs.map((input) => {
                        const tag = input.animal.identifier;
                        const missing =
                          checked && (input.weightKg === null || !KILOGRAMS.test(input.weightKg));
                        return (
                          <li
                            key={input.animal.id}
                            className="grid gap-2 rounded-md border border-border p-3"
                          >
                            <p className="font-semibold">
                              {t('newOrder.animal', { tag, product: input.animal.product.name })}
                            </p>
                            {input.animal.lastWeightKg === null ? null : (
                              <p className="text-control-sm text-fg-muted">
                                {t('newOrder.lastWeighed')}{' '}
                                <WeightDisplay kilograms={input.animal.lastWeightKg} />
                              </p>
                            )}
                            <Field
                              label={t('newOrder.weight', { tag })}
                              hint={t('newOrder.weightHint')}
                              required
                              requiredLabel={required}
                              error={missing ? t('newOrder.weightMissing') : undefined}
                            >
                              <WeightInput
                                value={input.weightKg}
                                onValueChange={(weightKg) => update(input.animal.id, { weightKg })}
                              />
                            </Field>
                            <Field label={t('newOrder.weightSource', { tag })}>
                              <Select
                                value={input.weightSource}
                                onValueChange={(value) =>
                                  update(input.animal.id, { weightSource: asSource(value) })
                                }
                                options={WEIGHT_SOURCES.map((value) => ({
                                  value,
                                  label: t(`weightSource.${value}`),
                                }))}
                              />
                            </Field>
                            <div>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  setInputs((now) =>
                                    now.filter((other) => other.animal.id !== input.animal.id),
                                  )
                                }
                              >
                                {t('newOrder.remove', { tag })}
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </fieldset>
                <div>
                  <Button
                    type="submit"
                    loading={create.isPending}
                    loadingLabel={t('newOrder.saving')}
                  >
                    {t('newOrder.save')}
                  </Button>
                </div>
              </form>
              <LeaveGuardDialog guard={guard} />
            </CardBody>
          </Card>
        )}
      </QueryBoundary>
    </article>
  );
}
