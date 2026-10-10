// A deterministic route ahead of the rider over the OSM street graph (pure),
// for drawing the draped route ribbon in the prototype. The game's real route
// comes from its own router; this only has to follow real streets and bridges.

import type { LocalWay } from './streets.js';
import type { Vec2 } from './surface.js';

const RIDEABLE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'cycleway', 'busway', 'pedestrian', 'primary_link', 'secondary_link', 'tertiary_link']);
const key = (p: Vec2) => `${Math.round(p[0] * 10)}:${Math.round(p[1] * 10)}`;

/**
 * From the node nearest `start`, leave along the edge best aligned with `dir`,
 * then keep taking the straightest continuation until `metres` are covered.
 * `prefer` (a street name) wins ties so a route can be pinned to a street.
 */
export function routeAhead(ways: readonly LocalWay[], start: Vec2, dir: Vec2, metres = 400, prefer?: string): Vec2[] {
  const nodes = new Map<string, Vec2>(), edges = new Map<string, { to: string; name: string }[]>();
  for (const w of ways) {
    if (!RIDEABLE.has(w.tags.highway)) continue;
    const oneway = w.tags.oneway === 'yes' && w.tags.highway !== 'cycleway' && w.tags['oneway:bicycle'] !== 'no';
    for (let i = 0; i + 1 < w.points.length; i++) {
      const a = key(w.points[i]), b = key(w.points[i + 1]);
      if (a === b) continue;
      nodes.set(a, w.points[i]); nodes.set(b, w.points[i + 1]);
      (edges.get(a) ?? edges.set(a, []).get(a)!).push({ to: b, name: w.tags.name ?? '' });
      if (!oneway) (edges.get(b) ?? edges.set(b, []).get(b)!).push({ to: a, name: w.tags.name ?? '' });
    }
  }
  // Start at a node close by and ahead, on an edge that runs the way the rider faces.
  let current = '', best = Infinity;
  for (const [k, p] of nodes) {
    const dx = p[0] - start[0], dy = p[1] - start[1], d = Math.hypot(dx, dy);
    if (d > 60 || !edges.get(k)?.length) continue;
    const ahead = d > 1e-3 ? (dx * dir[0] + dy * dir[1]) / d : 1;
    const along = Math.max(...edges.get(k)!.map(e => { const q = nodes.get(e.to)!, ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey) || 1; return (ex * dir[0] + ey * dir[1]) / l; }));
    const cost = d * (ahead < 0 ? 3 : 1) - 8 * along;
    if (cost < best) { best = cost; current = k; }
  }
  if (!current) return [];
  const path: Vec2[] = [start, nodes.get(current)!];
  let heading = dir, length = 0, previous = '';
  const used = new Set<string>();
  while (length < metres) {
    const here = nodes.get(current)!;
    const options = (edges.get(current) ?? []).filter(e => e.to !== previous && !used.has(`${current}>${e.to}`));
    if (!options.length) break;
    const score = (e: { to: string; name: string }) => {
      const p = nodes.get(e.to)!, dx = p[0] - here[0], dy = p[1] - here[1], l = Math.hypot(dx, dy) || 1;
      return (dx * heading[0] + dy * heading[1]) / l + (prefer && e.name === prefer ? 0.6 : 0);
    };
    const next = options.reduce((a, b) => (score(b) > score(a) ? b : a));
    if (score(next) < -0.2 && path.length > 2) break; // would turn back
    used.add(`${current}>${next.to}`); used.add(`${next.to}>${current}`);
    const p = nodes.get(next.to)!, dx = p[0] - here[0], dy = p[1] - here[1], l = Math.hypot(dx, dy);
    if (l > 1e-3) heading = [dx / l, dy / l];
    length += l; path.push(p); previous = current; current = next.to;
  }
  return path;
}
