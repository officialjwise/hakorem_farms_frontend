import { PawPrint } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  AnimalTag,
  FilterMenu,
  IconChip,
  MoneyDisplay,
  NOT_APPLICABLE,
  ToolbarSearch,
  useTableView,
  WeightDisplay,
  type TableColumn,
} from '@hakorem/ui';
import { BranchScopeNote } from '../branch/BranchScopeNote';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { useLocations } from '../stock/locations';
import { useSpeciesOptions, type Animal } from './animals';
import { AnimalStatusBadge, SellableBadge } from './presentation';

const STATUSES = ['ALIVE', 'SOLD', 'SLAUGHTERED', 'DEAD', 'CULLED'] as const;
const PURPOSES = ['GROWING', 'BREEDING'] as const;

/**
 * FR-LIV, the animal register: every tagged animal, where it is, what it last weighed, what it has cost so
 * far and whether it can be sold now, searched by tag and filtered with the API's own parameters. An animal
 * enters the register only through a goods receipt, opening stock or a birth (1.24.0), so there is no
 * "new animal" here: the empty state points to receiving.
 */
export function AnimalsScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const pages = useCursorPages();
  const locations = useLocations();
  const species = useSpeciesOptions();
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('ALIVE');
  const [speciesId, setSpeciesId] = useState(ANY);
  const [locationId, setLocationId] = useState(ANY);
  const [purpose, setPurpose] = useState(ANY);
  const [sellable, setSellable] = useState(ANY);
  const animals = useApiQuery('listAnimals', {
    query: {
      ...(q === '' ? {} : { q }),
      ...(status === ANY ? {} : { status: STATUSES.find((s) => s === status) }),
      ...param('speciesId', speciesId),
      ...param('locationId', locationId),
      ...(purpose === ANY ? {} : { purpose: PURPOSES.find((p) => p === purpose) }),
      ...(sellable === ANY ? {} : { sellable: sellable === 'YES' }),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('animals.loading'),
    emptyTitle: q === '' ? t('animals.empty') : t('animals.noMatch'),
    emptyDescription: q === '' ? t('animals.emptyBody') : t('animals.noMatchBody'),
    errorTitle: t('animals.error'),
    deniedTitle: t('animals.denied'),
  });
  const columns: TableColumn<Animal>[] = [
    {
      id: 'animal',
      rowHeader: true,
      head: t('animals.columns.animal'),
      sortValue: (animal) => animal.tagNo,
      cell: (animal) => (
        <span className="flex items-center gap-3">
          <IconChip icon={PawPrint} tone="sand" size="sm" />
          <span className="grid min-w-0 gap-0.5">
            <Link
              to={`/animals/${animal.id}`}
              className="w-fit text-accent-text underline"
              aria-label={t('animals.open', { tag: animal.tagNo, species: animal.species.name })}
            >
              <AnimalTag tagNo={animal.tagNo} speciesLabel={animal.species.name} />
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">
              {[animal.breed, t(`sex.${animal.sex}`), t(`purpose.${animal.purpose}`)]
                .filter((part) => part !== null)
                .join(' · ')}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('animals.columns.status'),
      sortValue: (animal) => animal.status,
      cell: (animal) => (
        <span className="flex flex-wrap gap-1">
          <AnimalStatusBadge status={animal.status} />
          <SellableBadge animal={animal} />
        </span>
      ),
    },
    {
      id: 'location',
      head: t('animals.columns.location'),
      sortValue: (animal) => animal.currentLocation?.name ?? '',
      cell: (animal) => animal.currentLocation?.name ?? t('animals.noLocation'),
    },
    {
      id: 'weight',
      head: t('animals.columns.weight'),
      numeric: true,
      // Three-place strings from the API, compared as text of equal shape only for this page's order.
      sortValue: (animal) => animal.lastWeightKg?.padStart(12, '0') ?? '',
      cell: (animal) =>
        animal.lastWeightKg === null ? (
          NOT_APPLICABLE
        ) : (
          <span className="grid justify-items-end">
            <WeightDisplay kilograms={animal.lastWeightKg} />
            {animal.lastWeighedAt === null ? null : (
              <span className="text-control-sm text-fg-muted">
                <When instant={animal.lastWeighedAt} />
              </span>
            )}
          </span>
        ),
    },
    {
      id: 'cost',
      head: t('animals.columns.cost'),
      numeric: true,
      sortValue: (animal) => animal.accumulatedCostPesewas,
      cell: (animal) => <MoneyDisplay pesewas={animal.accumulatedCostPesewas} />,
    },
  ];
  const view = useTableView(columns);
  const reset = () => pages.reset();
  return (
    <section aria-labelledby="animals-title" className="grid gap-4">
      <PageHeader
        title={t('animals.title')}
        titleId="animals-title"
        description={
          <>
            {t('animals.description')} <BranchScopeNote />
          </>
        }
      />
      <TableCard
        view={view}
        query={animals}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(animal) => animal.id}
        tableLabel={t('animals.table')}
        exportName={t('animals.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('animals.pages') }}
        toolbar={
          <>
            <ToolbarSearch
              label={t('animals.searchLabel')}
              placeholder={t('animals.searchPlaceholder')}
              value={typed}
              onValueChange={setTyped}
              onSubmit={(value) => {
                setQ(value.trim());
                reset();
              }}
            />
            <FilterMenu
              label={t('common:table.filter')}
              active={countSet(status, speciesId, locationId, purpose, sellable)}
              reset={{
                label: t('common:table.resetFilters'),
                onReset: () => {
                  setStatus(ANY);
                  setSpeciesId(ANY);
                  setLocationId(ANY);
                  setPurpose(ANY);
                  setSellable(ANY);
                  reset();
                },
              }}
            >
              <FilterSelect
                label={t('filters.status')}
                anyLabel={t('filters.anyStatus')}
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  reset();
                }}
                options={STATUSES.map((value) => ({ value, label: t(`animalStatus.${value}`) }))}
              />
              <FilterSelect
                label={t('filters.species')}
                anyLabel={t('filters.anySpecies')}
                value={speciesId}
                onChange={(value) => {
                  setSpeciesId(value);
                  reset();
                }}
                options={species}
              />
              <FilterSelect
                label={t('filters.location')}
                anyLabel={t('filters.anyLocation')}
                value={locationId}
                onChange={(value) => {
                  setLocationId(value);
                  reset();
                }}
                options={locations.options}
              />
              <FilterSelect
                label={t('filters.purpose')}
                anyLabel={t('filters.anyPurpose')}
                value={purpose}
                onChange={(value) => {
                  setPurpose(value);
                  reset();
                }}
                options={PURPOSES.map((value) => ({ value, label: t(`purpose.${value}`) }))}
              />
              <FilterSelect
                label={t('filters.sellable')}
                anyLabel={t('filters.anySellable')}
                value={sellable}
                onChange={(value) => {
                  setSellable(value);
                  reset();
                }}
                options={[
                  { value: 'YES', label: t('filters.sellableYes') },
                  { value: 'NO', label: t('filters.sellableNo') },
                ]}
              />
            </FilterMenu>
          </>
        }
      />
    </section>
  );
}
