import * as SelectPrimitive from '@radix-ui/react-select';
import type { VariantProps } from 'class-variance-authority';
import { Check, ChevronDown } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/cn';
import { useRequireLabel } from '../../lib/useRequireLabel';
import { inputVariants } from '../input/Input';
import { usePortalContainer } from '../ui-provider/UIProvider';

export interface SelectOption {
  value: string;
  /** Already translated. */
  label: string;
  disabled?: boolean;
}

export type SelectProps = Omit<
  ComponentPropsWithRef<'button'>,
  'value' | 'defaultValue' | 'onChange' | 'children' | 'type' | 'name'
> &
  VariantProps<typeof inputVariants> & {
    options: readonly SelectOption[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    /** Shown while nothing is chosen. A hint, never a label: the label comes from Field. */
    placeholder?: string;
    name?: string;
    /** Field passes this through; it is forwarded to the Radix root. */
    required?: boolean;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
  };

/**
 * Select. Radix Select, themed. The trigger is the Field-wired control: it
 * receives Field's id, aria-describedby, aria-invalid and required. The list
 * portals into the themed target (ADR 0004), and the chosen row carries a
 * check mark, so selection is never colour alone.
 */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  name,
  required,
  disabled,
  open,
  defaultOpen,
  onOpenChange,
  size,
  className,
  ref,
  ...triggerProps
}: SelectProps) {
  const container = usePortalContainer();
  const labelled = useRequireLabel<HTMLButtonElement>('Select', ref);
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      required={required}
      disabled={disabled}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <SelectPrimitive.Trigger
        ref={labelled}
        data-slot="select"
        className={cn(
          inputVariants({ size }),
          'inline-flex items-center justify-between gap-2 text-start',
          'data-placeholder:text-fg-muted',
          className,
        )}
        {...triggerProps}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <ChevronDown aria-hidden="true" className="size-icon-md shrink-0 text-fg-muted" />
      </SelectPrimitive.Trigger>
      {container ? (
        <SelectPrimitive.Portal container={container}>
          <SelectPrimitive.Content
            data-slot="select-content"
            position="popper"
            sideOffset={4}
            className={cn(
              'z-dropdown w-(--radix-select-trigger-width) overflow-hidden rounded-md border border-border-strong bg-surface text-fg shadow-md',
              'max-h-(--radix-select-content-available-height)',
            )}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'relative flex h-control-md cursor-pointer items-center rounded-sm ps-8 pe-control-md text-control-md select-none',
                    'outline-none data-highlighted:bg-surface-hover data-highlighted:outline-2 data-highlighted:outline-focus',
                    'data-disabled:cursor-not-allowed data-disabled:text-fg-disabled',
                  )}
                >
                  <span className="absolute start-2 inline-flex items-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check aria-hidden="true" className="size-icon-md" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      ) : null}
    </SelectPrimitive.Root>
  );
}
