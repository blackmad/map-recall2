// First-run intro: three short cards that say what Canal Recall is before the
// player meets the setup screen. Pure data and storage rules live here so they
// can be checked without a DOM; `dom.ts` renders them.
//
// Copy rules (gameplay clarity review 2026-10-17): one idea per card, plain
// words, and the control hint for the device in hand — keys on a keyboard,
// the ring on a phone. Nothing here may name a real street or canal.

import { t } from '../../i18n/index.ts';

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
      title: t('onb.rideTitle'),
      body: t('onb.rideBody'),
      specimen: touch
        ? { kind: 'ring', caption: t('onb.ringCaption') }
        : { kind: 'keys', keys: [['↑'], ['←', '↓', '→']], caption: t('onb.keysCaption') },
    },
    {
      id: 'name-it',
      title: t('onb.nameTitle'),
      body: t('onb.nameBody'),
      specimen: {
        kind: 'question',
        plaque: '? ? ?',
        choices: ['1', '2', '3', '4'],
        caption: touch ? t('onb.tapCaption') : t('onb.pressCaption'),
      },
    },
    {
      id: 'score',
      title: t('onb.scoreTitle'),
      body: t('onb.scoreBody'),
      specimen: {
        kind: 'score',
        tally: t('onb.tally'),
        caption: t('onb.scoreCaption'),
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
