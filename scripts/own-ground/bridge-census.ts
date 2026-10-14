// Census of the bridges as the kit draws them (lane bridge-kit 2026-10-13): type, triangles per bridge body at both
// rings (deck tops counted apart), the coarsening level each needed, and the cells' resident bridge triangles.
//
//   npx tsx scripts/own-ground/bridge-census.ts                    # canal belt, Jordaan, Oud-West (audit-belt box)
//   npx tsx scripts/own-ground/bridge-census.ts --ids=BRU0063,BRU0242   # just these bridges, with their numbers
//   npx tsx scripts/own-ground/bridge-census.ts --json=out.json
//   … --ids=BRU0242 --trace                 # every coarsening attempt: stations and triangles per part
//
// Exit code 1 when a bridge body is over budget (KIT_BUDGET: 600 near, 60 far; named 1,500 / 100).
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, CANAL_WATER_Z } from '../../src/canalRecall/ownGround/groundCell.ts';
import { flatDeckBody, footprintAxis, movableFrame, pointInRing } from '../../src/canalRecall/ownGround/decks.ts';
import { bridgeFacts, flatHintAt, kitTrace, KIT_BUDGET } from '../../src/canalRecall/ownGround/bridgeKit.ts';
import { buildWaterMask, maskDistance, type WaterGeometry } from '../../src/canalRecall/ownGround/water.ts';
import { isBridgeWay, prepareWays } from '../../src/canalRecall/ownGround/streets.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [W, S, E, N] = (flag('box') ?? '4.855,52.355,4.915,52.385').split(',').map(Number);
const only = flag('ids')?.split(',');
const store = new GroundStore(async path => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const bytes = readFileSync(file);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
});
const inBox = (x: number, y: number) => { const [lng, lat] = fromLocal(x, y); return lng >= W && lng <= E && lat >= S && lat <= N; };

type Row = { id: string; kind: string; near: number; far: number; level: number; farBody?: number; farLevel?: number; posts: number; lamps: number; arches: number; piers: number; measured: boolean };

async function main(): Promise<void> {
  await store.init();
  if (process.argv.includes('--trace')) kitTrace.fn = (id, level, parts) => { if (!only || only.includes(id)) console.log('trace', id, level, JSON.stringify(parts)); };
  const cells = [...store.osmCells].filter(k => store.covers(k)).filter(k => { const [x0, y0, x1, y1] = store.cellRect(k); return inBox((x0 + x1) / 2, (y0 + y1) / 2); }).sort();
  const rows: Row[] = [];
  let bridgeLayer0 = 0, bridgeLayer1 = 0, top0 = 0, cellTris0 = 0, cellTris1 = 0;
  for (const k of cells) {
    await store.prepareCell(k);
    const wanted = !only || store.decks(k).some(d => only.includes(d.profile.id)) || store.flatDeckMeta(k).some(f => only.includes(f.id));
    if (!wanted) continue;
    const input0 = await store.cellInput(k, 0), near = buildCell(input0), far = buildCell(await store.cellInput(k, 1));
    bridgeLayer0 += near.stats.byLayer.deckBody ?? 0; bridgeLayer1 += far.stats.byLayer.deckBody ?? 0; top0 += near.stats.byLayer.deckTop ?? 0;
    cellTris0 += near.stats.triangles; cellTris1 += far.stats.triangles;
    const farInfo = new Map(far.stats.bridges.decks.map(d => [d.id, d]));
    for (const d of near.stats.bridges.decks) {
      if (only && !only.includes(d.id)) continue;
      rows.push({ id: d.id, kind: d.kind, near: d.triangles, far: farInfo.get(d.id)?.triangles ?? 0, level: d.level, posts: d.railingPosts, lamps: d.lamps, arches: d.arches, piers: d.piers, measured: true });
    }
    // Flat footprints: rebuilt here with the cell's water mask (buildCell keeps no per-footprint triangle count).
    const around = input0.waterAround;
    const geo: WaterGeometry = { polygons: around.flatMap(g => g.polygons), shores: around.flatMap(g => g.shores), levels: around.flatMap(g => g.levels ?? g.polygons.map(() => CANAL_WATER_Z)) };
    if (!geo.polygons.length) continue;
    const [x0, y0, x1, y1] = input0.rect;
    const mask = buildWaterMask(geo, x0 - 150, y0 - 150, x1 + 150, y1 + 150, 1, 4, input0.deckRingsAround);
    const overWater = (x: number, y: number) => maskDistance(mask, x, y) < 0;
    const lines = [input0.osm, ...input0.osmAround].flatMap(e => (e ? prepareWays(e.ways, input0.project) : [])).filter(isBridgeWay).map(w => w.points);
    input0.flatDecks.forEach((ring, i) => {
      const meta = input0.flatDeckMeta?.[i];
      if (!meta || (only && !only.includes(meta.id))) return;
      const through = lines.filter(l => l.some(q => pointInRing(ring, q[0], q[1])));
      const axis = footprintAxis(ring, through).u;
      const a = flatDeckBody(ring, input0.surface.height, overWater, 0.02, 0.45, { axis }), b = flatDeckBody(ring, input0.surface.height, overWater, 0.02, 0.45, { axis, railings: false });
      const frame = meta.movable ? movableFrame(ring, input0.surface.height, through).mesh.indices.length / 3 : 0, frameFar = meta.movable ? movableFrame(ring, input0.surface.height, through, 0.02, false).mesh.indices.length / 3 : 0;
      const hint = flatHintAt(ring.reduce((s, q) => s + q[0], 0) / ring.length, ring.reduce((s, q) => s + q[1], 0) / ring.length);
      rows.push({ id: meta.id + (hint && hint.id !== meta.id ? `?${hint.id}` : ''), kind: a.kind ?? 'none', near: a.triangles + frame, far: b.triangles + frameFar, level: a.level, farBody: b.triangles, farLevel: b.level, posts: a.railingPosts, lamps: 0, arches: 0, piers: 0, measured: false });
    });
  }
  const byKind: Record<string, { n: number; near: number[]; far: number[] }> = {};
  for (const r of rows) { const t = (byKind[r.kind] ??= { n: 0, near: [], far: [] }); t.n++; t.near.push(r.near); t.far.push(r.far); }
  const q = (a: number[], f: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))] ?? 0; };
  console.log(JSON.stringify({ cells: cells.length, bridgeBodyTriangles: { near: bridgeLayer0, far: bridgeLayer1 }, deckTopTriangles: top0, cellTriangles: { near: cellTris0, far: cellTris1 } }));
  for (const [kind, t] of Object.entries(byKind)) console.log(`${kind.padEnd(10)} n=${String(t.n).padStart(4)}  near median ${q(t.near, 0.5)} p95 ${q(t.near, 0.95)} max ${Math.max(...t.near)}   far median ${q(t.far, 0.5)} max ${Math.max(...t.far)}`);
  // Named canal-belt bridges (bridgeHints BRIDGE_FACTS) take the named tier.
  const named = (r: Row) => !!bridgeFacts(r.id.split('?')[0])?.named;
  const over = rows.filter(r => r.near > (named(r) ? KIT_BUDGET.named : KIT_BUDGET.near) || r.far > (named(r) ? KIT_BUDGET.namedFar : KIT_BUDGET.far));
  console.log(`over budget: ${over.length}`, over.slice(0, 30).map(r => `${r.id}:${r.kind}:${r.near}/${r.far}`).join(' '));
  if (only) for (const r of rows) console.log(JSON.stringify(r));
  if (flag('json')) writeFileSync(flag('json')!, JSON.stringify({ byKind, rows }, null, 1));
  process.exitCode = over.length ? 1 : 0;
}

main().catch(e => { console.error(e); process.exit(1); });
