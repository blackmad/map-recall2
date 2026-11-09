import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// One place for a spec to read its pass line from tests/perf/budgets.json (integrator-owned), so the spec and the perf
// gate (scripts/perf-gate-lib.mjs SPEC_ENFORCED) can never disagree about a number. Scalar rows only; a
// device-keyed row ({desktop, iphone}) is read with `budget(key, 'iphone')`.
type Entry = { value: number | Record<string, number> };
let cache: Record<string, Entry> | undefined;

export function budget(key: string, device?: string): number {
  cache ??= JSON.parse(readFileSync(resolve(process.cwd(), 'tests/perf/budgets.json'), 'utf8')).entries;
  const entry = cache![key];
  if (!entry) throw new Error(`tests/perf/budgets.json has no row "${key}"`);
  const v = typeof entry.value === 'object' ? entry.value[device ?? ''] : entry.value;
  if (typeof v !== 'number') throw new Error(`budget "${key}"${device ? ` for ${device}` : ''} is not a number`);
  return v;
}
