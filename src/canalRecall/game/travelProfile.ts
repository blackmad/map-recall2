/**
 * Per-travel-mode presentation and load profile.
 *
 * Legacy call sites still use `isCar` / `isBoat`; new code should prefer
 * `travelProfile(mode)` so a third mode does not need another boolean fork.
 */
import { type QuizSubject, type TravelMode } from './modes.ts';

export type LearnedKind = 'water' | 'street' | 'transit';
export type MotionKind = 'water' | 'road' | 'corridor';
export type VehicleKind = 'boat' | 'bike' | 'transit';

export interface TravelProfile {
  id: TravelMode;
  label: string;
  /** Extract basename under `extracts/<city>/` (without `.json`). */
  extractFile: string;
  quizRouteSubject: QuizSubject;
  quizRouteQuestion: string;
  learnedKind: LearnedKind;
  motion: MotionKind;
  vehicle: VehicleKind;
  /** Loading / network nouns for the loading screen. */
  networkNoun: string;
  networkNounSingular: string;
  recallNoun: string;
  exploreNoun: string;
  /** Constrains the vehicle to mapped corridor geometry like bike mode. */
  usesRoadConstraint: boolean;
  /** Boat surface / waterTest path. */
  usesWaterTest: boolean;
}

const PROFILES: Record<TravelMode, TravelProfile> = {
  boat: {
    id: 'boat',
    label: 'Boat',
    extractFile: 'water',
    quizRouteSubject: 'waterway',
    quizRouteQuestion: 'Which waterway are you on now?',
    learnedKind: 'water',
    motion: 'water',
    vehicle: 'boat',
    networkNoun: 'waterways',
    networkNounSingular: 'waterway',
    recallNoun: 'Canals',
    exploreNoun: 'waterways',
    usesRoadConstraint: false,
    usesWaterTest: true,
  },
  car: {
    id: 'car',
    label: 'Bike',
    extractFile: 'streets-routing',
    quizRouteSubject: 'street',
    quizRouteQuestion: 'Which street are you on now?',
    learnedKind: 'street',
    motion: 'road',
    vehicle: 'bike',
    networkNoun: 'streets',
    networkNounSingular: 'street',
    recallNoun: 'Streets',
    exploreNoun: 'streets',
    usesRoadConstraint: true,
    usesWaterTest: false,
  },
  transit: {
    id: 'transit',
    label: 'Transit',
    extractFile: 'transit-network',
    quizRouteSubject: 'line',
    quizRouteQuestion: 'Which line are you on now?',
    learnedKind: 'transit',
    motion: 'corridor',
    vehicle: 'transit',
    networkNoun: 'tram lines',
    networkNounSingular: 'line',
    recallNoun: 'Lines',
    exploreNoun: 'lines and stops',
    usesRoadConstraint: true,
    usesWaterTest: false,
  },
};

export function travelProfile(mode: TravelMode): TravelProfile {
  return PROFILES[mode] ?? PROFILES.boat;
}

export function usesRoadConstraint(mode: TravelMode): boolean {
  return travelProfile(mode).usesRoadConstraint;
}

export function usesWaterTest(mode: TravelMode): boolean {
  return travelProfile(mode).usesWaterTest;
}
