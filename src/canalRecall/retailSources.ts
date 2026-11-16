// Round 7 (lane retail-look-20261114): second sources for shop hosting. OSM stays the base; another open source
// (Amsterdam's horeca permits, All the Places chain spiders, Overture places, the sign read off a panorama) either
// confirms an OSM shop's host pand, moves it (same business, other pand), adds a business OSM lacks, or flags an OSM
// one it does not list. Matching is by name within MATCH_M; the pand is decided by the caller from each record's point.
// Pure: Node scripts (scripts/retail-ground/second-sources.ts) and tests.

/** Same business when within this distance (m) and the names agree. */
export const MATCH_M = 60;
/** Words that say what a business is rather than which one. */
const GENERIC = new Set(['cafe', 'eetcafe', 'grandcafe', 'restaurant', 'bar', 'de', 'het', 't', 'the', 'en', 'and', 'bv', 'vof', 'amsterdam', 'coffeeshop', 'proeflokaal', 'bistro', 'brasserie', 'pizzeria', 'snackbar', 'cafetaria', 'lunchroom', 'hotel', 'b', 'v']);

export function nameTokens(s: string | undefined): string[] {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`´]/g, '').replace(/&/g, ' en ')
    .split(/[^a-z0-9]+/).filter(t => t && !GENERIC.has(t));
}

/** Two business names agree: the same distinctive words, or one's words all in the other (>= 4 letters in all). */
export function sameName(a: string | undefined, b: string | undefined): boolean {
  const x = nameTokens(a), y = nameTokens(b);
  if (!x.length || !y.length) return false;
  const raw = (v: string | undefined) => (v ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  if (raw(a) === raw(b)) return true;
  const jx = x.join(''), jy = y.join('');
  if (jx === jy) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  if (s.join('').length >= 4 && s.every(t => l.includes(t))) return true;
  // Glued or split spellings ("Bar Blij" / "BarBlij", "De Kroon" / "Dekroon").
  const [gs, gl] = jx.length <= jy.length ? [jx, jy] : [jy, jx];
  return gs.length >= 5 && gl.includes(gs);
}

export type SourceRec = { id: string; name: string; at: [number, number]; pand: string | null };
export type OsmRec = { id: string; name: string; at: [number, number]; pand: string | null };
export type Verdict = { source: SourceRec; osm: OsmRec | null; kind: 'confirm' | 'move' | 'add' | 'no-pand' };

/** Each source record against the OSM records: the nearest same-name OSM record within MATCH_M confirms (same pand)
 *  or moves (other pand); none is an add. `dist` gives metres between two [lng, lat]. Also the OSM records no source
 *  record matched (`unmatched`), which a full-coverage source (the permits) reads as stale or unpermitted. */
export function compareSources(src: readonly SourceRec[], osm: readonly OsmRec[], dist: (a: [number, number], b: [number, number]) => number, near: (at: [number, number]) => readonly OsmRec[] = () => osm): { verdicts: Verdict[]; unmatched: OsmRec[] } {
  const used = new Set<OsmRec>();
  const verdicts = src.map((s): Verdict => {
    const m = near(s.at).filter(o => sameName(s.name, o.name)).map(o => ({ o, d: dist(s.at, o.at) })).filter(v => v.d <= MATCH_M).sort((a, b) => a.d - b.d)[0]?.o ?? null;
    if (m) used.add(m);
    if (!s.pand) return { source: s, osm: m, kind: 'no-pand' };
    if (!m) return { source: s, osm: null, kind: 'add' };
    return { source: s, osm: m, kind: m.pand === s.pand ? 'confirm' : 'move' };
  });
  return { verdicts, unmatched: osm.filter(o => !used.has(o)) };
}

// Lane retail-real round 5: a business Overture lists only as permanently closed. On 82 sampled template pands read
// against 2025 panoramas, 5 of the 7 such were gone (vacant, another business, no shop) against 20 % for unflagged
// ones (artifacts/retail-real/r5, audit-assignment.ts). An OSM check_date on or after CLOSED_CONFIRM keeps it, and so
// does a brand: chain branches are the All the Places spiders' to confirm (the one sampled chain, an Etos, was open).
export const CLOSED_CONFIRM = '2026-01-01';
export type PlaceStatus = { name: string; status: string | null; d: number };
/** Every same-name place within MATCH_M is permanently closed (and there is at least one), and OSM has not re-checked it since. */
export function closedByOverture(name: string | undefined, places: readonly PlaceStatus[], checkDate?: string, brand?: string): boolean {
  if (!name || brand || (checkDate && checkDate >= CLOSED_CONFIRM)) return false;
  const same = places.filter(p => p.d <= MATCH_M && sameName(name, p.name));
  return same.length > 0 && same.every(p => p.status === 'permanently_closed');
}
