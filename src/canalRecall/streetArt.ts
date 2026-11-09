/**
 * Street-side art and memorials: sculptures, murals, fountains and monuments
 * that stand in the street, not in a building, so no building click and no
 * POI-in-footprint card ever reached them. ~1,050 located Wikidata items with
 * an article (audit 2026-10-31) plus OSM's named artworks.
 *
 * `street-art.json` (built by `scripts/build-street-art.ts`) holds the points;
 * a click on the ground within STREET_ART_CLICK_METRES of one opens its card
 * (`landmarkRuntime._inspectBuildingAt`), and the orientation POI layer
 * labels the OSM-mapped ones at ground level (category `art`).
 */
import type { LandmarkNotice } from './game/worldTypes';
import { t } from '../i18n/index.ts';

export const STREET_ART_VERSION = 1;
/** How far from a point a ground click still means it: a statue's plinth and a little. */
export const STREET_ART_CLICK_METRES = 14;

export type StreetArtKind = 'sculpture' | 'statue' | 'mural' | 'memorial' | 'fountain' | 'monument' | 'relief' | 'installation' | 'artwork';

export interface StreetArtPoint {
  /** OSM id (`n123`) or Wikidata id (`Q123`) when OSM has no node. */
  id: string;
  name: string;
  lng: number;
  lat: number;
  k: StreetArtKind;
  /** Artist, year as OSM/Wikidata give them. */
  a?: string;
  y?: string;
  /** Article: title, URL, lede (English unless `l`), thumbnail, Wikidata item. */
  t?: string;
  u?: string;
  e?: string;
  l?: string;
  i?: string;
  q?: string;
  /** Series this piece belongs to ("Beeldenroute Brettensuite"), its place in it, and the series size. When set
   *  and `t` is absent, `e`/`u`/`i` are the series' own text, not the piece's. */
  s?: string;
  n?: number;
  m?: number;
}

export interface StreetArtFile {
  version: number;
  source: string;
  points: StreetArtPoint[];
}

export const STREET_ART_KINDS: readonly StreetArtKind[] = ['sculpture', 'statue', 'mural', 'memorial', 'fountain', 'monument', 'relief', 'installation', 'artwork'];

/** OSM `artwork_type` / `historic` and Wikidata class labels → a kind. */
export function streetArtKind(hint: string | null | undefined): StreetArtKind {
  const h = (hint ?? '').toLowerCase();
  if (/mural|graffiti|street art|painting/.test(h)) return 'mural';
  if (/statue|bust/.test(h)) return 'statue';
  if (/memorial|war memorial|plaque|commemorat/.test(h)) return 'memorial';
  if (/fountain/.test(h)) return 'fountain';
  if (/relief/.test(h)) return 'relief';
  if (/installation|light art|land art/.test(h)) return 'installation';
  if (/sculpture|group of sculptures/.test(h)) return 'sculpture';
  if (/monument|obelisk|column/.test(h)) return 'monument';
  return 'artwork';
}

const metresBetween = (aLng: number, aLat: number, bLng: number, bLat: number) => {
  const kx = 111_320 * Math.cos(aLat * Math.PI / 180);
  return Math.hypot((aLng - bLng) * kx, (aLat - bLat) * 110_540);
};
const cellOf = (lng: number, lat: number) => `${Math.floor(lng * 2000)}:${Math.floor(lat * 4000)}`;

/** The points on a ~50 m grid, for a click's nearest-within-radius lookup. */
export class StreetArtIndex {
  private readonly cells = new Map<string, StreetArtPoint[]>();
  private readonly ids = new Map<string, StreetArtPoint>();
  readonly size: number;
  constructor(file: StreetArtFile | null | undefined) {
    let n = 0;
    for (const point of file?.points ?? []) {
      if (!point || typeof point.name !== 'string' || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) continue;
      const key = cellOf(point.lng, point.lat);
      (this.cells.get(key) ?? this.cells.set(key, []).get(key)!).push(point);
      if (point.id) this.ids.set(point.id, point);
      n++;
    }
    this.size = n;
  }

  /** The record for one OSM or Wikidata id: how a mapped artwork node finds its text. */
  byId(id: string | null | undefined): StreetArtPoint | null { return (id && this.ids.get(id)) || null; }

  nearest(lng: number, lat: number, radiusMetres = STREET_ART_CLICK_METRES): StreetArtPoint | null {
    const cx = Math.floor(lng * 2000), cy = Math.floor(lat * 4000);
    let best: StreetArtPoint | null = null, bestD = radiusMetres;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const point of this.cells.get(`${cx + dx}:${cy + dy}`) ?? []) {
        const d = metresBetween(lng, lat, point.lng, point.lat);
        // Ties go to the one with an article.
        if (d < bestD || (d === bestD && best && !best.e && point.e)) { best = point; bestD = d; }
      }
    }
    return best;
  }
}

const osmUrl = (id: string) => /^n\d+$/.test(id) ? `https://www.openstreetmap.org/node/${id.slice(1)}` : /^w\d+$/.test(id) ? `https://www.openstreetmap.org/way/${id.slice(1)}` : '';
const KIND_LABEL: Record<StreetArtKind, string> = {
  sculpture: 'A sculpture', statue: 'A statue', mural: 'A mural', memorial: 'A memorial', fountain: 'A fountain',
  monument: 'A monument', relief: 'A relief', installation: 'An art installation', artwork: 'An artwork',
};

/** "a statue", "a mural": the street-art kind as a phrase, for the line under a place's name. */
export const streetArtKindPhrase = (k: StreetArtKind): string => (KIND_LABEL[k] ?? 'An artwork').toLowerCase();

/** What the register knows when there is no article: kind, artist, year. */
export function streetArtFallbackDetail(point: Pick<StreetArtPoint, 'k' | 'a' | 'y'>): string {
  const by = point.a ? ` by ${point.a}` : '';
  const year = point.y ? ` (${point.y})` : '';
  // "An artwork by X" is the placeholder the user rejected (2026-11-09): an untyped piece leads with the facts.
  if (point.k === 'artwork') return point.a ? `By ${point.a}${year}.` : point.y ? `From ${point.y}.` : 'Mapped as public art.';
  return `${KIND_LABEL[point.k] ?? 'An artwork'}${by}${year}, mapped here.`;
}

/** The card for a clicked piece of street art; `titleSpoils` keeps a name
 *  that answers an open question off the card (it names the kind instead). */
export function streetArtCard(point: StreetArtPoint, titleSpoils = false): LandmarkNotice {
  // A series piece with no article of its own says where it stands in the series, then the series text.
  const part = point.s && point.n && point.m ? t('poi.seriesPart', { n: point.n, m: point.m, series: point.s }) : '';
  const detail = part ? [part, point.e].filter(Boolean).join(' ') : point.e || streetArtFallbackDetail(point);
  const register = point.e && (point.a || point.y) ? streetArtFallbackDetail(point) : '';
  return {
    id: `street-art-${point.id}`,
    name: titleSpoils ? (KIND_LABEL[point.k] ?? 'An artwork') : point.name,
    type: point.k,
    detail,
    longDetail: register ? `${detail}\n\n${register}` : detail,
    ...(point.u ? { wikipediaUrl: point.u } : {}),
    ...(osmUrl(point.id) ? { sourceUrl: osmUrl(point.id) } : {}),
    imageUrl: point.i ?? '',
    extractLang: point.l ?? 'en',
    ...(point.q ? { wikidata: point.q } : {}),
    lngLat: [point.lng, point.lat],
    featureTarget: null,
  };
}
