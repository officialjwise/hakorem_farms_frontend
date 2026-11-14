import { boot } from './app/boot';
import { routes } from './app/routes';

/** The back office document, index.html (ADR 0030). The till is pos.html, from pos/main.tsx. */
void boot({ routes, namespaces: ['common', 'shell', 'auth', 'iam', 'audit'] });
