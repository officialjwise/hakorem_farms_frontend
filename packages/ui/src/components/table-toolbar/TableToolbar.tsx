'use client';

import {
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  Columns3,
  ListFilter,
  Search,
  Upload,
} from 'lucide-react';
import {
  useId,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';
import { Checkbox } from '../checkbox/Checkbox';
import { DatePicker, type DateString } from '../date-picker/DatePicker';
import { Field } from '../field/Field';
import { Input } from '../input/Input';
import { Popover } from '../popover/Popover';
import { Radio, RadioGroup } from '../radio/Radio';
import type { TableView } from './useTableView';

/*
 * The reference's table toolbar (ADR 0036): one row of pill controls at the top of a table card. Search,
 * date range, filter, Columns, Sort and Export, each only where the screen can honour it. Every control
 * carries words: a visible label on each pill, and a label for the search field that a screen reader
 * hears even though the field shows only its icon and placeholder.
 */

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/** The row itself. One line from 64rem; on a phone the search takes the first line and the pills wrap. */
export function TableToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="table-toolbar"
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-border p-4 lg:flex-nowrap',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface ToolbarSearchProps<L extends string = string> {
  /** Required. Names the field and the search landmark, for example "Search products by name or SKU". */
  label: NonEmpty<L>;
  /** A shorter hint inside the field, for example "Search products". Defaults to the label. */
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Enter runs the search (the API's `q`), so a phone does not send a request per keystroke. */
  onSubmit: (value: string) => void;
  className?: string;
}

/** The toolbar's search: a pill with a search icon. Enter submits. */
export function ToolbarSearch<L extends string>({
  label,
  placeholder,
  value,
  onValueChange,
  onSubmit,
  className,
}: ToolbarSearchProps<L>) {
  const id = useId();
  if (label.trim() === '') throw new Error('ToolbarSearch needs a non-empty label.');
  return (
    <form
      role="search"
      aria-label={label}
      data-slot="toolbar-search"
      className={cn('relative w-full min-w-0 lg:w-64 lg:shrink-0', className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value.trim());
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute start-3.5 top-1/2 size-icon-sm -translate-y-1/2 text-fg-muted"
      />
      <Input
        id={id}
        type="search"
        placeholder={placeholder ?? label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="ps-9"
      />
    </form>
  );
}

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/** A pill that opens a menu: icon, words, an optional count, and a chevron. */
function PillTrigger({
  icon: Icon,
  label,
  count,
  ...props
}: { icon: IconType; label: string; count?: number } & Omit<
  ComponentPropsWithRef<'button'>,
  'children'
>) {
  return (
    <Button variant="secondary" className="shrink-0" {...props}>
      <Icon aria-hidden="true" />
      {label}
      {count !== undefined && count > 0 ? (
        <span className="rounded-full bg-accent-subtle px-1.5 text-control-sm font-semibold text-accent-subtle-fg tabular-nums">
          {count}
        </span>
      ) : null}
      <ChevronDown aria-hidden="true" />
    </Button>
  );
}

export interface DateRangeMenuProps<L extends string = string> {
  /** Required. Names the control, for example "Dates". */
  label: NonEmpty<L>;
  /** The range in words, already formatted by the screen, for example "1 Nov to 15 Nov 2026" or "Any date". */
  summary: string;
  from: DateString | undefined;
  to: DateString | undefined;
  onChange: (range: { from: DateString | undefined; to: DateString | undefined }) => void;
  fromLabel: string;
  toLabel: string;
  clearLabel: string;
}

/** The date range pill: shows the range in words, and opens From and To fields. Each change applies at once. */
export function DateRangeMenu<L extends string>({
  label,
  summary,
  from,
  to,
  onChange,
  fromLabel,
  toLabel,
  clearLabel,
}: DateRangeMenuProps<L>) {
  return (
    <Popover
      label={label}
      align="start"
      trigger={
        <Button
          variant="secondary"
          className="shrink-0"
          data-slot="date-range-menu"
          aria-label={`${label}: ${summary}`}
        >
          <CalendarDays aria-hidden="true" />
          {summary}
          <ChevronDown aria-hidden="true" />
        </Button>
      }
    >
      <div className="grid w-64 gap-3">
        <Field label={fromLabel}>
          <DatePicker
            size="sm"
            value={from ?? ''}
            max={to}
            onChange={(event) => onChange({ from: event.target.value || undefined, to })}
          />
        </Field>
        <Field label={toLabel}>
          <DatePicker
            size="sm"
            value={to ?? ''}
            min={from}
            onChange={(event) => onChange({ from, to: event.target.value || undefined })}
          />
        </Field>
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => onChange({ from: undefined, to: undefined })}
        >
          {clearLabel}
        </Button>
      </div>
    </Popover>
  );
}

export interface FilterMenuProps<L extends string = string> {
  /** Required. The pill's words, for example "Filter". */
  label: NonEmpty<L>;
  /** How many filters are set; shown on the pill so a narrowed list never looks complete. */
  active: number;
  /** Labelled Fields: the screen's filters. */
  children: ReactNode;
  /** Clears every filter, when any is set. */
  reset?: { label: string; onReset: () => void };
}

/** The filter pill: the screen's own labelled filters in a popover, with how many are set on the pill. */
export function FilterMenu<L extends string>({
  label,
  active,
  children,
  reset,
}: FilterMenuProps<L>) {
  return (
    <Popover
      label={label}
      align="start"
      trigger={<PillTrigger icon={ListFilter} label={label} count={active} />}
    >
      <div className="grid w-72 max-w-full gap-3">
        {children}
        {reset !== undefined && active > 0 ? (
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={reset.onReset}>
            {reset.label}
          </Button>
        ) : null}
      </div>
    </Popover>
  );
}

export interface ColumnsMenuProps<T, L extends string = string> {
  view: TableView<T>;
  /** Required. The pill's words, for example "Columns". */
  label: NonEmpty<L>;
  /** The group's legend, for example "Show columns". */
  legend: string;
}

/** The Columns pill: a checkbox per column. The column that names each row stays, checked and disabled. */
export function ColumnsMenu<T, L extends string>({ view, label, legend }: ColumnsMenuProps<T, L>) {
  const hiddenCount = view.columns.filter((c) => view.isHidden(c.id)).length;
  return (
    <Popover
      label={label}
      align="end"
      trigger={<PillTrigger icon={Columns3} label={label} count={hiddenCount} />}
    >
      <fieldset className="grid w-60 gap-1">
        <legend className="mb-1 text-control-sm font-semibold text-fg-muted">{legend}</legend>
        {view.columns.map((column) => (
          <Checkbox
            key={column.id}
            label={column.head}
            checked={!view.isHidden(column.id)}
            disabled={column.rowHeader === true}
            onCheckedChange={() => view.toggle(column.id)}
          />
        ))}
      </fieldset>
    </Popover>
  );
}

export interface SortMenuProps<T, L extends string = string> {
  view: TableView<T>;
  /** Required. The pill's words, for example "Sort by". */
  label: NonEmpty<L>;
  /** The first option: the order the API sent, for example "Newest first (as listed)". */
  defaultLabel: string;
  /** Words for each direction, for example "A to Z, low to high" and "Z to A, high to low". */
  ascendingLabel: string;
  descendingLabel: string;
  /** The direction group's legend, for example "Direction". */
  directionLegend: string;
  /** Says what is sorted: the page on screen, for example "Sorts the rows on this page." */
  scopeNote?: string;
}

/** The Sort pill: a column, or the API's order, and a direction. The column headers sort the same state. */
export function SortMenu<T, L extends string>({
  view,
  label,
  defaultLabel,
  ascendingLabel,
  descendingLabel,
  directionLegend,
  scopeNote,
}: SortMenuProps<T, L>) {
  const sortable = view.columns.filter((c) => c.sortValue !== undefined);
  const [direction, setDirection] = useState<'ascending' | 'descending'>(
    view.sort?.direction ?? 'ascending',
  );
  const columnId = useId();
  const directionId = useId();
  if (sortable.length === 0) return null;
  return (
    <Popover
      label={label}
      align="end"
      trigger={<PillTrigger icon={ArrowDownUp} label={label} count={view.sort === null ? 0 : 1} />}
    >
      <div className="grid w-64 gap-3">
        <div role="group" aria-labelledby={columnId} className="grid gap-1">
          <span id={columnId} className="text-control-sm font-semibold text-fg-muted">
            {label}
          </span>
          <RadioGroup
            aria-labelledby={columnId}
            value={view.sort?.id ?? ''}
            onValueChange={(id) => view.setSort(id === '' ? null : { id, direction })}
          >
            <Radio value="" label={defaultLabel} />
            {sortable.map((column) => (
              <Radio key={column.id} value={column.id} label={column.head} />
            ))}
          </RadioGroup>
        </div>
        <div role="group" aria-labelledby={directionId} className="grid gap-1">
          <span id={directionId} className="text-control-sm font-semibold text-fg-muted">
            {directionLegend}
          </span>
          <RadioGroup
            aria-labelledby={directionId}
            value={view.sort?.direction ?? direction}
            onValueChange={(value) => {
              const next = value === 'descending' ? 'descending' : 'ascending';
              setDirection(next);
              if (view.sort !== null) view.setSort({ id: view.sort.id, direction: next });
            }}
          >
            <Radio value="ascending" label={ascendingLabel} />
            <Radio value="descending" label={descendingLabel} />
          </RadioGroup>
        </div>
        {scopeNote === undefined ? null : (
          <p className="text-control-sm text-fg-muted">{scopeNote}</p>
        )}
      </div>
    </Popover>
  );
}

export interface ExportMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface ExportMenuProps<L extends string = string> {
  /** Required. The pill's words, for example "Export". */
  label: NonEmpty<L>;
  items: readonly ExportMenuItem[];
  /** While a file is being produced, for example "Preparing the file". */
  busyLabel?: string;
  busy?: boolean;
}

/** The Export pill: the formats this screen can produce. */
export function ExportMenu<L extends string>({
  label,
  items,
  busy,
  busyLabel,
}: ExportMenuProps<L>) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      label={label}
      align="end"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="secondary"
          className="shrink-0"
          loading={busy === true}
          loadingLabel={busyLabel ?? label}
        >
          <Upload aria-hidden="true" />
          {label}
          <ChevronDown aria-hidden="true" />
        </Button>
      }
    >
      <ul className="grid w-56 gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              className="justify-start"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </Button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
