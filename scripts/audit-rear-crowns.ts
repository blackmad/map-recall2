/**
 * Rear-crown audit (user 2026-10-16: "sometimes houses have gables on both the street and back side, which is wrong").
 *
 * Runs the city tier exactly as the chunk builder does: every building tile through the game's decorator chain
 * (galleryPipeline.gameDecorator), the roof plan (`meshBuildingFor`), and the generated gable pieces
 * (`gablePiecesForOutline`) with the street test the chunk builder passes (streetGableEnds.ts over the routing streets
 * and the surrounding buildings' walls). Counts, per sample area and city-wide, houses whose ornamental crown (any
 * shaped gable but `plain`: step, neck, bell, spout, clock, raised neck, cornice front) stands on an end that is not a
 * street front, before (no street test, the old rule) and after.
 *
 * Usage: tsx scripts/audit-rear-crowns.ts [--json=out.json] [--areas-only]
 * Not covered here: admitted source frontages (sourceVisualRoof: their crown is drawn on the surveyed front only) and
 * the recipe / block-face path (crowns live on intent fronts, audited by `--faces`).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gameDecorator, loadGameData, loadTile, tileKeyAt } from '../src/canalRecall/galleryPipeline.ts';
import { ORIGIN, asPolygons, meshBuildingFor } from '../src/canalRecall/threeBuildingFeatures.ts';
import { gablePiecesForOutline } from '../src/canalRecall/roofMesh.ts';
import { FALLBACK_REACH_M, SegmentGrid, streetDistance, streetSegments } from '../src/canalRecall/streetFronts.ts';
import { gableEndWalls, streetGableEnds, type StreetFacing } from '../src/canalRecall/streetGableEnds.ts';

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

type Row = { id: string; tile: string; gable: string; style: string; area: string | null; centre: [number, number]; before: number; after: number; street: [boolean, boolean] | null; ends: number; throughLot: boolean; /** Outward normal of the plain (rear) end, metres frame: a camera standing behind the house looks along its reverse. */ rearNormal: [number, number] | null };
const rows: Row[] = [];
let pands = 0, gableRoofs = 0;
for (const key of tiles) {
  const features = (await loadTile(key, BASE, fetchImpl)).map(decorate);
  // Walls of this tile's buildings, owner = feature index (a building's own walls never block its rays).
  const segs: number[] = [], owners: number[] = [];
  features.forEach((f, i) => { for (const poly of asPolygons(f.geometry)) for (const ring of poly) for (let k = 1; k < ring.length; k++) { const a = local(ring[k - 1][0], ring[k - 1][1]), b = local(ring[k][0], ring[k][1]); segs.push(a[0], a[1], b[0], b[1]); owners.push(i); } });
  const walls = new SegmentGrid(segs, 25, owners);
  features.forEach((d, i) => {
    pands++;
    if (!d.properties.roofPlanned) return;
    const b = meshBuildingFor(d, 'photo');
    if (!b?.roof || b.roof.plan.kind !== 'gable') return;
    const outer = b.polygons[0]?.[0];
    if (!outer || outer.length < 4) return;
    gableRoofs++;
    const facing: StreetFacing = (wall, fallback) => fallback ? streetDistance(wall, streets, null, i, FALLBACK_REACH_M) : streetDistance(wall, streets, walls, i);
    const before = gablePiecesForOutline(outer, ORIGIN, b.roof.plan, kx), after = gablePiecesForOutline(outer, ORIGIN, b.roof.plan, kx, facing);
    const ornamental = (p: { plan: { gable: string } }) => p.plan.gable !== 'plain';
    const crowned = (list: typeof before) => list.filter(ornamental).flatMap(p => [0, 1].filter(e => p.plan.gableEnds?.[e] !== false && p.plan.streetEnds?.[e] !== false).map(e => ({ p, e })));
    // Ends crowned that are NOT a street end (null: no street known, both ends kept).
    const streetOf = after.map(p => streetGableEnds(p.rect, facing) ?? null);
    const offStreet = (list: typeof before) => crowned(list).filter(({ p, e }) => { const s = streetOf[list.indexOf(p)]; return s ? !s[e] : false; }).length;
    const centre = local(outer.reduce((s, q) => s + q[0], 0) / outer.length, outer.reduce((s, q) => s + q[1], 0) / outer.length);
    const area = AREAS.find(([, lat, lng]) => { const c = local(lng, lat); return Math.hypot(c[0] - centre[0], c[1] - centre[1]) <= RADIUS_M; })?.[0] ?? null;
    rows.push({ id: String(d.properties.id), tile: key, gable: b.roof.plan.gable, style: String(d.properties.facadeStyle ?? ''), area, centre, before: offStreet(before), after: offStreet(after), street: streetOf[0] ?? null, ends: crowned(before).length, throughLot: !!after[0] && gableEndWalls(after[0].rect).every(w => facing(w) < Infinity), rearNormal: after[0] && streetOf[0] ? (w => [+w.nx.toFixed(3), +w.ny.toFixed(3)] as [number, number])(gableEndWalls(after[0].rect)[streetOf[0][0] ? 1 : 0]) : null });
  });
}

const sum = (list: Row[], k: 'before' | 'after') => list.filter(r => r[k] > 0).length;
const lines: string[] = [`tiles ${tiles.length}  pands ${pands}  city-tier gable roofs ${gableRoofs}  ornamental ${rows.filter(r => r.gable !== 'plain').length}`];
const report = (name: string, list: Row[]) => {
  const orn = list.filter(r => r.gable !== 'plain');
  const both = orn.filter(r => r.ends >= 2), throughLots = orn.filter(r => r.throughLot), unknown = orn.filter(r => r.ends >= 2 && !r.street);
  lines.push(`${name.padEnd(30)} ornamental ${String(orn.length).padStart(5)}  crowned both ends (old) ${String(both.length).padStart(5)}  rear crown before ${String(sum(orn, 'before')).padStart(5)} after ${String(sum(orn, 'after')).padStart(4)}  through-lots (crown on nearer street) ${throughLots.length}, no street known (unchanged) ${unknown.length}`);
};
for (const [name] of AREAS) report(name, rows.filter(r => r.area === name));
report('sample total', rows.filter(r => r.area));
if (!areasOnly) report('city', rows);
const byShape = new Map<string, number>();
for (const r of rows.filter(r => r.before > 0)) byShape.set(r.gable, (byShape.get(r.gable) ?? 0) + 1);
lines.push(`rear crowns before, by shape: ${[...byShape].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(lines.join('\n'));
const json = flag('json');
if (json) writeFileSync(json, JSON.stringify(rows.filter(r => r.gable !== 'plain'), null, 1));
