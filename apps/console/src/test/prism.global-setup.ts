/**
 * Starts the real Prism mock for the integration suite (ADR 0019, docs/DATA_CONVENTIONS.md).
 *
 * This is the same pinned `prism mock` that `pnpm dev:mock` runs, against the committed
 * contract/openapi.yaml, on port 4010. If something already answers there (a developer's own
 * `pnpm dev:mock`), it is reused. If Prism cannot be started the suite FAILS: there is no fallback to a
 * fake server and no skipped test.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { get } from 'node:http';
import { fileURLToPath } from 'node:url';

export const PRISM_URL = 'http://127.0.0.1:4010';
const START_TIMEOUT_MS = 90_000;

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

/** Whether something answers `GET /health` with 200. Plain node:http: no screen or hook calls fetch, and neither does this. */
function answers(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = get(
      `${PRISM_URL}/health`,
      { headers: { Cookie: '__Host-hk_s_at=probe' }, timeout: 2_000 },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

let prism: ChildProcess | undefined;

export default async function setup(): Promise<() => Promise<void>> {
  if (await answers()) return async () => undefined;

  const output: string[] = [];
  prism = spawn(
    `${repoRoot}node_modules/.bin/prism`,
    ['mock', 'contract/openapi.yaml', '--host', '127.0.0.1', '--port', '4010'],
    { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  prism.stdout?.on('data', (chunk: Buffer) => output.push(String(chunk)));
  prism.stderr?.on('data', (chunk: Buffer) => output.push(String(chunk)));
  let exited = false;
  prism.once('exit', () => {
    exited = true;
  });

  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited) break;
    if (await answers()) return stop;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await stop();
  throw new Error(
    `Prism did not start on ${PRISM_URL}. The integration suite needs the real mock and will not fall back to a fake.\n${output.join('').slice(-2000)}\nRun it yourself with: pnpm dev:mock`,
  );
}

async function stop(): Promise<void> {
  if (prism === undefined || prism.exitCode !== null) return;
  const child = prism;
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 3_000).unref();
  });
}
