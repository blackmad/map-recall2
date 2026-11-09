// Chained stops: the fare (G1, #271).
//
// A run is a chain of arrivals in one sitting. Each arrival adds a stop; the
// next stop is dealt 1–3 km from the last one; points earned after the first
// stop carry a chain bonus of +5 % per stop, capped at +25 %. A run ends when
// the player ends it, or after ten idle minutes. The open run is kept in
// localStorage so a reload continues it.
//
// Pure: no DOM, no game. The runtime (chainedRunRuntime.ts) feeds it arrivals
// and draws what it returns.

import {
  kmBetween,
  localFamiliarity,
  pickDestinationNear,
  randomUnit,
  type ChooseUnit,
  type MasterySample,
  type RoutePoi,
} from './routeSelection';
import { notabilityScore, notabilityWeight } from './poiNotability';
import { t } from '../../i18n/index.ts';

export const RUN_STORAGE_KEY = 'canalRecall.openRun.v1';
export const LAST_RUN_STORAGE_KEY = 'canalRecall.lastRun.v1';
/** Ten minutes with no riding and no arrival ends the run. */
export const RUN_IDLE_MS = 10 * 60 * 1000;
export const CHAIN_STEP = 0.05;
export const CHAIN_CAP = 0.25;
export const NEXT_STOP_MIN_KM = 1;
export const NEXT_STOP_MAX_KM = 3;
/** Stops a run remembers for its list; older ones still count in the totals. */
export const RUN_LIST_LIMIT = 12;

export interface RunStop {
  id: string;
  name: string;
  /** Points as scored on the ride, before the chain bonus. */
  basePoints: number;
  /** Points with the chain bonus this stop earned. */
  points: number;
  /** Chain bonus applied at this stop, 0..CHAIN_CAP. */
  bonus: number;
  bestStreak: number;
  /** Names answered correctly on the way to this stop. */
  names: string[];
  at: number;
}

/** A dealt leg, kept so a reload can ride it again. */
export interface RunLeg {
  from: { id: string; name: string; lat: number; lng: number };
  to: { id: string; name: string; lat: number; lng: number };
}

export interface OpenRun {
  version: 1;
  /** Set while the game is paused: the idle clock stops (coordinator rule, #271). */
  pausedAt?: number | null;
  /** The next stop as dealt, until the rider arrives. */
  nextLeg?: RunLeg | null;
  startedAt: number;
  lastActiveAt: number;
  startName: string;
  stopCount: number;
  totalPoints: number;
  bestStreak: number;
  names: string[];
  stops: RunStop[];
}

export interface ArrivalInput {
  id: string;
  name: string;
  /** The rider's start for this leg; names the run's first start. */
  fromName: string;
  points: number;
  bestStreak: number;
  names: readonly string[];
  /** Calm mode (no gamey features): no chain bonus. */
  calm?: boolean;
}

/** The chain bonus for the n-th stop of a run (1-based): 0, +5 %, +10 % … capped. */
export function chainBonus(stopNumber: number): number {
  if (!Number.isFinite(stopNumber) || stopNumber <= 1) return 0;
  return Math.min(CHAIN_CAP, Math.round((stopNumber - 1) * CHAIN_STEP * 100) / 100);
}

export interface StopScore {
  /** Points as scored on the ride. */
  basePoints: number;
  /** The chain bonus this stop earned and carries: stop 1 none, stop 2 +5 % … capped. */
  bonus: number;
  /** basePoints with this stop's bonus: what the arrival card, run line and run card show. */
  points: number;
  /** The run's total through this stop. */
  total: number;
}

/**
 * The one scoring rule for a run (#282): the n-th stop's base points, the
 * bonus that stop earns (applied to that stop, never the next), its points
 * and the running total. The arrival card's Points, the run line and the run
 * card all read what this returns; calm mode carries no bonus.
 */
export function scoreStop(stopNumber: number, basePoints: number, previousTotal: number, options: { calm?: boolean } = {}): StopScore {
  const base = Math.max(0, Math.round(Number.isFinite(basePoints) ? basePoints : 0));
  const bonus = options.calm ? 0 : chainBonus(stopNumber);
  const points = Math.round(base * (1 + bonus));
  return { basePoints: base, bonus, points, total: Math.max(0, previousTotal || 0) + points };
}

/** scoreStop over a whole sequence of ride scores, in order. */
export function scoreRun(basePoints: readonly number[], options: { calm?: boolean } = {}): StopScore[] {
  const scores: StopScore[] = [];
  for (const base of basePoints) scores.push(scoreStop(scores.length + 1, base, scores[scores.length - 1]?.total ?? 0, options));
  return scores;
}

export function newRun(now: number, startName: string): OpenRun {
  return {
    version: 1, startedAt: now, lastActiveAt: now, startName,
    stopCount: 0, totalPoints: 0, bestStreak: 0, names: [], stops: [],
  };
}

/** Adds an arrival to the run (a new run when `run` is null or idle). */
export function addStop(run: OpenRun | null, input: ArrivalInput, now: number): { run: OpenRun; stop: RunStop } {
  const base = run && !isIdle(run, now) ? run : newRun(now, input.fromName);
  const stopNumber = base.stopCount + 1;
  const { basePoints, bonus, points, total } = scoreStop(stopNumber, input.points, base.totalPoints, { calm: input.calm });
  const names = [...new Set(input.names.filter(Boolean))];
  const stop: RunStop = {
    id: input.id, name: input.name, basePoints, points, bonus,
    bestStreak: Math.max(0, input.bestStreak || 0), names, at: now,
  };
  const known = new Set(base.names);
  for (const name of names) known.add(name);
  const stops = [...base.stops, stop].slice(-RUN_LIST_LIMIT);
  return {
    stop,
    run: {
      ...base,
      lastActiveAt: now,
      stopCount: stopNumber,
      pausedAt: null,
      nextLeg: null,
      totalPoints: total,
      bestStreak: Math.max(base.bestStreak, stop.bestStreak),
      names: [...known],
      stops,
    },
  };
}

export function touchRun(run: OpenRun, now: number): OpenRun {
  return { ...run, lastActiveAt: Math.max(run.lastActiveAt, now) };
}

/** Idle time stops while paused: measured to the moment the pause began. */
export function isIdle(run: OpenRun, now: number): boolean {
  const until = run.pausedAt != null ? Math.min(now, run.pausedAt) : now;
  return until - run.lastActiveAt >= RUN_IDLE_MS;
}

export function pauseRun(run: OpenRun, now: number): OpenRun {
  return run.pausedAt != null ? run : { ...run, pausedAt: now };
}

/** Ends a pause: the paused span is credited, so it never counts toward idle. */
export function resumeRun(run: OpenRun, now: number): OpenRun {
  if (run.pausedAt == null) return run;
  const paused = Math.max(0, now - run.pausedAt);
  return { ...run, pausedAt: null, lastActiveAt: run.lastActiveAt + paused };
}

export function withNextLeg(run: OpenRun, leg: RunLeg | null): OpenRun {
  return { ...run, nextLeg: leg };
}

export type RunGameState = 'menu' | 'racing' | 'finished' | 'paused' | 'other';
export type RunTransition = 'close' | 'pause' | 'resume' | null;

/**
 * What a change of game state does to the open run. Route setup from the
 * arrival card (finished → menu) closes the run without a card: a route the
 * player picks is a new thing, not a dealt stop (coordinator rule, #271).
 */
export function runTransition(from: RunGameState, to: RunGameState): RunTransition {
  if (from === to) return null;
  if (from === 'finished' && to === 'menu') return 'close';
  if (to === 'paused') return 'pause';
  if (from === 'paused') return 'resume';
  return null;
}

/** The bonus the next stop will carry (the first-stop arrival can promise it). */
export function nextBonus(run: OpenRun): number {
  return chainBonus(run.stopCount + 1);
}

/** The bonus the run's latest stop earned: what the arrival line names. */
export function lastStopBonus(run: OpenRun): number {
  return run.stops[run.stops.length - 1]?.bonus ?? 0;
}

export function formatPoints(points: number): string {
  return Math.round(points).toLocaleString('en-US');
}

/**
 * The arrival card's one run line. Plaque voice: nouns, no exclamation marks.
 * Calm mode shows neither points nor the multiplier.
 */
export function runLine(run: OpenRun, options: { calm: boolean }): string {
  const bits = [countText('count.stops', run.stopCount), countText('count.names', run.names.length)];
  if (!options.calm) {
    bits.push(t('count.points', { points: formatPoints(run.totalPoints) }));
    // This stop's bonus, the one already in the points above (#282), not the next stop's.
    const earned = lastStopBonus(run);
    if (earned > 0) bits.push(t('run.chain', { percent: Math.round(earned * 100) }));
  }
  return bits.join('  ·  ');
}

/** "3 stops" / "3 buurten" through the catalogue's `.one` / `.other` keys (#283). */
function countText(key: 'count.stops' | 'count.names', count: number): string {
  return t(`${key}.${count === 1 ? 'one' : 'other'}`, { count });
}

/** One line of story for the run card. */
export function runStory(run: OpenRun): string {
  const words = t('run.numberWords').split(',');
  const count = run.stopCount < words.length ? words[run.stopCount] : String(run.stopCount);
  const last = run.stops[run.stops.length - 1];
  const from = run.startName && run.startName !== last?.name ? t('run.storyFrom', { name: run.startName }) : '';
  const to = last ? t('run.storyTo', { name: last.name }) : '';
  const names = run.names.length > 0 ? t('run.storyNames', { names: countText('count.names', run.names.length) }) : '';
  return t('run.story', { count, stops: t(run.stopCount === 1 ? 'run.storyStop.one' : 'run.storyStop.other'), from, to, names });
}

export interface RunStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function parseRun(raw: string | null): OpenRun | null {
  if (!raw) return null;
  try {
    const run = JSON.parse(raw) as OpenRun;
    if (!run || run.version !== 1 || !Array.isArray(run.stops) || !Array.isArray(run.names)) return null;
    if (!Number.isFinite(run.lastActiveAt) || !Number.isFinite(run.stopCount)) return null;
    return run;
  } catch {
    return null;
  }
}

/**
 * The open run, if one is still live. An idle run is closed here: moved to
 * the last-run slot and returned as `ended` so the caller can show it once.
 */
export function loadRun(storage: RunStorage | null, now: number): { run: OpenRun | null; ended: OpenRun | null } {
  if (!storage) return { run: null, ended: null };
  let raw: string | null = null;
  try { raw = storage.getItem(RUN_STORAGE_KEY); } catch { return { run: null, ended: null }; }
  const run = parseRun(raw);
  if (!run || run.stopCount <= 0) return { run: null, ended: null };
  // A reload ends any pause; the paused span up to now is not idle time.
  const live = resumeRun(run, now);
  if (!isIdle(live, now)) return { run: live, ended: null };
  endRun(storage, live);
  return { run: null, ended: live };
}

export function saveRun(storage: RunStorage | null, run: OpenRun): void {
  try { storage?.setItem(RUN_STORAGE_KEY, JSON.stringify(run)); } catch { /* storage full or blocked */ }
}

/** Closes the run: clears the open slot and keeps the run as the last one. */
export function endRun(storage: RunStorage | null, run: OpenRun): void {
  try {
    storage?.removeItem(RUN_STORAGE_KEY);
    storage?.setItem(LAST_RUN_STORAGE_KEY, JSON.stringify(run));
  } catch { /* storage full or blocked */ }
}

/** Whether `?run=0` turned chained stops off. */
export function runsEnabled(search: string): boolean {
  try { return new URLSearchParams(search).get('run') !== '0'; } catch { return true; }
}

/**
 * The next stop: 1–3 km from `from`, weighted by notability as the surprise
 * picker is, and by novelty (how little the rider knows the streets round
 * it), never a stop the run has already reached. Falls back to the surprise
 * picker when nothing sits in the band.
 */
export function pickNextStop(
  pois: readonly RoutePoi[],
  from: { id: string; lat: number; lng: number },
  options: {
    samples?: readonly MasterySample[];
    excludeIds?: readonly string[];
    chooseUnit?: ChooseUnit;
    minKm?: number;
    maxKm?: number;
  } = {},
): RoutePoi | null {
  const {
    samples = [], excludeIds = [], chooseUnit = randomUnit,
    minKm = NEXT_STOP_MIN_KM, maxKm = NEXT_STOP_MAX_KM,
  } = options;
  const skip = new Set([from.id, ...excludeIds]);
  const band = pois.filter(poi => {
    if (skip.has(poi.id)) return false;
    const km = kmBetween(poi, from);
    return km >= minKm && km <= maxKm;
  });
  if (band.length === 0) return pickDestinationNear(pois, from, chooseUnit, excludeIds[excludeIds.length - 1] ?? null);
  const weighted = band.map(poi => ({
    poi,
    weight: notabilityWeight(notabilityScore(poi)) * (0.35 + 0.65 * (1 - localFamiliarity(poi, samples))),
  })).filter(entry => entry.weight > 0);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return band[0] ?? null;
  let tick = chooseUnit() * total;
  for (const entry of weighted) {
    tick -= entry.weight;
    if (tick <= 0) return entry.poi;
  }
  return weighted[weighted.length - 1]?.poi ?? null;
}

/** Fields this lane adds to the dev's `__canalRecallSession` counters. */
export interface RunSessionCounters {
  ridesThisSession: number;
  stopsThisRun: number;
  runsEnded: number;
  stopsPerRun: number[];
}
