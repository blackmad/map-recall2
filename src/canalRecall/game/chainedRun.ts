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

export interface OpenRun {
  version: 1;
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
}

/** The chain bonus for the n-th stop of a run (1-based): 0, +5 %, +10 % … capped. */
export function chainBonus(stopNumber: number): number {
  if (!Number.isFinite(stopNumber) || stopNumber <= 1) return 0;
  return Math.min(CHAIN_CAP, Math.round((stopNumber - 1) * CHAIN_STEP * 100) / 100);
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
  const bonus = chainBonus(stopNumber);
  const basePoints = Math.max(0, Math.round(input.points || 0));
  const points = Math.round(basePoints * (1 + bonus));
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
      totalPoints: base.totalPoints + points,
      bestStreak: Math.max(base.bestStreak, stop.bestStreak),
      names: [...known],
      stops,
    },
  };
}

export function touchRun(run: OpenRun, now: number): OpenRun {
  return { ...run, lastActiveAt: Math.max(run.lastActiveAt, now) };
}

export function isIdle(run: OpenRun, now: number): boolean {
  return now - run.lastActiveAt >= RUN_IDLE_MS;
}

/** The bonus the next stop will carry, for the arrival line. */
export function nextBonus(run: OpenRun): number {
  return chainBonus(run.stopCount + 1);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function formatPoints(points: number): string {
  return Math.round(points).toLocaleString('en-US');
}

/**
 * The arrival card's one run line. Plaque voice: nouns, no exclamation marks.
 * Calm mode shows neither points nor the multiplier.
 */
export function runLine(run: OpenRun, options: { calm: boolean }): string {
  const bits = [plural(run.stopCount, 'stop', 'stops'), plural(run.names.length, 'name', 'names')];
  if (!options.calm) {
    bits.push(`${formatPoints(run.totalPoints)} points`);
    const next = nextBonus(run);
    if (next > 0) bits.push(`chain +${Math.round(next * 100)} %`);
  }
  return bits.join('  ·  ');
}

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/** One line of story for the run card. */
export function runStory(run: OpenRun): string {
  const count = run.stopCount < NUMBER_WORDS.length ? NUMBER_WORDS[run.stopCount] : String(run.stopCount);
  const last = run.stops[run.stops.length - 1];
  const from = run.startName && run.startName !== last?.name ? ` from ${run.startName}` : '';
  const to = last ? ` to ${last.name}` : '';
  const names = run.names.length > 0 ? `, ${plural(run.names.length, 'name', 'names')} on the map` : '';
  return `${count} ${run.stopCount === 1 ? 'stop' : 'stops'}${from}${to}${names}.`;
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
  if (!isIdle(run, now)) return { run, ended: null };
  endRun(storage, run);
  return { run: null, ended: run };
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
