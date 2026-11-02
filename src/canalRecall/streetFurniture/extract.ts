/**
 * Street-furniture extract shape (lane #170): the records `scripts/street-furniture/build.ts` writes into
 * `public/data/extracts/amsterdam/street-furniture/` and the ride streams (street-furniture-source.js).
 * Pure: no IO. Tiles are z15 like municipal-trees.
 */
export const FURNITURE_ZOOM = 15;
/** The city box: the own-ground manifest's bounds (own-ground-osm-v1/cells.json bbox: every 1 km cell the routing passes). */
export const CITY_BOX = [4.708732, 52.271185, 5.105981, 52.432882] as const;

export const FURNITURE_KINDS = ['container', 'lamp', 'bin', 'bike-rack', 'abri', 'ad-column'] as const;
export type FurnitureKind = typeof FURNITURE_KINDS[number];

export type FurnitureRecord = {
  id: string; kind: FurnitureKind; subtype: string; lng: number; lat: number;
  /** Kerb axis, compass degrees 0-180 (street centreline or a container cluster's own row). */
  heading?: number;
  /** Compass bearing from the object to the nearest street. */
  facing?: number;
  /** OSM highway class of that street. */
  road?: string;
  cluster?: string; fraction?: string | null; volume?: number | null;
};

/** BGT collection → plus_type → kind. Everything else is counted as skipped (kunstobject stays a bespoke landmark). */
export const BGT_KIND: Readonly<Record<string, Readonly<Record<string, FurnitureKind>>>> = {
  paal: { lichtmast: 'lamp' },
  // `afvalbak` is an underground-container column in Amsterdam's BGT (sample-bin.jpg, sample-bin-city.jpg: 16 of 16
  // views); `afval apart plaats` marks the register's own container sites (88 % within 5 m) and is skipped as a duplicate.
  bak: { afvalbak: 'container' },
  straatmeubilair: { abri: 'abri', reclamezuil: 'ad-column', fietsenrek: 'bike-rack' },
};

export const insideBox = (lng: number, lat: number): boolean => lng >= CITY_BOX[0] && lng <= CITY_BOX[2] && lat >= CITY_BOX[1] && lat <= CITY_BOX[3];

export function tileKeyOf(lng: number, lat: number, z = FURNITURE_ZOOM): string {
  const n = 2 ** z;
  const x = Math.floor((lng + 180) / 360 * n), y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return `${z}/${x}/${y}`;
}

/** Container fraction (fractieOmschrijving) → subtype. */
export function containerSubtype(fraction: unknown): string {
  const f = String(fraction ?? '').trim().toLowerCase();
  return ['rest', 'papier', 'glas', 'textiel', 'gft', 'brood', 'grof', 'plastic'].includes(f) ? f : 'unknown';
}

/**
 * Streets the canal lantern (the maroon cast-iron post with a four-sided lantern) lights inside stadsdeel Centrum;
 * through roads there, and everything outside Centrum, get the light-grey pole with the hooked arm. Evidence:
 * staging/street-furniture/sample-lamp-grachtengordel.jpg (8 of 8 Grachtengordel lamps are lanterns) and
 * sample-lamp-pijp.jpg (Pijp: hooked and straight-arm grey poles, one lantern). A prior, not a register field.
 */
export const LANTERN_ROADS: ReadonlySet<string> = new Set(['residential', 'living_street', 'pedestrian', 'service', 'unclassified', 'footway', 'cycleway', 'path', 'tertiary']);

export type LampStyle = 'lantern' | 'pole';
export function lampStyle(inCentrum: boolean, road: string | undefined): LampStyle {
  return inCentrum && (!road || LANTERN_ROADS.has(road)) ? 'lantern' : 'pole';
}

type Ring = [number, number][];
/** boundaries.json: `geometry` is polygons of rings of [lat, lng]. */
type Boundary = { name: string; kind: string; geometry: [number, number][][][] };
const inRing = (x: number, y: number, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
export function polygonTest(geometry: Boundary['geometry']): (lng: number, lat: number) => boolean {
  const polys: Ring[][] = geometry.map(poly => poly.map(ring => ring.map(([lat, lng]) => [lng, lat] as [number, number])));
  return (lng, lat) => polys.some(p => inRing(lng, lat, p[0]) && !p.slice(1).some(h => inRing(lng, lat, h)));
}

/** Second pass over built records: the lamp style from stadsdeel Centrum's polygon (boundaries.json) and the road. */
export function finishRecords(records: FurnitureRecord[], boundaries: readonly Boundary[]): void {
  const centrum = boundaries.find(b => b.name === 'Centrum' && b.kind === 'suburb');
  const inside = centrum ? polygonTest(centrum.geometry) : () => false;
  for (const r of records) if (r.kind === 'lamp') r.subtype = lampStyle(inside(r.lng, r.lat), r.road);
}
