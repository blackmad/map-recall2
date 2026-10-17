/**
 * Pure pieces of the explorer index build (scripts/explorer/build-index.ts):
 * neighbourhood assignment, block-face naming and the row shape. File access
 * stays in the script so these can be tested on small fixtures.
 */
import { ELSEWHERE, type ExplorerBuurt, type ExplorerKind, type ExplorerModel, type LngLat } from './types';

/** boundaries.json row. Geometry is a MultiPolygon in [lat, lng] order. */
export interface Boundary { name: string; kind: string; geometry: number[][][][] }

/** The neighbourhood kinds the quiz and the ride's area cards use. */
export const BUURT_KINDS: readonly string[] = ['neighbourhood', 'neighborhood', 'quarter', 'city_block'];

type Ring = number[][];

/** Ray-casting point-in-ring over [x, y] pairs. */
export function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Point in a polygon with holes ([outer, ...holes]). */
export const inPolygon = (x: number, y: number, polygon: Ring[]): boolean =>
  polygon.length > 0 && inRing(x, y, polygon[0]) && !polygon.slice(1).some(hole => inRing(x, y, hole));

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

/** A boundary with its rings swapped to [lng, lat], its area and bbox: built once per build. */
export interface PreparedBoundary { name: string; kind: string; polygons: Ring[][]; area: number; bbox: [number, number, number, number] }

export function prepareBoundaries(boundaries: readonly Boundary[]): PreparedBoundary[] {
  return boundaries.map(b => {
    const polygons = b.geometry.map(poly => poly.map(ring => ring.map(([lat, lng]) => [lng, lat])));
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const poly of polygons) for (const [x, y] of poly[0] ?? []) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
    const area = polygons.reduce((sum, poly) => sum + ringArea(poly[0] ?? []) - poly.slice(1).reduce((h, r) => h + ringArea(r), 0), 0);
    return { name: b.name, kind: b.kind, polygons, area, bbox: [w, s, e, n] };
  });
}

/**
 * The neighbourhood a point belongs to: the smallest neighbourhood-kind outline
 * containing it (quarters and neighbourhoods overlap in OSM), else the smallest
 * suburb, else ELSEWHERE.
 */
export function buurtFor([lng, lat]: LngLat, boundaries: readonly PreparedBoundary[]): string {
  const containing = (kinds: readonly string[]) => boundaries
    .filter(b => kinds.includes(b.kind) && lng >= b.bbox[0] && lng <= b.bbox[2] && lat >= b.bbox[1] && lat <= b.bbox[3])
    .filter(b => b.polygons.some(poly => inPolygon(lng, lat, poly)))
    .sort((a, b) => a.area - b.area)[0];
  return (containing(BUURT_KINDS) ?? containing(['suburb']))?.name ?? ELSEWHERE;
}

/** Buurt bbox per name, over every outline of that name. */
export function buurtBboxes(boundaries: readonly PreparedBoundary[]): Map<string, [number, number, number, number]> {
  const out = new Map<string, [number, number, number, number]>();
  for (const b of boundaries) {
    const box = out.get(b.name);
    out.set(b.name, box ? [Math.min(box[0], b.bbox[0]), Math.min(box[1], b.bbox[1]), Math.max(box[2], b.bbox[2]), Math.max(box[3], b.bbox[3])] : [...b.bbox]);
  }
  return out;
}

/**
 * A readable name for a block-face chunk from its pands' addresses:
 * ["Bilderdijkstraat 154", "Bilderdijkstraat 142-144"] -> "Bilderdijkstraat 142–154".
 * Mixed streets list the first street and "+n".
 */
export function blockName(addresses: readonly (string | undefined)[], fallback: string): string {
  const parsed = addresses.filter((a): a is string => !!a).map(a => {
    const m = /^(.*?)\s+(\d+)(?:\s*[-–]\s*(\d+))?\D*$/.exec(a.trim());
    return m ? { street: m[1], lo: Number(m[2]), hi: Number(m[3] ?? m[2]) } : { street: a.trim(), lo: NaN, hi: NaN };
  });
  if (!parsed.length) return fallback;
  const streets = [...new Set(parsed.map(p => p.street))];
  const first = parsed.filter(p => p.street === streets[0] && Number.isFinite(p.lo));
  if (!first.length) return streets[0] + (streets.length > 1 ? ` +${streets.length - 1}` : '');
  const lo = Math.min(...first.map(p => p.lo)), hi = Math.max(...first.map(p => p.hi));
  return `${streets[0]} ${lo === hi ? lo : `${lo}–${hi}`}${streets.length > 1 ? ` +${streets.length - 1}` : ''}`;
}

/** `NL.IMBAG.Pand.0363100012061542` or `0363100012061542` -> `0363100012061542`; anything else -> undefined. */
export function bagPandNumber(id: string): string | undefined {
  const m = /^(?:NL\.IMBAG\.Pand\.)?(\d{16})$/.exec(id);
  return m?.[1];
}

/** Strip a cache-busting query and normalise `./` so the URL is relative to the canal-drive page. */
export const pageUrl = (modelUrl: string): string => modelUrl.replace(/\?.*$/, '').replace(/^\.\//, '');

/** 6 decimals is ~0.1 m: plenty for a pin, and it keeps the index small. */
export const roundLngLat = ([lng, lat]: readonly number[]): LngLat => [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];

/** Inputs for one row, already resolved from the catalogues by the script. */
export interface RowInput {
  id: string; kind: ExplorerKind; name: string; lngLat: readonly number[]; modelUrl: string;
  bytes: number; lodExists: boolean; triangles?: number; pandIds: readonly string[];
  wiki?: string; restricted?: ExplorerModel['restricted'];
}

export function modelRow(input: RowInput, boundaries: readonly PreparedBoundary[]): ExplorerModel {
  const glbUrl = pageUrl(input.modelUrl);
  const lngLat = roundLngLat(input.lngLat);
  const pandIds = [...new Set(input.pandIds.map(bagPandNumber).filter((p): p is string => !!p))];
  return {
    id: input.id, kind: input.kind, name: input.name.trim(), lngLat, buurt: buurtFor(lngLat, boundaries), glbUrl,
    ...(input.lodExists ? { lodUrl: glbUrl.replace(/\.glb$/, '.lod1.glb') } : {}),
    bytes: input.bytes,
    ...(input.triangles ? { triangles: Math.round(input.triangles) } : {}),
    pandIds,
    ...(input.wiki ? { wiki: input.wiki } : {}),
    ...(input.restricted ? { restricted: input.restricted } : {}),
  };
}

/** Buurt list for the picker: every name that has at least one model, alphabetical, ELSEWHERE last. */
export function buurtList(models: readonly ExplorerModel[], bboxes: ReadonlyMap<string, [number, number, number, number]>): ExplorerBuurt[] {
  const counts = new Map<string, number>();
  for (const m of models) counts.set(m.buurt, (counts.get(m.buurt) ?? 0) + 1);
  return [...counts].map(([name, count]): ExplorerBuurt => {
    let bbox = bboxes.get(name);
    if (!bbox) {
      const pts = models.filter(m => m.buurt === name).map(m => m.lngLat);
      bbox = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
    }
    return { name, bbox: bbox.map(v => Math.round(v * 1e5) / 1e5) as [number, number, number, number], count };
  }).sort((a, b) => (a.name === ELSEWHERE ? 1 : 0) - (b.name === ELSEWHERE ? 1 : 0) || a.name.localeCompare(b.name, 'nl'));
}
