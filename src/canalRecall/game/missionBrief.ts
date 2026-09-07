/**
 * Safe mission punchlines for the briefing / race open.
 * Never names the start corridor — that would spoil the first quiz.
 */

import type { RoutePattern, TravelMode } from './modes.ts';

export interface MissionBriefInput {
  destinationName: string;
  travelMode: TravelMode;
  routePattern: RoutePattern;
  cityName: string;
  homeLearningRadiusKm?: number;
  /** Overdue review waiting in the first minute. */
  hasColdOpenReview?: boolean;
}

export interface MissionBrief {
  /** Short enamel line under Start / at race open. */
  line: string;
  /** Optional second line for the finish foreshadow. */
  tease?: string;
}

const BOAT = [
  (d: string) => `Find your way to ${d} by water`,
  (d: string) => `Canal hop to ${d}`,
  (d: string) => `Drift toward ${d} — name what you ride`,
];
const BIKE = [
  (d: string) => `Ride toward ${d}`,
  (d: string) => `Pedal to ${d} — learn the turns`,
  (d: string) => `Make ${d} feel like home`,
];
const TRANSIT = [
  (d: string) => `Ride the line toward ${d}`,
  (d: string) => `One hop to ${d} — own the corridor`,
  (d: string) => `Transfer-ready: get to ${d}`,
];
const HOME = [
  (km: number) => km > 0
    ? `Home ring · learn within ~${km.toFixed(1)} km`
    : 'Home base · grow your learning ring',
  () => 'Errand mode: leave knowing the way back',
];
const HERE = [
  (d: string) => d && d !== 'your destination' ? `From here toward ${d}` : 'Start from where you are',
  (_d: string) => 'Start from where you are — not a saved address',
];

function pick<T>(items: T[], salt: string): T {
  let h = 0;
  for (let i = 0; i < salt.length; i++) h = (h * 31 + salt.charCodeAt(i)) >>> 0;
  return items[h % items.length]!;
}

/** Build a punchline that teaches intent without revealing corridor names. */
export function missionBrief(input: MissionBriefInput): MissionBrief {
  const dest = (input.destinationName || 'your destination').trim();
  const salt = `${input.cityName}|${dest}|${input.travelMode}|${input.routePattern}`;

  if (input.routePattern === 'home') {
    const line = pick(HOME, salt)(input.homeLearningRadiusKm || 0);
    return {
      line,
      tease: input.hasColdOpenReview ? 'A review waits in the first minute' : undefined,
    };
  }

  if (input.routePattern === 'here') {
    const line = pick(HERE, salt)(dest);
    return {
      line,
      tease: input.hasColdOpenReview
        ? 'Warm up with one overdue name'
        : `Arrive knowing more of ${input.cityName}`,
    };
  }

  const pool = input.travelMode === 'boat' ? BOAT
    : input.travelMode === 'transit' ? TRANSIT
      : BIKE;
  const line = pick(pool, salt)(dest);
  return {
    line,
    tease: input.hasColdOpenReview
      ? 'Warm up with one overdue name'
      : `Arrive knowing more of ${input.cityName}`,
  };
}
