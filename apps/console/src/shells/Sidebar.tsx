import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { Button, cn, Tooltip } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { foldedGroups, sidebarPreference, usePreference } from '../lib/preferences';
import { BACK_OFFICE_GROUPS, type NavGroupKey } from '../routing/nav';

const NAV_LINK =
  'flex h-control-md items-center gap-2 rounded-md border-s-4 border-transparent px-2 text-control-md text-fg ' +
  'outline-focus outline-offset-[-2px] focus-visible:outline-2 hover:bg-surface-hover ' +
  'aria-[current=page]:border-accent aria-[current=page]:bg-accent-subtle aria-[current=page]:font-semibold aria-[current=page]:text-accent-subtle-fg';

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
  const { t } = useTranslation('shell');
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
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-xs font-semibold tracking-wide text-fg-muted uppercase outline-focus focus-visible:outline-2 hover:text-fg"
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
                    <Icon aria-hidden="true" className="size-icon-md shrink-0" />
                    <span className={cn(narrow && 'sr-only')}>{t(`nav.${key}`)}</span>
                  </NavLink>
                );
                return (
                  <li key={key}>
                    {narrow ? <Tooltip content={t(`nav.${key}`)}>{link}</Tooltip> : link}
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
  const { t } = useTranslation('shell');
  const width = usePreference(sidebarPreference);
  const narrow = width === 'narrow';
  return (
    <nav
      aria-label={t('backOffice.navLabel')}
      data-width={width}
      className={cn(
        'hidden shrink-0 flex-col gap-2 overflow-y-auto border-e border-border bg-surface p-2 lg:flex',
        narrow ? 'w-16' : 'w-60',
      )}
    >
      <div className={cn('flex', narrow ? 'justify-center' : 'justify-end')}>
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
