/**
 * Recipe tiles: tile arithmetic and the tile frame (pure; shared by the compiler, the runtime and the tests).
 *
 * Two pyramids, one key (the BAG pand id):
 *   building-recipes/14/x/y.json   per-pand recipe index (schema.ts), z14 like the BAG base tiles and the facts sidecar
 *   building-mesh/16/x/y.glb       the compiled near tier, z16 (about 373 m square at Amsterdam's latitude)
 *
 * Tile frame of a z16 mesh tile: glTF axes (+X east, +Y up, +Z south), metres at the tile centre's latitude, origin at
 * the tile centre on the game's flat ground (y = 0). It is an exact linear map of Web Mercator, so the runtime places a
 * tile with one matrix (Mercator = centre + metreUnits * (x, z, y)) and nothing drifts across the tile: the only
 * approximation is that one metre scale serves the whole tile (worst case at a tile edge: 1.4 cm over 186 m).
 */

export const RECIPE_ZOOM = 14;
export const MESH_ZOOM = 16;

const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137;

/** Web Mercator 0..1 (maplibregl.MercatorCoordinate.fromLngLat). */
export function mercatorOf(lng: number, lat: number): [number, number] {
  return [(180 + lng) / 360, (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360];
}
export function lngLatOfMercator(x: number, y: number): [number, number] {
  const lng = x * 360 - 180, y2 = 180 - y * 360;
  return [lng, (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90];
}
/** Mercator units per metre at a latitude (MercatorCoordinate.meterInMercatorCoordinateUnits). */
export const metreUnitsAt = (lat: number): number => 1 / EARTH_CIRCUMFERENCE / Math.cos((lat * Math.PI) / 180);

export type TileKey = {z: number; x: number; y: number};
export const tileId = (t: TileKey): string => `${t.z}/${t.x}/${t.y}`;
export function parseTileId(id: string): TileKey {
  const m = /^(\d+)\/(\d+)\/(\d+)$/.exec(id);
  if (!m) throw Error(`bad tile id ${id}`);
  return {z: +m[1], x: +m[2], y: +m[3]};
}

/** Tile containing a point. */
export function tileOf(lng: number, lat: number, z: number): TileKey {
  const [mx, my] = mercatorOf(lng, lat), n = 2 ** z;
  return {z, x: Math.min(n - 1, Math.max(0, Math.floor(mx * n))), y: Math.min(n - 1, Math.max(0, Math.floor(my * n)))};
}
/** The ancestor of a tile at a lower zoom. */
export function parentAt(t: TileKey, z: number): TileKey {
  if (z > t.z) throw Error('parentAt goes up the pyramid only');
  const s = 2 ** (t.z - z);
  return {z, x: Math.floor(t.x / s), y: Math.floor(t.y / s)};
}

/** Mercator centre of a tile. */
export const tileCentreMercator = (t: TileKey): [number, number] => [(t.x + 0.5) / 2 ** t.z, (t.y + 0.5) / 2 ** t.z];

export interface TileFrame {
  tile: TileKey;
  /** Tile centre, Mercator 0..1. */
  centre: [number, number];
  /** Tile centre [lng, lat]. */
  anchor: [number, number];
  /** Mercator units per metre at the anchor. */
  units: number;
}
export function tileFrame(t: TileKey): TileFrame {
  const centre = tileCentreMercator(t), anchor = lngLatOfMercator(centre[0], centre[1]);
  return {tile: t, centre, anchor, units: metreUnitsAt(anchor[1])};
}
/** [east, south] metres of a lng/lat in a tile frame (y of the frame is height). */
export function toFrame(frame: TileFrame, lng: number, lat: number): [number, number] {
  const [mx, my] = mercatorOf(lng, lat);
  return [(mx - frame.centre[0]) / frame.units, (my - frame.centre[1]) / frame.units];
}
export function fromFrame(frame: TileFrame, east: number, south: number): [number, number] {
  return lngLatOfMercator(frame.centre[0] + east * frame.units, frame.centre[1] + south * frame.units);
}
/**
 * Column-major 4x4 taking tile-frame metres (x east, y up, z south) to Mercator (x east, y south, z up) — the matrix a
 * shared-frame participant whose root space is Mercator gives each tile group.
 */
export function mercatorFromTile(frame: TileFrame): number[] {
  const u = frame.units;
  return [u, 0, 0, 0, 0, 0, u, 0, 0, u, 0, 0, frame.centre[0], frame.centre[1], 0, 1];
}

/**
 * The near set: the 2x2 block of z16 tiles nearest a point (the block whose centre is the tile corner closest to it).
 * With hysteresis, the previous block stays while the point is within `hysteresis` tiles (fraction) of its centre
 * band, so a camera idling on a tile edge does not swap tiles back and forth.
 */
export function nearBlock(lng: number, lat: number, z = MESH_ZOOM, previous?: {x: number; y: number} | null, hysteresis = 0.25): {x: number; y: number; tiles: TileKey[]} {
  const [mx, my] = mercatorOf(lng, lat), n = 2 ** z, fx = mx * n, fy = my * n;
  let x = Math.round(fx) - 1, y = Math.round(fy) - 1;
  // The block (x..x+1, y..y+1) is centred on the corner (x+1, y+1); keep the previous one while within 0.5 + hysteresis.
  if (previous && Math.abs(fx - (previous.x + 1)) <= 0.5 + hysteresis && Math.abs(fy - (previous.y + 1)) <= 0.5 + hysteresis) ({x, y} = previous);
  return {x, y, tiles: [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => ({z, x: x + dx, y: y + dy}))};
}

/** All z16 tiles under a z14 tile. */
export function childrenAt(t: TileKey, z: number): TileKey[] {
  const s = 2 ** (z - t.z), out: TileKey[] = [];
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) out.push({z, x: t.x * s + dx, y: t.y * s + dy});
  return out;
}
