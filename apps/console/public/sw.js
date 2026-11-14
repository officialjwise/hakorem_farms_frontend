/*
 * Minimal service worker (ADR 0013). It makes the console installable and takes control at once.
 * It deliberately caches nothing yet: the per-route caching strategy, the offline queue and the update
 * flow that cannot lose an open sale are F13 work. Caching badly is worse than not caching.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
