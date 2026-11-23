/**
 * The storefront's API in the end-to-end suite (ADR 0054). The storefront reads on its server, where
 * Playwright cannot route a request, and Prism answers every read from the contract's one example. So the
 * e2e build of the storefront talks to this server on 127.0.0.1:4011, which:
 *
 * - answers `viewQuoteByLink` (`GET /shop/quotes/{token}`) from the fixtures below, keyed by the token in
 *   the path: one token per state the page must show, and any other token the contract's 404 envelope, as
 *   the server answers a wrong link;
 * - answers `getPublicReceipt` (`GET /shop/receipts/{token}`) the same way (CR-033). A token without the
 *   till's shape is answered 500, so a page that sent one would show its error state, not its 404: that
 *   is how a spec sees the page made no request for it;
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
type PublicReceipt = components['schemas']['PublicReceipt'];

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

/** Receipt links as the till makes them (CR-033): 16 random bytes, base64url, 22 characters. */
export const RECEIPT_TOKENS = {
  recorded: 'Rc7vN2kXc9TfL4mWb8RyQ1',
  noBusiness: 'Nb4rT8wQz1XnV6cLm3YsB9',
  /** The server fails (500), with a reference. */
  failing: 'Fx3nB7kQr2ZtV9mLc4YfH1',
  /** The connection drops before any answer. */
  dropped: 'Dz8vN1kXc4TfL7mWb2RyH9',
} as const;

/** The till's shape, but never sent with a sale: the server's one 404. */
export const UNKNOWN_RECEIPT_TOKEN = 'Uk2kW9pRc4NxT7vLm1ZsB8';

/**
 * A counter sale at the Dodowa shop: two crates of big eggs at GH₵55.00, a goat meat pack weighed at
 * 14.850 kg at GH₵26.00 a kg, and a live goat by its tag at GH₵1,200.00. Paid GH₵1,000.00 by mobile money
 * taken offline and GH₵696.10 in cash from GH₵700.00. The figures are the server's: 11,000 + 38,610 +
 * 120,000 is GH₵1,696.10, and the change GH₵3.90.
 */
export const RECORDED_RECEIPT: PublicReceipt = {
  state: 'RECORDED',
  saleReference: 'SO-2026-DDW-004311',
  receiptNo: 'RCP-2026-DDW-T1-006214',
  occurredAt: '2026-11-21T10:05:41Z',
  validUntil: '2027-11-21T10:05:41Z',
  business: { name: 'HaKorem Farms', phone: '+233302123456', address: 'Akuse Road, Dodowa' },
  lines: [
    {
      name: 'Eggs, big, by the crate of 30',
      quantity: '2.000',
      saleUom: 'CRATE',
      weightKg: null,
      stockUnitIdentifier: null,
      unitPricePesewas: 5500,
      amountPesewas: 11000,
    },
    {
      name: 'Goat meat, 15 kg pack',
      quantity: '1.000',
      saleUom: 'PACK',
      weightKg: '14.850',
      stockUnitIdentifier: 'LOT-2026-DDW-0193',
      unitPricePesewas: 2600,
      amountPesewas: 38610,
    },
    {
      name: 'Goat, West African Dwarf',
      quantity: '1.000',
      saleUom: 'HEAD',
      weightKg: null,
      stockUnitIdentifier: 'GH-DDW-0042',
      unitPricePesewas: 120000,
      amountPesewas: 120000,
    },
  ],
  totalPesewas: 169610,
  tenders: [
    { name: 'MTN Mobile Money', amountPesewas: 100000, tenderedPesewas: null, unverified: true },
    { name: 'Cash', amountPesewas: 69610, tenderedPesewas: 70000, unverified: false },
  ],
  changePesewas: 390,
  currency: 'GHS',
};

export const RECEIPTS: Record<string, PublicReceipt> = {
  [RECEIPT_TOKENS.recorded]: RECORDED_RECEIPT,
  [RECEIPT_TOKENS.noBusiness]: { ...RECORDED_RECEIPT, business: null },
};

const QUOTE_PATH = /^\/shop\/quotes\/([^/?]+)$/;
const RECEIPT_PATH = /^\/shop\/receipts\/([^/?]*)$/;
const RECEIPT_TOKEN = /^[A-Za-z0-9_-]{22,86}$/;

const NOT_FOUND = {
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

function serverError(correlationId: string) {
  return {
    status: 500,
    body: {
      error: { code: 'INTERNAL', message: 'Something went wrong.', correlationId, details: [] },
    },
  };
}

/** A receipt by its link: the fixture for the token, a failure, or the one 404 for everything else. */
function receiptAnswer(token: string): { status: number; body: unknown } | 'drop' {
  if (!RECEIPT_TOKEN.test(token)) return serverError('019a7b40-0000-7000-8000-00000000bad0');
  if (token === RECEIPT_TOKENS.failing) return serverError('019a7b40-0000-7000-8000-0000000f500a');
  if (token === RECEIPT_TOKENS.dropped) return 'drop';
  const receipt = RECEIPTS[token];
  return receipt === undefined ? NOT_FOUND : { status: 200, body: receipt };
}

function answer(req: IncomingMessage): { status: number; body: unknown } | 'drop' | null {
  const path = (req.url ?? '').split('?')[0] ?? '';
  const receipt = RECEIPT_PATH.exec(path);
  if (req.method === 'GET' && receipt !== null)
    return receiptAnswer(decodeURIComponent(receipt[1] ?? ''));
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
    if (fixed === 'drop') {
      req.socket.destroy();
      return;
    }
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
