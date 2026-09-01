import type { StreetKnowledgeEntry } from './extracts';

export type RouteKnowledgeType = 'street' | 'water';
export type RouteKnowledgeIndex = Map<string, StreetKnowledgeEntry>;

const eligible = (entry: StreetKnowledgeEntry) => entry.wikipediaUrl || entry.wikipediaExtract;

/** Join answer names to exact extract identities without merging street/water homonyms. */
export function buildRouteKnowledgeIndex(
  legacy: readonly StreetKnowledgeEntry[],
  streets: readonly StreetKnowledgeEntry[],
  waters: readonly StreetKnowledgeEntry[],
  normalise: (name: string) => string,
): RouteKnowledgeIndex {
  const index: RouteKnowledgeIndex = new Map();
  const add = (entry: StreetKnowledgeEntry, type: RouteKnowledgeType) => {
    index.set(`${type}:${normalise(entry.name)}`, { ...entry, type });
  };
  for (const entry of legacy) add(entry, entry.type === 'water' ? 'water' : 'street');
  // Exact extract records deliberately overwrite legacy summaries: their IDs
  // are what join to the reviewed fact catalog.
  for (const entry of streets) if (eligible(entry)) add(entry, 'street');
  for (const entry of waters) if (eligible(entry)) add(entry, 'water');
  return index;
}

export function routeKnowledgeFor(
  index: RouteKnowledgeIndex,
  name: string,
  type: RouteKnowledgeType,
  normalise: (name: string) => string,
): StreetKnowledgeEntry | undefined {
  const key = normalise(name);
  return index.get(`${type}:${key}`)
    || index.get(`${type === 'street' ? 'water' : 'street'}:${key}`);
}
