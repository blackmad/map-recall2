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
  // The extract stores most ways twice (grouped and original). A copy sits
  // exactly on the kept line's nodes, so drop exact duplicates first.
  const seenGeometry = new Set<string>();
  const usable = fragments.filter(fragment => {
    if (!fragment.points || fragment.points.length < 2) return false;
    if (fragment === seed) return true;
    const forward = fragment.points.map(point => `${point.x},${point.y}`).join(';');
    const reverse = fragment.points.slice().reverse().map(point => `${point.x},${point.y}`).join(';');
    const key = forward < reverse ? forward : reverse;
    if (seenGeometry.has(key)) return false;
    seenGeometry.add(key);
    return true;
  });
  if (seed && seed.points && seed.points.length > 1) {
    // The seed wins over its own duplicate, wherever it sits in the list.
    const seedKey = [seed.points, seed.points.slice().reverse()]
      .map(points => points.map(point => `${point.x},${point.y}`).join(';')).sort()[0];
    for (let i = usable.length - 1; i >= 0; i--) {
      const fragment = usable[i];
      if (fragment === seed) continue;
      const key = [fragment.points, fragment.points.slice().reverse()]
        .map(points => points.map(point => `${point.x},${point.y}`).join(';')).sort()[0];
      if (key === seedKey) usable.splice(i, 1);
    }
  }
  if (usable.length < 2) return usable.map(fragment => fragment.points.slice());
  const cellSize = spacing;
  // Each kept edge, and whether its ends are the ends of a kept run (a real
  // shared node a continuation may start from).
  const grid = new Map<string, Array<[OverlayPoint, OverlayPoint, boolean, boolean]>>();
  const cellOf = (x: number, y: number) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
  const accept = (run: OverlayPoint[]) => {
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1], b = run[i];
      const key = cellOf((a.x + b.x) / 2, (a.y + b.y) / 2);
      const edge: [OverlayPoint, OverlayPoint, boolean, boolean] = [a, b, i === 1, i === run.length - 1];
      const bucket = grid.get(key);
      if (bucket) bucket.push(edge); else grid.set(key, [edge]);
    }
  };
  const alongside = (point: OverlayPoint, dx: number, dy: number) => {
    const length = Math.hypot(dx, dy) || 1;
    const cx = Math.floor(point.x / cellSize), cy = Math.floor(point.y / cellSize);
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (const [a, b, aIsEnd, bIsEnd] of grid.get(`${gx},${gy}`) ?? []) {
        const ex = b.x - a.x, ey = b.y - a.y, edge = Math.hypot(ex, ey) || 1;
        if (Math.abs((ex * dx + ey * dy) / (edge * length)) < PARALLEL_COS) continue;
        const t = ((point.x - a.x) * ex + (point.y - a.y) * ey) / (edge * edge);
        if (t < 0 || t > 1) continue;
        // The node a continuation shares with the line before it.
        if ((aIsEnd && Math.hypot(point.x - a.x, point.y - a.y) <= STITCH_TOLERANCE)
          || (bIsEnd && Math.hypot(point.x - b.x, point.y - b.y) <= STITCH_TOLERANCE)) continue;
        if (Math.abs((point.x - a.x) * ey - (point.y - a.y) * ex) / edge <= spacing) return true;
      }
    }
    return false;
  };
  const runsOf = (points: OverlayPoint[]): Array<OverlayPoint[] & { whole?: boolean }> => {
    const samples = resample(points);
    const runs: OverlayPoint[][] = [];
    let run: OverlayPoint[] = [];
    let cut = false;
    const flush = () => {
      let length = 0;
      for (let i = 1; i < run.length; i++) length += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y);
      // Slivers left over from a cut are noise, but a short uncut fragment
      // is a link in the road: dropping it strands the walk.
      const whole = !cut && run.length === samples.length;
      if (run.length > 1 && (length >= MIN_RUN || whole)) runs.push(Object.assign(run, { whole }));
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
  const heading = (from: OverlayPoint, to: OverlayPoint) => Math.atan2(to.y - from.y, to.x - from.x);
  const turnBetween = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const seedIndex = seed ? usable.indexOf(seed) : -1;
  // The spine: the longest course through the name's own network that runs
  // through the ridden fragment. It is drawn whole and never pruned, so the
  // line under the rider is continuous; everything else is a candidate branch
  // cut against it. A diamond's other sides run beside the spine and are cut.
  const spine = spineThrough(usable, seedIndex >= 0 ? seedIndex : byPriority[0], endKey);
  const onSpine = new Set(spine);
  const walk = (excluded: Set<number>): Piece[] => {
    const done = new Set<number>(excluded);
    grid.clear();
    // Neighbours waiting to be walked, each with how sharply it turns off the
    // run that reached it: the straight continuation goes before a slip road,
    // or the slip road is kept and the road itself is cut beside it.
    const frontier: Array<{ index: number; turn: number }> = [];
    const kept: Piece[] = [];
    const visit = (index: number, whole: boolean) => {
      done.add(index);
      const runs = whole ? [Object.assign(resample(usable[index].points), { whole: true })] : runsOf(usable[index].points);
      for (const run of runs) {
        accept(run);
        kept.push({ points: run, index, whole: Boolean(run.whole) });
        const exits: Array<[OverlayPoint, number]> = [
          [run[0], heading(run[1], run[0])],
          [run[run.length - 1], heading(run[run.length - 2], run[run.length - 1])],
        ];
        for (const [point, outward] of exits) {
          for (const neighbour of ends.get(endKey(point)) ?? []) {
            if (done.has(neighbour)) continue;
            const points = usable[neighbour].points;
            const fromStart = Math.hypot(points[0].x - point.x, points[0].y - point.y) <= STITCH_TOLERANCE;
            const onward = fromStart ? heading(points[0], points[1]) : heading(points[points.length - 1], points[points.length - 2]);
            frontier.push({ index: neighbour, turn: turnBetween(outward, onward) });
          }
        }
      }
    };
    for (const index of spine) visit(index, true);
    for (;;) {
      frontier.sort((a, b) => rankOf(usable[a.index].type) - rankOf(usable[b.index].type) || a.turn - b.turn);
      let candidate: number | undefined;
      while (frontier.length && candidate === undefined) {
        const { index } = frontier.shift()!;
        if (!done.has(index)) candidate = index;
      }
      const next = candidate ?? byPriority.find(index => !done.has(index));
      if (next === undefined) break;
      visit(next, false);
    }
    return kept;
  };
  // Fork arms that lead only to cut lines are left out and the walk rerun
  // (see findStubs); rerun rather than erased, because in the first walk an
  // arm may already have cut the start of a branch beside it.
  const excluded = new Set<number>();
  let pieces = walk(excluded);
  for (let pass = 0; pass < 4; pass++) {
    const stubs = findStubs(pieces, onSpine, spacing);
    if (!stubs.length) break;
    for (const index of stubs) excluded.add(index);
    pieces = walk(excluded);
  }
  return pieces.map(piece => piece.points);
}

/**
 * The fragments, in order, of the longest course through `seed`: shortest
 * paths from each end of the seed to the node on that end's side that lies
 * farthest from the other end.
 * A node belongs to the side whose end is nearer, so the two halves cannot
 * both run off the same way (through the far side of a diamond).
 */
function spineThrough(
  fragments: HighlightFragment[],
  seed: number | undefined,
  endKey: (point: OverlayPoint) => string,
): number[] {
  if (seed === undefined || !fragments[seed]) return [];
  const lengthOf = (points: OverlayPoint[]) => {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    return total;
  };
  const edges = fragments.map((fragment, index) => ({
    index,
    a: endKey(fragment.points[0]),
    b: endKey(fragment.points[fragment.points.length - 1]),
    length: lengthOf(fragment.points),
  }));
  const position = new Map<string, OverlayPoint>();
  fragments.forEach((fragment, index) => {
    position.set(edges[index].a, fragment.points[0]);
    position.set(edges[index].b, fragment.points[fragment.points.length - 1]);
  });
  const adjacency = new Map<string, typeof edges>();
  for (const edge of edges) {
    for (const node of [edge.a, edge.b]) {
      if (!adjacency.has(node)) adjacency.set(node, []);
      adjacency.get(node)!.push(edge);
    }
  }
  const shortest = (from: string) => {
    const distance = new Map<string, number>([[from, 0]]);
    const via = new Map<string, (typeof edges)[number]>();
    const open = new Set<string>([from]);
    while (open.size) {
      let node = '', best = Infinity;
      for (const candidate of open) {
        const d = distance.get(candidate)!;
        if (d < best) { best = d; node = candidate; }
      }
      open.delete(node);
      for (const edge of adjacency.get(node) ?? []) {
        if (edge.index === seed) continue;
        const other = edge.a === node ? edge.b : edge.a;
        const d = best + edge.length;
        if (d < (distance.get(other) ?? Infinity)) {
          distance.set(other, d);
          via.set(other, edge);
          open.add(other);
        }
      }
    }
    return { distance, via };
  };
  const start = edges[seed].a, end = edges[seed].b;
  const fromStart = shortest(start), fromEnd = shortest(end);
  // The far end of each half is the node on that side farthest in a straight
  // line from the seed's other end. By path length it was often the loose end
  // of the opposite one-way line, reached by going round the pair and back
  // (Martelaarsgracht), which put both lines on the spine.
  const half = (own: ReturnType<typeof shortest>, other: ReturnType<typeof shortest>, origin: string, awayFrom: string) => {
    const anchor = position.get(awayFrom)!;
    let far = origin, farthest = -1;
    for (const [node, d] of own.distance) {
      if (d >= (other.distance.get(node) ?? Infinity)) continue;
      const point = position.get(node)!;
      const reach = Math.hypot(point.x - anchor.x, point.y - anchor.y);
      if (reach > farthest) { far = node; farthest = reach; }
    }
    const path: number[] = [];
    for (let node = far; node !== origin;) {
      const edge = own.via.get(node);
      if (!edge) break;
      path.push(edge.index);
      node = edge.a === node ? edge.b : edge.a;
    }
    return path;
  };
  const before = half(fromStart, fromEnd, start, end).reverse();
  const after = half(fromEnd, fromStart, end, start);
  return [...new Set([...before, seed, ...after])];
}


/** World units: pieces shorter than this (45 m) may be stubs. */
const STUB_LENGTH = 135;

type Piece = { points: OverlayPoint[]; index: number; whole: boolean };

/**
 * The fork arms among the kept pieces. At a bridge the carriageways split into
 * a diamond of short ways; the parallel sides are cut, but the angled
 * connector arms (8 m each) are neither beside a kept line nor past its end,
 * so they survived as a fan of stubs (Raadhuisstraat, user report
 * 2026-09-28). An arm is a whole, uncut fragment shorter than 45 m that lies
 * wholly within `spacing` of the other pieces and has a loose end: it leads
 * only to a line that was cut. A link joining two drawn pieces touches them at
 * both ends and stays; a cut run is never an arm, since its loose end is
 * where it was cut, not where it leads.
 */
function findStubs(pieces: Piece[], protectedFragments: Set<number>, spacing: number): number[] {
  const lengthOf = (path: OverlayPoint[]) => {
    let total = 0;
    for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    return total;
  };
  const distanceToPath = (point: OverlayPoint, path: OverlayPoint[]) => {
    let best = Infinity;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const ex = b.x - a.x, ey = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * ex + (point.y - a.y) * ey) / (ex * ex + ey * ey || 1)));
      best = Math.min(best, Math.hypot(point.x - a.x - ex * t, point.y - a.y - ey * t));
    }
    return best;
  };
  const stubs: number[] = [];
  pieces.forEach((piece, position) => {
    if (!piece.whole || protectedFragments.has(piece.index) || lengthOf(piece.points) >= STUB_LENGTH) return;
    const others = pieces.filter((_, other) => other !== position).map(other => other.points);
    if (!others.length) return;
    const touches = (point: OverlayPoint) => others.some(other => distanceToPath(point, other) <= STITCH_TOLERANCE);
    if (touches(piece.points[0]) && touches(piece.points[piece.points.length - 1])) return;
    if (!piece.points.every(point => others.some(other => distanceToPath(point, other) <= spacing))) return;
    stubs.push(piece.index);
  });
  return stubs;
}

/**
 * The same-name way to seed the highlight from when the route line is shown:
 * the fragment the route runs along, not the one the rider's position matched.
 * Damrak, Raadhuisstraat and Prins Hendrikkade are each a carriageway, a tram
 * way and named cycle tracks; the router prefers the cycle track, the position
 * often matched the carriageway, and the highlight ran beside the route line
 * instead of on it (user report 2026-10-01, "the street highlight and the road
 * line are different"). Returns `seed` unless another fragment lies clearly
 * nearer the route (mean distance of its points, within `maxDistance`).
 */
export function seedNearestRoute<T extends HighlightFragment>(
  fragments: readonly T[],
  seed: T | null,
  route: readonly OverlayPoint[] | null | undefined,
  maxDistance: number = 12,
): T | null {
  if (!route || route.length < 2 || fragments.length < 2) return seed;
  const distanceToRoute = (point: OverlayPoint) => {
    let best = Infinity;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
      best = Math.min(best, Math.hypot(a.x + dx * t - point.x, a.y + dy * t - point.y));
    }
    return best;
  };
  const meanDistance = (fragment: T) => {
    if (!fragment.points || fragment.points.length < 2) return Infinity;
    let sum = 0;
    for (const point of fragment.points) sum += distanceToRoute(point);
    return sum / fragment.points.length;
  };
  let best = seed, bestDistance = seed ? meanDistance(seed) : Infinity;
  const seedDistance = bestDistance;
  for (const fragment of fragments) {
    if (fragment === seed) continue;
    const distance = meanDistance(fragment);
    if (distance < bestDistance) { best = fragment; bestDistance = distance; }
  }
  if (best === seed || bestDistance > maxDistance || bestDistance > seedDistance - 3) return seed;
  return best;
}

/** Source the just-answered street's name is painted from. */
export const ANSWERED_STREET_SOURCE_ID = 'answered-street';
/** Seconds the answered name stays painted on the street. */
export const ANSWERED_STREET_SECONDS = 6;

/**
 * The answered street's name, painted in big letters on the street ahead,
 * green when right and red when missed (user request 2026-10-01: "after I get
 * a street right or wrong ... in big letters on the street ahead of me to
 * reinforce it"). Its source is filled only after the answer, never while the
 * question is open, so it cannot give an answer away.
 */
export function answeredStreetNameLayer(): Record<string, unknown> {
  // Road lettering: flat on the street, each letter's top pointing along the
  // direction of travel so it reads from the saddle. Run along the line it
  // read sideways; standing upright as big green labels it looked like a
  // debug overlay ("these are hideous", 2026-10-01). Cream like road paint;
  // the right/wrong colour is only the edge.
  return {
    id: 'answered-street-name', type: 'symbol', source: ANSWERED_STREET_SOURCE_ID,
    layout: {
      'text-field': ['upcase', ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['exponential', 2], ['zoom'], 15, 6, 18, 48, 20, 192],
      'text-letter-spacing': 0.1,
      'text-rotate': ['get', 'bearing'],
      'text-pitch-alignment': 'map',
      'text-rotation-alignment': 'map',
      'text-keep-upright': false,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#FBF7EC',
      'text-opacity': 0.92,
      'text-halo-color': ['case', ['get', 'correct'], '#15803D', '#B91C1C'],
      'text-halo-width': 1.4,
    },
  };
}

/** px along the answered street, ahead of the rider, where its name stands. */
export const ANSWERED_STREET_AHEAD = [120] as const;

/**
 * Points `distances` ahead of the rider along the polyline nearest them,
 * walking whichever way the heading points. Fewer when the street ends first.
 * `angle` is the direction of travel there (world radians, y down).
 */
export function pointsAheadOnChains(
  chains: readonly (readonly OverlayPoint[])[],
  rider: Readonly<{ x: number; y: number; angle: number }>,
  distances: readonly number[] = ANSWERED_STREET_AHEAD,
): Array<OverlayPoint & { angle: number }> {
  let best: { chain: readonly OverlayPoint[]; index: number; t: number; dist: number } | null = null;
  for (const chain of chains) {
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i], b = chain[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((rider.x - a.x) * dx + (rider.y - a.y) * dy) / lengthSquared));
      const dist = Math.hypot(a.x + dx * t - rider.x, a.y + dy * t - rider.y);
      if (!best || dist < best.dist) best = { chain, index: i, t, dist };
    }
  }
  if (!best) return [];
  const { chain, index, t } = best;
  const a = chain[index], b = chain[index + 1];
  const forward = (b.x - a.x) * Math.cos(rider.angle) + (b.y - a.y) * Math.sin(rider.angle) >= 0;
  const start = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const path: OverlayPoint[] = [start];
  if (forward) for (let i = index + 1; i < chain.length; i++) path.push(chain[i]);
  else for (let i = index; i >= 0; i--) path.push(chain[i]);
  const out: Array<OverlayPoint & { angle: number }> = [];
  const wanted = [...distances].sort((x, y) => x - y);
  let travelled = 0, next = 0;
  for (let i = 1; i < path.length && next < wanted.length; i++) {
    const p = path[i - 1], q = path[i];
    const step = Math.hypot(q.x - p.x, q.y - p.y);
    while (next < wanted.length && travelled + step >= wanted[next]) {
      const f = step ? (wanted[next] - travelled) / step : 0;
      out.push({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, angle: Math.atan2(q.y - p.y, q.x - p.x) });
      next++;
    }
    travelled += step;
  }
  return out;
}
