import { boot } from './app/boot';
import { ENTRY_NAMESPACES } from './app/entries';
import { routes } from './app/routes';

/** The back office document, index.html (ADR 0030). The till is pos.html, from pos/main.tsx. */
void boot({ routes, namespaces: ENTRY_NAMESPACES['back-office'] });
