import { boot } from '../app/boot';
import { ENTRY_NAMESPACES, INVESTOR_BASENAME } from '../app/entries';
import { investorRoutes } from './routes';

/**
 * The investor portal, investor.html (ADR 0058). It imports nothing from the back office's or the till's
 * routes. An investor signs in here with `loginInvestor`, under `/investor`, and reads only the investor
 * operations, which the server scopes to the session's investor.
 */
void boot({
  routes: investorRoutes,
  namespaces: ENTRY_NAMESPACES.investor,
  realm: 'INVESTOR',
  basename: INVESTOR_BASENAME,
});
