/**
 * The storefront's API in the end-to-end suite (ADR 0054). The storefront reads on its server, where
 * Playwright cannot route a request, and Prism answers every read from the contract's one example. So the
 * e2e build of the storefront talks to this server on 127.0.0.1:4011, which:
 *
 * - answers `viewQuoteByLink` (`GET /shop/quotes/{token}`) from the fixtures below, keyed by the token in
 *   the path: one token per state the page must show, and any other token the contract's 404 envelope, as
 *   the server answers a wrong link;
 * - passes every other request, preflights included, to Prism on 127.0.0.1:4010 unchanged.
 *
 * It keeps no state and has no control route: a fixture is chosen by its token alone, so tests running in
 * parallel never see each other's answers. Writes come from the browser, where each spec routes them with
 * `page.route` and checks what was sent.
 *
 * Run as a Playwright web server: `node support/shopApi.ts` (Node 22 strips the types). Every fixture is
 * the contract's `PublicQuote`, with the amounts the server would answer: nothing here adds one up.
 */
import { createServer, request as forward, type IncomingMessage } from 'node:http';
import type { components } from '@hakorem/api-client';

type PublicQuote = components['schemas']['PublicQuote'];

export const SHOP_API_PORT = 4011;
const PRISM = { host: '127.0.0.1', port: 4010 };

/** Long random tokens, as the server makes them (CR-047): nothing in them names the quote. */
export const TOKENS = {
  issued: 'Zq7vN2kXc9TfL4mWb8RyH1sDj6PaGe3UoQiV5nBxKtE',
  expired: 'r4HwY8eLq2NvC7ZkT1mXs9GbJ3fPaU6oDiRn5WgQyEc',
  superseded: 'M3pXc8VtK1qZr6NwB9yLh4FsJ2dGa7UeTiOn5RkWbQx',
  accepted: 'bT6nQ1wZr8KxV3mLc9YfH2sPj7GaD4UeNoRi5XkEtWq',
  declined: 'Yh2kW9pRc4NxT7vLm1ZsB8fQj3GdA6UeKoEi5MnXtVr',
} as const;

/** Links the server has closed (2.12.0): 422 `QUOTE_LINK_CLOSED`, the reason in `details[0].code`. */
export const CLOSED_TOKENS = {
  EXPIRED: 'Kp4rT8wQz1XnV6cLm3YsB9hFj2GdA7UeNoRi5MkEtWy',
  REPLACED: 'Wx3nB7kQr2ZtV9mLc4YfH1sPj8GaD6UeNoRi5XkEtQp',
  WITHDRAWN: 'Qz8vN1kXc4TfL7mWb2RyH9sDj3PaGe6UoKiV5nBxRtE',
} as const;

/** A token the server never issued: the page must say only that the link is not valid. */
export const UNKNOWN_TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

/**
 * The quote for a bakery: ten crates of big eggs at GH₵55.00 a crate and thirty single eggs at GH₵2.20,
 * delivered for GH₵60.00. The figures are the server's: 55,000 + 6,600 net of lines, 6,000 delivery,
 * GH₵676.00 before tax, GH₵12.00 tax, GH₵688.00 in all.
 */
export const ISSUED_QUOTE: PublicQuote = {
  quoteNo: 'QUO-2026-DDW-000091',
  versionNo: 2,
  status: 'ISSUED',
  validUntil: '2026-11-24T18:00:00Z',
  customerName: 'Akosua Bakery',
  // 2.21.0 and 2.23.0, always sent.
  acceptedName: null,
  decidedAt: null,
  subjectToStock: false,
  lines: [
    {
      description: 'Eggs, big, by the crate of 30',
      quantity: '10.000',
      uom: 'CRATE',
      priceBasis: 'PER_UNIT',
      unitPricePesewas: 5500,
      lineNetPesewas: 55000,
      subjectToStock: false,
    },
    {
      description: 'Eggs, big, single',
      quantity: '30.000',
      uom: 'UNIT',
      priceBasis: 'PER_UNIT',
      unitPricePesewas: 220,
      lineNetPesewas: 6600,
      subjectToStock: false,
    },
  ],
  deliveryFeePesewas: 6000,
  netPesewas: 67600,
  taxPesewas: 1200,
  grossPesewas: 68800,
  currency: 'GHS',
  terms: 'Price valid for seven days. Payment on delivery.',
  deliveryEstimate: 'Delivered to Kasoa on Friday morning',
  documentUrl: null,
};

export const QUOTES: Record<string, PublicQuote> = {
  [TOKENS.issued]: ISSUED_QUOTE,
  [TOKENS.expired]: {
    ...ISSUED_QUOTE,
    quoteNo: 'QUO-2026-DDW-000084',
    versionNo: 1,
    status: 'EXPIRED',
    validUntil: '2026-11-10T18:00:00Z',
  },
  [TOKENS.superseded]: { ...ISSUED_QUOTE, versionNo: 1, status: 'SUPERSEDED' },
  [TOKENS.accepted]: { ...ISSUED_QUOTE, quoteNo: 'QUO-2026-DDW-000088', status: 'ACCEPTED' },
  [TOKENS.declined]: { ...ISSUED_QUOTE, quoteNo: 'QUO-2026-DDW-000089', status: 'DECLINED' },
};

const QUOTE_PATH = /^\/shop\/quotes\/([^/?]+)$/;

function answer(req: IncomingMessage): { status: number; body: unknown } | null {
  const path = (req.url ?? '').split('?')[0] ?? '';
  const match = QUOTE_PATH.exec(path);
  if (req.method !== 'GET' || match === null) return null;
  const quote = QUOTES[decodeURIComponent(match[1] ?? '')];
  if (quote !== undefined) return { status: 200, body: quote };
  const closed = Object.entries(CLOSED_TOKENS).find(
    ([, token]) => token === decodeURIComponent(match[1] ?? ''),
  );
  if (closed !== undefined) {
    // Nothing of the quote: only why the link closed (ADR-0087).
    return {
      status: 422,
      body: {
        error: {
          code: 'QUOTE_LINK_CLOSED',
          message: 'This quote link is closed.',
          correlationId: '019a7b40-0000-7000-8000-000000000422',
          details: [{ field: null, code: closed[0], message: 'The link is closed.' }],
        },
      },
    };
  }
  return {
    status: 404,
    body: {
      error: {
        code: 'NOT_FOUND',
        message: 'The resource was not found.',
        correlationId: '019a7b40-0000-7000-8000-000000000404',
        details: [],
      },
    },
  };
}

export function startShopApi(port = SHOP_API_PORT) {
  const server = createServer((req, res) => {
    const fixed = answer(req);
    if (fixed !== null) {
      res.writeHead(fixed.status, {
        'content-type': 'application/json',
        'x-correlation-id': '019a7b40-0000-7000-8000-000000000001',
        'access-control-allow-origin': req.headers.origin ?? '*',
        'access-control-allow-credentials': 'true',
      });
      res.end(JSON.stringify(fixed.body));
      return;
    }
    const upstream = forward(
      { ...PRISM, method: req.method, path: req.url, headers: req.headers },
      (prism) => {
        res.writeHead(prism.statusCode ?? 502, prism.headers);
        prism.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  server.listen(port, '127.0.0.1');
  return server;
}

// Started directly (the Playwright web server), not when a spec imports the fixtures.
if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  startShopApi();
}
