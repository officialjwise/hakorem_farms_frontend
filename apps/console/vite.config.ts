import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // HK_API_BASE_URL is the one variable that decides mock or real API (ADR 0019). The literal
  // `process.env.HK_API_BASE_URL` in @hakorem/api-client is replaced here, at build time.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    define: { 'process.env.HK_API_BASE_URL': JSON.stringify(env['HK_API_BASE_URL'] ?? '') },
    build: { sourcemap: true },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['src/**/*.integration.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
