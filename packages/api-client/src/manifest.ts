/**
 * The operation table's runtime form (ADR 0059). `generated/operations.ts` types every row exactly, as an
 * interface the bundler drops, and carries the rows themselves as one packed string, one line per
 * operation: `<id> <method> <path> <idempotent><public><device> <csrf> <body>`. A browser downloads the
 * string, about a third of the object it replaces once gzipped, and `unpackOperations` turns it back into
 * the same rows when the module loads. The generator packs with `packOperations`, so the two cannot drift,
 * and `manifest.test.ts` checks the round trip.
 *
 * The permission each operation needs is not in the runtime rows: a screen decides by the session's
 * permissions and the route's own declaration, never by this table. Tests and the e2e fake read it from
 * `generated/permissions.ts`, which no app imports.
 */

/** How one operation is sent: what `call()` reads before it builds the request. */
export interface PackedRow {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  idempotent: boolean;
  csrf: 'required' | 'optional' | 'none';
  /** The operation declares `security: []`: it needs no session, so a 401 from it is not an expired session. */
  public: boolean;
  /** How the request body travels: JSON, `multipart/form-data` (a file upload), or no body at all. */
  body: 'json' | 'multipart' | 'none';
  /** A security requirement names `deviceCredential`: an enrolled till sends `X-Device-Credential` (ADR 0044). */
  device: boolean;
}

const METHOD = { g: 'get', p: 'post', u: 'put', a: 'patch', d: 'delete' } as const;
const CSRF = { r: 'required', o: 'optional', n: 'none' } as const;
const BODY = { j: 'json', m: 'multipart', n: 'none' } as const;

function letterOf<Value extends string>(table: Record<string, Value>, value: Value): string {
  const letter = Object.keys(table).find((key) => table[key] === value);
  if (letter === undefined) throw new Error(`No letter for ${value}.`);
  return letter;
}

/** One line per operation, in the order given. Paths hold no spaces or line breaks (the contract's own). */
export function packOperations(rows: Record<string, PackedRow>): string {
  return Object.entries(rows)
    .map(([id, row]) => {
      if (/\s/.test(row.path) || /\s/.test(id)) throw new Error(`${id} has white space in it.`);
      const flags = [row.idempotent, row.public, row.device].map((flag) => (flag ? '1' : '0'));
      return [
        id,
        letterOf(METHOD, row.method),
        row.path,
        flags.join(''),
        letterOf(CSRF, row.csrf),
        letterOf(BODY, row.body),
      ].join(' ');
    })
    .join('\n');
}

/** The rows `packOperations` packed, by operation id. */
export function unpackOperations(packed: string): Record<string, PackedRow> {
  const rows: Record<string, PackedRow> = {};
  for (const line of packed.split('\n')) {
    const [id, method, path, flags, csrf, body] = line.split(' ') as [
      string,
      keyof typeof METHOD,
      string,
      string,
      keyof typeof CSRF,
      keyof typeof BODY,
    ];
    rows[id] = {
      method: METHOD[method],
      path,
      idempotent: flags[0] === '1',
      public: flags[1] === '1',
      device: flags[2] === '1',
      csrf: CSRF[csrf],
      body: BODY[body],
    };
  }
  return rows;
}
