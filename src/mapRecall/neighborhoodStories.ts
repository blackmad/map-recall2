import type { StreetFeature, TriviaText } from '../types';
import { triviaForRound } from './localFacts';
export interface NeighborhoodStoryFact extends TriviaText {
  evidence: string;
  verification: 'grounded';
  reviewedAt: string;
}
export interface NeighborhoodStory {
  areaName: string;
  topFacts: NeighborhoodStoryFact[];
  rotatingFacts: NeighborhoodStoryFact[];
}
export interface NeighborhoodStoriesFile {
  version: 1;
  cityId: string;
  entries: NeighborhoodStory[];
}
const publishable = (fact: NeighborhoodStoryFact) => fact.verification === 'grounded'
  && !!fact.text?.trim() && !!fact.evidence?.trim() && /^https:\/\//.test(fact.sourceUrl);
/** Explicit quiz-area names only. The import's descriptive names are never proximity aliases. */
export function attachNeighborhoodStories<T extends Pick<StreetFeature, 'name' | 'type' | 'cityId'>>(
  features: readonly T[], file: NeighborhoodStoriesFile | null | undefined,
): Array<T & Pick<StreetFeature, 'neighborhoodTopFacts' | 'neighborhoodRotatingFacts'>> {
  if (file?.version !== 1) return features.slice();
  const byName = new Map(file.entries.map(entry => [entry.areaName, entry]));
  return features.map(feature => {
    if (feature.cityId !== file.cityId || feature.type !== 'neighborhood') return feature;
    const story = byName.get(feature.name);
    if (!story) return feature;
    const topFacts = story.topFacts.filter(publishable).slice(0, 2);
    if (!topFacts.length) return feature;
    const topTexts = new Set(topFacts.map(f => f.text.trim().toLowerCase()));
    const seen = new Set<string>();
    const rotatingFacts = story.rotatingFacts.filter(fact => {
      const key = fact.text?.trim().toLowerCase();
      if (!publishable(fact) || topTexts.has(key) || seen.has(key)) return false;
      seen.add(key); return true;
    });
    return {...feature, neighborhoodTopFacts: topFacts, neighborhoodRotatingFacts: rotatingFacts};
  });
}
export function neighborhoodFactForRound(facts: readonly TriviaText[] | undefined, seed: number, round: number): TriviaText | null {
  return triviaForRound(facts, seed, round);
}
