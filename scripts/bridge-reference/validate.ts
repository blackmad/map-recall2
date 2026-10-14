// Automatic face readings against the hand readings of the named bridges (lane bridge-fidelity 2026-10-14).
//   npx tsx scripts/bridge-reference/validate.ts [artifacts/bridges/facts-staging.json]
import { readFileSync } from 'node:fs';
import { HAND } from '../own-ground/build-bridge-hints.ts';

const file = process.argv[2] ?? 'artifacts/bridges/facts-staging.json';
const auto = JSON.parse(readFileSync(file, 'utf8')).facts as Record<string, { arches?: number; shape?: string; family?: string; parapet?: string }>;
const tally: Record<string, { n: number; agree: number; misses: string[] }> = {};
const add = (k: string, ok: boolean, note: string) => { const t = (tally[k] ??= { n: 0, agree: 0, misses: [] }); t.n++; if (ok) t.agree++; else t.misses.push(note); };
for (const [id, h] of Object.entries(HAND)) {
  const a = auto[id];
  if (!a) continue;
  if (a.arches !== undefined) add('arches', a.arches === h.arches, `${id} ${a.arches}/${h.arches}`);
  if (a.shape) add('shape', a.shape[0] === h.shapes?.[0], `${id} ${a.shape}/${h.shapes}`);
  if (a.family) add('family', a.family === h.family || (a.family.startsWith('brick') && h.family?.startsWith('brick')), `${id} ${a.family}/${h.family}`);
  if (a.parapet) add('parapet', a.parapet === h.parapet, `${id} ${a.parapet}/${h.parapet}`);
}
for (const [k, t] of Object.entries(tally)) console.log(k.padEnd(8), `${t.agree}/${t.n}`, t.misses.slice(0, 12).join('  '));
