/** Original kit/houseboat geometry shared by worker and inline fallback. */
import { KITS, kitGeometry, type PartInput, type KitPartGeometry } from './landmarkKits.js';
import { FRONT_LIST } from './landmarkFrontData.js';
import { frontKitGeometry, lookHex } from './landmarkFronts.js';
import { houseboatGeometry, type Houseboat } from './houseboats.js';
import { buildKitChunk, type Chunk } from './threeBuildingMesh.js';
import { ORIGIN, asPolygons, type Feature, type BuildingLook } from './threeBuildingFeatures.js';
export type KitLayers = { plain: number; flat: number; slope: number };

export function buildSpecialKits(source: Feature[], look: BuildingLook, layers: KitLayers): Chunk {
  const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), ky = 110_540;
  const parts = new Map<string, PartInput>();
  for (const f of source) {
    const polygons = asPolygons(f.geometry), outer = polygons[0]?.[0];
    if (!outer) continue;
    const id = String(f.properties.id);
    parts.set(id, { id, ring: outer.map(([lng, lat]) => [(lng - ORIGIN.lng) * kx, (lat - ORIGIN.lat) * ky] as [number, number]), minHeightM: Number(f.properties.minHeight) || 0, heightM: Number(f.properties.height) });
  }
  // Kits and fronts are authored in natural colours; each look recolours them like its neighbours.
  const geometry: KitPartGeometry[] = KITS.flatMap(kit => kitGeometry(kit, parts)).map(g => ({ ...g, tris: g.tris.map(t => ({ ...t, hex: lookHex(t.hex, look) })) }));
  for (const front of FRONT_LIST) {
    if (!front.ids.some(id => parts.has(id))) continue;
    const g = frontKitGeometry(front, ORIGIN, look), held = geometry.find(x => x.id === g.id);
    // One range per id: a front shares its first carrier's range (a kit roof on the Beurs hall), so hiding the answer hides both.
    if (held) held.tris.push(...g.tris); else geometry.push(g);
  }
  return buildKitChunk(geometry, layers);
}

export function buildSpecialBoats(boats: readonly Houseboat[], look: BuildingLook, layers: KitLayers): Chunk {
  const geometry = boats.map(b => houseboatGeometry(b, ORIGIN)).filter((g): g is KitPartGeometry => !!g)
    .map(g => ({ ...g, tris: g.tris.map(t => ({ ...t, hex: lookHex(t.hex, look) })) }));
  return buildKitChunk(geometry, layers);
}
