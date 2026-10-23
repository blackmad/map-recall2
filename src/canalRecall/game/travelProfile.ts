/**
 * Per-travel-mode presentation and load profile.
 *
 * Legacy call sites still use `isCar` / `isBoat`; new code should prefer
 * `travelProfile(mode)` so a third mode does not need another boolean fork.
 */
import { type QuizSubject, type TravelMode } from './modes.ts';
import { t } from '../../i18n/index.ts';

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

/**
 * Copy that changes with the interface language is stored as catalog keys and
 * resolved in `travelProfile()`: a module-level `quizRouteQuestion: 'Which…'`
 * would be frozen in whichever language the bundle loaded with.
 */
type ProfileTemplate = Omit<TravelProfile, 'label' | 'quizRouteQuestion' | 'recallNoun' | 'exploreNoun'> & {
  labelKey: 'setup.travel.boat' | 'setup.travel.bike' | 'setup.travel.transit';
  quizRouteQuestionKey: 'ride.question.waterway' | 'ride.question.street' | 'ride.question.line';
  recallNounKey: 'ride.noun.canals' | 'ride.noun.streets' | 'ride.noun.lines';
  exploreNounKey: 'ride.noun.canals' | 'ride.noun.streets' | 'ride.noun.linesAndStops';
};

const PROFILES: Record<TravelMode, ProfileTemplate> = {
  boat: {
    id: 'boat',
    labelKey: 'setup.travel.boat',
    extractFile: 'water',
    quizRouteSubject: 'waterway',
    quizRouteQuestionKey: 'ride.question.waterway',
    learnedKind: 'water',
    motion: 'water',
    vehicle: 'boat',
    networkNoun: 'waterways',
    networkNounSingular: 'waterway',
    recallNounKey: 'ride.noun.canals',
    exploreNounKey: 'ride.noun.canals',
    usesRoadConstraint: false,
    usesWaterTest: true,
  },
  car: {
    id: 'car',
    labelKey: 'setup.travel.bike',
    extractFile: 'streets-routing',
    quizRouteSubject: 'street',
    quizRouteQuestionKey: 'ride.question.street',
    learnedKind: 'street',
    motion: 'road',
    vehicle: 'bike',
    networkNoun: 'streets',
    networkNounSingular: 'street',
    recallNounKey: 'ride.noun.streets',
    exploreNounKey: 'ride.noun.streets',
    usesRoadConstraint: true,
    usesWaterTest: false,
  },
  transit: {
    id: 'transit',
    labelKey: 'setup.travel.transit',
    extractFile: 'transit-network',
    quizRouteSubject: 'line',
    quizRouteQuestionKey: 'ride.question.line',
    learnedKind: 'transit',
    motion: 'corridor',
    vehicle: 'transit',
    networkNoun: 'tram lines',
    networkNounSingular: 'line',
    recallNounKey: 'ride.noun.lines',
    exploreNounKey: 'ride.noun.linesAndStops',
    usesRoadConstraint: true,
    usesWaterTest: false,
  },
};

export function travelProfile(mode: TravelMode): TravelProfile {
  const template = PROFILES[mode] ?? PROFILES.boat;
  return {
    ...template,
    label: t(template.labelKey),
    quizRouteQuestion: t(template.quizRouteQuestionKey),
    recallNoun: t(template.recallNounKey),
    exploreNoun: t(template.exploreNounKey),
  };
}

export function usesRoadConstraint(mode: TravelMode): boolean {
  return travelProfile(mode).usesRoadConstraint;
}

export function usesWaterTest(mode: TravelMode): boolean {
  return travelProfile(mode).usesWaterTest;
}
