import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
// The names alone, not the manifest: this runs in the browser (render.ts, renderColorNames).
import colorNames from '../tokens/generated/color-names.json';

/**
 * tailwind-merge taught the HaKorem token utilities, so `cn('h-control-md', 'h-control-lg')`
 * keeps the last one and `cn('text-sm', 'text-fg')` keeps both (size and colour).
 */
const twMerge = extendTailwindMerge<'edge'>({
  extend: {
    theme: {
      color: colorNames,
      text: ['control-sm', 'control-md', 'control-lg', 'cell', 'head'],
    },
    classGroups: {
      h: [{ h: ['control-sm', 'control-md', 'control-lg', 'row', 'head'] }],
      w: [{ w: ['control-sm', 'control-md', 'control-lg'] }],
      px: [{ px: ['control-sm', 'control-md', 'control-lg', 'cell'] }],
      py: [{ py: ['cell'] }],
      size: [{ size: ['icon-sm', 'icon-md', 'icon-lg'] }],
      z: [
        { z: ['raised', 'sticky', 'dropdown', 'overlay', 'modal', 'popover', 'toast', 'tooltip'] },
      ],
      duration: [{ duration: ['fast', 'base'] }],
      animate: [{ animate: ['spin-token'] }],
      edge: [{ edge: colorNames }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
