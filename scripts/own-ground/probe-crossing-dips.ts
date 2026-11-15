// Lane f1b-jagged 2026-11-14 (user: "these roads should probably figure out 'I don't dip down'"): every road or cycle
// way crossing mapped water (2-60 m) not in a tunnel. Its abutments are the bank tops: from each bank on along the way
// while the relief climbs away from the water faster than BANK_CLIMB_GRADE (at most BANK_CLIMB_MAX_M), then 1 m on. The
// riding surface (GroundSurface.height, decks included) is sampled every metre between them against the straight line
// joining them; a crossing dips when a sample lies more than --tol (default 0.3 m) under that line.
//
//   node --import tsx scripts/own-ground/probe-crossing-dips.ts [--opts='{"bankClimb":true}'] [--tol=0.3] [--top=30] [--bbox=lng0,lat0,lng1,lat1]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal, fromLocal, waterTest } from '../../src/canalRecall/ownGround/groundStore.ts';
import { crossingDips } from './crossing-dip.ts';
const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const read = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const opts = JSON.parse(flag('opts') ?? '{}'), tol = Number(flag('tol') ?? 0.3), bbox = flag('bbox')?.split(',').map(Number);
const st = new GroundStore(read, { roads: true, ...opts }); await st.init();
const ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'cycleway', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'busway']);
const seen = new Set<number>();
type Hit = { id: number; name: string; hw: string; bridge: string; lng: number; lat: number; lenM: number; dip: number };
const hits: Hit[] = [];
let crossings = 0;
const keys = [...st.osmCells].filter(k => st.covers(k)).sort();
for (const key of keys) {
  const osm = await st.osmCell(key), water = await st.waterCell(key);
  if (!osm) continue;
  await st.prepareCell(key);
  const around = (GroundStore as any).neighbours(key) as string[];
  const waters = await Promise.all(around.map(k => st.waterCell(k)));
  const wet = waterTest(waters.flatMap(w => w?.polygons ?? []));
  for (const w of osm.ways) {
    if (seen.has(w.id) || !ROADS.has(w.tags.highway) || (w.tags.tunnel && w.tags.tunnel !== 'no')) continue;
    if (bbox && !w.g.some(([lng, lat]) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3])) continue;
    const pts = w.g.map(([lng, lat]) => toLocal(lng, lat));
    // Only ways whose first point is in this cell (each way once, its relief and decks prepared around it).
    if (st.cellAt(pts[0][0], pts[0][1]) !== key) continue;
    seen.add(w.id);
    for (const c of crossingDips(st, pts, wet)) {
      crossings++;
      if (c.dip > tol) { const [lng, lat] = fromLocal(c.at[0], c.at[1]); hits.push({ id: w.id, name: w.tags.name ?? '', hw: w.tags.highway, bridge: w.tags.bridge ?? '', lng: +lng.toFixed(5), lat: +lat.toFixed(5), lenM: c.lenM, dip: +c.dip.toFixed(2) }); }
    }
  }
}
hits.sort((p, q) => q.dip - p.dip);
for (const h of hits.slice(0, Number(flag('top') ?? 30))) console.log(JSON.stringify(h));
const by = (f: (h: Hit) => boolean) => hits.filter(f).length;
console.log(JSON.stringify({ opts, tol, crossings, dipping: hits.length, bridgeTagged: by(h => !!h.bridge && h.bridge !== 'no'), untagged: by(h => !h.bridge || h.bridge === 'no'), over1m: by(h => h.dip > 1) }));
