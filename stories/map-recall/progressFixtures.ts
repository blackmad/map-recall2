/** Shared fixtures for the Map Recall progression stories (postcard rack, end screen). */
import type { RoundResult, StreetFeature } from '../../src/types';
import type { ReviewState } from '../../src/spacedRepetition';
import { getFeatureKey } from '../../src/utils/featureIdentity';
import anne from '../canal-drive/fixtures/amsterdam-anne.jpg';
import bridge from '../canal-drive/fixtures/amsterdam-bridge.jpg';
import canal from '../canal-drive/fixtures/amsterdam-canal.jpg';
import canalhouses from '../canal-drive/fixtures/amsterdam-canalhouses.jpg';
import gracht from '../canal-drive/fixtures/amsterdam-gracht.jpg';
import houses from '../canal-drive/fixtures/amsterdam-houses.jpg';
import park from '../canal-drive/fixtures/amsterdam-park.jpg';
import westermarkt from '../canal-drive/fixtures/amsterdam-westermarkt.jpg';

const PHOTOS = [anne, bridge, canal, canalhouses, gracht, houses, park, westermarkt];

/** Tue 13 Oct 2026, 15:00 local: the stories' clock. */
export const STORY_NOW = new Date(2026, 9, 13, 15, 0).getTime();
const DAY = 86_400_000;

const NAMES = [
  'Jordaan', 'De Pijp', 'Grachtengordel', 'Nieuwmarktbuurt', 'Oostelijke Eilanden', 'Spaarndammerbuurt',
  'Overhoeks', 'Rivierenbuurt', 'Oud-Zuid', 'Plantage', 'Westerpark', 'Betondorp', 'Dapperbuurt', 'Kinkerbuurt',
  'Staatsliedenbuurt', 'Indische Buurt',
];

export const STORY_NEIGHBOURHOODS: StreetFeature[] = NAMES.map((name, index) => ({
  id: `story-${index}`,
  name,
  type: 'neighborhood',
  cityId: 'amsterdam',
  center: [52.36 + index * 0.003, 4.88 + index * 0.004],
  difficulty: 'medium',
  clues: [],
  distractors: [],
  // Every third area has no photographs: its card is typography only.
  areaPhotos: index % 3 === 2 ? [] : [0, 1, 2, 3].map((offset) => ({
    name: `Photo ${offset + 1}`,
    photo: { imageUrl: PHOTOS[(index + offset) % PHOTOS.length], imageAttribution: 'Story fixture', sourceUrl: 'https://commons.wikimedia.org/' },
  })),
}) as unknown as StreetFeature);

export function storyState(feature: StreetFeature, over: Partial<ReviewState> = {}): ReviewState {
  return {
    featureKey: getFeatureKey(feature), mode: 'pinpoint', dueAt: STORY_NOW + 2 * DAY, intervalDays: 2, ease: 2.3,
    repetitions: 1, lapses: 0, lastReviewedAt: STORY_NOW - DAY, lastEventId: 'story', schedulerVersion: 1,
    featureSnapshot: { name: feature.name, type: feature.type, cityId: feature.cityId, center: feature.center },
    ...over,
  };
}

/** The first `count` fixture areas earned, newest first, three of them due. */
export const earnedStates = (count: number): ReviewState[] => STORY_NEIGHBOURHOODS.slice(0, count)
  .map((feature, index) => storyState(feature, { lastReviewedAt: STORY_NOW - (index + 1) * 3_600_000, dueAt: index < 3 ? STORY_NOW - 1 : STORY_NOW + (index + 1) * DAY }));

const pin = (feature: StreetFeature, round: number, distance: number | undefined, accuracy: number, points: number): RoundResult => ({
  roundNumber: round, feature, gameMode: 'pinpoint',
  userCoordinates: distance === undefined ? undefined : feature.center,
  distanceErrorMeters: distance, accuracyPercentage: distance === undefined ? undefined : accuracy,
  pointsEarned: points, timeSpentMs: 18_000,
});

/** A five-round neighbourhood session: two known, one skipped, one far off, one new and right. */
export function storySession(withNewPostcard: boolean) {
  const [jordaan, pijp, gracht, nieuwmarkt, oostelijk] = STORY_NEIGHBOURHOODS;
  const fifth = withNewPostcard ? oostelijk : STORY_NEIGHBOURHOODS[5];
  const before = [storyState(jordaan, { dueAt: STORY_NOW - 1 }), storyState(pijp, { dueAt: STORY_NOW - 1 }), storyState(gracht), ...(withNewPostcard ? [] : [storyState(fifth)])];
  const results = [
    pin(jordaan, 1, 0, 100, 5000),
    pin(pijp, 2, 140, 82, 4100),
    pin(gracht, 3, undefined, 0, 0),
    pin(nieuwmarkt, 4, 2870, 15, 737),
    pin(fifth, 5, 0, 100, 4950),
  ];
  const after = [
    storyState(jordaan, { dueAt: STORY_NOW + 6 * DAY, repetitions: 2 }),
    storyState(pijp, { dueAt: STORY_NOW + 5 * DAY, repetitions: 2 }),
    storyState(gracht, { dueAt: STORY_NOW + 600_000, repetitions: 0 }),
    storyState(nieuwmarkt, { dueAt: STORY_NOW + 600_000, repetitions: 0 }),
    storyState(fifth, { dueAt: STORY_NOW + DAY, repetitions: withNewPostcard ? 1 : 2 }),
  ];
  return { before, after, results, total: results.reduce((sum, r) => sum + r.pointsEarned, 0) };
}
