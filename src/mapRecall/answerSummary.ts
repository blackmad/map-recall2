/**
 * The one line the compact answer card shows before the player opens the full card: the same
 * text the full card leads with (src/components/WikipediaCard.tsx), so opening it reads on.
 * A name origin is cut to its first sentence so the fold stays two lines (review 2026-10-13:
 * Prinsengracht's folded card was eight lines).
 */
import type { StreetFeature } from '../types';
import { triviaForRound } from './localFacts';
import { descriptionWithoutOrigin, featureDescription, triviaText } from './trivia';
import { firstSentence, withNamedSubject } from './answerText';

export function answerTeaser(
  feature: Pick<StreetFeature, 'neighborhoodTopFacts' | 'localFact' | 'nameOrigin' | 'localFacts' | 'wikipediaExtract' | 'wikipediaExtractNl' | 'history'> & { name?: string },
  factSeed = 0,
  roundIndex = 0,
): string | undefined {
  const origin = triviaText(feature.nameOrigin);
  if (origin) return firstSentence(withNamedSubject(feature.name, origin));
  if (feature.neighborhoodTopFacts?.[0]?.text) return feature.neighborhoodTopFacts[0].text;
  if (feature.localFact?.text) return triviaText(feature.localFact);
  const trivia = triviaForRound(feature.localFacts, factSeed, roundIndex);
  if (trivia) return trivia.text;
  return descriptionWithoutOrigin(featureDescription(feature), undefined) ?? triviaText(feature.history);
}
