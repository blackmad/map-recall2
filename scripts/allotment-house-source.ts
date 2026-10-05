import { readFileSync } from 'node:fs';
import { bboxesOverlap, pointInRing, polygonsOf, ringBbox, ringCentroid, type FootprintGeometry, type Ring } from '../src/canalRecall/buildingGeometry.js';

export type SourceFeature = { type?: string; geometry: FootprintGeometry; properties: Record<string, unknown> };
export const allotmentParks: SourceFeature[] = JSON.parse(readFileSync(new URL('../review-data/allotment-houses/park-boundaries.geojson', import.meta.url), 'utf8')).features;
export const contains = (geometry: FootprintGeometry, point: [number, number]): boolean => polygonsOf(geometry).some(p => pointInRing(point, p[0]) && !p.slice(1).some(hole => pointInRing(point, hole)));
export function footprintArea(geometry: FootprintGeometry): number {
  const area = (ring: Ring): number => {
    const [x0, y0] = ring[0];
    const scaleX = 111320 * Math.cos(y0 * Math.PI / 180);
    let sum = 0;
    for (let i = 1; i < ring.length; i++) sum += ((ring[i - 1][0] - x0) * (ring[i][1] - y0) - (ring[i][0] - x0) * (ring[i - 1][1] - y0));
    return Math.abs(sum) * scaleX * 111320 / 2;
  };
  return polygonsOf(geometry).reduce((n, p) => n + area(p[0]) - p.slice(1).reduce((s, h) => s + area(h), 0), 0);
}
/** Positive footprint overlap: containment, vertex penetration or crossing walls. Holes remain empty. */
export function footprintsOverlap(a: FootprintGeometry, b: FootprintGeometry): boolean {
  const cross = (p: [number, number], q: [number, number], r: [number, number]): number => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  for (const pa of polygonsOf(a)) for (const pb of polygonsOf(b)) {
    if (!bboxesOverlap(ringBbox(pa[0]), ringBbox(pb[0]))) continue;
    if (contains(b, ringCentroid(pa[0])) && contains(a, ringCentroid(pa[0]))) return true;
    if (contains(a, ringCentroid(pb[0])) && contains(b, ringCentroid(pb[0]))) return true;
    if (pa[0].some(p => contains(b, p)) || pb[0].some(p => contains(a, p))) return true;
    for (const ra of pa) for (const rb of pb) for (let i = 1; i < ra.length; i++) for (let j = 1; j < rb.length; j++) {
      if (cross(ra[i - 1], ra[i], rb[j - 1]) * cross(ra[i - 1], ra[i], rb[j]) < 0 && cross(rb[j - 1], rb[j], ra[i - 1]) * cross(rb[j - 1], rb[j], ra[i]) < 0) return true;
    }
  }
  return false;
}
export function allotmentPark(feature: SourceFeature): SourceFeature | undefined {
  const tags = feature.properties;
  // The bounded small-house generator does not infer a courtyard assembly.
  // Retain such mapped footprints in ordinary source treatment instead.
  if (polygonsOf(feature.geometry).some(p => p.length !== 1)) return undefined;
  if (tags.building === 'greenhouse' || tags.building === 'glasshouse' || tags.isPart || tags['building:part'] || Number(tags.minHeight ?? tags.min_height ?? 0) > 0) return undefined;
  const area = footprintArea(feature.geometry);
  if (area < 6 || area > 70) return undefined;
  // Require every mapped outer vertex and its centroid within the same park.
  return allotmentParks.find(park => polygonsOf(feature.geometry).every(p => p[0].every(point => contains(park.geometry, point)) && contains(park.geometry, ringCentroid(p[0]))));
}
export function allotmentProperties(osmId: string, park: SourceFeature): Record<string, unknown> {
  const seed = Number(osmId.replace(/\D/g, '')) % 5;
  const walls = ['#a18d6c', '#75866b', '#99846f', '#c5b798', '#8b7664'];
  return { osmId, allotmentHouse: 'garden-house-v1', allotmentPark: park.properties.name, heightSource: 'approximate-allotment-prior', height: 3.4, minHeight: 0, roofEavesHeightM: 2.4, roofHeight: 1, roofShape: 'gabled', colour: walls[seed], sideColour: walls[seed], roofColour: '#625d52' };
}
