// Neighbourhood pages (GitHub #69): one static page per neighbourhood the ride's
// "Entering …" postcard can name, with its photo, the modelled buildings inside
// it, its trivia and name origins, and in-game frames. Everything here is pure:
// `scripts/build-buurt-pages.ts` reads the extracts and catalogues, hands them
// over as plain arrays, and writes the HTML that `template.ts` renders.

/** [lat, lng], the order the extracts store points in. */
export type LatLng = [number, number];
/** One polygon: outer ring first, then holes. */
export type Polygon = LatLng[][];

/** The kinds the ride's neighbourhood postcard covers (scripts/landing/content-stats.ts). */
export const POSTCARD_KINDS: ReadonlySet<string> = new Set(['neighbourhood', 'neighborhood', 'quarter']);

export interface BoundaryInput { name: string; kind?: string; geometry?: Polygon[] | null }
export interface EnrichmentInput { name: string; imageUrl?: string; imageAttribution?: string; wikipediaExtract?: string }
export interface SourcedText { en?: string; text?: string; sourceUrl?: string; sourceLabel?: string; borrowedFrom?: string }
export interface StoryInput { areaName: string; topFacts?: SourcedText[]; rotatingFacts?: SourcedText[] }
export interface HistoryInput { name: string; description?: SourcedText; nameOrigin?: SourcedText; history?: SourcedText; localFact?: SourcedText }
export interface AreaPhotoInput { imageUrl: string; imageAttribution?: string; sourceUrl?: string; title?: string }

export type BuildingKind = 'landmark' | 'landmark-kit' | 'block-face' | 'building';
export interface BuildingInput {
  id: string; name: string; kind: BuildingKind; lng: number; lat: number;
  /** A gallery or review page that shows this model on its own. */
  gallery?: string;
  /** A local reference photo (path relative to public/canal-drive/). */
  photo?: string;
  /** A remote open-licence photo and its credit. */
  remotePhoto?: { url: string; credit: string; sourceUrl?: string };
  triangles?: number;
  /** Bigger first when choosing what to photograph. */
  prominence?: number;
  /** A longer description the catalogue folded into the name, shown under it. */
  description?: string;
  /** Longest side in metres, when known: statues and benches are too small to frame from the street. */
  sizeM?: number;
}
export interface KitInstanceInput { unit: string; label: string; lng: number; lat: number }
/** A trivia subject (landmark, park, bridge, street, canal) with the points it covers. */
export interface FactSubjectInput { id: string; name: string; collection: string; points: LatLng[]; facts: { text: string; sourceUrl?: string }[] }
/** A named street, canal or bridge with the points it covers, and what we know of its name. */
export interface NamedPlaceInput { name: string; kind: 'street' | 'water' | 'bridge'; points: LatLng[]; origin?: string; register?: string }
/** A point a camera can stand on: a street vertex that rides can reach. */
export type StreetPoint = LatLng;

export interface Hood {
  name: string; slug: string; kind: string; polygons: Polygon[];
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  centre: LatLng; areaKm2: number;
}

export interface PostcardPhoto { url: string; credit: string; sourceUrl?: string; borrowedFrom?: string }
export interface PageFact { text: string; sourceUrl?: string; sourceLabel?: string }
export interface PageSubject { name: string; collection: string; facts: PageFact[] }
export interface PageName { name: string; origin?: string; register?: string }
export interface KitSummary { unit: string; label: string; count: number }
export interface ShotTarget { label: string; lng: number; lat: number; view: 'chase' | 'aerial'; at: [number, number, number] }

export interface BuurtPage {
  slug: string; name: string; kind: string; areaKm2: number; centre: LatLng;
  parent?: { name: string; slug: string };
  children: { name: string; slug: string }[];
  postcard?: PostcardPhoto;
  photos: PostcardPhoto[];
  intro?: PageFact;
  nameOrigin?: PageFact;
  stories: PageFact[];
  buildings: BuildingInput[];
  kits: KitSummary[];
  subjects: PageSubject[];
  streets: PageName[];
  waters: PageName[];
  bridges: PageName[];
  shotPlan: ShotTarget[];
}

const R = 6371008.8, RAD = Math.PI / 180;

export function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'area';
}

export function metres(a: LatLng, b: LatLng): number {
  const x = (b[1] - a[1]) * RAD * Math.cos((a[0] + b[0]) / 2 * RAD) * R, y = (b[0] - a[0]) * RAD * R;
  return Math.hypot(x, y);
}

/** Compass bearing in degrees from a to b. */
export function bearing(a: LatLng, b: LatLng): number {
  return (Math.atan2((b[1] - a[1]) * Math.cos(a[0] * RAD), b[0] - a[0]) / RAD + 360) % 360;
}

function inRing(lat: number, lng: number, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inHood(hood: Hood, [lat, lng]: LatLng): boolean {
  const b = hood.bbox;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return false;
  return hood.polygons.some(poly => poly.length > 0 && inRing(lat, lng, poly[0]) && !poly.slice(1).some(hole => inRing(lat, lng, hole)));
}

function ringAreaM2(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  const lat0 = ring[0][0] * RAD;
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1] * RAD * Math.cos(lat0) * R, yi = ring[i][0] * RAD * R;
    const xj = ring[j][1] * RAD * Math.cos(lat0) * R, yj = ring[j][0] * RAD * R;
    s += xj * yi - xi * yj;
  }
  return Math.abs(s) / 2;
}

/** Area-weighted centroid of the outer rings, nudged onto the nearest vertex when it falls outside (a crescent). */
function centreOf(hood: Omit<Hood, 'centre'>): LatLng {
  let ax = 0, ay = 0, aw = 0;
  for (const poly of hood.polygons) {
    const ring = poly[0] ?? [];
    const w = ringAreaM2(ring);
    if (!w || !ring.length) continue;
    const mx = ring.reduce((s, p) => s + p[1], 0) / ring.length, my = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    ax += mx * w; ay += my * w; aw += w;
  }
  const c: LatLng = aw ? [ay / aw, ax / aw] : [(hood.bbox.minLat + hood.bbox.maxLat) / 2, (hood.bbox.minLng + hood.bbox.maxLng) / 2];
  if (inHood({ ...hood, centre: c }, c)) return c;
  let best: LatLng = c, bestD = Infinity;
  for (const poly of hood.polygons) for (const p of poly[0] ?? []) { const d = metres(c, p); if (d < bestD) { bestD = d; best = p; } }
  return best;
}

/**
 * The postcard areas, one per name: the extract maps Chassébuurt twice (two
 * OSM relations), and the ride's card does not tell them apart, so neither do we.
 */
export function buildHoods(boundaries: readonly BoundaryInput[]): Hood[] {
  const byName = new Map<string, { kind: string; polygons: Polygon[] }>();
  for (const b of boundaries) {
    if (!POSTCARD_KINDS.has(b.kind ?? '') || !b.geometry?.length) continue;
    const polys = b.geometry.filter(p => p[0]?.length > 2);
    if (!polys.length) continue;
    const seen = byName.get(b.name);
    if (seen) seen.polygons.push(...polys);
    else byName.set(b.name, { kind: b.kind === 'neighborhood' ? 'neighbourhood' : b.kind!, polygons: [...polys] });
  }
  const slugs = new Set<string>();
  const hoods: Hood[] = [];
  for (const [name, { kind, polygons }] of byName) {
    let slug = slugify(name);
    for (let n = 2; slugs.has(slug); n++) slug = `${slugify(name)}-${n}`;
    slugs.add(slug);
    const bbox = { minLat: Infinity, minLng: Infinity, maxLat: -Infinity, maxLng: -Infinity };
    for (const poly of polygons) for (const [lat, lng] of poly[0]) {
      bbox.minLat = Math.min(bbox.minLat, lat); bbox.maxLat = Math.max(bbox.maxLat, lat);
      bbox.minLng = Math.min(bbox.minLng, lng); bbox.maxLng = Math.max(bbox.maxLng, lng);
    }
    const areaKm2 = polygons.reduce((s, p) => s + ringAreaM2(p[0]) - p.slice(1).reduce((h, r) => h + ringAreaM2(r), 0), 0) / 1e6;
    const base = { name, slug, kind, polygons, bbox, areaKm2 };
    hoods.push({ ...base, centre: centreOf(base) });
  }
  return hoods.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}

/** Wikimedia locator maps (a red dot on a province) are not a postcard (landmarkData.ts isLocatorMapImage). */
export function isLocatorMap(url: string): boolean {
  return /Map[_-]NL[_-]|Map_-_NL[_-]|\/Map_NL_|locator.?map|_kaart\./i.test(url);
}

/** Commons attribution strings read "Wikimedia Commons: File name.jpg (Author, CC BY-SA 3.0)". */
export function commonsFilePage(url: string): string | undefined {
  const m = /\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/.exec(url);
  return m ? `https://commons.wikimedia.org/wiki/File:${m[1]}` : undefined;
}

function textOf(t?: SourcedText): PageFact | undefined {
  const text = (t?.en ?? t?.text ?? '').trim();
  return text ? { text, sourceUrl: t?.sourceUrl, sourceLabel: t?.sourceLabel } : undefined;
}

function normaliseFact(text: string): string { return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

const STOP = new Set('the a an of in and to is was it its by for on at as from with which this that be are were or has had been'.split(' '));
const words = (text: string) => new Set(normaliseFact(text).split(' ').filter(w => w.length > 2 && !STOP.has(w)));

/**
 * Facts arrive from several pipelines (stories, history, per-feature trivia), and the
 * same sentence is often reworded between them ("Named after the Baltic port of Stettin"
 * twice). Two texts are the same fact when most of the shorter one's words are in the other.
 */
export class FactDeduper {
  private seen: Set<string>[] = [];
  /** True (and remembered) when `text` is new. */
  add(text: string): boolean {
    const w = words(text);
    if (!w.size) return false;
    for (const s of this.seen) {
      let shared = 0;
      for (const x of w) if (s.has(x)) shared++;
      if (shared / Math.min(w.size, s.size) >= 0.6) return false;
    }
    this.seen.push(w);
    return true;
  }
}

/** Up to `n` targets at least `gap` metres apart, in the order given. */
function spread<T extends { lat: number; lng: number }>(items: readonly T[], n: number, gap: number): T[] {
  const out: T[] = [];
  for (const it of items) {
    if (out.length >= n) break;
    if (out.every(o => metres([o.lat, o.lng], [it.lat, it.lng]) >= gap)) out.push(it);
  }
  return out;
}

/**
 * Where to stand to look at a target: the reachable street point nearest to
 * `ideal` metres away (between `min` and `max`), facing the target. Undefined
 * when no street comes within `max`.
 */
export function viewpoint(target: LatLng, streets: readonly StreetPoint[], ideal = 55, min = 18, max = 180): [number, number, number] | undefined {
  let best: StreetPoint | undefined, bestScore = Infinity;
  const dLat = max / 111_000, dLng = max / (111_000 * Math.cos(target[0] * RAD));
  for (const p of streets) {
    if (Math.abs(p[0] - target[0]) > dLat || Math.abs(p[1] - target[1]) > dLng) continue;
    const d = metres(p, target);
    if (d < min || d > max) continue;
    const score = Math.abs(d - ideal);
    if (score < bestScore) { bestScore = score; best = p; }
  }
  return best ? [best[1], best[0], Math.round(bearing(best, target))] : undefined;
}

const KIND_ORDER: Record<BuildingKind, number> = { landmark: 0, 'landmark-kit': 1, 'block-face': 2, building: 3 };

export interface BuurtInputs {
  boundaries: readonly BoundaryInput[];
  enrichments: readonly EnrichmentInput[];
  stories: readonly StoryInput[];
  history: readonly HistoryInput[];
  areaPhotos: Readonly<Record<string, readonly AreaPhotoInput[]>>;
  buildings: readonly BuildingInput[];
  kitInstances: readonly KitInstanceInput[];
  subjects: readonly FactSubjectInput[];
  names: readonly NamedPlaceInput[];
  streetPoints: readonly StreetPoint[];
  /** Chase frames per page, before the one aerial. */
  maxChaseShots?: number;
}

export function buildBuurtPages(input: BuurtInputs): BuurtPage[] {
  const hoods = buildHoods(input.boundaries);
  const enrich = new Map(input.enrichments.map(e => [e.name, e]));
  const stories = new Map(input.stories.map(s => [s.areaName, s]));
  const history = new Map(input.history.map(h => [h.name, h]));
  const maxChase = input.maxChaseShots ?? 3;
  const containing = (p: LatLng) => hoods.filter(h => inHood(h, p));

  // Smaller areas inside bigger ones: a quarter is the parent of the neighbourhoods its outline holds.
  const parentOf = new Map<string, Hood>();
  for (const h of hoods) {
    const holders = hoods.filter(o => o !== h && o.areaKm2 > h.areaKm2 * 1.2 && inHood(o, h.centre));
    holders.sort((a, b) => a.areaKm2 - b.areaKm2);
    if (holders[0]) parentOf.set(h.name, holders[0]);
  }

  const bucket = <T>() => new Map<string, T[]>(hoods.map(h => [h.name, []]));
  const buildings = bucket<BuildingInput>();
  for (const b of input.buildings) for (const h of containing([b.lat, b.lng])) buildings.get(h.name)!.push(b);
  const kits = bucket<KitInstanceInput>();
  for (const k of input.kitInstances) for (const h of containing([k.lat, k.lng])) kits.get(h.name)!.push(k);
  const subjects = bucket<FactSubjectInput>();
  for (const s of input.subjects) {
    const hits = new Set<Hood>();
    for (const p of s.points) for (const h of containing(p)) hits.add(h);
    for (const h of hits) subjects.get(h.name)!.push(s);
  }
  const names = bucket<NamedPlaceInput>();
  for (const n of input.names) {
    const hits = new Set<Hood>();
    for (const p of n.points) for (const h of containing(p)) hits.add(h);
    for (const h of hits) names.get(h.name)!.push(n);
  }

  // Postcard: the card's own photo, else the one the ride borrows from the enclosing area.
  const ownPhoto = (h: Hood): PostcardPhoto | undefined => {
    const e = enrich.get(h.name);
    if (!e?.imageUrl || isLocatorMap(e.imageUrl)) return undefined;
    return { url: e.imageUrl, credit: e.imageAttribution || 'Wikimedia Commons', sourceUrl: commonsFilePage(e.imageUrl) };
  };

  return hoods.map((h): BuurtPage => {
    const parent = parentOf.get(h.name);
    let postcard = ownPhoto(h);
    if (!postcard) {
      for (let p = parent; p && !postcard; p = parentOf.get(p.name)) {
        const borrowed = ownPhoto(p);
        if (borrowed) postcard = { ...borrowed, borrowedFrom: p.name };
      }
    }
    const photos: PostcardPhoto[] = (input.areaPhotos[h.name] ?? [])
      .filter(p => p.imageUrl && !isLocatorMap(p.imageUrl) && p.imageUrl !== postcard?.url)
      .slice(0, 6)
      .map(p => ({ url: p.imageUrl, credit: p.imageAttribution || 'Wikimedia Commons', sourceUrl: p.sourceUrl ?? commonsFilePage(p.imageUrl) }));

    const hist = history.get(h.name);
    const e = enrich.get(h.name);
    const intro = textOf(hist?.description) ?? (e?.wikipediaExtract ? { text: e.wikipediaExtract.replace(/\s*\.\.\.$/, '…') } : undefined);
    const seenFacts = new FactDeduper();
    if (intro) seenFacts.add(intro.text);
    // The name's story, unless the intro already tells it (Apollobuurt's "streets named after Greek legends").
    let nameOrigin = textOf(hist?.nameOrigin);
    if (nameOrigin && !seenFacts.add(nameOrigin.text)) nameOrigin = undefined;
    const storyFacts: PageFact[] = [];
    const story = stories.get(h.name);
    for (const f of [...(story?.topFacts ?? []), ...(story?.rotatingFacts ?? []), hist?.history, hist?.localFact]) {
      const t = textOf(f);
      if (!t || (f as SourcedText).borrowedFrom) continue;
      if (seenFacts.add(t.text)) storyFacts.push(t);
    }

    const blds = [...buildings.get(h.name)!].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
      || (b.prominence ?? 0) - (a.prominence ?? 0) || a.name.localeCompare(b.name, 'nl'));

    const kitCounts = new Map<string, KitSummary>();
    for (const k of kits.get(h.name)!) {
      const s = kitCounts.get(k.unit) ?? { unit: k.unit, label: k.label, count: 0 };
      s.count++; kitCounts.set(k.unit, s);
    }

    const subj: PageSubject[] = [];
    for (const s of subjects.get(h.name)!) {
      const facts = s.facts.map(f => ({ text: f.text.trim(), sourceUrl: f.sourceUrl })).filter(f => f.text && seenFacts.add(f.text)).slice(0, 4);
      if (facts.length) subj.push({ name: s.name, collection: s.collection, facts });
    }
    const COLLECTION_ORDER: Record<string, number> = { landmarks: 0, squares: 1, parks: 2, bridges: 3, water: 4, streets: 5 };
    subj.sort((a, b) => (COLLECTION_ORDER[a.collection] ?? 9) - (COLLECTION_ORDER[b.collection] ?? 9) || a.name.localeCompare(b.name, 'nl'));

    const pick = (kind: NamedPlaceInput['kind']): PageName[] => {
      const byName = new Map<string, PageName>();
      for (const n of names.get(h.name)!) {
        if (n.kind !== kind) continue;
        const prev = byName.get(n.name);
        byName.set(n.name, { name: n.name, origin: prev?.origin ?? n.origin, register: prev?.register ?? n.register });
      }
      return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
    };

    // Camera plan: the most notable models first, then trivia subjects with a point, then the area's centre.
    const candidates: { label: string; lat: number; lng: number; size: number }[] = [
      ...blds.filter(b => (b.sizeM ?? 20) >= 10).map(b => ({ label: b.name, lat: b.lat, lng: b.lng, size: b.sizeM ?? 20 })),
      ...subjects.get(h.name)!.filter(s => s.collection === 'landmarks' || s.collection === 'squares' || s.collection === 'bridges')
        .map(s => ({ label: s.name, lat: s.points[0][0], lng: s.points[0][1], size: 20 })),
      { label: `${h.name} centre`, lat: h.centre[0], lng: h.centre[1], size: 20 },
    ].filter(c => inHood(h, [c.lat, c.lng]));
    const shotPlan: ShotTarget[] = [];
    for (const c of spread(candidates, maxChase + 4, 110)) {
      if (shotPlan.length >= maxChase) break;
      const at = viewpoint([c.lat, c.lng], input.streetPoints, Math.min(110, Math.max(40, c.size * 1.3)));
      if (at) shotPlan.push({ label: c.label, lat: c.lat, lng: c.lng, view: 'chase', at });
    }
    const aerialAt = viewpoint(h.centre, input.streetPoints, 0, 0, 400);
    if (aerialAt) shotPlan.push({ label: `${h.name} from above`, lat: h.centre[0], lng: h.centre[1], view: 'aerial', at: aerialAt });

    return {
      slug: h.slug, name: h.name, kind: h.kind, areaKm2: h.areaKm2, centre: h.centre,
      parent: parent ? { name: parent.name, slug: parent.slug } : undefined,
      children: hoods.filter(o => parentOf.get(o.name) === h).map(o => ({ name: o.name, slug: o.slug })),
      postcard, photos, intro, nameOrigin, stories: storyFacts,
      buildings: blds,
      kits: [...kitCounts.values()].sort((a, b) => b.count - a.count),
      subjects: subj,
      streets: pick('street'), waters: pick('water'), bridges: pick('bridge'),
      shotPlan,
    };
  });
}

/**
 * Catalogue names are sometimes a whole brief ("Apollolaan 4 / Stadionweg 5 (Apollohal), Amsterdam-Zuid:
 * 1934 sports hall of brick …"): the part before the colon is the name, the rest a description.
 */
export function splitModelName(raw: string): { name: string; description?: string } {
  const name = raw.trim();
  const i = name.indexOf(': ');
  if (name.length <= 60 || i < 4) return { name };
  const rest = name.slice(i + 2).trim();
  return { name: name.slice(0, i).trim(), description: rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : undefined };
}

/** The ride at a spot, the same deep link What's New uses (`?travel=car` is the bike). */
export function rideUrl(lng: number, lat: number, prefix = '../'): string {
  const f = (n: number) => n.toFixed(4);
  return `${prefix}index.html?travel=car#race=${f(lat)},${f(lng)},${f(lat)},${f(lng)},${f(lat + 0.004)},${f(lng)}`;
}

/** "nw-portiek-brick-pitched" label "Nieuw-West type 1: four/five-storey brick portiekflat, pitched roof, …" → a short English name. */
export function kitLabel(label: string, fallback: string): string {
  const body = (label.split(':').slice(1).join(':') || label).split(' (')[0].trim();
  const short = body.split(', ').slice(0, 2).join(', ');
  const text = short || fallback.replace(/^nw-/, '').replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
