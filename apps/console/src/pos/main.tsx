import { boot } from '../app/boot';
import { ENTRY_NAMESPACES } from '../app/entries';
import { consoleApi } from '../data/api';
import { attachDeviceCredential } from '../data/session';
import { browserStore, configureTill } from './offline/till';
import { posRoutes } from './routes';

// The till on this device (ADR 0043), and its credential on the operations that ask for it (ADR 0044).
const till = configureTill({ store: browserStore(), call: consoleApi.call });
attachDeviceCredential(() => till.getState().snapshot?.device?.credential ?? null);
void till.start();

/**
 * The till document, pos.html (ADR 0030). It imports nothing from the back office's routes, and loads
 * every till route but the sale screen on demand (PERFORMANCE_BUDGET, "The till loads its sale screen and
 * nothing else").
 */
void boot({ routes: posRoutes, namespaces: ENTRY_NAMESPACES.pos });
