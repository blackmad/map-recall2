/**
 * Sub-pand landmarks: a model that stands on only part of a BAG pand.
 *
 * Suppression is keyed by BAG pand id, so until now a landmark either hid its
 * whole pand or none of it. Some landmark pands are much bigger than the landmark:
 * - Singel 250's pand also holds the canal houses behind the bank on the Herengracht
 *   and the Oude Spiegelstraat;
 * - Holland Casino's pand also holds the Leidsekade townhouse range and the old
 *   Huis van Bewaring front.
 * A catalogue entry can now declare `pandParts`: for each pand, a lng/lat ring
 * around the part the model draws. The ring may overshoot the pand's outer walls;
 * only its inner line has to be placed with care.
 *
 * At data time, `scripts/cut-landmark-parts.ts` splits the tile feature in two:
 * - the part: `landmark-part:<model>:<16-digit pand>`, with the original id in
 *   `pand`. The model suppresses it by that exact id.
 * - the rest: same id and properties as before, so everything keyed by the pand
 *   (rows line, house specs, facts, cards) keeps it.
 *
 * Covers (build-covers.ts) never hide a pand that a model declares as split, so
 * the rest stays drawn. With no `pandParts` anywhere, nothing changes:
 * `splitPand` is never called and the tiles are byte-identical.
 */
import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import { multiPolygonAreaM2 } from '../buildingPassages.js';

export type LngLat = [number, number];

/** One declared part: the pand it splits and the ring (lng/lat, closed or open) around the model's share. */
export interface PandPart {
  pand: string;
  ring: LngLat[];
  /** Why the line runs where it does (photo/orthophoto evidence); not used by the geometry. */
  note?: string;
  /**
   * The rest's own heights (m), measured from the 3DBAG roof faces over the rest (pand-part-prepare.ts). Without it the
   * rest keeps the pand's tile height, which is the landmark's: Singel 250's canal houses would stand 22.5 m tall.
   */
  rest?: { height: number; eaves?: number; ridge?: number };
}

export interface PandPartsEntry { id: string; pandParts?: readonly PandPart[] }

/** Pieces smaller than this (slivers along the cut line) are dropped from either side. */
export const MIN_PART_PIECE_M2 = 2;
/** Prefix of a part feature's id. `part:` (bagGaps.ts) and `passage:` (buildingPassages.ts) are taken. */
export const PART_PREFIX = 'landmark-part:';

const FULL = /^NL\.IMBAG\.Pand\.(\d{16})$/;
/** The full tile id of a pand given as its 16 digits or as `NL.IMBAG.Pand.<16>`. */
export function fullPand(pand: string): string {
  const s = String(pand).trim();
  if (FULL.test(s)) return s;
  if (/^\d{16}$/.test(s)) return `NL.IMBAG.Pand.${s}`;
  throw new Error(`pandParts: not a BAG pand id: ${pand}`);
}
export const partFeatureId = (modelId: string, pand: string): string => `${PART_PREFIX}${modelId}:${fullPand(pand).slice(14)}`;
export const isPartFeatureId = (id: string): boolean => String(id).startsWith(PART_PREFIX);

/** The (full) pand ids a model declares as split; these must never be hidden whole for it. */
export function splitPandsOf(entry: PandPartsEntry): string[] {
  return (entry.pandParts ?? []).map(p => fullPand(p.pand));
}

/** Every split pand -> the model that owns the part. Throws when two models claim parts of one pand (not supported yet). */
export function splitPandOwners(entries: Iterable<PandPartsEntry>): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of entries) for (const pand of splitPandsOf(e)) {
    const prior = out.get(pand);
    if (prior && prior !== e.id) throw new Error(`pandParts: ${pand} is split by both ${prior} and ${e.id}`);
    out.set(pand, e.id);
  }
  return out;
}

const closed = (ring: readonly LngLat[]): Ring => {
  const r = ring.map(([x, y]) => [x, y] as [number, number]);
  const [a, b] = [r[0], r[r.length - 1]];
  if (a[0] !== b[0] || a[1] !== b[1]) r.push([a[0], a[1]]);
  return r;
};

const r7 = (v: number) => Math.round(v * 1e7) / 1e7;
const rounded = (mp: MultiPolygon): MultiPolygon => mp.map(poly => poly.map(ring => ring.map(([x, y]) => [r7(x), r7(y)] as [number, number])));
const keep = (mp: MultiPolygon): MultiPolygon => mp.filter(p => multiPolygonAreaM2([p]) >= MIN_PART_PIECE_M2);
const asGeometry = (mp: MultiPolygon): { type: 'Polygon' | 'MultiPolygon'; coordinates: Polygon | MultiPolygon } =>
  mp.length === 1 ? { type: 'Polygon', coordinates: mp[0] } : { type: 'MultiPolygon', coordinates: mp };

type Geometry = { type: string; coordinates: unknown };
export type TileFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry };

export const polygonsOf = (g: Geometry | null | undefined): MultiPolygon =>
  (g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []) as MultiPolygon;

/** The rest's measured heights, only for the keys the tile feature carries (building-tiles has no eaves/ridge). */
function restProps(props: Record<string, unknown>, h: PandPart['rest']): Record<string, number> {
  if (!h) return {};
  const out: Record<string, number> = { height: h.height };
  if (h.eaves !== undefined && 'eaves' in props) out.eaves = h.eaves;
  if (h.ridge !== undefined && 'ridge' in props) out.ridge = h.ridge;
  return out;
}

export interface SplitResult {
  /** The model's share, or null when the ring misses the pand. */
  part: TileFeature | null;
  /** The pand minus the part (same id), or null when the ring covers it all. */
  rest: TileFeature | null;
  partM2: number;
  restM2: number;
}

/**
 * Split one tile feature of a pand by the model's ring. Pure: the input is not changed.
 * The part copies the properties (height, roof, tier...) under its own id, with `pand` and `landmark`;
 * the rest keeps the feature's properties, with the declared rest heights when given; its geometry is the pand minus the ring.
 */
export function splitPand(feature: TileFeature, modelId: string, ring: readonly LngLat[], restHeights?: PandPart['rest']): SplitResult {
  const id = String(feature.properties.id);
  const shape = polygonsOf(feature.geometry);
  const cut: MultiPolygon = [[closed(ring)]];
  const part = keep(rounded(polygonClipping.intersection(shape, cut)));
  const rest = keep(rounded(polygonClipping.difference(shape, cut)));
  const { id: _id, ...props } = feature.properties;
  return {
    part: part.length ? { type: 'Feature', properties: { id: partFeatureId(modelId, id), pand: id, landmark: modelId, ...props }, geometry: asGeometry(part) } : null,
    rest: rest.length ? { type: 'Feature', properties: { ...feature.properties, ...restProps(feature.properties, restHeights) }, geometry: asGeometry(rest) } : null,
    partM2: multiPolygonAreaM2(part),
    restM2: multiPolygonAreaM2(rest),
  };
}

/**
 * Apply every declared part to a tile's features. Features of undeclared pands pass through untouched (same objects).
 * `originals` gives the uncut feature of a pand that an earlier run already split (the tile then holds the rest and
 * the part), so a re-run with a moved ring cuts the original again instead of the rest, and a pand whose declaration
 * was removed gets its original back.
 */
export function applyPandParts(
  features: readonly TileFeature[],
  entries: readonly PandPartsEntry[],
  originals: ReadonlyMap<string, TileFeature> = new Map(),
): { features: TileFeature[]; split: Array<{ model: string; pand: string; partM2: number; restM2: number; original: TileFeature }> } {
  const byPand = new Map<string, { model: string; ring: LngLat[]; rest?: PandPart['rest'] }>();
  for (const e of entries) for (const p of e.pandParts ?? []) byPand.set(fullPand(p.pand), { model: e.id, ring: p.ring, rest: p.rest });
  if (!byPand.size && !originals.size) return { features: [...features], split: [] };
  const out: TileFeature[] = [], split: Array<{ model: string; pand: string; partM2: number; restM2: number; original: TileFeature }> = [];
  for (const f of features) {
    const id = String(f.properties.id ?? '');
    if (isPartFeatureId(id)) continue; // re-made below from the original
    const want = byPand.get(id);
    // A pand no longer declared goes back to its original outline.
    if (!want) { out.push(originals.get(id) ?? f); continue; }
    const original = originals.get(id) ?? f;
    const r = splitPand(original, want.model, want.ring, want.rest);
    if (r.rest) out.push(r.rest);
    if (r.part) out.push(r.part);
    split.push({ model: want.model, pand: id, partM2: r.partM2, restM2: r.restM2, original });
  }
  return { features: out, split };
}

/**
 * A model's outline clipped to its declared parts: the outer rings of (rings ∩ union of part rings). With no parts,
 * the rings come back unchanged. The audits (covers, osm-under-models) read a split landmark's footprint through
 * this: bag-shell-prepare's native ring is the whole pand.
 */
export function clipToParts(rings: readonly (readonly LngLat[])[], parts: readonly PandPart[] | undefined): LngLat[][] {
  if (!parts?.length || !rings.length) return rings.map(r => [...r]);
  const shape: MultiPolygon = rings.map(r => [closed(r)]);
  const cut: MultiPolygon = parts.map(p => [closed(p.ring)]);
  const inside = keep(polygonClipping.intersection(polygonClipping.union(shape[0], ...shape.slice(1)), polygonClipping.union(cut[0], ...cut.slice(1))));
  return inside.map(poly => poly[0].map(([x, y]) => [x, y] as LngLat));
}
