import { boot } from '../app/boot';
import { posRoutes } from './routes';

/**
 * The till document, pos.html (ADR 0030). It imports nothing from the back office's routes, so a till
 * downloads the POS shell, the sign-in screens and what they share, and none of the back office screens.
 */
void boot({ routes: posRoutes, namespaces: ['common', 'shell', 'auth'] });
