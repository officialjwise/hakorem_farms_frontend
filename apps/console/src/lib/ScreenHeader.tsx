import { useSyncExternalStore } from 'react';
import { PageHeader as UiPageHeader, type PageHeaderProps } from '@hakorem/ui';
import { Breadcrumbs } from '../shells/Breadcrumbs';

/** The element in the back office top bar that holds the page's h1 (BackOfficeShell). */
export const PAGE_TITLE_SLOT_ID = 'page-title-slot';

const noSubscription = () => () => undefined;
const findSlot = () => document.getElementById(PAGE_TITLE_SLOT_ID);
const noSlot = () => null;

/**
 * Every back office page's header (F5c): the title in the top bar, as the reference does, and the
 * breadcrumbs leading the page with the actions on the right. Outside the shell (a test rendering one
 * screen) there is no slot, and the title stays in the page.
 */
export function PageHeader(props: PageHeaderProps) {
  // The shell's slot never changes once mounted. On the very first mount it is not in the document yet
  // while this renders; React re-reads the snapshot after commit and renders again, before paint.
  const slot = useSyncExternalStore(noSubscription, findSlot, noSlot);
  return <UiPageHeader breadcrumbs={<Breadcrumbs />} titleSlot={slot} {...props} />;
}
