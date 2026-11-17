import { Tags } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import { Field, FilterMenu, IconChip, Select, useTableView, type TableColumn } from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { NewBuyerPriceList } from './BuyerPrices';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';

type PriceList = components['schemas']['PriceList'];
type Kind = components['schemas']['PriceListKind'];
const KINDS: readonly Kind[] = ['BASE', 'CHANNEL', 'TIER', 'CUSTOMER'];

/** FR-MDM: price lists per channel and customer tier, each with the version in force and any draft. */
export function PriceListsScreen() {
  const { t } = useTranslation(['catalogue', 'common']);
  const pages = useCursorPages();
  const [kind, setKind] = useState<Kind | 'ALL'>('ALL');
  // People browse and filter this list; nobody acts on a figure here: `working`.
  const lists = useApiQuery(
    'listPriceLists',
    {
      query: {
        ...(kind === 'ALL' ? {} : { kind }),
        ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
      },
    },
    { staleClass: 'working' },
  );
  const labels = useStateLabels({
    loading: t('priceLists.loading'),
    emptyTitle: t('priceLists.empty'),
    emptyDescription: t('priceLists.emptyBody'),
    errorTitle: t('priceLists.error'),
    deniedTitle: t('priceLists.denied'),
  });

  const columns: TableColumn<PriceList>[] = [
    {
      id: 'name',
      rowHeader: true,
      head: t('priceLists.columns.name'),
      sortValue: (list) => list.name,
      cell: (list) => (
        <span className="flex items-center gap-3">
          <IconChip icon={Tags} tone="clay" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/price-lists/${list.id}`} className="text-accent-text hover:underline">
              {list.name}
            </Link>
            <code className="text-control-sm font-normal text-fg-muted">{list.code}</code>
          </span>
        </span>
      ),
    },
    {
      id: 'kind',
      head: t('priceLists.columns.kind'),
      sortValue: (list) => t(`kind.${list.kind}`),
      cell: (list) => t(`kind.${list.kind}`),
    },
    {
      id: 'applies',
      head: t('priceLists.columns.applies'),
      cell: (list) => <AppliesTo list={list} />,
    },
    {
      id: 'active',
      head: t('priceLists.columns.active'),
      // ISO instants sort as text; a list with nothing in force goes last.
      sortValue: (list) => list.activeVersion?.validFrom,
      cell: (list) =>
        list.activeVersion === null ? (
          t('priceLists.noActive')
        ) : (
          <span>
            {t('priceLists.versionNo', { number: list.activeVersion.versionNo })} ·{' '}
            {t('priceLists.since')} <When instant={list.activeVersion.validFrom} />
          </span>
        ),
    },
    {
      id: 'draft',
      head: t('priceLists.columns.draft'),
      cell: (list) =>
        list.draftVersionId === null ? (
          t('priceLists.noDraft')
        ) : (
          <Link
            to={`/price-list-versions/${list.draftVersionId}`}
            className="text-accent-text underline"
            aria-label={t('priceLists.previewDraftOf', { name: list.name })}
          >
            {t('priceLists.previewDraft')}
          </Link>
        ),
    },
  ];
  const view = useTableView(columns);

  return (
    <section aria-labelledby="price-lists-title" className="grid gap-4">
      <PageHeader title={t('priceLists.title')} titleId="price-lists-title" />
      <NewBuyerPriceList />
      <p className="text-fg-muted">{t('priceLists.intro')}</p>
      <TableCard
        view={view}
        query={lists}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(list) => list.id}
        tableLabel={t('priceLists.table')}
        exportName={t('priceLists.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('priceLists.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={kind === 'ALL' ? 0 : 1}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setKind('ALL');
                pages.reset();
              },
            }}
          >
            <Field label={t('priceLists.filterKind')}>
              <Select
                value={kind}
                onValueChange={(value) => {
                  setKind(KINDS.find((k) => k === value) ?? 'ALL');
                  pages.reset();
                }}
                options={[
                  { value: 'ALL', label: t('priceLists.allKinds') },
                  ...KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) })),
                ]}
              />
            </Field>
          </FilterMenu>
        }
      />
    </section>
  );
}

/** Which sales a list applies to: its channel, tier and branch, or everything for the base list. */
export function AppliesTo({ list }: { list: PriceList }) {
  const { t } = useTranslation('catalogue');
  const parts = [
    list.channel === null ? null : t(`channel.${list.channel}`),
    list.customerTier === null ? null : list.customerTier.name,
    list.branch === null ? null : list.branch.name,
  ].filter((part): part is string => part !== null);
  return <>{parts.length === 0 ? t('priceLists.everywhere') : parts.join(' · ')}</>;
}
