/**
 * Spaced-repetition store for Canal Recall.
 *
 * Canal Recall is a plain-<script> page outside the Vite build, so it cannot
 * import src/firebase.ts directly. This module is bundled to an IIFE global and
 * bridges the game to the review scheduler the React app already uses, writing
 * to the same localStorage keys and the same per-uid Firestore collections.
 *
 * Signed out it still works: everything is mirrored locally and the cloud write
 * is simply skipped.
 */
import { ReviewState, scheduleReview } from '../spacedRepetition';
import { getFeatureKey } from '../utils/featureIdentity';
import { RoundResult, StreetFeature } from '../types';
import { LatLon, chunkCenter, isKnownNear, isSuppressedNear } from './recallChunks';

export { RECALL_LOCAL_RADIUS_METERS, RECALL_CHUNK_METERS } from './recallChunks';

const STATES_KEY = 'mapRecall_reviewStates_v1';
const EVENTS_KEY = 'mapRecall_reviewEvents_v1';
const CONFIG_URL = 'firebase-config.json';

export interface RecallFeature {
  name: string;
  type: string;
  cityId: string;
  /**
   * Where the rider was when the question was asked — not the feature's own
   * centre. Knowledge of a name is local, so identity is the name plus this
   * point snapped to a grid; see `recallChunks`.
   */
  center: LatLon;
}

type StateMap = Record<string, ReviewState>;

const read = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
};
const write = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
};
const stateId = (state: Pick<ReviewState, 'featureKey' | 'mode'>) => `${state.featureKey}_${state.mode}`;
const routeNameKey = (name: string): string => name.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Collapse place-local review chunks into a conservative per-name routing prior. */
export function routeMasteryFromStates(
  states: readonly ReviewState[], cityId: string, now = Date.now(),
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const state of states) {
    const feature = state.featureSnapshot;
    if (state.mode !== 'guess_name' || feature.cityId !== cityId
      || !['street', 'canal'].includes(feature.type)) continue;
    const key = routeNameKey(feature.name);
    if (!key || state.repetitions <= 0) continue;
    const practiced = Math.min(1, state.repetitions / 3);
    const current = state.dueAt > now ? practiced : practiced * 0.5;
    result[key] = Math.max(result[key] ?? 0, current);
  }
  return result;
}

/** The scheduler is written against the React game's round shape. */
function asRoundResult(feature: RecallFeature, correct: boolean, timeSpentMs: number): RoundResult {
  return {
    roundNumber: 0,
    feature: feature as unknown as StreetFeature,
    gameMode: 'guess_name',
    userSelectedName: correct ? feature.name : '_wrong_',
    isCorrect: correct,
    pointsEarned: correct ? 1 : 0,
    timeSpentMs,
  };
}

class RecallStore {
  private states: StateMap = {};
  private auth: import('firebase/auth').Auth | null = null;
  private db: import('firebase/firestore').Firestore | null = null;
  private uid: string | null = null;
  private listeners: Array<(user: { uid: string; label: string } | null) => void> = [];
  /** Mastery gating is opt-in so a fresh player is still asked everything. */
  enabled = true;

  async init(): Promise<void> {
    this.states = read<StateMap>(STATES_KEY, {});
    if (typeof window === 'undefined') return; // Node tests / scripts
    try {
      const response = await fetch(new URL(CONFIG_URL, window.location.href));
      if (!response.ok) return;                       // guest mode
      const config = await response.json();
      if (!config?.apiKey || !config?.projectId) return;
      const [{ initializeApp }, authModule, firestoreModule] = await Promise.all([
        import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
      ]);
      const app = initializeApp(config);
      this.auth = authModule.getAuth(app);
      this.db = firestoreModule.getFirestore(app);
      authModule.onAuthStateChanged(this.auth, (user) => {
        this.uid = user ? user.uid : null;
        this._emitUser();
        if (this.uid) void this.pull();
      });
    } catch (reason) {
      console.warn('Canal Recall progress is local only:', reason);
    }
  }

  get available(): boolean { return this.auth !== null; }
  get signedIn(): boolean { return this.uid !== null; }
  onUserChange(listener: (user: { uid: string; label: string } | null) => void): void {
    this.listeners.push(listener);
  }

  async signIn(): Promise<void> {
    if (!this.auth) throw new Error('Sign-in is unavailable — no Firebase config.');
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async signOut(): Promise<void> {
    if (!this.auth) return;
    const { signOut } = await import('firebase/auth');
    await signOut(this.auth);
  }

  /**
   * Wipe spaced-repetition memory for street/canal names. Local always;
   * cloud too when signed in. Leaves authentication and Canal preferences
   * alone — “start over learning”, not “delete my account”.
   */
  async clearKnowledge(): Promise<number> {
    const cleared = Object.keys(this.states).length;
    this.states = {};
    write(STATES_KEY, {});
    write(EVENTS_KEY, {});
    if (this.uid && this.db) {
      try {
        const { collection, getDocs, writeBatch } = await import('firebase/firestore');
        for (const name of ['reviewStates', 'reviewEvents'] as const) {
          const snapshot = await getDocs(collection(this.db, 'users', this.uid, name));
          let batch = writeBatch(this.db);
          let pending = 0;
          for (const entry of snapshot.docs) {
            batch.delete(entry.ref);
            pending += 1;
            if (pending >= 400) {
              await batch.commit();
              batch = writeBatch(this.db);
              pending = 0;
            }
          }
          if (pending > 0) await batch.commit();
        }
      } catch (reason) {
        console.warn('Could not clear cloud recall progress:', reason);
      }
    }
    this._emitUser();
    return cleared;
  }

  private _emitUser(): void {
    const user = this.uid
      ? {
        uid: this.uid,
        label: this.auth?.currentUser?.displayName
          || this.auth?.currentUser?.email
          || 'Signed in',
      }
      : null;
    for (const listener of this.listeners) listener(user);
  }

  keyFor(feature: RecallFeature): string {
    return getFeatureKey(feature as unknown as StreetFeature);
  }

  /**
   * True when this name has been answered near here recently enough that asking
   * again is noise — a wrong answer counts, because the scheduler parks it for
   * ten minutes so a correction is not immediately re-tested.
   */
  isSuppressedHere(feature: RecallFeature, now = Date.now()): boolean {
    if (!this.enabled) return false;
    return isSuppressedNear(this.nearQuery(feature, now));
  }

  /**
   * True when the rider has actually got this name right near here and is still
   * inside its review interval. The stricter bar, for places where a wrong
   * answer must not read as knowledge — such as the water under a bridge.
   * Deliberately independent of `enabled`: turning off "skip what I know" asks
   * more questions, it does not claim the rider knows less.
   */
  isKnownHere(feature: RecallFeature, now = Date.now()): boolean {
    return isKnownNear(this.nearQuery(feature, now));
  }

  private nearQuery(feature: RecallFeature, now: number) {
    return {
      states: Object.values(this.states),
      name: feature.name,
      cityId: feature.cityId,
      point: feature.center,
      now,
    };
  }

  /** How many name-and-place answers are being held, for the HUD. */
  get masteredCount(): number {
    const now = Date.now();
    return Object.values(this.states).filter((state) => state.dueAt > now && state.repetitions > 0).length;
  }

  /**
   * Every place the player has proved a name, for seeding map labels. The game
   * projects these into world pixels once per race rather than asking the store
   * per label per frame.
   */
  knownPlaces(now = Date.now()): Array<{ name: string; center: LatLon }> {
    return Object.values(this.states)
      .filter((state) => state.mode === 'guess_name' && state.repetitions > 0 && state.dueAt > now)
      .map((state) => ({ name: state.featureSnapshot.name, center: state.featureSnapshot.center as LatLon }));
  }

  /** Per-name familiarity used only as a small route preference. */
  routeMastery(cityId: string, now = Date.now()): Record<string, number> {
    return routeMasteryFromStates(Object.values(this.states), cityId, now);
  }

  /**
   * Record an answer against the *place* it was given, so one correct answer on
   * the Overtoom by the Vondelpark does not retire the whole street. Snapping
   * happens here rather than at the call sites so a recorded centre and the
   * centre a later query reads back can never drift apart.
   */
  record(feature: RecallFeature, correct: boolean, timeSpentMs = 6000): ReviewState {
    const chunked = { ...feature, center: chunkCenter(feature.center) };
    const key = `${this.keyFor(chunked)}_guess_name`;
    const scheduled = scheduleReview(asRoundResult(chunked, correct, timeSpentMs), this.states[key]);
    this.states[key] = scheduled.state;
    write(STATES_KEY, this.states);
    const events = read<Record<string, unknown>>(EVENTS_KEY, {});
    events[scheduled.event.id] = scheduled.event;
    write(EVENTS_KEY, events);
    if (this.uid && this.db) void this.push(scheduled.state, scheduled.event);
    return scheduled.state;
  }

  private async push(state: ReviewState, event: unknown): Promise<void> {
    try {
      const { doc, writeBatch } = await import('firebase/firestore');
      const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
      const batch = writeBatch(this.db!);
      batch.set(doc(this.db!, 'users', this.uid!, 'reviewStates', stateId(state)), clean(state));
      batch.set(doc(this.db!, 'users', this.uid!, 'reviewEvents', (event as { id: string }).id), clean(event));
      await batch.commit();
    } catch (reason) {
      console.warn('Could not sync recall progress:', reason);
    }
  }

  /** Merge newer cloud state down, then upload anything the cloud has not seen. */
  private async pull(): Promise<void> {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const snapshot = await getDocs(collection(this.db!, 'users', this.uid!, 'reviewStates'));
      snapshot.forEach((entry) => {
        const cloud = entry.data() as ReviewState;
        const key = stateId(cloud);
        if (!this.states[key] || cloud.lastReviewedAt > this.states[key].lastReviewedAt) this.states[key] = cloud;
      });
      write(STATES_KEY, this.states);
    } catch (reason) {
      console.warn('Could not load recall progress:', reason);
    }
  }
}

export const store = new RecallStore();
