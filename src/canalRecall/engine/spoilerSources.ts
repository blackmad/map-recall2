/**
 * The names the game may ask about, kept per source as vector-map.js `setSpoilerNames(names, source)` keeps them (lane
 * E5, #218). The game sets two: 'extract' (landmarkRuntime.ts: the extract's streets, water, bridges, transit stops and
 * bridge display names) and 'track' (game-route.js at every route start: the route network's segment names, one entry
 * per segment). The own engine kept only the last list, so every route start replaced the extract's names with the
 * track's: a POI named after a bridge or canal off the road network was no longer screened, and the label policy
 * rebuilt its spoiler index from tens of thousands of repeated segment names in the ride-start frame.
 */
export class SpoilerSources {
  private readonly sources = new Map<string, readonly string[]>();
  private union: string[] = [];

  /** Replace one source's names; returns the union of every source, each name once, in first-seen order. */
  set(names: readonly string[] | null | undefined, source = 'extract'): string[] {
    this.sources.set(source, names || []);
    const seen = new Set<string>();
    for (const list of this.sources.values()) for (const n of list) if (n) seen.add(n);
    this.union = [...seen];
    return this.union;
  }
  names(): string[] { return this.union; }
}
