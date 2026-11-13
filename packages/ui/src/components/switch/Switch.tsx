import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Check } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/cn';
import { useRequireLabel } from '../../lib/useRequireLabel';

export type SwitchProps = Omit<
  ComponentPropsWithRef<typeof SwitchPrimitive.Root>,
  'children' | 'asChild'
>;

/**
 * Switch. One control with one label, so it always goes inside a Field (ADR
 * 0009); it has no label prop and holds no copy. On is the thumb at the end
 * edge with a tick in it, so state is position and shape as well as colour.
 * It throws after mount with no name.
 */
export function Switch({ className, ref, ...props }: SwitchProps) {
  const named = useRequireLabel<HTMLButtonElement>('Switch', ref);
  return (
    <SwitchPrimitive.Root
      ref={named}
      data-slot="switch"
      className={cn(
        'peer group inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-border-strong bg-surface-sunken p-0.5',
        'outline-focus outline-offset-2 focus-visible:outline-2',
        'transition-colors duration-fast ease-standard',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        'aria-invalid:border-critical',
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'flex size-5 items-center justify-center rounded-full border border-border-strong bg-surface text-fg',
          'transition-transform duration-fast ease-standard',
          'data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5',
          'group-disabled:border-border group-disabled:text-fg-disabled',
        )}
      >
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="hidden size-icon-sm group-data-[state=checked]:block"
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}
