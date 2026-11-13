/**
 * Ridge-vs-3DBAG audit (feedback round 2026-11-13, notes ba7fc535 and 10bd9a08, Bilderdijkkade: "gables are not on the
 * street side"). For every pitched city-tier roof it compares the saddle direction the generator draws (roofMesh.ts,
 * with and without streetRidge.ts's street turn) with the ridge 3DBAG measured (artifacts/roofs/bag3d-ridge-axes.json,
 * from scripts/roofs/bag3d-ridge-axes.mts) and counts the flips: gaps over 45 degrees, only for clean saddles
 * (coherence >= 0.75, >= 20 m2 slanted, pitch >= 15 degrees).
 *
 * Usage: tsx scripts/audit-ridge-vs-bag.ts [--areas-only] [--json=out.json] [--axes=artifacts/roofs/bag3d-ridge-axes.json]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gameDecorator, loadGameData, loadTile, tileKeyAt } from '../src/canalRecall/galleryPipeline.ts';
import { ORIGIN, asPolygons, meshBuildingFor } from '../src/canalRecall/threeBuildingFeatures.ts';
import { roofPiecesForOutline } from '../src/canalRecall/roofMesh.ts';
import { axisGapDeg } from '../src/canalRecall/roofs/ridgeAxis.ts';
import { FALLBACK_REACH_M, SegmentGrid, streetDistance, streetSegments } from '../src/canalRecall/streetFronts.ts';
import { type StreetFacing } from '../src/canalRecall/streetGableEnds.ts';

const BASE = 'public/data/extracts/amsterdam';
const args = process.argv.slice(2);
const flag = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const fetchImpl: typeof fetch = (async (url: string) => {
  const path = String(url).replace(/^.*?amsterdam\//, `${BASE}/`).replace(/^\.\.\/data\/extracts\/amsterdam/, BASE);
  return existsSync(path) ? new Response(readFileSync(path)) : new Response(null, { status: 404 });
}) as typeof fetch;

/** Sample areas: [name, lat, lng], 250 m round. */
export const AREAS: Array<[string, number, number]> = [
  ['Prinsengracht (Westermarkt)', 52.3745, 4.8838], ['Herengracht (Gouden Bocht)', 52.3655, 4.8935],
  ['Keizersgracht (Leidsegracht)', 52.3680, 4.8850], ['Kinkerstraat', 52.3665, 4.8700],
  ['Bilderdijkstraat', 52.3700, 4.8710], ['Utrechtsestraat', 52.3615, 4.8975],
];
const RADIUS_M = 250;
const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
const local = (lng: number, lat: number): [number, number] => [(lng - ORIGIN.lng) * kx, (lat - ORIGIN.lat) * KY];

const data = await loadGameData(BASE, fetchImpl);
const decorate = gameDecorator({ gables: data.gables, landmarkIds: data.landmarkIds, listed: data.listed });
const routing = JSON.parse(readFileSync(`${BASE}/streets-routing.json`, 'utf8')) as Array<{ highway?: string; path?: number[][]; paths?: number[][][] }>;
const streets = new SegmentGrid(streetSegments(routing.flatMap(w => (w.paths ?? (w.path ? [w.path] : [])).map(p => ({ highway: w.highway, points: p.map(([lat, lng]) => [lng, lat] as const) }))), ORIGIN), 200);

const areasOnly = args.includes('--areas-only');
const tiles: string[] = [];
if (areasOnly) {
  const set = new Set<string>();
  for (const [, lat, lng] of AREAS) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) set.add(tileKeyAt(lng + dx * RADIUS_M / kx, lat + dy * RADIUS_M / KY));
  tiles.push(...set);
} else for (const x of readdirSync(`${BASE}/building-tiles/14`)) for (const f of readdirSync(`${BASE}/building-tiles/14/${x}`)) tiles.push(`${x}/${f.replace('.geojson.gz', '')}`);


const axes = JSON.parse(readFileSync(flag('axes') ?? 'artifacts/roofs/bag3d-ridge-axes.json', 'utf8')) as Record<string, [number, number, number, number]>;
const RIDGED = new Set(['gable', 'pitched', 'mansard', 'halfHipped', 'hipped', 'mansardHip']);
type Row = { id: string; at: [number, number]; area: string | null; style: string; year: number | null; kind: string; gable: string; pieces: number; bag: number; coh: number; pitch: number; gen0: number; gen1: number; gap0: number; gap1: number; gap2: number; kind2: string; gable2: string; streetRidge: boolean };
const rows: Row[] = [];
const angleOf = (r: { ux: number; uy: number }) => ((Math.atan2(r.uy, r.ux) * 180 / Math.PI) % 180 + 180) % 180;
let pands = 0;
const flatUnder = { total: 0, c19school: 0, byArea: new Map<string, number>() };
for (const key of tiles) {
  const raw = await loadTile(key, BASE, fetchImpl);
  const features = raw.map(decorate);
  // The same tile with the ridge sidecar applied (src/canalRecall/roofs/ridgeFacts.ts): the rule after the fix.
  const stamped = raw.map(f => decorate({ ...f, properties: { ...f.properties, ...(axes[String(f.properties.id).replace('NL.IMBAG.Pand.', '')] && axes[String(f.properties.id).replace('NL.IMBAG.Pand.', '')][1] >= 0.75 && axes[String(f.properties.id).replace('NL.IMBAG.Pand.', '')][2] >= 20 && axes[String(f.properties.id).replace('NL.IMBAG.Pand.', '')][3] >= 15 ? { roofRidgeDeg: Math.round(axes[String(f.properties.id).replace('NL.IMBAG.Pand.', '')][0]) % 180 } : {}) } }));
  const segs: number[] = [], owners: number[] = [];
  features.forEach((f, i) => { for (const poly of asPolygons(f.geometry)) for (const ring of poly) for (let k = 1; k < ring.length; k++) { const a = local(ring[k - 1][0], ring[k - 1][1]), b = local(ring[k][0], ring[k][1]); segs.push(a[0], a[1], b[0], b[1]); owners.push(i); } });
  const walls = new SegmentGrid(segs, 25, owners);
  features.forEach((d, i) => {
    pands++;
    if (!d.properties.roofPlanned) return;
    const id = String(d.properties.id), ax = axes[id.replace('NL.IMBAG.Pand.', '')];
    if (!ax) {
      // 3DBAG has no slanted roof plane (>= 10 degrees, > 3 m2) over this pand: a roof drawn here is the generator's invention.
      const kind = String(d.properties.roofShape ?? '');
      if (RIDGED.has(kind) && !['hipped', 'mansardHip'].includes(kind)) {
        flatUnder.total++;
        const style = String(d.properties.facadeStyle);
        if (style === 'c19' || style === 'school') flatUnder.c19school++;
        const o = meshBuildingFor(d, 'photo')?.polygons[0]?.[0];
        const m = o ? local(o[0][0], o[0][1]) : null;
        const area = m ? AREAS.find(([, lat, lng]) => { const c = local(lng, lat); return Math.hypot(c[0] - m[0], c[1] - m[1]) <= RADIUS_M; })?.[0] : undefined;
        if (area) flatUnder.byArea.set(area, (flatUnder.byArea.get(area) ?? 0) + 1);
      }
      return;
    }
    if (ax[1] < 0.75 || ax[2] < 20 || ax[3] < 15) return;
    const b = meshBuildingFor(d, 'photo'), outer = b?.polygons[0]?.[0];
    if (!b?.roof || !outer || outer.length < 4 || !RIDGED.has(b.roof.plan.kind)) return;
    const facing: StreetFacing = (wall, fallback) => fallback ? streetDistance(wall, streets, null, i, FALLBACK_REACH_M) : streetDistance(wall, streets, walls, i);
    const before = roofPiecesForOutline(outer, ORIGIN, b.roof.plan, kx), after = roofPiecesForOutline(outer, ORIGIN, b.roof.plan, kx, facing);
    if (!before[0] || !after[0]) return;
    const centre = local(outer.reduce((s, q) => s + q[0], 0) / outer.length, outer.reduce((s, q) => s + q[1], 0) / outer.length);
    const area = AREAS.find(([, lat, lng]) => { const c = local(lng, lat); return Math.hypot(c[0] - centre[0], c[1] - centre[1]) <= RADIUS_M; })?.[0] ?? null;
    const g0 = angleOf(before[0].rect), g1 = angleOf(after[0].rect);
    const d2 = stamped[i], b2 = meshBuildingFor(d2, 'photo'), o2 = b2?.polygons[0]?.[0];
    const fix = b2?.roof && o2 && o2.length >= 4 ? roofPiecesForOutline(o2, ORIGIN, b2.roof.plan, kx, facing)[0] : undefined;
    rows.push({ id, at: [+(ORIGIN.lng + centre[0] / kx).toFixed(5), +(ORIGIN.lat + centre[1] / KY).toFixed(5)], area, style: String(d.properties.facadeStyle ?? ''), year: (d.properties.constructionYear as number) ?? null, kind: b.roof.plan.kind, gable: b.roof.plan.gable, pieces: after.length, bag: ax[0], coh: ax[1], pitch: ax[3], gen0: g0, gen1: g1, gap0: axisGapDeg(g0, ax[0]), gap1: axisGapDeg(g1, ax[0]), gap2: fix ? axisGapDeg(angleOf(fix.rect), ax[0]) : 90, kind2: fix?.plan.kind ?? 'flat', gable2: fix?.plan.gable ?? '', streetRidge: !!b.roof.plan.streetRidge });
  });
}
const flips = (list: Row[], k: 'gap0' | 'gap1' | 'gap2') => list.filter(r => r[k] > 45).length;
const lines = [`tiles ${tiles.length}  pands ${pands}  compared (clean 3DBAG saddle) ${rows.length}`];
const report = (name: string, list: Row[]) => lines.push(`${name.padEnd(34)} n ${String(list.length).padStart(6)}  flipped vs 3DBAG: no street test ${String(flips(list, 'gap0')).padStart(6)} (${(100 * flips(list, 'gap0') / Math.max(1, list.length)).toFixed(1)}%)  with street test ${String(flips(list, 'gap1')).padStart(6)} (${(100 * flips(list, 'gap1') / Math.max(1, list.length)).toFixed(1)}%)  with measured ridge ${String(flips(list, 'gap2')).padStart(6)} (${(100 * flips(list, 'gap2') / Math.max(1, list.length)).toFixed(1)}%)`);
for (const [name] of AREAS) report(name, rows.filter(r => r.area === name));
report('city', rows);
for (const style of [...new Set(rows.map(r => r.style))].sort()) report(`  style ${style || '?'}`, rows.filter(r => r.style === style));
for (const kind of [...new Set(rows.map(r => r.kind))].sort()) report(`  kind ${kind}`, rows.filter(r => r.kind === kind));
report('  streetRidge (turnable) pieces', rows.filter(r => r.streetRidge));
lines.push(`gable/pitched/mansard/half-hip roofs drawn over a pand 3DBAG measures with no slanted roof plane: ${flatUnder.total} (c19/school ${flatUnder.c19school}); by sample area: ${[...flatUnder.byArea].map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(lines.join('\n'));
const json = flag('json');
if (json) writeFileSync(json, JSON.stringify(rows, null, 1));
