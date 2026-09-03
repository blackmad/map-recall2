/**
 * Finding a city's own boundary in a pile of OSM boundary relations.
 *
 * This is shared by the extract builder and by the refresh script's bbox step
 * on purpose: they have to agree on which polygon is "the city", or the
 * pipeline clips its features to one boundary and names them after another.
 */

export interface BoundaryFeature {
  properties: Record<string, string | undefined>;
  geometry?: { type: string; coordinates: unknown } | null;
}

/**
 * Every name a municipality relation answers to.
 *
 * A city is not always mapped under the name the caller passes. The Hague is
 * the standing example and it has moved: OSM once carried `name='s-Gravenhage'`
 * with "Den Haag" on `name:nl`, and now carries `name=Den Haag` with
 * `'s-Gravenhage` on `official_name`. Reading every name field is what keeps a
 * rename upstream from taking a city out of the build.
 */
export function municipalityNames(feature: BoundaryFeature): string[] {
  return [
    feature.properties.name, feature.properties['name:nl'], feature.properties['name:en'],
    feature.properties.official_name, feature.properties.alt_name,
  ].filter((value): value is string => typeof value === 'string');
}

/** The admin_level 8 relation that answers to `cityName`, or undefined. */
export function findMunicipality<T extends BoundaryFeature>(
  features: readonly T[],
  cityName: string,
): T | undefined {
  const wanted = cityName.toLocaleLowerCase();
  return features.find((feature) =>
    feature.properties.boundary === 'administrative' && feature.properties.admin_level === '8'
    && municipalityNames(feature).some((value) => value.toLocaleLowerCase() === wanted));
}

/** True when the feature carries an area we can clip against. */
export function hasAreaGeometry(feature: BoundaryFeature | undefined): boolean {
  return Boolean(feature?.geometry && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
}

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** The lon/lat extent of any nested GeoJSON coordinate array. */
export function boundingBox(coordinates: unknown): BoundingBox {
  const box: BoundingBox = { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity };
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as [number, number];
      box.minLon = Math.min(box.minLon, lon);
      box.minLat = Math.min(box.minLat, lat);
      box.maxLon = Math.max(box.maxLon, lon);
      box.maxLat = Math.max(box.maxLat, lat);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(coordinates);
  if (!Number.isFinite(box.minLon)) throw new Error('no coordinates to bound');
  return box;
}

/**
 * The bbox grown by a margin in metres, as `osmium extract -b` wants it.
 *
 * The margin exists because a municipality's own boundary is not the edge of
 * what the city needs: a bridge, a roundabout or a canal bank can carry
 * traffic across the line and back, and a way cut exactly at the boundary
 * loses the node that made it connect.
 */
export function osmiumBbox(box: BoundingBox, marginMetres = 2000): string {
  const latMargin = marginMetres / 111_320;
  const midLat = (box.minLat + box.maxLat) / 2;
  const lonMargin = marginMetres / (111_320 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
  return [
    box.minLon - lonMargin, box.minLat - latMargin,
    box.maxLon + lonMargin, box.maxLat + latMargin,
  ].map((value) => value.toFixed(6)).join(',');
}
