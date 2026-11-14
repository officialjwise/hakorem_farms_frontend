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
