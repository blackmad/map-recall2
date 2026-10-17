// Every OSM bridge way in the roads-v1 cells carries a drawn surface along its length (user 2026-10-16, "bridge missing
// entirely here": with BGT roads by default a wide tram street ended at the quay and resumed on the far bank).
// Stations every 1.5 m along each bridge way (its own cell's ways, highway only); a station is missing when the top
// drawn layer there (not cut by the water mask) is none, water or the quay wall, or lies more than 0.5 m under the
// riding surface. A way is missing when at least half its stations are (at least 3). Both road modes.
//
//   npx tsx scripts/own-ground/audit-bridge-surfaces.ts [--json=out.json] [--cells=-2_0,-1_0] [--all] [--highways=primary|secondary|tertiary]
//   … --streets      the street classes only (STREET_HIGHWAYS: the "road bridge ways" of the board, 1,294 city-wide)
//   … --max=N        exit 1 when more than N bridge ways miss a surface (in any mode run): the cap of the check
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, compareHits, layersAt, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { isBridgeWay, prepareWays } from '../../src/canalRecall/ownGround/streets.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const read = async (path: string) => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const bytes = readFileSync(file);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
};

/** The street classes (the board's "road bridge ways"): not paths, cycleways, service roads or motorways. */
export const STREET_HIGHWAYS = /^(primary|secondary|tertiary|unclassified|residential|living_street)$/;

export interface MissingWay { id: number; name: string; highway: string; lng: number; lat: number; stations: number; missing: number; tops: string; /** At the way's middle: the riding surface and the water level there (a polder whose level the extract lacks floods its decks). */ ride: number; waterZ: number }

export async function auditBridgeSurfaces(store: GroundStore, keys: string[], highways?: RegExp, log = false): Promise<{ ways: number; missing: MissingWay[] }> {
  const cache = new Map<string, BuiltCell>();
  const cell = async (k: string) => { if (!cache.has(k)) cache.set(k, buildCell(await store.cellInput(k, 0))); return cache.get(k)!; };
  const missing: MissingWay[] = [];
  let ways = 0;
  for (const key of keys) {
    if (!store.covers(key)) continue;
    const input = await store.cellInput(key, 0), [x0, y0, x1, y1] = input.rect;
    const near: BuiltCell[] = [];
    for (const k of GroundStore.neighbours(key)) if (store.covers(k)) near.push(await cell(k));
    for (const w of input.osm ? prepareWays(input.osm.ways, input.project) : []) {
      if (!isBridgeWay(w) || !w.tags.highway || w.tags.highway === 'steps' || (highways && !highways.test(w.tags.highway))) continue;
      const pts = w.points, mid = pts[pts.length >> 1];
      if (mid[0] < x0 || mid[0] >= x1 || mid[1] < y0 || mid[1] >= y1) continue; // each way once, in its middle's cell
      ways++;
      let stations = 0, bad = 0;
      const tops = new Map<string, number>();
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(l / 1.5));
        for (let j = i === 0 ? 0 : 1; j <= n; j++) {
          const x = ax + (bx - ax) * j / n, y = ay + (by - ay) * j / n;
          const hits = near.flatMap(c => layersAt(c, x, y).hits).filter(h => !h.cut).sort(compareHits);
          const top = hits[0], ride = store.surface.height(x, y);
          stations++;
          const t = top ? top.layer : 'none';
          tops.set(t, (tops.get(t) ?? 0) + 1);
          if (!top || top.layer === 'water' || top.layer === 'quay' || top.z < ride - 0.5) bad++;
        }
      }
      if (bad >= 3 && bad * 2 >= stations) {
        const [lng, lat] = fromLocal(mid[0], mid[1]);
        if (log) console.log(`  missing ${w.id} ${w.tags.highway} "${w.tags.name ?? ''}" ${fromLocal(mid[0], mid[1]).map(v => v.toFixed(5))} ${bad}/${stations}`);
        missing.push({ id: w.id, name: w.tags.name ?? '', highway: w.tags.highway, lng: +lng.toFixed(5), lat: +lat.toFixed(5), stations, missing: bad, tops: [...tops].map(([k, v]) => `${k}:${v}`).join(' '), ride: +store.surface.height(mid[0], mid[1]).toFixed(2), waterZ: +store.waterZ(mid[0], mid[1]).toFixed(2) });
      }
    }
  }
  return { ways, missing };
}

async function main(): Promise<void> {
  const roads = new GroundStore(read, { roads: true }), plain = new GroundStore(read, { roads: false });
  await roads.init(); await plain.init();
  const keys = flag('cells')?.split(',') ?? (process.argv.includes('--all') ? [...roads.osmCells].sort() : [...roads.roadCells].sort());
  const highways = flag('highways') ? new RegExp(`^(${flag('highways')})$`) : process.argv.includes('--streets') ? STREET_HIGHWAYS : undefined;
  const max = flag('max') !== undefined ? Number(flag('max')) : Infinity;
  let over = false;
  const out: Record<string, unknown> = { cells: keys };
  // --all: the city in the default mode only (outside the roads-v1 cells both modes build the same ground).
  for (const [mode, s] of (process.argv.includes('--all') ? [['roads', roads]] : [['roads', roads], ['bands', plain]]) as [string, GroundStore][]) {
    const r = await auditBridgeSurfaces(s, keys, highways, true);
    out[mode] = r;
    console.log(`${mode}: ${r.missing.length} of ${r.ways} bridge ways missing a surface${max < Infinity ? ` (at most ${max})` : ''}`);
    if (r.missing.length > max) over = true;
    for (const m of r.missing) console.log(`  ${m.id} ${m.highway} "${m.name}" ${m.lng},${m.lat} ${m.missing}/${m.stations} stations (${m.tops}); ride ${m.ride}, water ${m.waterZ}${m.waterZ > m.ride ? ' (under the water level)' : ''}`);
  }
  if (flag('json')) writeFileSync(flag('json')!, JSON.stringify(out, null, 1));
  if (over) { console.log('FAIL more bridge ways without a surface than the cap'); process.exitCode = 1; }
}

if (process.argv[1]?.endsWith('audit-bridge-surfaces.ts')) main().catch(e => { console.error(e); process.exit(1); });
