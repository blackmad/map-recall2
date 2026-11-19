// Street furniture over open water (feedback ee2b30): classify every published record (src/canalRecall/streetFurniture/
// overWater.ts) against elevation-v1's water and shores, piers-v1 and the bridges, and stage the extract without the
// `open` ones. The raw register cache build.ts reads is not needed: this pass runs on the published tiles.
//
//   npx tsx scripts/street-furniture/drop-over-water.ts             # staging + artifacts/street-furniture/over-water.json (every wet record, its class)
//   npx tsx scripts/street-furniture/drop-over-water.ts --publish   # also copy staging into the published extract
//
// Not published (lane fb-ground 2026-11-19): of the 119 `open` records, orthophoto checks of the four largest clusters
// found one real open-water case (a pond west of the Arena, 4.940,52.316); the others stand on real jetties OSM does
// not map as piers (Nieuwe Meer houseboat jetties 4.850,52.340; two piers at 4.955,52.367) or on a causeway road the
// water snapshot covers (4.750,52.386). Read over-water.json as a list of unmapped structures, not as a drop list.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { classifyOverWater, dropOverWater, type WaterClass, type WaterTests } from '../../src/canalRecall/streetFurniture/overWater.ts';
import { placePiers, type PiersExtract } from '../../src/canalRecall/ownGround/piers.ts';
import type { FurnitureRecord } from '../../src/canalRecall/streetFurniture/extract.ts';
import { PUBLISHED, STAGING } from './build.ts';

const AMS = 'public/data/extracts/amsterdam', E = `${AMS}/elevation-v1`;
type V = [number, number];

export function waterTests(): WaterTests {
  const idx = JSON.parse(readFileSync(`${E}/index.json`, 'utf8'));
  const [ox, oy] = idx.origin as V, [mx, my] = idx.metresPerDegree as V, q = idx.quantization.xy as number, size = idx.cellSizeM as number;
  const P = (lng: number, lat: number): V => [(lng - ox) * mx, (lat - oy) * my];
  const cells = new Map<string, { polys: V[][][]; shores: V[][] } | null>();
  const cell = (cx: number, cy: number) => {
    const k = `${cx}_${cy}`;
    if (!cells.has(k)) {
      let v: { polys: V[][][]; shores: V[][] } | null = null;
      try {
        const c = JSON.parse(readFileSync(`${E}/cells/${k}.json`, 'utf8'));
        const ring = (r: number[]): V[] => { const o: V[] = []; for (let i = 0; i < r.length; i += 2) o.push([cx * size + r[i] * q, cy * size + r[i + 1] * q]); return o; };
        v = { polys: c.water.map((p: number[][]) => p.map(ring)), shores: c.shore.map(ring) };
      } catch { /* no water cell */ }
      cells.set(k, v);
    }
    return cells.get(k)!;
  };
  const inRing = (x: number, y: number, r: readonly V[]) => { let s = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) s = !s; return s; };
  const segDist = (x: number, y: number, a: V, b: V) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0; return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
  const piersEx = JSON.parse(gunzipSync(readFileSync(`${AMS}/piers-v1/piers.json.gz`)).toString()) as PiersExtract;
  const piers = placePiers(piersEx.piers, p => P(p[0], p[1]));
  // Bridges: routing ways tagged bridge, and the register's outlines (measured decks and fallback footprints).
  const lines = (JSON.parse(readFileSync(`${AMS}/streets-routing.json`, 'utf8')) as { bridge?: unknown; path?: [number, number][] }[]).filter(l => l.bridge && l.path);
  const segs: [V, V][] = [];
  for (const l of lines) for (let i = 1; i < l.path!.length; i++) segs.push([P(l.path![i - 1][1], l.path![i - 1][0]), P(l.path![i][1], l.path![i][0])]);
  const G = 50, grid = new Map<string, [V, V][]>();
  for (const s of segs) for (let gx = Math.floor(Math.min(s[0][0], s[1][0]) / G); gx <= Math.floor(Math.max(s[0][0], s[1][0]) / G); gx++) for (let gy = Math.floor(Math.min(s[0][1], s[1][1]) / G); gy <= Math.floor(Math.max(s[0][1], s[1][1]) / G); gy++) (grid.get(`${gx},${gy}`) ?? grid.set(`${gx},${gy}`, []).get(`${gx},${gy}`)!).push(s);
  const bridges = JSON.parse(readFileSync(`${E}/bridges.json`, 'utf8'));
  const outline = (r: number[]): V[] => { const o: V[] = []; for (let i = 0; i + 1 < r.length; i += 2) o.push([r[i] * q, r[i + 1] * q]); return o; };
  const rings = [...bridges.measured.map((b: { outline: number[] }) => outline(b.outline)), ...bridges.fallback.map((b: { ring: number[] }) => outline(b.ring))].filter(r => r.length >= 3);
  return {
    wet(lng, lat) {
      const [x, y] = P(lng, lat), c = cell(Math.floor(x / size), Math.floor(y / size));
      return !!c && c.polys.some(p => p.reduce((s, r) => (inRing(x, y, r) ? !s : s), false));
    },
    onPier(lng, lat) {
      const [x, y] = P(lng, lat);
      return piers.some(p => x >= p.bbox[0] && x <= p.bbox[2] && y >= p.bbox[1] && y <= p.bbox[3] && inRing(x, y, p.ring));
    },
    bridgeDistance(lng, lat) {
      const [x, y] = P(lng, lat);
      if (rings.some(r => inRing(x, y, r))) return 0;
      let d = Infinity;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of grid.get(`${Math.floor(x / G) + i},${Math.floor(y / G) + j}`) ?? []) d = Math.min(d, segDist(x, y, s[0], s[1]));
      return d;
    },
    shoreDistance(lng, lat) {
      const [x, y] = P(lng, lat), cx = Math.floor(x / size), cy = Math.floor(y / size);
      let d = Infinity;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of cell(cx + i, cy + j)?.shores ?? []) for (let k = 1; k < s.length; k++) d = Math.min(d, segDist(x, y, s[k - 1], s[k]));
      return d;
    },
  };
}

async function main(): Promise<void> {
  const t = waterTests();
  const index = JSON.parse(readFileSync(`${PUBLISHED}/index.json`, 'utf8'));
  rmSync(STAGING, { recursive: true, force: true });
  mkdirSync(`${STAGING}/tiles`, { recursive: true });
  const total: Record<WaterClass, number> = { land: 0, pier: 0, bridge: 0, shore: 0, open: 0 };
  const wet: { id: string; kind: string; lng: number; lat: number; class: WaterClass }[] = [];
  const tiles = [];
  let kept = 0;
  for (const tile of index.tiles as { key: string; url: string; count: number; bytes: number }[]) {
    const data = JSON.parse(gunzipSync(readFileSync(`${PUBLISHED}/${tile.url}`)).toString()) as { version: number; key: string; items: FurnitureRecord[] };
    const r = dropOverWater(data.items, t);
    for (const k of Object.keys(total) as WaterClass[]) total[k] += r.counts[k];
    for (const x of data.items) { const c = classifyOverWater(x, t); if (c !== 'land') wet.push({ id: x.id, kind: x.kind, lng: x.lng, lat: x.lat, class: c }); }
    kept += r.kept.length;
    if (!r.kept.length) continue;
    const bytes = gzipSync(JSON.stringify({ ...data, items: r.kept }), { level: 9 });
    writeFileSync(`${STAGING}/${tile.url}`, bytes);
    tiles.push({ ...tile, count: r.kept.length, bytes: bytes.length });
  }
  const dropped = wet.filter(w => w.class === 'open');
  const recount: Record<string, Record<string, number>> = {};
  for (const tile of tiles) for (const x of (JSON.parse(gunzipSync(readFileSync(`${STAGING}/${tile.url}`)).toString()).items as FurnitureRecord[])) { const k = recount[x.kind] ??= {}; k[x.subtype] = (k[x.subtype] ?? 0) + 1; }
  const rejected = { ...index.rejected };
  for (const d of dropped) rejected[`${d.kind}: over open water (no pier, bridge or quay within reach; overWater.ts)`] = (rejected[`${d.kind}: over open water (no pier, bridge or quay within reach; overWater.ts)`] ?? 0) + 1;
  writeFileSync(`${STAGING}/index.json`, JSON.stringify({ ...index, total: kept, counts: recount, rejected, tiles, overWater: 'Records over elevation-v1 water with no OSM pier (piers-v1), bridge or quay within reach are dropped (src/canalRecall/streetFurniture/overWater.ts, feedback ee2b30).' }, null, 2) + '\n');
  mkdirSync('artifacts/street-furniture', { recursive: true });
  writeFileSync('artifacts/street-furniture/over-water.json', JSON.stringify(wet, null, 1));
  console.log(JSON.stringify({ total: index.total, kept, classes: total, droppedByKind: dropped.reduce((m, d) => ({ ...m, [d.kind]: (m[d.kind] ?? 0) + 1 }), {} as Record<string, number>) }, null, 2));
  if (process.argv.includes('--publish')) {
    rmSync(PUBLISHED, { recursive: true, force: true });
    cpSync(STAGING, PUBLISHED, { recursive: true });
    console.log(`published ${PUBLISHED}`);
  } else if (existsSync(`${PUBLISHED}/index.json`)) console.log(`staged ${STAGING} (publish with --publish)`);
}

if (process.argv[1]?.endsWith('drop-over-water.ts')) void main();
