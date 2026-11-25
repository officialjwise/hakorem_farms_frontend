import {
  Building2,
  MonitorCog,
  MonitorSmartphone,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  IconChip,
  QueryBoundary,
  Radio,
  RadioGroup,
  Skeleton,
  StatusBadge,
  ToolbarSearch,
  cn,
  formatMoney,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useBranchScope } from '../branch/branchScope';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { THEMES, sidebarPreference, themePreference, usePreference } from '../lib/preferences';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';

type Setting = components['schemas']['Setting'];

interface SectionLink {
  to: string;
  key: 'display' | 'business' | 'system';
  icon: LucideIcon;
  permission: string | null;
}

const SECTIONS: readonly SectionLink[] = [
  { to: '/settings', key: 'display', icon: MonitorCog, permission: null },
  { to: '/settings/business', key: 'business', icon: Building2, permission: 'aud.setting.read' },
  {
    to: '/settings/system',
    key: 'system',
    icon: SlidersHorizontal,
    permission: 'aud.setting.read',
  },
];

/** Screens of their own that a settings page in the reference would hold: linked, not copied here. */
const ELSEWHERE = [
  { to: '/branches', nav: 'branches', icon: Building2, permission: 'mdm.branch.read' },
  { to: '/users', nav: 'users', icon: Users, permission: 'iam.user.read' },
  { to: '/roles', nav: 'roles', icon: ShieldCheck, permission: 'iam.role.read' },
  { to: '/sessions', nav: 'sessions', icon: MonitorSmartphone, permission: 'iam.session.read' },
] as const;

/**
 * The settings section (F5c), laid out as the reference's: a card of sections on the left, the chosen
 * section on the right. Each section is offered only to someone who holds its permission; the route's own
 * gate refuses it otherwise.
 */
export function SettingsLayout() {
  const { t } = useTranslation(['settings', 'shell', 'nav']);
  const auth = useAuth();
  const allowed = (permission: string | null) => permission === null || auth.can(permission);
  const link = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-focus focus-visible:outline-2',
      active ? 'bg-accent-subtle font-semibold text-accent-subtle-fg' : 'hover:bg-surface-hover',
    );
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav
        aria-label={t('menu')}
        className="grid gap-1 rounded-lg border border-border bg-surface p-2 shadow-sm"
      >
        <ul className="grid gap-1">
          {SECTIONS.filter((section) => allowed(section.permission)).map((section) => (
            <li key={section.key}>
              <NavLink to={section.to} end className={({ isActive }) => link(isActive)}>
                <IconChip icon={section.icon} size="sm" />
                <span className="grid">
                  <span>{t(`sections.${section.key}`)}</span>
                  <span className="text-control-sm font-normal text-fg-muted">
                    {t(`sections.${section.key}About`)}
                  </span>
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
        {ELSEWHERE.some((item) => allowed(item.permission)) ? (
          <>
            <p className="mt-2 border-t border-border px-3 pt-3 text-control-sm font-semibold text-fg-muted">
              {t('elsewhere')}
            </p>
            <ul className="grid gap-1">
              {ELSEWHERE.filter((item) => allowed(item.permission)).map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className={({ isActive }) => link(isActive)}>
                    <IconChip icon={item.icon} tone="slate" size="sm" />
                    {t(`nav:${item.nav}`)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

/** A section's card: a heading and its body, as the reference's settings panes are. */
function Pane({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
      {children}
    </div>
  );
}

/** Display: the theme and the menu width, kept in this browser (ADR 0034's viewer preferences). */
export function DisplaySettingsScreen() {
  const { t } = useTranslation(['settings', 'shell', 'nav']);
  const theme = usePreference(themePreference);
  const width = usePreference(sidebarPreference);
  return (
    <section aria-labelledby="settings-display-title" className="grid gap-4">
      <PageHeader
        title={t('sections.display')}
        titleId="settings-display-title"
        description={t('display.description')}
      />
      <Pane>
        <div role="group" aria-labelledby="settings-theme" className="grid gap-2">
          <h2 id="settings-theme" className="font-semibold">
            {t('display.theme')}
          </h2>
          <p className="text-control-sm text-fg-muted">{t('display.themeHint')}</p>
          <RadioGroup
            aria-labelledby="settings-theme"
            value={theme}
            onValueChange={(value) => {
              const choice = THEMES.find((option) => option === value);
              if (choice !== undefined) themePreference.set(choice);
            }}
          >
            {THEMES.map((option) => (
              <Radio key={option} value={option} label={t(`display.themes.${option}`)} />
            ))}
          </RadioGroup>
        </div>
        <div
          role="group"
          aria-labelledby="settings-sidebar"
          className="grid gap-2 border-t border-border pt-4"
        >
          <h2 id="settings-sidebar" className="font-semibold">
            {t('display.sidebar')}
          </h2>
          <RadioGroup
            aria-labelledby="settings-sidebar"
            value={width}
            onValueChange={(value) => sidebarPreference.set(value === 'narrow' ? 'narrow' : 'wide')}
          >
            <Radio value="wide" label={t('display.sidebarWide')} />
            <Radio value="narrow" label={t('display.sidebarNarrow')} />
          </RadioGroup>
        </div>
      </Pane>
    </section>
  );
}

/** The business profile, as the server holds it (getBusinessProfile). Read here; changed in a later phase. */
export function BusinessProfileScreen() {
  const { t } = useTranslation(['settings', 'common']);
  // Changes rarely and is read for display: `reference`.
  const profile = useApiQuery('getBusinessProfile', {}, { staleClass: 'reference' });
  const labels = useStateLabels({
    loading: t('business.loading'),
    emptyTitle: t('business.empty'),
    errorTitle: t('business.error'),
    deniedTitle: t('business.denied'),
  });
  const none = <span className="text-fg-muted">{t('business.none')}</span>;
  return (
    <section aria-labelledby="settings-business-title" className="grid gap-4">
      <PageHeader
        title={t('sections.business')}
        titleId="settings-business-title"
        description={t('business.description')}
      />
      <QueryBoundary
        query={profile}
        labels={labels}
        isEmpty={() => false}
        loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
      >
        {(p) => (
          <Pane>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_minmax(0,1fr)]">
              {(
                [
                  ['legalName', p.legalName],
                  ['tradingName', p.tradingName],
                  ['tin', p.tin],
                  ['vat', p.vatNumber],
                  ['address', p.address],
                  ['phone', p.phone],
                  ['email', p.email],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-sm text-fg-muted">{t(`business.${key}`)}</dt>
                  <dd className="break-words">{value === null || value === '' ? none : value}</dd>
                </div>
              ))}
              <dt className="text-sm text-fg-muted">{t('business.updated')}</dt>
              <dd>
                <When instant={p.updatedAt} />
              </dd>
            </dl>
          </Pane>
        )}
      </QueryBoundary>
    </section>
  );
}

/** A setting's value in words, by the type the API gives it. Money through formatMoney; nothing computed. */
function SettingValue({ setting }: { setting: Setting }) {
  const { t } = useTranslation('settings');
  const value: unknown = setting.value;
  switch (setting.valueType) {
    case 'BOOLEAN':
      return value === true ? (
        <StatusBadge tone="good" label={t('system.yes')} />
      ) : (
        <StatusBadge tone="slate" label={t('system.no')} />
      );
    case 'PESEWAS':
      return <>{typeof value === 'number' ? formatMoney(value) : String(value)}</>;
    case 'PERCENT':
      return <>{`${String(value)}%`}</>;
    case 'JSON':
      return <code className="text-control-sm break-all">{JSON.stringify(value)}</code>;
    default:
      return <>{String(value)}</>;
  }
}

/** The server's settings and feature switches (listSettings), for the branch chosen in the header. */
export function SystemSettingsScreen() {
  const { t } = useTranslation(['settings', 'common']);
  const pages = useCursorPages();
  const scope = useBranchScope();
  const [typed, setTyped] = useState('');
  const [prefix, setPrefix] = useState('');
  // Read to check how the system is set: `working`.
  const settings = useApiQuery(
    'listSettings',
    {
      query: {
        ...scope.query,
        ...(prefix === '' ? {} : { prefix }),
        ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
      },
    },
    { staleClass: 'working' },
  );
  const labels = useStateLabels({
    loading: t('system.loading'),
    emptyTitle: t('system.empty'),
    emptyDescription: t('system.emptyBody'),
    errorTitle: t('system.error'),
    deniedTitle: t('system.denied'),
  });
  const columns: TableColumn<Setting>[] = [
    {
      id: 'setting',
      rowHeader: true,
      head: t('system.columns.setting'),
      sortValue: (setting) => setting.key,
      cell: (setting) => (
        <span className="flex items-center gap-3">
          <IconChip icon={SlidersHorizontal} tone="slate" size="sm" />
          <span className="grid min-w-0">
            <span>{setting.description}</span>
            <code className="text-control-sm font-normal text-fg-muted">{setting.key}</code>
          </span>
        </span>
      ),
    },
    {
      id: 'value',
      head: t('system.columns.value'),
      cell: (setting) => <SettingValue setting={setting} />,
    },
    {
      id: 'appliesTo',
      head: t('system.columns.appliesTo'),
      sortValue: (setting) => (setting.branchId === null ? 0 : 1),
      cell: (setting) =>
        setting.branchId === null ? t('system.everyBranch') : t('system.oneBranch'),
    },
    {
      id: 'validFrom',
      head: t('system.columns.validFrom'),
      sortValue: (setting) => setting.validFrom,
      cell: (setting) => <When instant={setting.validFrom} />,
    },
    {
      id: 'updated',
      head: t('system.columns.updated'),
      sortValue: (setting) => setting.updatedAt,
      cell: (setting) => (
        <span className="grid">
          <span>{setting.updatedBy.displayName}</span>
          <span className="text-control-sm text-fg-muted">
            <When instant={setting.updatedAt} />
          </span>
        </span>
      ),
    },
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="settings-system-title" className="grid gap-4">
      <PageHeader
        title={t('sections.system')}
        titleId="settings-system-title"
        description={t('system.description')}
      />
      <TableCard
        view={view}
        query={settings}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(setting) => `${setting.key}-${setting.branchId ?? 'all'}`}
        tableLabel={t('system.table')}
        exportName={t('sections.system')}
        pages={{ state: pages, info: (page) => page.page, label: t('system.pages') }}
        toolbar={
          <ToolbarSearch
            label={t('system.search')}
            placeholder={t('system.searchPlaceholder')}
            value={typed}
            onValueChange={setTyped}
            onSubmit={(value) => {
              setPrefix(value);
              pages.reset();
            }}
          />
        }
      />
    </section>
  );
}
