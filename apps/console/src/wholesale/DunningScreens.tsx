import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ApiError, components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  DatePicker,
  Field,
  Input,
  MoneyDisplay,
  MutationFailure,
  NumberInput,
  QueryBoundary,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  formatDateTime,
  useTableView,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { newRecordId } from '../lib/clientId';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { dayStart } from '../lib/dateRange';
import { documentHref } from '../lib/documents';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { CustomerPicker } from './CustomerPicker';

type S = components['schemas'];
type Level = S['DunningLevel'];
type Notice = S['DunningNotice'];
type Channel = Level['channels'][number];

/** The channels a reminder level may name (`DunningLevelInput.channels`), in the contract's order. */
export const DUNNING_CHANNELS = ['SMS', 'EMAIL', 'WHATSAPP'] as const satisfies readonly Channel[];

/** The Select's value for "no second or third channel": Radix gives an empty value no option. */
const NONE = 'NONE';

const isChannel = (value: string): value is Channel =>
  (DUNNING_CHANNELS as readonly string[]).includes(value);

/** A level's channels in the order they are tried, in words: "SMS, Email". A channel the build does not know keeps its code. */
function useChannelWords(): (channels: readonly string[]) => string {
  const { t } = useTranslation('wholesale');
  return (channels) => channels.map((c) => (isChannel(c) ? t(`channel.${c}`) : c)).join(', ');
}

/** A whole number of days overdue, as typed: 1 to 365 (`replaceDunningLevels`). */
const DAYS = /^[1-9]\d{0,2}$/;
const toDays = (typed: string): number | null =>
  DAYS.test(typed.trim()) && Number(typed.trim()) <= 365 ? Number(typed.trim()) : null;

/**
 * The reminder levels (dunning, FR-WHL-011): at how many days overdue each level is sent, by which
 * channels in the order they are tried, and the template it sends. Everyone with `whl.dunning.read`
 * reads them; an Owner or Manager (`whl.dunning.manage`) replaces the whole set at once. No levels means
 * reminders are off, and the screen says so in words.
 */
export function DunningLevelsScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const auth = useAuth();
  const canManage = auth.can('whl.dunning.manage');
  // The whole set, read whole because it is replaced whole. It is short: each level is sent at more days
  // overdue than the last, from 1 to 365.
  const levels = useApiAllPages('listDunningLevels', { query: { limit: 100 } });
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState<'saved' | 'savedOff' | null>(null);
  const labels = useStateLabels({
    loading: t('dunning.loading'),
    emptyTitle: t('dunning.empty'),
    emptyDescription: t('dunning.emptyBody'),
    errorTitle: t('dunning.error'),
    deniedTitle: t('dunning.denied'),
  });
  const edit = () => {
    setOutcome(null);
    setEditing(true);
  };
  return (
    <section aria-labelledby="dunning-title" className="grid gap-4">
      <PageHeader
        title={t('dunning.title')}
        titleId="dunning-title"
        description={t('dunning.intro')}
        actions={
          <Button asChild variant="secondary">
            <Link to="/dunning-notices">{t('dunning.openSent')}</Link>
          </Button>
        }
      />
      {outcome === null ? null : <Alert severity="good" title={t(`dunning.${outcome}`)} />}
      {canManage ? null : <p className="text-fg-muted">{t('dunning.readOnly')}</p>}
      <QueryBoundary
        query={levels}
        labels={labels}
        isEmpty={(all) => !editing && all.items.length === 0}
        emptyAction={canManage ? <Button onClick={edit}>{t('dunning.setUp')}</Button> : undefined}
        loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-48" />}
      >
        {(all) =>
          editing && canManage ? (
            <LevelsEditor
              current={all.items}
              onCancel={() => setEditing(false)}
              onSaved={(saved) => {
                setEditing(false);
                setOutcome(saved.length === 0 ? 'savedOff' : 'saved');
              }}
            />
          ) : (
            <div className="grid gap-3">
              <LevelsTable levels={all.items} />
              {canManage ? (
                <div>
                  <Button variant="secondary" onClick={edit}>
                    {t('dunning.change')}
                  </Button>
                </div>
              ) : null}
            </div>
          )
        }
      </QueryBoundary>
    </section>
  );
}

/** The levels as the API answers them, lowest first. */
function LevelsTable({ levels }: { levels: readonly Level[] }) {
  const { t } = useTranslation('wholesale');
  const channelWords = useChannelWords();
  return (
    <TableContainer aria-label={t('dunning.table')}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('dunning.columns.level')}</TableHead>
            <TableHead>{t('dunning.columns.daysOverdue')}</TableHead>
            <TableHead>{t('dunning.columns.channels')}</TableHead>
            <TableHead>{t('dunning.columns.template')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {levels.map((level) => (
            <TableRow key={level.level}>
              <TableRowHeader>{t('dunning.level', { number: level.level })}</TableRowHeader>
              <TableCell label={t('dunning.columns.daysOverdue')}>
                {t('dunning.daysOverdueValue', { count: level.daysOverdue })}
              </TableCell>
              <TableCell label={t('dunning.columns.channels')}>
                {channelWords(level.channels)}
              </TableCell>
              <TableCell label={t('dunning.columns.template')}>
                <code>{level.templateCode}</code>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** One level as typed. Its number is its place in the list, so the levels are always 1, 2, 3 in turn. */
interface DraftLevel {
  key: string;
  days: string;
  /** First, second and third channel; an empty string is none. */
  channels: [string, string, string];
  templateCode: string;
}

function draftOf(level: Level): DraftLevel {
  return {
    key: newRecordId(),
    days: String(level.daysOverdue),
    channels: [level.channels[0] ?? '', level.channels[1] ?? '', level.channels[2] ?? ''],
    templateCode: level.templateCode,
  };
}

function blankLevel(): DraftLevel {
  return { key: newRecordId(), days: '', channels: ['', '', ''], templateCode: '' };
}

type Problem = 'days' | 'channel' | 'template';

/** What is wrong with a level as typed. Whether the days rise and no channel repeats is the server's to say. */
function problemsOf(level: DraftLevel): Problem[] {
  const problems: Problem[] = [];
  if (toDays(level.days) === null) problems.push('days');
  if (level.channels[0] === '') problems.push('channel');
  if (level.templateCode.trim() === '') problems.push('template');
  return problems;
}

/** The whole set as `replaceDunningLevels` takes it, numbered in order. */
function toPolicy(levels: readonly DraftLevel[]): S['DunningPolicyReplace'] {
  return {
    levels: levels.map((level, index) => ({
      level: index + 1,
      daysOverdue: toDays(level.days) ?? 0,
      channels: level.channels.filter(isChannel),
      templateCode: level.templateCode.trim(),
    })),
  };
}

/** Which level each refused detail points at (`/levels/1/daysOverdue`), and the field it names. */
function refusedFields(error: ApiError | null): Map<number, Problem> {
  const refused = new Map<number, Problem>();
  for (const detail of error?.details ?? []) {
    const match = /^\/levels\/(\d+)(?:\/(\w+))?/.exec(detail.field ?? '');
    if (match === null) continue;
    const field = match[2];
    refused.set(
      Number(match[1]),
      field === 'channels' ? 'channel' : field === 'templateCode' ? 'template' : 'days',
    );
  }
  return refused;
}

/**
 * The whole set of levels, edited together and sent at once: add, remove, the days overdue, one to three
 * channels in the order they are tried (each once), and the template. Saving is confirmed first, and an
 * empty set says before saving that reminders turn off. A refusal stays on the form, in words, and marks
 * the level it names.
 */
function LevelsEditor({
  current,
  onCancel,
  onSaved,
}: {
  current: readonly Level[];
  onCancel: () => void;
  onSaved: (levels: readonly Level[]) => void;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const keyFor = useIntentKey();
  const channelWords = useChannelWords();
  const [draft, setDraft] = useState<DraftLevel[]>(() => current.map(draftOf));
  const [checked, setChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const replace = useApiMutation('replaceDunningLevels');
  const policy = toPolicy(draft);
  const unchanged = JSON.stringify(policy) === JSON.stringify(toPolicy(current.map(draftOf)));
  const guard = useLeaveGuard(!unchanged);
  const refused = refusedFields(replace.error);
  const failure = useStateLabels({
    loading: t('dunning.saving'),
    emptyTitle: t('dunning.notSaved'),
    errorTitle: t('dunning.notSaved'),
    deniedTitle: t('dunning.notSaved'),
  });
  const set = (key: string, next: Partial<DraftLevel>) =>
    setDraft((now) => now.map((level) => (level.key === key ? { ...level, ...next } : level)));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (draft.some((level) => problemsOf(level).length > 0)) return;
    setConfirming(true);
  };
  const confirm = () => {
    replace
      .mutateAsync({ body: policy }, { idempotencyKey: keyFor(policy) })
      .then((answer) => onSaved(answer.data))
      // The refusal stays on the form, in words, after the confirmation closes.
      .catch(() => setConfirming(false));
  };
  return (
    <Card>
      <CardBody>
        <form
          className="grid gap-4"
          onSubmit={submit}
          noValidate
          aria-label={t('dunning.editTitle')}
        >
          <h2 className="text-heading-sm font-semibold">{t('dunning.editTitle')}</h2>
          <p className="text-control-sm text-fg-muted">{t('dunning.editHint')}</p>
          <MutationFailure error={replace.error} labels={failure} />
          {draft.length === 0 ? <Alert severity="warning" title={t('dunning.offWarning')} /> : null}
          {draft.map((level, index) => (
            <LevelCard
              key={level.key}
              level={level}
              number={index + 1}
              problems={checked ? problemsOf(level) : []}
              refused={refused.get(index)}
              onChange={(next) => set(level.key, next)}
              onRemove={() => setDraft((now) => now.filter((other) => other.key !== level.key))}
            />
          ))}
          <div>
            <Button variant="secondary" onClick={() => setDraft((now) => [...now, blankLevel()])}>
              <Plus aria-hidden="true" />
              {t('dunning.add')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={replace.isPending} loadingLabel={t('dunning.saving')}>
              {t('dunning.save')}
            </Button>
            <Button variant="secondary" onClick={onCancel}>
              {t('dunning.discard')}
            </Button>
          </div>
        </form>
      </CardBody>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          policy.levels.length === 0 ? t('dunning.confirmOffTitle') : t('dunning.confirmTitle')
        }
        body={
          policy.levels.length === 0
            ? t('dunning.confirmOffBody')
            : t('dunning.confirmBody', { count: policy.levels.length })
        }
        confirmLabel={policy.levels.length === 0 ? t('dunning.turnOff') : t('dunning.save')}
        pendingLabel={t('dunning.saving')}
        pending={replace.isPending}
        onConfirm={confirm}
        error={null}
        failedTitle={t('dunning.notSaved')}
        destructive={policy.levels.length === 0}
      >
        {policy.levels.length === 0 ? null : (
          <ul className="grid gap-1">
            {policy.levels.map((level) => (
              <li key={level.level}>
                {t('dunning.confirmLevel', {
                  number: level.level,
                  days: t('dunning.daysOverdueValue', { count: level.daysOverdue }),
                  channels: channelWords(level.channels),
                  template: level.templateCode,
                })}
              </li>
            ))}
          </ul>
        )}
      </ConfirmDialog>
      <LeaveGuardDialog guard={guard} />
    </Card>
  );
}

function LevelCard({
  level,
  number,
  problems,
  refused,
  onChange,
  onRemove,
}: {
  level: DraftLevel;
  number: number;
  problems: Problem[];
  /** The field of this level the server's refusal names, if any. */
  refused: Problem | undefined;
  onChange: (next: Partial<DraftLevel>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const required = t('common:field.required');
  const refusedWords = t('dunning.refused');
  const errorFor = (problem: Problem, words: string) =>
    problems.includes(problem) ? words : refused === problem ? refusedWords : undefined;
  const channelLabels = [t('dunning.channel1'), t('dunning.channel2'), t('dunning.channel3')];
  const setChannel = (index: number, value: string) => {
    const chosen = value === NONE ? '' : value;
    const channels = [...level.channels] as [string, string, string];
    channels[index] = chosen;
    // A channel chosen here is not offered below, and none below may repeat it.
    for (let below = index + 1; below < 3; below += 1) {
      if (chosen === '' || channels[below] === chosen) channels[below] = '';
    }
    onChange({ channels });
  };
  return (
    <Card>
      <CardBody className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{t('dunning.level', { number })}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label={t('dunning.remove', { number })}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
        <Field
          label={t('dunning.daysOverdue')}
          hint={t('dunning.daysOverdueHint')}
          required
          requiredLabel={required}
          error={errorFor('days', t('dunning.daysWrong'))}
        >
          <NumberInput value={level.days} onValueChange={(days) => onChange({ days })} />
        </Field>
        <p className="text-control-sm text-fg-muted">{t('dunning.channelsHint')}</p>
        {channelLabels.map((label, index) => {
          const above = level.channels.slice(0, index);
          const options = DUNNING_CHANNELS.filter((c) => !above.includes(c)).map((c) => ({
            value: c,
            label: t(`channel.${c}`),
          }));
          const select = (
            <Select
              value={level.channels[index] === '' && index > 0 ? NONE : level.channels[index]}
              onValueChange={(value) => setChannel(index, value)}
              placeholder={t('dunning.chooseChannel')}
              disabled={index > 0 && level.channels[index - 1] === ''}
              options={
                index === 0
                  ? options
                  : [{ value: NONE, label: t('dunning.channelNone') }, ...options]
              }
            />
          );
          return index === 0 ? (
            <Field
              key={label}
              label={label}
              required
              requiredLabel={required}
              error={errorFor('channel', t('dunning.channelMissing'))}
            >
              {select}
            </Field>
          ) : (
            <Field key={label} label={label}>
              {select}
            </Field>
          );
        })}
        <Field
          label={t('dunning.template')}
          hint={t('dunning.templateHint')}
          required
          requiredLabel={required}
          error={errorFor('template', t('dunning.templateMissing'))}
        >
          <Input
            value={level.templateCode}
            maxLength={100}
            autoCapitalize="characters"
            onChange={(event) => onChange({ templateCode: event.target.value })}
          />
        </Field>
      </CardBody>
    </Card>
  );
}

/** The columns of a list of reminders sent; the account's own list leaves out the customer. */
function useNoticeView(withCustomer: boolean) {
  const { t } = useTranslation(['wholesale', 'common']);
  const channelWords = useChannelWords();
  const document = (n: Notice) => {
    const href = documentHref(n.billingDocument);
    const name = n.billingDocument.number ?? t('reminders.unnumbered');
    const kind =
      n.billingDocument.docType === 'INVOICE' || n.billingDocument.docType === 'DEBIT_NOTE'
        ? t(`reminders.docType.${n.billingDocument.docType}`)
        : n.billingDocument.docType;
    return (
      <span className="grid">
        {href === undefined ? (
          name
        ) : (
          <Link to={href} className="text-accent-text underline">
            {name}
          </Link>
        )}
        <span className="text-control-sm text-fg-muted">{kind}</span>
      </span>
    );
  };
  return useTableView<Notice>([
    ...(withCustomer
      ? [
          {
            id: 'customer',
            rowHeader: true,
            head: t('reminders.columns.customer'),
            sortValue: (n: Notice) => n.customer.name,
            cell: (n: Notice) => (
              <Link
                to={`/business-accounts/${n.customer.id}`}
                className="text-accent-text underline"
              >
                {n.customer.name}
              </Link>
            ),
          },
        ]
      : []),
    {
      id: 'document',
      rowHeader: !withCustomer,
      head: t('reminders.columns.document'),
      sortValue: (n) => n.billingDocument.number ?? '',
      cell: document,
    },
    {
      id: 'level',
      head: t('reminders.columns.level'),
      sortValue: (n) => n.level,
      cell: (n) => t('dunning.level', { number: n.level }),
    },
    {
      id: 'daysPastDue',
      head: t('reminders.columns.daysPastDue'),
      numeric: true,
      sortValue: (n) => n.daysPastDue,
      cell: (n) => t('credit.days', { count: n.daysPastDue }),
    },
    {
      id: 'outstanding',
      head: t('reminders.columns.outstanding'),
      numeric: true,
      // The API's integer pesewas, compared, never added.
      sortValue: (n) => n.outstandingPesewas,
      cell: (n) => <MoneyDisplay pesewas={n.outstandingPesewas} />,
    },
    {
      id: 'channels',
      head: t('reminders.columns.channels'),
      sortValue: (n) => n.channels.join(),
      cell: (n) => channelWords(n.channels),
    },
    {
      id: 'sentAt',
      head: t('reminders.columns.sentAt'),
      sortValue: (n) => n.sentAt,
      cell: (n) => formatDateTime(n.sentAt),
    },
  ]);
}

/**
 * The reminders sent (`listDunningNotices`), newest first as the API answers them: who, which invoice or
 * debit note, the level, how late it was, what was outstanding then, the channels and when it was queued.
 * Filtered by customer and by the day it was queued; paged by cursor.
 */
export function DunningNoticesScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const pages = useCursorPages();
  const [customer, setCustomer] = useState<S['Customer'] | null>(null);
  const [from, setFrom] = useState('');
  const notices = useApiQuery('listDunningNotices', {
    query: {
      ...(customer === null ? {} : { customerId: customer.id }),
      ...(from === '' ? {} : { from: dayStart(from) }),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('reminders.loading'),
    emptyTitle: t('reminders.empty'),
    emptyDescription: t('reminders.emptyBody'),
    errorTitle: t('reminders.error'),
    deniedTitle: t('reminders.denied'),
  });
  const view = useNoticeView(true);
  return (
    <section aria-labelledby="reminders-title" className="grid gap-4">
      <PageHeader
        title={t('reminders.title')}
        titleId="reminders-title"
        description={t('reminders.intro')}
        actions={
          <Button asChild variant="secondary">
            <Link to="/dunning-policy">{t('reminders.openLevels')}</Link>
          </Button>
        }
      />
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <CustomerPicker
            label={t('reminders.customer')}
            hint={t('reminders.customerHint')}
            value={customer}
            onChange={(next) => {
              setCustomer(next);
              pages.reset();
            }}
          />
          <Field label={t('reminders.from')} hint={t('reminders.fromHint')}>
            <DatePicker
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                pages.reset();
              }}
            />
          </Field>
        </CardBody>
      </Card>
      <TableCard
        view={view}
        query={notices}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('reminders.title')}
        exportName={t('reminders.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('reminders.pages') }}
      />
    </section>
  );
}

/** One buyer's reminders, on their wholesale account, read-only, for holders of `whl.dunning.read`. */
export function CustomerReminders({ customerId }: { customerId: string }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const auth = useAuth();
  const canRead = auth.can('whl.dunning.read');
  const pages = useCursorPages();
  const notices = useApiQuery(
    'listDunningNotices',
    { query: { customerId, ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }) } },
    { enabled: canRead },
  );
  const labels = useStateLabels({
    loading: t('reminders.loading'),
    emptyTitle: t('reminders.accountEmpty'),
    errorTitle: t('reminders.error'),
    deniedTitle: t('reminders.denied'),
  });
  const view = useNoticeView(false);
  return (
    <section aria-labelledby="customer-reminders-title" className="grid gap-2">
      <h2 id="customer-reminders-title" className="text-heading-sm font-semibold">
        {t('reminders.accountTitle')}
      </h2>
      {canRead ? (
        <>
          <TableCard
            view={view}
            query={notices}
            labels={labels}
            rows={(page) => page.data}
            rowKey={(row) => row.id}
            tableLabel={t('reminders.accountTable')}
            exportName={t('reminders.accountTitle')}
            pages={{ state: pages, info: (page) => page.page, label: t('reminders.pages') }}
          />
          <Link to="/dunning-policy" className="text-accent-text underline">
            {t('reminders.openLevels')}
          </Link>
        </>
      ) : (
        <QueryBoundary query={notices} labels={labels} denied isEmpty={() => true}>
          {() => null}
        </QueryBoundary>
      )}
    </section>
  );
}
