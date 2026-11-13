import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox, TriangleAlert } from 'lucide-react';
import { createContext, useContext, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/*
 * Table: semantic <table> parts, styled by tokens, sized by density.
 *
 * Below 40rem of container width the table stacks by default: each row becomes
 * a block with its row header as the heading and each labelled cell as a
 * label/value pair (layout rules in src/styles/table.css). Pass `label` on every
 * TableCell so the stacked layout can name the value. Every part carries an
 * explicit ARIA table role, because changing a table element's CSS display can
 * drop its native semantics in some browsers.
 *
 * Dense back-office screens set data-density="compact" on an ancestor. Row
 * height, cell padding and type size all follow it. Nothing here hard-codes copy:
 * every visible or announced string is a prop, so it goes through the app's
 * translation layer.
 */

const TableContext = createContext<{ striped: boolean }>({ striped: false });

type RegionLabel =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never };

export type TableLayout = 'stack' | 'scroll';

export type TableContainerProps = Omit<
  ComponentPropsWithRef<'div'>,
  'aria-label' | 'aria-labelledby'
> &
  RegionLabel & {
    /**
     * Below 40rem of container width: `stack` (default) turns each row into a
     * label/value block; `scroll` keeps columns and scrolls sideways, for
     * genuinely wide reference tables.
     */
    layout?: TableLayout;
  };

/**
 * The region around a table: labelled, and focusable so keyboard users can
 * scroll it when it is wider than the screen.
 */
export function TableContainer({ className, layout = 'stack', ...props }: TableContainerProps) {
  return (
    <div
      role="region"
      tabIndex={0}
      data-slot="table-container"
      data-layout={layout}
      className={cn(
        'relative w-full overflow-auto rounded-lg border border-border bg-surface',
        'outline-focus outline-offset-2 focus-visible:outline-2',
        className,
      )}
      {...props}
    />
  );
}

export type TableProps = ComponentPropsWithRef<'table'> & {
  /** Alternate row tint, for wide tables where the eye has to track across a row. */
  striped?: boolean;
};

export function Table({ className, striped = false, ...props }: TableProps) {
  return (
    <TableContext.Provider value={{ striped }}>
      <table
        role="table"
        data-slot="table"
        className={cn(
          'w-full border-separate border-spacing-0 text-cell text-fg caption-bottom',
          className,
        )}
        {...props}
      />
    </TableContext.Provider>
  );
}

export type TableCaptionProps = ComponentPropsWithRef<'caption'> & {
  /** Keep the caption for screen readers only, when a visible heading already names the table. */
  visuallyHidden?: boolean;
};

export function TableCaption({ className, visuallyHidden = false, ...props }: TableCaptionProps) {
  return (
    <caption
      data-slot="table-caption"
      className={cn(
        visuallyHidden ? 'sr-only' : 'px-cell py-cell text-start text-sm text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}

export type TableHeaderProps = ComponentPropsWithRef<'thead'> & {
  /** Keep the header row visible while the body scrolls inside the container. */
  sticky?: boolean;
};

export function TableHeader({ className, sticky = false, ...props }: TableHeaderProps) {
  return (
    <thead
      role="rowgroup"
      data-slot="table-header"
      className={cn(sticky && 'sticky top-0 z-sticky', className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: ComponentPropsWithRef<'tbody'>) {
  return <tbody role="rowgroup" data-slot="table-body" className={className} {...props} />;
}

export function TableFooter({ className, ...props }: ComponentPropsWithRef<'tfoot'>) {
  return (
    <tfoot
      role="rowgroup"
      data-slot="table-footer"
      className={cn(
        'bg-surface-sunken font-semibold [&_td]:border-t-2 [&_td]:border-b-0 [&_td]:border-t-border-strong [&_th]:border-t-2 [&_th]:border-b-0 [&_th]:border-t-border-strong',
        className,
      )}
      {...props}
    />
  );
}

export type TableRowProps = ComponentPropsWithRef<'tr'> & {
  /** Selected rows get the accent tint and an accent bar on the leading edge (src/styles/table.css), so selection is shape as well as colour. */
  selected?: boolean;
};

export function TableRow({ className, selected, ...props }: TableRowProps) {
  const { striped } = useContext(TableContext);
  return (
    <tr
      role="row"
      data-slot="table-row"
      aria-selected={selected}
      className={cn(
        'h-row transition-colors duration-fast',
        'hover-enabled:bg-surface-hover',
        striped && 'even:not-aria-selected:bg-bg',
        'aria-selected:bg-accent-subtle aria-selected:hover-enabled:bg-accent-subtle',
        className,
      )}
      {...props}
    />
  );
}

export type SortDirection = 'ascending' | 'descending' | 'none';

type SortProps =
  | { sort?: undefined; onSort?: never }
  | {
      /** This column's current sort. Only the sorted column gets aria-sort, as the APG table pattern asks. */
      sort: SortDirection;
      onSort: () => void;
    };

export type TableHeadProps = ComponentPropsWithRef<'th'> &
  SortProps & {
    /** Right-align for money, weight and quantity columns, with tabular figures. */
    numeric?: boolean;
  };

const cellBase = 'px-cell py-cell border-b border-border align-middle [tr:last-child>&]:border-b-0';

function SortIcon({ sort }: { sort: SortDirection }) {
  if (sort === 'ascending') return <ArrowUp aria-hidden="true" className="size-icon-sm" />;
  if (sort === 'descending') return <ArrowDown aria-hidden="true" className="size-icon-sm" />;
  return <ChevronsUpDown aria-hidden="true" className="size-icon-sm" />;
}

export function TableHead({
  className,
  numeric = false,
  sort,
  onSort,
  children,
  scope,
  ...props
}: TableHeadProps) {
  const sorted = sort === 'ascending' || sort === 'descending';
  return (
    <th
      scope={scope ?? 'col'}
      role={scope === 'row' ? 'rowheader' : 'columnheader'}
      data-slot="table-head"
      data-sortable={onSort ? '' : undefined}
      aria-sort={sorted ? sort : undefined}
      className={cn(
        'h-head px-cell text-head font-semibold tracking-wide whitespace-nowrap uppercase',
        'border-b border-border-strong bg-surface-sunken text-fg-muted',
        numeric ? 'text-end' : 'text-start',
        sorted && 'text-fg',
        className,
      )}
      {...props}
    >
      {onSort && sort !== undefined ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            '-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 uppercase tracking-wide',
            'hover-enabled:text-fg outline-focus outline-offset-1 focus-visible:outline-2',
            numeric && 'flex-row-reverse',
          )}
        >
          {children}
          <SortIcon sort={sort} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export type TableCellProps = ComponentPropsWithRef<'td'> & {
  numeric?: boolean;
  /**
   * The column name, shown beside the value when the table stacks (for example
   * "Weight (kg)"). Pass the same translated string as the column header.
   */
  label?: string;
};

export function TableCell({ className, numeric = false, label, ...props }: TableCellProps) {
  return (
    <td
      role="cell"
      data-slot="table-cell"
      data-label={label}
      className={cn(cellBase, numeric && 'text-end whitespace-nowrap tabular-nums', className)}
      {...props}
    />
  );
}

/** The cell that names its row (the item, the animal, the lot). Screen readers announce it with every cell in the row. */
export function TableRowHeader({
  className,
  numeric = false,
  ...props
}: ComponentPropsWithRef<'th'> & { numeric?: boolean }) {
  return (
    <th
      scope="row"
      role="rowheader"
      data-slot="table-row-header"
      className={cn(
        cellBase,
        'text-start font-semibold',
        numeric && 'text-end whitespace-nowrap tabular-nums',
        className,
      )}
      {...props}
    />
  );
}

const SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-2/5'] as const;

export interface TableLoadingRowsProps {
  columns: number;
  rows?: number;
  /** Announced once to screen readers, for example "Loading stock on hand". */
  label: string;
}

/** Placeholder rows while data loads. Same row height as real rows, so nothing jumps when data lands. */
export function TableLoadingRows({ columns, rows = 5, label }: TableLoadingRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} role="row" data-slot="table-row" className="h-row" data-loading-row="">
          {Array.from({ length: columns }, (_, c) => (
            <td key={c} role="cell" data-slot="table-cell" className={cellBase}>
              {r === 0 && c === 0 ? (
                <span role="status" className="sr-only">
                  {label}
                </span>
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  'block h-3 rounded-sm bg-surface-sunken animate-pulse motion-reduce:animate-none',
                  SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length],
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

type ReferenceProps =
  | { reference?: undefined; referenceLabel?: never }
  | {
      /** The correlation id of a failed request, so a support call starts with a reference instead of a guess. */
      reference: string;
      referenceLabel: string;
    };

export type TableMessageRowProps = ReferenceProps & {
  colSpan: number;
  tone: 'empty' | 'error';
  title: string;
  description?: string;
  /** For example a "Receive stock" button on an empty table, or "Try again" on an error. */
  action?: ReactNode;
};

/** A full-width row for the empty and error states of a table. */
export function TableMessageRow({
  colSpan,
  tone,
  title,
  description,
  action,
  reference,
  referenceLabel,
}: TableMessageRowProps) {
  const Icon = tone === 'error' ? TriangleAlert : Inbox;
  return (
    <tr role="row" data-slot="table-message-row" data-tone={tone}>
      <td role="cell" colSpan={colSpan} className="px-cell py-10 text-center">
        <div
          role={tone === 'error' ? 'alert' : undefined}
          className="mx-auto flex max-w-md flex-col items-center gap-2"
        >
          <Icon
            aria-hidden="true"
            className={cn('size-7', tone === 'error' ? 'stroke-critical' : 'text-fg-muted')}
          />
          <p className="text-base font-semibold text-balance text-fg">{title}</p>
          {description ? <p className="text-sm text-balance text-fg-muted">{description}</p> : null}
          {reference !== undefined ? (
            <p className="text-xs text-fg-muted">
              {referenceLabel} <code className="font-mono text-fg">{reference}</code>
            </p>
          ) : null}
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
      </td>
    </tr>
  );
}
