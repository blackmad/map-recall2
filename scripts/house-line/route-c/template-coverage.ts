/**
 * Street-template coverage (lane C-completer, round 3 ranking): the share of fronts with a QUALIFYING template
 * (streetTemplate.ts: same street, else same class and scale, else scale; same band; within 300 m), for the AH07 fronts and
 * for the ride-ranked top N pre-1945 fronts of the ride-priority gebieden (Centrum and the first ring,
 * src/canalRecall/ridePriority.ts; ride score: ride-visibility.ts, 300 seeded routes). Each front's street is the nearest named
 * street way (routing extract; no cycleway, footway, path, service or motorway) to the pand centroid, an approximation for
 * corner and deep pands; its scale is the building tile's height and footprint narrow side (the table's instrument).
 * Also lists the main-street segments (street x gebied) whose fronts have no template, ranked by fronts served: input for a
 * seed lane.
 *
 *   node --max-old-space-size=8192 --import tsx scripts/house-line/route-c/template-coverage.ts [--top 5000] [--out <json>]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { streetTemplateFor, footprintWidthM, TEMPLATE_BANDS } from '../../../src/canalRecall/houseSpec/streetTemplate.ts';
import { streetClassOf } from '../../../src/canalRecall/houseSpec/streetClass.ts';
import { RIDE_PRIORITY_GEBIEDEN } from '../../../src/canalRecall/ridePriority.ts';
import { familyOf } from '../../../src/canalRecall/houseSpec/families.ts';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const TOP = Number(arg('top') ?? 5000), OUT = arg('out') ?? 'artifacts/route-c/template-coverage.json';
const EXTRACT = 'public/data/extracts/amsterdam';
const gz = (f: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
type Ring = number[][];
const inside = (p: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const polys = (g: any): Ring[][] => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
const buurten = (JSON.parse(fs.readFileSync(path.join(EXTRACT, 'coverage-v1/buurten.json'), 'utf8')).features as any[]).filter(b => RIDE_PRIORITY_GEBIEDEN.has(b.properties.gebied));
const bbox = buurten.map(b => { const pts = polys(b.geometry).flat(2); return [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]; });

// Population: pre-1945 pands 6 m or taller in the ride-priority buurten.
type Front = { id: string; at: [number, number]; year: number; gebied: string; buurt: string; heightM: number | null; widthM: number | null; street?: string | null };
const pop: Front[] = [];
const scaleOf = new Map<string, { heightM: number | null; widthM: number | null }>();
for (const x of fs.readdirSync(path.join(EXTRACT, 'building-tiles/14')).filter(d => /^\d+$/.test(d))) for (const yf of fs.readdirSync(path.join(EXTRACT, 'building-tiles/14', x))) {
  const y = yf.replace('.geojson.gz', ''), bagF = path.join(EXTRACT, 'bag-facts/14', x, `${y}.json.gz`);
  if (!fs.existsSync(bagF)) continue;
  const bag = gz(bagF).pands;
  for (const f of gz(path.join(EXTRACT, 'building-tiles/14', x, yf)).features) {
    const id = String(f.properties.id); if (!id.startsWith('NL.IMBAG.Pand.')) continue;
    const short = id.slice(14), d = bag[short]; const year = d?.[5];
    { const r0 = polys(f.geometry)[0]?.[0]; if (r0) scaleOf.set(short, { heightM: typeof f.properties.height === 'number' && f.properties.height > 0 ? f.properties.height : null, widthM: footprintWidthM(r0) }); }
    if (!year || year >= 1945 || (f.properties.height ?? 0) < 6) continue;
    const ring = polys(f.geometry)[0]?.[0]; if (!ring) continue;
    const c: [number, number] = [ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length];
    const bi = buurten.findIndex((b, i) => c[0] >= bbox[i][0] && c[0] <= bbox[i][2] && c[1] >= bbox[i][1] && c[1] <= bbox[i][3] && polys(b.geometry).some(pg => inside(c, pg[0])));
    if (bi < 0) continue;
    pop.push({ id: short, at: c, year, gebied: buurten[bi].properties.gebied, buurt: buurten[bi].properties.code ?? buurten[bi].properties.naam, ...scaleOf.get(short)! });
  }
}
console.error(`population ${pop.length}`);
const rv = await import('../../building-recipes/ride-visibility.ts');
const fp = rv.loadFootprints(), samples = rv.sampleRoutes(300, 7).samples, score = rv.scorer(samples, fp);
const scored = pop.map(p => ({ ...p, ride: score(`NL.IMBAG.Pand.${p.id}`)?.score ?? 0 })).sort((a, b) => b.ride - a.ride);
const top = scored.slice(0, TOP);
// Nearest named street way to a point (metres; grid of 60 m cells).
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
  let best: string | null = null, bd = 60;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const k of grid.get(`${gx + i},${gy + j}`) ?? []) {
    const [x0, y0, x1, y1, n] = segs[k], dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L)) : 0, d = Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
};
for (const p of top) p.street = streetAt(p.at[0], p.at[1]);
type Cov = { fronts: number; withTemplate: number; share: number; byTier: Record<string, number>; byBand: Record<string, { withTemplate: number; fronts: number; share: number }>; byClass: Record<string, { withTemplate: number; fronts: number; share: number }> };
const picks = new Map<string, string | null>();
const cover = (rows: Front[]): Cov => {
  let any = 0; const byTier: Record<string, number> = {}, byBand: Record<string, [number, number]> = {}, byClass: Record<string, [number, number]> = {};
  for (const r of rows) {
    const band = familyOf(r.year), cls = streetClassOf(r.street) ?? 'unknown';
    const pick = streetTemplateFor({ pandId: r.id, lng: r.at[0], lat: r.at[1], year: r.year, street: r.street, heightM: r.heightM, widthM: r.widthM });
    picks.set(r.id, pick?.tier ?? null);
    byBand[band] ??= [0, 0]; byBand[band][1]++; byClass[cls] ??= [0, 0]; byClass[cls][1]++;
    if (pick) { any++; byTier[pick.tier] = (byTier[pick.tier] ?? 0) + 1; byBand[band][0]++; byClass[cls][0]++; }
  }
  const sh = (m: Record<string, [number, number]>) => Object.fromEntries(Object.entries(m).map(([k, [a, t]]) => [k, { withTemplate: a, fronts: t, share: +(a / t).toFixed(3) }]));
  return { fronts: rows.length, withTemplate: any, share: +(any / Math.max(1, rows.length)).toFixed(3), byTier, byBand: sh(byBand), byClass: sh(byClass) };
};
const probe = JSON.parse(fs.readFileSync('artifacts/describer-d1/ah07-probe.json', 'utf8'));
const ah07 = fs.readdirSync('artifacts/describer-d1/staged-ah07').filter(f => f.startsWith('0363')).map(f => f.slice(0, 16)).map(id => probe[id]).filter(p => p?.at && p.year).map(p => ({ id: p.pandId, at: p.at, year: p.year, gebied: p.gebied, buurt: 'AH07', ...(scaleOf.get(p.pandId) ?? { heightM: null, widthM: null }), street: streetAt(p.at[0], p.at[1]) }));
const ah07Cov = cover(ah07);
const byGebied = Object.fromEntries([...new Set(top.map(t => t.gebied))].map(g => [g, cover(top.filter(t => t.gebied === g))]));
const topCov = cover(top);
// Main-street segments (street x gebied) with no template, ranked by the template-band fronts they serve (ride-score sum too).
const seg = new Map<string, { street: string; gebied: string; fronts: number; ride: number; buurten: Set<string>; bands: Record<string, number> }>();
for (const t of top) {
  if (streetClassOf(t.street) !== 'main' || !(TEMPLATE_BANDS as readonly string[]).includes(familyOf(t.year)) || picks.get(t.id)) continue;
  const k = `${t.street}|${t.gebied}`, e = seg.get(k) ?? { street: t.street!, gebied: t.gebied, fronts: 0, ride: 0, buurten: new Set(), bands: {} };
  e.fronts++; e.ride += t.ride; e.buurten.add(t.buurt); e.bands[familyOf(t.year)] = (e.bands[familyOf(t.year)] ?? 0) + 1; seg.set(k, e);
}
const mainWithout = [...seg.values()].sort((a, b) => b.fronts - a.fronts || b.ride - a.ride).map(e => ({ ...e, ride: Math.round(e.ride), buurten: [...e.buurten].sort() }));
const out = { v: 2, ranking: 'round 3: street | class+scale | scale, same band, 300 m, scale = tile height +-2 m and narrow side +-1 m; bands before 1920 only', ah07: ah07Cov, [`top${TOP}`]: topCov, topByGebied: byGebied, mainStreetsWithoutTemplate: mainWithout, population: pop.length, rideRoutes: 300 };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
