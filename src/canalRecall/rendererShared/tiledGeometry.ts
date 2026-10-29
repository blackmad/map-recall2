// Culled tiles of one three.js geometry (CANAL-RECALL-7): the geometry's triangles cut into an n×n grid
// (ownGround/cellTiles.ts) as sibling geometries over the same vertex attributes, each with its own index and bounding
// sphere, so three.js frustum-culls the tiles off screen. Used by the own ground (one geometry per cell layer) and the
// facade chunks. THREE is injected; nothing is copied but the index.

import { splitIntoTiles, type CellTile } from '../ownGround/cellTiles.js';

/**
 * The tiles of `base` (an indexed BufferGeometry whose position is a plain or interleaved float attribute at offset 0),
 * or null when it is not worth cutting (n ≤ 1, fewer than `minTriangles`, no index, or no readable position array).
 * `groups` keeps each vertex range (a building) whole in one tile (cellTiles.ts). The tiles share `base`'s attribute objects (one GPU buffer each); `base`'s own index is not used by them. Groups and
 * draw ranges are not carried over: a geometry with groups is left whole.
 */
/** The index partition behind tileGeometry (null when unfit), for drawAsSpans. */
export function rawTiles(base: any, n: number, minTriangles: number, groups?: readonly { start: number; count: number }[]): CellTile[] | null {
  if (n <= 1 || !base?.index?.array || base.groups?.length) return null;
  const position = base.attributes.position;
  if (!position || position.itemSize !== 3) return null;
  const interleaved = !!position.isInterleavedBufferAttribute;
  if (interleaved && position.offset !== 0) return null;
  const array = interleaved ? position.data.array : position.array;
  if (!array || !(array instanceof Float32Array)) return null;
  const range = base.drawRange;
  if (range && (range.start !== 0 || (Number.isFinite(range.count) && range.count < base.index.count))) return null;
  return splitIntoTiles(array, base.index.array, n, minTriangles, interleaved ? position.data.stride : 3, groups);
}

export function tileGeometry(THREE: any, base: any, n: number, minTriangles: number, groups?: readonly { start: number; count: number }[]): any[] | null {
  const tiles = rawTiles(base, n, minTriangles, groups);
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

/**
 * How a heavy merged mesh is cut on this device: `spans` on a desktop (one draw call per mesh over the span of its
 * index on screen, drawAsSpans: a desktop frame is bound by draw calls on the CPU), `tiles` on a touch device (child
 * meshes for the tiles on screen only, drawAsTiles: its frame is bound by GPU triangles). `?tileDraw=spans|tiles` (or
 * `window.__canalRecallTileDraw` before load) overrides it.
 */
export type TileDraw = 'spans' | 'tiles';
export function tileDrawFlag(): TileDraw {
  const g = globalThis as { __canalRecallTileDraw?: string; matchMedia?: (query: string) => { matches: boolean }; location?: { search?: string } };
  const asked = g.__canalRecallTileDraw ?? (g.location?.search ? new URLSearchParams(g.location.search).get('tileDraw') : null);
  if (asked === 'spans' || asked === 'tiles') return asked;
  return g.matchMedia?.('(pointer: coarse)')?.matches ? 'tiles' : 'spans';
}

/**
 * Cut `owner` the device's way (tileDrawFlag): spans (the index rewritten in place before upload) or tiles (child
 * meshes). Returns false when the mesh is not worth cutting. `groups` keeps vertex ranges whole (a building);
 * `release` / `tilesOnly` as drawAsTiles.
 */
export function cutMesh(THREE: any, owner: any, n: number, minTriangles: number, options: { groups?: readonly { start: number; count: number }[]; release?: boolean; tilesOnly?: boolean; draw?: TileDraw } = {}): boolean {
  const draw = options.draw ?? tileDrawFlag();
  if (draw === 'spans') {
    const tiles = rawTiles(owner.geometry, n, minTriangles, options.groups);
    if (!tiles || tiles.length < 2) return false;
    drawAsSpans(THREE, owner, tiles, n);
    return true;
  }
  const tiles = tileGeometry(THREE, owner.geometry, n, minTriangles, options.groups);
  if (!tiles) return false;
  drawAsTiles(THREE, owner, tiles, options);
  return true;
}

/** The layer a tiled owner mesh moves to so the camera skips it (three.js still walks, and draws, its children). */
export const TILE_OWNER_LAYER = 31;

/**
 * Every tiled owner on the page, on `globalThis`: the own ground, the facades and the shared frame are separate
 * bundles, each with its own copy of this module, and the frame picks the draw for all of them (chooseTileDraws).
 */
type TileRegistry = { owners: Set<any>; mode: TileMode };
/** `auto`: per owner and frame, whole or tiles (chooseTileDraws); `tiles` / `whole`: forced (A/B, diagnostics). */
export type TileMode = 'auto' | 'tiles' | 'whole';
export function tileRegistry(): TileRegistry {
  const g = globalThis as { __canalRecallTiles?: TileRegistry };
  return (g.__canalRecallTiles ??= { owners: new Set(), mode: 'auto' });
}

/**
 * Draw `owner` (a merged mesh kept whole for everything else that reads it: its geometry, `hidden` flags, picking,
 * highlight passes, fades) through `tiles` when that saves work: each tile is a child mesh over the owner's
 * attributes that reads the owner's material and shadow settings live, so a fade clone or a look switch on the owner
 * reaches every tile. While the tiles draw, the owner sits on TILE_OWNER_LAYER, which no camera enables; its other
 * children (highlight passes) still draw. `release` frees each tile's CPU index after its upload; `tilesOnly` (the
 * owner's index freed, a phone) never draws the owner whole.
 */
export function drawAsTiles(THREE: any, owner: any, tiles: any[], options: { release?: boolean; tilesOnly?: boolean } = {}): void {
  const parts: any[] = [];
  let total = 0;
  for (const [i, g] of tiles.entries()) {
    if (options.release) g.index.onUpload(function (this: any) { this.array = null; });
    const tile = new THREE.Mesh(g);
    for (const key of ['material', 'castShadow', 'receiveShadow', 'customDepthMaterial', 'customDistanceMaterial', 'renderOrder'] as const) {
      Object.defineProperty(tile, key, { get: () => owner[key], set: () => {}, configurable: true });
    }
    tile.name = `${owner.name || 'mesh'}/tile-${i}`;
    tile.frustumCulled = true;
    tile.raycast = () => {};
    const triangles = g.index.count / 3;
    total += triangles;
    tile.userData = { tile: true, radius0: g.boundingSphere.radius, triangles };
    owner.add(tile);
    parts.push(tile);
  }
  owner.userData.tiles = parts;
  owner.userData.tileTriangles = total;
  owner.userData.tilesOnly = !!options.tilesOnly;
  setTilesDrawn(owner, true);
  tileRegistry().owners.add(owner);
}

/** Draw `owner` through its tiles (true) or whole (false). */
export function setTilesDrawn(owner: any, drawn: boolean): void {
  const parts: any[] | undefined = owner?.userData?.tiles;
  if (!parts?.length) return;
  if (!drawn && owner.userData.tilesOnly) drawn = true;
  if (owner.userData.tilesDrawn === drawn) return;
  owner.userData.tilesDrawn = drawn;
  for (const t of parts) t.visible = drawn;
  if (drawn) owner.layers.set(TILE_OWNER_LAYER); else owner.layers.set(0);
}

/** Grow every tile's sphere by `margin` metres over its install radius (vertices moved since, e.g. a ground lift). */
export function growTileSpheres(owner: any, margin: number): void {
  for (const t of owner?.userData?.tiles ?? []) t.geometry.boundingSphere.radius = t.userData.radius0 + Math.max(0, margin);
  for (const sp of owner?.userData?.spans ?? []) sp.radius = sp.radius0 + Math.max(0, margin);
}

/** Dispose the tiles' own geometry (their index); the shared attributes go with the owner's geometry. */
export function disposeTiles(owner: any): void {
  for (const t of owner?.userData?.tiles ?? []) { owner.remove(t); t.geometry.dispose(); }
  if (owner?.userData) owner.userData.tiles = [];
  tileRegistry().owners.delete(owner);
}

/**
 * Per frame, before the main pass: draw each owner whole when the tiles on screen hold at least `wholeShare` of its
 * triangles (one draw call instead of several, for a few culled triangles), through its tiles otherwise. Uses last
 * frame's world matrices (the choice only moves work between draw calls and triangles; either way the picture is the
 * same). `wholeShare` > 1 always draws tiles. Returns the owners drawn each way.
 */
export function chooseTileDraws(THREE: any, clipFromWorld: any, wholeShare: number, scratch?: { frustum: any; sphere: any; m: any }): { tiled: number; whole: number } {
  const reg = tileRegistry();
  let tiled = 0, whole = 0;
  if (!reg.owners.size) return { tiled, whole };
  const s = scratch ?? { frustum: new THREE.Frustum(), sphere: new THREE.Sphere(), m: new THREE.Matrix4() };
  s.frustum.setFromProjectionMatrix(clipFromWorld);
  for (const owner of reg.owners) {
    if (!owner.parent) continue;
    let drawn = reg.mode !== 'whole';
    if (reg.mode === 'auto' && wholeShare <= 1) {
      let visible = 0;
      for (const t of owner.userData.tiles) if (s.frustum.intersectsSphere(s.sphere.copy(t.geometry.boundingSphere).applyMatrix4(owner.matrixWorld))) visible += t.userData.triangles;
      drawn = visible < wholeShare * owner.userData.tileTriangles;
    }
    setTilesDrawn(owner, drawn);
    if (owner.userData.tilesDrawn) tiled++; else whole++;
  }
  return { tiled, whole };
}

/**
 * Draw `owner` in one call over only the span of its index that holds the tiles on screen (a desktop: bound by draw
 * calls, not triangles). The index is rewritten once, before upload, tile after tile in a serpentine order (rows
 * alternate direction, so tiles side by side on screen sit side by side in the index), each tile's triangles in their
 * original order. Per main-pass draw, `onBeforeRender` sets the draw range from the first to the last tile on screen
 * (none: nothing drawn); the shadow pass draws the whole mesh (`onBeforeShadow`), since off-screen buildings cast
 * shadows onto the screen. One object and one draw call per mesh, as before; only the triangle count changes.
 */
export function drawAsSpans(THREE: any, owner: any, tiles: readonly CellTile[], n: number): void {
  const geometry = owner.geometry, index = geometry.index;
  // Serpentine order over the grid cells the tiles came from.
  const order = tiles.map((_, i) => i).sort((a, b) => serpentine(tiles[a].cell, n) - serpentine(tiles[b].cell, n));
  const out = new (index.array.constructor as any)(index.array.length);
  const spans: { start: number; count: number; center: any; radius: number; radius0: number }[] = [];
  let at = 0;
  for (const i of order) {
    out.set(tiles[i].indices, at);
    spans.push({ start: at, count: tiles[i].indices.length, center: new THREE.Vector3(...tiles[i].center), radius: tiles[i].radius, radius0: tiles[i].radius });
    at += tiles[i].indices.length;
  }
  index.array.set(out);
  index.needsUpdate = true;
  const frustum = new THREE.Frustum(), sphere = new THREE.Sphere(), clip = new THREE.Matrix4();
  owner.userData.spans = spans;
  owner.onBeforeShadow = () => { geometry.drawRange.start = 0; geometry.drawRange.count = Infinity; };
  owner.onBeforeRender = (_renderer: any, _scene: any, camera: any) => {
    geometry.drawRange.start = 0; geometry.drawRange.count = Infinity;
    if (tileRegistry().mode === 'whole') return;
    frustum.setFromProjectionMatrix(clip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let first = -1, last = -1;
    for (let k = 0; k < spans.length; k++) {
      sphere.center.copy(spans[k].center); sphere.radius = spans[k].radius;
      if (!frustum.intersectsSphere(sphere.applyMatrix4(owner.matrixWorld))) continue;
      if (first < 0) first = k;
      last = k;
    }
    if (first < 0) { geometry.drawRange.count = 0; return; }
    geometry.drawRange.start = spans[first].start;
    geometry.drawRange.count = spans[last].start + spans[last].count - spans[first].start;
  };
  // Passes that share this geometry (highlight outline/rim, picking) draw the whole range, not the owner's span.
  owner.onAfterRender = () => { geometry.drawRange.start = 0; geometry.drawRange.count = Infinity; };
}

/** Position of row-major grid cell `k` along the serpentine (rows alternate direction). */
function serpentine(k: number, n: number): number {
  const j = Math.floor(k / n), i = k % n;
  return j * n + (j % 2 ? n - 1 - i : i);
}
