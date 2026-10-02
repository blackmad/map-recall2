/**
 * Gap-filling for neighbourhood trivia (name origin, description, history,
 * photo) from sources the repo already holds or can name: sibling/alias areas,
 * street-name registers, what lies inside the boundary, other Wikipedia
 * articles that mention the area, and Wikimedia Commons.
 *
 * Everything here is pure (no network, no files) so it is tested and runs the
 * same offline and online. Each candidate carries its method, source and a
 * review flag; nothing is invented, and a field with no support stays empty.
 * The CLI is `scripts/fill-neighborhood-gaps.ts`.
 */

export type LatLng = [number, number];
/** polygons -> rings -> [lat, lng]; ring 0 is the outer ring. */
export type Polygons = LatLng[][][];

export interface Boundary { id: number; name: string; kind: string; adminLevel: number; geometry: Polygons }

export type Field = 'description' | 'history' | 'nameOrigin' | 'photo';
export const FIELDS: Field[] = ['description', 'history', 'nameOrigin', 'photo'];

export interface Coverage { name: string; kind: string; description: boolean; history: boolean; nameOrigin: boolean; photo: boolean }

export interface Candidate {
  name: string;
  field: Field;
  /** English or Dutch text; absent for photos. */
  text?: string;
  lang?: 'en' | 'nl';
  imageUrl?: string;
  imageAttribution?: string;
  sourceUrl: string;
  sourceLabel: string;
  /** How it was found, for the report and for choosing between candidates. */
  method: 'alias' | 'street-name' | 'street-theme' | 'inside-boundary' | 'inside-fact' | 'wiki-article' | 'wikidata-search' | 'wiki-mention' | 'district-article' | 'commons-category' | 'commons-geosearch';
  confidence: 'high' | 'medium' | 'low';
  /** True when a person (or the translation pass) must read it before it ships. */
  needsReview: boolean;
  note?: string;
}

// ---------------------------------------------------------------------------
// Geometry

export function pointInPolygons(point: LatLng, polygons: Polygons): boolean {
  for (const polygon of polygons) {
    const ring = polygon[0];
    if (!ring || ring.length < 3) continue;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i], [yj, xj] = ring[j];
      if ((yi > point[0]) !== (yj > point[0]) && point[1] < ((xj - xi) * (point[0] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

export function centroidOf(polygons: Polygons): LatLng {
  let lat = 0, lng = 0, n = 0;
  for (const polygon of polygons) for (const [a, b] of polygon[0] ?? []) { lat += a; lng += b; n++; }
  return n ? [lat / n, lng / n] : [0, 0];
}

export function areaKm2(polygons: Polygons): number {
  let total = 0;
  for (const polygon of polygons) {
    const ring = polygon[0];
    if (!ring || ring.length < 4) continue;
    const kx = 111.32 * Math.cos((ring[0][0] * Math.PI) / 180), ky = 110.54;
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      sum += ring[j][1] * kx * (ring[i][0] * ky) - ring[i][1] * kx * (ring[j][0] * ky);
    }
    total += Math.abs(sum) / 2;
  }
  return total;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const kx = 111.32 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * 110.54, (a[1] - b[1]) * kx);
}

/** The district and quarter (if any) whose outline holds the area's centroid. */
export function parentsOf(hood: Boundary, all: readonly Boundary[]): { district?: string; quarter?: string } {
  const c = centroidOf(hood.geometry);
  const holds = (kind: string) => all.find(b => b !== hood && b.kind === kind && pointInPolygons(c, b.geometry))?.name;
  return { district: holds('suburb'), quarter: holds('quarter') };
}

// ---------------------------------------------------------------------------
// Names

export const flat = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** "Rijnbuurt" -> "rijn", "Van Galenbuurt" -> "vangalen", "Polder Meerzicht" -> "meerzicht". */
export function stemOf(name: string): string {
  const base = name.split('/')[0].replace(/\s+e\.o\.$/i, '').replace(/^polder\s+/i, '');
  return flat(base).replace(/(buurt|wijk|eiland|kwartier|dorp)$/, '');
}

/** Names that are the same place under two outlines ("Nieuwmarkt/Lastage" and "Nieuwmarktbuurt"). */
export function aliasOf(name: string, others: readonly string[]): string | null {
  const parts = name.split('/').map(stemOf).filter(p => p.length >= 4);
  for (const other of others) {
    if (other === name) continue;
    const stems = other.split('/').map(stemOf);
    if (parts.some(p => stems.includes(p))) return other;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Coverage

export function auditCoverage(
  hoods: readonly Boundary[],
  history: ReadonlyMap<string, { description?: unknown; history?: unknown; nameOrigin?: unknown }>,
  photos: ReadonlyMap<string, { imageUrl?: string; wikipediaExtract?: string }>,
): Coverage[] {
  return hoods.filter(h => h.kind !== 'municipality').map(h => {
    const entry = history.get(h.name), photo = photos.get(h.name);
    return {
      name: h.name, kind: h.kind,
      description: !!(entry?.description || photo?.wikipediaExtract),
      history: !!entry?.history,
      nameOrigin: !!entry?.nameOrigin,
      photo: !!photo?.imageUrl,
    };
  });
}

export const missingFields = (c: Coverage): Field[] => FIELDS.filter(f => !c[f]);

// ---------------------------------------------------------------------------
// Street matching

export interface StreetOrigin { name: string; kind: string; en?: string; bagId?: string }
export interface StreetSegment { name: string; center: LatLng }

/** Streets whose name begins with `stem` at a word boundary ("Jan van Galenstraat" for "vangalen"). */
export function streetsMatchingStem(stem: string, origins: readonly StreetOrigin[]): StreetOrigin[] {
  if (stem.length < 4) return [];
  // A name may begin mid-way only for a surname with a particle ("Jan van Galenstraat" for "vangalen");
  // otherwise "Mary van der Sluisstraat" would pass for Sluisbuurt.
  const particle = /^(van|de|der|den|ter|ten|het|te)/.test(stem);
  const kindRank: Record<string, number> = { street: 0, water: 1, bridge: 2 };
  const out: StreetOrigin[] = [];
  for (const origin of origins) {
    if (!(origin.kind in kindRank)) continue;
    const tokens = origin.name.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      if (i > 0 && !particle) break;
      if (flat(tokens.slice(i).join(' ')).startsWith(stem)) { out.push(origin); break; }
    }
  }
  // The most specific name first: streets before waters before bridges, then the shortest.
  return out.sort((a, b) => kindRank[a.kind] - kindRank[b.kind] || flat(a.name).length - flat(b.name).length || a.name.localeCompare(b.name));
}

/** Whether a street of this name has a segment in or near the area (a namesake across town does not count). */
export function streetIsNearby(name: string, segments: readonly StreetSegment[], hood: Boundary, slackKm = 0.6): boolean {
  const c = centroidOf(hood.geometry);
  let radius = 0;
  for (const polygon of hood.geometry) for (const p of polygon[0] ?? []) radius = Math.max(radius, distanceKm(c, p));
  return segments.some(s => s.name === name && (pointInPolygons(s.center, hood.geometry) || distanceKm(c, s.center) <= radius + slackKm));
}

/** Street names with a segment inside the boundary, most segments first. */
export function streetsInside(hood: Boundary, segments: readonly StreetSegment[]): string[] {
  const counts = new Map<string, number>();
  for (const s of segments) if (s.name && pointInPolygons(s.center, hood.geometry)) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
}

const THEMES: Array<{ id: string; pattern: RegExp; phrase: string; nameHint?: RegExp }> = [
  { id: 'sport', nameHint: /sport|held/, pattern: /\b(athlete|footballer|football player|skater|speed skater|cyclist|swimmer|sportsman|sportswoman|boxer|runner|tennis|wrestler|olympic)\b/i, phrase: 'sportspeople' },
  { id: 'baltic', nameHint: /eiland/, pattern: /\b(baltic|estonia|latvia|lithuania|sweden|finland|russia|reval|tallinn|riga|vyborg|wiborg|libau|liepaja|karlskrona|memel|klaipeda)\b/i, phrase: 'Baltic Sea ports' },
  { id: 'river', nameHint: /rijn|maas|schelde|ijsel|vecht|waal/, pattern: /\b(river|tributary|rhine|meuse|scheldt|ijssel|waal|vecht)\b/i, phrase: 'rivers' },
  { id: 'artist', pattern: /\b(painter|artist|sculptor|illustrator|photographer)\b/i, phrase: 'artists' },
  { id: 'writer', pattern: /\b(poet|writer|author|novelist|playwright|journalist)\b/i, phrase: 'writers and poets' },
  { id: 'composer', pattern: /\b(composer|conductor|musician|singer|pianist|violinist)\b/i, phrase: 'musicians' },
  { id: 'resistance', pattern: /\b(resistance|resistance fighter|victim of the (?:second world war|holocaust)|nazi)\b/i, phrase: 'people of the wartime resistance and its victims' },
  { id: 'scientist', pattern: /\b(scientist|physician|physicist|astronomer|mathematician|chemist|biologist)\b/i, phrase: 'scientists' },
  { id: 'colonial', nameHint: /indisch|indie|koloni|suriname/, pattern: /\b(east india|west india|suriname|indonesia|dutch east indies|colonial)\b/i, phrase: 'the Dutch colonial world' },
  { id: 'plants', pattern: /\b(flower|plant|tree|herb)\b/i, phrase: 'plants and flowers' },
];

export interface ThemeHit { phrase: string; streets: string[]; /** Whether the area's own name points at this theme. */ nameHint?: RegExp }

/**
 * A shared reason behind the names of the streets inside an area, read from
 * the register's own explanations. Needs at least three streets and a clear
 * majority of those with an explanation, so one famous street cannot set it.
 */
export function streetTheme(inside: readonly string[], origins: readonly StreetOrigin[]): ThemeHit | null {
  const byName = new Map(origins.filter(o => o.kind === 'street' && o.en).map(o => [o.name, o]));
  const explained = inside.map(n => byName.get(n)).filter((o): o is StreetOrigin => !!o);
  if (explained.length < 3) return null;
  let best: { theme: (typeof THEMES)[number]; hits: StreetOrigin[] } | null = null;
  for (const theme of THEMES) {
    const hits = explained.filter(o => theme.pattern.test(o.en!));
    if (hits.length >= 3 && hits.length / explained.length >= 0.5 && (!best || hits.length > best.hits.length)) best = { theme, hits };
  }
  return best ? { phrase: best.theme.phrase, streets: best.hits.slice(0, 6).map(o => o.name), nameHint: best.theme.nameHint } : null;
}

export const BAG_LABEL = 'Gemeente Amsterdam street-name register';
export const bagUrl = (bagId?: string) => bagId ? `https://api.data.amsterdam.nl/v1/bag/openbareruimtes/${bagId}/` : 'https://api.data.amsterdam.nl/v1/bag/openbareruimtes/';

// ---------------------------------------------------------------------------
// Offline candidates

export interface OfflineInput {
  hood: Boundary;
  all: readonly Boundary[];
  origins: readonly StreetOrigin[];
  segments: readonly StreetSegment[];
  places: ReadonlyArray<{ id?: string; name: string; type: string; center: LatLng }>;
  /** Reviewed Wikipedia facts per feature (`facts.json`), for trivia about what lies inside the area. */
  facts?: readonly FactFeature[];
  missing: readonly Field[];
  /** Used in composed text; Amsterdam when omitted. */
  cityName?: string;
}

const KIND_WORD: Record<string, string> = { neighbourhood: 'neighbourhood', neighborhood: 'neighbourhood', quarter: 'area', suburb: 'district', locality: 'area', city_block: 'block' };

/** Sentence list like "A, B and C". */
export const list = (items: readonly string[]) => items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Street-name and inside-the-boundary candidates for one area. */
export function offlineCandidates(input: OfflineInput): Candidate[] {
  const { hood, origins, segments, places, missing, facts = [] } = input;
  const out: Candidate[] = [];
  const inside = streetsInside(hood, segments);

  const theme = streetTheme(inside, origins);
  const themeSentence = theme ? `Many streets here are named after ${theme.phrase}, such as ${list(theme.streets.slice(0, 4))}.` : undefined;
  const themeSource = theme ? origins.find(o => o.name === theme.streets[0] && o.kind === 'street') : undefined;

  // Districts ("Zuid", "Oost") are far too short to match a street name on.
  if (missing.includes('nameOrigin') && hood.kind !== 'suburb') {
    const stem = stemOf(hood.name);
    const matches = streetsMatchingStem(stem, origins).filter(o => streetIsNearby(o.name, segments, hood));
    const best = matches.find(o => o.en);
    const exact = best && flat(best.name) === flat(hood.name);
    if (best?.en) {
      out.push({
        name: hood.name, field: 'nameOrigin', lang: 'en',
        // The register entry for this very name explains it; a merely similar street is worded as a match.
        text: exact ? best.en : `The name matches ${best.name}, in the area. ${best.en}`,
        sourceUrl: bagUrl(best.bagId), sourceLabel: BAG_LABEL, method: 'street-name',
        confidence: exact ? 'high' : stem.length >= 6 ? 'medium' : 'low', needsReview: !exact,
        note: `matched ${matches.length} street(s) on stem "${stem}": ${matches.slice(0, 4).map(m => m.name).join(', ')}`,
      });
    } else if (theme && themeSentence && theme.nameHint?.test(flat(hood.name))) {
      out.push({
        name: hood.name, field: 'nameOrigin', lang: 'en', text: themeSentence,
        sourceUrl: bagUrl(themeSource?.bagId), sourceLabel: BAG_LABEL, method: 'street-theme',
        confidence: 'medium', needsReview: true,
        note: `theme "${theme.phrase}" from ${theme.streets.length} of ${inside.length} streets inside`,
      });
    }
  }

  // Trivia from what lies inside the area: the best reviewed Wikipedia fact about a landmark, park,
  // square, bridge, canal or street there. A list of street names is not trivia, so none is composed.
  if (missing.includes('description') || missing.includes('history')) {
    const inPlaces = places.filter(p => p.id && pointInPolygons(p.center, hood.geometry));
    for (const field of ['description', 'history'] as const) {
      if (!missing.includes(field)) continue;
      const pick = insideFact(inPlaces, facts, field === 'history' ? ['history'] : ['surprise', 'culture', 'people', 'design']);
      if (pick) out.push({
        name: hood.name, field, lang: 'en', text: pick.text,
        sourceUrl: pick.sourceUrl, sourceLabel: pick.sourceLabel, method: 'inside-fact',
        confidence: 'medium', needsReview: false,
        note: `${pick.feature} (${pick.collection}), fact kind ${pick.kind}; ${inPlaces.length} places inside`,
      });
    }
  }
  return out;
}

export interface FactFeature {
  id: string;
  name: string;
  collection: string;
  facts: ReadonlyArray<{ text: string; kind: string; sourceUrl: string; sourceLanguage?: string }>;
}

const COLLECTION_WORD: Record<string, string> = { landmarks: 'landmark', parks: 'park', squares: 'square', bridges: 'bridge', water: 'waterway', streets: 'street' };

/**
 * The best fact about something inside an area, from the first of `kinds` that has one: landmarks and
 * parks before bridges and streets, a sentence of reading length, and the feature named so it makes
 * sense out of context. The source is that feature's own Wikipedia article.
 */
export function insideFact(
  places: ReadonlyArray<{ id?: string; name: string }>,
  facts: readonly FactFeature[],
  kinds: readonly string[],
): { text: string; sourceUrl: string; sourceLabel: string; feature: string; collection: string; kind: string } | null {
  const ids = new Set(places.map(p => p.id));
  const rank: Record<string, number> = { landmarks: 0, parks: 1, squares: 2, water: 3, bridges: 4, streets: 5 };
  const inside = facts.filter(f => ids.has(f.id) && f.facts.length).sort((a, b) => (rank[a.collection] ?? 9) - (rank[b.collection] ?? 9) || a.name.localeCompare(b.name));
  for (const kind of kinds) {
    for (const feature of inside) {
      const fact = feature.facts.find(f => f.kind === kind && f.text.length >= 50 && f.text.length <= 260);
      if (!fact) continue;
      const first = flat(feature.name.split(/[ ,(-]/)[0]);
      // "The tower…" says nothing out of context: name the place unless the sentence already does.
      const text = first.length >= 4 && flat(fact.text).includes(first) ? fact.text : `${feature.name} (${COLLECTION_WORD[feature.collection] ?? 'place'} here): ${fact.text}`;
      return { text, sourceUrl: fact.sourceUrl, sourceLabel: fact.sourceLanguage === 'nl' ? 'Wikipedia (translated from Dutch)' : 'Wikipedia', feature: feature.name, collection: feature.collection, kind };
    }
  }
  return null;
}

/** Copy missing fields from the area this one is an alias of. */
export function aliasCandidates(
  name: string,
  alias: string,
  donor: { description?: { text: string; lang: 'en' | 'nl'; sourceUrl: string }; history?: { text: string; lang: 'en' | 'nl'; sourceUrl: string }; nameOrigin?: { text: string; lang: 'en' | 'nl'; sourceUrl: string }; photo?: { imageUrl: string; imageAttribution?: string } },
  missing: readonly Field[],
): Candidate[] {
  const out: Candidate[] = [];
  for (const field of ['description', 'history', 'nameOrigin'] as const) {
    const source = donor[field];
    if (missing.includes(field) && source) {
      out.push({ name, field, text: source.text, lang: source.lang, sourceUrl: source.sourceUrl, sourceLabel: 'Wikipedia', method: 'alias', confidence: 'high', needsReview: source.lang === 'nl', note: `same place as "${alias}"` });
    }
  }
  if (missing.includes('photo') && donor.photo) {
    out.push({ name, field: 'photo', imageUrl: donor.photo.imageUrl, imageAttribution: donor.photo.imageAttribution, sourceUrl: donor.photo.imageUrl, sourceLabel: 'Wikimedia Commons', method: 'alias', confidence: 'high', needsReview: false, note: `same place as "${alias}"` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Online helpers (pure parts)

const SENTENCE_SPLIT = /(?<![\s(](?:lit|St|ca|c|o\.a|bijv|resp|nr|Mr|Dr|jr|sr)\.)(?<=[.!?])\s+(?=[A-Z"“'(])/;

/**
 * Sentences from another article that are about this area: they contain its
 * name and read as a description ("… is een buurt in …"), most informative
 * first. Used for areas with no article of their own.
 */
export function sentencesAbout(text: string, name: string, max = 420): string | undefined {
  const core = name.split('/')[0].replace(/\s+e\.o\.$/i, '').trim();
  // Short names ("Oost", "West") appear inside other names ("Amsterdam-Oost"): never trust them.
  if (flat(core).length < 5) return undefined;
  const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  // Whole name, as written, not glued to a longer word or a hyphenated compound.
  const whole = new RegExp(`(^|[^\\p{L}\\p{N}-])${escaped}(?![\\p{L}\\p{N}-])`, 'u');
  const sentences = text.replace(/\s+/g, ' ').split(SENTENCE_SPLIT).map(s => s.trim()).filter(Boolean);
  const hits = sentences.filter(s => whole.test(s));
  if (!hits.length) return undefined;
  const definition = hits.filter(s => /\b(is|was|vormt|ligt|bestaat|betreft|are|lies|forms)\b/i.test(s) && /\b(buurt|wijk|neighbou?rhood|district|quarter|eiland|island|plein|straat|gebied|area)\b/i.test(s));
  const chosen = (definition.length ? definition : hits).slice(0, 2);
  let out = '';
  for (const s of chosen) { if (out && out.length + s.length + 1 > max) break; out = out ? `${out} ${s}` : s; }
  return out || undefined;
}

export interface CommonsFile {
  title: string;
  url: string;
  thumbUrl?: string;
  width: number;
  height: number;
  mime: string;
  license?: string;
  artist?: string;
  categories?: string;
}

const NOT_A_PHOTO = /(map|kaart|logo|flag|vlag|wapen|coat[_ ]of[_ ]arms|locator|plattegrond|diagram|schema|poster|stamp|icon|panorama\.svg|\.svg|\.pdf|\.tif|\.ogg|\.webm)/i;
const FREE_LICENCE = /(cc[- ]?by|cc0|public domain|pd[- ]|gfdl|attribution)/i;

/** Commons files worth showing as a postcard photo, best first. */
export function rankCommonsFiles(files: readonly CommonsFile[], name: string): CommonsFile[] {
  const core = flat(name.split('/')[0]);
  const score = (f: CommonsFile) => {
    const ratio = f.width / Math.max(1, f.height);
    let s = 0;
    if (ratio >= 1.25 && ratio <= 2.2) s += 3; else if (ratio >= 1) s += 1;
    if (f.width >= 1200) s += 2; else if (f.width >= 800) s += 1;
    if (flat(f.title).includes(core) || flat(f.categories ?? '').includes(core)) s += 3;
    return s;
  };
  return files
    .filter(f => /^image\/jpeg$/i.test(f.mime) && f.width >= 800 && !NOT_A_PHOTO.test(f.title) && (!f.license || FREE_LICENCE.test(f.license)))
    .sort((a, b) => score(b) - score(a));
}

export const commonsAttribution = (f: CommonsFile) =>
  `Wikimedia Commons: ${f.title.replace(/^File:/, '')}${f.artist ? ` (${f.artist.replace(/<[^>]+>/g, '').trim()}${f.license ? `, ${f.license}` : ''})` : f.license ? ` (${f.license})` : ''}`;

/** Dutch Wikipedia / Wikidata hits that are really this place. */
export function wikidataLooksRight(description: string | undefined, label: string, name: string, cityPattern = 'Amsterdam'): boolean {
  if (!description) return false;
  if (!new RegExp(cityPattern, 'i').test(description)) return false;
  if (!/(buurt|wijk|neighbou?rhood|district|quarter|eiland|island|park|polder|kwartier|dorp)/i.test(description)) return false;
  return flat(label).includes(stemOf(name)) || stemOf(name).includes(flat(label).replace(/(buurt|wijk|eiland)$/, ''));
}

// ---------------------------------------------------------------------------
// Choosing between candidates

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 } as const;
/** Quoted from an article beats composed from data; composed from data beats a stray sentence. */
const METHOD_RANK: Record<Candidate['method'], number> = {
  alias: 6, 'wiki-article': 6, 'wikidata-search': 5, 'street-name': 4, 'district-article': 4, 'street-theme': 3,
  'commons-category': 3, 'inside-fact': 3, 'inside-boundary': 2, 'wiki-mention': 2, 'commons-geosearch': 1,
};

/** Best first: confidence, then method, then English over Dutch (no translation needed). */
export function compareCandidates(a: Candidate, b: Candidate): number {
  return CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]
    || METHOD_RANK[b.method] - METHOD_RANK[a.method]
    || Number(b.lang === 'en') - Number(a.lang === 'en');
}

/** Whether a later candidate may replace text already published: only composed text, never an article. */
export const replaceableBy = (existingKind: string | undefined, candidate: Candidate) =>
  existingKind === 'derived' && (candidate.method === 'alias' || candidate.method === 'wiki-article' || candidate.method === 'wikidata-search');

/** Merge new candidates into old ones, keeping each (area, field, method) once, newest winning. */
export function mergeCandidates(previous: readonly Candidate[], found: readonly Candidate[]): Candidate[] {
  const key = (c: Candidate) => `${c.name}|${c.field}|${c.method}`;
  const fresh = new Set(found.map(key));
  return [...previous.filter(c => !fresh.has(key(c))), ...found];
}

export const ONLINE_METHODS: ReadonlySet<Candidate['method']> = new Set(['wiki-article', 'wikidata-search', 'wiki-mention', 'district-article', 'commons-category', 'commons-geosearch']);

const HISTORY_CUE = /\b(1[0-9]{3}|20[0-2][0-9])\b|\b\d{1,2}(?:e|de|st|nd|rd|th)[ -](?:eeuw|century)|\b(?:eeuw|century)\b|\bjaren (?:twintig|dertig|veertig|vijftig|zestig|zeventig|tachtig|negentig)\b|\b(?:19|20)\d0s\b/i;

/**
 * Many short articles (new districts, islands) have no "History" heading but tell the history in
 * running prose ("laid out in the 19th century … redeveloped since the 1990s"). Sentences with a
 * dated cue, skipping those already used as the description, make a short history.
 * Returns undefined when there are fewer than one such sentence of useful length.
 */
export function historyFromBody(sentences: readonly string[], alreadyUsed = ''): string | undefined {
  const used = alreadyUsed.replace(/\s+/g, ' ');
  const hits = sentences
    .map(s => s.trim())
    .filter(s => s.length >= 40 && s.length <= 400 && HISTORY_CUE.test(s) && !used.includes(s));
  return hits.length ? hits.slice(0, 2).join(' ') : undefined;
}
