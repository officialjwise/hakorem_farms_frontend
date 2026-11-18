# 0055. The console's shop address is a build setting, `HK_SHOP_URL`, and a build for a real API fails without it

- Status: accepted (owner, 2026-11-18: "Take the shop's web address from the build's deployment settings, never hard-coded, and record that setting where F13 will read it")
- Date: 2026-11-18
- Session: F10m

## Context

`issueQuoteVersion` answers a quote's link token once, in the answer that made it, and the server keeps only its hash (2.12.0, CR-047). Until B11 nothing sends it to the customer. The owner decided the console shows the link once after a quote is sent, with a copy button and "Send on WhatsApp", and that a new link can be made from the quote (asking again for an issued version answers a fresh token and sends nothing).

A link is the shop's address and the storefront's page for it, `/q/{token}`. The console is served from its own subdomain (DEPLOYMENT.md, section 4) and knows only its API (`HK_API_BASE_URL`, ADR 0019). It has no way to know the shop's address except to be told.

## Options considered

1. **Read it from the API** (`getShopProfile` or `getBusinessProfile`). Neither carries the shop's web address, and a request for one would wait on the backend.
2. **Work it out from the console's own host** (`app.` stripped). That is the hard-coded domain plan by another name, and wrong for any staging host that does not follow it.
3. **A build setting, `HK_SHOP_URL`, read at build time like `HK_API_BASE_URL`.** Each deployment sets its own.

## Decision

Option 3.

- **`HK_SHOP_URL`** is the shop's http(s) address, with no query or fragment (`https://hakoremfarms.com`, staging its own). `vite.config.ts` replaces the literal `process.env.HK_SHOP_URL`; `lib/shopAddress.ts` reads, checks and joins it (`quoteLink`). Unit tests read it live.
- **A build or dev server for any API but `/mock` fails without it**, before anything is built, naming the variable (`assertShopUrlSet`), as ADR 0046's switches do. A link the console cannot show is lost: the token is answered once. `vite preview` only serves a finished build and is not checked again.
- **A build against the mock may leave it unset**: the panel then says in words that this console was built without the shop's address, and that a new link can be made from the quote. The e2e and CI builds set it to the suite's storefront, `http://127.0.0.1:3100`.
- **WhatsApp** is opened at its own public address, `https://wa.me/<number>?text=<message>`, the number the quote's `contactPhone` in E.164 without the `+`, the message from the catalogue (`wholesale.link.message`). It opens in a new tab with `noopener noreferrer`.

## Consequences

- F13 sets `HK_SHOP_URL` in the console's deploy build (DEPLOYMENT.md, section 6); forgetting it fails the build rather than shipping a console that cannot hand out a link.
- The storefront's own address is still its `NEXT_PUBLIC_SITE_URL` (canonical URLs, the sitemap); the two are the same origin and set side by side.
- Revisit if the API answers the shop's address (the business profile), or B11 sends the link itself.
