import { boot } from '../app/boot';
import { INVESTOR_NAMESPACES } from './entry';
import { investorRoutes } from './routes';

/**
 * The investor portal (ADR 0058), its own build on its own host. It imports nothing from the back office's
 * or the till's routes. An investor signs in here with `loginInvestor`, at `/login` on the portal's host,
 * and reads only the investor operations, which the server scopes to the session's investor. It registers
 * no service worker: the console's is for the till and the back office (ADR 0013), and an investor reads
 * the portal online.
 */
void boot({
  routes: investorRoutes,
  namespaces: INVESTOR_NAMESPACES,
  realm: 'INVESTOR',
  serviceWorker: false,
});
