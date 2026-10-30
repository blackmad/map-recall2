// `isWater` without MapLibre: the own-map overview's water polygons
// (own-map-v1/overview.json.gz, 12k polygons) in a PolygonGrid. Replaces
// vector-map.js `isWater`'s queryRenderedFeatures on the basemap's fills:
// deterministic, works off screen, does not depend on what is drawn.

import { PolygonGrid } from '../ownMap/geometry';
import { toLocal, type Vec2 } from '../ownMap/frame';

export class WaterIndex {
  private readonly grid: PolygonGrid;
  constructor(polygons: readonly (readonly (readonly Vec2[])[])[]) { this.grid = new PolygonGrid(polygons); }
  isWater(lng: number, lat: number): boolean {
    const [x, y] = toLocal(lng, lat);
    return this.grid.contains(x, y);
  }
}
