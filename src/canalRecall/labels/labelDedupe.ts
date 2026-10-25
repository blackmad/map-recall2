// One label per place. The POI label overlay (labelOverlay.ts) gathers its
// candidates from three sources that describe some places twice:
//  - the game's landmarks (English Wikipedia names: "Berlage's Stock Market",
//    "Central Station"),
//  - the OSM orientation POIs (Dutch names: "Beurs van Berlage", "Centraal
//    Station", twice — two station nodes 470 m apart),
//  - landmarks that are parts of another landmark's building ("Cuypersgebouw"
//    inside Central Station's footprint).
// Player feedback 2026-10-25: "why do I have two labels on screen for
// berlage?" and "lots of double POI labels on screen" (Centraal Station).
//
// Pure. Candidates are dropped, never renamed: the survivor of a pair is the
// one the overlay would have ranked first anyway (destination, landmark,
// culture, civic, venue; then source rank).

import type { LabelCandidate, LabelClass } from './labelPlan';

/** Similar names this close (metres) are one place: a POI node a few metres off its landmark's centroid. */
export const SIMILAR_NAME_NEAR_M = 60;
/** The same name (normalised) this close is one place for non-venues: OSM maps big stations and museums as several nodes. */
export const SAME_NAME_NEAR_M = 600;
/** Venues (shops, cafés) share names across a city (chains), so identical venue names merge only this close. */
export const SAME_VENUE_NEAR_M = 40;
/**
 * A landmark footprint larger than this (m²) is an area, not one building:
 * measured, Central Station 58,771 m² (a building, with the Cuypersgebouw in
 * it), De Wallen 64,775 m², Artis 132,749 m², the Canal Ring 1.97 km².
 */
export const BUILDING_MAX_AREA_M2 = 60_000;
/** A landmark inside another's building is a part of it ("Cuypersgebouw" in Central Station) when it ranks below this share of it. */
export const PART_RANK_SHARE = 0.5;
/** A footprint test with this slack (metres): POI nodes sit on the facade line. */
export const FOOTPRINT_SLACK_M = 8;

/** Words that say what a place is, not which one: "Centraal Station" and "Ibis Central Station" share only the kind. */
const GENERIC = new Set([
  'amsterdam', 'station', 'centraal', 'central', 'kerk', 'church', 'museum', 'hotel', 'park', 'plein', 'square', 'bridge', 'brug',
  'house', 'huis', 'gebouw', 'building', 'market', 'markt', 'cafe', 'bar', 'restaurant', 'theater', 'theatre', 'school',
  'centrum', 'centre', 'center', 'tower', 'toren', 'gate', 'poort', 'palace', 'paleis', 'stock', 'exchange', 'beurs', 'hall',
  'zaal', 'hof', 'oude', 'nieuwe', 'old', 'new', 'grand', 'royal', 'koninklijk', 'national', 'nationaal',
]);
const STOP = new Set(['van', 'de', 'der', 'den', 'het', 'the', 'of', 'and', 'en', 'in', 'op', 'aan', 'bij', 'la', 'le', 's', 't', 'voor', 'met', 'over', 'naar', 'for', 'with']);
/** Town and district names: "Museum Weesp" and "Stadsloket Weesp" are two places. */
const PLACE_WORDS = new Set([
  'weesp', 'noord', 'oost', 'zuid', 'west', 'zuidoost', 'nieuw', 'jordaan', 'pijp', 'ijburg', 'amstel', 'amstelveen', 'diemen',
  'zaandam', 'haarlem', 'spaarndam', 'aalsmeer', 'duivendrecht', 'halfweg', 'landsmeer', 'zwanenburg', 'osdorp', 'slotervaart',
  'bijlmer', 'watergraafsmeer', 'centrum', 'location', 'locatie',
]);

/** Lower-case words without accents, punctuation or the possessive 's. */
export function nameWords(name: string): string[] {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’]s\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

/** The name normalised whole, for same-name tests. */
export function nameKey(name: string): string {
  return nameWords(name).join(' ');
}

function within1Edit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Two names for one place: identical once normalised, or sharing a
 * distinctive word ("Berlage's Stock Market" / "Beurs van Berlage"), one
 * spelling apart for long words ("Centraal" / "Central" are generic, but
 * "Rijksmuseum" / "Rijksmusem" would match). Generic words alone never match.
 */
export function similarNames(a: string, b: string): boolean {
  const ka = nameKey(a), kb = nameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // The same words in another spelling or language: "Centraal Station" / "Central Station".
  const xa = ka.split(' '), xb = kb.split(' ');
  if (xa.length === xb.length && xa.some(w => w.length >= 4) && xa.every((w, i) => w.length >= 4 ? within1Edit(w, xb[i]) : w === xb[i])) return true;
  const distinctive = (w: string) => w.length >= 4 && !GENERIC.has(w) && !STOP.has(w) && !PLACE_WORDS.has(w);
  const wa = ka.split(' ').filter(distinctive), wb = kb.split(' ').filter(distinctive);
  for (const x of wa) for (const y of wb) {
    if (x === y) return true;
    if (x.length >= 7 && y.length >= 7 && within1Edit(x, y)) return true;
  }
  return false;
}

const CLASS_ORDER: Record<LabelClass, number> = { destination: 4, landmark: 3, culture: 2, civic: 1, venue: 0 };

/** Positive when `a` should win over `b`. */
function outranks(a: LabelCandidate, b: LabelCandidate): number {
  return (CLASS_ORDER[a.cls] - CLASS_ORDER[b.cls]) || (a.rank - b.rank) || (a.id < b.id ? 1 : -1);
}

type Polygon = { type: string; coordinates: unknown };

function metresPerLng(lat: number): number { return 111320 * Math.cos(lat * Math.PI / 180); }
function distanceM(a: LabelCandidate, b: LabelCandidate): number {
  return Math.hypot((a.lng - b.lng) * metresPerLng((a.lat + b.lat) / 2), (a.lat - b.lat) * 111320);
}

function ringContains(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Inside the footprint, or within `slackM` of its outline. */
export function nearFootprint(geometry: Polygon | undefined, lng: number, lat: number, slackM = FOOTPRINT_SLACK_M): boolean {
  if (!geometry) return false;
  const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []) as number[][][][];
  const k = metresPerLng(lat);
  for (const rings of polygons) {
    const ring = rings?.[0];
    if (!ring || ring.length < 3) continue;
    if (ringContains(ring, lng, lat)) return true;
    for (let i = 0; i + 1 < ring.length; i++) {
      const ax = (ring[i][0] - lng) * k, ay = (ring[i][1] - lat) * 111320;
      const bx = (ring[i + 1][0] - lng) * k, by = (ring[i + 1][1] - lat) * 111320;
      const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      const t = len > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
      if (Math.hypot(ax + t * dx, ay + t * dy) <= slackM) return true;
    }
  }
  return false;
}

export interface DedupeResult<T> {
  kept: T[];
  /** Each dropped candidate with the one that kept its place and why. */
  dropped: Array<{ dropped: T; keptId: string; reason: 'same-name' | 'similar-name' | 'inside-landmark' }>;
}

/**
 * Drop the second label of a place. `footprints` maps a landmark candidate's
 * id to its building outline (lng/lat).
 *  - same name (normalised) within SAME_NAME_NEAR_M (venues: SAME_VENUE_NEAR_M);
 *  - similar names within SIMILAR_NAME_NEAR_M, or inside/at the winner's footprint (not for venues: a café named after the building it is in is its own place);
 *  - a landmark inside another landmark's footprint (one label per building).
 */
export function dedupeLabelCandidates<T extends LabelCandidate>(candidates: readonly T[], footprints: ReadonlyMap<string, unknown> = new Map()): DedupeResult<T> {
  const order = candidates.map((c, i) => ({ c, i })).sort((a, b) => outranks(b.c, a.c) || a.i - b.i);
  const cell = SIMILAR_NAME_NEAR_M, kLng = metresPerLng(52.37);
  const cellOf = (c: LabelCandidate): [number, number] => [Math.floor(c.lng * kLng / cell), Math.floor(c.lat * 111320 / cell)];
  const near = new Map<string, T[]>();
  const byName = new Map<string, T[]>();
  /** Kept landmarks with a footprint, and the footprint's box grown by the slack (lng/lat). */
  const buildings: Array<{ c: T; foot: Polygon; box: [number, number, number, number] }> = [];
  const keep = new Set<T>();
  const dropped: DedupeResult<T>['dropped'] = [];
  const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };
  for (const { c } of order) {
    let found: { w: T; reason: DedupeResult<T>['dropped'][number]['reason'] } | null = null;
    const key = nameKey(c.name);
    for (const w of byName.get(key) || []) {
      const limit = c.cls === 'venue' && w.cls === 'venue' ? SAME_VENUE_NEAR_M : SAME_NAME_NEAR_M;
      if (distanceM(w, c) <= limit) { found = { w, reason: 'same-name' }; break; }
    }
    if (!found && c.cls !== 'venue') {
      const [cx, cy] = cellOf(c);
      search: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const w of near.get(`${cx + dx},${cy + dy}`) || []) {
          // Two names for one place come from two sources: the game's landmark (English) and an OSM POI (Dutch).
          if ((w.cls === 'landmark' || c.cls === 'landmark') && distanceM(w, c) <= SIMILAR_NAME_NEAR_M && similarNames(w.name, c.name)) { found = { w, reason: 'similar-name' }; break search; }
        }
      }
    }
    if (!found && c.cls !== 'venue') {
      for (const b of buildings) {
        if (c.lng < b.box[0] || c.lng > b.box[2] || c.lat < b.box[1] || c.lat > b.box[3]) continue;
        // A minor landmark that is part of a major one's building, or another name for it.
        const part = c.cls === 'landmark' && footprints.has(c.id) && c.rank < PART_RANK_SHARE * b.c.rank;
        if (!part && !similarNames(b.c.name, c.name)) continue;
        if (nearFootprint(b.foot, c.lng, c.lat)) { found = { w: b.c, reason: part ? 'inside-landmark' : 'similar-name' }; break; }
      }
    }
    if (found && c.cls !== 'destination') { dropped.push({ dropped: c, keptId: found.w.id, reason: found.reason }); continue; }
    keep.add(c);
    push(byName, key, c);
    const [cx, cy] = cellOf(c);
    push(near, `${cx},${cy}`, c);
    const foot = footprints.get(c.id) as Polygon | undefined;
    if (foot && c.cls === 'landmark') {
      const box = footprintBox(foot);
      if (box && footprintAreaM2(foot) <= BUILDING_MAX_AREA_M2) {
        const sx = FOOTPRINT_SLACK_M / metresPerLng(c.lat), sy = FOOTPRINT_SLACK_M / 111320;
        buildings.push({ c, foot, box: [box[0] - sx, box[1] - sy, box[2] + sx, box[3] + sy] });
      }
    }
  }
  return { kept: candidates.filter(c => keep.has(c)), dropped };
}

function footprintBox(geometry: Polygon): [number, number, number, number] | null {
  const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []) as number[][][][];
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const rings of polygons) for (const [x, y] of rings?.[0] || []) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return w <= e ? [w, s, e, n] : null;
}

/** Area of a footprint's outer rings, m². */
export function footprintAreaM2(geometry: Polygon): number {
  const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []) as number[][][][];
  let total = 0;
  for (const rings of polygons) {
    const ring = rings?.[0] || [];
    if (ring.length < 3) continue;
    const k = metresPerLng(ring[0][1]);
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * k * ring[i][1] * 111320 - ring[i][0] * k * ring[j][1] * 111320;
    total += Math.abs(a) / 2;
  }
  return total;
}
