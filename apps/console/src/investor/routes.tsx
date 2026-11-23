import type { RouteObject } from 'react-router';
import { appRoutes } from '../app/appRoutes';
import { lazyScreen } from '../app/LazyScreen';
import { authRoutes } from '../app/authRoutes';
import type { RouteHandle } from '../routing/handle';
import { NotFoundScreen } from '../screens/NotFoundScreen';
import { InvestorShell } from './InvestorShell';

/** An investor's page: any investor session, since the server scopes every figure to it (ADR 0058). */
const portal: RouteHandle = { permission: null, shell: 'investor', crumb: 'investor' };

const SCREENS = {
  summary: () => import('./InvestorScreens').then((m) => m.SummaryScreen),
  capital: () => import('./InvestorScreens').then((m) => m.CapitalScreen),
  distributions: () => import('./InvestorScreens').then((m) => m.DistributionsScreen),
  statement: () => import('./InvestorScreens').then((m) => m.StatementScreen),
  documents: () => import('./InvestorScreens').then((m) => m.DocumentsScreen),
};

/**
 * The portal's protected routes, at the root of the portal's own host (ADR 0058). Each leaf declares its
 * handle, as in the console's documents (routes.test.ts checks).
 */
export const investorProtectedRoutes: RouteObject[] = [
  {
    element: <InvestorShell />,
    handle: portal,
    children: [
      { index: true, element: lazyScreen(SCREENS.summary), handle: portal },
      { path: 'capital', element: lazyScreen(SCREENS.capital), handle: portal },
      { path: 'distributions', element: lazyScreen(SCREENS.distributions), handle: portal },
      { path: 'statement', element: lazyScreen(SCREENS.statement), handle: portal },
      { path: 'documents', element: lazyScreen(SCREENS.documents), handle: portal },
    ],
  },
];

/**
 * The portal's routes. It renders the shared sign-in screens itself, so an investor signs in at `/login` on
 * the portal's host with `loginInvestor` and never meets the staff sign-in. They load with the document, as
 * the back office's do. The portal is its own build, so how it splits its code changes nothing in the
 * console's (ADR 0058).
 */
export const investorRoutes: RouteObject[] = appRoutes({
  publicRoutes: authRoutes,
  protectedRoutes: investorProtectedRoutes,
  rest: [{ path: '*', element: <NotFoundScreen /> }],
});
