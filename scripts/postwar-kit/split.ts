/** Deterministic measurement / blind split of the photographed sample (artifacts/postwar-kit/sample.json → split.json). */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit');
const sample = JSON.parse(fs.readFileSync(path.join(OUT, 'sample.json'), 'utf8')) as Record<string, any>;
const BLIND: Record<string, number> = { C1: 6, C2: 3, C4: 4, C5: 2 };
const h = (id: string) => createHash('sha1').update(`postwar-blind:${id}`).digest('hex');
const split: { measure: string[]; blind: string[] } = { measure: [], blind: [] };
for (const c of Object.keys(BLIND)) {
  const ids = Object.entries(sample).filter(([, r]) => r.cluster === c && r.photo).map(([id]) => id).sort((a, b) => h(a).localeCompare(h(b)));
  split.blind.push(...ids.slice(0, BLIND[c])); split.measure.push(...ids.slice(BLIND[c]));
}
fs.writeFileSync(path.join(OUT, 'split.json'), JSON.stringify(split, null, 1));
console.log(split.measure.length, split.blind.length);
