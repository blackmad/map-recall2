import type { Fact, FactsFile } from '../canalRecall/facts/factTypes';

export interface FactBearingFeature {
  id: string;
  localFacts?: Fact[];
}

/** Join only exact extract identities; name/proximity guesses can attach true trivia to the wrong place. */
export function attachLocalFacts<T extends FactBearingFeature>(
  features: readonly T[],
  catalog: FactsFile | null | undefined,
  expectedCityId: string,
): T[] {
  if (!catalog || catalog.cityId !== expectedCityId) return features.slice();
  const byId = new Map(catalog.features
    .filter((feature) => feature.id && feature.facts?.length)
    .map((feature) => [feature.id, feature.facts]));
  return features.map((feature) => {
    const facts = byId.get(feature.id);
    return facts ? { ...feature, localFacts: facts.slice() } : feature;
  });
}

/** A stable per-game choice. The same answer does not flicker on re-render, while a new game seed rotates it. */
export function triviaForRound(
  facts: readonly Fact[] | null | undefined,
  gameSeed: number,
  roundIndex: number,
): Fact | null {
  if (!facts?.length) return null;
  let mixed = (gameSeed ^ Math.imul(roundIndex + 1, 0x9e3779b1)) >>> 0;
  mixed ^= mixed >>> 16;
  return facts[mixed % facts.length];
}
