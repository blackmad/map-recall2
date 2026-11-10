/**
 * The golden allow-list (house line H3, docs/house-line.md section 3).
 *
 * `house:publish` re-records a golden only for the houses a batch touches. Each golden script takes
 * `--allow=<id,id,...>`: a change whose key is in the list is re-recorded, a change outside it fails the run and its
 * id is printed. An id is whatever the golden keys on (a pand id, a house directory, a block-face id, a block-kit spec);
 * a key matches when it equals an id or carries one as a whole word (roof-golden lines read `<face> <pand>`).
 */

/** `--allow=a,b` or `--allow a,b` (repeatable); empty entries dropped. Returns null when the flag is absent. */
export function parseAllow(argv: readonly string[]): Set<string> | null {
  let found = false;
  const ids = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    let value: string | undefined;
    if (a === '--allow') { value = argv[i + 1]; i++; }
    else if (a.startsWith('--allow=')) value = a.slice('--allow='.length);
    else continue;
    found = true;
    for (const id of (value ?? '').split(',')) if (id.trim()) ids.add(id.trim());
  }
  return found ? ids : null;
}

const words = (key: string): string[] => key.split(/[\s:()]+/).filter(Boolean);

/** True when `key` is in `allow` or carries an allowed id as a whole word. */
export const isAllowed = (key: string, allow: ReadonlySet<string>): boolean => allow.has(key) || words(key).some(w => allow.has(w));

/** Splits changed golden keys into those the batch may re-record and those it may not. */
export function partitionChanged(keys: readonly string[], allow: ReadonlySet<string> | null): { allowed: string[]; outside: string[] } {
  const allowed: string[] = [], outside: string[] = [];
  for (const k of keys) (allow && isAllowed(k, allow) ? allowed : outside).push(k);
  return { allowed, outside };
}

/** The pand ids (16 digits) a list of golden keys or output lines mention, for the publish failure report. */
export const pandIdsIn = (lines: readonly string[]): string[] => [...new Set(lines.flatMap(l => l.match(/\b\d{16}\b/g) ?? []))];
