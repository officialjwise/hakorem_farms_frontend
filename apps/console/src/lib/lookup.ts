import { CircleHelp } from 'lucide-react';

/**
 * A server enum read through a presentation map, safely. The contract can gain a value (FilePurpose gained
 * EXPORT in 1.17.0) before this build knows it; a strict lookup would hand back undefined and the screen
 * would crash on `.tone`. An unknown value gets the fallback instead, and the screen shows the raw code.
 */
export function lookup<K extends string, V, F = V>(
  map: Record<K, V>,
  value: string,
  fallback: F,
): V | F {
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value as K] : fallback;
}

/** How a status this build does not know yet looks: slate, a question mark, and the raw code as words. */
export const UNKNOWN = { tone: 'slate', icon: CircleHelp } as const;
