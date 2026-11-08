/**
 * The building (pand) under a tapped POI label.
 *
 * A drawn POI label wins a tap over the building beneath it (labelLayer.ts
 * `hitTest`), and its hit carries the label's text and point but no footprint
 * or pand id, so the card could say what the place is (click-poi-info.json,
 * #258) but not when its building was built. The view resolves the pand with
 * its ordinary building pick — at the tapped pixel and at the label's own
 * projected anchor — and this module decides which picked surface, if any, is
 * the label's building: the one whose footprint holds the label's point, else
 * the nearest within a few metres (POI nodes sit on or just off their walls).
 * A pick farther than that is a building in front of the place, not the place.
 */
import type { LngLat } from '../game/extracts';

/** A building pick (threeBuildingsBrowser `inspectAtScreen`, cityExtras `pick`), as far as this needs it. */
export interface PandPick {
  id?: string | number;
  landmarkId?: string;
  height?: number;
  footprint?: { type: string; coordinates: unknown } | null;
  featureTarget?: unknown;
}

/** What a label hit carries about its building once resolved. */
export interface LabelPand {
  id: string;
  height?: number;
  footprint?: PandPick['footprint'];
  featureTarget?: unknown;
}

/** A POI node is mapped at a door or a few metres in from it. Measured on the gurdwara label (Schakelstraat 21): 0 m, inside. */
export const LABEL_PAND_MAX_M = 6;

type Ring = readonly (readonly number[])[];
const polygonsOf = (g: PandPick['footprint']): Ring[][] =>
  !g ? [] : g.type === 'Polygon' ? [g.coordinates as Ring[]] : g.type === 'MultiPolygon' ? g.coordinates as Ring[][] : [];

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Ground metres from a point to a footprint: 0 inside (outer ring less holes), Infinity without one. */
export function footprintDistanceM(footprint: PandPick['footprint'], [lng, lat]: LngLat): number {
  const polygons = polygonsOf(footprint);
  if (polygons.some(rings => rings[0] && inRing(lng, lat, rings[0]) && !rings.slice(1).some(hole => inRing(lng, lat, hole)))) return 0;
  const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 111320;
  let best = Infinity;
  for (const rings of polygons) for (const ring of rings) for (let i = 0; i + 1 < ring.length; i++) {
    const ax = (ring[i][0] - lng) * kx, ay = (ring[i][1] - lat) * ky;
    const bx = (ring[i + 1][0] - lng) * kx, by = (ring[i + 1][1] - lat) * ky;
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** The label's building among the picks, or null when every pick is another building (or none has a plan). */
export function pandUnderLabel(lngLat: LngLat, picks: readonly (PandPick | null | undefined)[], maxMetres = LABEL_PAND_MAX_M): LabelPand | null {
  let best: { pick: PandPick; m: number } | null = null;
  for (const pick of picks) {
    if (!pick || pick.id == null || pick.id === '' || !pick.footprint) continue;
    const m = footprintDistanceM(pick.footprint, lngLat);
    if (m <= maxMetres && (!best || m < best.m)) best = { pick, m };
  }
  if (!best) return null;
  const { id, height, footprint, featureTarget } = best.pick;
  return { id: String(id), ...(height ? { height } : {}), footprint, ...(featureTarget ? { featureTarget } : {}) };
}

/** A label hit with its building attached; the hit is returned as it was when none is found. */
export function withLabelPand<T extends { lngLat: LngLat }>(label: T, picks: readonly (PandPick | null | undefined)[]): T & { pand?: LabelPand } {
  const pand = pandUnderLabel(label.lngLat, picks);
  return pand ? { ...label, pand } : label;
}

/** The id the facts register is keyed on: the label's building for a label tap, the building itself otherwise. */
export function factsIdOf(hit: { id?: string | number; poi?: boolean; pand?: { id: string } | null }): string | number | undefined {
  return hit.poi && hit.pand ? hit.pand.id : hit.id;
}
