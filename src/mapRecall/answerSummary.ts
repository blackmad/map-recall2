/**
 * The one line the compact answer card shows before the player opens the full card: the same
 * text the full card leads with (src/components/WikipediaCard.tsx), so opening it reads on.
 */
import type { StreetFeature } from '../types';
import { triviaForRound } from './localFacts';
import { descriptionWithoutOrigin } from './trivia';

export function answerTeaser(
  feature: Pick<StreetFeature, 'neighborhoodTopFacts' | 'localFact' | 'nameOrigin' | 'localFacts' | 'wikipediaExtract' | 'history'>,
  factSeed = 0,
  roundIndex = 0,
): string | undefined {
  if (feature.neighborhoodTopFacts?.[0]?.text) return feature.neighborhoodTopFacts[0].text;
  if (feature.localFact?.text) return feature.localFact.text;
  if (feature.nameOrigin?.text) return feature.nameOrigin.text;
  const trivia = triviaForRound(feature.localFacts, factSeed, roundIndex);
  if (trivia) return trivia.text;
  return descriptionWithoutOrigin(feature.wikipediaExtract, undefined) ?? feature.history?.text;
}
