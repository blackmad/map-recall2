/**
 * Join colour tags onto OSM geometry when the paint lives on a different id.
 *
 * `buildings-colored.geojson` is keyed by the way that carried the tags when
 * the extract was built. Mappers keep splitting landmarks into new
 * `building:part` ids (Oosterdokseiland, Centraal), so the live part graph and
 * the colour file drift. Exact-id join then leaves the parts grey while the
 * old coloured outline is suppressed as an unmatched shell.
 *
 * Inheritance: if a part has no colour of its own, take appearance from the
 * *smallest* coloured footprint whose ring contains the part's centroid.
 */

import { FootprintGrid } from './buildingLadder.js';
import { pointInRing, ringBbox, ringCentroid, type Ring } from './buildingGeometry.js';

const APPEARANCE_KEYS = [
  'colour', 'sideColour', 'roofColour', 'roofShape', 'roofHeight', 'material', 'name',
] as const;

export type PaintDonor = {
  rings: Ring[];
  properties: Record<string, unknown>;
};

export function hasPaintColour(props: Record<string, unknown> | undefined): boolean {
  if (!props) return false;
  return Boolean(props.colour || props.sideColour || props.roofColour);
}

/** Copy only the keys the renderer reads, so geometry height tags win. */
export function pickPaintProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of APPEARANCE_KEYS) {
    if (props[key] != null && props[key] !== '') out[key] = props[key];
  }
  return out;
}

/**
 * Direct id hit first; otherwise the smallest containing coloured footprint.
 */
export function resolvePaintProps(
  direct: Record<string, unknown> | undefined,
  rings: Ring[],
  donors: FootprintGrid<PaintDonor>,
): Record<string, unknown> {
  if (hasPaintColour(direct)) return pickPaintProps(direct!);
  if (rings.length === 0) return {};
  const centre = ringCentroid(rings[0]);
  let best: { props: Record<string, unknown>; area: number } | null = null;
  for (const donor of donors.near(rings)) {
    if (!hasPaintColour(donor.properties)) continue;
    if (!donor.rings.some(ring => pointInRing(centre, ring))) continue;
    const [west, south, east, north] = ringBbox(donor.rings[0]);
    const area = Math.max(0, east - west) * Math.max(0, north - south);
    if (!best || area < best.area) best = { props: donor.properties, area };
  }
  if (!best) return {};
  return pickPaintProps(best.props);
}

/** Same containment rule `decideTier` uses for "these footprints are one building". */
export function footprintsShareOwnership(
  a: { rings: Ring[] },
  b: { rings: Ring[] },
): boolean {
  const aRing = a.rings[0];
  const bRing = b.rings[0];
  if (!aRing || !bRing) return false;
  return a.rings.some(ring => pointInRing(ringCentroid(bRing), ring)) ||
    b.rings.some(ring => pointInRing(ringCentroid(aRing), ring));
}

/**
 * True when two footprints' bboxes sit within `metres` (expanded).
 *
 * Adjacent Centraal `building:part`s share a wall plane without nested
 * centroids; containment misses them and they reappear as tier 4 shimmer.
 */
export function footprintsWithinMetres(
  a: { rings: Ring[] },
  b: { rings: Ring[] },
  metres: number,
): boolean {
  const aRing = a.rings[0];
  const bRing = b.rings[0];
  if (!aRing || !bRing) return false;
  const [west, south, east, north] = ringBbox(aRing);
  const dLat = metres / 111_320;
  const dLng = metres / (111_320 * Math.max(0.2, Math.cos(((south + north) / 2) * Math.PI / 180)));
  const expanded: [number, number, number, number] = [
    west - dLng, south - dLat, east + dLng, north + dLat,
  ];
  const bb = ringBbox(bRing);
  return expanded[0] <= bb[2] && expanded[2] >= bb[0] && expanded[1] <= bb[3] && expanded[3] >= bb[1];
}
