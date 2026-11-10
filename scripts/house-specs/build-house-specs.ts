// The HouseSpec extract (house line H1 step 4, docs/house-line.md §1): one resolved spec per pand with at least one
// source, tiled like the building tiles, staged first.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, cpSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import path from 'node:path';
import { SWATCHES } from '../../src/canalRecall/buildingRecipe/intent.ts';
import { validateBlockFace } from '../../src/canalRecall/blockFace/intent.ts';
import { registerFactsFromExtract } from '../../src/canalRecall/facade/registerRecipe.ts';
import { fromBlockFace, fromRecipeIntent, fromRegisterFacts } from '../../src/canalRecall/houseSpec/adapters.ts';
import { fieldSources, resolveSpecs, strongestSource } from '../../src/canalRecall/houseSpec/resolve.ts';
import { frontBays, specFields, validateSpec, type HouseSpec } from '../../src/canalRecall/houseSpec/spec.ts';
import { withRoute } from '../../src/canalRecall/houseSpec/toRecipe.ts';
import type { HouseSpecTile, HouseSpecTileRecord, HouseSpecView } from '../../src/canalRecall/houseSpec/decorate.ts';
import { isRidePriority } from '../../src/canalRecall/ridePriority.ts';

export const HELP = `build-house-specs: resolve every pand's HouseSpec from its sources and write the tiled extract.

  npx tsx scripts/house-specs/build-house-specs.ts            stage + coverage report (lanes may run this)
  npx tsx scripts/house-specs/build-house-specs.ts --publish  copy the staged tiles to the published extract
                                                              (integrator only, after reviewing the coverage diff)
  --help                                                      this text

Sources, weakest first (facade/evidence.ts SOURCE_STRENGTH, author = reviewed):
  monument-facts.json                         monument-text         (fromRegisterFacts)
  scripts/block-face/faces/*/intent.json      streetlevel-measured  (fromBlockFace, one spec per house)
  scripts/building-recipes/houses/*/intent.json  the intent's sources (fromRecipeIntent, kind canal-house only)
  scripts/house-specs/specs/<pandId>.json     hand-written specs, validated (validateSpec), usually source author
Writes public/data/extracts/amsterdam/staging/house-specs/14/<x>/<y>.json.gz ({version, buildings: {<feature id>:
{d, x, s, l, r, v}}}) and staging/house-specs.coverage.json. --publish replaces house-specs/14 with the staged tiles.
The world compiler hashes house-specs/14/<tile>.json.gz per tile (scripts/world/pipeline.ts tileInputs).`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const STAGING = path.join(EXTRACT, 'staging/house-specs');
const PUBLISHED = path.join(EXTRACT, 'house-specs');
const REPORT = path.join(EXTRACT, 'staging/house-specs.coverage.json');
const HAND = path.join(ROOT, 'scripts/house-specs/specs');
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const rel = (p: string) => path.relative(ROOT, p);
const FEATURE = (digits: string) => `NL.IMBAG.Pand.${digits}`;

const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(HELP); process.exit(0); }

if (args.includes('--publish')) {
  if (!existsSync(path.join(STAGING, '14'))) { console.error(`nothing staged at ${rel(STAGING)}; run without --publish first`); process.exit(1); }
  rmSync(path.join(PUBLISHED, '14'), { recursive: true, force: true });
  mkdirSync(PUBLISHED, { recursive: true });
  cpSync(path.join(STAGING, '14'), path.join(PUBLISHED, '14'), { recursive: true });
  console.log(`published ${rel(STAGING)}/14 -> ${rel(PUBLISHED)}/14 (world:compile --changed now rebuilds the cells of every tile whose spec file changed)`);
  process.exit(0);
}

// --- 1. every source, as partial specs per pand ------------------------------------------------------------------
const parts = new Map<string, HouseSpec[]>();
const add = (s: HouseSpec | null) => { if (s) { const list = parts.get(s.pandId) ?? []; list.push(s); parts.set(s.pandId, list); } };
const counts = { register: 0, faces: 0, faceHouses: 0, facesInvalid: [] as string[], recipeIntents: 0, recipeOther: 0, hand: 0 };

const facts = registerFactsFromExtract(json(path.join(EXTRACT, 'monument-facts.json')));
for (const [id, f] of facts) { add(fromRegisterFacts(f, f.nr, id)); counts.register++; }

const FACES = path.join(ROOT, 'scripts/block-face/faces');
for (const dir of readdirSync(FACES).sort()) {
  const file = path.join(FACES, dir, 'intent.json');
  if (!existsSync(file)) continue;
  let face;
  try { face = validateBlockFace(json(file)); } catch (e) { counts.facesInvalid.push(`${dir}: ${(e as Error).message.split('\n')[1] ?? (e as Error).message}`); continue; }
  counts.faces++;
  for (const h of face.houses) { add(fromBlockFace(face, h.pandId, rel(path.join(FACES, dir, 'strip.json')))); counts.faceHouses++; }
}

const HOUSES = path.join(ROOT, 'scripts/building-recipes/houses');
for (const dir of readdirSync(HOUSES).sort()) {
  const file = path.join(HOUSES, dir, 'intent.json');
  if (!existsSync(file)) continue;
  const intent = json(file);
  const spec = fromRecipeIntent(intent, rel(file));
  if (spec) { add(spec); counts.recipeIntents++; } else counts.recipeOther++;
}

if (existsSync(HAND)) for (const f of readdirSync(HAND).filter(f => f.endsWith('.json')).sort()) { add(validateSpec(json(path.join(HAND, f)))); counts.hand++; }

// --- 2. resolve, route, runtime view -----------------------------------------------------------------------------
const hex = (v: unknown) => (typeof v === 'string' ? (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : SWATCHES[v]?.toLowerCase()) : undefined);
function viewOf(spec: HouseSpec): HouseSpecView {
  const src = fieldSources(spec), front = spec.design.fronts?.[0];
  const v: HouseSpecView = { src: {} };
  // The roof planner (roofMesh planRoof) draws a monument gable as the whole roof's crown: a canal house's gabled or
  // cornice-fronted pitched roof. A street-measured cornice/flat front (a flat-roofed 1890s block), a partial crown
  // (crownAt/crownBays over some bays) or a flat roof form is not that, so only full-width gabled crowns reach it; the
  // register's own gable words (monument-text) pass as before. The full front stays in the record's design (`d`).
  if (front?.gable && (src['fronts/0/gable'] === 'monument-text' || plannerCrown(spec))) { v.gable = front.gable; v.src.gable = src['fronts/0/gable']; }
  // A flat crown stated by a street source or an author (lane H9) clears a register gable (decorate.ts withHouseSpecCrown).
  else if (front?.gable === 'flat' && ['streetlevel-measured', 'reviewed', 'author'].includes(src['fronts/0/gable'] ?? '')) { v.gable = 'flat'; v.src.gable = src['fronts/0/gable']; }
  if (spec.facts?.facadeYear) { v.year = spec.facts.facadeYear; v.src.year = src['facts/facadeYear']; }
  if (spec.design.palette?.wallMaterial) { v.wallMaterial = spec.design.palette.wallMaterial; v.src.wallMaterial = src['palette/wallMaterial']; }
  const wall = hex(spec.design.palette?.brick);
  if (wall) { v.wallHex = wall; v.src.wallHex = src['palette/brick']; }
  const bays = frontBays(front);
  if (bays) { v.bays = bays; v.src.bays = src[front?.axisGrid ? 'fronts/0/axisGrid' : 'fronts/0/bays']; }
  // Storeys (lane H9): the drawn storey count follows the photo when a street source states it (not the register).
  if (Number.isInteger(front?.storeys) && front!.storeys! >= 2) { v.storeys = front!.storeys; v.src.storeys = src['fronts/0/storeys']; }
  return v;
}
const PLANNER_GABLES = new Set(['step', 'neck', 'raised-neck', 'bell', 'spout', 'point']);
function plannerCrown(spec: HouseSpec): boolean {
  const f = spec.design.fronts?.[0];
  const at = f?.crownAt as { from?: number; to?: number } | undefined;
  const full = !f?.crownBays && (!at || ((at.from ?? 0) <= 0.05 && (at.to ?? 1) >= 0.95));
  return !!f?.gable && PLANNER_GABLES.has(f.gable) && full && spec.design.roof?.form !== 'flat';
}
const resolved = new Map<string, HouseSpec>();
for (const [pand, list] of [...parts].sort(([a], [b]) => (a < b ? -1 : 1))) resolved.set(pand, withRoute(resolveSpecs(list)));

// --- 3. tile each pand by its footprint ---------------------------------------------------------------------------
const index = json(path.join(EXTRACT, 'building-tiles/index-z14.json'));
const tileKeys: string[] = (index.tileList as string[]).map(t => t.replace(/^14\//, ''));
const buurten = json(path.join(EXTRACT, 'coverage-v1/buurten.json')).features as Array<{ properties: Record<string, any>; geometry: any }>;
type Ring = number[][];
const polys = (g: any): Ring[][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const inside = ([x, y]: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
const centroid = (g: any) => { const r = polys(g)[0][0]; return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length]; };
const where = new Map<string, { tile: string; buurt?: Record<string, any> }>();
for (const tile of tileKeys) {
  const file = path.join(EXTRACT, `building-tiles/14/${tile}.geojson.gz`);
  if (!existsSync(file)) continue;
  for (const f of JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')).features ?? []) {
    const id = String(f.properties?.id ?? '');
    const digits = /(\d{16})$/.exec(id)?.[1];
    if (!digits || !resolved.has(digits) || where.has(digits)) continue;
    const c = centroid(f.geometry);
    where.set(digits, { tile, buurt: buurten.find(b => polys(b.geometry).some(p => inside(c, p[0])))?.properties });
  }
}

// --- 4. write the staged tiles ------------------------------------------------------------------------------------
rmSync(path.join(STAGING, '14'), { recursive: true, force: true });
const byTile = new Map<string, HouseSpecTile>();
for (const [pand, spec] of resolved) {
  const at = where.get(pand);
  if (!at) continue;
  const record: HouseSpecTileRecord = { d: spec.design as Record<string, unknown>, s: fieldSources(spec), r: spec.route ?? 'generic', v: viewOf(spec) };
  if (spec.facts && Object.keys(spec.facts).length) record.x = spec.facts as Record<string, unknown>;
  if (spec.schemaLimits?.length) record.l = spec.schemaLimits;
  const tile = byTile.get(at.tile) ?? { version: 1 as const, buildings: {} };
  tile.buildings[FEATURE(pand)] = record;
  byTile.set(at.tile, tile);
}
let bytes = 0;
for (const [tile, data] of [...byTile].sort(([a], [b]) => (a < b ? -1 : 1))) {
  const file = path.join(STAGING, `14/${tile}.json.gz`);
  mkdirSync(path.dirname(file), { recursive: true });
  const gz = gzipSync(JSON.stringify(data), { level: 9 });
  bytes += gz.length;
  writeFileSync(file, gz);
}

// --- 5. coverage --------------------------------------------------------------------------------------------------
const covers = existsSync(path.join(ROOT, 'public/canal-drive/models/covers.json')) ? json(path.join(ROOT, 'public/canal-drive/models/covers.json')) : { models: {} };
const modelled = new Set<string>([...Object.values<any>(covers.models ?? {}).flatMap(m => m.p ?? []), ...(covers.buildingTypes ?? [])].map(String));
const SOURCES_SEEN = ['monument-text', 'streetlevel-measured', 'reviewed', 'author', 'vision-judge'] as const;
const report = {
  generated: new Date().toISOString().slice(0, 10),
  inputs: counts,
  pands: resolved.size, tiled: [...resolved.keys()].filter(p => where.has(p)).length, notInTiles: [...resolved.keys()].filter(p => !where.has(p)).length,
  tiles: byTile.size, bytesGz: bytes,
  route: { recipe: 0, generic: 0 },
  bySource: Object.fromEntries(SOURCES_SEEN.map(s => [s, 0])) as Record<string, number>,
  strongest: {} as Record<string, number>,
  multiSource: 0,
  runtime: { gable: 0, year: 0, wallMaterial: 0, wallHex: 0, bays: 0, storeys: 0 } as Record<string, number>,
  /** Pands the generic path draws (no installed GLB/chunk hides them) whose spec carries bays or a wall colour: the
   *  houses whose look changes when the spec extract is published. */
  genericVisibleWithMesherReads: 0,
  modelledByInstall: 0,
  /** Of genericVisibleWithMesherReads, how many carry each read (lane H9: the wall-colour rule's city-wide reach). */
  genericVisibleBy: { wallHex: 0, bays: 0, storeys: 0 },
  /** The generic-path pands whose wall the wall-colour rule draws (for the random review sheet). */
  genericVisibleWallPands: [] as string[],
  ridePriority: { pands: 0, withBays: 0, withGable: 0 },
  byBuurt: {} as Record<string, { pands: number; gebied: string; ride: boolean; bays: number; gable: number }>,
};
for (const [pand, spec] of resolved) {
  const at = where.get(pand);
  report.route[spec.route ?? 'generic']++;
  const seen = new Set(Object.values(fieldSources(spec)));
  for (const s of seen) if (s in report.bySource) report.bySource[s]++;
  if (seen.size > 1) report.multiSource++;
  const strong = strongestSource(spec);
  report.strongest[strong] = (report.strongest[strong] ?? 0) + 1;
  const v = viewOf(spec);
  for (const k of Object.keys(report.runtime)) if ((v as any)[k] !== undefined) report.runtime[k]++;
  const installed = modelled.has(pand);
  if (installed) report.modelledByInstall++;
  else if (at && (v.bays || v.wallHex || v.storeys)) {
    report.genericVisibleWithMesherReads++;
    for (const k of ['wallHex', 'bays', 'storeys'] as const) if (v[k] !== undefined) report.genericVisibleBy[k]++;
    if (v.wallHex) report.genericVisibleWallPands.push(pand);
  }
  const b = at?.buurt;
  if (b) {
    const row = report.byBuurt[b.code] ??= { pands: 0, gebied: b.gebied, ride: isRidePriority(b), bays: 0, gable: 0 };
    row.pands++; if (v.bays) row.bays++; if (v.gable) row.gable++;
    if (row.ride) { report.ridePriority.pands++; if (v.bays) report.ridePriority.withBays++; if (v.gable) report.ridePriority.withGable++; }
  }
}
report.byBuurt = Object.fromEntries(Object.entries(report.byBuurt).sort((a, b) => b[1].pands - a[1].pands));
mkdirSync(path.dirname(REPORT), { recursive: true });
writeFileSync(REPORT, JSON.stringify(report, null, 1) + '\n');

const fields = [...resolved.values()].reduce((n, s) => n + specFields(s).length, 0);
console.log(`house specs: ${report.pands} pands (${fields} fields), ${report.tiled} tiled in ${report.tiles} tiles (${(bytes / 1024).toFixed(0)} kB gz), ${report.notInTiles} not in any building tile`);
console.log(`  inputs: register ${counts.register}, block faces ${counts.faces} (${counts.faceHouses} houses, ${counts.facesInvalid.length} invalid), canal-house intents ${counts.recipeIntents} (${counts.recipeOther} other kinds skipped), hand specs ${counts.hand}`);
console.log(`  pands with a field from: ${Object.entries(report.bySource).map(([k, n]) => `${k} ${n}`).join(', ')}; ${report.multiSource} from more than one source`);
console.log(`  route: recipe ${report.route.recipe}, generic ${report.route.generic}`);
console.log(`  runtime view: ${Object.entries(report.runtime).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`  installed model hides ${report.modelledByInstall}; generic-path pands whose look the spec changes (bays/wall/storeys): ${report.genericVisibleWithMesherReads} (wall ${report.genericVisibleBy.wallHex}, bays ${report.genericVisibleBy.bays}, storeys ${report.genericVisibleBy.storeys})`);
console.log(`  ride priority: ${report.ridePriority.pands} pands (${report.ridePriority.withGable} with a gable, ${report.ridePriority.withBays} with bays)`);
console.log(`  top buurten: ${Object.entries(report.byBuurt).slice(0, 8).map(([k, r]) => `${k} ${r.pands}`).join(', ')}`);
if (counts.facesInvalid.length) console.log(`  invalid faces (skipped): ${counts.facesInvalid.slice(0, 5).join(' | ')}${counts.facesInvalid.length > 5 ? ' …' : ''}`);
console.log(`staged ${rel(STAGING)}/14, report ${rel(REPORT)}`);
