import { CircleCheck, CircleSlash, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Field,
  Pagination,
  QueryBoundary,
  Select,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
  formatDateTime,
  Alert,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { useIntentKey } from '../lib/queries';
import { ReasonDialog } from '../lib/ReasonDialog';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { When } from './presentation';

type SessionRecord = components['schemas']['SessionRecord'];
const COLUMNS = 7;
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

  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('sessions.columns.person')}</TableHead>
        <TableHead>{t('sessions.columns.device')}</TableHead>
        <TableHead>{t('sessions.columns.address')}</TableHead>
        <TableHead>{t('sessions.columns.started')}</TableHead>
        <TableHead>{t('sessions.columns.lastSeen')}</TableHead>
        <TableHead>{t('sessions.columns.state')}</TableHead>
        <TableHead>
          <span className="sr-only">{t('sessions.revokeShort')}</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <section aria-labelledby="sessions-title" className="grid gap-4">
      <PageHeader title={t('sessions.title')} titleId="sessions-title" />
      <p className="text-fg-muted">
        {t('sessions.intro')} {t('common:time.zone')}
      </p>
      <div className="max-w-xs">
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
      </div>
      {done !== null ? <Alert severity={'good'} title={done} /> : null}
      <QueryBoundary
        query={sessions}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('sessions.table')}>
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
            <TableContainer aria-label={t('sessions.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((session) => (
                    <TableRow key={session.id} selected={session.current}>
                      <TableRowHeader>{session.principal.displayName}</TableRowHeader>
                      <TableCell label={t('sessions.columns.device')}>
                        <span className="grid">
                          <span>{device(session)}</span>
                          {session.userAgent === null ? null : (
                            <span className="text-control-sm break-all text-fg-muted">
                              {session.userAgent}
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell label={t('sessions.columns.address')}>
                        {session.ipAddress ?? '–'}
                      </TableCell>
                      <TableCell label={t('sessions.columns.started')}>
                        <When instant={session.createdAt} />
                      </TableCell>
                      <TableCell label={t('sessions.columns.lastSeen')}>
                        <When instant={session.lastSeenAt} />
                      </TableCell>
                      <TableCell label={t('sessions.columns.state')}>
                        <span className="flex flex-wrap gap-1">
                          {session.current ? (
                            <StatusBadge
                              tone="info"
                              icon={MonitorSmartphone}
                              label={t('sessions.current')}
                            />
                          ) : null}
                          {session.revokedAt === null ? (
                            <StatusBadge
                              tone="good"
                              icon={CircleCheck}
                              label={t('sessions.live')}
                            />
                          ) : (
                            <StatusBadge
                              tone="warning"
                              icon={CircleSlash}
                              label={t('sessions.ended', {
                                time: formatDateTime(session.revokedAt),
                              })}
                            />
                          )}
                        </span>
                      </TableCell>
                      <TableCell label={t('sessions.revokeShort')}>
                        {canRevoke && session.revokedAt === null ? (
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
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('sessions.pages')}
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
