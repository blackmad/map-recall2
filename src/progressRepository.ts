import type { User } from 'firebase/auth';
import { ReviewEvent, ReviewState, scheduleReview } from './spacedRepetition';
import { RoundResult } from './types';
import { getFeatureKey } from './utils/featureIdentity';

const STATES_KEY = 'mapRecall_reviewStates_v1';
const EVENTS_KEY = 'mapRecall_reviewEvents_v1';

const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
const stateId = (state: Pick<ReviewState, 'featureKey' | 'mode'>) => `${state.featureKey}_${state.mode}`;

export function loadLocalReviewStates(): ReviewState[] {
  return Object.values(read<Record<string, ReviewState>>(STATES_KEY, {}));
}

export async function recordReview(result: RoundResult, user: User | null): Promise<ReviewState> {
  const states = read<Record<string, ReviewState>>(STATES_KEY, {});
  const key = `${getFeatureKey(result.feature)}_${result.gameMode}`;
  const scheduled = scheduleReview(result, states[key]);
  states[key] = scheduled.state;
  write(STATES_KEY, states);
  const events = read<Record<string, ReviewEvent>>(EVENTS_KEY, {});
  events[scheduled.event.id] = scheduled.event;
  write(EVENTS_KEY, events);
  if (user) await uploadReview(user.uid, scheduled.event, scheduled.state);
  return scheduled.state;
}

const withoutUndefined = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

async function uploadReview(uid: string, event: ReviewEvent, state: ReviewState) {
  const [{ db }, { doc, writeBatch }] = await Promise.all([import('./firebase'), import('firebase/firestore')]);
  if (!db) return;
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'reviewEvents', event.id), withoutUndefined(event));
  batch.set(doc(db, 'users', uid, 'reviewStates', stateId(state)), withoutUndefined(state));
  await batch.commit();
}

/** Merge cloud state locally, then upload guest progress on first sign-in. */
export async function syncProgress(user: User): Promise<ReviewState[]> {
  const [{ db }, { collection, doc, getDocs, writeBatch }] = await Promise.all([import('./firebase'), import('firebase/firestore')]);
  if (!db) return loadLocalReviewStates();
  const localStates = read<Record<string, ReviewState>>(STATES_KEY, {});
  const cloudSnapshot = await getDocs(collection(db, 'users', user.uid, 'reviewStates'));
  cloudSnapshot.forEach((snapshot) => {
    const cloud = snapshot.data() as ReviewState;
    const key = stateId(cloud);
    if (!localStates[key] || cloud.lastReviewedAt > localStates[key].lastReviewedAt) localStates[key] = cloud;
  });
  write(STATES_KEY, localStates);

  const events = read<Record<string, ReviewEvent>>(EVENTS_KEY, {});
  const batch = writeBatch(db);
  Object.values(events).forEach((event) => batch.set(doc(db!, 'users', user.uid, 'reviewEvents', event.id), withoutUndefined(event)));
  Object.values(localStates).forEach((state) => batch.set(doc(db!, 'users', user.uid, 'reviewStates', stateId(state)), withoutUndefined(state)));
  await batch.commit();
  return Object.values(localStates);
}
