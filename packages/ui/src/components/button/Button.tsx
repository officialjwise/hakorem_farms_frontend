import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef, MouseEvent, ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from '../spinner/Spinner';

export const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none',
    'transition-colors duration-fast ease-standard',
    'outline-focus outline-offset-2 focus-visible:outline-2',
    'press:translate-y-px motion-reduce:press:translate-y-0',
    'disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface-sunken disabled:text-fg-disabled',
    'aria-busy:cursor-progress',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        /** The one strong colour on the screen: the action the operator came to do. */
        primary: 'bg-accent text-accent-fg hover-enabled:bg-accent-hover',
        secondary: 'border border-border-strong bg-surface text-fg hover-enabled:bg-surface-hover',
        ghost: 'bg-transparent text-fg hover-enabled:bg-surface-hover',
        /** Destructive or irreversible: void, write off, refund. */
        danger: 'bg-critical-strong text-critical-on hover-enabled:bg-critical-strong-hover',
      },
      size: {
        sm: 'h-control-sm px-control-sm text-control-sm [&_svg]:size-icon-sm',
        md: 'h-control-md px-control-md text-control-md [&_svg]:size-icon-md',
        lg: 'h-control-lg px-control-lg text-control-lg [&_svg]:size-icon-lg',
      },
      iconOnly: { true: 'px-0', false: '' },
      fullWidth: { true: 'w-full', false: '' },
    },
    compoundVariants: [
      { iconOnly: true, size: 'sm', class: 'w-control-sm' },
      { iconOnly: true, size: 'md', class: 'w-control-md' },
      { iconOnly: true, size: 'lg', class: 'w-control-lg' },
    ],
    defaultVariants: { variant: 'primary', size: 'md', iconOnly: false, fullWidth: false },
  },
);

type StyleProps = Omit<VariantProps<typeof buttonVariants>, 'iconOnly'>;

type NativeProps = Omit<ComponentPropsWithRef<'button'>, 'children' | 'aria-label'>;

/** A text button, or an icon-only button that must carry an accessible name. */
type ContentProps =
  | { iconOnly?: false; children: ReactNode; 'aria-label'?: string }
  | { iconOnly: true; children: ReactElement; 'aria-label': string };

/**
 * Passing `loading` at all requires `loadingLabel`, the text a screen reader
 * hears while the action runs. The UI package holds no copy of its own: every
 * string comes from the caller, through the app's translation layer.
 */
type LoadingProps =
  { loading?: undefined; loadingLabel?: never } | { loading: boolean; loadingLabel: string };

/** `asChild` renders the child element (for example a router link) with button styling. It cannot show loading. */
type CompositionProps =
  | ({ asChild?: false } & LoadingProps)
  | { asChild: true; loading?: undefined; loadingLabel?: never };

export type ButtonProps = NativeProps & StyleProps & ContentProps & CompositionProps;

/**
 * Button.
 *
 * - Defaults to `type="button"`, so a button inside a form never submits by accident.
 * - While `loading`, the button keeps its size and its focus (it uses `aria-disabled`,
 *   not `disabled`, so focus is not dropped to the page), ignores clicks, and
 *   blocks form submission. That is the submit-once guarantee at the counter.
 */
export function Button(props: ButtonProps) {
  const {
    className,
    variant,
    size,
    fullWidth,
    iconOnly = false,
    asChild = false,
    loading,
    loadingLabel,
    children,
    onClick,
    type,
    ...rest
  } = props;

  const classes = cn(buttonVariants({ variant, size, iconOnly, fullWidth }), className);

  if (asChild) {
    return (
      <Slot className={classes} onClick={onClick} {...rest}>
        {children}
      </Slot>
    );
  }

  const busy = loading === true;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      type={type ?? 'button'}
      className={classes}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      data-loading={busy || undefined}
      onClick={handleClick}
      {...rest}
    >
      {/* While busy the label keeps the button's width but leaves the accessibility tree, so the name is the loading label alone. */}
      <span
        aria-hidden={busy || undefined}
        className={cn('inline-flex items-center gap-[inherit]', busy && 'invisible')}
      >
        {children}
      </span>
      {busy ? (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Spinner decorative />
          <span className="sr-only">{loadingLabel}</span>
        </span>
      ) : null}
    </button>
  );
}
