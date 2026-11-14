import { useCallback, useState } from 'react';

export interface CursorPages {
  /** The cursor for the page on screen: undefined for the first page. Pass it as `query.cursor`. */
  cursor: string | undefined;
  /** 1 for the first page. For "Page 2" in the pagination summary; there is no total (DATA_CONVENTIONS). */
  page: number;
  hasPrevious: boolean;
  /** Moves on, with the page's `nextCursor`. */
  next: (nextCursor: string) => void;
  previous: () => void;
  /** Back to the first page, for example when a filter changes. */
  reset: () => void;
}

/**
 * Cursor pagination's one piece of screen state (DATA_CONVENTIONS, "Pagination"). The cursors already
 * visited are kept as a stack, so Previous returns to the exact page, and each page is its own cache entry.
 */
export function useCursorPages(): CursorPages {
  const [stack, setStack] = useState<(string | undefined)[]>([undefined]);
  const next = useCallback((nextCursor: string) => setStack((s) => [...s, nextCursor]), []);
  const previous = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const reset = useCallback(() => setStack([undefined]), []);
  return {
    cursor: stack.at(-1),
    page: stack.length,
    hasPrevious: stack.length > 1,
    next,
    previous,
    reset,
  };
}
