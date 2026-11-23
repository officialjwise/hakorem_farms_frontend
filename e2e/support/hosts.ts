/**
 * Where the e2e suite serves each build. The console (the till and the back office) and the investor
 * portal are separate builds on separate hosts in production (ADR 0058), each with its own host-only session
 * cookie. Here they are two `vite preview` servers on different host names, so a page on one is never the
 * other's origin, and the fake API keeps one cookie jar per host (fakeApi.ts).
 */
export const CONSOLE_URL = 'http://localhost:4173';
export const INVESTOR_URL = 'http://127.0.0.1:4174';
