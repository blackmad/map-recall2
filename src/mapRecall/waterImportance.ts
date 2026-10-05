import type { AdministrativeArea, StreetFeature } from '../types';
import { calculateHaversineDistanceMeters } from '../utils/geo';

export const isWater = (feature: StreetFeature) => feature.type === 'canal' || feature.type === 'water';
// Editorial starting syllabus. Reference and geometry signals order the rest.
const essentials = new Set(['singel', 'herengracht', 'keizersgracht', 'prinsengracht',
  'singelgracht', 'amstel', 'ij', 'oudezijds voorburgwal', 'oudezijds achterburgwal']);
const normalize = (name: string) => name.trim().toLocaleLowerCase();

function inRing([lat, lon]: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inArea(point: [number, number], area: AdministrativeArea) {
  return area.geometry?.some(polygon => inRing(point, polygon[0]) && !polygon.slice(1).some(hole => inRing(point, hole)));
}

/** Closed outlines contribute area, never circumference-as-canal-length. */
export function waterExtent(feature: StreetFeature) {
  const lines = feature.paths?.length ? feature.paths : feature.path ? [feature.path] : [];
  let lengthMeters = 0, areaM2 = 0;
  const seenSegments = new Set<string>();
  const seenRings = new Set<string>();
  for (const line of lines) {
    if (line.length < 2) continue;
    const closed = line.length >= 4 && line[0][0] === line.at(-1)![0] && line[0][1] === line.at(-1)![1];
    if (closed) {
      // Translation avoids loss of precision; canonical segment keys deduplicate rings.
      const keys = line.slice(1).map((p, i) => [line[i].join(','), p.join(',')].sort().join('|')).sort().join(';');
      if (seenRings.has(keys)) continue;
      seenRings.add(keys);
      const [lat, lon] = line[0];
      const xScale = 111_320 * Math.cos(lat * Math.PI / 180);
      let twiceArea = 0;
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        twiceArea += ((a[1] - lon) * (b[0] - lat) - (b[1] - lon) * (a[0] - lat)) * xScale * 111_320;
      }
      areaM2 += Math.abs(twiceArea) / 2;
    } else {
      for (let i = 1; i < line.length; i++) {
        const key = [line[i - 1].join(','), line[i].join(',')].sort().join('|');
        if (seenSegments.has(key)) continue;
        seenSegments.add(key);
        lengthMeters += calculateHaversineDistanceMeters(line[i - 1], line[i]);
      }
    }
  }
  return { lengthMeters, areaM2 };
}

export function waterImportance(feature: StreetFeature, areas: AdministrativeArea[] = []): number {
  if (feature.waterImportance !== undefined) return feature.waterImportance;
  const name = normalize(feature.name);
  if (feature.cityId === 'amsterdam' && essentials.has(name)) return 500;
  const { lengthMeters, areaM2 } = waterExtent(feature);
  // The extract also contains named fountains and locks: an article alone does
  // not make these useful canal questions. Tiny unlinked water stays optional.
  if (/sluis|sluizen|fontein|fountain/.test(name)) return 0;
  if (lengthMeters < 150 && areaM2 < 5_000) return 0;
  const references = (feature.wikipedia || feature.wikipediaUrl ? 55 : 0) + (feature.wikidata ? 25 : 0);
  const encyclopedia = Math.min(50, Math.max(0, feature.encyclopediaScore || 0) / 2);
  const extent = Math.min(80, Math.log10(1 + lengthMeters / 100) * 45)
    + Math.min(60, Math.log10(1 + areaM2 / 5_000) * 25);
  const centrum = feature.cityId === 'amsterdam' && areas.find(area => normalize(area.name) === 'centrum' && area.kind === 'suburb');
  const noord = feature.cityId === 'amsterdam' && areas.find(area => normalize(area.name) === 'noord' && area.kind === 'suburb');
  // Use actual district polygons, not latitude: the IJ crosses the city.
  const district = centrum && inArea(feature.center, centrum) ? 100 : noord && inArea(feature.center, noord) ? -140 : 0;
  return Math.round(references + encyclopedia + extent + district);
}

export function attachWaterImportance(features: StreetFeature[], areas: AdministrativeArea[] = []) {
  return features.map(feature => isWater(feature) ? { ...feature, waterImportance: waterImportance(feature, areas) } : feature);
}

/** Keep obscure waters out of both new questions and old due reviews by default. */
export function focusImportantWaters(features: StreetFeature[]): StreetFeature[] {
  const waters = features.filter(isWater);
  const amsterdam = waters.some(feature => feature.cityId === 'amsterdam');
  const selected = waters.filter(feature => waterImportance(feature) >= (amsterdam ? 140 : 80))
    .sort((a, b) => waterImportance(b) - waterImportance(a) || a.name.localeCompare(b.name)).slice(0, 40);
  const keep = new Set(selected);
  return features.filter(feature => !isWater(feature) || keep.has(feature));
}
