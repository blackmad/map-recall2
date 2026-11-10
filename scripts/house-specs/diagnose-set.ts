/**
 * Step 0 of a house-line acceptance set (lane H9, docs/house-line.md §6): what the game draws for each pand of a set
 * and why, before anything is changed. Per pand: route, the spec record (fields and winning sources), the register's
 * gable and finish, the decorated properties the mesher reads (style, wall, roof, monument gable), the roof planner's
 * outcome on the footprint (accepted, or the first rule that rejected it), the drawn storeys from the tile height, and
 * where the pand stands in each of the set's cameras (left-to-right screen order, so a row camera names its houses).
 *
 *   npx tsx scripts/house-specs/diagnose-set.ts scripts/house-specs/sets/easy-houses-20261110.json [--json out.json]
 */
import '../world/useBrowserMath.ts';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PreviewSession, coverOf } from '../house-preview/preview.ts';
import { EXTRACT } from '../world/pipeline.ts';
import { fitRect, localOuterRing, planBuildingRoof, GABLE_SHAPES, type GableShape } from '../../src/canalRecall/roofMesh.ts';
import { layoutWall } from '../../src/canalRecall/facadeLayout.ts';
import { wallTopHeightM } from '../../src/canalRecall/threeBuildingMesh.ts';
import { asPolygons } from '../../src/canalRecall/threeBuildingFeatures.ts';

export const HELP = `diagnose-set <set.json> [--json <out>]: step-0 table for a house-line acceptance set (route, spec, register,
decorated wall and roof, roof planner outcome, drawn storeys, camera order). Read-only.`;

export type SetFile = { name: string; cams?: string; pands: { pandId: string; label: string; cams: string[] }[] };
const args = process.argv.slice(2);
if (!args[0] || args.includes('--help')) { console.log(HELP); process.exit(args[0] ? 0 : 1); }
const set = JSON.parse(fs.readFileSync(args[0], 'utf8')) as SetFile;
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

const specTiles = new Map<string, Record<string, any>>();
function specRecord(pandId: string): any {
  if (!specTiles.size) for (const x of fs.readdirSync(path.join(EXTRACT, 'house-specs/14'))) for (const f of fs.readdirSync(path.join(EXTRACT, 'house-specs/14', x)))
    specTiles.set(`${x}/${f}`, JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(EXTRACT, 'house-specs/14', x, f))).toString('utf8')).buildings);
  for (const b of specTiles.values()) if (b[`NL.IMBAG.Pand.${pandId}`]) return b[`NL.IMBAG.Pand.${pandId}`];
  return null;
}
const gables = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'monument-gables.json'), 'utf8'));
const gableOf = (id: string) => (gables.buildings ?? gables)[`NL.IMBAG.Pand.${id}`] ?? (gables.buildings ?? gables)[id] ?? null;

/** The first planRoof rule that rejects a rectangle, mirrored from roofMesh.ts planRoof's guard line. */
function roofRejection(p: Record<string, unknown>, ring: [number, number][] | null): string {
  const h = Number(p.height), min = Number(p.minHeight) || 0;
  if (!ring) return 'no single outer ring';
  if (min > 0.5) return `minHeight ${min}`;
  if (h < 6.5) return `height ${h} < 6.5`;
  const rect = fitRect(ring.slice(0, -1));
  if (!rect) return `fitRect null (${ring.length - 1} vertices, > 14 or < 4)`;
  const r = (v: number) => v.toFixed(2);
  if (rect.wid < 3.6) return `rect wid ${r(rect.wid)} < 3.6`;
  if (rect.len < 4.5) return `rect len ${r(rect.len)} < 4.5`;
  if (rect.coverage < 0.88) return `rect coverage ${r(rect.coverage)} < 0.88`;
  if (rect.maxDev > 1.0) return `rect maxDev ${r(rect.maxDev)} > 1.0`;
  return `rect ok (wid ${r(rect.wid)}, len ${r(rect.len)}, cov ${r(rect.coverage)})`;
}

const cams = set.cams ? JSON.parse(fs.readFileSync(set.cams, 'utf8')) as { slug: string; eye: [number, number]; heading: number }[] : [];
const centroid = (g: unknown): [number, number] => { const pts = asPolygons(g as never).flat(2) as number[][]; return [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length]; };
const bearing = (a: [number, number], b: [number, number]) => { const kx = Math.cos(a[1] * Math.PI / 180); return (Math.atan2((b[0] - a[0]) * kx, b[1] - a[1]) * 180 / Math.PI + 360) % 360; };

const session = new PreviewSession('photo');
const rows: Record<string, unknown>[] = [];
for (const { pandId, label, cams: camSlugs } of set.pands) {
  const tile = session.tileOf(pandId), tileRows = await session.rows(tile);
  const row = tileRows.find(r => r.raw.properties.id === `NL.IMBAG.Pand.${pandId}`);
  const cover = coverOf(pandId);
  if (!row) { rows.push({ pandId, label, route: 'not drawn (no row)', cover }); continue; }
  const p = row.styled.properties, raw = row.raw.properties;
  const ring = localOuterRing(row.styled.geometry) as [number, number][] | null;
  const measured = typeof p.monumentGable === 'string' && (GABLE_SHAPES as readonly string[]).includes(p.monumentGable) ? p.monumentGable as GableShape : null;
  const plan = ring ? planBuildingRoof(String(p.id), String(p.facadeStyle ?? ''), Number(p.height), Number(p.minHeight) || 0, ring, undefined, Number(p.constructionYear) || null, measured) : null;
  const eaves = wallTopHeightM(p), style = String(p.facadeStyle ?? 'c19') as 'c19';
  const lay = layoutWall(style, 6, eaves - (Number(p.minHeight) || 0), 0.5, true);
  const spec = specRecord(pandId);
  const at = centroid(row.styled.geometry);
  const inCams = cams.filter(c => camSlugs.includes(c.slug)).map(c => ({ slug: c.slug, offDeg: Math.round(((bearing(c.eye, at) - c.heading + 540) % 360) - 180) }));
  rows.push({
    pandId, label, tile, route: cover ? `installed ${cover.kind} ${cover.key}` : 'generic',
    spec: spec ? { route: spec.r, view: spec.v, sources: spec.s, limits: spec.l } : null,
    register: { gable: gableOf(pandId), finishFromSpec: spec?.v?.wallMaterial ?? null },
    year: { bag: raw.constructionYear ?? null, decorated: p.constructionYear ?? null },
    style: p.facadeStyle, facade: p.facade, wall: { sideColour: p.sideColour, mapped: p.facadeMappedColour ?? null, prior: p.facadeMaterialColourPrior ?? null, registerFinish: p.registerFinish ?? null, specRecipe: p.specRecipe ?? null },
    roof: { monumentGable: p.monumentGable ?? null, planned: !!p.roofPlanned, shape: p.roofShape ?? null, eavesM: p.roofEavesHeightM ?? null, tag: raw.roofShape ?? null, planNow: plan ? { kind: plan.kind, gable: plan.gable, pieces: plan.pieces?.length ?? 0 } : null, rectRule: roofRejection(p, ring) },
    height: { tileM: p.height, eavesM: +eaves.toFixed(2), drawnStoreys: lay ? lay.storeys + 1 : null, storeyM: lay ? +lay.storeyM.toFixed(2) : null, groundM: lay?.groundM ?? null },
    cams: inCams,
  });
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
for (const r of rows as any[]) {
  console.log(`${r.pandId} ${r.label}  route ${r.route}  year ${r.year?.bag}->${r.year?.decorated} style ${r.style} facade ${r.facade}`);
  console.log(`  spec ${JSON.stringify(r.spec?.view ?? null)}  register gable ${JSON.stringify(r.register?.gable)}`);
  console.log(`  wall ${JSON.stringify(r.wall)}`);
  console.log(`  roof ${JSON.stringify(r.roof)}`);
  console.log(`  height ${JSON.stringify(r.height)}  cams ${JSON.stringify(r.cams)}`);
}
