/**
 * Turns the legacy game's state into allow-listed analytics events.
 *
 * Pure apart from the injected clock, buurt lookup and emitter, so the unit
 * tests drive it with a fake game. It reads a handful of game fields and
 * never keeps a position: each sample is reduced to a buurt code and a
 * distance increment, then dropped.
 */
import type { DeviceClass } from './device';
import { perfTier, type GovernorLike } from './device';
import {
  CITIES, ENTRIES, PROMPTS, QUESTION_KINDS, ANSWER_INPUTS,
  answeredBucket, distanceBucket, minutesBucket, progressBucket, seqBucket,
  type AnalyticsEvent, type MODES, type STEPS,
} from './schema';

type Mode = (typeof MODES)[number];
type Step = (typeof STEPS)[number];

/** public/canal-drive/js/game.js GameState. */
export const GAME_STATE = { MENU: 0, MAP_SELECT: 1, LOADING: 2, RACING: 4, FINISHED: 5, PAUSED: 6 } as const;

/** The parts of the legacy `Game` this reads. */
export interface GameLike {
  state: number;
  travelMode?: string;
  cityId?: string;
  routePattern?: string;
  freeRide?: boolean;
  _tour?: unknown;
  _reviewRoute?: unknown;
  _intro?: unknown;
  player?: { x: number; y: number } | null;
  track?: { getRaceProgress?: (x: number, y: number) => number } | null;
  _toLatLon?: (x: number, y: number) => [number, number] | null;
  routeOptions?: { answerMode?: string } | null;
  quizPromptSubject?: string | null;
  quizPromptKind?: string | null;
  vectorMap?: { _renderGovernor?: GovernorLike | null } | null;
}

export interface RideTrackerOptions {
  emit: (event: AnalyticsEvent) => void;
  device: DeviceClass;
  /** Seconds, monotonic. */
  now: () => number;
  /** Buurt code at a point, or null (outside Amsterdam, or the index not loaded yet). */
  buurtAt?: (lng: number, lat: number, cityId: string) => string | null;
}

interface Ride {
  mode: Mode;
  free: boolean;
  startedAt: number;
  step: Step;
  answered: number;
  progress: number;
  metres: number;
  last: [number, number] | null;
  buurten: Set<string>;
  reachedRoad: boolean;
  /** When riding began (after loading and the intro flight). */
  roadAt: number | null;
}

/** Further than this between two samples is a ferry, a transit leg or a respawn, not riding. */
const MAX_SAMPLE_JUMP_M = 400;

export function presentedMode(travelMode: string | undefined): Mode {
  if (travelMode === 'boat') return 'boat';
  if (travelMode === 'transit') return 'transit';
  return 'bike';
}

function oneOf<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (list as readonly string[]).includes(value) ? value as T : fallback;
}

export function entryOf(game: GameLike): (typeof ENTRIES)[number] {
  if (game.routePattern === 'free' || game.freeRide) return 'free';
  if (game._tour) return 'tour';
  if (game._reviewRoute) return 'review';
  return oneOf(ENTRIES, game.routePattern, 'surprise');
}

export function haversineMetres(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export class RideTracker {
  private ride: Ride | null = null;
  private rides = 0;
  private game: GameLike | null = null;

  constructor(private readonly o: RideTrackerOptions) {}

  get active(): boolean {
    return this.ride !== null;
  }

  /** A route was requested (loading begins). An unfinished ride before it was abandoned. */
  rideStart(game: GameLike): void {
    if (this.ride) this.end('abandoned');
    this.game = game;
    this.rides += 1;
    const mode = presentedMode(game.travelMode);
    const entry = entryOf(game);
    this.ride = {
      mode, free: entry === 'free', startedAt: this.o.now(), step: 'loading', answered: 0,
      progress: 0, metres: 0, last: null, buurten: new Set(), reachedRoad: false, roadAt: null,
    };
    this.o.emit({ t: 'ride_start', mode, entry, city: oneOf(CITIES, game.cityId, 'amsterdam'), seq: seqBucket(this.rides) });
  }

  /** Periodic look at the game (the adapter calls it every couple of seconds). */
  sample(game: GameLike | null = this.game): void {
    const ride = this.ride;
    if (!ride || !game) return;
    switch (game.state) {
      case GAME_STATE.LOADING:
        ride.step = 'loading';
        return;
      case GAME_STATE.PAUSED:
        ride.step = 'paused';
        return;
      case GAME_STATE.RACING:
        ride.step = game._intro ? 'intro' : 'riding';
        if (ride.step === 'riding') this.observePosition(ride, game);
        return;
      case GAME_STATE.FINISHED:
        this.rideFinish(game);
        return;
      default:
        // Back at route setup (or the map picker) without arriving.
        this.end('abandoned');
    }
  }

  answer(game: GameLike, correct: boolean, noIdea = false): void {
    const ride = this.ride;
    if (!ride) return;
    ride.answered += 1;
    this.o.emit({
      t: 'answer',
      mode: ride.mode,
      kind: oneOf(QUESTION_KINDS, game.quizPromptSubject, ride.mode === 'boat' ? 'waterway' : 'street'),
      prompt: oneOf(PROMPTS, game.quizPromptKind, 'route'),
      input: oneOf(ANSWER_INPUTS, game.routeOptions?.answerMode, 'multiple'),
      outcome: noIdea ? 'no-idea' : correct ? 'correct' : 'wrong',
    });
  }

  rideFinish(game: GameLike): void {
    const ride = this.ride;
    if (!ride) return;
    this.observePosition(ride, game);
    if (!ride.free) ride.progress = 1;
    ride.step = 'finished';
    this.end('finished');
  }

  /** The tab is going away; a ride still in progress was abandoned where it stands. */
  pageHide(): void {
    if (this.ride) this.end('abandoned');
  }

  private observePosition(ride: Ride, game: GameLike): void {
    const player = game.player;
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return;
    ride.reachedRoad = true;
    if (ride.roadAt === null) ride.roadAt = this.o.now();
    const progress = game.track?.getRaceProgress?.(player.x, player.y);
    if (typeof progress === 'number' && Number.isFinite(progress)) ride.progress = Math.max(ride.progress, progress);
    const at = game._toLatLon?.(player.x, player.y);
    if (!at || !Number.isFinite(at[0]) || !Number.isFinite(at[1])) return;
    if (ride.last) {
      const step = haversineMetres(ride.last, at);
      if (step <= MAX_SAMPLE_JUMP_M) ride.metres += step;
    }
    ride.last = [at[0], at[1]];
    const code = this.o.buurtAt?.(at[1], at[0], game.cityId || 'amsterdam') ?? null;
    if (code && !ride.buurten.has(code)) {
      ride.buurten.add(code);
      this.o.emit({ t: 'buurt', mode: ride.mode, code });
    }
  }

  private end(outcome: 'finished' | 'abandoned'): void {
    const ride = this.ride;
    if (!ride) return;
    this.ride = null;
    this.o.emit({
      t: 'ride_end', mode: ride.mode, outcome, step: outcome === 'finished' ? 'finished' : ride.step,
      progress: progressBucket(ride.free ? null : ride.progress), answered: answeredBucket(ride.answered),
    });
    if (!ride.reachedRoad) return;
    this.o.emit({
      t: 'ride_length', mode: ride.mode, outcome,
      minutes: minutesBucket(this.o.now() - (ride.roadAt ?? ride.startedAt)), distance: distanceBucket(ride.metres),
    });
    this.o.emit({ t: 'perf', device: this.o.device, tier: perfTier(this.game?.vectorMap?._renderGovernor) });
  }
}
