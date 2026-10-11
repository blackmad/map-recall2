/**
 * Fails when an OSM/BAG building from the city tiles lies (>= 50% of its area)
 * inside a placed model's ground footprint but is not in that model's
 * suppressOsmIds, i.e. the plain extrusion is drawn through the model.
 * Geometry lives in src/canalRecall/landmarks/osmUnderModels.ts.
 *
 * Models checked: every placed model the game draws (PLACED_MODELS: surveyed
 * landmarks, manual catalogue + hospitals, ordinary buildings), plus street
 * chunks and building-types instances. Footprint, best source first:
 *   native   scripts/landmarks/<id>-footprints.json nativeRing + anchor
 *   plan     spec.buildingFootprint (ordinary / chunk native plans)
 *   rect     spec.footprint oriented rectangle (only when no GLB could be placed)
 *   glb      occupancy raster of the GLB placed at the surveyed anchor (tris above 2.5 m)
 * The tiles' polygons for the model's own suppressOsmIds are always added.
 *
 * Reviewed exclusions live in scripts/landmarks/osm-under-models-allowlist.json ({modelId: {osmId: reason}}).
 *
 * Usage: tsx scripts/check-osm-under-models.ts [--verbose] [--json=out.json] [model-id ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {ALL_MANUAL_LANDMARKS, MANUAL_LANDMARKS} from '../src/canalRecall/landmarks/manualModels';
import {SIGNATURE_MODELS} from '../src/canalRecall/landmarks/signatureModels';
import {PLACED_MODELS} from '../src/canalRecall/landmarks/placedModels';
import {dropNestedDuplicates} from '../src/canalRecall/buildingNesting';
import {chunkSpecFor} from '../src/canalRecall/landmarks/ordinaryChunks';
import {placementFor} from '../src/canalRecall/landmarks/signaturePlacement';
import type {SignatureModelSpec} from '../src/canalRecall/landmarks/signaturePlacement';
import {MeshoptDecoder} from 'meshoptimizer';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {soupFromDocument} from './audit-glb-quality';
import {nativeRingToLngLat, orientedRectRing, outerRings, ringsFootprint, unionFootprint, soupFootprint, unsuppressedUnder, type Footprint, type Ring, type TileBuilding, type LngLat} from '../src/canalRecall/landmarks/osmUnderModels';

const ROOT = path.resolve(import.meta.dirname, '..');
const ALLOWLIST = `${ROOT}/scripts/landmarks/osm-under-models-allowlist.json`;
const TILES = `${ROOT}/public/data/extracts/amsterdam/building-tiles/14`;
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

const tileXY = (lon: number, lat: number): [number, number] => {
  const n = 2 ** 14, r = (lat * Math.PI) / 180;
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
};
type Feature = {properties: {id?: string; height?: number}; geometry: {type: string; coordinates: unknown}};
const tileCache = new Map<string, TileBuilding[]>();
function tileBuildings(x: number, y: number): TileBuilding[] {
  const key = `${x}/${y}`;
  let out = tileCache.get(key);
  if (!out) {
    const file = `${TILES}/${x}/${y}.geojson.gz`;
    // The game drops the redundant nested copy (OSM outline vs BAG pand twin) per tile before drawing; so do we.
    const raw: Feature[] = fs.existsSync(file) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()).features : [];
    const feats = dropNestedDuplicates(raw as never) as unknown as Feature[];
    out = feats.filter(f => f.properties.id).map(f => ({id: String(f.properties.id), height: f.properties.height, rings: outerRings(f.geometry)})).filter(b => b.rings.length);
    tileCache.set(key, out);
  }
  return out;
}
function buildingsIn(bounds: {w: number; s: number; e: number; n: number}): TileBuilding[] {
  const [x0, y1] = tileXY(bounds.w, bounds.s), [x1, y0] = tileXY(bounds.e, bounds.n);
  const seen = new Map<string, TileBuilding>();
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const b of tileBuildings(x, y)) {
    const prior = seen.get(b.id);
    if (!prior) seen.set(b.id, b); else if (prior.rings !== b.rings && !prior.rings.some(r => b.rings.includes(r))) prior.rings = [...prior.rings, ...b.rings]; // MultiPolygon split over tiles
  }
  return [...seen.values()];
}
/** Tile polygons by id, for resolving a model's own suppressed buildings. */
const byIdIndex = new Map<string, TileBuilding>();
function indexAround(centre: LngLat, radiusDeg = .004) {
  for (const b of buildingsIn({w: centre[0] - radiusDeg, e: centre[0] + radiusDeg, s: centre[1] - radiusDeg, n: centre[1] + radiusDeg})) byIdIndex.set(b.id, b);
}

// ---- GLB occupancy (surveyed placement: origin at the anchor, +X east, +Z south, turned by northOffset) -----------
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
async function glbFootprint(spec: SignatureModelSpec): Promise<Footprint | null> {
  if (!spec.surveyed && !spec.footprint) return null;
  const file = `${ROOT}/public/canal-drive/${spec.modelUrl.replace(/^\.\//, '').replace(/\?.*$/, '')}`;
  if (!fs.existsSync(file)) return null;
  const {positions, indices} = soupFromDocument(await io.read(file));
  if (spec.surveyed) return soupFootprint(positions, indices, spec.surveyed.anchor, spec.surveyed.northOffsetDegrees ?? 0, {mirror: spec.mirror, basis: spec.surveyed.horizontalBasis});
  // Fitted model (signaturePlacement.placementFor): scaled to the footprint width, bbox centred on the placement anchor.
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) { const k = i % 3; if (positions[i] < min[k]) min[k] = positions[i]; if (positions[i] > max[k]) max[k] = positions[i]; }
  const placement = placementFor(spec, {min: min as never, max: max as never});
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2, k = placement.scale, fitted = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) { fitted[i] = (positions[i] - cx) * k; fitted[i + 1] = (positions[i + 1] - min[1]) * k; fitted[i + 2] = (positions[i + 2] - cz) * k; }
  return soupFootprint(fitted, indices, placement.anchor as LngLat, placement.modelRotationDegrees - 90, {mirror: spec.mirror});
}

// ---- model list -------------------------------------------------------------------------------------------------
interface Placed { id: string; kind: string; suppress: Set<string>; fp: Footprint | null; source: string; centre: LngLat }
const manualIds = new Set(ALL_MANUAL_LANDMARKS.map(m => m.id));
const signatureIds = new Set(SIGNATURE_MODELS.map(m => m.id));
const kindOf = (spec: SignatureModelSpec): string => spec.id.startsWith('chunk-') ? 'street-chunk'
  : spec.assetKind === 'ordinary-building' ? (manualIds.has(spec.id) ? 'manual-ordinary' : spec.buildingCategory === 'street-survey' ? 'street-house' : 'ordinary')
  : manualIds.has(spec.id) ? (spec.id.startsWith('olvg') ? 'hospital' : 'manual-landmark') : signatureIds.has(spec.id) ? 'surveyed-3dw' : 'other';
function allSpecs(): SignatureModelSpec[] {
  const chunksFile = `${ROOT}/public/canal-drive/ordinary-buildings-data/chunks.json`;
  const chunkSpecs = fs.existsSync(chunksFile) ? (readJson(chunksFile).chunks as Parameters<typeof chunkSpecFor>[0][]).map(chunkSpecFor) : [];
  const seen = new Set<string>();
  // PLACED_MODELS = surveyed + manual landmarks/ordinary + ordinary catalogue; add the held-out manual categories and chunks.
  return [...PLACED_MODELS, ...MANUAL_LANDMARKS, ...chunkSpecs].filter(m => !seen.has(m.id) && !!seen.add(m.id));
}

async function footprintOf(spec: SignatureModelSpec, force = false): Promise<{fp: Footprint | null; source: string; named: Record<string, Footprint>}> {
  const parts: Footprint[] = [], src: string[] = [], named: Record<string, Footprint> = {};
  const native = `${ROOT}/scripts/landmarks/${spec.id}-footprints.json`;
  if (fs.existsSync(native)) {
    const F = readJson(native);
    if (F.nativeRing && F.anchor) { parts.push(named.native = ringsFootprint([nativeRingToLngLat(F.nativeRing, F.anchor)])); src.push('native'); }
  }
  const plan = spec.buildingFootprint ? outerRings(spec.buildingFootprint as {type: string; coordinates: unknown}) : [];
  if (plan.length) { parts.push(ringsFootprint(plan)); src.push('plan'); }
  if (!plan.length || force) { const g = await glbFootprint(spec); if (g) { parts.push(named.glb = g); src.push('glb'); } }
  const f = spec.footprint;
  if (!parts.length && f && spec.assetKind !== 'ordinary-building') { parts.push(ringsFootprint([orientedRectRing(f.centre, f.headingDegrees, f.lengthMetres, f.widthMetres)])); src.push('rect'); }
  return parts.length ? {fp: unionFootprint(parts), source: src.join('+'), named} : {fp: null, source: 'none', named};
}

function buildingTypesPlaced(): Placed[] {
  const file = `${ROOT}/public/canal-drive/building-types/instances.json`;
  if (!fs.existsSync(file)) return [];
  const inst = readJson(file) as {pand: string; anchor: [number, number]}[];
  // Each instance replaces its own pand; the game suppresses `NL.IMBAG.Pand.<pand>` (runtime.ts suppression ids).
  return inst.map(i => ({id: `building-type:${i.pand}`, kind: 'building-type', suppress: new Set([`NL.IMBAG.Pand.${i.pand}`]), footprint: [], source: 'bag-pand', centre: i.anchor}));
}

/** Dev aid: how well does the placed GLB occupancy match the native/plan outline (validates the placement maths)? */
async function calibrate() {
  const rows: string[] = [];
  for (const spec of allSpecs()) {
    const {named} = await footprintOf(spec, true);
    const plan = spec.buildingFootprint ? ringsFootprint(outerRings(spec.buildingFootprint as {type: string; coordinates: unknown})) : null;
    const rect = !spec.surveyed && spec.footprint ? ringsFootprint([orientedRectRing(spec.footprint.centre, spec.footprint.headingDegrees, spec.footprint.lengthMetres, spec.footprint.widthMetres)]) : null;
    const ref = named.native ?? plan ?? rect, glb = named.glb;
    if (!ref || !glb) continue;
    const sample = (a: Footprint, b: Footprint) => { let n = 0, k = 0; for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) { const p: LngLat = [a.bounds.w + (i + .5) / 40 * (a.bounds.e - a.bounds.w), a.bounds.s + (j + .5) / 40 * (a.bounds.n - a.bounds.s)]; if (a.contains(p)) { n++; if (b.contains(p)) k++; } } return n ? k / n : 0; };
    rows.push(`${spec.id}: native covered by glb ${sample(ref, glb).toFixed(2)}, glb inside native ${sample(glb, ref).toFixed(2)}`);
  }
  console.log(rows.join('\n'));
}
async function main() {
  if (process.argv.includes('--calibrate')) return calibrate();
  const args = process.argv.slice(2), verbose = args.includes('--verbose'), only = args.filter(a => !a.startsWith('--')), jsonOut = args.find(a => a.startsWith('--json='))?.slice(7);
  const allow: Record<string, Record<string, string>> = fs.existsSync(ALLOWLIST) ? readJson(ALLOWLIST) : {};
  const report: {model: string; kind: string; source: string; hits: ReturnType<typeof unsuppressedUnder>}[] = [];
  const placed: Placed[] = [];
  for (const spec of allSpecs()) {
    if (only.length && !only.includes(spec.id)) continue;
    const {fp, source} = await footprintOf(spec);
    placed.push({id: spec.id, kind: kindOf(spec), suppress: new Set(spec.suppressOsmIds.map(String)), fp, source, centre: (spec.surveyed?.anchor ?? spec.footprint?.centre ?? [0, 0]) as LngLat});
  }
  // Ids hidden by ANY placed model (also under an `only` filter) are not "drawn through" another model.
  const claimed = new Map<string, string>();
  for (const spec of allSpecs()) for (const id of spec.suppressOsmIds) if (!claimed.has(String(id))) claimed.set(String(id), spec.id);
  const bt = buildingTypesPlaced();
  for (const p of bt) for (const id of p.suppress) if (!claimed.has(id)) claimed.set(id, p.id);

  const checked: Record<string, number> = {}, bySource: Record<string, number> = {}, hitsByKind: Record<string, number> = {}, skipped: string[] = [];
  let bad = 0;
  for (const p of [...placed, ...bt]) {
    // Footprint = model outline plus the polygons of the buildings it already hides.
    indexAround(p.centre);
    const own = [...p.suppress].map(id => byIdIndex.get(id)).filter((b): b is TileBuilding => !!b).flatMap(b => b.rings);
    const parts = [...(p.fp ? [p.fp] : []), ...(own.length ? [ringsFootprint(own)] : [])];
    if (!parts.length) { skipped.push(p.id); continue; }
    const footprint = unionFootprint(parts);
    checked[p.kind] = (checked[p.kind] ?? 0) + 1; bySource[p.source] = (bySource[p.source] ?? 0) + 1;
    const claimedElsewhere = new Set([...claimed].filter(([, owner]) => owner !== p.id).map(([id]) => id));
    const hits = unsuppressedUnder(footprint, buildingsIn(footprint.bounds), p.suppress, claimedElsewhere).filter(h => !allow[p.id]?.[h.id]);
    if (hits.length) {
      report.push({model: p.id, kind: p.kind, source: p.source, hits});
      bad++; hitsByKind[p.kind] = (hitsByKind[p.kind] ?? 0) + 1;
      console.log(`${p.id} [${p.kind}, footprint ${p.source}] unsuppressed: ${hits.map(h => `${h.id} (${Math.round(h.overlap * 100)}% inside, ${h.height ?? '?'}m, ${Math.round(h.areaM2)}m2)`).join('; ')}`);
    } else if (verbose) console.log(`ok ${p.id} [${p.kind}, ${p.source}]`);
  }
  const total = Object.values(checked).reduce((a, b) => a + b, 0);
  console.log(`OSM-under check: ${total} models (${Object.entries(checked).map(([k, v]) => `${k} ${v}`).join(', ')}); footprint sources ${JSON.stringify(bySource)}; ${skipped.length} without footprint${skipped.length ? ` (${skipped.slice(0, 8).join(', ')}${skipped.length > 8 ? ', ...' : ''})` : ''}; ${bad} with unsuppressed OSM buildings${bad ? ` ${JSON.stringify(hitsByKind)}` : ''}`);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
  process.exit(bad ? 1 : 0);
}
await main();
