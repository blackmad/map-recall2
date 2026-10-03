// Build one hand-modelled landmark kit exactly as the game does, from the OSM parts in the
// building tiles, for the landmark gallery. Pure (no DOM, no three): the node check builds every
// kit from the real tiles on disk, the page feeds the same function from fetched tiles.
//
// What the game does with a kit, and what this repeats:
//   - parts: `kitGeometry(kit, parts)` for every part resident, recoloured per look (`lookHex`),
//     plus every measured front (`frontKitGeometry`) carried by one of the kit's footprints,
//     into one `buildKitChunk` on the look's plain / flat / slope layers;
//   - hosts: the kit's other footprints (roof hosts, hall hosts, bodies, forms) go through the
//     decoration chain (`decorateKitRoof` lowers them to their eaves and gives them the kit's wall)
//     and draw as ordinary building walls (`buildFeatureChunk`, walls then facade extras);
//   - the footprints a kit replaces (tiers, stacks, `hides`) draw nothing of their own.
// Context buildings are not the game's: the brief wants grey prisms, so they are drawn flat grey.

import { KIT_HIDE_IDS, kitGeometry, kitIds, type Kit, type KitPartGeometry, type PartInput } from './landmarkKits.js';
import { FRONT_LIST } from './landmarkFrontData.js';
import { frontKitGeometry, lookHex } from './landmarkFronts.js';
import { buildKitChunk, type Chunk } from './threeBuildingMesh.js';
import { buildFeatureChunk, ORIGIN, type BuildingLook, type Feature } from './threeBuildingFeatures.js';
import { fitDistance, outerRing, ringsFrame } from './galleryPipeline.js';
import { kitLayersFor } from './galleryLayers.js';

const KIT_HIDE_SET: ReadonlySet<string> = new Set(KIT_HIDE_IDS);
export const CONTEXT_GREY = '#b6b0a4';
const triangles = (c: Chunk | null) => (c ? c.indices.length / 3 : 0);

/** Every footprint id a kit draws or walls (parts, hosts, bodies, forms): the ids to look up in the tiles. */
export const kitPartIds = (kit: Kit): string[] => [...new Set(kitIds(kit))];

export type KitScene = {
  kit: Chunk | null;
  hosts: Chunk | null;
  extras: Chunk | null;
  context: Chunk | null;
  /** Centre (metres from ORIGIN) and size, computed from the kit's own footprints. */
  frame: { cx: number; cy: number; halfDiag: number; top: number; dist: number };
  tris: { kit: number; hosts: number; extras: number; context: number };
  /** Footprint ids of the kit found in the supplied tiles, and those not found. */
  found: string[];
  missing: string[];
};

export function buildKitScene(kit: Kit, features: readonly Feature[], look: BuildingLook, decorate: (f: Feature) => Feature, contextRadiusM = 45): KitScene | null {
  const wanted = new Set(kitPartIds(kit));
  const own: Feature[] = [], rest: Feature[] = [];
  for (const f of features) (wanted.has(String(f.properties.id)) ? own : rest).push(f);
  const parts = new Map<string, PartInput>(), rings: [number, number][][] = [], tops: number[] = [];
  for (const f of own) {
    const ring = outerRing(f);
    if (!ring) continue;
    const id = String(f.properties.id);
    parts.set(id, { id, ring, minHeightM: Number(f.properties.minHeight) || 0, heightM: Number(f.properties.height) });
    rings.push(ring); tops.push(Number(f.properties.height));
  }
  const found = [...parts.keys()], missing = [...wanted].filter(id => !parts.has(id));
  if (!rings.length) return null;

  const geometry: KitPartGeometry[] = kitGeometry(kit, parts).map(g => ({ ...g, tris: g.tris.map(t => ({ ...t, hex: lookHex(t.hex, look) })) }));
  for (const front of FRONT_LIST) {
    if (!front.ids.some(id => wanted.has(id) && parts.has(id))) continue;
    const g = frontKitGeometry(front, ORIGIN, look), held = geometry.find(x => x.id === g.id);
    if (held) held.tris.push(...g.tris); else geometry.push(g);
  }
  const kitChunk = buildKitChunk(geometry, kitLayersFor(look));

  const hostFeatures = own.filter(f => !KIT_HIDE_SET.has(String(f.properties.id))).map(decorate);
  const hosts = hostFeatures.length ? buildFeatureChunk(hostFeatures, look, 'walls') : null;
  const extras = hostFeatures.length && look !== 'untextured' ? buildFeatureChunk(hostFeatures, look, 'extras') : null;

  let zMax = 0;
  for (const c of [kitChunk, hosts]) if (c) for (let i = 2; i < c.positions.length; i += 3) zMax = Math.max(zMax, c.positions[i]);
  const base = ringsFrame(rings, [...tops, zMax])!;
  const frame = { ...base, dist: fitDistance(base.halfDiag, base.top) };

  const reach = base.halfDiag + contextRadiusM;
  const near = rest.filter(f => { const r = outerRing(f); return !!r && Math.hypot(r[0][0] - base.cx, r[0][1] - base.cy) <= reach; })
    .map(f => ({ type: 'Feature' as const, geometry: f.geometry, properties: { id: String(f.properties.id), height: Number(f.properties.height) || 8, minHeight: Number(f.properties.minHeight) || 0, sideColour: CONTEXT_GREY } }));
  const context = near.length ? buildFeatureChunk(near, 'untextured', 'walls') : null;

  return {
    kit: kitChunk.vertexCount ? kitChunk : null, hosts: hosts?.vertexCount ? hosts : null, extras: extras?.vertexCount ? extras : null, context: context?.vertexCount ? context : null,
    frame, found, missing,
    tris: { kit: triangles(kitChunk), hosts: triangles(hosts), extras: triangles(extras), context: triangles(context) },
  };
}
