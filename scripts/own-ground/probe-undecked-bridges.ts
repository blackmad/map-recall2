// OSM highway bridge ways that draw no road (lane bridge-roads 2026-10-31, user: "why missing road" at the Kinkerbrug,
// Postjesweg over the Kostverlorenvaart). A station along a bridge way is bare when no deck carries it (no measured
// deck, way deck or flat footprint) and nothing draws a road there: the way's OSM bands are off (roads-v1 covers it,
// roadCells coverWays) and no ground-level (h 0) survey polygon lies under it; the deck-level (h 1) polygons are drawn
// only when their interior point lies on a deck or over water (roadSurfaces.ts buildRoadSurfaces skippedHigh). A way is bare when at least half its
// stations (1 m apart, the end metre off) are. `waterCut`: water lies beside both edges of a bare station within
// WAY_OPENING_REACH_M (the water polygon stops at the bridge).
//
//   npx tsx scripts/own-ground/probe-undecked-bridges.ts [--before] [--cells=k,k] [--top=20] [--json=out.json]
//   --before   without the water opened under OSM bridge ways (GroundStore wayOpenings: false)
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal, toLocal, waterTest } from '../../src/canalRecall/ownGround/groundStore.ts';
import { pointInRing } from '../../src/canalRecall/ownGround/decks.ts';
import { interiorPoint } from '../../src/canalRecall/ownGround/parks.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { prepareWays, isBridgeWay } from '../../src/canalRecall/ownGround/streets.ts';
import { WAY_OPENING_REACH_M, wayDeckHighway } from '../../src/canalRecall/ownGround/wayDecks.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const before = process.argv.includes('--before');
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true, ...(before ? { wayOpenings: false } : {}) });
await store.init();
const keys = flag('cells')?.split(',') ?? [...store.osmCells].filter(k => store.covers(k)).sort();
for (const k of keys) await store.prepareCell(k);

interface Row { id: number; name: string; highway: string; lengthM: number; bareShare: number; waterCut: boolean; lng: number; lat: number }
const rows: Row[] = [], seen = new Set<number>();
let bridgeWays = 0;
for (const key of keys) {
  const osm = await store.osmCell(key);
  if (!osm) continue;
  const around = GroundStore.neighbours(key);
  const roads = await Promise.all(around.map(k => store.roadCell(k)));
  const index = new RoadIndex(roads);
  const cover = new Set(roads.flatMap(r => r?.coverWays ?? []));
  const water = await Promise.all(around.map(k => store.waterCell(k)));
  const wet = waterTest(water.flatMap(w => w?.polygons ?? []));
  const flats = around.flatMap(k => store.flatDecks(k));
  const [x0, y0, x1, y1] = store.cellRect(key);
  for (const w of prepareWays(osm.ways.filter(q => q.tags.bridge && q.tags.bridge !== 'no' && wayDeckHighway(q.tags.highway)), p => toLocal(p[0], p[1]))) {
    if (seen.has(w.id) || !isBridgeWay(w)) continue;
    const [fx, fy] = w.points[0];
    if (fx < x0 || fx >= x1 || fy < y0 || fy >= y1) continue;
    seen.add(w.id); bridgeWays++;
    const st: { x: number; y: number; nx: number; ny: number }[] = [];
    let len = 0;
    for (let i = 0; i + 1 < w.points.length; i++) len += Math.hypot(w.points[i + 1][0] - w.points[i][0], w.points[i + 1][1] - w.points[i][1]);
    for (let i = 0, a = 0; i + 1 < w.points.length; i++) {
      const [ax, ay] = w.points[i], [bx, by] = w.points[i + 1], l = Math.hypot(bx - ax, by - ay) || 1e-9;
      for (let d = Math.ceil(a) - a; d < l; d += 1) if (a + d >= 1 && a + d <= len - 1) st.push({ x: ax + (bx - ax) * d / l, y: ay + (by - ay) * d / l, nx: -(by - ay) / l, ny: (bx - ax) / l });
      a += l;
    }
    if (!st.length) continue;
    const covered = cover.has(w.id);
    let bare = 0, cut = 0;
    for (const s of st) {
      const onDeck = store.surface.deckWeight(s.x, s.y) > 0 || flats.some(r => pointInRing(r, s.x, s.y));
      if (onDeck || wet(s.x, s.y) || !covered) continue;
      const carried = (k: number) => { const ip = interiorPoint(index.ringsOf(k)); return !!ip && (store.surface.deckWeight(ip[0], ip[1]) > 0 || wet(ip[0], ip[1])); };
      if (index.findAll(s.x, s.y).some(k => index.records[k].h === 0 || carried(k))) continue;
      bare++;
      const r = w.section.halfWidth + WAY_OPENING_REACH_M, side = (sg: number) => { for (let o = 0.5; o <= r; o += 0.5) if (wet(s.x + s.nx * o * sg, s.y + s.ny * o * sg)) return true; return false; };
      if (side(1) && side(-1)) cut++;
    }
    if (bare / st.length < 0.5) continue;
    const m = st[st.length >> 1], [lng, lat] = fromLocal(m.x, m.y);
    rows.push({ id: w.id, name: w.tags.name ?? '', highway: w.tags.highway, lengthM: +len.toFixed(1), bareShare: +(bare / st.length).toFixed(2), waterCut: cut >= bare / 2, lng: +lng.toFixed(5), lat: +lat.toFixed(5) });
  }
}
const RANK: Record<string, number> = { motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4, unclassified: 5, residential: 6, busway: 7, living_street: 8, service: 9, cycleway: 10, path: 11, footway: 12, pedestrian: 13 };
rows.sort((a, b) => (RANK[a.highway] ?? 20) - (RANK[b.highway] ?? 20) || b.lengthM - a.lengthM);
const by: Record<string, number> = {};
for (const r of rows) by[r.highway] = (by[r.highway] ?? 0) + 1;
console.log(`${before ? 'BEFORE' : 'AFTER'}: ${keys.length} cells, ${bridgeWays} OSM highway bridge ways, ${rows.length} bare (no deck, no road) — water cut under ${rows.filter(r => r.waterCut).length}; ${rows.reduce((s, r) => s + r.lengthM, 0).toFixed(0)} m`);
console.log('by highway', JSON.stringify(by));
for (const r of rows.slice(0, Number(flag('top') ?? 20))) console.log(`${r.id} ${r.highway} "${r.name}" ${r.lengthM} m bare ${r.bareShare}${r.waterCut ? ' water-cut' : ''} ${r.lng},${r.lat}`);
if (flag('json')) writeFileSync(flag('json')!, JSON.stringify(rows, null, 1));
