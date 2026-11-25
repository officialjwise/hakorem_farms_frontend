import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router';
import { Button, cn, Tooltip } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { foldedGroups, sidebarPreference, usePreference } from '../lib/preferences';
import { BACK_OFFICE_GROUPS, type NavGroupKey } from '../routing/nav';

/*
 * The reference's sidebar item: a tall row with an outline icon; the current page is an outlined pill
 * with its icon on an accent square, and a heavier weight. Rendered inside the dark teal panel, so every
 * token here takes its dark value (ADR 0001, amendment).
 */
const NAV_LINK =
  'group flex h-11 items-center gap-3 rounded-lg border border-transparent px-2.5 text-sm text-fg ' +
  'outline-focus outline-offset-[-2px] focus-visible:outline-2 hover:bg-surface-hover ' +
  'aria-[current=page]:border-accent aria-[current=page]:bg-accent-subtle aria-[current=page]:font-semibold';
const NAV_ICON =
  'grid size-7 shrink-0 place-items-center rounded-md group-aria-[current=page]:bg-accent';

/**
 * The back office menu, grouped by job with a heading per group. Each group folds; on a wide screen the
 * whole menu narrows to icons, each with its name as a tooltip and as its accessible name. The current
 * page is marked by an accent edge and weight as well as tint, and by aria-current.
 */
export function SidebarLinks({
  narrow = false,
  onNavigate,
}: {
  narrow?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation(['shell', 'nav']);
  const auth = useAuth();
  const folded = usePreference(foldedGroups).split(',');
  const toggle = (key: NavGroupKey) => {
    const next = folded.includes(key) ? folded.filter((k) => k !== key) : [...folded, key];
    foldedGroups.set(next.filter((k) => k !== '').join(','));
  };
  const groups = BACK_OFFICE_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.permission === null || auth.can(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="grid gap-3">
      {groups.map((group) => {
        const isFolded = !narrow && folded.includes(group.key);
        const listId = `nav-group-${group.key}`;
        return (
          <div key={group.key} className="grid gap-1">
            {narrow ? (
              <h2 className="sr-only">{t(`navGroups.${group.key}`)}</h2>
            ) : (
              <h2>
                <button
                  type="button"
                  aria-expanded={!isFolded}
                  aria-controls={listId}
                  onClick={() => toggle(group.key)}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-sm text-fg-muted outline-focus focus-visible:outline-2 hover:text-fg"
                >
                  {t(`navGroups.${group.key}`)}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn('size-icon-sm transition-transform', isFolded && '-rotate-90')}
                  />
                </button>
              </h2>
            )}
            <ul id={listId} hidden={isFolded} className="grid gap-0.5">
              {group.items.map(({ key, path, icon: Icon }) => {
                const link = (
                  <NavLink
                    to={path}
                    end={path === '/'}
                    className={cn(NAV_LINK, narrow && 'justify-center px-0')}
                    onClick={onNavigate}
                  >
                    <span className={NAV_ICON}>
                      <Icon
                        aria-hidden="true"
                        className="size-icon-md text-fg-muted group-aria-[current=page]:text-accent-fg"
                      />
                    </span>
                    <span className={cn(narrow && 'sr-only')}>{t(`nav:${key}`)}</span>
                  </NavLink>
                );
                return (
                  <li key={key}>
                    {narrow ? <Tooltip content={t(`nav:${key}`)}>{link}</Tooltip> : link}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** The sidebar on a wide screen, with its own narrow and wide toggle. */
export function Sidebar() {
  const { t } = useTranslation(['shell', 'nav']);
  const width = usePreference(sidebarPreference);
  const narrow = width === 'narrow';
  return (
    <nav
      aria-label={t('backOffice.navLabel')}
      data-width={width}
      data-theme="dark"
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col gap-3 overflow-y-auto bg-panel p-3 text-fg lg:flex print:hidden',
        narrow ? 'w-20' : 'w-64',
      )}
    >
      <div className={cn('flex items-center gap-2', narrow ? 'justify-center' : 'justify-between')}>
        {narrow ? null : (
          <Link
            to="/"
            className="text-lg font-bold text-accent-text outline-focus focus-visible:outline-2"
          >
            {t('app.name')}
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={narrow ? t('backOffice.widen') : t('backOffice.narrow')}
          aria-pressed={narrow}
          onClick={() => sidebarPreference.set(narrow ? 'wide' : 'narrow')}
        >
          {narrow ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>
      <SidebarLinks narrow={narrow} />
    </nav>
  );
}
