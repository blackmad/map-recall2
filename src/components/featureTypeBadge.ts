/**
 * The kind chip above a quiz question ("≈ Canal / Waterway", "⌁ Bridge").
 *
 * Kept in one place because both question modes drew their own copy of the
 * switch, and the word in it is also the word the question asks for ("Which
 * bridge is this?"), so it must come from the catalog rather than a literal.
 */

import type { MessageKey } from '../i18n/index.ts';
import type { Translate } from '../i18n/useT.ts';

export interface FeatureTypeBadge {
  label: string;
  icon: string;
}

export function featureTypeBadge(type: string, t: Translate): FeatureTypeBadge {
  switch (type) {
    case 'canal':
    case 'water':
      return { label: t('quiz.kind.water'), icon: '≈' };
    case 'bridge':
      return { label: t('quiz.kind.bridge'), icon: '⌁' };
    case 'square':
      return { label: t('quiz.kind.square'), icon: '□' };
    case 'park':
      return { label: t('quiz.kind.park'), icon: '♧' };
    case 'museum':
    case 'landmark':
    case 'monument':
      return { label: t('quiz.kind.landmark'), icon: '◆' };
    case 'neighborhood':
      return { label: t('quiz.kind.neighborhood'), icon: '⬡' };
    case 'avenue':
    case 'boulevard':
    case 'street':
    default:
      return { label: t('quiz.kind.street'), icon: '╱' };
  }
}

/** The question's noun, lowercased the way each language writes it mid-sentence. */
export function featureTypeLabelForQuestion(badge: FeatureTypeBadge, language: string): string {
  // Dutch keeps its nouns lowercase mid-sentence; English has no such rule but
  // the original question lowercased the chip word too, so both agree here.
  return language === 'nl' ? badge.label.toLowerCase() : badge.label.toLowerCase();
}

/** Every key the chip can use, for the catalog parity check. */
export const FEATURE_KIND_KEYS: MessageKey[] = [
  'quiz.kind.water', 'quiz.kind.bridge', 'quiz.kind.square', 'quiz.kind.park',
  'quiz.kind.landmark', 'quiz.kind.neighborhood', 'quiz.kind.street',
];
