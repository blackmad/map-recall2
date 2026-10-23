/**
 * Gable orientation audit (user 2026-10-23, feedback 74dc761d, Marnixstraat at the Lijnbaansgracht: "buildings have
 * gables pointing the wrong way"). An Amsterdam pre-1940 house turns its ridge across its street front, so its gable
 * faces the street; the city tier fitted every saddle to the footprint box's long axis, so a wide house or a
 * shallow row-pand drew its ridge along the street and its triangles at the neighbours.
 *
 * Runs the city tier as the chunk builder does (gameDecorator, meshBuildingFor, the roof plan, the street test over the
 * routing streets and the tile's walls) for the pands within `--radius` metres of a point, and prints per pand: style,
 * year, fitted box, which box sides see a street, the roof kind and whether each saddle's ridge runs along or across
 * the street front, before (no street test) and after (`roofPiecesForOutline` with the street test).
 *
 * Usage: tsx scripts/audit-gable-orientation.ts [--lng=4.881716 --lat=52.383032 --radius=120] [--rows]
 */
import { existsSync, readFileSync } from 'node:fs';
import { gameDecorator, loadGameData, loadTile, tileKeyAt } from '../src/canalRecall/galleryPipeline.ts';
import { ORIGIN, asPolygons, meshBuildingFor } from '../src/canalRecall/threeBuildingFeatures.ts';
import { roofPiecesForOutline, type Rect } from '../src/canalRecall/roofMesh.ts';
import { FALLBACK_REACH_M, SegmentGrid, streetDistance, streetSegments } from '../src/canalRecall/streetFronts.ts';
import { gableEndWalls, type StreetFacing } from '../src/canalRecall/streetGableEnds.ts';

const BASE = 'public/data/extracts/amsterdam';
const args = process.argv.slice(2);
const flag = (name: string, d: number) => Number(args.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? d);
const LNG = flag('lng', 4.881716), LAT = flag('lat', 52.383032), RADIUS = flag('radius', 120);
const fetchImpl: typeof fetch = (async (url: string) => {
  const path = String(url).replace(/^.*?amsterdam\//, `${BASE}/`).replace(/^\.\.\/data\/extracts\/amsterdam/, BASE);
  return existsSync(path) ? new Response(readFileSync(path)) : new Response(null, { status: 404 });
}) as typeof fetch;
const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
const local = (lng: number, lat: number): [number, number] => [(lng - ORIGIN.lng) * kx, (lat - ORIGIN.lat) * KY];

const data = await loadGameData(BASE, fetchImpl);
const decorate = gameDecorator({ gables: data.gables, landmarkIds: data.landmarkIds, listed: data.listed });
const routing = JSON.parse(readFileSync(`${BASE}/streets-routing.json`, 'utf8')) as Array<{ highway?: string; path?: number[][]; paths?: number[][][] }>;
const streets = new SegmentGrid(streetSegments(routing.flatMap(w => (w.paths ?? (w.path ? [w.path] : [])).map(p => ({ highway: w.highway, points: p.map(([lat, lng]) => [lng, lat] as const) }))), ORIGIN), 200);

const centre = local(LNG, LAT);
const keys = new Set<string>();
for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) keys.add(tileKeyAt(LNG + dx * RADIUS / kx, LAT + dy * RADIUS / KY));
// Every tile's features first, so the walls that block a ray include the neighbouring tile's buildings.
const all = (await Promise.all([...keys].map(k => loadTile(k, BASE, fetchImpl)))).flat().map(decorate);
const segs: number[] = [], owners: number[] = [];
all.forEach((f, i) => { for (const poly of asPolygons(f.geometry)) for (const ring of poly) for (let k = 1; k < ring.length; k++) { const a = local(ring[k - 1][0], ring[k - 1][1]), b = local(ring[k][0], ring[k][1]); segs.push(a[0], a[1], b[0], b[1]); owners.push(i); } });
const walls = new SegmentGrid(segs, 25, owners);

const sideWalls = (r: Rect) => gableEndWalls({ ...r, ux: -r.uy, uy: r.ux, len: r.wid, wid: r.len });
/** 'end': a ridge end (gable) sees a street; 'side': only a long side does (ridge along the street); 'corner': both; '-': none. */
const frontOf = (r: Rect, facing: StreetFacing) => {
  const end = gableEndWalls(r).some(w => facing(w) < Infinity), side = sideWalls(r).some(w => facing(w) < Infinity);
  return end && side ? 'corner' : end ? 'end' : side ? 'side' : '-';
};
const RIDGED = new Set(['gable', 'pitched', 'mansard', 'halfHipped']);
type Count = { along: number; across: number; corner: number; none: number; saddles: number };
const tally = (): Count => ({ along: 0, across: 0, corner: 0, none: 0, saddles: 0 });
const before = tally(), after = tally();
const rows: string[] = [];
const seen = new Set<string>();
all.forEach((d, i) => {
  const id = String(d.properties.id);
  if (seen.has(id) || !d.properties.roofPlanned) return;
  const b = meshBuildingFor(d, 'photo');
  const outer = b?.polygons[0]?.[0];
  if (!b?.roof || !outer || outer.length < 4) return;
  const c = local(outer.reduce((s, q) => s + q[0], 0) / outer.length, outer.reduce((s, q) => s + q[1], 0) / outer.length);
  if (Math.hypot(c[0] - centre[0], c[1] - centre[1]) > RADIUS) return;
  seen.add(id);
  const style = String(d.properties.facadeStyle ?? ''), plan = b.roof.plan;
  const facing: StreetFacing = (wall, fallback) => fallback ? streetDistance(wall, streets, null, i, FALLBACK_REACH_M) : streetDistance(wall, streets, walls, i);
  const pre = roofPiecesForOutline(outer, ORIGIN, plan, kx), post = roofPiecesForOutline(outer, ORIGIN, plan, kx, facing);
  const describe = (list: typeof pre, count: Count | null) => list.map(p => {
    const f = RIDGED.has(p.plan.kind) ? frontOf(p.rect, facing) : '-';
    if (count && (style === 'canal' || style === 'c19') && RIDGED.has(p.plan.kind)) {
      if (f === 'side') count.along++; else if (f === 'end') count.across++; else if (f === 'corner') count.corner++; else count.none++;
      count.saddles++;
    }
    return `${p.plan.kind}${p.plan.kind === 'gable' ? '/' + p.plan.gable : ''}[${p.rect.len.toFixed(1)}x${p.rect.wid.toFixed(1)} front:${f}${f === 'side' ? ' RIDGE-ALONG' : f === 'end' ? ' ridge-across' : ''}]`;
  }).join(' ');
  const a = describe(pre, before), z = describe(post, after);
  const at = `${(ORIGIN.lng + c[0] / kx).toFixed(5)},${(ORIGIN.lat + c[1] / KY).toFixed(5)}`;
  rows.push(`${id.replace('NL.IMBAG.Pand.', '')} ${at} ${style.padEnd(7)} ${String(d.properties.constructionYear ?? '?').padEnd(5)} before ${a}${z !== a ? `\n${' '.repeat(56)}after  ${z}` : ''}`);
});
if (args.includes('--rows')) console.log(rows.join('\n'));
const line = (name: string, t: Count) => `${name}: canal/c19 saddles ${t.saddles}: ridge ALONG the street ${t.along}, across (gable to street) ${t.across}, corner (both) ${t.corner}, no street front ${t.none}`;
console.log(`pands with a planned roof within ${RADIUS} m of ${LNG},${LAT}: ${seen.size}`);
console.log(line('before', before));
console.log(line('after ', after));
