import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Field,
  Pagination,
  QueryBoundary,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
} from '@hakorem/ui';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';

type Kind = components['schemas']['PriceListKind'];
const KINDS: readonly Kind[] = ['BASE', 'CHANNEL', 'TIER', 'CUSTOMER'];
const COLUMNS = 5;

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

  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('priceLists.columns.name')}</TableHead>
        <TableHead>{t('priceLists.columns.kind')}</TableHead>
        <TableHead>{t('priceLists.columns.applies')}</TableHead>
        <TableHead>{t('priceLists.columns.active')}</TableHead>
        <TableHead>{t('priceLists.columns.draft')}</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <section aria-labelledby="price-lists-title" className="grid gap-4">
      <h1 id="price-lists-title" className="text-2xl font-semibold">
        {t('priceLists.title')}
      </h1>
      <p className="text-fg-muted">{t('priceLists.intro')}</p>
      <div className="max-w-xs">
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
      </div>
      <QueryBoundary
        query={lists}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('priceLists.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={COLUMNS} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <div className="grid gap-3">
            <TableContainer aria-label={t('priceLists.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((list) => (
                    <TableRow key={list.id}>
                      <TableRowHeader>
                        <Link to={`/price-lists/${list.id}`} className="text-accent-text underline">
                          {list.name}
                        </Link>
                        <span className="block text-control-sm text-fg-muted">
                          <code>{list.code}</code>
                        </span>
                      </TableRowHeader>
                      <TableCell label={t('priceLists.columns.kind')}>
                        {t(`kind.${list.kind}`)}
                      </TableCell>
                      <TableCell label={t('priceLists.columns.applies')}>
                        <AppliesTo list={list} />
                      </TableCell>
                      <TableCell label={t('priceLists.columns.active')}>
                        {list.activeVersion === null ? (
                          t('priceLists.noActive')
                        ) : (
                          <span>
                            {t('priceLists.versionNo', { number: list.activeVersion.versionNo })} ·{' '}
                            {t('priceLists.since')} <When instant={list.activeVersion.validFrom} />
                          </span>
                        )}
                      </TableCell>
                      <TableCell label={t('priceLists.columns.draft')}>
                        {list.draftVersionId === null ? (
                          t('priceLists.noDraft')
                        ) : (
                          <Link
                            to={`/price-list-versions/${list.draftVersionId}`}
                            className="text-accent-text underline"
                            aria-label={t('priceLists.previewDraftOf', { name: list.name })}
                          >
                            {t('priceLists.previewDraft')}
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('priceLists.pages')}
                hasPrevious={pages.hasPrevious}
                hasNext={page.page.hasMore && page.page.nextCursor !== null}
                onPrevious={pages.previous}
                onNext={() => {
                  if (page.page.nextCursor !== null) pages.next(page.page.nextCursor);
                }}
                previousLabel={t('common:pagination.previous')}
                nextLabel={t('common:pagination.next')}
                summary={t('common:pagination.page', { page: pages.page })}
              />
            ) : null}
          </div>
        )}
      </QueryBoundary>
    </section>
  );
}

/** Which sales a list applies to: its channel, tier and branch, or everything for the base list. */
export function AppliesTo({ list }: { list: components['schemas']['PriceList'] }) {
  const { t } = useTranslation('catalogue');
  const parts = [
    list.channel === null ? null : t(`channel.${list.channel}`),
    list.customerTier === null ? null : list.customerTier.name,
    list.branch === null ? null : list.branch.name,
  ].filter((part): part is string => part !== null);
  return <>{parts.length === 0 ? t('priceLists.everywhere') : parts.join(' · ')}</>;
}
