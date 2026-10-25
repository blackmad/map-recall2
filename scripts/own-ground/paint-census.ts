// City-wide road-paint census (diagnostics): every OSM ground cell at LOD 0 with roads-v1 and the photo evidence,
// as the game builds it, tallying paint-layer and red-crossing triangles by source (sourceTrace.ts) and the survey
// markings' counts (surveyMarkings.ts SurveyMarkingStats). Used to measure what a paint rule change drops.
//
//   npx tsx scripts/own-ground/paint-census.ts [--label=before] [--out=artifacts/roads/paint-census-<label>.json]
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { setSourceTracing, sourceOfCode } from '../../src/canalRecall/ownGround/sourceTrace.ts';

const ROOT = 'public/data/extracts/amsterdam';
const readExtract = async (path: string) => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const bytes = readFileSync(file);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
};
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const label = arg('label') ?? 'now';
const out = arg('out') ?? `artifacts/roads/paint-census-${label}.json`;

const store = new GroundStore(readExtract, { roads: true });
await store.init();
const tris: Record<string, number> = {};
const marks: Record<string, number> = {};
let cells = 0;
setSourceTracing(true);
for (const key of [...store.osmCells].sort()) {
  if (!store.covers(key)) continue;
  const c = buildCell(await store.cellInput(key, 0));
  cells++;
  for (const layer of ['paint', 'cycle'] as const) {
    const s = c.sources?.[layer]; if (!s) continue;
    for (const code of s) { const src = sourceOfCode(code) ?? 'untraced'; if (layer === 'cycle' && src !== 'cycleCross') continue; const k = `${layer}:${src}`; tris[k] = (tris[k] ?? 0) + 1; }
  }
  const m = c.stats.roads?.markings;
  if (m) for (const [k, v] of Object.entries(m)) if (k !== 'ms' && typeof v === 'number') marks[k] = (marks[k] ?? 0) + v;
}
setSourceTracing(false);
const res = { label, cells, paintTriangles: tris, surveyMarkings: marks };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
