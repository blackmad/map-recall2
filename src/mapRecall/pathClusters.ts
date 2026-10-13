// OSM gives one quiz feature every way that carries its name, so "Singel" in
// the Amsterdam water extract holds the canal round the old city and four
// pieces of a different Singel near Weesp, 18 km away. A fit that frames all
// of it shows the real canal as a sliver. Pieces are clustered by proximity;
// the longest cluster is the anchor, and clusters clear of it by more than
// `farMetres` are dropped. The extract's `center` is no guide: it is the box
// centre of the polluted geometry, which for the Basisweg lands nearer the
// stray pieces than the road.

export type LatLon = [number, number];

export interface PathClusterOptions {
  /** Pieces whose nearest points lie within this distance join one cluster. */
  linkMetres?: number;
  /** Clusters farther than this from the longest cluster are dropped. */
  farMetres?: number;
}

const EARTH = 6371000;

export function metresBetween(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const x = (b[1] - a[1]) * rad * Math.cos(((a[0] + b[0]) / 2) * rad);
  const y = (b[0] - a[0]) * rad;
  return Math.sqrt(x * x + y * y) * EARTH;
}

export function pathLengthMetres(path: readonly LatLon[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += metresBetween(path[i - 1], path[i]);
  return total;
}

function minDistance(a: readonly LatLon[], b: readonly LatLon[]): number {
  let best = Infinity;
  for (const p of a) for (const q of b) {
    const d = metresBetween(p, q);
    if (d < best) best = d;
  }
  return best;
}

/** Groups pieces that come within `linkMetres` of each other (transitively). */
export function clusterPaths(paths: readonly (readonly LatLon[])[], linkMetres = 400): number[][] {
  const owner = paths.map((_, i) => i);
  const find = (i: number): number => (owner[i] === i ? i : (owner[i] = find(owner[i])));
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      if (find(i) === find(j)) continue;
      if (minDistance(paths[i], paths[j]) <= linkMetres) owner[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  paths.forEach((_, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });
  return [...groups.values()];
}

export interface OutlierResult {
  paths: LatLon[][];
  dropped: number;
}

/**
 * Keeps the longest cluster and every cluster within `farMetres` of it. A
 * feature of one cluster is unchanged.
 */
export function dropOutlyingPaths(paths: readonly (readonly LatLon[])[], options: PathClusterOptions = {}): OutlierResult {
  const { linkMetres = 400, farMetres = 3000 } = options;
  const copy = () => ({ paths: paths.map((p) => [...p] as LatLon[]), dropped: 0 });
  if (paths.length < 2) return copy();
  const clusters = clusterPaths(paths, linkMetres);
  if (clusters.length < 2) return copy();
  const points = clusters.map((members) => members.flatMap((i) => paths[i]));
  const lengths = clusters.map((members) => members.reduce((sum, i) => sum + pathLengthMetres(paths[i]), 0));
  const anchor = lengths.indexOf(Math.max(...lengths));
  const keep = new Set<number>();
  clusters.forEach((members, c) => {
    if (c === anchor || minDistance(points[c], points[anchor]) <= farMetres) members.forEach((i) => keep.add(i));
  });
  return {
    paths: paths.filter((_, i) => keep.has(i)).map((p) => [...p] as LatLon[]),
    dropped: paths.length - keep.size,
  };
}

/** True when the centre lies farther than `metres` from every point of the paths. */
export function centreIsOff(center: LatLon, paths: readonly (readonly LatLon[])[], metres = 1500): boolean {
  for (const path of paths) for (const p of path) if (metresBetween(p, center) <= metres) return false;
  return true;
}

/** The point on the kept pieces nearest the kept pieces' bounding-box centre. */
export function centreOnPaths(paths: readonly (readonly LatLon[])[]): LatLon | undefined {
  const points = paths.flat();
  if (!points.length) return undefined;
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const box: LatLon = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lons) + Math.max(...lons)) / 2];
  let best = points[0];
  let bestD = Infinity;
  for (const p of points) {
    const d = metresBetween(p, box);
    if (d < bestD) { bestD = d; best = p; }
  }
  return [best[0], best[1]];
}
