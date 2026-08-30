// Turning extracts into world objects, with no canvas, network or Game
// instance involved. Everything the landmark subsystem decides — which
// buildings become cards, which bridges are worth a question, which postcard
// borrows which photograph — is decided here so it can be tested directly.

import { normaliseAnswer } from '../answerPath';
import type {
  BoundaryFeature,
  BridgeCrossingIndex,
  BridgeFeature,
  LandmarkFeature,
  LatLng,
  NeighborhoodEnrichment,
  PublishedCrossing,
} from './extracts';
import type {
  Bridge,
  BuildingHit,
  GeoJsonFeature,
  Landmark,
  Neighborhood,
  WorldPoint,
} from './worldTypes';

/** Projects an extract `[lat, lng]` into game pixels for the current route. */
export type WorldProjection = (coordinate: LatLng) => WorldPoint;

/** Projects a lat/lng onto the road network, or `null` when it falls outside
 *  the window that was fetched for this route. */
export type PointProjection = (lat: number, lng: number) => WorldPoint | null;

/** 43 of the 300 mapped bridges are called "Brug 117" or similar. That is an
 *  asset register number, not a name a player can learn. */
export const GENERIC_BRIDGE_NAME_PATTERN = /^\s*(brug\s*)?\d+\s*$/i;

/**
 * Which mapped areas count as a neighborhood, finest first. A point inside De
 * Pijp should be reported as De Pijp rather than as Zuid, and the coarse kinds
 * exist so that the rest of the city is not simply nameless. Mirrors the legacy
 * `NEIGHBORHOOD_KIND_RANK` global; kept here so the builders are self-contained.
 */
export const NEIGHBORHOOD_KIND_RANKS: Readonly<Record<string, number>> = {
  city_block: 5,
  neighbourhood: 4,
  neighborhood: 4,
  quarter: 3,
  locality: 2,
  suburb: 1,
};

/** Split on sentence ends, so a card shows whole sentences rather than a
 *  mid-word truncation. */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s/);
}

export interface DetailText {
  /** One sentence, for the collapsed card. */
  detail: string;
  /** Up to three, for the expanded card. */
  longDetail: string;
}

export function splitDetail(text: string | undefined): DetailText {
  const parts = sentences(text || '');
  return {
    detail: (parts[0] || '').slice(0, 150),
    longDetail: parts.slice(0, 3).join(' ').slice(0, 280),
  };
}

/**
 * The English article title carried on the feature itself, when the extract
 * builder already found one. An OSM `wikipedia` tag is nearly always the Dutch
 * article ("nl:Blauwbrug"), and filling an English card from it showed the
 * player a language they did not ask for — so anything but `en:` returns
 * nothing and the Wikidata lookup does the work instead.
 */
export function englishTitle(wikipedia: string | undefined): string {
  if (!wikipedia) return '';
  const separator = wikipedia.indexOf(':');
  if (separator < 0) return '';
  return wikipedia.slice(0, separator) === 'en' ? wikipedia.slice(separator + 1) : '';
}

export function kmBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const latKm = (a.lat - b.lat) * 111.32;
  const lngKm = (a.lng - b.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180);
  return Math.hypot(latKm, lngKm);
}

/** Even-odd ray cast. Rings are world-space, so this is the same test the
 *  neighborhood postcards and the parent-image search both use. */
export function pointInPolygon(x: number, y: number, ring: readonly WorldPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (((a.y > y) !== (b.y > y)) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Finest first: a point inside De Pijp is in De Pijp, not in Zuid. Relies on
 *  `buildNeighborhoods` having sorted by rank. */
export function neighborhoodAt(
  neighborhoods: readonly Neighborhood[],
  x: number,
  y: number,
): Neighborhood | null {
  return neighborhoods.find(hood => hood.rings.some(ring => pointInPolygon(x, y, ring))) || null;
}

function displayGeometry(feature: LandmarkFeature, center: LatLng): GeoJsonFeature[] {
  const sourcePaths = feature.paths || (feature.path ? [feature.path] : []);
  const geometryFeatures: GeoJsonFeature[] = sourcePaths
    .filter(path => path && path.length > 1)
    .map(path => {
      const coordinates = path.map(([lat, lng]) => [lng, lat]);
      const first = coordinates[0], last = coordinates[coordinates.length - 1];
      const closed = coordinates.length > 3 && first[0] === last[0] && first[1] === last[1];
      return {
        type: 'Feature' as const,
        properties: {},
        geometry: closed
          ? { type: 'Polygon' as const, coordinates: [coordinates] }
          : { type: 'LineString' as const, coordinates },
      };
    });
  if (!geometryFeatures.length) {
    geometryFeatures.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [center[1], center[0]] },
    });
  }
  return geometryFeatures;
}

/**
 * Place the landmark extract in the current route's world. A landmark whose
 * centre falls outside the fetched window is dropped rather than clamped: a
 * card pinned to the edge of the loaded area teaches the wrong location.
 */
export function buildLandmarks(
  features: readonly LandmarkFeature[],
  project: PointProjection,
): Landmark[] {
  const landmarks: Landmark[] = [];
  for (const feature of features) {
    const center = feature.center || (feature.path && feature.path[0]);
    if (!center) continue;
    const point = project(center[0], center[1]);
    if (!point) continue;
    const { detail, longDetail } = splitDetail(feature.funFact || feature.wikipediaExtract || '');
    landmarks.push({
      id: feature.id,
      name: feature.name,
      type: feature.type || '',
      imageUrl: feature.wikipediaImageUrl || '',
      x: point.x,
      y: point.y,
      lngLat: [center[1], center[0]],
      detail,
      longDetail,
      prominenceScore: feature.prominenceScore || 0,
      wikipediaUrl: feature.wikipediaUrl || '',
      wikidata: feature.wikidata || '',
      wikipedia: feature.wikipedia || '',
      extractLang: feature.wikipediaExtractLang || 'en',
      geojson: { type: 'FeatureCollection', features: displayGeometry(feature, center) },
    });
  }
  return landmarks;
}

/**
 * Only 42 of the 91 mapped areas are tagged `neighbourhood`, and between them
 * they cover about a tenth of the drivable network — which is why the
 * postcards almost never appeared. Quarters (De Pijp, Grachtengordel) and
 * districts (Centrum, Noord) are places players name too, so they all count;
 * sorting finest-first lets the most specific area containing the vehicle win,
 * with the district as the fallback that covers the rest of the city.
 *
 * Most fine-grained quarters have no Wikimedia image of their own, so a second
 * pass borrows the containing district's photograph rather than showing a flat
 * typographic card — it still depicts the part of Amsterdam being entered, and
 * `imageArea` records whose picture it is.
 */
export function buildNeighborhoods(
  boundaries: readonly BoundaryFeature[],
  enrichments: readonly NeighborhoodEnrichment[],
  toWorld: WorldProjection,
): Neighborhood[] {
  const enrichmentByName = new Map(enrichments.map(entry => [entry.name, entry]));
  const neighborhoods = boundaries
    .filter(boundary => boundary.geometry && NEIGHBORHOOD_KIND_RANKS[boundary.kind])
    .map((boundary): Neighborhood => {
      const enriched = enrichmentByName.get(boundary.name);
      return {
        name: boundary.name,
        kind: boundary.kind,
        rank: NEIGHBORHOOD_KIND_RANKS[boundary.kind],
        rings: (boundary.geometry || [])
          .map(polygon => (polygon[0] || []).map(toWorld))
          .filter(ring => ring.length > 2),
        wikipediaExtract: enriched?.wikipediaExtract || '',
        imageUrl: enriched?.imageUrl || '',
        imageAttribution: enriched?.imageAttribution || '',
      };
    })
    .filter(hood => hood.rings.length)
    .sort((a, b) => b.rank - a.rank);

  for (const hood of neighborhoods) {
    if (hood.imageUrl) continue;
    const sample = hood.rings[0] && hood.rings[0][0];
    if (!sample) continue;
    const parent = neighborhoods.find(candidate =>
      candidate.rank < hood.rank && candidate.imageUrl
      && candidate.rings.some(ring => pointInPolygon(sample.x, sample.y, ring)));
    if (parent) {
      hood.imageUrl = parent.imageUrl;
      hood.imageAttribution = parent.imageAttribution;
      hood.imageArea = parent.name;
    }
  }
  return neighborhoods;
}

/**
 * Bridges carry their own geometry and ready-made distractors, so they can be
 * quizzed the same way waterways and streets are. Two kinds are dropped:
 * register-numbered spans, which are not a name anyone can learn, and rail-only
 * crossings — "Gooilijn" and "Westelijke Ringspoorbaan" are railway *lines*,
 * and asking which line's viaduct you just rode under produced 17 questions for
 * the Westelijke Ringspoorbaan alone. Bridges that carry a road as well as
 * rails keep their question.
 */
export function buildBridges(
  features: readonly BridgeFeature[],
  crossingIndex: BridgeCrossingIndex,
  toWorld: WorldProjection,
): Bridge[] {
  const bridges: Bridge[] = [];
  for (const feature of features) {
    const sourcePaths = feature.paths || (feature.path ? [feature.path] : []);
    const lines = sourcePaths.map(path => (path || []).map(toWorld)).filter(line => line.length > 1);
    if (!feature.name || lines.length === 0 || GENERIC_BRIDGE_NAME_PATTERN.test(feature.name)) continue;
    if (feature.carriesRailway && !feature.carriesRoad) continue;
    // A bridge missing from the crossing index still asks its one question, it
    // just has no water to gate on. Without a centre there is nothing to place
    // that question at, and projecting `undefined` used to throw inside the
    // whole-extract map — which left the player with no landmarks at all
    // because one bridge was malformed. Skip that bridge instead.
    const published = (crossingIndex.bridges || {})[feature.id];
    let source: PublishedCrossing[];
    if (published && published.length) {
      source = published;
    } else if (feature.center) {
      source = [{
        index: 0,
        center: feature.center,
        waterway: null,
        waterwayType: null,
        waterDistractors: [],
        spans: lines.length,
      }];
    } else {
      continue;
    }
    bridges.push({
      id: feature.id,
      name: feature.name,
      lines,
      crossings: source.map(crossing => ({ ...crossing, ...toWorld(crossing.center) })),
      distractors: (feature.distractors || []).filter(name => !GENERIC_BRIDGE_NAME_PATTERN.test(name)),
      wikipediaUrl: feature.wikipediaUrl || '',
      detail: splitDetail(feature.wikipediaExtract).detail,
    });
  }
  return bridges;
}

/**
 * Is there anything to say about this place beyond its name?
 *
 * A drive-by card that reads "A landmark in Prinses Irenebuurt e.o.. No
 * encyclopedia article yet." interrupts the driving corridor to teach nothing.
 * The extract carries far more landmarks than it carries writing about them, so
 * the unenriched majority are simply not offered.
 *
 * A `wikipediaUrl` counts even with no text yet: the summary fetch fills the
 * card a moment later, and there is a real article to open with `W`. A bare
 * `wikidata` id does not — English may have nothing to say about the place, in
 * which case the card would stay empty.
 */
export function isWorthACard(landmark: {
  detail?: string;
  longDetail?: string;
  imageUrl?: string;
  wikipediaUrl?: string;
}): boolean {
  return !!(landmark.detail || landmark.longDetail || landmark.imageUrl || landmark.wikipediaUrl);
}

/**
 * Buildings used to be matched to landmarks by exact name equality, so
 * anything with different punctuation, casing, or a localised OSM name fell
 * through to the generic "Mapped building" card even when the extract had a
 * full Wikipedia entry for it. Try the OSM id, then the normalised name, then
 * proximity — 60 m, close enough that the click almost certainly hit this
 * landmark's building without silently relabelling a neighbour.
 */
export function matchLandmarkToBuilding(
  landmarks: readonly Landmark[],
  building: BuildingHit,
  buildingName: string,
): Landmark | null {
  if (building.id) {
    const byId = landmarks.find(landmark => landmark.id === building.id);
    if (byId) return byId;
  }
  if (buildingName) {
    const wanted = normaliseAnswer(buildingName);
    const byName = landmarks.find(landmark => normaliseAnswer(landmark.name) === wanted);
    if (byName) return byName;
  }
  if (!building.lngLat) return null;
  let nearest: Landmark | null = null, nearestKm = 0.06;
  for (const landmark of landmarks) {
    if (!landmark.lngLat) continue;
    const km = kmBetween(
      { lat: building.lngLat[1], lng: building.lngLat[0] },
      { lat: landmark.lngLat[1], lng: landmark.lngLat[0] },
    );
    if (km < nearestKm) { nearest = landmark; nearestKm = km; }
  }
  return nearest;
}
