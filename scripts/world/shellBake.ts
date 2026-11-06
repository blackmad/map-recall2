/**
 * Bake a world cell's shells (lane R2-B, #229): SHEL (the runtime coarse chunk of the cell's buildings) and SHL1 (the
 * far ring's simplified level). The coarse chunk is threeBuildingFeatures.buildFeatureChunk(features, look, 'coarse',
 * …, {shellRoofs: true}), the call the browser worker makes for a `coarse:` group (threeBuildingsBrowser rebuild),
 * with the same street-appearance catalogue (public/data/street-appearance/profiles.json through the runtime's
 * validator) and party-wall context (BuildingContextIndex neighbours, the runtime's exclusion rule).
 * Not baked (the runtime has them only during a session): the loaded OSM street fronts (`setStreets`, doors on the
 * street side), host wall openings and the diagnostic surveyed envelopes; a building whose kit replaces it
 * (KIT_HIDE_IDS) is left out as the runtime leaves it out.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildFeatureChunk, asPolygons, type BuildingLook, type Feature } from '../../src/canalRecall/threeBuildingFeatures.js';
import { wallTopHeightM } from '../../src/canalRecall/threeBuildingMesh.js';
import { validateStreetAppearanceCatalog, type StreetAppearanceProfile } from '../../src/canalRecall/streetAppearance.js';
import { KIT_HIDE_IDS } from '../../src/canalRecall/landmarkKits.js';
import { chunkMetres, farPrisms, quantisePrisms, shellFromChunk, shellOrigin, simplifyRing, SHL1_SIMPLIFY_M, type FarPrism, type ShellMesh } from '../../src/canalRecall/world/shellMesh.js';

export const SHELL_LOOK: BuildingLook = 'photo';

let profiles: StreetAppearanceProfile[] | null = null;
export function shellProfiles(root: string): StreetAppearanceProfile[] {
  if (profiles) return profiles;
  const file = path.join(root, 'public/data/street-appearance/profiles.json');
  if (!fs.existsSync(file)) return profiles = [];
  const admitted = validateStreetAppearanceCatalog(JSON.parse(fs.readFileSync(file, 'utf8')));
  return profiles = JSON.parse(JSON.stringify(admitted)).profiles;
}
const KIT_HIDE = new Set(KIT_HIDE_IDS);
/** A building's coarse group without a cell's GRP: the z14 tile of its first vertex (threeBuildingsBrowser tileKeyOf). */
function groupTile(f: Feature): string {
  const [lng, lat] = asPolygons(f.geometry)[0]?.[0]?.[0] ?? [0, 0], n = 2 ** 14, rad = lat * Math.PI / 180;
  return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)}`;
}

export type ShellBake = { shel: ShellMesh; far: FarPrism[]; coarseTriangles: number; ms: number; farMs: number; buildings: number };

/**
 * `features`: the cell's styled buildings in cell order (index = bid); `context`: the party-wall neighbours of the
 * cell's buildings that are not in the cell (other cells), as the runtime context of a chunk.
 */
export function bakeCellShell(i: number, j: number, features: readonly Feature[], context: readonly Feature[], root: string, groups: readonly string[] = [], farHidden: ReadonlySet<string> = new Set()): ShellBake | null {
  const t0 = performance.now();
  const bid = new Map<string, number>();
  features.forEach((f, k) => bid.set(String(f.properties.id), k));
  const drawn = features.filter(f => !KIT_HIDE.has(String(f.properties.id)));
  if (!drawn.length) return null;
  const chunk = buildFeatureChunk(drawn as Feature[], SHELL_LOOK, 'coarse', undefined, shellProfiles(root), context as Feature[], [], new Map(), { shellRoofs: true });
  if (!chunk.indices.length) return null;
  const origin = shellOrigin(i, j), shel = shellFromChunk(chunk, origin, id => bid.get(id) ?? -1);
  const ms = performance.now() - t0, t1 = performance.now();
  return { shel, far: bakeFar(shel, features, origin, groups, farHidden), coarseTriangles: chunk.indices.length / 3, ms, farMs: performance.now() - t1, buildings: features.length };
}

/** SHL1: a prism per building polygon, measured off the SHEL bake (shellMesh.ts farPrisms). */
/** `groups[bid]`: the building's coarse group tile (CellBuilding.group, `x/y`); the far tier hides a tile's prisms while its resident shell draws. */
/** `hidden`: ids an installed model or kit replaces (the cell's HIDE list); they get no prism. */
export function bakeFar(shel: ShellMesh, features: readonly Feature[], origin: readonly [number, number], groups: readonly string[] = [], hidden: ReadonlySet<string> = new Set()): FarPrism[] {
  const top = new Float64Array(features.length).fill(-Infinity);
  for (let k = 0; k < shel.bids.length; k++) top[shel.bids[k]] = Math.max(top[shel.bids[k]], shel.positions[k * 3 + 2]);
  // One prism per polygon of a building (a multipolygon's parts share its colours and heights).
  const rings: (number[][][] | null)[] = [], heights: { eavesM: number; topM: number }[] = [], owner: number[] = [];
  const polys: number[][][][] = [];
  features.forEach((f, b) => {
    if (!Number.isFinite(top[b]) || hidden.has(String(f.properties.id))) return;
    for (const polygon of asPolygons(f.geometry)) {
      const local = polygon.map(ring => { const pts = ring.map(([lng, lat]) => { const [x, y] = chunkMetres(lng, lat); return [x - origin[0], y - origin[1]]; }); if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop(); return pts; }).filter(r => r.length >= 3);
      if (!local.length) continue;
      polys.push(local.map(r => simplifyRing(r, SHL1_SIMPLIFY_M))); owner.push(b);
    }
  });
  // farPrisms reads colours per bid; feed it per building, then fan the result out to the building's polygons.
  features.forEach((f, b) => { rings.push(Number.isFinite(top[b]) ? [[[0, 0]]] : null); heights.push({ eavesM: Math.min(wallTopHeightM(f.properties), top[b]), topM: top[b] }); });
  const perBuilding = farPrisms(shel, rings, heights);
  const out: FarPrism[] = [];
  polys.forEach((poly, n) => { const pr = perBuilding[owner[n]]; if (pr) out.push({ ...pr, rings: poly, tile: groups[owner[n]] ?? groupTile(features[owner[n]]) }); });
  return quantisePrisms(out);
}
