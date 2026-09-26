/**
 * MapLibre paint for the driveable transit corridor overlay.
 *
 * Liberty already draws rails in thin yellow, but they sit under extruded
 * buildings — so metro tunnels look like tracks punching through façades.
 * Surface (tram) stays under buildings; underground (metro) is drawn above
 * them as a dashed “tunnel” so the corridor stays readable.
 */

export const TRANSIT_OVERLAY_SOURCE_ID = 'transit-network';

export const TRANSIT_OVERLAY_LAYER_IDS = [
  'transit-network-surface-casing',
  'transit-network-surface',
  'transit-network-tunnel-under',
  'transit-network-tunnel-casing',
  'transit-network-tunnel',
] as const;

export type TransitOverlayGrade = 'surface' | 'underground';

export interface TransitOverlayLine {
  name: string;
  mode: string;
  /** WGS84 [lon, lat] vertices. */
  coordinates: [number, number][];
  color?: string | null;
}

function zoomWidth(low: number, high: number): unknown[] {
  return ['interpolate', ['linear'], ['zoom'], 13, low, 18, high];
}

/** GeoJSON FeatureCollection for MapLibre. */
export function transitOverlayCollection(
  lines: readonly TransitOverlayLine[],
): { type: 'FeatureCollection'; features: Array<Record<string, unknown>> } {
  return {
    type: 'FeatureCollection',
    features: lines
      .filter((line) => line.coordinates.length >= 2)
      .map((line) => {
        const grade: TransitOverlayGrade = line.mode === 'metro' ? 'underground' : 'surface';
        return {
          type: 'Feature',
          properties: {
            name: line.name,
            mode: line.mode,
            grade,
            color: line.color || (grade === 'underground' ? '#F59E0B' : '#E11D48'),
          },
          geometry: {
            type: 'LineString',
            coordinates: line.coordinates,
          },
        };
      }),
  };
}

/**
 * Layers that sit *under* building extrusions (surface tram + a faint metro
 * ghost so underground routes still register on the ground plane).
 */
export function transitOverlayUnderBuildingLayers(): Array<Record<string, unknown>> {
  return [
    {
      id: 'transit-network-surface-casing',
      type: 'line',
      source: TRANSIT_OVERLAY_SOURCE_ID,
      filter: ['==', ['get', 'grade'], 'surface'],
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': '#3F0D1C',
        'line-width': zoomWidth(7, 18),
        'line-opacity': 0.88,
      },
    },
    {
      id: 'transit-network-surface',
      type: 'line',
      source: TRANSIT_OVERLAY_SOURCE_ID,
      filter: ['==', ['get', 'grade'], 'surface'],
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#E11D48'],
        'line-width': zoomWidth(3.5, 11),
        'line-opacity': 0.95,
      },
    },
    {
      id: 'transit-network-tunnel-under',
      type: 'line',
      source: TRANSIT_OVERLAY_SOURCE_ID,
      filter: ['==', ['get', 'grade'], 'underground'],
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': '#92400E',
        'line-width': zoomWidth(4, 12),
        'line-opacity': 0.35,
        'line-dasharray': [1, 1.4],
      },
    },
  ];
}

/**
 * Tunnel callout drawn *above* buildings so metro corridors remain visible
 * when GTFS shapes / Liberty rails pass through extruded footprints.
 */
export function transitOverlayAboveBuildingLayers(): Array<Record<string, unknown>> {
  return [
    {
      id: 'transit-network-tunnel-casing',
      type: 'line',
      source: TRANSIT_OVERLAY_SOURCE_ID,
      filter: ['==', ['get', 'grade'], 'underground'],
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': 'rgba(15, 23, 42, 0.72)',
        'line-width': zoomWidth(6, 16),
        'line-opacity': 0.85,
        'line-dasharray': [1.2, 1.6],
      },
    },
    {
      id: 'transit-network-tunnel',
      type: 'line',
      source: TRANSIT_OVERLAY_SOURCE_ID,
      filter: ['==', ['get', 'grade'], 'underground'],
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#F59E0B'],
        'line-width': zoomWidth(2.8, 9),
        'line-opacity': 0.92,
        'line-dasharray': [1.2, 1.6],
      },
    },
  ];
}
