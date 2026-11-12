// Ground v2 audit runner (lane G2a #372): reads baked GRD2 cells and prints the plan's partition gates per cell
// (slivers, overlap / z-fight / poke-through, cracks, float) and the seam comparison for every baked neighbour pair.
import '../world/useBrowserMath.js';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { MeshoptDecoder } from 'meshoptimizer';
import { GroundStore, toLocal, waterTest } from '../../src/canalRecall/ownGround/groundStore.ts';
import { decodeGrd2 } from '../../src/canalRecall/ownGround/groundV2Format.ts';
import { auditCell, compareSeam, seamPairs } from '../../src/canalRecall/ownGround/groundV2Audit.ts';
import { V2_LEVEL_Z } from '../../src/canalRecall/ownGround/groundV2Sources.ts';
import { GROUND_V2_PLACES, GROUND_V2_PLACE_RADIUS_M } from '../../src/canalRecall/ownGround/groundV2Places.ts';

const HELP = `npx tsx scripts/own-ground/audit-ground-v2.ts [--dir=artifacts/ground-v2/staging] [--lod=0] [--cells=a,b] [--seams-only] [--places] [--json=path]
Audits baked ground v2 cells: slivers (aspect > 20, > 0.05 m²), overlaps (z-fight within ±5 mm, poke-through beyond),
cracks (uncovered plan area off the water), float over the relief (p99.9, max, m² over 5 and 10 cm), and the seams of
every baked neighbour pair (every seam vertex's position, height and normal identical). Exit 1 on a crack, overlap,
sliver or seam difference.
  --places   the acceptance bar instead: each named place's ${GROUND_V2_PLACE_RADIUS_M} m window (groundV2Places.ts, G0's nine), summed
             over the baked cells it touches; exit 1 unless every window has zero sliver, overlap (poke, z-fight) and crack,
             and no float over 5 cm off the step lines (STEP_LINE_M of a step strip's plan line; reported apart).`;
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(HELP); process.exit(0); }
const opt = (n: string) => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dir = opt('dir') ?? 'artifacts/ground-v2/staging', lod = Number(opt('lod') ?? 0);
const suffix = `.lod${lod}.bin.gz`;
const all = readdirSync(dir).filter(f => f.endsWith(suffix)).map(f => f.slice(0, -suffix.length)).sort();
const keys = opt('cells') ? opt('cells')!.split(',') : all;
await MeshoptDecoder.ready;
const load = (k: string) => decodeGrd2(gunzipSync(readFileSync(join(dir, `${k}${suffix}`))), MeshoptDecoder);

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async p => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { parks: true, roads: true, rails: true, deterministic: true });
await store.init();
const placeCells = new Map<string, string[]>();
for (const p of GROUND_V2_PLACES) { const [x, y] = toLocal(p.at[0], p.at[1]); const k = store.cellAt(x, y); placeCells.set(k, [...(placeCells.get(k) ?? []), p.id]); }

if (args.includes('--places')) {
  const out: Record<string, unknown>[] = []; let fail = 0;
  for (const p of GROUND_V2_PLACES) {
    const [x, y] = toLocal(p.at[0], p.at[1]), r = GROUND_V2_PLACE_RADIUS_M;
    const cells = [...new Set([[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]].map(([dx, dy]) => store.cellAt(x + dx, y + dy)))].filter(k => store.covers(k)).sort();
    const missing = cells.filter(k => !existsSync(join(dir, `${k}${suffix}`)));
    const sum = { slivers: 0, sliverM2: 0, sliversInternal: 0, sliversEdge: 0, sliversStrip: 0, stripAt: [] as [number, number, string][], sliversByLayer: {} as Record<string, number>, overlapM2: 0, zFightM2: 0, pokeM2: 0, crackM2: 0, shoreM2: 0, floatOver5cmM2: 0, floatOver10cmM2: 0, floatMaxMm: 0, floatAt: [] as [number, number, number][], floatStepOver5cmM2: 0, floatStepMaxMm: 0, triangles: 0 };
    for (const k of cells.filter(k => !missing.includes(k))) {
      const input = await store.cellInput(k, 0), wet = waterTest(input.waterAround.flatMap(g => g.polygons), false);
      const a = auditCell({ cell: load(k), relief: input.surface.relief, water: wet, levelZ: lod === 0 ? V2_LEVEL_Z : [V2_LEVEL_Z[0]], window: { x, y, r } });
      for (const f of ['slivers', 'sliverM2', 'sliversInternal', 'sliversEdge', 'sliversStrip', 'overlapM2', 'zFightM2', 'pokeM2', 'crackM2', 'shoreM2', 'floatOver5cmM2', 'floatOver10cmM2', 'floatStepOver5cmM2', 'triangles'] as const) sum[f] += a[f];
      sum.floatMaxMm = Math.max(sum.floatMaxMm, a.floatMaxMm); sum.floatStepMaxMm = Math.max(sum.floatStepMaxMm, a.floatStepMaxMm);
      sum.stripAt.push(...a.stripAt); sum.floatAt.push(...a.floatAt);
      for (const [l, n] of Object.entries(a.sliversByLayer)) sum.sliversByLayer[l] = (sum.sliversByLayer[l] ?? 0) + n;
    }
    // The bar (coordinator, 2026-11-12): zero sliver, poke, z-fight and crack, and float ≤ 5 cm off the step lines.
    const ok = !missing.length && !sum.slivers && !sum.overlapM2 && !sum.crackM2 && !sum.floatOver5cmM2;
    if (!ok) fail++;
    out.push({ id: p.id, cells, missing, ok, ...sum });
    console.log([p.id.padEnd(32), ok ? 'PASS' : 'FAIL', `cells ${cells.join(',')}${missing.length ? ` (missing ${missing.join(',')})` : ''}`, `tri ${sum.triangles}`, `sliver ${sum.slivers} (${sum.sliverM2.toFixed(1)} m²; internal ${sum.sliversInternal} edge ${sum.sliversEdge} strip ${sum.sliversStrip}) ${JSON.stringify(sum.sliversByLayer)}`, `poke ${sum.pokeM2.toFixed(2)} zf ${sum.zFightM2.toFixed(2)} m²`, `crack ${sum.crackM2.toFixed(2)} m² (shore ${sum.shoreM2.toFixed(1)})`, `float off steps >5cm ${sum.floatOver5cmM2.toFixed(1)} >10cm ${sum.floatOver10cmM2.toFixed(1)} m², max ${sum.floatMaxMm} mm; at steps >5cm ${sum.floatStepOver5cmM2.toFixed(0)} m², max ${sum.floatStepMaxMm} mm`].join(' | '));
  }
  writeFileSync(opt('json') ?? join(dir, `places-lod${lod}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ places: out.length, failing: fail }));
  process.exit(fail ? 1 : 0);
}

const rows: Record<string, unknown>[] = [];
let bad = 0;
if (!args.includes('--seams-only')) for (const k of keys) {
  if (!existsSync(join(dir, `${k}${suffix}`))) { console.error(`${k}: not baked`); continue; }
  const cell = load(k), input = await store.cellInput(k, 0);
  const wet = waterTest(input.waterAround.flatMap(g => g.polygons), false);
  const a = auditCell({ cell, relief: input.surface.relief, water: wet, levelZ: lod === 0 ? V2_LEVEL_Z : [V2_LEVEL_Z[0]] });
  const row = { key: k, places: placeCells.get(k) ?? [], ...a, crackAt: a.crackAt.slice(0, 3), floatAt: a.floatAt.slice(0, 3) };
  rows.push(row);
  if (a.slivers || a.overlapM2 || a.crackM2) bad++;
  console.log([k.padEnd(6), `tri ${a.triangles}`, `step ${a.stepTriangles}`, `sliver ${a.slivers} ${JSON.stringify(a.sliversByLayer)}`, `overlap ${a.overlapM2.toFixed(2)} m² (zf ${a.zFightM2.toFixed(2)}, poke ${a.pokeM2.toFixed(2)})`, `crack ${a.crackM2.toFixed(2)} m² ${JSON.stringify(a.crackAt.slice(0, 2))} (shore ${a.shoreM2.toFixed(1)})`, `float p99.9 ${a.floatP999Mm} max ${a.floatMaxMm} mm, >5cm ${a.floatOver5cmM2.toFixed(0)} m², >10cm ${a.floatOver10cmM2.toFixed(0)} m²`, (placeCells.get(k) ?? []).join(',')].join(' | '));
}
const seams = seamPairs(all.filter(k => keys.includes(k) || args.includes('--seams-all'))).map(([a, b, side]) => compareSeam(load(a), load(b), side, [a, b]));
const seamBad = seams.filter(s => s.equal !== s.vertices);
for (const s of seams) console.log(`seam ${s.a} ${s.side} ${s.b}: ${s.equal}/${s.vertices}${s.firstDiff ? ' first diff ' + s.firstDiff : ''}`);
console.log(JSON.stringify({ cells: rows.length, failingCells: bad, seamPairs: seams.length, seamPairsUnequal: seamBad.length, seamVertices: seams.reduce((s, x) => s + x.vertices, 0), seamVerticesEqual: seams.reduce((s, x) => s + x.equal, 0) }));
writeFileSync(opt('json') ?? join(dir, `audit-lod${lod}.json`), JSON.stringify({ rows, seams }, null, 1));
process.exit(bad || seamBad.length ? 1 : 0);
