import { CircleCheck, Clock, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  QueryBoundary,
  Skeleton,
  StatusBadge,
  formatDateTime,
} from '@hakorem/ui';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { useStateLabels } from '../lib/states';

type Outcome = components['schemas']['AuditIntegrity']['outcome'];

const OUTCOME = {
  SUCCESS: { tone: 'good', icon: CircleCheck },
  DRIFT: { tone: 'warning', icon: Clock },
  FAILED: { tone: 'critical', icon: ShieldAlert },
} as const satisfies Record<Outcome, unknown>;

/** FR-AUD-003 and 004: whether the hash chain verifies, in words, with the facts behind the answer. */
export function IntegrityPanel() {
  const { t } = useTranslation(['audit', 'common']);
  const integrity = useApiQuery('getAuditIntegrity');
  const labels = useStateLabels({
    loading: t('integrity.loading'),
    emptyTitle: t('integrity.empty'),
    errorTitle: t('integrity.error'),
    deniedTitle: t('integrity.denied'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('integrity.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <QueryBoundary
          query={integrity}
          labels={labels}
          isEmpty={() => false}
          loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-24" />}
        >
          {(check) => (
            <div className="grid gap-3">
              <StatusBadge
                tone={OUTCOME[check.outcome].tone}
                icon={OUTCOME[check.outcome].icon}
                variant={check.outcome === 'FAILED' ? 'strong' : 'subtle'}
                label={t(`integrity.${check.outcome}`)}
              />
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
                <dt className="text-fg-muted">{t('integrity.lastVerified')}</dt>
                <dd>
                  <When instant={check.lastVerifiedAt} />
                </dd>
                <dt className="text-fg-muted">{t('integrity.head')}</dt>
                <dd>{check.chainHeadSeq}</dd>
                <dt className="text-fg-muted">{t('integrity.anchor')}</dt>
                <dd>
                  {check.latestAnchor === null
                    ? t('integrity.anchorNone')
                    : t('integrity.anchorAt', {
                        seq: check.latestAnchor.seq,
                        time: formatDateTime(check.latestAnchor.anchoredAt),
                      })}
                </dd>
                <dt className="text-fg-muted">{t('integrity.unsealed')}</dt>
                <dd>{check.unsealedCount}</dd>
                {check.oldestUnsealedAt === null ? null : (
                  <>
                    <dt className="text-fg-muted">{t('integrity.oldestUnsealed')}</dt>
                    <dd>
                      <When instant={check.oldestUnsealedAt} />
                    </dd>
                  </>
                )}
              </dl>
              {check.problems.length > 0 ? (
                <div role="alert" className="grid gap-1">
                  <p className="font-semibold">{t('integrity.problems')}</p>
                  <ul className="grid gap-1 ps-4">
                    {check.problems.map((problem) => (
                      <li key={problem} className="list-disc">
                        {problem}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}
