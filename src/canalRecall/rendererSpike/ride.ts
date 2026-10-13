// Deterministic autopilot ride and MapLibre-equivalent camera for the spike (pure).
import type { StreetWay, Vec2 } from './streetMesh.js';

const RIDEABLE = new Set(['residential', 'living_street', 'unclassified', 'tertiary', 'secondary', 'cycleway', 'service', 'pedestrian']);

/**
 * A ride through the street graph: start at the node nearest `start`, then at
 * every junction take the straightest unused continuation, with a seeded
 * nudge so it is not one long straight. Same seed, same ride (perf runs).
 */
export function autopilotPath(ways: readonly StreetWay[], start: Vec2, targetM = 2500, seed = 7): Vec2[] {
  const key = (p: Vec2) => `${Math.round(p[0] * 2)}:${Math.round(p[1] * 2)}`;
  const nodes = new Map<string, Vec2>();
  const edges = new Map<string, string[]>();
  const link = (a: string, b: string) => { (edges.get(a) ?? edges.set(a, []).get(a)!).push(b); };
  for (const way of ways) {
    if (!RIDEABLE.has(way.highway)) continue;
    for (let i = 0; i + 1 < way.points.length; i++) {
      const a = key(way.points[i]), b = key(way.points[i + 1]);
      if (a === b) continue;
      nodes.set(a, way.points[i]); nodes.set(b, way.points[i + 1]);
      link(a, b); link(b, a);
    }
  }
  let current = '', best = Infinity;
  for (const [k, p] of nodes) { const d = Math.hypot(p[0] - start[0], p[1] - start[1]); if (d < best && (edges.get(k)?.length ?? 0) > 1) { best = d; current = k; } }
  if (!current) return [start];
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const used = new Set<string>();
  const path: Vec2[] = [nodes.get(current)!];
  let heading: Vec2 | null = null, length = 0, previous = '';
  while (length < targetM) {
    const options = (edges.get(current) ?? []).filter(n => n !== previous && !used.has(`${current}>${n}`));
    if (!options.length) break;
    const here = nodes.get(current)!;
    const score = (n: string) => {
      const p = nodes.get(n)!, dx = p[0] - here[0], dy = p[1] - here[1], len = Math.hypot(dx, dy) || 1;
      const straight = heading ? (dx * heading[0] + dy * heading[1]) / len : 0;
      return straight + rand() * 0.9;
    };
    const next = options.reduce((a, b) => (score(b) > score(a) ? b : a));
    used.add(`${current}>${next}`); used.add(`${next}>${current}`);
    const p = nodes.get(next)!, dx = p[0] - here[0], dy = p[1] - here[1], len = Math.hypot(dx, dy);
    if (len > 1e-3) heading = [dx / len, dy / len];
    length += len; path.push(p); previous = current; current = next;
  }
  return path;
}

/** Position and heading at distance `d` along a polyline, ping-ponging at the ends. */
export function sampleAlong(path: readonly Vec2[], cumulative: readonly number[], d: number): { p: Vec2; dir: Vec2 } {
  const total = cumulative[cumulative.length - 1] || 1;
  const cycle = d % (2 * total), forward = cycle <= total, t = forward ? cycle : 2 * total - cycle;
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < t) i++;
  const a = path[i - 1], b = path[i], seg = cumulative[i] - cumulative[i - 1] || 1, u = (t - cumulative[i - 1]) / seg;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const dir: Vec2 = forward ? [dx / len, dy / len] : [-dx / len, -dy / len];
  return { p: [a[0] + dx * u, a[1] + dy * u], dir };
}

export function cumulativeLengths(path: readonly Vec2[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return out;
}

/** MapLibre's camera, re-expressed in local metres: what a `jumpTo` would show. */
export type MapCamera = { centre: Vec2; zoom: number; pitchDeg: number; bearingDeg: number; fovDeg: number; lat: number };
const EARTH_RADIUS = 6371008.8; // MapLibre's earthRadius

export function mapLibreEye(cam: MapCamera, viewportHeightPx: number): { eye: [number, number, number]; target: [number, number, number] } {
  const worldSize = 512 * 2 ** cam.zoom;
  const metresPerPx = (2 * Math.PI * EARTH_RADIUS * Math.cos(cam.lat * Math.PI / 180)) / worldSize;
  const distPx = 0.5 * viewportHeightPx / Math.tan((cam.fovDeg * Math.PI / 180) / 2);
  const dist = distPx * metresPerPx;
  const pitch = cam.pitchDeg * Math.PI / 180, bearing = cam.bearingDeg * Math.PI / 180;
  const fx = Math.sin(bearing), fy = Math.cos(bearing); // bearing: clockwise from north
  const eye: [number, number, number] = [cam.centre[0] - fx * dist * Math.sin(pitch), cam.centre[1] - fy * dist * Math.sin(pitch), dist * Math.cos(pitch)];
  return { eye, target: [cam.centre[0], cam.centre[1], 0] };
}
