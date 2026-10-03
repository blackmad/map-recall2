/**
 * The city's ground-standing building footprints (building tiles, zoom 14) in local metres,
 * with a point-to-building matcher: the footprint that contains the point, else the nearest
 * footprint edge within `maxM` metres (a POI drawn on the pavement in front of its shop).
 * Shared by the shopfront and supermarket generators.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const LAT0 = 52.37, KX = 111_320 * Math.cos(LAT0 * Math.PI / 180), KY = 110_540, CELL = 50;
export const local = (lng: number, lat: number): [number, number] => [(lng - 4.9) * KX, (lat - LAT0) * KY];
export type Building = { id: string; ring: [number, number][]; cx: number; cy: number };

const contains = (ring: [number, number][], x: number, y: number) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const edgeDistance = (ring: [number, number][], x: number, y: number) => { let best = Infinity; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, ay] = ring[j], [bx, by] = ring[i], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return best; };

export function loadGroundBuildings(root = 'public/data/extracts/amsterdam/building-tiles/14') {
  const buildings: Building[] = [], grid = new Map<string, Building[]>(), byId = new Map<string, Building>();
  for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
    const bytes = fs.readFileSync(path.join(root, x, f));
    for (const feature of JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).features) {
      const g = feature.geometry, outer = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
      if (!outer || Number(feature.properties.minHeight) > 2) continue;
      const ring = outer.map(([lng, lat]: number[]) => local(lng, lat));
      const cx = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, cy = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
      const b = { id: String(feature.properties.id), ring, cx, cy };
      buildings.push(b); byId.set(b.id, b);
      // Indexed in every cell its footprint's box touches, so a big block is found from any side.
      const xs = ring.map((p: number[]) => p[0]), ys = ring.map((p: number[]) => p[1]);
      for (let gx = Math.floor(Math.min(...xs) / CELL); gx <= Math.floor(Math.max(...xs) / CELL); gx++) for (let gy = Math.floor(Math.min(...ys) / CELL); gy <= Math.floor(Math.max(...ys) / CELL); gy++) {
        const key = `${gx},${gy}`; let list = grid.get(key); if (!list) grid.set(key, list = []); list.push(b);
      }
    }
  }
  const near = (x: number, y: number) => { const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), out = new Set<Building>(); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const b of grid.get(`${gx + dx},${gy + dy}`) ?? []) out.add(b); return [...out]; };
  /** The building a point at local (x, y) belongs to, and how: inside its footprint or `d` metres from its edge. */
  const hostOf = (x: number, y: number, maxM = 8): { b: Building; how: 'inside' | 'edge'; d: number } | null => {
    const candidates = near(x, y);
    const inside = candidates.find(b => contains(b.ring, x, y));
    if (inside) return { b: inside, how: 'inside', d: 0 };
    let best: Building | null = null, bestD = maxM;
    for (const b of candidates) { const d = edgeDistance(b.ring, x, y); if (d < bestD) { bestD = d; best = b; } }
    return best ? { b: best, how: 'edge', d: bestD } : null;
  };
  return { buildings, byId, near, hostOf, CELL };
}
