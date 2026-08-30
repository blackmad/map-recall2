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
}

/** One road segment of the loaded network, as `osm-loader.js` produces it. */
export interface RoadSegment {
  points: WorldPoint[];
  name?: string;
  type?: string;
}

export interface OsmLoader {
  /** World-space origin of the current route's projection. */
  _lastOffsetX: number;
  _lastOffsetY: number;
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
