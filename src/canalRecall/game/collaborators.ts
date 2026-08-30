// The legacy canvas objects a runtime subsystem talks to, described by the
// surface it actually uses rather than by their whole implementations. These
// are structural: `camera.js`, `renderer.js`, `osm-loader.js` and
// `vector-map.js` stay untyped JavaScript, and satisfying these interfaces is
// what makes the typed subsystems safe to install onto them.

import type { LandmarkCardLayout, PostcardLayout } from '../noticeCards';
import type { BuildingHit, LandmarkNotice, WorldPoint } from './worldTypes';

export interface Camera {
  worldToScreen(worldX: number, worldY: number): WorldPoint;
}

export interface InputManager {
  readonly isMobile: boolean;
  /** True once for the frame in which a key went down — the edge, not the
   *  level, so holding `1` does not answer every question in a row. */
  wasPressed(code: string): boolean;
}

/** One road segment of the loaded network, as `osm-loader.js` produces it. */
export interface RoadSegment {
  points: WorldPoint[];
  name?: string;
  type?: string;
}

/** What the network knows about a name, beyond its geometry. */
export interface FeatureMeta {
  type?: string;
  cityId?: string;
}

export interface OsmLoader {
  /** World-space origin of the current route's projection. `_lastCenterLat` is
   *  `undefined` until a network has been loaded, which is the signal that no
   *  world-to-lat/lon conversion is possible yet. */
  _lastOffsetX: number;
  _lastOffsetY: number;
  _lastCenterLat?: number;
  _lastCenterLng?: number;
  featureMeta?: Map<string, FeatureMeta>;
  /**
   * Project a lat/lng and snap it to the nearest loaded road point. Pass
   * `false` for `maxSnapDist` to mean "no limit" — the landmark pass wants a
   * position for every landmark, not only for ones standing on a road.
   */
  latLngToGamePoint(
    lat: number,
    lng: number,
    centerLat: number,
    centerLng: number,
    segments: RoadSegment[],
    maxSnapDist?: number | false,
  ): (WorldPoint & { snapDistance: number }) | null;
}

/** The nearest mapped way to a point, with enough identity to anchor a
 *  question to the exact stretch that was driven. */
export interface NearestRoad {
  angle: number;
  segIdx: number;
  ptIdx: number;
}

export interface Track {
  segments: RoadSegment[];
  /** The name of the way under a point, or '' where nothing is mapped. */
  getRoadName(x: number, y: number): string;
  getNearestRoad(x: number, y: number): NearestRoad | null;
}

export interface Renderer {
  drawLandmarkCard(
    ctx: CanvasRenderingContext2D,
    card: LandmarkCardLayout,
    x: number,
    y: number,
    image: CanvasImageSource | null,
  ): void;
  drawPostcard(
    ctx: CanvasRenderingContext2D,
    card: PostcardLayout,
    x: number,
    y: number,
    image: CanvasImageSource | null,
  ): void;
}

export interface VectorMap {
  inspectBuilding(cssX: number, cssY: number, canvasRect: DOMRect): BuildingHit | null;
  setActiveLandmark(landmark: LandmarkNotice | null): void;
  setPlaces(landmarks: unknown, boundaries: unknown): void;
  setBrandedPois(pois: unknown): void;
}
