/**
 * D1 ring tranche selection (lane d1-tranche-ring-20261114): ordinary 1850-1940 fronts in the inner ring just outside the
 * Singelgracht, ranked by where players ride, for the D1 describer (describe-cut.ts cut, then write-answer.ts, stage.ts).
 *
 * Population: pands whose centroid lies in RING_BUURTEN (coverage-v1 buurten: De Pijp, Oud-West, Weteringschans edge
 * without AH07, Plantage/Weesperbuurt, Oosterparkbuurt, Staatsliedenbuurt, Frederik Hendrikbuurt), BAG build year
 * 1850-1940, building-tile height >= 6 m, not covered by any installed model (models/covers.json: landmark, chunk or
 * ordinary), not held (ordinary-buildings-data/held.json), and drawn by the generic layer within MAX_CURVATURE_M of their
 * BAG position (the linear-origin north-south residual, buildingMercatorFromLocal against exact Web Mercator; TODO "the D1
 * 1,000-front tranche ... curvature <= 0.4 m").
 *
 * Street: the nearest named street way (streets-routing.json, no cycleway/footway/path/service/motorway) to the centroid,
 * within 40 m. Ride: ride-visibility.ts score (300 seeded routes, seed 7), the route-C template-coverage instrument.
 *
 * Ranking (rows, not houses: acceptance is a row sheet per street): a street is street name x buurt-wijk. Tier 0 the named
 * shopping streets (SHOPPING, the lane brief's order), tier 1 any other street the street-class table calls main, tier 2
 * the rest; inside a tier, streets by summed ride score of their eligible fronts. Whole streets are taken until --target.
 *
 *   node --max-old-space-size=8192 --import tsx scripts/house-specs/describer-d1/tranche-ring.ts [--target 1000] [--out <dir>]
 * Writes <out>/ring-candidates.json (every eligible front with street, ride, tier) and <out>/ring-ids.txt (the tranche, ranked).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { streetClassOf } from '../../../src/canalRecall/houseSpec/streetClass.ts';
import { buildingMercatorFromLocal } from '../../../src/canalRecall/buildingProjectionScale.ts';
import { mercatorOfLngLat, mercatorUnitsPerMetre } from '../../../src/canalRecall/rendererShared/frameMath.ts';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const TARGET = Number(arg('target') ?? 1000), OUT = arg('out') ?? 'artifacts/describer-d1/ring-20261114';
const EXTRACT = 'public/data/extracts/amsterdam';

/** The ring buurten (coverage-v1 codes). The canal belt sister lane owns AA-AG and AH07. */
export const RING_BUURTEN: Record<string, string> = {
  KE01: 'Oude Pijp', KE02: 'Oude Pijp', KE03: 'Oude Pijp', KE04: 'Oude Pijp', KE05: 'Oude Pijp',
  KF01: 'Nieuwe Pijp', KF02: 'Nieuwe Pijp', KF03: 'Nieuwe Pijp', KF04: 'Nieuwe Pijp',
  EQ01: 'Da Costabuurt', ES01: 'Van Lennepbuurt', ES02: 'Van Lennepbuurt', ES03: 'Da Costabuurt',
  EP01: 'Bellamybuurt (Kinkerbuurt)', EP02: 'Bellamybuurt (Kinkerbuurt)',
  EU01: 'Helmersbuurt', EU02: 'Helmersbuurt', EU03: 'Helmersbuurt', ET01: 'Overtoomse Sluis', ET02: 'Overtoomse Sluis', EV01: 'Vondelparkbuurt', EV02: 'Vondelparkbuurt',
  AH01: 'Weteringschans', AH02: 'Weteringschans', AH03: 'Weteringschans', AH04: 'Weteringschans', AH05: 'Weteringschans', AH06: 'Weteringschans', AH08: 'Weteringschans',
  AJ01: 'Weesperbuurt/Plantage', AJ02: 'Weesperbuurt/Plantage', AJ03: 'Weesperbuurt/Plantage', AJ04: 'Weesperbuurt/Plantage',
  MC01: 'Oosterparkbuurt', MC03: 'Oosterparkbuurt', MC04: 'Oosterparkbuurt',
  EH01: 'Staatsliedenbuurt', EH02: 'Staatsliedenbuurt', EH03: 'Staatsliedenbuurt', EH04: 'Staatsliedenbuurt', EH05: 'Staatsliedenbuurt', EH06: 'Staatsliedenbuurt',
  EJ01: 'Frederik Hendrikbuurt', EJ02: 'Frederik Hendrikbuurt', EJ03: 'Frederik Hendrikbuurt',
};
/** The brief's main shopping streets, in its order (tier 0). */
export const SHOPPING = ['Ferdinand Bolstraat', 'Van Woustraat', 'Kinkerstraat', 'Jan Pieter Heijestraat', 'Overtoom', 'Eerste Constantijn Huygensstraat', 'Haarlemmerweg'];
export const YEARS = [1850, 1940] as const;
export const MAX_CURVATURE_M = 0.4;

const ORIGIN = { lng: 4.9, lat: 52.37 }, KX0 = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY0 = 110_540;
const LAYER = buildingMercatorFromLocal(ORIGIN);
/** Metres between where the generic layer draws a point and its exact Web Mercator position. */
export function curvatureM(lng: number, lat: number): number {
  const lx = (lng - ORIGIN.lng) * KX0, ly = (lat - ORIGIN.lat) * KY0;
  const got = [LAYER[0] * lx + LAYER[12], LAYER[5] * ly + LAYER[13]], want = mercatorOfLngLat(lng, lat);
  return Math.hypot(got[0] - want[0], got[1] - want[1]) / mercatorUnitsPerMetre(want[1]);
}

async function main() {
  const gz = (f: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
  type Ring = number[][];
  const inside = (p: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const polys = (g: any): Ring[][] => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const buurten = (JSON.parse(fs.readFileSync(path.join(EXTRACT, 'coverage-v1/buurten.json'), 'utf8')).features as any[]).filter(b => RING_BUURTEN[b.properties.code]);
  const bbox = buurten.map(b => { const pts = polys(b.geometry).flat(2); return [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]; });
  const covered = new Set<string>();
  for (const v of Object.values(JSON.parse(fs.readFileSync('public/canal-drive/models/covers.json', 'utf8')).models as Record<string, { p?: string[] }>)) for (const p of v.p ?? []) covered.add(p);
  const held = new Set(Object.keys(JSON.parse(fs.readFileSync('public/canal-drive/ordinary-buildings-data/held.json', 'utf8')).held).map(k => k.replace(/^ordinary-/, '')));

  type Front = { id: string; at: [number, number]; year: number; buurt: string; area: string; heightM: number; curvatureM: number; street?: string | null; ride?: number; tier?: number };
  const pop: Front[] = []; const drop: Record<string, number> = {};
  const no = (k: string) => { drop[k] = (drop[k] ?? 0) + 1; };
  for (const x of fs.readdirSync(path.join(EXTRACT, 'building-tiles/14')).filter(d => /^\d+$/.test(d))) for (const yf of fs.readdirSync(path.join(EXTRACT, 'building-tiles/14', x))) {
    const y = yf.replace('.geojson.gz', ''), bagF = path.join(EXTRACT, 'bag-facts/14', x, `${y}.json.gz`);
    if (!fs.existsSync(bagF)) continue;
    const bag = gz(bagF).pands;
    for (const f of gz(path.join(EXTRACT, 'building-tiles/14', x, yf)).features) {
      const id = String(f.properties.id); if (!id.startsWith('NL.IMBAG.Pand.')) continue;
      const short = id.slice(14), ring = polys(f.geometry)[0]?.[0]; if (!ring) continue;
      const c: [number, number] = [ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length];
      const bi = buurten.findIndex((b, i) => c[0] >= bbox[i][0] && c[0] <= bbox[i][2] && c[1] >= bbox[i][1] && c[1] <= bbox[i][3] && polys(b.geometry).some(pg => inside(c, pg[0])));
      if (bi < 0) continue;
      const year = bag[short]?.[5];
      if (!year || year < YEARS[0] || year > YEARS[1]) { no('year'); continue; }
      if ((f.properties.height ?? 0) < 6) { no('height<6'); continue; }
      if (covered.has(short)) { no('installed-model'); continue; }
      if (held.has(short)) { no('held'); continue; }
      const cm = curvatureM(c[0], c[1]);
      if (cm > MAX_CURVATURE_M) { no('curvature'); continue; }
      const code = buurten[bi].properties.code;
      pop.push({ id: short, at: c, year, buurt: code, area: RING_BUURTEN[code], heightM: f.properties.height, curvatureM: +cm.toFixed(3) });
    }
  }
  console.error(`population ${pop.length}; dropped ${JSON.stringify(drop)}`);
  const rv = await import('../../building-recipes/ride-visibility.ts');
  const fp = rv.loadFootprints(), samples = rv.sampleRoutes(300, 7).samples, score = rv.scorer(samples, fp);
  for (const p of pop) p.ride = score(`NL.IMBAG.Pand.${p.id}`)?.score ?? 0;
  const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540, CELL = 60;
  const SKIP = new Set(['cycleway', 'footway', 'path', 'service', 'motorway', 'motorway_link', 'trunk_link']);
  const segs: [number, number, number, number, string][] = [], grid = new Map<string, number[]>();
  for (const w of JSON.parse(fs.readFileSync(path.join(EXTRACT, 'streets-routing.json'), 'utf8')) as { name: string; highway: string; path: [number, number][] }[]) {
    if (!w.name || SKIP.has(w.highway)) continue;
    for (let i = 0; i + 1 < w.path.length; i++) {
      const [a0, b0] = w.path[i], [a1, b1] = w.path[i + 1];
      const s1 = [b0 * KX, a0 * KY, b1 * KX, a1 * KY] as const, k = segs.push([...s1, w.name]) - 1;
      for (let gx = Math.floor(Math.min(s1[0], s1[2]) / CELL); gx <= Math.floor(Math.max(s1[0], s1[2]) / CELL); gx++)
        for (let gy = Math.floor(Math.min(s1[1], s1[3]) / CELL); gy <= Math.floor(Math.max(s1[1], s1[3]) / CELL); gy++) { const key = `${gx},${gy}`; (grid.get(key) ?? grid.set(key, []).get(key)!).push(k); }
    }
  }
  const streetAt = (lng: number, lat: number): string | null => {
    const x = lng * KX, y = lat * KY, gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    let best: string | null = null, bd = 40;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const k of grid.get(`${gx + i},${gy + j}`) ?? []) {
      const [x0, y0, x1, y1, n] = segs[k], dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L)) : 0, d = Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };
  for (const p of pop) {
    p.street = streetAt(p.at[0], p.at[1]);
    const s = SHOPPING.indexOf(p.street ?? '');
    p.tier = s >= 0 ? 0 : streetClassOf(p.street) === 'main' ? 1 : 2;
  }
  // rows: street x area; rank tier, then (tier 0) the brief's order, then summed ride
  const rows = new Map<string, Front[]>();
  for (const p of pop) if (p.street && (p.ride ?? 0) > 0) { const k = `${p.street} | ${p.area}`; (rows.get(k) ?? rows.set(k, []).get(k)!).push(p); }
  const ranked = [...rows].map(([k, fs_]) => ({ key: k, street: fs_[0].street!, area: fs_[0].area, tier: fs_[0].tier!, fronts: fs_.sort((a, b) => (b.ride ?? 0) - (a.ride ?? 0)), ride: fs_.reduce((s, p) => s + (p.ride ?? 0), 0) }))
    .filter(r => r.fronts.length >= 3)
    .sort((a, b) => a.tier - b.tier || (a.tier === 0 ? SHOPPING.indexOf(a.street) - SHOPPING.indexOf(b.street) : 0) || b.ride - a.ride);
  const take: typeof ranked = []; let n = 0;
  for (const r of ranked) { if (n >= TARGET) break; take.push(r); n += r.fronts.length; }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'ring-candidates.json'), `${JSON.stringify({ v: 1, buurten: RING_BUURTEN, years: YEARS, maxCurvatureM: MAX_CURVATURE_M, dropped: drop, population: pop.length,
    rows: ranked.map(r => ({ key: r.key, tier: r.tier, ride: Math.round(r.ride), n: r.fronts.length, taken: take.includes(r), fronts: r.fronts.map(p => ({ id: p.id, year: p.year, buurt: p.buurt, ride: Math.round(p.ride ?? 0), curvatureM: p.curvatureM, at: p.at })) })) }, null, 1)}\n`);
  fs.writeFileSync(path.join(OUT, 'ring-ids.txt'), `${take.flatMap(r => r.fronts.map(p => p.id)).join('\n')}\n`);
  for (const r of take) console.log(`${r.tier} ${r.fronts.length.toString().padStart(3)} ${Math.round(r.ride).toString().padStart(9)} ${r.key}`);
  console.error(`tranche ${n} fronts in ${take.length} rows (of ${ranked.length} rows, ${pop.length} eligible)`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
