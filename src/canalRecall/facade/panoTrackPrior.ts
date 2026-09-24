/** Coarse boresight prior from the GPS track between neighbouring panoramas.
 *
 * Every stitched Amsterdam panorama carries a small absolute-orientation
 * (boresight) error of roughly 0.5-5°. The stored `heading` is the vehicle
 * forward direction, but the true direction of travel can be estimated from the
 * displacement between consecutive panoramas on the same track. The difference
 * between the two, taken modulo 180° because forward/backward is ambiguous, is a
 * prior for the boresight. It is noisy (GPS ~1 m over ~5 m pano spacing, so
 * ~10°) but enough to constrain a search. This is a diagnostic estimate, not a
 * certification.
 */

export interface PanoFix {
  panoramaId: string;
  lngLat: [number, number];
  headingDeg: number;
}

export interface TrackPrior {
  panoramaId: string;
  priorYawDeg: number;
  trackBearingDeg: number | null;
  storedHeadingDeg: number;
  neighbours: number;
  confidence: 'high' | 'low' | 'none';
}

const EARTH_RADIUS_M = 6371000;
const ID_PATTERN = /^(.*?)[_-](\d+)$/;
const MIN_HIGH_CONFIDENCE_SPAN_M = 3;

interface ParsedPanoId {
  prefix: string;
  seq: number;
}

interface NeighbourEntry {
  fix: PanoFix;
  id: ParsedPanoId;
}

function parsePanoId(panoramaId: string): ParsedPanoId | null {
  const match = ID_PATTERN.exec(panoramaId);
  if (!match) return null;
  return { prefix: match[1], seq: Number(match[2]) };
}

/** Per-prefix id index, cached by array identity so bulk callers stay linear. */
const prefixIndexCache = new WeakMap<PanoFix[], Map<string, NeighbourEntry[]>>();

function indexByPrefix(fixes: PanoFix[]): Map<string, NeighbourEntry[]> {
  const cached = prefixIndexCache.get(fixes);
  if (cached) return cached;
  const index = new Map<string, NeighbourEntry[]>();
  for (const fix of fixes) {
    const id = parsePanoId(fix.panoramaId);
    if (!id) continue;
    const list = index.get(id.prefix);
    if (list) list.push({ fix, id });
    else index.set(id.prefix, [{ fix, id }]);
  }
  for (const list of index.values()) list.sort((a, b) => a.id.seq - b.id.seq);
  prefixIndexCache.set(fixes, index);
  return index;
}

/** Local east/north metre offsets between two WGS84 points. */
function localDelta(a: [number, number], b: [number, number]): { east: number; north: number } {
  const meanLatRad = ((a[1] + b[1]) / 2) * Math.PI / 180;
  const north = (b[1] - a[1]) * Math.PI / 180 * EARTH_RADIUS_M;
  const east = (b[0] - a[0]) * Math.PI / 180 * EARTH_RADIUS_M * Math.cos(meanLatRad);
  return { east, north };
}

/** Compass bearing in [0, 360) from `from` to `to` using a local flat-earth fit. */
export function trackBearingDeg(from: [number, number], to: [number, number]): number {
  const { east, north } = localDelta(from, to);
  const bearing = Math.atan2(east, north) * 180 / Math.PI;
  return (bearing % 360 + 360) % 360;
}

/** Wrap a yaw difference into (-90, 90], resolving the forward/backward ambiguity. */
function wrapToHalfTurn(deg: number): number {
  let wrapped = ((deg % 180) + 180) % 180;
  if (wrapped > 90) wrapped -= 180;
  return wrapped;
}

function distanceM(a: [number, number], b: [number, number]): number {
  const { east, north } = localDelta(a, b);
  return Math.hypot(east, north);
}

const round = (value: number, digits = 3): number => Number(value.toFixed(digits));

/** Total-least-squares (PCA) bearing over a set of fixes, oriented along sequence. */
function fitBearing(points: [number, number][]): number {
  if (points.length < 2) return 0;
  const origin = points[0];
  const deltas = points.map((point) => localDelta(origin, point));
  let sxx = 0, sxy = 0, syy = 0;
  for (const d of deltas) { sxx += d.east * d.east; sxy += d.east * d.north; syy += d.north * d.north; }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let dx = Math.cos(theta), dy = Math.sin(theta);
  const last = deltas[deltas.length - 1];
  if (dx * last.east + dy * last.north < 0) { dx = -dx; dy = -dy; }
  return (Math.atan2(dx, dy) * 180 / Math.PI % 360 + 360) % 360;
}

/** Coarse boresight prior for `target` derived from the GPS track of its neighbours.
 * `window` is the number of same-track neighbours on each side; a longer baseline
 * (e.g. 3) averages out GPS noise but is more sensitive to a curving road. */
export function trackPriorFor(target: string, fixes: PanoFix[], options: { window?: number } = {}): TrackPrior {
  const targetFix = fixes.find((fix) => fix.panoramaId === target) ?? null;
  const storedHeadingDeg = targetFix ? targetFix.headingDeg : 0;
  const none: TrackPrior = {
    panoramaId: target,
    priorYawDeg: 0,
    trackBearingDeg: null,
    storedHeadingDeg,
    neighbours: 0,
    confidence: 'none',
  };
  const targetId = parsePanoId(target);
  if (!targetId || !targetFix) return none;

  const all = indexByPrefix(fixes).get(targetId.prefix) ?? [];
  const targetIndex = all.findIndex((entry) => entry.fix.panoramaId === target);
  if (targetIndex < 0) return none;

  const window = Math.max(1, Math.floor(options.window ?? 1));
  const from = Math.max(0, targetIndex - window);
  const to = Math.min(all.length - 1, targetIndex + window);
  const entries = all.slice(from, to + 1);
  const neighbours = entries.length - 1;
  if (neighbours === 0) return none;

  let trackBearing: number;
  if (window > 1 && entries.length >= 3) {
    trackBearing = fitBearing(entries.map((entry) => entry.fix.lngLat));
  } else {
    const prev = all[targetIndex - 1] ?? null;
    const next = all[targetIndex + 1] ?? null;
    const fromPoint = prev ? prev.fix.lngLat : targetFix.lngLat;
    const toPoint = next ? next.fix.lngLat : targetFix.lngLat;
    trackBearing = trackBearingDeg(fromPoint, toPoint);
  }

  const spanM = distanceM(entries[0].fix.lngLat, entries[entries.length - 1].fix.lngLat);
  const priorYaw = wrapToHalfTurn(storedHeadingDeg - trackBearing);
  const confidence: TrackPrior['confidence'] = neighbours >= 2 && spanM >= MIN_HIGH_CONFIDENCE_SPAN_M ? 'high' : 'low';

  return {
    panoramaId: target,
    priorYawDeg: round(priorYaw),
    trackBearingDeg: round(trackBearing),
    storedHeadingDeg: round(storedHeadingDeg),
    neighbours,
    confidence,
  };
}

/** Convenience wrapper returning only the numeric boresight prior for one panorama. */
export function boresightPriorDeg(fixes: PanoFix[], panoramaId: string): number {
  return trackPriorFor(panoramaId, fixes).priorYawDeg;
}
