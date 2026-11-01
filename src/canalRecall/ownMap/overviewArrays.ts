// The overview's geometry as plain typed arrays (#129: building it was 184 ms of the own engine's boot on the main
// thread). The same arrays ownMap/layers.ts polygonGeometry / lineGeometry wrap and the same bounding sphere three.js
// computes, plus the overview's span tiles, so the pool worker can build them (engine/overviewLayer.ts) and the main
// thread only wraps them. No three.js here: the worker bundle stays small.
import earcut from 'earcut';
import type { Vec2 } from './frame';
import { LANDUSE_CLASSES, STREET_CLASSES, type OverviewData } from './overviewFormat';
import { splitIntoTiles, type CellTile } from '../ownGround/cellTiles.js';

export interface GeometryArrays {
  attributes: { position: Float32Array; aDir?: Float32Array; aCorner?: Float32Array };
  index: Uint16Array | Uint32Array;
  /** three.js computeBoundingSphere of `position`: centre x, y, z and radius. */
  sphere: [number, number, number, number];
}

/** polygonGeometry's arrays: rings earcut per polygon, z = 0; a 16-bit index up to 65535 vertices. */
export function polygonArrays(polygons: readonly (readonly (readonly Vec2[])[])[]): GeometryArrays {
  const pos: number[] = [], idx: number[] = [];
  for (const poly of polygons) {
    const flat: number[] = [], holes: number[] = [];
    poly.forEach((ring, i) => { if (i) holes.push(flat.length / 2); for (const [x, y] of ring) flat.push(x, y); });
    const base = pos.length / 3;
    for (let i = 0; i < flat.length; i += 2) pos.push(flat[i], flat[i + 1], 0);
    for (const t of earcut(flat, holes, 2)) idx.push(base + t);
  }
  const position = new Float32Array(pos);
  return { attributes: { position }, index: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), sphere: boundingSphere(position) };
}

/** lineGeometry's arrays: one quad per segment, extruded in the vertex shader (ownMap/layers.ts). */
export function lineArrays(lines: readonly (readonly Vec2[])[]): GeometryArrays {
  let segs = 0;
  for (const l of lines) segs += Math.max(0, l.length - 1);
  const pos = new Float32Array(segs * 12), dir = new Float32Array(segs * 8), corner = new Float32Array(segs * 8);
  const idx = new Uint32Array(segs * 6);
  let s = 0;
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const [ax, ay] = l[i - 1], [bx, by] = l[i];
    const len = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / len, dy = (by - ay) / len;
    const v = s * 4;
    const put = (k: number, x: number, y: number, side: number, ext: number) => {
      pos.set([x, y, 0], (v + k) * 3); dir.set([dx, dy], (v + k) * 2); corner.set([side, ext], (v + k) * 2);
    };
    put(0, ax, ay, 1, -1); put(1, ax, ay, -1, -1); put(2, bx, by, 1, 1); put(3, bx, by, -1, 1);
    idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], s * 6);
    s++;
  }
  return { attributes: { position: pos, aDir: dir, aCorner: corner }, index: idx, sphere: boundingSphere(pos) };
}

/**
 * three.js BufferGeometry.computeBoundingSphere over an xyz Float32 position: the box's centre (0, 0, 0 when empty),
 * then the largest squared distance from it, square-rooted. Same operations in the same order, so the same doubles.
 */
export function boundingSphere(p: Float32Array): [number, number, number, number] {
  const n = p.length / 3;
  if (!n) return [0, 0, 0, 0];
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z);
  }
  const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5, cz = (z0 + z1) * 0.5;
  let r2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = cx - p[i * 3], dy = cy - p[i * 3 + 1], dz = cz - p[i * 3 + 2];
    r2 = Math.max(r2, dx * dx + dy * dy + dz * dz);
  }
  return [cx, cy, cz, Math.sqrt(r2)];
}

/** One overview geometry: its id, and how to make its arrays from the data. */
export interface OverviewRecipe { id: string; make: () => GeometryArrays }

/** Overview land padding round the data's bounds, metres. */
const LAND_PAD_M = 20_000;

/**
 * Every geometry the overview draws, by id (engine/overviewLayer.ts looks them up by id; the worker builds the same
 * list): the land, water and parks, the v2 landuse / piers / pier lines / rail groups, and one line set per street
 * class. Ids are stable for a given data file.
 */
export function overviewRecipes(data: OverviewData): OverviewRecipe[] {
  const [x0, y0, x1, y1] = data.bounds, pad = LAND_PAD_M;
  const out: OverviewRecipe[] = [
    { id: 'land', make: () => polygonArrays([[[[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x1 + pad, y1 + pad], [x0 - pad, y1 + pad]]]]) },
    { id: 'water', make: () => polygonArrays(data.water) },
    { id: 'parks', make: () => polygonArrays(data.parks.flatMap(p => p.rings.map(r => [r]))) },
  ];
  for (const cls of LANDUSE_CLASSES) {
    const polys = data.landuse.filter(l => l.cls === cls).map(l => l.rings);
    if (polys.length) out.push({ id: `landuse:${cls}`, make: () => polygonArrays(polys) });
  }
  if (data.piers.length) out.push({ id: 'piers', make: () => polygonArrays(data.piers.map(r => [r])) });
  if (data.pierLines.length) out.push({ id: 'pierLines', make: () => lineArrays(data.pierLines) });
  for (const g of railGroups(data)) out.push({ id: `rail:${g.key}`, make: () => lineArrays(g.lines) });
  for (const cls of STREET_CLASSES) out.push({ id: `street:${cls}`, make: () => lineArrays(data.streets.filter(s => s.cls === cls).map(s => s.points)) });
  return out;
}

/** The rail lines grouped by kind, tunnel and service, in first-seen order (each group is one draw). */
export function railGroups(data: OverviewData): { key: string; kind: OverviewData['rail'][number]['kind']; tunnel: boolean; service: boolean; lines: Vec2[][] }[] {
  const groups = new Map<string, { key: string; kind: OverviewData['rail'][number]['kind']; tunnel: boolean; service: boolean; lines: Vec2[][] }>();
  for (const r of data.rail) {
    const key = `${r.kind}|${r.tunnel}|${r.service}`;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { key, kind: r.kind, tunnel: r.tunnel, service: r.service, lines: [] });
    g.lines.push(r.points);
  }
  return [...groups.values()];
}

/** A geometry built off the main thread: its arrays and its span tiles (null: kept whole). */
export interface BuiltOverviewGeometry extends GeometryArrays { id: string; tiles: CellTile[] | null }

/**
 * Every recipe built, with the tiles rawTiles would cut on the main thread (the same splitIntoTiles call on the same
 * Float32 position and index: a fresh geometry has no groups and a whole draw range).
 */
export function buildOverview(data: OverviewData, tiles: number, minTriangles: number): BuiltOverviewGeometry[] {
  return overviewRecipes(data).map(({ id, make }) => {
    const a = make();
    return { id, ...a, tiles: tiles > 1 ? splitIntoTiles(a.attributes.position, a.index, tiles, minTriangles) : null };
  });
}

/** The buffers of `buildOverview`'s result, each once, to transfer. */
export function overviewTransferables(built: readonly BuiltOverviewGeometry[]): ArrayBuffer[] {
  const out = new Set<ArrayBuffer>();
  for (const g of built) {
    for (const a of Object.values(g.attributes)) if (a) out.add(a.buffer as ArrayBuffer);
    out.add(g.index.buffer as ArrayBuffer);
    for (const t of g.tiles ?? []) out.add(t.indices.buffer as ArrayBuffer);
  }
  return [...out];
}
