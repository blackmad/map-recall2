/**
 * Street-template coverage (lane C-completer round 2): the share of fronts with a template of their band within 150 m
 * (streetTemplate.ts), for the AH07 staged fronts and for the ride-ranked top N pre-1945 fronts of the ride-priority
 * gebieden (Centrum and the first ring, src/canalRecall/ridePriority.ts; ride score: ride-visibility.ts, 300 seeded routes).
 *
 *   node --max-old-space-size=8192 --import tsx scripts/house-line/route-c/template-coverage.ts [--top 5000] [--out <json>]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { streetTemplateFor, templatesInReach } from '../../../src/canalRecall/houseSpec/streetTemplate.ts';
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
const pop: { id: string; at: [number, number]; year: number; gebied: string; buurt: string }[] = [];
for (const x of fs.readdirSync(path.join(EXTRACT, 'building-tiles/14')).filter(d => /^\d+$/.test(d))) for (const yf of fs.readdirSync(path.join(EXTRACT, 'building-tiles/14', x))) {
  const y = yf.replace('.geojson.gz', ''), bagF = path.join(EXTRACT, 'bag-facts/14', x, `${y}.json.gz`);
  if (!fs.existsSync(bagF)) continue;
  const bag = gz(bagF).pands;
  for (const f of gz(path.join(EXTRACT, 'building-tiles/14', x, yf)).features) {
    const id = String(f.properties.id); if (!id.startsWith('NL.IMBAG.Pand.')) continue;
    const short = id.slice(14), d = bag[short]; const year = d?.[5];
    if (!year || year >= 1945 || (f.properties.height ?? 0) < 6) continue;
    const ring = polys(f.geometry)[0]?.[0]; if (!ring) continue;
    const c: [number, number] = [ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length];
    const bi = buurten.findIndex((b, i) => c[0] >= bbox[i][0] && c[0] <= bbox[i][2] && c[1] >= bbox[i][1] && c[1] <= bbox[i][3] && polys(b.geometry).some(pg => inside(c, pg[0])));
    if (bi < 0) continue;
    pop.push({ id: short, at: c, year, gebied: buurten[bi].properties.gebied, buurt: buurten[bi].properties.code ?? buurten[bi].properties.naam });
  }
}
console.error(`population ${pop.length}`);
const rv = await import('../../building-recipes/ride-visibility.ts');
const fp = rv.loadFootprints(), samples = rv.sampleRoutes(300, 7).samples, score = rv.scorer(samples, fp);
const scored = pop.map(p => ({ ...p, ride: score(`NL.IMBAG.Pand.${p.id}`)?.score ?? 0 })).sort((a, b) => b.ride - a.ride);
const top = scored.slice(0, TOP);
const cover = (rows: { id: string; at: [number, number]; year: number }[]) => {
  let n = 0, any = 0; const pool: number[] = []; const byBand: Record<string, [number, number]> = {};
  for (const r of rows) {
    const reach = templatesInReach({ pandId: r.id, lng: r.at[0], lat: r.at[1], year: r.year }), band = familyOf(r.year);
    byBand[band] ??= [0, 0]; byBand[band][1]++;
    n++; if (reach.length) { any++; pool.push(reach.length); byBand[band][0]++; }
  }
  pool.sort((a, b) => a - b);
  return { fronts: n, withTemplate: any, share: +(any / Math.max(1, n)).toFixed(3), medianInReach: pool[Math.floor(pool.length / 2)] ?? 0, byBand: Object.fromEntries(Object.entries(byBand).map(([k, [a, t]]) => [k, { withTemplate: a, fronts: t, share: +(a / t).toFixed(3) }])) };
};
const probe = JSON.parse(fs.readFileSync('artifacts/describer-d1/ah07-probe.json', 'utf8'));
const ah07 = fs.readdirSync('artifacts/describer-d1/staged-ah07').filter(f => f.startsWith('0363')).map(f => f.slice(0, 16)).map(id => probe[id]).filter(p => p?.at && p.year).map(p => ({ id: p.pandId, at: p.at, year: p.year }));
const byGebied = Object.fromEntries([...new Set(top.map(t => t.gebied))].map(g => [g, cover(top.filter(t => t.gebied === g))]));
const out = { v: 1, radiusM: 150, ah07: cover(ah07), [`top${TOP}`]: cover(top), topByGebied: byGebied, population: pop.length, rideRoutes: 300 };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
