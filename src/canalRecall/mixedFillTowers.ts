/**
 * A gap fill (bagGaps.ts) is one box at the AHN p70 of its outline. Where the
 * outline holds a tall house and a low or empty rest, p70 reads the rest: the
 * Overtoom 1874 apartment house (NL.IMBAG.Pand.0363100012159138) stood at
 * 4.9 m because its BAG outline runs back over a garden AHN sees at ground,
 * while the street front is 17.6 m (2026-10-30).
 *
 * Pure grid logic: the AHN cells inside the outline more than TOWER_OVER_M
 * above the fill top are grouped 4-connected; the largest group, when it is at
 * least TOWER_MIN_M2 and compact enough to be a roof (trees scatter), is the
 * tower, drawn as its convex hull from the fill top to the group's p70.
 * scripts/split-mixed-gap-fills.ts measures, skips towers other features
 * already draw (Gelderlandplein's OSM parts) and writes `tower:` features.
 */

/** An AHN cell centre in RD metres and its height over the ground. */
export type HeightCell = [x: number, y: number, heightM: number];
type Xy = [number, number];

/** A cell this far over the fill's top is the tower, not roof furniture. */
export const TOWER_OVER_M = 8;
/** Smaller groups are a neighbour's wall or a tree crown at the edge. */
export const TOWER_MIN_M2 = 50;
/** Cells / hull area: a block roof fills its hull, a tree crown's scatter does not. */
export const TOWER_MIN_FILL = 0.6;

export interface MixedTower { hull: Xy[]; heightM: number; areaM2: number; fill: number }

function convexHull(points: Xy[]): Xy[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Xy, a: Xy, b: Xy) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Xy[]) => {
    const out: Xy[] = [];
    for (const q of list) { while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop(); out.push(q); }
    out.pop();
    return out;
  };
  return [...half(p), ...half([...p].reverse())];
}
const ringArea = (r: Xy[]) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

/** The tower inside a fill of `fillTopM`, from its outline's AHN cells (`cellM` apart), or null. */
export function mixedFillTower(cells: readonly HeightCell[], fillTopM: number, cellM = 0.5): MixedTower | null {
  const key = (x: number, y: number) => `${Math.round(x / cellM)},${Math.round(y / cellM)}`;
  const high = new Map<string, HeightCell>();
  for (const c of cells) if (c[2] - fillTopM > TOWER_OVER_M) high.set(key(c[0], c[1]), c);
  let best: HeightCell[] = [];
  const seen = new Set<string>();
  for (const [k0, c0] of high) {
    if (seen.has(k0)) continue;
    const group: HeightCell[] = [], stack = [c0];
    seen.add(k0);
    while (stack.length) {
      const c = stack.pop()!;
      group.push(c);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(c[0] + dx * cellM, c[1] + dy * cellM), n = high.get(k);
        if (n && !seen.has(k)) { seen.add(k); stack.push(n); }
      }
    }
    if (group.length > best.length) best = group;
  }
  const areaM2 = best.length * cellM * cellM;
  if (areaM2 < TOWER_MIN_M2) return null;
  // Hull over the cell corners, so a rectangle of cells gives its own rectangle.
  const h = cellM / 2;
  const hull = convexHull(best.flatMap(([x, y]) => [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]] as Xy[]));
  const fill = areaM2 / ringArea(hull);
  if (fill < TOWER_MIN_FILL) return null;
  const hs = best.map(c => c[2]).sort((a, b) => a - b);
  return { hull, heightM: hs[Math.floor((hs.length - 1) * 0.7)], areaM2, fill: Math.round(fill * 100) / 100 };
}
