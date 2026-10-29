// Culled tiles of one three.js geometry (CANAL-RECALL-7): the geometry's triangles cut into an n×n grid
// (ownGround/cellTiles.ts) as sibling geometries over the same vertex attributes, each with its own index and bounding
// sphere, so three.js frustum-culls the tiles off screen. Used by the own ground (one geometry per cell layer) and the
// facade chunks. THREE is injected; nothing is copied but the index.

import { splitIntoTiles } from '../ownGround/cellTiles.js';

/**
 * The tiles of `base` (an indexed BufferGeometry whose position is a plain or interleaved float attribute at offset 0),
 * or null when it is not worth cutting (n ≤ 1, fewer than `minTriangles`, no index, or no readable position array).
 * The tiles share `base`'s attribute objects (one GPU buffer each); `base`'s own index is not used by them. Groups and
 * draw ranges are not carried over: a geometry with groups is left whole.
 */
export function tileGeometry(THREE: any, base: any, n: number, minTriangles: number): any[] | null {
  if (n <= 1 || !base?.index?.array || base.groups?.length) return null;
  const position = base.attributes.position;
  if (!position || position.itemSize !== 3) return null;
  const interleaved = !!position.isInterleavedBufferAttribute;
  if (interleaved && position.offset !== 0) return null;
  const array = interleaved ? position.data.array : position.array;
  if (!array || !(array instanceof Float32Array)) return null;
  const range = base.drawRange;
  if (range && (range.start !== 0 || (Number.isFinite(range.count) && range.count < base.index.count))) return null;
  const tiles = splitIntoTiles(array, base.index.array, n, minTriangles, interleaved ? position.data.stride : 3);
  if (!tiles) return null;
  return tiles.map(t => {
    const g = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(base.attributes)) g.setAttribute(name, attribute);
    for (const [name, list] of Object.entries(base.morphAttributes ?? {})) g.morphAttributes[name] = list;
    g.setIndex(new THREE.BufferAttribute(t.indices, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...t.center), t.radius);
    g.userData = { ...base.userData, tileOf: base.uuid };
    return g;
  });
}
