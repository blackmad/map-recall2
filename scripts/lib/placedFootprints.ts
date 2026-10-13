/**
 * Model footprints and city-tile lookups shared by check-osm-under-models and build-covers.
 * Moved verbatim out of scripts/check-osm-under-models.ts (2026-10-13, bag-tiles lane); behaviour unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {ALL_MANUAL_LANDMARKS, MANUAL_LANDMARKS} from '../../src/canalRecall/landmarks/manualModels';
import {SIGNATURE_MODELS} from '../../src/canalRecall/landmarks/signatureModels';
import {PLACED_MODELS} from '../../src/canalRecall/landmarks/placedModels';
import {dropNestedDuplicates} from '../../src/canalRecall/buildingNesting';
import {chunkSpecFor} from '../../src/canalRecall/landmarks/ordinaryChunks';
import {placementFor} from '../../src/canalRecall/landmarks/signaturePlacement';
import type {SignatureModelSpec} from '../../src/canalRecall/landmarks/signaturePlacement';
import {MeshoptDecoder} from 'meshoptimizer';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {soupFromDocument} from '../audit-glb-quality';
import {nativeRingToLngLat, orientedRectRing, outerRings, ringsFootprint, unionFootprint, soupFootprint, unsuppressedUnder, type Footprint, type Ring, type TileBuilding, type LngLat} from '../../src/canalRecall/landmarks/osmUnderModels';

export const ROOT = path.resolve(import.meta.dirname, '../..');
const TILES = `${ROOT}/public/data/extracts/amsterdam/building-tiles/14`;
export const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

export const tileXY = (lon: number, lat: number): [number, number] => {
  const n = 2 ** 14, r = (lat * Math.PI) / 180;
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
};
export type Feature = {properties: {id?: string; height?: number}; geometry: {type: string; coordinates: unknown}};
const tileCache = new Map<string, TileBuilding[]>();
export function tileBuildings(x: number, y: number): TileBuilding[] {
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
export function buildingsIn(bounds: {w: number; s: number; e: number; n: number}): TileBuilding[] {
  const [x0, y1] = tileXY(bounds.w, bounds.s), [x1, y0] = tileXY(bounds.e, bounds.n);
  const seen = new Map<string, TileBuilding>();
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const b of tileBuildings(x, y)) {
    const prior = seen.get(b.id);
    if (!prior) seen.set(b.id, b); else if (prior.rings !== b.rings && !prior.rings.some(r => b.rings.includes(r))) prior.rings = [...prior.rings, ...b.rings]; // MultiPolygon split over tiles
  }
  return [...seen.values()];
}
/** Tile polygons by id, for resolving a model's own suppressed buildings. */
export const byIdIndex = new Map<string, TileBuilding>();
export function indexAround(centre: LngLat, radiusDeg = .004) {
  for (const b of buildingsIn({w: centre[0] - radiusDeg, e: centre[0] + radiusDeg, s: centre[1] - radiusDeg, n: centre[1] + radiusDeg})) byIdIndex.set(b.id, b);
}

// ---- GLB occupancy (surveyed placement: origin at the anchor, +X east, +Z south, turned by northOffset) -----------
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
export async function glbFootprint(spec: SignatureModelSpec): Promise<Footprint | null> {
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
export interface Placed { id: string; kind: string; suppress: Set<string>; fp: Footprint | null; source: string; centre: LngLat }
const manualIds = new Set(ALL_MANUAL_LANDMARKS.map(m => m.id));
const signatureIds = new Set(SIGNATURE_MODELS.map(m => m.id));
export const kindOf = (spec: SignatureModelSpec): string => spec.id.startsWith('chunk-') ? 'street-chunk'
  : spec.assetKind === 'ordinary-building' ? (manualIds.has(spec.id) ? 'manual-ordinary' : spec.buildingCategory === 'street-survey' ? 'street-house' : 'ordinary')
  : manualIds.has(spec.id) ? (spec.id.startsWith('olvg') ? 'hospital' : 'manual-landmark') : signatureIds.has(spec.id) ? 'surveyed-3dw' : 'other';
export function allSpecs(): SignatureModelSpec[] {
  const chunksFile = `${ROOT}/public/canal-drive/ordinary-buildings-data/chunks.json`;
  const chunkSpecs = fs.existsSync(chunksFile) ? (readJson(chunksFile).chunks as Parameters<typeof chunkSpecFor>[0][]).map(chunkSpecFor) : [];
  const seen = new Set<string>();
  // PLACED_MODELS = surveyed + manual landmarks/ordinary + ordinary catalogue; add the held-out manual categories and chunks.
  return [...PLACED_MODELS, ...MANUAL_LANDMARKS, ...chunkSpecs].filter(m => !seen.has(m.id) && !!seen.add(m.id));
}

export async function footprintOf(spec: SignatureModelSpec, force = false): Promise<{fp: Footprint | null; source: string; named: Record<string, Footprint>}> {
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

export function buildingTypesPlaced(): Placed[] {
  const file = `${ROOT}/public/canal-drive/building-types/instances.json`;
  if (!fs.existsSync(file)) return [];
  const inst = readJson(file) as {pand: string; anchor: [number, number]}[];
  // Each instance replaces its own pand; the game suppresses `NL.IMBAG.Pand.<pand>` (runtime.ts suppression ids).
  return inst.map(i => ({id: `building-type:${i.pand}`, kind: 'building-type', suppress: new Set([`NL.IMBAG.Pand.${i.pand}`]), footprint: [], source: 'bag-pand', centre: i.anchor}));
}
