# Frontend deployment rules

What a host must do to serve the frontend correctly. The pipeline, environments, Caddy configuration and release procedure are specified in the backend's `docs/DEPLOYMENT.md` (read it; this repository never edits it). This document holds the frontend's own requirements on that setup. **F13 applies every rule here** when it wires the deploy, and each rule says how to check it.

## 1. The console is two documents (ADR 0030)

The console's static build (`apps/console/dist`) holds two HTML documents:

| Address                     | Document     | What it is  |
| --------------------------- | ------------ | ----------- |
| `/pos` and `/pos/...`       | `pos.html`   | The till    |
| Every other route           | `index.html` | Back office |
| A file that exists (assets) | the file     |             |

**The rule:** a request for `/pos` or anything under `/pos/` that is not a file is answered with `pos.html`. Every other request that is not a file is answered with `index.html`. The one source of truth is `entryFor` in `apps/console/src/app/entries.ts`. The Vite dev and preview servers already follow it (`vite.config.ts`).

**Why it matters:** a host that answers `index.html` for everything, the usual single-page fallback, serves the back office at `/pos`. The till then shows "This page could not be opened" (it does not loop), and a counter cannot sell.

**What this changes in the backend's `docs/DEPLOYMENT.md`, section 5.1 (Caddy):** the console block today is

```caddyfile
	root * /srv/console/current
	try_files {path} /index.html
	file_server
```

It must become:

```caddyfile
	root * /srv/console/current
	@till path /pos /pos/*
	handle @till {
		try_files {path} /pos.html
		file_server
	}
	handle {
		try_files {path} /index.html
		file_server
	}
```

The owner relays this to the backend track. It is not a contract change, so it does not go in `CONTRACT_REQUESTS.md`.

**How to check it** (F13 smoke suite, against staging and after every deploy):

- `GET /pos` and `GET /pos/anything` return HTML with `<title>HaKorem Farms point of sale</title>`.
- `GET /` and `GET /users` return `<title>HaKorem Farms console</title>`.
- `GET /pos.html` returns the till and `GET /posters` returns the back office.

## 2. The till's on-demand chunks must be available offline

The till loads its shell and sale screen with the document. Every other till screen downloads when it is first opened (PERFORMANCE_BUDGET, "The till loads its sale screen and nothing else"). That is right for the first load and wrong for a till that has lost its connection, so **the service worker (F13) precaches every chunk the till can load on demand**. A cashier who goes offline before ever opening a screen must still be able to open it. The list is the "on demand" set that `pnpm budget:console` prints for `pos.html`, read from `dist/.vite/manifest.json`.

**How to check it:** with the till loaded once and the network then turned off, every till route opens. That is part of F13's "POS shell boots with the network off" smoke test.

## 3. Files in the build that need not be served

`dist/.vite/manifest.json` is the chunk graph that `pnpm budget:console` reads. It names only files the documents already link to, so serving it does no harm, but the console image may leave it out.

## 4. The shop, the console and the API share origins: no CORS (owner, 2026-11-16)

**The decision.** The storefront and the API are served from the same domain, with the API under a path, through the VPS's reverse proxy. The shop on the apex (`https://hakoremfarms.com`), the API under a path of it (for example `https://hakoremfarms.com/api/v1`). There is no CORS for the shop: the browser's calls are same-origin. This replaces, for the shop, the shared brief's "the API on another subdomain" (Deployment, "Data and secrets") and closes A-F7-02.

**Why it fits the storefront as built (F7):**

- The basket, the checkout and "Add to basket" call the API from the browser with credentials, because only the browser holds the guest cart's `__Host-hk_guest` cookie (contract 1.32.0). That cookie is host-only, `Secure`, `SameSite=Strict` and `Path=/`. On one origin it is set and sent on the shop's own host, and no preflight is needed.
- The public pages read the catalogue on the storefront's server.

**What F13 does:**

1. **One variable still decides the API (ADR 0019).** Build the storefront with `HK_API_BASE_URL` set to the absolute same-origin URL, `https://hakoremfarms.com/api/v1` (staging the same on its own host), not the bare path `/api/v1`. Next replaces the one value on the server and in the browser, and the server cannot fetch a relative path. The browser's calls are then same-origin and carry the cookie.
2. **Keep the server's reads on the box.** The storefront container resolves the shop's host name to the reverse proxy (Compose `extra_hosts`, or a network alias on the proxy), so a server-rendered page's API read goes container to proxy to API and never leaves the VPS. No second variable.
3. **The proxy routes the path** to the API container and everything else to the storefront. For example, in the shop's Caddy block, before the storefront's `reverse_proxy`:

   ```caddyfile
   	handle_path /api/* {
   		reverse_proxy api:3000
   	}
   ```

   `handle_path` strips `/api`, so the API keeps serving `/v1/...`. The port and the prefix are the backend's to confirm in its `docs/DEPLOYMENT.md`; the owner relays this, as with section 1.

4. **The API allows the shop's own origin.** Same-origin requests still send `Origin` on a write, and `createCart` "requires an allowed `Origin`". The API's allowed origins list holds `https://hakoremfarms.com` (and staging's), and no CORS headers are needed for it.

**The console too (owner, 2026-11-16, answering the F8 report).** The console's subdomain also sends `/api` to the API through the reverse proxy, like the shop. There is no CORS anywhere in the system.

- **The variable.** Build the console with `HK_API_BASE_URL=/api/v1`. The console is static files with no server of its own, so the bare same-origin path is enough (the e2e build already runs this way with `/mock`, ADR 0025). Staging's build is the same, on its own host.
- **The proxy.** In the console's Caddy block, before the static files and the two-document rule of section 1:

  ```caddyfile
  	handle_path /api/* {
  		reverse_proxy api:3000
  	}
  ```

- **The cookies stay the console's own.** The staff cookies (`__Host-hk_s_at`, `__Host-hk_s_rt`) and the CSRF token are host-only, so they are set on and sent to the console's host only, never the shop's.
- **The till's device credential** (`X-Device-Credential`, ADR 0044) is a request header, not a cookie, and goes to the same origin with no preflight.
- **The API allows the console's origin**, `https://app.hakoremfarms.com` (and staging's), for the `Origin` check on writes.

**How to check it** (F13 smoke suite, against staging and after every deploy):

- `GET https://<shop>/api/v1/health` answers from the API, and `GET https://<shop>/` from the storefront.
- On a product page, "Add to basket" succeeds with no CORS preflight (`OPTIONS`) in the network log, and the response sets `__Host-hk_guest` on the shop's host.
- A category page renders its products with the network log showing no browser call to the API (the read happened on the server).
- `GET https://<console>/api/v1/health` answers from the API; signing in on the console and opening the till make no `OPTIONS` request and no request to another host.

## 5. Never set `HK_REQUESTED_CONTRACT` for a deployed console (ADR 0046)

`HK_REQUESTED_CONTRACT` names the contract requests a build is built against before the contract carries them (`CR-033,CR-059` in the e2e and CI builds, whose fake answers them). A staging or production build leaves it **unset**: the console then calls nothing the contract lacks, and the till says in words that the receipt link waits for the server. A build that sets it with `HK_API_BASE_URL` anything but `/mock` **fails before building**, naming the switches (the owner's condition on ADR 0046).

**How to check it:** the deploy workflow's console build step sets `HK_API_BASE_URL` and nothing named `HK_REQUESTED_CONTRACT`.

## 6. Set `HK_SHOP_URL` for every deployed console (ADR 0056)

The console shows a quote's link once, after it is sent, to copy or send on WhatsApp (the owner, 2026-11-18). The link is the shop's address and the storefront's `/q/{token}` page. The console learns the shop's address only from `HK_SHOP_URL`, read at build time, never from the code.

**What F13 does:** build the console with `HK_SHOP_URL` set to the shop's own origin, the same as the storefront's `NEXT_PUBLIC_SITE_URL`:

| Build      | `HK_API_BASE_URL` | `HK_SHOP_URL`                     |
| ---------- | ----------------- | --------------------------------- |
| production | `/api/v1`         | `https://hakoremfarms.com`        |
| staging    | `/api/v1`         | the staging shop's own `https://` |
| e2e and CI | `/mock`           | `http://127.0.0.1:3100`           |

A build for any API but `/mock` without it **fails before building**, naming the variable: the token in a link is answered once, so a console that could not show it would lose it.

**How to check it:** the deploy workflow's console build step sets `HK_SHOP_URL`; the smoke suite on staging sends a quote and finds its link beginning with the staging shop's address.
