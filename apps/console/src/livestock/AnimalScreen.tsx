import { HeartCrack, History, MoveRight, PencilLine, Scale, Syringe } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  AnimalTag,
  Button,
  EmptyState,
  IconChip,
  MoneyDisplay,
  PriceBandDisplay,
  QueryBoundary,
  Skeleton,
  WeightDisplay,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { PAGE_CAP_EXCEEDED, useApiAllPages, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { documentHref } from '../lib/documents';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { lookup } from '../lib/lookup';
import { animalName, type Animal } from './animals';
import {
  EditAnimalDialog,
  HealthEventDialog,
  MoveAnimalDialog,
  RecordWeightDialog,
  type OpenDialog,
} from './forms';
import { AnimalStatusBadge, EVENT_LOOK, SellableBadge } from './presentation';

type AnimalEvent = components['schemas']['AnimalEvent'];

/**
 * FR-LIV, one animal, and the F6 gate: its full history reads on one screen without scrolling to find it.
 * The page opens with the animal's tag and state, four facts that matter at the pen (where it is, what it
 * last weighed, what it has cost, whether it can be sold), and then the whole history, newest first, every
 * page of it, before the rest of the record. The actions a person may take on a live animal sit in the
 * header: weigh, treat, move, report a death or cull, correct.
 */
export function AnimalScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const { id = '' } = useParams();
  const animal = useApiQuery('getAnimal', { path: { id } });
  const labels = useStateLabels({
    loading: t('animal.loading'),
    emptyTitle: t('animal.notFound'),
    errorTitle: t('animal.error'),
    deniedTitle: t('animal.denied'),
  });
  const back = (
    <Link to="/animals" className="w-fit text-accent-text underline">
      {t('animal.back')}
    </Link>
  );
  if (animal.error?.status === 404) {
    return (
      <EmptyState
        title={t('animal.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={animal}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => <AnimalDetail animal={current} back={back} />}
    </QueryBoundary>
  );
}

function AnimalDetail({ animal, back }: { animal: Animal; back: ReactNode }) {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const [open, setOpen] = useState<OpenDialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const alive = animal.status === 'ALIVE';
  const done = (message: string) => {
    setOpen(null);
    setNotice(message);
  };
  const actions: { key: Exclude<OpenDialog, null>; permission: string; icon: typeof Scale }[] = [
    { key: 'weigh', permission: 'liv.weight.record', icon: Scale },
    { key: 'health', permission: 'liv.health.record', icon: Syringe },
    { key: 'move', permission: 'liv.animal.move', icon: MoveRight },
    { key: 'mortality', permission: 'liv.mortality.report', icon: HeartCrack },
  ];
  return (
    <article aria-labelledby="animal-title" className="grid gap-4">
      <div className="grid gap-2">
        {back}
        <PageHeader
          title={animalName(animal)}
          titleId="animal-title"
          description={
            <span className="flex flex-wrap items-center gap-2">
              <AnimalStatusBadge status={animal.status} />
              <SellableBadge animal={animal} />
              <span className="text-fg-muted">
                {[animal.breed, t(`sex.${animal.sex}`), t(`purpose.${animal.purpose}`)]
                  .filter((part) => part !== null)
                  .join(' · ')}
              </span>
            </span>
          }
          actions={
            <>
              {alive
                ? actions
                    .filter((action) => auth.can(action.permission))
                    .map(({ key, icon: Icon }) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={key === 'mortality' ? 'secondary' : 'primary'}
                        onClick={() =>
                          key === 'mortality'
                            ? void navigate('/report-death', {
                                state: {
                                  animal: {
                                    id: animal.id,
                                    tagNo: animal.tagNo,
                                    species: animal.species,
                                  },
                                },
                              })
                            : setOpen(key)
                        }
                      >
                        <Icon aria-hidden="true" />
                        {t(`animal.actions.${key}`)}
                      </Button>
                    ))
                : null}
              {auth.can('liv.animal.update') ? (
                <Button size="sm" variant="secondary" onClick={() => setOpen('edit')}>
                  <PencilLine aria-hidden="true" />
                  {t('animal.actions.edit')}
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      {notice === null ? null : <Alert severity="good" title={notice} />}
      {alive && animal.withdrawalUntil !== null ? (
        <Alert severity="warning" title={t('animal.withdrawalTitle')}>
          {t('animal.withdrawalUntil')} <When instant={animal.withdrawalUntil} />
        </Alert>
      ) : null}

      {/* The four facts that matter at the pen, before the history. */}
      <dl aria-label={t('animal.keyFacts')} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <KeyFact label={t('animal.location')}>
          {animal.currentLocation?.name ?? t('animals.noLocation')}
        </KeyFact>
        <KeyFact label={t('animal.lastWeight')}>
          {animal.lastWeightKg === null ? (
            t('animal.neverWeighed')
          ) : (
            <span className="grid">
              <WeightDisplay kilograms={animal.lastWeightKg} strong />
              {animal.lastWeighedAt === null ? null : (
                <span className="text-control-sm font-normal text-fg-muted">
                  <When instant={animal.lastWeighedAt} />
                </span>
              )}
            </span>
          )}
        </KeyFact>
        <KeyFact label={t('animal.cost')}>
          <MoneyDisplay pesewas={animal.accumulatedCostPesewas} strong />
        </KeyFact>
        <KeyFact label={t('animal.price')} wide>
          {animal.priceBand === null ? (
            t('animal.noPrice')
          ) : (
            <PriceBandDisplay
              band={animal.priceBand}
              basisLabel={t(`basis.${animal.priceBand.basis}`, {
                defaultValue: animal.priceBand.basis,
              })}
              toLabel={t('animal.to')}
              listPriceLabel={t('animal.listPrice')}
            />
          )}
        </KeyFact>
      </dl>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Timeline animalId={animal.id} />
        <Facts animal={animal} />
      </div>

      {open === 'weigh' ? (
        <RecordWeightDialog animal={animal} onClose={() => setOpen(null)} onDone={done} />
      ) : null}
      {open === 'health' ? (
        <HealthEventDialog animal={animal} onClose={() => setOpen(null)} onDone={done} />
      ) : null}
      {open === 'move' ? (
        <MoveAnimalDialog animal={animal} onClose={() => setOpen(null)} onDone={done} />
      ) : null}
      {open === 'edit' ? (
        <EditAnimalDialog animal={animal} onClose={() => setOpen(null)} onDone={done} />
      ) : null}
    </article>
  );
}

function KeyFact({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  /** Takes two columns (the whole row on a phone), for a figure that does not fit one (the price band). */
  wide?: boolean;
}) {
  return (
    <div
      className={`grid content-start gap-1 rounded-lg border border-border bg-surface p-3 shadow-sm ${wide ? 'col-span-2' : ''}`}
    >
      <dt className="text-control-sm text-fg-muted">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

/**
 * The animal's whole history from `listAnimalTimeline`: every page read (an animal's life is a bounded list
 * a person reads whole, as the gate asks), shown newest first. Each event says what happened in the API's
 * words, when, who recorded it, what it cost where it carries a value, and the document behind it.
 */
function Timeline({ animalId }: { animalId: string }) {
  const { t } = useTranslation(['livestock', 'common']);
  const timeline = useApiAllPages(
    'listAnimalTimeline',
    { path: { id: animalId }, query: { limit: 100 } },
    { staleClass: 'live' },
  );
  const labels = useStateLabels({
    loading: t('history.loading'),
    emptyTitle: t('history.empty'),
    errorTitle:
      timeline.error?.code === PAGE_CAP_EXCEEDED ? t('history.tooLong') : t('history.error'),
    deniedTitle: t('history.denied'),
  });
  return (
    <section
      aria-labelledby="history-title"
      className="grid content-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <IconChip icon={History} tone="info" size="sm" />
        <h2 id="history-title" className="text-lg font-semibold">
          {t('history.title')}
        </h2>
      </div>
      <QueryBoundary
        query={timeline}
        labels={labels}
        isEmpty={(all) => all.items.length === 0}
        loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-40" />}
      >
        {(all) => (
          <>
            <p className="text-control-sm text-fg-muted">
              {t('history.count', { count: all.items.length })}
            </p>
            <ol className="grid gap-0" aria-label={t('history.list')}>
              {[...all.items].reverse().map((event, index) => (
                <TimelineEntry key={`${event.at}-${event.kind}-${index}`} event={event} />
              ))}
            </ol>
          </>
        )}
      </QueryBoundary>
    </section>
  );
}

function TimelineEntry({ event }: { event: AnimalEvent }) {
  const { t } = useTranslation(['livestock', 'common']);
  const look = lookup(EVENT_LOOK, event.kind, EVENT_LOOK.COST_ADDED);
  const document = event.document;
  const href = document === null ? undefined : documentHref(document);
  const documentLabel =
    document === null
      ? null
      : (document.number ??
        t('history.unnumbered', {
          kind: t(`docType.${document.docType}`, { defaultValue: document.docType }),
        }));
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border py-3 last:border-b-0">
      <IconChip icon={look.icon} tone={look.tone} size="sm" />
      <div className="grid min-w-0 gap-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-semibold">
            {t(`eventKind.${event.kind}`, { defaultValue: event.kind })}
          </p>
          <p className="text-control-sm text-fg-muted">
            <When instant={event.at} />
          </p>
        </div>
        <p>{event.summary}</p>
        <p className="flex flex-wrap gap-x-3 text-control-sm text-fg-muted">
          {event.valuePesewas === null ? null : (
            <span>
              {t('history.value')} <MoneyDisplay pesewas={event.valuePesewas} />
            </span>
          )}
          {documentLabel === null ? null : href !== undefined ? (
            <Link to={href} className="text-accent-text underline">
              {documentLabel}
            </Link>
          ) : (
            <span>{documentLabel}</span>
          )}
          {event.actor === null ? null : <span>{event.actor.displayName}</span>}
        </p>
      </div>
    </li>
  );
}

/** The rest of the record: where it came from, its family, its grade and band. */
function Facts({ animal }: { animal: Animal }) {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const canRead = auth.can('liv.animal.read');
  const relative = (ref: Animal['dam']) =>
    ref === null ? (
      t('animal.unknown')
    ) : canRead ? (
      <Link to={`/animals/${ref.id}`} className="text-accent-text underline">
        <AnimalTag tagNo={ref.tagNo} />
      </Link>
    ) : (
      <AnimalTag tagNo={ref.tagNo} />
    );
  const rows: [string, ReactNode][] = [
    [t('animal.species'), animal.species.name],
    [t('animal.product'), `${animal.product.name} (${animal.product.sku})`],
    [t('animal.source'), t(`source.${animal.source}`)],
    [
      t('animal.acquired'),
      <span key="acquired">
        {animal.acquiredOn}
        {animal.supplier === null ? null : ` · ${animal.supplier.name}`}
      </span>,
    ],
    [t('animal.born'), animal.dateOfBirth ?? t('animal.unknown')],
    [t('animal.dam'), relative(animal.dam)],
    [t('animal.sire'), relative(animal.sire)],
    [t('animal.batch'), animal.batch === null ? t('animal.none') : animal.batch.batchNo],
    [t('animal.grade'), animal.grade?.name ?? t('animal.none')],
    [
      t('animal.weightBand'),
      animal.weightBand === null ? (
        t('animal.none')
      ) : (
        <span key="band">
          {animal.weightBand.code} · <WeightDisplay kilograms={animal.weightBand.minKg} />{' '}
          {t('animal.to')} <WeightDisplay kilograms={animal.weightBand.maxKg} />
        </span>
      ),
    ],
    [t('animal.registered'), <When key="registered" instant={animal.createdAt} />],
  ];
  return (
    <section
      aria-labelledby="facts-title"
      className="grid content-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
    >
      <h2 id="facts-title" className="text-lg font-semibold">
        {t('animal.record')}
      </h2>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {animal.sex === 'FEMALE' && auth.can('liv.breeding.read') ? (
        <Link to={`/breeding?damId=${animal.id}`} className="w-fit text-accent-text underline">
          {t('animal.breedingRecords')}
        </Link>
      ) : null}
    </section>
  );
}
