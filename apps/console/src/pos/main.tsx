import { boot } from '../app/boot';
import { ENTRY_NAMESPACES } from '../app/entries';
import { posRoutes } from './routes';

/**
 * The till document, pos.html (ADR 0030). It imports nothing from the back office's routes, and loads
 * every till route but the sale screen on demand (PERFORMANCE_BUDGET, "The till loads its sale screen and
 * nothing else").
 */
void boot({ routes: posRoutes, namespaces: ENTRY_NAMESPACES.pos });
