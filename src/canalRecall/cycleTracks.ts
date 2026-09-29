// Separated cycle tracks, drawn by the game.
//
// Street mode is cycling, and the router prefers separated tracks. On
// Nassaukade the route ran along the `highway=cycleway` beside the road, which
// the basemap draws as a faint dashed path, so the blue line looked as if it
// floated off the white street (user report 2026-09-29, "what could we do to
// get the blue line onto the white rendered street?"). Drawing the tracks in
// Amsterdam's red asphalt puts the line on something visible, and shows the
// infrastructure the route bonus rewards.

export interface RoutingWay {
  highway?: string;
  nodes: ReadonlyArray<{ lat: number; lon: number }>;
}

export interface CycleTrackCollection {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; properties: Record<string, never>; geometry: { type: 'LineString'; coordinates: Array<[number, number]> } }>;
}

/** The ways drawn as cycle tracks: OSM's own separated tracks. A painted lane
 *  (`cycleway=lane` on a road) is part of the road, and the road is drawn. */
export function isCycleTrack(way: RoutingWay): boolean {
  return way.highway === 'cycleway';
}

export function cycleTrackFeatures(ways: readonly RoutingWay[]): CycleTrackCollection {
  return {
    type: 'FeatureCollection',
    features: ways.filter(way => isCycleTrack(way) && way.nodes.length >= 2).map(way => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: way.nodes.map(node => [node.lon, node.lat] as [number, number]) },
    })),
  };
}

/** Amsterdam's red cycle-track asphalt, softened to sit under the route. */
export const CYCLE_TRACK_COLOUR = '#c96f5f';
/** Line width in px by zoom: a thread at district scale, about a real track's
 *  2.5 m at street scale. */
export const CYCLE_TRACK_WIDTH: unknown[] = ['interpolate', ['exponential', 2], ['zoom'], 13, 0.6, 16, 2.5, 18, 7, 20, 26];
export const CYCLE_TRACK_OPACITY: unknown[] = ['interpolate', ['linear'], ['zoom'], 12, 0, 13.5, 0.55, 17, 0.8];
