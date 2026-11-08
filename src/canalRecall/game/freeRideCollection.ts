// Free Ride's collection (G4, issue #274): every neighbourhood has a short
// checklist of the places worth a card inside it; the postcard and the
// plaque say "3 of 9 places", the radar marks the ones not yet opened, and
// opening all of them stamps the neighbourhood in the passport — the first
// stamp a rider can earn without a quiz. A discovery token, a small enamel
// coin, sits on the nearest landmark not yet opened; tapping it or riding
// through it opens the card.
//
// This file is the decision half: which places make a neighbourhood's list,
// how far along it is, the copy, what is remembered between rides, which
// landmark carries the token, how big and how faint a marker is at a
// distance, and where the riding corridor runs on screen so the token never
// sits on it. No canvas, DOM or Game instance; tested in
// `freeRideCollection.test.ts`. The browser half is `freeRideRuntime.ts`.
//
// `?collection=0` turns all of it off and restores the Free Ride of before.

import type { WorldPoint } from './worldTypes';
import type { NeighborhoodPassport } from './neighborhoodPassport';

export const COLLECTION_STORAGE_KEY = 'canalRecall.freeRideCollection.v1';

/** A neighbourhood's list holds its most prominent places, at most this many:
 *  enough for a short ride round the block, never a chore. */
export const CHECKLIST_MAX_PLACES = 9;
/** A neighbourhood with fewer places than this has no list (one landmark is
 *  a postcard, not a collection). */
export const CHECKLIST_MIN_PLACES = 2;

/** The token sits on the nearest landmark not yet opened, this close at most. */
export const TOKEN_RADIUS_M = 320;
/** Riding within this of the token's landmark opens its card. */
export const TOKEN_RIDE_THROUGH_M = 22;
/** The coin's diameter on screen: near, far, and the hard cap. */
export const TOKEN_NEAR_PX = 22;
export const TOKEN_FAR_PX = 12;
export const TOKEN_MAX_PX = 24;
/** Distance band over which markers and the token shrink and fade (metres). */
export const FADE_NEAR_M = 110;
export const FADE_FAR_M = 320;
/** Faintest a marker or the token gets at the far end of the band. */
export const FADE_FLOOR = 0.35;
/** The corridor: the road ahead of the vehicle on screen, this far ahead
 *  (metres) and this wide either side of the heading (CSS px, at least). */
export const CORRIDOR_AHEAD_M = 70;
export const CORRIDOR_HALF_WIDTH_PX = 30;

export interface CollectionPlace extends WorldPoint {
  /** The Free Ride catalogue key (a landmark id). */
  key: string;
  name: string;
  prominence?: number;
}

export interface Checklist {
  hood: string;
  places: CollectionPlace[];
}

/**
 * The checklist for every neighbourhood: each place goes to the finest
 * neighbourhood holding it (`hoodOf`), most prominent first, capped at
 * `max`. Neighbourhoods with fewer than `min` places get no list.
 */
export function buildChecklists(
  places: readonly CollectionPlace[],
  hoodOf: (place: CollectionPlace) => string | null | undefined,
  { max = CHECKLIST_MAX_PLACES, min = CHECKLIST_MIN_PLACES }: { max?: number; min?: number } = {},
): Map<string, Checklist> {
  const byHood = new Map<string, CollectionPlace[]>();
  const seen = new Set<string>();
  for (const place of places) {
    if (!place.key || seen.has(place.key)) continue;
    const hood = hoodOf(place);
    if (!hood) continue;
    seen.add(place.key);
    const list = byHood.get(hood);
    if (list) list.push(place); else byHood.set(hood, [place]);
  }
  const out = new Map<string, Checklist>();
  for (const [hood, list] of byHood) {
    if (list.length < min) continue;
    list.sort((a, b) => (b.prominence ?? 0) - (a.prominence ?? 0) || a.key.localeCompare(b.key));
    out.set(hood, { hood, places: list.slice(0, max) });
  }
  return out;
}

export interface ChecklistProgress {
  opened: number;
  total: number;
  done: boolean;
  /** Keys not yet opened, in list order. */
  remaining: string[];
}

export function checklistProgress(list: Checklist | null | undefined, opened: ReadonlySet<string>): ChecklistProgress | null {
  if (!list || !list.places.length) return null;
  const remaining = list.places.filter(place => !opened.has(place.key)).map(place => place.key);
  const total = list.places.length;
  return { opened: total - remaining.length, total, done: remaining.length === 0, remaining };
}

const norm = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * The checklist line: "Marineterrein · 3 of 9 places", or "Marineterrein ·
 * all 9 places" once complete. Free Ride asks nothing, but the quiz rule
 * stands: if the neighbourhood's name is the name under question it is left
 * out and only the count shows.
 */
export interface ChecklistCopy {
  count(opened: number, total: number): string;
  done(total: number): string;
}

const ENGLISH: ChecklistCopy = {
  count: (opened, total) => `${opened} of ${total} places`,
  done: total => `all ${total} places`,
};

export function checklistLine(
  hood: string,
  progress: ChecklistProgress,
  { underQuestion = '', copy = ENGLISH }: { underQuestion?: string; copy?: ChecklistCopy } = {},
): { hood: string; count: string; text: string } {
  const hidden = !!underQuestion && norm(underQuestion) === norm(hood);
  const name = hidden ? '' : hood;
  const count = progress.done ? copy.done(progress.total) : copy.count(progress.opened, progress.total);
  return { hood: name, count, text: name ? `${name} · ${count}` : count };
}

// ---- What is remembered between rides --------------------------------------

export interface CollectionStamp {
  hood: string;
  /** ISO date the stamp was earned. */
  at: string;
}

export interface CollectionState {
  opened: string[];
  stamps: CollectionStamp[];
}

type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export function emptyCollection(): CollectionState {
  return { opened: [], stamps: [] };
}

export function readCollection(store: Pick<Store, 'getItem'> | null): CollectionState {
  try {
    const raw = store?.getItem(COLLECTION_STORAGE_KEY);
    if (!raw) return emptyCollection();
    const parsed = JSON.parse(raw) as Partial<CollectionState>;
    return {
      opened: Array.isArray(parsed.opened) ? parsed.opened.map(String) : [],
      stamps: Array.isArray(parsed.stamps)
        ? parsed.stamps.filter(s => s && typeof s.hood === 'string').map(s => ({ hood: s.hood, at: String(s.at || '') }))
        : [],
    };
  } catch {
    return emptyCollection();
  }
}

export function saveCollection(store: Pick<Store, 'setItem'> | null, state: CollectionState): void {
  try { store?.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(state)); } catch { /* private window */ }
}

/** Add a key to the opened list; returns the new state, or the same state when it was already there. */
export function noteOpened(state: CollectionState, key: string): CollectionState {
  if (!key || state.opened.includes(key)) return state;
  return { ...state, opened: [...state.opened, key] };
}

/**
 * Stamp a neighbourhood whose list is complete: once, into both the
 * collection (with the date) and the shared passport. `fresh` is true only on
 * the opening that completed it.
 */
export function stampIfComplete(
  state: CollectionState,
  passport: NeighborhoodPassport,
  hood: string,
  progress: ChecklistProgress | null,
  today: string,
): { state: CollectionState; passport: NeighborhoodPassport; fresh: boolean } {
  if (!hood || !progress?.done || state.stamps.some(s => s.hood === hood)) {
    return { state, passport, fresh: false };
  }
  const stamped = passport.stamped.includes(hood) ? passport.stamped : [...passport.stamped, hood].sort();
  return {
    state: { ...state, stamps: [...state.stamps, { hood, at: today }] },
    passport: { ...passport, stamped },
    fresh: true,
  };
}

// ---- The discovery token ---------------------------------------------------

/**
 * The landmark that carries the token: the nearest one not yet opened within
 * `radius` (world px), preferring the current neighbourhood's list so the
 * coin leads round the checklist. Null when everything near is opened.
 */
export function pickTokenPlace<T extends CollectionPlace>(
  rider: WorldPoint,
  candidates: readonly T[],
  opened: ReadonlySet<string>,
  { radius, prefer }: { radius: number; prefer?: ReadonlySet<string> },
): (T & { distance: number }) | null {
  let best: (T & { distance: number }) | null = null;
  let bestScore = Infinity;
  for (const place of candidates) {
    if (opened.has(place.key) || !Number.isFinite(place.x) || !Number.isFinite(place.y)) continue;
    const distance = Math.hypot(place.x - rider.x, place.y - rider.y);
    if (distance > radius) continue;
    // A place on the list counts as half as far, so it wins over a slightly nearer one outside.
    const score = prefer?.has(place.key) ? distance / 2 : distance;
    if (score < bestScore || (score === bestScore && best && place.key < best.key)) {
      best = { ...place, distance };
      bestScore = score;
    }
  }
  return best;
}

/** Riding within `throughPx` (world px) of the token's place opens it. */
export function ridesThrough(rider: WorldPoint, place: WorldPoint | null, throughPx: number): boolean {
  return !!place && Math.hypot(place.x - rider.x, place.y - rider.y) <= throughPx;
}

const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

/** 0 near, 1 far, eased, over the fade band. */
function farness(distanceM: number): number {
  if (!Number.isFinite(distanceM)) return 1;
  return smooth((distanceM - FADE_NEAR_M) / (FADE_FAR_M - FADE_NEAR_M));
}

/** A marker's opacity at a distance: whole up close, fading to the floor at the edge of the marker radius (user 2026-10-30). */
export function distanceAlpha(distanceM: number): number {
  return 1 - (1 - FADE_FLOOR) * farness(distanceM);
}

/** The token's diameter at a distance: never more than TOKEN_MAX_PX. */
export function tokenSizePx(distanceM: number): number {
  const size = TOKEN_NEAR_PX + (TOKEN_FAR_PX - TOKEN_NEAR_PX) * farness(distanceM);
  return Math.min(TOKEN_MAX_PX, Math.max(TOKEN_FAR_PX, size));
}

// ---- The corridor ----------------------------------------------------------

export interface ScreenPoint { x: number; y: number }

/** Distance from p to the segment ab. */
function segmentDistance(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export interface Corridor {
  /** Screen points from the vehicle forward. */
  path: ScreenPoint[];
  halfWidth: number;
}

/**
 * True when a coin of `radius` px at `at` would touch the corridor: the
 * screen path from the vehicle ahead, `halfWidth` either side.
 */
export function overCorridor(at: ScreenPoint, radius: number, corridor: Corridor | null): boolean {
  if (!corridor || !corridor.path.length) return false;
  const reach = corridor.halfWidth + radius;
  if (corridor.path.length === 1) return Math.hypot(at.x - corridor.path[0].x, at.y - corridor.path[0].y) <= reach;
  for (let i = 1; i < corridor.path.length; i++) {
    if (segmentDistance(at, corridor.path[i - 1], corridor.path[i]) <= reach) return true;
  }
  return false;
}

/** World points ahead of the rider along its heading, for projecting the corridor. */
export function corridorAhead(rider: WorldPoint & { angle: number }, aheadPx: number, steps = 4): WorldPoint[] {
  const out: WorldPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const d = (aheadPx * i) / steps;
    out.push({ x: rider.x + Math.cos(rider.angle) * d, y: rider.y + Math.sin(rider.angle) * d });
  }
  return out;
}

/** On unless the page says `?collection=0`. */
export function collectionEnabled(search: string): boolean {
  try { return new URLSearchParams(search).get('collection') !== '0'; } catch { return !/[?&]collection=0(?:&|$)/.test(search); }
}
