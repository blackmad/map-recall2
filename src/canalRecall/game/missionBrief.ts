/**
 * Safe mission punchlines for the briefing / race open.
 * Never names the start corridor — that would spoil the first quiz.
 */

import type { RoutePattern, TravelMode } from './modes.ts';
import { t } from '../../i18n/index.ts';

export interface MissionBriefInput {
  destinationName: string;
  travelMode: TravelMode;
  routePattern: RoutePattern;
  cityName: string;
  homeLearningRadiusKm?: number;
  /** Overdue review waiting in the first minute. */
  hasColdOpenReview?: boolean;
  /** Due names near a review ride's line. A count only: naming them would
   *  answer the questions before they are asked. */
  reviewDueNearRoute?: number;
}

export interface MissionBrief {
  /** Short enamel line under Start / at race open. */
  line: string;
  /** Optional second line for the finish foreshadow. */
  tease?: string;
}

// Each pool is a set of catalog keys: the salted pick must stay stable for a
// given route across languages (the salt is the city/destination/mode, not the
// copy), so only the rendered sentence changes.
const BOAT = ['mission.boat.1' as const, 'mission.boat.2' as const, 'mission.boat.3' as const];
const BIKE = ['mission.bike.1' as const, 'mission.bike.2' as const, 'mission.bike.3' as const];
const TRANSIT = ['mission.transit.1' as const, 'mission.transit.2' as const, 'mission.transit.3' as const];
const HERE = ['mission.here.1' as const, 'mission.here.2' as const, 'mission.here.3' as const];

function pick<T>(items: T[], salt: string): T {
  let h = 0;
  for (let i = 0; i < salt.length; i++) h = (h * 31 + salt.charCodeAt(i)) >>> 0;
  return items[h % items.length]!;
}

/** Build a punchline that teaches intent without revealing corridor names. */
export function missionBrief(input: MissionBriefInput): MissionBrief {
  const brief = composeBrief(input);
  const due = input.reviewDueNearRoute ?? 0;
  if (due > 0) return {
    ...brief,
    tease: due === 1 ? t('mission.reviewOne') : t('mission.reviewMany', { count: due }),
  };
  return brief;
}

function composeBrief(input: MissionBriefInput): MissionBrief {
  const rawDestination = (input.destinationName || '').trim();
  const dest = rawDestination || t('mission.destination');
  const salt = `${input.cityName}|${dest}|${input.travelMode}|${input.routePattern}`;

  if (input.routePattern === 'home') {
    const km = input.homeLearningRadiusKm || 0;
    // Two formats: a radius when one is known, the general promise otherwise.
    const key = pick([0, 1] as const, salt) === 0
      ? (km > 0 ? 'mission.home.1' as const : 'mission.home.2' as const)
      : 'mission.home.3' as const;
    return {
      line: t(key, { km: km.toFixed(1) }),
      tease: input.hasColdOpenReview ? t('mission.reviewFirstMinute') : undefined,
    };
  }

  if (input.routePattern === 'here') {
    // An unnamed destination keeps the generic "start from where you are".
    const key = rawDestination ? pick(HERE, salt) : 'mission.here.2';
    const line = t(key, { destination: dest });
    return {
      line,
      tease: input.hasColdOpenReview
        ? t('mission.warmUp')
        : t('mission.arrive', { city: input.cityName }),
    };
  }

  const pool = input.travelMode === 'boat' ? BOAT
    : input.travelMode === 'transit' ? TRANSIT
      : BIKE;
  const line = t(pick(pool, salt), { destination: dest });
  return {
    line,
    tease: input.hasColdOpenReview
      ? t('mission.warmUp')
      : t('mission.arrive', { city: input.cityName }),
  };
}
