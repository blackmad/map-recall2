// First-run intro: three short cards that say what Canal Recall is before the
// player meets the setup screen. Pure data and storage rules live here so they
// can be checked without a DOM; `dom.ts` renders them.
//
// Copy rules (gameplay clarity review 2026-10-17): one idea per card, plain
// words, and the control hint for the device in hand — keys on a keyboard,
// the ring on a phone. Nothing here may name a real street or canal.

export const ONBOARDING_STORAGE_KEY = 'canalRecall.onboarding.v1';

export type OnboardingInput = 'keyboard' | 'touch';

/** A piece of the HUD drawn in miniature, so the card points at the real thing. */
export type OnboardingSpecimen =
  | { kind: 'keys'; keys: string[][]; caption: string }
  | { kind: 'ring'; caption: string }
  | { kind: 'question'; plaque: string; choices: string[]; caption: string }
  | { kind: 'score'; tally: string; caption: string };

export interface OnboardingStep {
  id: 'ride' | 'name-it' | 'score';
  title: string;
  body: string;
  specimen: OnboardingSpecimen;
}

export function onboardingSteps(input: OnboardingInput): OnboardingStep[] {
  const touch = input === 'touch';
  return [
    {
      id: 'ride',
      title: 'Ride the real city',
      body: 'Pick Boat or Bike and press Start route. Ride to the destination named in the top-right corner; the orange arrow points the way.',
      specimen: touch
        ? { kind: 'ring', caption: 'Hold the ring at the bottom and slide: sideways steers, up speeds up, back brakes.' }
        : { kind: 'keys', keys: [['↑'], ['←', '↓', '→']], caption: 'Arrow keys or WASD steer. Space brakes.' },
    },
    {
      id: 'name-it',
      title: 'Name it',
      body: 'When you turn onto a new canal or street, the ride stops and asks its name. The card in the top-left shows ? ? ? until you answer. Not sure? Choose No idea. You see the answer either way.',
      specimen: {
        kind: 'question',
        plaque: '? ? ?',
        choices: ['1', '2', '3', '4'],
        caption: touch
          ? 'Tap a name to answer. On Hard you type it.'
          : 'Press 1–4 to pick a name, 0 for No idea. On Hard you type it.',
      },
    },
    {
      id: 'score',
      title: 'Points and names learned',
      body: 'A right answer earns points: more on harder settings, in a streak, and for a name that is new to you. Names you get right come back later for review, so they stick.',
      specimen: {
        kind: 'score',
        tally: '3/4 named · 290 pts',
        caption: '3 named out of 4 asked. Knowledge, on the start screen, lists every name you have learned.',
      },
    },
  ];
}

/** Minimal Storage surface, so tests can pass a Map-backed fake. */
export interface OnboardingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** First visit only. Storage that throws (private mode, blocked site data)
 *  counts as seen: an intro that reappears on every load is worse than none. */
export function shouldShowOnboarding(storage: OnboardingStorage | null | undefined): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(ONBOARDING_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

export function markOnboardingSeen(storage: OnboardingStorage | null | undefined): void {
  if (!storage) return;
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, 'done');
  } catch {
    // Nothing to do: the intro simply shows again next visit.
  }
}
