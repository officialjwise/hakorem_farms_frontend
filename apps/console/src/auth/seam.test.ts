import { describe, expect, it } from 'vitest';

// Every source file as text, so the test can read its imports without running anything.
const files = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('auth seam (ADR 0012, ADR 0024)', () => {
  it('the app ships the real client: no app source imports test support (the fake auth server)', () => {
    const importers = Object.entries(files)
      .filter(([, text]) => /from\s+['"][^'"]*\/test\/[^'"]+['"]/.test(text))
      .map(([path]) => path)
      .filter((path) => !path.includes('.test.') && !path.startsWith('/src/test/'));
    expect(importers).toEqual([]);
  });

  it('client.ts, the seam, builds the real client on the generated API client (ADR 0024)', () => {
    expect(files['/src/auth/client.ts']).toMatch(/from '\.\/apiAuthClient'/);
    expect(files['/src/auth/apiAuthClient.ts']).toMatch(/from '@hakorem\/api-client'/);
  });

  // The boot both documents share (ADR 0030) is the one file; main.tsx was, before the till had its own.
  it('no screen imports the client export directly; only app/boot.tsx hands it to AuthProvider', () => {
    const importers = Object.entries(files)
      .filter(([, text]) =>
        /from\s+['"][^'"]*auth\/client['"]|from\s+['"]\.\/client['"]/.test(text),
      )
      .map(([path]) => path)
      .filter((path) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'));
    expect(importers).toEqual(['/src/app/boot.tsx']);
  });

  it('no file calls fetch directly (the contract rule)', () => {
    const offenders = Object.entries(files)
      .filter(([path, text]) => !path.includes('.test.') && /\bfetch\s*\(/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
