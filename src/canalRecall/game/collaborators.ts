// The legacy canvas objects a runtime subsystem talks to, described by the
// surface it actually uses rather than by their whole implementations. These
// are structural: `camera.js`, `renderer.js`, `osm-loader.js` and
// `vector-map.js` stay untyped JavaScript, and satisfying these interfaces is
// what makes the typed subsystems safe to install onto them.

import type { LandmarkCardLayout, PostcardLayout } from '../noticeCards';
import type { BuildingHit, LandmarkNotice, WorldPoint } from './worldTypes';

export interface Camera {
  worldToScreen(worldX: number, worldY: number): WorldPoint;
  zoom: number;
  /** How far the player has dragged the view off the vehicle. */
  panX: number;
  panY: number;
}

export interface InputManager {
  readonly isMobile: boolean;
  /** True while the one-line "steer with the pad" nudge is still showing. */
  readonly showTouchHint: boolean;
  /** Which d-pad directions are held, for drawing the pad lit. */
  readonly padKeys: import('../touchControls.ts').DpadKeys;
  /** The pad's rectangle, or null on a pointer device. */
  readonly dpad: import('../touchControls.ts').DpadLayout | null;
  /** True once for the frame in which a key went down — the edge, not the
   *  level, so holding `1` does not answer every question in a row. */
  wasPressed(code: string): boolean;
  setViewport(viewport: import('../viewport.ts').Viewport): void;
  /** A tap on the map restarts a finished route; while driving it must not. */
  setTapRestartEnabled(enabled: boolean): void;
}

/** One road segment of the loaded network, as `osm-loader.js` produces it. */
export interface RoadSegment {
  points: WorldPoint[];
  name?: string;
  type?: string;
  /** Physically separated cycle track beside this carriageway. */
  separatedCycleTrack?: boolean;
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
  startPoint: WorldPoint;
  finishPoint: WorldPoint;
  /** The name of the way under a point, or '' where nothing is mapped. */
  getRoadName(x: number, y: number): string;
  getNearestRoad(x: number, y: number): NearestRoad | null;
  getDistanceToFinish(x: number, y: number): number;
  /**
   * `isKnown` decides per label *and per place*, not per name: knowing the
   * Overtoom at the Vondelpark must not write it across the Kinkerbuurt end
   * that has never been asked. `withheld` is the name currently under question,
   * which the map must never answer.
   */
  drawLabels(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    isKnown: (text: string, x: number, y: number) => boolean,
    withheld: string,
    player: WorldPoint | null,
  ): void;
}

export interface ParticleSystem {
  update(dt: number): void;
}

export interface LoadingScreen {
  draw(ctx: CanvasRenderingContext2D, message: string, progress: number): void;
}

/** The canvas HUD. Everything here draws; nothing here decides. */
export interface Hud {
  setTime(seconds: number): void;
  formatTime(seconds: number): string;
  drawTripReadout(ctx: CanvasRenderingContext2D, speed: number, distancePx: number): void;
  /** Speed and odometer as one string, so a phone can fold it into the score
   *  row instead of spending a card on it. */
  tripText(speed: number, distancePx: number): string;
  /** This frame's HUD geometry, from the typed layout module. */
  setLayout(layout: import('../hudLayout.ts').HudLayout): void;
  /** One paper card: fill, hairline and shadow, drawn the same way everywhere. */
  paperCard(
    ctx: CanvasRenderingContext2D,
    rect: import('../hudLayout.ts').Rect,
    options?: { solid?: boolean; radius?: number },
  ): void;
  drawCanalScore(
    ctx: CanvasRenderingContext2D, correct: number, attempts: number, points: number,
    feedback: string, streak?: number, gamey?: boolean, trip?: string,
  ): void;
  drawCurrentLocation(
    ctx: CanvasRenderingContext2D, routeName: string, neighborhood: string,
    travelMode: string, answerHidden?: boolean,
  ): void;
  drawDestination(ctx: CanvasRenderingContext2D, name: string, distancePx: number, expectedNovelty?: number | null): void;
  drawFinishDirection(
    ctx: CanvasRenderingContext2D, playerX: number, playerY: number,
    finishX: number, finishY: number, camera: Camera,
  ): void;
  /** Always-on north rose that tracks camera rotation. */
  drawCompass(ctx: CanvasRenderingContext2D, camera: Camera): void;
  drawCityOverview(ctx: CanvasRenderingContext2D, game: unknown): void;
  drawTouchHint(ctx: CanvasRenderingContext2D): void;
  drawDpad(ctx: CanvasRenderingContext2D, pressed: import('../touchControls.ts').DpadKeys): void;
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
  drawTrack(camera: Camera, track: Track): void;
  drawQuestionFeature(
    camera: Camera, track: Track, featureName: string,
    segmentIndex: number, pointIndex: number, time: number,
  ): void;
  drawSkidMarks(particles: ParticleSystem, camera: Camera): void;
  drawParticles(particles: ParticleSystem, camera: Camera): void;
  /** The boat glyph. */
  drawCar(car: unknown, camera: Camera): void;
  /** The bike/car glyph. */
  drawPlayerCar(car: unknown, camera: Camera): void;
}

export interface VectorMap {
  ready?: boolean;
  sync(camera: Camera, loader: OsmLoader, canvas: HTMLCanvasElement): void;
  setPlayerBike(player: unknown, loader: OsmLoader, visible: boolean): void;
  setPlayerBoat(player: unknown, loader: OsmLoader, visible: boolean): void;
  isPlayerBikeReady(): boolean;
  isPlayerBoatReady(): boolean;
  setRoute(routePath: readonly WorldPoint[] | null, loader: OsmLoader, visible: boolean): void;
  setStreetHighlights(
    track: Track, loader: OsmLoader, learnedNames: Set<string>,
    activeName: string, activeSegmentIndex: number,
  ): void;
  isWater(x: number, y: number, loader: OsmLoader): boolean;
  inspectBuilding(cssX: number, cssY: number, canvasRect: DOMRect): BuildingHit | null;
  setActiveLandmark(landmark: LandmarkNotice | null): void;
  setPlaces(landmarks: unknown, boundaries: unknown): void;
  setBrandedPois(pois: unknown): void;
  /** Hide dense place labels while a quiz owns the corridor. */
  setQuizQuietMap(quiet: boolean): void;
}
