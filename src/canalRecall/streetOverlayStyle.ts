export const STREET_OVERLAY_LAYER_IDS = [
  'active-street-casing',
  'active-street-glow',
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
      id: 'active-street-casing', type: 'line', source: 'active-street',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#071E2B', 'line-width': zoomWidth(5, 16), 'line-opacity': 0.78 },
    },
    {
      id: 'active-street-glow', type: 'line', source: 'active-street',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#7DD3FC', 'line-width': zoomWidth(5, 14), 'line-opacity': 0.42, 'line-blur': 3 },
    },
    {
      id: 'active-street-line', type: 'line', source: 'active-street',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#38BDF8', 'line-width': zoomWidth(2, 6), 'line-opacity': 0.96 },
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
  const usable = paths.filter(path => path && path.length > 1);
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
