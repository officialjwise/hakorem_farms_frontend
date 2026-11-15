import { MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Field,
  FilterMenu,
  IconChip,
  Select,
  StatusBadge,
  formatDateTime,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { When } from './presentation';

type SessionRecord = components['schemas']['SessionRecord'];
type Show = 'active' | 'all';

/**
 * FR-IAM-014 and 015: the devices signed in, and revoking one. Without `iam.session.read.any` the server
 * answers with the caller's own sessions only; the screen shows what it is given. Revoking sets
 * `revokedAt` and deletes nothing, so an ended session stays in "All".
 */
export function SessionsScreen() {
  const { t } = useTranslation(['iam', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [show, setShow] = useState<Show>('active');
  const [revoking, setRevoking] = useState<SessionRecord | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const revoke = useApiMutation('revokeSession');
  const keyFor = useIntentKey();
  const sessions = useApiQuery('listSessions', {
    query: {
      ...(show === 'active' ? { active: true } : {}),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('sessions.loading'),
    emptyTitle: t('sessions.empty'),
    emptyDescription: t('sessions.emptyBody'),
    errorTitle: t('sessions.error'),
    deniedTitle: t('sessions.denied'),
  });
  const canRevoke = auth.can('iam.session.revoke');
  const device = (session: SessionRecord) => session.deviceLabel ?? t('sessions.unknownDevice');

  const columns: TableColumn<SessionRecord>[] = [
    {
      id: 'device',
      rowHeader: true,
      head: t('sessions.columns.device'),
      sortValue: (session) => session.deviceLabel,
      cell: (session) => (
        <span className="flex items-center gap-3">
          <IconChip icon={MonitorSmartphone} tone="info" size="sm" />
          <span className="grid min-w-0">
            <span>{device(session)}</span>
            {session.userAgent === null ? null : (
              <span className="text-control-sm font-normal break-all text-fg-muted">
                {session.userAgent}
              </span>
            )}
          </span>
        </span>
      ),
    },
    {
      id: 'person',
      head: t('sessions.columns.person'),
      sortValue: (session) => session.principal.displayName,
      cell: (session) => session.principal.displayName,
    },
    {
      id: 'address',
      head: t('sessions.columns.address'),
      sortValue: (session) => session.ipAddress,
      cell: (session) => session.ipAddress ?? '–',
    },
    {
      id: 'started',
      head: t('sessions.columns.started'),
      // ISO instants sort as text.
      sortValue: (session) => session.createdAt,
      cell: (session) => <When instant={session.createdAt} />,
    },
    {
      id: 'lastSeen',
      head: t('sessions.columns.lastSeen'),
      sortValue: (session) => session.lastSeenAt,
      cell: (session) => <When instant={session.lastSeenAt} />,
    },
    {
      id: 'state',
      head: t('sessions.columns.state'),
      // Signed in first, then ended.
      sortValue: (session) => (session.revokedAt === null ? 0 : 1),
      cell: (session) => (
        <span className="flex flex-wrap gap-1">
          {session.current ? <StatusBadge tone="info" label={t('sessions.current')} /> : null}
          {session.revokedAt === null ? (
            <StatusBadge tone="good" label={t('sessions.live')} />
          ) : (
            <StatusBadge
              tone="warning"
              label={t('sessions.ended', { time: formatDateTime(session.revokedAt) })}
            />
          )}
        </span>
      ),
    },
    {
      id: 'revoke',
      head: t('sessions.revokeShort'),
      cell: (session) =>
        canRevoke && session.revokedAt === null ? (
          <Button
            variant="secondary"
            size="sm"
            aria-label={t('sessions.revoke', { device: device(session) })}
            onClick={() => {
              revoke.reset();
              setDone(null);
              setRevoking(session);
            }}
          >
            {t('sessions.revokeShort')}
          </Button>
        ) : null,
    },
  ];
  const view = useTableView(columns);

  return (
    <section aria-labelledby="sessions-title" className="grid gap-4">
      <PageHeader title={t('sessions.title')} titleId="sessions-title" />
      <p className="text-fg-muted">
        {t('sessions.intro')} {t('common:time.zone')}
      </p>
      {done !== null ? <Alert severity={'good'} title={done} /> : null}
      <TableCard
        view={view}
        query={sessions}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(session) => session.id}
        rowProps={(session) => ({ selected: session.current })}
        tableLabel={t('sessions.table')}
        exportName={t('sessions.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('sessions.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={show === 'active' ? 0 : 1}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setShow('active');
                pages.reset();
              },
            }}
          >
            <Field label={t('sessions.filter')}>
              <Select
                value={show}
                onValueChange={(value) => {
                  setShow(value === 'all' ? 'all' : 'active');
                  pages.reset();
                }}
                options={[
                  { value: 'active', label: t('sessions.active') },
                  { value: 'all', label: t('sessions.all') },
                ]}
              />
            </Field>
          </FilterMenu>
        }
      />
      {revoking !== null ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setRevoking(null);
          }}
          title={t('sessions.revokeTitle')}
          body={t('sessions.revokeBody', {
            name: revoking.principal.displayName,
            device: device(revoking),
          })}
          warning={
            revoking.current ? <p className="font-semibold">{t('sessions.revokeCurrent')}</p> : null
          }
          submitLabel={t('sessions.revokeSubmit')}
          destructive
          error={shownFailure(revoke.error)}
          failureLabels={{ ...labels, errorTitle: t('sessions.failed') }}
          onConfirm={async (reason) => {
            const input = { path: { id: revoking.id }, body: { reason } };
            await revoke.mutateAsync(input, { idempotencyKey: keyFor(input) });
            const own = revoking.current;
            setRevoking(null);
            setDone(t('sessions.revoked'));
            // This device's own session: it is over, and the screen says so in words (never a silent redirect).
            if (own) auth.expire();
          }}
        />
      ) : null}
    </section>
  );
}
