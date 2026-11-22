import {
  Bell,
  CircleUserRound,
  LogOut,
  Monitor,
  Moon,
  Search,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  AlertRow,
  Button,
  Input,
  Popover,
  Select,
  Skeleton,
  StatusBadge,
  type BadgeTone,
  formatDateTime,
} from '@hakorem/ui';
import { useAuth } from '../../auth/AuthProvider';
import { ALL_BRANCHES, useBranchScope } from '../../branch/branchScope';
import { useApiQuery } from '../../data/api';
import { lookup } from '../../lib/lookup';
import { THEMES, themePreference, usePreference, type ThemeChoice } from '../../lib/preferences';

/** The branch every screen is scoped to, where the reference puts its location picker. */
export function BranchSwitcher() {
  const { t } = useTranslation('shell');
  const scope = useBranchScope();
  if (scope.branches.length === 0) return null;
  if (scope.branches.length === 1) {
    return (
      <span className="hidden items-center gap-1 text-sm text-fg-muted md:inline-flex">
        {t('branch.only', { name: scope.branches[0]?.name ?? '' })}
      </span>
    );
  }
  return (
    <div className="w-36 sm:w-44">
      <Select
        aria-label={t('branch.label')}
        value={scope.branchId ?? ALL_BRANCHES}
        onValueChange={scope.choose}
        options={[
          { value: ALL_BRANCHES, label: t('branch.all') },
          ...scope.branches.map((branch) => ({ value: branch.id, label: branch.name })),
        ]}
      />
    </div>
  );
}

/** Search the catalogue from anywhere. Ctrl K (or ⌘ K) puts the cursor in it. */
export function GlobalSearch() {
  const { t } = useTranslation('shell');
  const auth = useAuth();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!auth.can('mdm.product.read')) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const term = q.trim();
    void navigate(term === '' ? '/products' : `/products?q=${encodeURIComponent(term)}`);
  };
  return (
    <form
      role="search"
      onSubmit={submit}
      className="relative hidden min-w-0 md:block md:w-48 xl:w-60"
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-2 top-1/2 size-icon-sm -translate-y-1/2 stroke-slate"
      />
      <Input
        ref={input}
        type="search"
        aria-label={t('search.label')}
        placeholder={t('search.placeholder')}
        aria-keyshortcuts="Control+K Meta+K"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        className="ps-8 pe-14"
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded-sm border border-border bg-surface-sunken px-1.5 text-xs text-fg-muted"
      >
        {t('search.hint')}
      </kbd>
    </form>
  );
}

const THEME_ICON: Record<ThemeChoice, LucideIcon> = { system: Monitor, light: Sun, dark: Moon };

/** System, light, dark, in turn. The button's name says the current theme and what pressing does. */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation('shell');
  const theme = usePreference(themePreference);
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'system';
  const Icon = THEME_ICON[theme];
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      className={className}
      aria-label={t('theme.toggle', { current: t(`theme.${theme}`), next: t(`theme.${next}`) })}
      onClick={() => themePreference.set(next)}
    >
      <Icon />
    </Button>
  );
}

const SEVERITY_TONE: Record<'INFO' | 'REVIEW' | 'URGENT', BadgeTone> = {
  INFO: 'info',
  REVIEW: 'warning',
  URGENT: 'critical',
};

/** Today's exceptions for the chosen branch, from the daily exception report's list (FR-RPT). */
export function Notifications() {
  const { t } = useTranslation('shell');
  const auth = useAuth();
  const scope = useBranchScope();
  const allowed = auth.can('rpt.exceptions.read');
  // Controlled, so following the report's link closes it.
  const [open, setOpen] = useState(false);
  // Exceptions are acted on: `live`.
  const exceptions = useApiQuery(
    'listExceptions',
    { query: { ...scope.query, limit: 10 } },
    { enabled: allowed },
  );
  if (!allowed) return null;
  const items = exceptions.data?.data ?? [];
  const more = exceptions.data?.page.hasMore ?? false;
  const count = more ? t('notifications.countMore', { count: items.length }) : String(items.length);
  return (
    <Popover
      label={t('notifications.title')}
      align="end"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('notifications.open', { count: items.length, shown: count })}
          className="relative"
        >
          <Bell aria-hidden="true" />
          {items.length > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -end-1 -top-1 min-w-5 rounded-full bg-critical-strong px-1 text-xs font-semibold text-critical-on"
            >
              {count}
            </span>
          ) : null}
        </Button>
      }
    >
      <div className="grid w-80 max-w-[calc(100vw-2rem)] gap-2">
        <p className="font-semibold">{t('notifications.title')}</p>
        {exceptions.status === 'pending' ? (
          <Skeleton label={t('notifications.loading')} />
        ) : exceptions.status === 'error' ? (
          <p role="alert" className="text-sm text-critical-fg">
            {t('notifications.error')}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('notifications.empty')}</p>
        ) : (
          <ul className="grid max-h-96 gap-1 overflow-y-auto">
            {items.map((item) => {
              const tone = lookup(SEVERITY_TONE, item.severity, 'info');
              return (
                <li key={item.id}>
                  <AlertRow
                    icon={Bell}
                    tone={tone}
                    title={item.summary}
                    meta={formatDateTime(item.raisedAt)}
                    status={
                      <StatusBadge
                        tone={tone}
                        icon={Bell}
                        label={t(`notifications.severity.${item.severity}`, {
                          defaultValue: item.severity,
                        })}
                      />
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        <Link
          to="/exceptions"
          onClick={() => setOpen(false)}
          className="text-sm font-semibold text-accent-text underline"
        >
          {t('notifications.openReport')}
        </Link>
      </div>
    </Popover>
  );
}

/** Who is signed in, their roles, their sessions and signing out. */
export function AccountMenu() {
  const { t } = useTranslation('shell');
  const auth = useAuth();
  const navigate = useNavigate();
  const session = auth.session;
  if (session === null) return null;
  const name = session.principal.displayName;
  const signOut = async () => {
    await auth.logout();
    void navigate('/login', { replace: true });
  };
  return (
    <Popover
      label={t('account.title')}
      align="end"
      trigger={
        <Button variant="ghost" size="sm" aria-label={t('account.open', { name })}>
          <CircleUserRound aria-hidden="true" />
          {/* The name from 96rem; below that the icon alone, so the page title keeps its room. */}
          <span className="hidden max-w-32 truncate 2xl:inline">{name}</span>
        </Button>
      }
    >
      <div className="grid w-64 gap-3">
        <div className="grid gap-0.5">
          <p className="font-semibold">{name}</p>
          <ul className="text-sm text-fg-muted">
            {session.grants.map((grant) => (
              <li key={`${grant.roleCode}-${grant.branchId}-${grant.locationId ?? ''}`}>
                {t('account.grant', { role: grant.roleName, branch: grant.branchCode })}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2 text-sm sm:hidden">
          <ThemeToggle />
          {t('theme.label')}
        </div>
        {auth.can('iam.session.read') ? (
          <Link to="/sessions" className="text-sm text-accent-text underline">
            {t('account.sessions')}
          </Link>
        ) : null}
        <Button variant="secondary" size="sm" onClick={() => void signOut()}>
          <LogOut aria-hidden="true" />
          {t('backOffice.signOut')}
        </Button>
      </div>
    </Popover>
  );
}
