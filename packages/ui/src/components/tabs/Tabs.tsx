'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/cn';

/*
 * Tabs: Radix Tabs, in parts like Table. State is Radix's own: `value` +
 * `onValueChange`, or `defaultValue` when uncontrolled. Radix owns arrow-key
 * movement, Home and End. Nothing here holds copy: tab names are children.
 */

export function Tabs({ className, ...props }: ComponentPropsWithRef<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('grid gap-3', className)} {...props} />;
}

type ListLabel =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never };

export type TabsListProps = Omit<
  ComponentPropsWithRef<typeof TabsPrimitive.List>,
  'aria-label' | 'aria-labelledby'
> &
  ListLabel;

/** The row of tabs. Labelled, and it scrolls sideways inside itself when the tabs do not fit (360px). */
export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('flex max-w-full overflow-x-auto border-b border-border', className)}
      {...props}
    />
  );
}

/** The active tab is bolder and underlined, so it is not colour alone. */
export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex h-control-md shrink-0 items-center justify-center px-control-md text-control-md whitespace-nowrap',
        '-mb-px border-b-2 border-transparent font-medium text-fg-muted',
        'transition-colors duration-fast',
        'hover-enabled:text-fg',
        'outline-focus outline-offset-[-2px] focus-visible:outline-2',
        'data-[state=active]:border-accent data-[state=active]:font-semibold data-[state=active]:text-fg',
        'disabled:cursor-not-allowed disabled:text-fg-disabled',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('outline-focus outline-offset-2 focus-visible:outline-2', className)}
      {...props}
    />
  );
}
