/**
 * Regenerates packages/api-client/src/generated from contract/openapi.yaml (ADR 0018).
 *
 *   schema.ts      the contract's types, written by openapi-typescript
 *   operations.ts  one row per operation id: method, path, and which headers the contract requires
 *                  (Idempotency-Key, X-CSRF-Token). The data layer derives query keys and mutation
 *                  headers from this table, so nothing about an operation is written by hand. The rows
 *                  are typed by an interface and travel as one packed string (ADR 0059, `src/manifest.ts`).
 *
 *   permissions.ts each operation's `x-permission`, for the tests and the e2e fake. No app imports it.
 *
 *   seededRoles.ts the roles the backend seeds, from `components.x-seeded-roles` (CR-023): each role's code,
 *                  name, TOTP rule and permissions, so the test fakes can be checked against the real seed.
 *
 * A `format: binary` property is typed `Blob`, and each row says whether its body is JSON or
 * `multipart/form-data`, so `call()` can send a file (ADR 0037).
 *
 * `--check` regenerates in memory and fails if the committed files differ, so a stale client cannot
 * merge. Nothing here is hand-edited, and `generated/` is ignored by Prettier and ESLint.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';
import { parse } from 'yaml';
import { packOperations, type PackedRow } from '../src/manifest';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..');
const contractPath = join(packageRoot, '..', '..', 'contract', 'openapi.yaml');
const outDir = join(packageRoot, 'src', 'generated');

const METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

interface RawOperation {
  operationId?: string;
  'x-permission'?: string;
  parameters?: { $ref?: string }[];
  security?: Record<string, unknown>[];
  requestBody?: { content?: Record<string, unknown> };
}

interface RawDocument {
  info: { version: string };
  paths: Record<string, Record<string, unknown>>;
  components?: { 'x-seeded-roles'?: RawSeededRole[] };
}

interface RawSeededRole {
  code: string;
  name: string;
  requiresTotp: boolean;
  permissions: string[];
}

/** The seeded roles, sorted by code with sorted permissions, so the file changes only when the seed does. */
function buildSeededRoles(document: RawDocument): RawSeededRole[] {
  const roles = document.components?.['x-seeded-roles'] ?? [];
  return roles
    .map(({ code, name, requiresTotp, permissions }) => ({
      code,
      name,
      requiresTotp,
      permissions: [...permissions].sort(),
    }))
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

interface ManifestRow extends PackedRow {
  method: (typeof METHODS)[number];
  permission: string | null;
}

/** The row's type, every field a literal, for the interface the bundler drops. */
function rowType(row: PackedRow): string {
  const fields = (
    ['method', 'path', 'idempotent', 'csrf', 'public', 'body', 'device'] as const
  ).map((key) => `readonly ${key}: ${JSON.stringify(row[key])}`);
  return `{ ${fields.join('; ')} }`;
}

/** The packed rows as a template literal, one operation a line, so a contract change reads as a line diff. */
function packedLiteral(rows: Record<string, PackedRow>): string {
  const packed = packOperations(rows);
  if (/[`$\\]/.test(packed)) throw new Error('A path holds a backtick, a dollar or a backslash.');
  return `\`${packed}\``;
}

function bodyOf(operation: RawOperation): ManifestRow['body'] {
  const content = operation.requestBody?.content ?? {};
  if ('multipart/form-data' in content) return 'multipart';
  if ('application/json' in content) return 'json';
  return 'none';
}

/** A file in a multipart body: the browser's `Blob` (a `File` is one), not the string the bytes travel as. */
const BLOB = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('Blob'));

function csrfOf(parameters: { $ref?: string }[]): ManifestRow['csrf'] {
  const refs = parameters.map((p) => p.$ref);
  if (refs.includes('#/components/parameters/CsrfToken')) return 'required';
  if (refs.includes('#/components/parameters/CsrfTokenOptional')) return 'optional';
  return 'none';
}

function buildManifest(document: RawDocument): Record<string, ManifestRow> {
  const rows: Record<string, ManifestRow> = {};
  for (const [path, item] of Object.entries(document.paths)) {
    const shared = (item['parameters'] ?? []) as { $ref?: string }[];
    for (const method of METHODS) {
      const operation = item[method] as RawOperation | undefined;
      if (operation === undefined) continue;
      const id = operation.operationId;
      if (id === undefined) throw new Error(`${method.toUpperCase()} ${path} has no operationId.`);
      if (id in rows) throw new Error(`Duplicate operationId ${id}.`);
      const parameters = [...shared, ...(operation.parameters ?? [])];
      rows[id] = {
        method,
        path,
        permission: operation['x-permission'] ?? null,
        idempotent: parameters.some((p) => p.$ref === '#/components/parameters/IdempotencyKey'),
        csrf: csrfOf(parameters),
        public: Array.isArray(operation.security) && operation.security.length === 0,
        body: bodyOf(operation),
        device: (operation.security ?? []).some((requirement) => 'deviceCredential' in requirement),
      };
    }
  }
  return Object.fromEntries(Object.entries(rows).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function header(version: string, digest: string): string {
  return [
    '/**',
    ' * GENERATED by packages/api-client/scripts/generate.ts. Do not edit.',
    ` * Source: contract/openapi.yaml, version ${version}, sha256 ${digest}.`,
    ' * Regenerate with ./scripts/sync-contract.sh (ADR 0018).',
    ' */',
    '',
  ].join('\n');
}

export async function generate(): Promise<Record<string, string>> {
  const source = readFileSync(contractPath);
  const digest = createHash('sha256').update(source).digest('hex');
  const document = parse(source.toString('utf8')) as RawDocument;
  const head = header(document.info.version, digest);

  const ast = await openapiTS(pathToFileURL(contractPath), {
    transform: (schema) => (schema.format === 'binary' ? BLOB : undefined),
  });
  const schema = `${head}${astToString(ast)}`;

  const manifest = buildManifest(document);
  const rows = Object.fromEntries(
    Object.entries(manifest).map(([id, row]) => [
      id,
      {
        method: row.method,
        path: row.path,
        idempotent: row.idempotent,
        csrf: row.csrf,
        public: row.public,
        body: row.body,
        device: row.device,
      } satisfies PackedRow,
    ]),
  ) as Record<string, PackedRow>;
  const operations = [
    head,
    "import { unpackOperations } from '../manifest';",
    '',
    '/** The contract version this client was generated from. */',
    `export const CONTRACT_VERSION = ${JSON.stringify(document.info.version)} as const;`,
    '',
    '/** Every operation in the contract, by operation id: how each is sent, every field a literal type. */',
    'export interface OperationManifest {',
    ...Object.entries(rows).map(
      ([id, row]) => `  readonly ${JSON.stringify(id)}: ${rowType(row)};`,
    ),
    '}',
    '',
    '/** The same rows, packed one operation a line (ADR 0059): `<id> <method> <path> <flags> <csrf> <body>`. */',
    `const PACKED = ${packedLiteral(rows)};`,
    '',
    '/** Every operation in the contract, by operation id. */',
    'export const operationManifest = unpackOperations(PACKED) as unknown as OperationManifest;',
    '',
  ].join('\n');

  const permissions = [
    head,
    '/**',
    " * Each operation's `x-permission`, by operation id (ADR 0059). For the tests and the e2e fake, which check",
    " * routes and roles against it. No app imports this: a screen decides by the session's permissions.",
    ' */',
    `export const operationPermissions = ${JSON.stringify(
      Object.fromEntries(Object.entries(manifest).map(([id, row]) => [id, row.permission])),
      null,
      2,
    )} as const;`,
    '',
  ].join('\n');

  const seededRoles = [
    head,
    '/**',
    ' * The roles the backend seeds (`components.x-seeded-roles`, generated there from its migrations; CR-023).',
    " * For checking test fakes against the real seed. A screen decides by the session's permissions, never by this.",
    ' */',
    `export const seededRoles = ${JSON.stringify(buildSeededRoles(document), null, 2)} as const;`,
    '',
  ].join('\n');

  return {
    'schema.ts': schema,
    'operations.ts': operations,
    'permissions.ts': permissions,
    'seededRoles.ts': seededRoles,
  };
}

async function main() {
  const check = process.argv.includes('--check');
  const files = await generate();
  const stale: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    const target = join(outDir, name);
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (check) {
      if (current !== content) stale.push(relative(process.cwd(), target));
    } else if (current !== content) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(target, content);
      console.log(`wrote ${relative(process.cwd(), target)}`);
    }
  }
  if (check) {
    if (stale.length > 0) {
      console.error(
        `The generated client is stale: ${stale.join(', ')}.\nRun ./scripts/sync-contract.sh and commit the result.`,
      );
      process.exit(1);
    }
    console.log('The generated client matches contract/openapi.yaml.');
  }
}

await main();
