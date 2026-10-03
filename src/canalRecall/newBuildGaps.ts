/**
 * Fill holes the 3DBAG snapshot leaves where Amsterdam has built since.
 *
 * The building tiles are 3DBAG `v20250903` plus OSM parts. 3DBAG reconstructs
 * a pand from an AHN height survey, so a pand finished after the survey flew
 * is not in it, and the panden it replaced are gone from BAG, so neither the
 * old nor the new building draws. Elandsgracht 150, where Mr Blou I Love You
 * sits, is the reported case (2026-10-03): the stall is a 10 m² kiosk pand
 * built in 2023 beside an 11 m² one from 2021, and neither draws.
 *
 * OSM imports new BAG panden quickly (`source=BAG`, with `ref:bag` and
 * `start_date`), so its footprints can stand in as tier 4 until a rebuild of
 * the city picks up a newer 3DBAG. This module holds the pure decisions: which
 * OSM footprints are real gaps, and how tall to draw them.
 */

import { pointInRing, ringBbox, ringCentroid, type Ring } from './buildingGeometry.js';

export type GapCandidate = {
  osmId: number;
  ring: Ring;
  tags: Record<string, string>;
};

export type ExistingBuilding = {
  id: string;
  rings: Ring[];
  height?: number;
  minHeight?: number;
  tier?: number;
};

export type GapFill = {
  id: string;
  bagId?: string;
  ring: Ring;
  height: number;
  heightSource: 'osm-height' | 'osm-levels' | 'small' | 'neighbours' | 'default';
  startDate?: string;
};

/** Metres per degree at Amsterdam's latitude, for the small distances used here. */
const KX = 111_320 * Math.cos((52.37 * Math.PI) / 180);
const KY = 110_540;
/** Share of a candidate's vertices that may sit inside existing footprints before it counts as drawn. */
const MAX_COVERED_SHARE = 0.3;
/** Below this a footprint is a mapping fragment; a kiosk like Mr Blou's is 10 m². */
const MIN_AREA_M2 = 6;
/** A kiosk, shed or pavilion: one storey, whatever its taller neighbours measure. */
const SMALL_AREA_M2 = 25;
const SMALL_HEIGHT_M = 3.2;
/** Storey height for `building:levels`, matching Amsterdam's post-war housing. */
const METRES_PER_LEVEL = 3.1;
/** How far to look for neighbours whose measured height a new building borrows. */
const NEIGHBOUR_RADIUS_M = 35;
/** Three storeys: the common new-build when nothing nearby was measured. */
const DEFAULT_HEIGHT_M = 9.5;
const SKIP_BUILDING_VALUES = new Set(['construction', 'demolished', 'proposed', 'no', 'ruins', 'roof', 'carport']);

export const areaM2 = (ring: Ring): number => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += (ring[j][0] * KX) * (ring[i][1] * KY) - (ring[i][0] * KX) * (ring[j][1] * KY);
  return Math.abs(sum) / 2;
};

const parseMetres = (value: string | undefined): number | undefined => {
  const n = value === undefined ? NaN : Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** A lookup of existing footprints on a coarse grid, so a city of candidates checks only its neighbours. */
export class ExistingIndex {
  private readonly cells = new Map<string, ExistingBuilding[]>();
  readonly ids = new Set<string>();
  constructor(buildings: Iterable<ExistingBuilding>, private readonly cell = 0.001) {
    for (const building of buildings) {
      this.ids.add(building.id);
      for (const ring of building.rings) {
        const [w, s, e, n] = ringBbox(ring);
        for (let x = Math.floor(w / cell); x <= Math.floor(e / cell); x++) {
          for (let y = Math.floor(s / cell); y <= Math.floor(n / cell); y++) {
            const key = `${x},${y}`;
            const list = this.cells.get(key);
            if (!list) this.cells.set(key, [building]);
            else if (list[list.length - 1] !== building) list.push(building);
          }
        }
      }
    }
  }

  near(lng: number, lat: number, reach = 1): ExistingBuilding[] {
    const gx = Math.floor(lng / this.cell), gy = Math.floor(lat / this.cell), out = new Set<ExistingBuilding>();
    for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) for (const b of this.cells.get(`${gx + dx},${gy + dy}`) ?? []) out.add(b);
    return [...out];
  }

  /** The ground-reaching building at this point, if any: a canopy or bridge deck over a gap does not fill it. */
  coveredBy(lng: number, lat: number): ExistingBuilding | undefined {
    return this.near(lng, lat, 0).find(b => (b.minHeight ?? 0) <= 2 && b.rings.some(ring => pointInRing([lng, lat], ring)));
  }

  /** Any building, at any height, drawn here. */
  touchedBy(lng: number, lat: number): ExistingBuilding[] {
    return this.near(lng, lat, 0).filter(b => b.rings.some(ring => pointInRing([lng, lat], ring)));
  }
}

/**
 * Points spread over a footprint's interior, so a courtyard block whose
 * centroid falls in its own courtyard is still judged by its built ground.
 */
export function interiorSamples(ring: Ring, target = 200): [number, number][] {
  const [w, s, e, n] = ringBbox(ring);
  const step = Math.max(Math.sqrt(((e - w) * (n - s)) / target), 0.000005);
  const out: [number, number][] = [];
  for (let x = w + step / 2; x < e; x += step) for (let y = s + step / 2; y < n; y += step) if (pointInRing([x, y], ring)) out.push([x, y]);
  return out.length ? out : [ringCentroid(ring)];
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** How tall to draw a gap building: OSM's own height, its storeys, or what its measured neighbours stand at. */
export function gapHeight(candidate: GapCandidate, existing: ExistingIndex): Pick<GapFill, 'height' | 'heightSource'> {
  const height = parseMetres(candidate.tags.height);
  if (height) return { height, heightSource: 'osm-height' };
  const levels = parseMetres(candidate.tags['building:levels']);
  if (levels) return { height: Math.round((levels * METRES_PER_LEVEL + (parseMetres(candidate.tags['roof:levels']) ?? 0) * 2) * 10) / 10, heightSource: 'osm-levels' };
  if (areaM2(candidate.ring) < SMALL_AREA_M2) return { height: SMALL_HEIGHT_M, heightSource: 'small' };
  const [lng, lat] = ringCentroid(candidate.ring);
  const heights = existing.near(lng, lat).flatMap(b => {
    if (b.height === undefined || (b.minHeight ?? 0) > 2 || !b.id.startsWith('NL.IMBAG')) return [];
    const [x, y] = ringCentroid(b.rings[0]);
    return Math.hypot((x - lng) * KX, (y - lat) * KY) <= NEIGHBOUR_RADIUS_M ? [b.height] : [];
  });
  if (heights.length >= 3) return { height: Math.round(median(heights) * 10) / 10, heightSource: 'neighbours' };
  return { height: DEFAULT_HEIGHT_M, heightSource: 'default' };
}

/**
 * The candidates that are genuinely missing from the tiles: not already drawn
 * under their BAG or OSM id, and not standing on ground an existing footprint
 * already covers.
 */
export function findGapFills(candidates: GapCandidate[], existing: ExistingIndex): GapFill[] {
  const fills: GapFill[] = [];
  for (const candidate of candidates) {
    const { tags, ring } = candidate;
    if (ring.length < 4 || SKIP_BUILDING_VALUES.has(tags.building ?? '')) continue;
    if (parseMetres(tags.min_height) || Number(tags.layer) < 0 || tags.location === 'underground') continue;
    const bagId = tags['ref:bag'] ? `NL.IMBAG.Pand.${tags['ref:bag'].padStart(16, '0')}` : undefined;
    if ((bagId && existing.ids.has(bagId)) || existing.ids.has(`w${candidate.osmId}`)) continue;
    if (areaM2(ring) < MIN_AREA_M2) continue;
    const samples = interiorSamples(ring);
    if (samples.filter(([x, y]) => existing.coveredBy(x, y)).length / samples.length > MAX_COVERED_SHARE) continue;
    // A pand under hand-mapped OSM parts was suppressed on purpose (tier 2 owns it), even where the parts leave ground open.
    if (samples.some(([x, y]) => existing.touchedBy(x, y).some(b => b.tier === 2))) continue;
    fills.push({ id: `w${candidate.osmId}`, bagId, ring, ...gapHeight(candidate, existing), startDate: tags.start_date });
  }
  return fills;
}
