import { GameMode, RoundResult, StreetFeature } from './types';
import { getFeatureKey } from './utils/featureIdentity';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewState {
  featureKey: string;
  mode: GameMode;
  dueAt: number;
  intervalDays: number;
  ease: number;
  repetitions: number;
  lapses: number;
  lastReviewedAt: number;
  lastEventId: string;
  schedulerVersion: 1;
  featureSnapshot: Pick<StreetFeature, 'name' | 'type' | 'cityId' | 'center'>;
}

export interface ReviewEvent {
  id: string;
  featureKey: string;
  mode: GameMode;
  rating: ReviewRating;
  reviewedAt: number;
  nextDueAt: number;
  result: {
    pointsEarned: number;
    timeSpentMs: number;
    distanceErrorMeters?: number;
    accuracyPercentage?: number;
    isCorrect?: boolean;
    skipped: boolean;
  };
}

const DAY = 86_400_000;

export function rateRound(result: RoundResult): ReviewRating {
  const skipped = result.userSelectedName === undefined
    && result.userCoordinates === undefined
    && result.pointsEarned === 0;
  if (skipped || result.isCorrect === false) return 'again';
  if (result.gameMode === 'guess_name') {
    if (result.timeSpentMs <= 5_000) return 'easy';
    return 'good';
  }
  const accuracy = result.accuracyPercentage ?? 0;
  if (accuracy >= 95 && result.timeSpentMs <= 12_000) return 'easy';
  if (accuracy >= 70) return 'good';
  if (accuracy >= 35) return 'hard';
  return 'again';
}

export function scheduleReview(
  result: RoundResult,
  previous?: ReviewState,
  reviewedAt = Date.now(),
): { event: ReviewEvent; state: ReviewState } {
  const rating = rateRound(result);
  const priorInterval = previous?.intervalDays ?? 0;
  const priorEase = previous?.ease ?? 2.3;
  let intervalDays: number;
  let ease = priorEase;

  if (rating === 'again') {
    intervalDays = 10 / (24 * 60);
    ease = Math.max(1.3, priorEase - 0.2);
  } else if (rating === 'hard') {
    intervalDays = Math.max(1, priorInterval * 1.2 || 1);
    ease = Math.max(1.3, priorEase - 0.05);
  } else if (rating === 'good') {
    intervalDays = priorInterval ? Math.max(2, priorInterval * priorEase) : 1;
  } else {
    intervalDays = priorInterval ? Math.max(4, priorInterval * priorEase * 1.3) : 4;
    ease = Math.min(3, priorEase + 0.1);
  }

  const eventId = crypto.randomUUID();
  const featureKey = getFeatureKey(result.feature);
  const dueAt = reviewedAt + intervalDays * DAY;
  const state: ReviewState = {
    featureKey,
    mode: result.gameMode,
    dueAt,
    intervalDays,
    ease,
    repetitions: rating === 'again' ? 0 : (previous?.repetitions ?? 0) + 1,
    lapses: (previous?.lapses ?? 0) + (rating === 'again' ? 1 : 0),
    lastReviewedAt: reviewedAt,
    lastEventId: eventId,
    schedulerVersion: 1,
    featureSnapshot: {
      name: result.feature.name,
      type: result.feature.type,
      cityId: result.feature.cityId,
      center: result.feature.center,
    },
  };
  return {
    state,
    event: {
      id: eventId,
      featureKey,
      mode: result.gameMode,
      rating,
      reviewedAt,
      nextDueAt: dueAt,
      result: {
        pointsEarned: result.pointsEarned,
        timeSpentMs: result.timeSpentMs,
        distanceErrorMeters: result.distanceErrorMeters,
        accuracyPercentage: result.accuracyPercentage,
        isCorrect: result.isCorrect,
        skipped: rating === 'again' && result.userCoordinates === undefined && result.userSelectedName === undefined,
      },
    },
  };
}

export function selectReviewFeatures(
  features: StreetFeature[],
  states: ReviewState[],
  mode: GameMode,
  limit: number,
  now = Date.now(),
  seed = 1,
): StreetFeature[] {
  const rank = (feature: StreetFeature) => {
    const value = `${seed}:${getFeatureKey(feature)}`;
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    return hash >>> 0;
  };
  const stateByKey = new Map(states.filter((state) => state.mode === mode).map((state) => [state.featureKey, state]));
  const due = features
    .filter((feature) => (stateByKey.get(getFeatureKey(feature))?.dueAt ?? Infinity) <= now)
    .sort((a, b) => stateByKey.get(getFeatureKey(a))!.dueAt - stateByKey.get(getFeatureKey(b))!.dueAt);
  const weightedOrder = (feature: StreetFeature) => {
    const random = (rank(feature) + 1) / 4_294_967_297;
    const importanceWeight = 1 + Math.max(0, feature.prominenceScore || 0) / 80;
    return -Math.log(random) / importanceWeight;
  };
  const unseen = features.filter((feature) => !stateByKey.has(getFeatureKey(feature))).sort((a, b) => weightedOrder(a) - weightedOrder(b));
  const learned = features.filter((feature) => stateByKey.has(getFeatureKey(feature))).sort((a, b) => weightedOrder(a) - weightedOrder(b));
  const dueTarget = Math.min(due.length, Math.ceil(limit * 0.7));
  return [...due.slice(0, dueTarget), ...unseen, ...due.slice(dueTarget), ...learned]
    .filter((feature, index, all) => all.findIndex((candidate) => getFeatureKey(candidate) === getFeatureKey(feature)) === index)
    .slice(0, limit);
}
