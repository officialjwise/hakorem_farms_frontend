import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { VariantProps } from 'class-variance-authority';
import { Check, ChevronDown } from 'lucide-react';
import {
  useId,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type KeyboardEvent,
} from 'react';
import { cn } from '../../lib/cn';
import { useRequireLabel } from '../../lib/useRequireLabel';
import { inputVariants } from '../input/Input';
import { usePortalContainer } from '../ui-provider/UIProvider';

export interface ComboboxOption {
  value: string;
  /** Already translated. */
  label: string;
  disabled?: boolean;
}

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/** Passing `loading` at all requires `loadingLabel`, the text announced while options load. */
type LoadingProps =
  { loading?: undefined; loadingLabel?: never } | { loading: boolean; loadingLabel: string };

type NativeProps = Omit<
  ComponentPropsWithRef<'input'>,
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'size'
  | 'type'
  | 'children'
  | 'role'
  | 'aria-expanded'
  | 'aria-controls'
  | 'aria-activedescendant'
  | 'aria-autocomplete'
>;

export type ComboboxProps<L extends string = string> = NativeProps &
  VariantProps<typeof inputVariants> &
  LoadingProps & {
    options: readonly ComboboxOption[];
    /** The chosen option's value, or null. */
    value?: string | null;
    defaultValue?: string | null;
    onValueChange?: (value: string | null) => void;
    /**
     * The text in the box. Pass it with `onInputValueChange` to drive the
     * options yourself (async search): the options are then shown as given.
     * Without it the box is uncontrolled and filters the options by "contains".
     */
    inputValue?: string;
    onInputValueChange?: (text: string) => void;
    /** Required. The accessible name of the list. */
    listLabel: NonEmpty<L>;
    /** Shown and announced when nothing matches. */
    noResultsLabel: string;
  };

const optionId = (base: string, index: number) => `${base}-option-${index}`;

/**
 * Combobox (ADR 0010). An editable combobox with list autocomplete, following
 * the ARIA APG pattern, on a Radix Popover that never takes focus: the input
 * keeps it, and `aria-activedescendant` points at the highlighted option.
 *
 * The input is the Field-wired control. Keys: ArrowDown opens and moves,
 * ArrowUp moves, Home and End jump (while open), Enter chooses, Escape closes
 * and a second Escape clears, Tab closes without choosing.
 */
export function Combobox<L extends string>({
  options,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  inputValue: inputValueProp,
  onInputValueChange,
  listLabel,
  noResultsLabel,
  loading,
  loadingLabel,
  size,
  className,
  disabled,
  onBlur,
  onKeyDown,
  ref,
  ...inputProps
}: ComboboxProps<L>) {
  if (listLabel.trim() === '') {
    throw new Error('Combobox needs a non-empty listLabel.');
  }
  const container = usePortalContainer();
  const input = useRequireLabel<HTMLInputElement>('Combobox', ref);
  const baseId = useId();
  const listId = `${baseId}-list`;

  const valueControlled = valueProp !== undefined;
  const [valueState, setValueState] = useState<string | null>(defaultValue);
  const value = valueControlled ? valueProp : valueState;
  const selected = options.find((o) => o.value === value) ?? null;

  const textControlled = inputValueProp !== undefined;
  const [textState, setTextState] = useState(selected?.label ?? '');
  const text = textControlled ? inputValueProp : textState;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const setText = (next: string) => {
    if (!textControlled) setTextState(next);
    onInputValueChange?.(next);
  };
  const setValue = (next: string | null) => {
    if (!valueControlled) setValueState(next);
    onValueChange?.(next);
  };

  // Uncontrolled text filters by "contains"; the full list shows while the box holds the chosen label.
  const needle = text.toLowerCase();
  const visible =
    textControlled || needle === '' || (selected !== null && text === selected.label)
      ? options
      : options.filter((o) => o.label.toLowerCase().includes(needle));
  const isLoading = loading === true;
  const hasOptions = visible.length > 0;
  const showPanel = open;
  const listRendered = open && hasOptions;

  const openWith = (index: number) => {
    setOpen(true);
    setActive(index);
  };
  const enabledIndexes = visible.flatMap((o, i) => (o.disabled ? [] : [i]));
  const step = (from: number, delta: 1 | -1) => {
    const count = enabledIndexes.length;
    if (count === 0) return -1;
    const at = enabledIndexes.indexOf(from);
    const next = at === -1 ? (delta === 1 ? 0 : count - 1) : (at + delta + count) % count;
    return enabledIndexes[next] ?? -1;
  };

  const choose = (index: number) => {
    const option = visible[index];
    if (option === undefined || option.disabled) return;
    setValue(option.value);
    setText(option.label);
    setOpen(false);
    setActive(-1);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setText(next);
    setOpen(true);
    setActive(-1);
    if (next === '' && value !== null) setValue(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openWith(selected ? visible.indexOf(selected) : step(-1, 1));
        else setActive(step(active, 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openWith(selected ? visible.indexOf(selected) : step(-1, -1));
        else setActive(step(active, -1));
        break;
      case 'Home':
        if (open && hasOptions) {
          event.preventDefault();
          setActive(enabledIndexes[0] ?? -1);
        }
        break;
      case 'End':
        if (open && hasOptions) {
          event.preventDefault();
          setActive(enabledIndexes[enabledIndexes.length - 1] ?? -1);
        }
        break;
      case 'Enter':
        if (open && active >= 0) {
          event.preventDefault();
          choose(active);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
          setActive(-1);
        } else if (text !== '') {
          event.preventDefault();
          setText('');
          if (value !== null) setValue(null);
        }
        break;
      case 'Tab':
        setOpen(false);
        setActive(-1);
        break;
    }
  };

  return (
    <PopoverPrimitive.Root open={disabled ? false : open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div data-slot="combobox" className="relative w-full">
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listRendered ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              listRendered && active >= 0 ? optionId(baseId, active) : undefined
            }
            autoComplete="off"
            disabled={disabled}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={(event) => {
              onBlur?.(event);
              // Leaving the box abandons half-typed text: it snaps back to the chosen label.
              const label = selected?.label ?? '';
              if (text !== label && !textControlled) setTextState(label);
              setOpen(false);
              setActive(-1);
            }}
            onMouseDown={() => {
              if (!open && !disabled) setOpen(true);
            }}
            className={cn(inputVariants({ size }), 'pe-10', className)}
            {...inputProps}
          />
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute inset-e-3 top-1/2 size-icon-md -translate-y-1/2 text-fg-muted"
          />
        </div>
      </PopoverPrimitive.Anchor>
      {container && showPanel ? (
        <PopoverPrimitive.Portal container={container}>
          <PopoverPrimitive.Content
            role="presentation"
            data-slot="combobox-content"
            sideOffset={4}
            align="start"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            // Escape and outside clicks are handled by the input, which owns focus.
            onEscapeKeyDown={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            className="z-dropdown max-h-64 w-(--radix-popover-trigger-width) overflow-auto rounded-md border border-border-strong bg-surface p-1 text-fg shadow-md"
          >
            {listRendered ? (
              <div
                id={listId}
                role="listbox"
                aria-label={listLabel}
                aria-busy={isLoading || undefined}
              >
                {visible.map((option, index) => {
                  const chosen = option.value === value;
                  return (
                    <div
                      key={option.value}
                      id={optionId(baseId, index)}
                      role="option"
                      tabIndex={-1}
                      aria-selected={chosen}
                      aria-disabled={option.disabled || undefined}
                      data-active={index === active || undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseMove={() => {
                        if (!option.disabled && active !== index) setActive(index);
                      }}
                      onClick={() => choose(index)}
                      className={cn(
                        'relative flex h-control-md cursor-pointer items-center rounded-sm ps-8 pe-control-md text-control-md select-none',
                        'data-active:bg-surface-hover data-active:outline-2 data-active:outline-focus',
                        'aria-disabled:cursor-not-allowed aria-disabled:text-fg-disabled',
                      )}
                    >
                      {chosen ? (
                        <Check aria-hidden="true" className="absolute start-2 size-icon-md" />
                      ) : null}
                      <span className="truncate">{option.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div
              role="status"
              aria-live="polite"
              className={cn(
                'px-control-md text-control-md text-fg-muted',
                hasOptions && !isLoading ? 'sr-only' : 'flex h-control-md items-center',
              )}
            >
              {isLoading ? loadingLabel : hasOptions ? '' : noResultsLabel}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      ) : null}
    </PopoverPrimitive.Root>
  );
}
