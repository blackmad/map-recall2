export const STREET_OVERLAY_LAYER_IDS = [
  'active-street-line',
] as const;

// Learned streets used to be painted yellow over the basemap. The Liberty
// basemap already draws its road network in yellow, so the overlay read as a
// second, arbitrary highlight on top of it rather than as knowledge. Mastered
// streets still announce themselves — by staying *named* on the map, which is
// the thing worth knowing — so only the street actively under question keeps a
// drawn highlight.
export function streetOverlayLayers(): Array<Record<string, unknown>> {
  const zoomWidth = (low: number, high: number): unknown[] => [
    'interpolate', ['linear'], ['zoom'], 13, low, 18, high,
  ];
  return [
    {
      id: 'active-street-line', type: 'line', source: 'active-street',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      // Keep the active answer as one unambiguous centreline. The former
      // casing/glow stack made every stitched fragment look like several
      // parallel street lines at this camera angle.
      paint: { 'line-color': '#38BDF8', 'line-width': zoomWidth(3, 7), 'line-opacity': 0.96 },
    },
  ];
}

export interface OverlayPoint { x: number; y: number }

/**
 * One world unit is a third of a metre, so a metre of slack absorbs the
 * rounding in an OSM node that two ways each store separately, without ever
 * joining two genuinely different quays.
 */
export const STITCH_TOLERANCE = 3;

/**
 * Join the fragments an OSM way is stored in back into whole polylines.
 *
 * A named waterway or street reaches us as several ways — Grimburgwal is one
 * feature carrying three, laid end to end. Drawing each as its own round-capped
 * line leaves a visible seam at every join, which reads as several canals
 * rather than one.
 *
 * Concatenating them blindly is what the previous code refused to do, and it
 * was right to: two fragments that do not touch become one straight chord
 * across the map. So fragments are only joined where their endpoints actually
 * meet, and a name whose fragments genuinely do not touch still comes back as
 * several polylines.
 */
export function stitchOverlayPaths(
  paths: OverlayPoint[][],
  tolerance: number = STITCH_TOLERANCE,
): OverlayPoint[][] {
  // The routing extract can contain a way twice: once as a path on the
  // grouped named feature and once as its original feature. If both copies
  // reach the endpoint walk, the second one looks like a continuation in the
  // opposite direction. The chain doubles back over itself and the actual
  // next fragment is left as another round-capped feature — the row of
  // blue/yellow "pills" seen on Singel.
  //
  // Remove only exact duplicates (also when digitised in reverse). Nearby
  // parallel carriageways and genuinely different paths sharing endpoints
  // must remain distinct.
  const seenPaths = new Set<string>();
  const usable = paths.filter(path => {
    if (!path || path.length < 2) return false;
    const forward = path.map(point => `${point.x},${point.y}`).join(';');
    const reverse = path.slice().reverse().map(point => `${point.x},${point.y}`).join(';');
    const key = forward < reverse ? forward : reverse;
    if (seenPaths.has(key)) return false;
    seenPaths.add(key);
    return true;
  });
  if (usable.length < 2) return usable.map(path => path.slice());

  const cell = (point: OverlayPoint) => `${Math.round(point.x / tolerance)},${Math.round(point.y / tolerance)}`;
  const touches = (a: OverlayPoint, b: OverlayPoint) =>
    Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;

  // An endpoint index, so a chain is extended without rescanning every
  // fragment. Both ends of every fragment are registered; which end matched
  // decides whether the fragment is appended forwards or reversed.
  const ends = new Map<string, number[]>();
  const register = (point: OverlayPoint, index: number) => {
    const key = cell(point);
    if (!ends.has(key)) ends.set(key, []);
    ends.get(key)!.push(index);
  };
  usable.forEach((path, index) => {
    register(path[0], index);
    register(path[path.length - 1], index);
  });

  const candidatesAt = (point: OverlayPoint): number[] => {
    const [cx, cy] = cell(point).split(',').map(Number);
    const found: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const index of ends.get(`${cx + dx},${cy + dy}`) || []) found.push(index);
      }
    }
    return found;
  };

  const used = new Set<number>();
  const chains: OverlayPoint[][] = [];

  for (let seed = 0; seed < usable.length; seed++) {
    if (used.has(seed)) continue;
    used.add(seed);
    let chain = usable[seed].slice();

    // Grow from the tail, then from the head, so a fragment handed to us in
    // the middle of a chain still ends up whole.
    for (const direction of ['tail', 'head'] as const) {
      let extended = true;
      while (extended) {
        extended = false;
        const tip = direction === 'tail' ? chain[chain.length - 1] : chain[0];
        for (const index of candidatesAt(tip)) {
          if (used.has(index)) continue;
          const candidate = usable[index];
          const head = candidate[0];
          const tail = candidate[candidate.length - 1];
          let addition: OverlayPoint[] | null = null;
          if (touches(tip, head)) addition = candidate.slice(1);
          else if (touches(tip, tail)) addition = candidate.slice(0, -1).reverse();
          if (!addition) continue;
          used.add(index);
          chain = direction === 'tail' ? chain.concat(addition) : addition.reverse().concat(chain);
          extended = true;
          break;
        }
      }
    }
    chains.push(chain);
  }

  return chains;
}

export interface HighlightFragment { points: OverlayPoint[]; type?: string }

/** World units (a third of a metre each): 30 m, past the named cycle tracks beside Prins Hendrikkade (27 m) yet short of the ~35–40 m between two canal quays. */
export const PARALLEL_SPACING = 90;
const PARALLEL_COS = Math.cos(25 * Math.PI / 180);
const SAMPLE_STEP = 12;
const MIN_RUN = 30;

const ROAD_RANK: Record<string, number> = {
  motorway: 0, trunk: 0, primary: 0, secondary: 1, tertiary: 2,
  residential: 3, unclassified: 3, living_street: 3, road: 3,
  service: 4, cycleway: 5, footway: 6, path: 6, pedestrian: 6, steps: 7,
};
const rankOf = (type: string | undefined) => ROAD_RANK[type ?? ''] ?? 4;

function resample(points: OverlayPoint[]): OverlayPoint[] {
  const out: OverlayPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SAMPLE_STEP));
    for (let s = 1; s <= steps; s++) out.push({ x: a.x + (b.x - a.x) * s / steps, y: a.y + (b.y - a.y) * s / steps });
  }
  return out;
}

/**
 * The street under question as one line per carriageway-corridor.
 *
 * Every connected fragment of a name is highlighted, and Prins Hendrikkade is
 * 262 of them: two one-way carriageways, the named cycle tracks beside them
 * and service roads, all running side by side. Drawn together they are the
 * "crazy multiple blue lines" (user reports 2026-09-28). `stitchOverlayPaths`
 * rightly keeps them apart, so this runs first and keeps one.
 *
 * Starting from the fragment being ridden, the walk follows touching
 * fragments, busiest road first. The stretches of a fragment that run
 * alongside a kept line (within `spacing`, heading the same way, and
 * projecting onto it rather than beyond its end) are dropped. Continuations,
 * branches and far-apart fragments of the name all survive.
 */
export function collapseParallelFragments(
  fragments: HighlightFragment[],
  seed: HighlightFragment | null,
  spacing: number = PARALLEL_SPACING,
): OverlayPoint[][] {
  const usable = fragments.filter(fragment => fragment.points && fragment.points.length > 1);
  if (usable.length < 2) return usable.map(fragment => fragment.points.slice());
  const cellSize = spacing;
  const grid = new Map<string, Array<[OverlayPoint, OverlayPoint]>>();
  const cellOf = (x: number, y: number) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
  const accept = (run: OverlayPoint[]) => {
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1], b = run[i];
      const key = cellOf((a.x + b.x) / 2, (a.y + b.y) / 2);
      const bucket = grid.get(key);
      if (bucket) bucket.push([a, b]); else grid.set(key, [[a, b]]);
    }
  };
  const alongside = (point: OverlayPoint, dx: number, dy: number) => {
    const length = Math.hypot(dx, dy) || 1;
    const cx = Math.floor(point.x / cellSize), cy = Math.floor(point.y / cellSize);
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (const [a, b] of grid.get(`${gx},${gy}`) ?? []) {
        const ex = b.x - a.x, ey = b.y - a.y, edge = Math.hypot(ex, ey) || 1;
        if (Math.abs((ex * dx + ey * dy) / (edge * length)) < PARALLEL_COS) continue;
        const t = ((point.x - a.x) * ex + (point.y - a.y) * ey) / (edge * edge);
        if (t < 0 || t > 1) continue;
        // The node a continuation shares with the line before it.
        if (Math.min(Math.hypot(point.x - a.x, point.y - a.y), Math.hypot(point.x - b.x, point.y - b.y)) <= STITCH_TOLERANCE) continue;
        if (Math.abs((point.x - a.x) * ey - (point.y - a.y) * ex) / edge <= spacing) return true;
      }
    }
    return false;
  };
  const runsOf = (points: OverlayPoint[]): OverlayPoint[][] => {
    const samples = resample(points);
    const runs: OverlayPoint[][] = [];
    let run: OverlayPoint[] = [];
    let cut = false;
    const flush = () => {
      let length = 0;
      for (let i = 1; i < run.length; i++) length += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y);
      // Slivers left over from a cut are noise, but a short uncut fragment
      // is a link in the road: dropping it strands the walk.
      if (run.length > 1 && (length >= MIN_RUN || (!cut && run.length === samples.length))) runs.push(run);
      run = [];
    };
    samples.forEach((point, i) => {
      const before = samples[Math.max(0, i - 1)], after = samples[Math.min(samples.length - 1, i + 1)];
      if (alongside(point, after.x - before.x, after.y - before.y)) { cut = true; flush(); }
      else run.push(point);
    });
    flush();
    return runs;
  };

  const ends = new Map<string, number[]>();
  const endKey = (point: OverlayPoint) => `${Math.round(point.x / STITCH_TOLERANCE)},${Math.round(point.y / STITCH_TOLERANCE)}`;
  usable.forEach((fragment, index) => {
    for (const point of [fragment.points[0], fragment.points[fragment.points.length - 1]]) {
      const key = endKey(point);
      if (!ends.has(key)) ends.set(key, []);
      ends.get(key)!.push(index);
    }
  });
  const byPriority = usable.map((_, index) => index).sort((a, b) =>
    rankOf(usable[a].type) - rankOf(usable[b].type) || usable[b].points.length - usable[a].points.length);
  const done = new Set<number>();
  // Neighbours waiting to be walked, each with how sharply it turns off the
  // run that reached it: the straight continuation goes before a slip road,
  // or the slip road is kept and the road itself is cut beside it.
  const frontier: Array<{ index: number; turn: number }> = [];
  const kept: OverlayPoint[][] = [];
  const heading = (from: OverlayPoint, to: OverlayPoint) => Math.atan2(to.y - from.y, to.x - from.x);
  const turnBetween = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const seedIndex = seed ? usable.indexOf(seed) : -1;
  let next: number | undefined = seedIndex >= 0 ? seedIndex : byPriority[0];
  while (next !== undefined) {
    done.add(next);
    for (const run of runsOf(usable[next].points)) {
      accept(run);
      kept.push(run);
      const exits: Array<[OverlayPoint, number]> = [
        [run[0], heading(run[1], run[0])],
        [run[run.length - 1], heading(run[run.length - 2], run[run.length - 1])],
      ];
      for (const [point, outward] of exits) {
        for (const index of ends.get(endKey(point)) ?? []) {
          if (done.has(index)) continue;
          const points = usable[index].points;
          const fromStart = Math.hypot(points[0].x - point.x, points[0].y - point.y) <= STITCH_TOLERANCE;
          const onward = fromStart ? heading(points[0], points[1]) : heading(points[points.length - 1], points[points.length - 2]);
          frontier.push({ index, turn: turnBetween(outward, onward) });
        }
      }
    }
    frontier.sort((a, b) => rankOf(usable[a.index].type) - rankOf(usable[b.index].type) || a.turn - b.turn);
    let candidate: number | undefined;
    while (frontier.length && candidate === undefined) {
      const { index } = frontier.shift()!;
      if (!done.has(index)) candidate = index;
    }
    next = candidate ?? byPriority.find(index => !done.has(index));
  }
  return kept;
}
