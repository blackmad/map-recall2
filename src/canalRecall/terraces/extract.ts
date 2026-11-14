/**
 * Café and restaurant terraces from the city's horeca permits (lane terraces-20261114). Pure: no IO.
 *
 * Source: Gemeente Amsterdam "Horeca exploitatievergunningen" (CC-BY 4.0), each permit with the permitted terrace as an
 * RD MultiPolygon (`terrasgeometrie`). scripts/terraces/fetch.ts caches the rows, scripts/terraces/build.ts keeps the
 * live granted permits with a terrace, converts RD to WGS84 (rdCoordinates.ts), simplifies, lays the furniture units
 * (placement.ts) and stages `terraces-v1/index.json`. The ride (engine/terraceLayer.ts) reads the published copy.
 *
 * Flag: default off. `?terraces=1` (or TERRACES=1 in Node) turns it on; `?terraces=0`, TERRACES=0 or
 * `globalThis.__canalRecallTerraces = false` force it off. Off, nothing is fetched and nothing is built.
 */
import { rdToLngLat } from '../rdCoordinates.js';

export const TERRACES_EXTRACT = 'terraces-v1';
export const TERRACES_VERSION = 1 as const;
export const TERRACES_SOURCE = {
  name: 'Gemeente Amsterdam, Horeca exploitatievergunningen (exploitatievergunning)',
  url: 'https://api.data.amsterdam.nl/v1/horeca/exploitatievergunning/',
  docs: 'https://api.data.amsterdam.nl/v1/docs/datasets/horeca.html',
  licence: 'CC-BY 4.0, Gemeente Amsterdam',
} as const;

/** Default off until the user has looked at it. */
export const TERRACES_DEFAULT = false;
/** The URL flag / env switch: '1' on, '0' off, anything else the default. */
export function terracesEnabled(search: string | null | undefined, env: string | null | undefined, kill?: unknown): boolean {
  if (kill === false || env === '0') return false;
  const v = search ? new URLSearchParams(search).get('terraces') : null;
  if (v === '0') return false;
  if (v === '1' || env === '1') return true;
  return TERRACES_DEFAULT;
}
export function terracesFlag(): boolean {
  const g = globalThis as any;
  return terracesEnabled(g.location?.search ?? null, g.process?.env?.TERRACES ?? null, g.__canalRecallTerraces);
}

/** The raw API row fields the build reads. */
export interface PermitRow {
  id: number | string;
  zaaknaam?: string | null;
  adres?: string | null;
  zaakCategorie?: string | null;
  zaakSpecificatie?: string | null;
  statusVergunning?: string | null;
  begindatum?: string | null;
  einddatum?: string | null;
  oTijdenTerrasZoDoVan?: string | null; oTijdenTerrasZoDoTot?: string | null;
  oTijdenTerrasVrZaVan?: string | null; oTijdenTerrasVrZaTot?: string | null;
  locatie?: { type: 'Point'; coordinates: [number, number] } | null;
  terrasgeometrie?: { type: 'MultiPolygon'; coordinates: number[][][][] } | null;
  statusTijdelijkTerras?: string | null;
  toestemmingTijdelijkTerras?: string | null;
}

export const GRANTED = ['Verleend', 'Deels verleend'] as const;

/** Why a row is not drawn (null: it is). `today` is YYYY-MM-DD. A permit without a start date counts as started. */
export function permitRejection(r: PermitRow, today: string): string | null {
  if (!GRANTED.includes((r.statusVergunning ?? '') as typeof GRANTED[number])) return `status ${r.statusVergunning ?? 'none'}`;
  if (r.begindatum && r.begindatum.slice(0, 10) > today) return 'not started';
  if (r.einddatum && r.einddatum.slice(0, 10) < today) return 'expired';
  if (!r.terrasgeometrie?.coordinates?.length) return 'no terrace geometry';
  return null;
}

/** Terrace style families (the kit's variants). */
export type TerraceStyle = 'brown' | 'bistro' | 'restaurant' | 'bar' | 'modern';
export const TERRACE_STYLES: readonly TerraceStyle[] = ['brown', 'bistro', 'restaurant', 'bar', 'modern'];

/**
 * The style from the permit's category, specification and name. Brown cafés by name as the retail-ground lane's
 * classifier reads them (retailTemplates.ts: café/eetcafé/proeflokaal/tapperij/bodega names, `amenity=pub`);
 * restaurant permits white cloth (whatever the name says); night venues and cocktail / wine / lounge names high
 * tables (a plain "Bar ..." café stays a café); lunchrooms, coffee and fast food modern.
 */
export function terraceStyle(category: string | null | undefined, spec: string | null | undefined, name: string | null | undefined): TerraceStyle {
  const c = (category ?? '').toLowerCase(), s = (spec ?? '').toLowerCase(), n = (name ?? '').toLowerCase().trim();
  if (/^(caf[eé]|eetcaf[eé]|proeflokaal|tapperij|bodega|in de|in 't|'t |de wildeman|brouwerij)(?=[\s']|$)/.test(n) || /bruin/.test(s)) return 'brown';
  if (/nachtzaak|discotheek|nachtclub/.test(c + ' ' + s)) return 'bar';
  // A restaurant permit stays a restaurant whatever its name says ("Seafood Bar", "Kitchen & Bar").
  if (/restaurant|eethuis|grill/.test(c + ' ' + s) && !/fastfood|afhaal|snack/.test(s)) return 'restaurant';
  // A plain "Bar ..." café is a café (Bar Cadaq, Leidseplein: rattan bistro chairs on the 2022 panorama); only cocktail,
  // wine and lounge names take the high tables.
  if (/\b(cocktail|cocktails|lounge|wine|wijnbar|sky ?bar|rooftop)\b/.test(n)) return 'bar';
  if (/lunchroom|koffie|alcoholvrij|fastfood|snack|broodjes|ijssalon|cafetaria|coffeeshop/.test(c + ' ' + s)) return 'modern';
  if (/caf[eé]/.test(c + ' ' + s)) return 'bistro';
  return 'modern';
}

/** Terrace hours "HH.MM" pairs (Sun-Thu, Fri-Sat); null when the permit lists none. */
export interface TerraceHours { sunThu: [string, string] | null; friSat: [string, string] | null }
const hhmm = (v: string | null | undefined): string | null => {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec((v ?? '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};
export function terraceHours(r: PermitRow): TerraceHours | null {
  const pair = (a?: string | null, b?: string | null): [string, string] | null => { const x = hhmm(a), y = hhmm(b); return x && y ? [x, y] : null; };
  const h = { sunThu: pair(r.oTijdenTerrasZoDoVan, r.oTijdenTerrasZoDoTot), friSat: pair(r.oTijdenTerrasVrZaVan, r.oTijdenTerrasVrZaTot) };
  return h.sunThu || h.friSat ? h : null;
}
/**
 * Is the terrace permitted to be out at `day` (0 Sunday … 6 Saturday) and `time` "HH:MM"? A closing time at or before
 * the opening time runs past midnight; the small hours belong to the previous evening's day. No hours: always out.
 * The game has no clock yet (2026-11-14): nothing calls this in the ride; a future time-of-day lane can.
 */
export function terraceOpenAt(h: TerraceHours | null, day: number, time: string): boolean {
  if (!h) return true;
  const min = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5), t = min(time);
  const span = (d: number) => (d === 5 || d === 6 ? h.friSat : h.sunThu) ?? h.sunThu ?? h.friSat;
  const inSpan = (s: [string, string] | null, after: boolean) => {
    if (!s) return false;
    const a = min(s[0]), b = min(s[1]);
    if (b > a) return !after && t >= a && t < b;
    return after ? t < b : t >= a;
  };
  return inSpan(span(day), false) || inSpan(span((day + 6) % 7), true);
}

// ---------------------------------------------------------------- geometry

export type LngLat = [number, number];
export type Vec2 = [number, number];
/** The game's local frame (groundStore.ts toLocal): metres east/north of 4.9 E 52.37 N. */
export const ORIGIN = { lng: 4.9, lat: 52.37 } as const;
export const KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
export const toLocal = (lng: number, lat: number): Vec2 => [(lng - ORIGIN.lng) * KX, (lat - ORIGIN.lat) * KY];
export const fromLocal = (x: number, y: number): LngLat => [ORIGIN.lng + x / KX, ORIGIN.lat + y / KY];

/** Douglas-Peucker on a closed ring (first point kept; the ring is not repeated at its end). */
export function simplifyRing(ring: Vec2[], tol: number): Vec2[] {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice();
  if (pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length + 1); keep[0] = keep[pts.length] = 1;
  const at = (i: number) => pts[i % pts.length];
  const stack: [number, number][] = [[0, pts.length]];
  while (stack.length) {
    const [a, b] = stack.pop()!; const A = at(a), B = at(b);
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) { const d = segDist(at(i), A, B); if (d > best) { best = d; bi = i; } }
    if (best > tol && bi > 0) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  const out = pts.filter((_, i) => keep[i]);
  return out.length >= 3 ? out : pts;
}
export function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function ringArea(r: readonly Vec2[]): number {
  let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return s / 2;
}
export function pointInRing(p: Vec2, r: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Polygons (outer ring first, then holes). */
export type Polygon = Vec2[][];
export const inPolygon = (p: Vec2, poly: Polygon): boolean => pointInRing(p, poly[0]) && !poly.slice(1).some(h => pointInRing(p, h));
export function distToPolygonEdge(p: Vec2, poly: Polygon): number {
  let d = Infinity;
  for (const r of poly) for (let i = 0, j = r.length - 1; i < r.length; j = i++) d = Math.min(d, segDist(p, r[j], r[i]));
  return d;
}

/** RD MultiPolygon → polygons in the local frame, simplified at `tol` m; slivers under `minArea` m² dropped. */
export function rdMultiPolygonToLocal(coords: number[][][][], tol = 0.25, minArea = 0.5): Polygon[] {
  const out: Polygon[] = [];
  for (const poly of coords) {
    const rings = poly.map(r => simplifyRing(r.map(([x, y]) => { const [lng, lat] = rdToLngLat(x, y); return toLocal(lng, lat); }), tol)).filter(r => r.length >= 3);
    if (!rings.length || Math.abs(ringArea(rings[0])) < minArea) continue;
    out.push(rings);
  }
  return out;
}
/**
 * Polygons that belong to the permit: every vertex within MAX_FROM_PREMISES_M of the premises point (when given) and
 * the polygon under MAX_EXTENT_M across. Without a premises point (101 rows) the largest polygon's first vertex stands in.
 * The register has stray parts (Fromagerie Kef, Van der Pekplein: a fifth polygon with its RD x negated, 245 km off).
 */
export const MAX_FROM_PREMISES_M = 250, MAX_EXTENT_M = 150;
export function plausiblePolygons(polys: Polygon[], premises: Vec2 | null): { kept: Polygon[]; dropped: number } {
  const ref = premises ?? (polys.length ? polys.reduce((m, p) => Math.abs(ringArea(p[0])) > Math.abs(ringArea(m[0])) ? p : m)[0][0] : null);
  const kept = polys.filter(p => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of p[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (Math.max(x1 - x0, y1 - y0) > MAX_EXTENT_M) return false;
    return !ref || p[0].every(([x, y]) => Math.hypot(x - ref[0], y - ref[1]) <= MAX_FROM_PREMISES_M);
  });
  return { kept, dropped: polys.length - kept.length };
}
export const polygonArea = (p: Polygon): number => Math.abs(ringArea(p[0])) - p.slice(1).reduce((s, h) => s + Math.abs(ringArea(h)), 0);

// ---------------------------------------------------------------- extract shape

/** One placed furniture unit: model index (TerracesExtract.models), offset from the terrace anchor in decimetres (local frame), yaw in degrees (ccw from east), slot colour index (TerracesExtract.colours), level 1 = on a parking bay (carriageway plane). */
export type UnitRow = [model: number, dxDm: number, dyDm: number, yawDeg: number, colour?: number, level?: number];
export interface TerraceRecord {
  /** Permit id. */
  id: string;
  name: string;
  category: string;
  spec: string;
  style: TerraceStyle;
  /** Anchor (the terrace polygon's first vertex), 7 dp. */
  lng: number; lat: number;
  areaM2: number;
  hours: TerraceHours | null;
  begin: string | null; end: string | null;
  /** Polygons as rings of [dxDm, dyDm] off the anchor. */
  poly: [number, number][][][];
  units: UnitRow[];
}
export interface TerracesExtract {
  version: typeof TERRACES_VERSION;
  source: typeof TERRACES_SOURCE;
  fetched: string;
  /** Placement rules version and the road survey it was clipped against. */
  placement: string;
  models: string[];
  /** Parasol / screen canvas colours (sRGB hex), indexed by a unit's `colour`. */
  colours: string[];
  counts: Record<string, unknown>;
  terraces: TerraceRecord[];
}
