// Free Ride, the browser half: markers over the notable places near the
// rider, taps that open their cards, the plaque's tally line, and the small
// "Free ride · Exit" bar.
//
// What gets a marker and where markers may sit is decided in `freeRide.ts`,
// tested without a canvas. The cards themselves are the game's own landmark,
// bridge-register and street-origin cards (`landmarkRuntime.ts`): Free Ride
// only opens them on a tap instead of a quiz or a drive-by.
//
// Methods end up on `Game.prototype` (via the presentation runtime, see
// `installFreeRide`), so `this` is the Game instance; `FreeRideHost` is the
// slice of it this file uses.

import {
  FREE_RIDE_BRIDGE_RADIUS_M,
  FREE_RIDE_LABEL_REACH_M,
  FREE_RIDE_MARKER_RADIUS_M,
  FREE_RIDE_REFRESH_SECONDS,
  freeRideTallyKey,
  secondMarkerIds,
  isFreeRidePattern,
  layoutMarkers,
  MARKER_STEM,
  markerAt,
  markerLabel,
  nearbyPlaces,
  tapNamesWay,
  type FreeRideNearby,
  type FreeRidePlace,
  type MarkerRequest,
  type PlacedMarker,
  type ScreenRect,
} from './freeRide';
import { isWorthACard } from './landmarkData';
import { isBoat } from './modes';
import type { LandmarkHost } from './host';
import type { Hud, Track } from './collaborators';
import { DEFAULT_NOTICE_CONFIG, type NoticeHold } from './landmarkNotice';
import type { NoticeSource } from './driveByTrigger';
import type { LandmarkNotice, WorldPoint } from './worldTypes';
import type { HudLayout } from '../hudLayout';
import { StreetLabelCandidates, type StreetLabelAnchor } from './streetLabelCandidates';
import { t as tr } from '../../i18n/index.ts';
import { LabelFade } from '../labels/labelFade';
import {
  buildChecklists,
  checklistLine,
  checklistProgress,
  collectionEnabled,
  corridorAhead,
  CORRIDOR_AHEAD_M,
  CORRIDOR_HALF_WIDTH_PX,
  distanceAlpha,
  noteOpened,
  overCorridor,
  pickTokenPlace,
  readCollection,
  ridesThrough,
  saveCollection,
  stampIfComplete,
  TOKEN_NEAR_PX as TOKEN_NEAR_PX_CSS,
  TOKEN_RADIUS_M,
  TOKEN_RIDE_THROUGH_M,
  tokenSizePx,
  type Checklist,
  type ChecklistProgress,
  type CollectionPlace,
  type CollectionState,
  type Corridor,
} from './freeRideCollection';
import { drawCollectedToken, drawDiscoveryToken } from './freeRideCollectionDraw';
import { readPassport, savePassport } from './neighborhoodPassport';
import { buurtAt, PLACE_AT_MAX_M, placeReach, type PlaceAnchor } from './placeBuurt';
import { bumpSessionCounter } from './sessionCounters';

/** A tap within this many world px of a way's edge names it (~5 m). */
const WAY_TAP_SLOP_PX = 15;
const BRIDGE_COLOUR = '#2f6f9f';

export interface FreeRideHost extends LandmarkHost {
  state: number;
  track: Track;
  hud: Hud;
  routePattern: string;
  _liveRoutePath: WorldPoint[] | null;
  quizCurrentName: string;
  freeRide?: boolean;
  _freeRidePlaces?: FreeRidePlace[] | null;
  _freeRidePlacesFrom?: { landmarks: unknown; bridges: unknown } | null;
  _freeRideNearby?: FreeRideNearby[];
  _freeRideRefresh?: number;
  _freeRideMarkers?: PlacedMarker[];
  /** Marker fade (labels/labelFade.ts) and where each faded marker last stood. */
  _freeRideMarkerFade?: LabelFade<string>;
  _freeRideMarkerLast?: Map<string, { x: number; y: number; label: string; kind: FreeRideNearby['kind']; width: number; height: number }>;
  _freeRideOpened?: Set<string>;
  _freeRideRestore?: { labels: boolean } | null;
  _freeRideBar?: HTMLElement | null;
  _freeRideBarKey?: string;
  _freeRideLabels?: { labels: unknown; names: Set<string>; index: StreetLabelCandidates<StreetLabelAnchor> } | null;
  /** The collection (freeRideCollection.ts); null unless `?collection=1` (off by default, F1 #311). */
  _freeRideCollection?: FreeRideCollectionState | null;
  /** Every buurt's places list, kept whether or not the collection runs: the
   *  plaque's place-buurt rule (placeBuurt.ts) needs it in every Free Ride. */
  _freeRideLists?: FreeRideListsCache | null;
  _neighborhoodAt(x: number, y: number): { name: string } | null;
  _toWorld?(lat: number, lon: number): WorldPoint | null;

  _showLandmarkNotice(notice: LandmarkNotice, hold: NoticeHold, source?: NoticeSource): void;
  _showStreetKnowledge(name: string, type?: 'street' | 'water' | 'bridge' | 'line', replaceOpenCard?: boolean): void;
  _ensureLandmarkImage(landmark: LandmarkNotice | null): void;
  _inspectBuildingAt(clientX: number, clientY: number): void;
  _hudRects(): HudLayout;
  _openRouteSetup?(): void;
}

export interface FreeRideListsCache {
  lists: Map<string, Checklist> | null;
  listsFrom: { places: unknown; neighborhoods: unknown } | null;
  /** Place key → its neighbourhood's list name. */
  hoodOfKey: Map<string, string>;
  /** Place key → how far it reaches for the plaque (world px; placeBuurt.ts). */
  reach?: Map<string, number>;
}

export interface FreeRideCollectionState {
  state: CollectionState;
  opened: Set<string>;
  /** The landmark carrying the discovery token, and where it was last drawn. */
  token: (CollectionPlace & { distance: number }) | null;
  tokenScreen: { key: string; x: number; y: number; size: number; alpha: number } | null;
  /** Why the token was not drawn last frame (for the spec), null when drawn or absent. */
  tokenHidden: 'offscreen' | 'corridor' | 'hud' | null;
  /** The corridor as last projected, for the spec and the debug overlay. */
  corridor: Corridor | null;
  /** Set when a list was completed: the plaque says so for a few seconds. */
  stampMoment: { hood: string; until: number } | null;
  /** A completed list whose stamped postcard waits for the bottom band (one-card rule). */
  stampPostcard: string | null;
  /** The coin just collected by riding through it on a phone: it flips, then goes. */
  collected: { x: number; y: number; at: number } | null;
}

/** How long the collected coin's flip lasts (ms). */
const COLLECT_FLIP_MS = 600;

const CHECKLIST_COPY = {
  count: (opened: number, total: number) => tr('freeRide.checklist', { opened, total }),
  done: (total: number) => tr('freeRide.checklistDone', { total }),
};

/** How long the plaque says "stamped" after a list is completed (s). */
const STAMP_MOMENT_SECONDS = 6;

export interface GameFreeRideRuntime extends FreeRideHost {}

export class GameFreeRideRuntime {
  /** Start or end Free Ride to match the ride just set up. `_setupRace`
   *  calls this last, after the route, labels and spoilers are in place. */
  _syncFreeRide(): void {
    if (isFreeRidePattern(this.routePattern)) this._beginFreeRide();
    else this._endFreeRide();
  }

  _beginFreeRide(): void {
    this.freeRide = true;
    // No route: the finish point exists only because the road network is
    // built between two ends. Nothing draws it, and nothing arrives at it.
    this.routePath = [];
    this._liveRoutePath = null;
    this.quizCurrentName = '';
    this.quizFeedback = '';
    const map = this.vectorMap;
    map.setSpoilersSuspended?.(true);
    if (!this._freeRideRestore) this._freeRideRestore = { labels: !!map._labelsVisible };
    map.setLabelsVisible?.(true);
    map.setRoute(null, this.osmLoader, false);
    map.setStreetHighlights(this.track, this.osmLoader, new Set(), '', -1, null);
    this.track.hideStartTag = true;
    this._freeRidePlaces = null;
    this._freeRidePlacesFrom = null;
    this._freeRideNearby = [];
    this._freeRideMarkers = [];
    this._freeRideRefresh = 0;
    this._freeRideOpened = new Set();
    this._freeRideCollection = null;
    if (this._freeRideLists) this._freeRideLists.reach = undefined;
    if (collectionEnabled(typeof location === 'undefined' ? '' : location.search)) {
      const state = readCollection(typeof localStorage === 'undefined' ? null : localStorage);
      this._freeRideCollection = {
        state, opened: new Set(state.opened),
        token: null, tokenScreen: null, tokenHidden: null, corridor: null, stampMoment: null, stampPostcard: null, collected: null,
      };
    }
    this._showFreeRideBar(true);
  }

  /** Back to the quiz rules: spoiler screening and the player's own label
   *  setting return. Safe to call when no free ride is running. */
  _endFreeRide(): void {
    const restore = this._freeRideRestore;
    if (!this.freeRide && !restore) return;
    this.freeRide = false;
    this._freeRideMarkers = [];
    this._freeRideNearby = [];
    this._freeRideCollection = null;
    const map = this.vectorMap;
    map?.setSpoilersSuspended?.(false);
    if (restore && !restore.labels) map?.setLabelsVisible?.(false);
    this._freeRideRestore = null;
    if (this.track) this.track.hideStartTag = false;
    this._showFreeRideBar(false);
  }

  /** Every street and canal name is labelled in Free Ride. The anchors are
   *  indexed once per network and only those near the camera are tested. */
  _freeRideLabelCandidates(): (labels: StreetLabelAnchor[] | undefined, cx: number, cy: number, reach: number) => readonly StreetLabelAnchor[] {
    const labels = this.track?.labels;
    let cache = this._freeRideLabels;
    if (!cache || cache.labels !== labels) {
      cache = this._freeRideLabels = {
        labels,
        names: new Set((labels || []).map(label => label.text)),
        index: new StreetLabelCandidates<StreetLabelAnchor>(),
      };
    }
    const knowledge = { mapLabelNames: cache.names, knownPlaces: new Map<string, unknown>() };
    const index = cache.index;
    const maxReach = FREE_RIDE_LABEL_REACH_M * PIXELS_PER_METER;
    return (anchors, cx, cy, reach) => index.candidates(anchors, knowledge, cx, cy, Math.min(reach, maxReach));
  }

  /** Landmarks with something to say, and every named bridge crossing. */
  _freeRideCatalog(): FreeRidePlace[] {
    const from = this._freeRidePlacesFrom;
    if (this._freeRidePlaces && from && from.landmarks === this.landmarks && from.bridges === this.bridges) {
      return this._freeRidePlaces;
    }
    const places: FreeRidePlace[] = [];
    const worth = (this.landmarks || []).filter(landmark => isWorthACard(landmark));
    const second = secondMarkerIds(worth);
    for (const landmark of worth) {
      if (second.has(String(landmark.id))) continue;
      places.push({ key: landmark.id, kind: 'landmark', name: landmark.name, x: landmark.x, y: landmark.y, prominence: landmark.prominenceScore });
    }
    for (const bridge of this.bridges || []) {
      const name = bridge.displayName || bridge.name;
      for (const crossing of bridge.crossings || []) {
        places.push({ key: `bridge:${bridge.id}`, kind: 'bridge', name, x: crossing.x, y: crossing.y });
      }
    }
    this._freeRidePlaces = places;
    this._freeRidePlacesFrom = { landmarks: this.landmarks, bridges: this.bridges };
    return places;
  }

  _updateFreeRide(dt: number): void {
    if (!this.freeRide || !this.player) return;
    const collection = this._freeRideCollection;
    // Riding through the token opens its card (checked every frame: at bike speed 0.4 s is 2 m).
    if (collection?.token && this.state === GameState.RACING && !collection.opened.has(collection.token.key)
      && ridesThrough(this.player, collection.token, TOKEN_RIDE_THROUGH_M * PIXELS_PER_METER)
      && this._landmarkNotice?.id !== collection.token.key) {
      if (this.viewport?.mode === 'compact') {
        // A phone collects the place but opens no card by itself (no auto pop-ups on the phone); a tap opens it.
        const token = collection.token;
        collection.collected = { x: token.x, y: token.y, at: performance.now() };
        this._noteFreeRideOpened(token.key);
        collection.token = null;
      } else {
        this._openFreeRideLandmark(collection.token.key);
        collection.token = null;
      }
    }
    this._freeRideRefresh = (this._freeRideRefresh ?? 0) - dt;
    if (this._freeRideRefresh > 0) return;
    this._freeRideRefresh = FREE_RIDE_REFRESH_SECONDS;
    const catalog = this._freeRideCatalog();
    this._freeRideNearby = nearbyPlaces(this.player, catalog, {
      radiusPx: FREE_RIDE_MARKER_RADIUS_M * PIXELS_PER_METER,
      bridgeRadiusPx: FREE_RIDE_BRIDGE_RADIUS_M * PIXELS_PER_METER,
    });
    if (collection) {
      const list = this._freeRideChecklist(this.currentNeighborhood);
      const progress = checklistProgress(list, collection.opened);
      collection.token = pickTokenPlace(this.player, catalog.filter(place => place.kind === 'landmark'), collection.opened, {
        radius: TOKEN_RADIUS_M * PIXELS_PER_METER,
        prefer: new Set(progress?.remaining ?? []),
      });
      if (collection.token) this._ensureLandmarkImage(this.landmarks.find(l => l.id === collection.token!.key) ?? null);
    }
    // The photo is ready by the time the rider taps.
    for (const place of this._freeRideNearby) {
      if (place.kind !== 'landmark') continue;
      this._ensureLandmarkImage(this.landmarks.find(landmark => landmark.id === place.key) ?? null);
    }
  }

  /** The plaque's line in place of the score: the current neighbourhood's
   *  checklist when it has one ("3 of 9 places"; the plaque names the
   *  neighbourhood on the line above), else the places opened this ride. */
  _freeRideTally(): string {
    const collection = this._freeRideCollection;
    if (collection) {
      const moment = collection.stampMoment;
      if (moment && moment.until > performance.now()) return tr('freeRide.stamped');
      const progress = this._freeRideChecklistProgress(this.currentNeighborhood);
      if (progress) return checklistLine(this.currentNeighborhood, progress, { underQuestion: this.quizCurrentName, copy: CHECKLIST_COPY }).count;
    }
    const { key, count } = freeRideTallyKey(this._freeRideOpened?.size ?? 0);
    return tr(key, { count });
  }

  /** Every neighbourhood's checklist, built once per catalogue and boundary set
   *  (with the collection off too: the plaque's place anchors read it). */
  _freeRideChecklists(): Map<string, Checklist> | null {
    const collection = (this._freeRideLists ||= { lists: null, listsFrom: null, hoodOfKey: new Map() });
    const places = this._freeRideCatalog();
    const from = collection.listsFrom;
    if (collection.lists && from && from.places === places && from.neighborhoods === this.neighborhoods) return collection.lists;
    const landmarks = places.filter(place => place.kind === 'landmark');
    // A place's buurt is the buurt of its own centre (#284): the game point is
    // snapped onto the nearest way and can sit across a boundary.
    const byId = new Map((this.landmarks || []).map(landmark => [String(landmark.id), landmark]));
    const lists = buildChecklists(landmarks, place => {
      const lngLat = byId.get(String(place.key))?.lngLat;
      const centre = lngLat ? this._toWorld?.(lngLat[1], lngLat[0]) : null;
      return buurtAt(this.neighborhoods || [], centre?.x ?? place.x, centre?.y ?? place.y);
    });
    collection.lists = lists;
    collection.listsFrom = { places, neighborhoods: this.neighborhoods };
    collection.hoodOfKey = new Map();
    for (const list of lists.values()) for (const place of list.places) collection.hoodOfKey.set(place.key, list.hood);
    return lists;
  }

  /** The checklist places near a point, as anchors for the plaque's buurt
   *  (placeBuurt.ts): while the rider stands at a place, the plaque names the
   *  buurt whose checklist holds it. Empty outside Free Ride; kept with the
   *  collection off (F1, #311: the placeBuurt rule stays). */
  _freeRidePlaceAnchors(x: number, y: number): PlaceAnchor[] {
    if (!this.freeRide) return [];
    const lists = this._freeRideChecklists();
    const collection = this._freeRideLists;
    if (!lists || !collection) return [];
    const max = PLACE_AT_MAX_M * PIXELS_PER_METER;
    const reaches = (collection.reach ||= new Map());
    const anchors: PlaceAnchor[] = [];
    for (const list of lists.values()) {
      for (const place of list.places) {
        if (Math.abs(place.x - x) > max || Math.abs(place.y - y) > max) continue;
        let reach = reaches.get(place.key);
        if (reach === undefined) {
          const road = this.track?.getNearestRoad?.(place.x, place.y);
          reach = placeReach(road?.dist ?? null, PIXELS_PER_METER);
          if (road) reaches.set(place.key, reach);
        }
        anchors.push({ x: place.x, y: place.y, hood: list.hood, reach });
      }
    }
    return anchors;
  }

  _freeRideChecklist(hood: string | null | undefined): Checklist | null {
    if (!hood) return null;
    return this._freeRideChecklists()?.get(hood) ?? null;
  }

  _freeRideChecklistProgress(hood: string | null | undefined): ChecklistProgress | null {
    const collection = this._freeRideCollection;
    if (!collection) return null;
    return checklistProgress(this._freeRideChecklist(hood), collection.opened);
  }

  _freeRideCollectionOn(): boolean {
    return !!this.freeRide && !!this._freeRideCollection;
  }

  _freeRideTakeStampPostcard(hood: string): boolean {
    const collection = this._freeRideCollection;
    if (!this.freeRide || !collection || collection.stampPostcard !== hood) return false;
    collection.stampPostcard = null;
    return true;
  }

  _freeRideStampWaiting(hood: string | null | undefined): boolean {
    return !!hood && !!this.freeRide && this._freeRideCollection?.stampPostcard === hood;
  }

  /** The postcard's checklist caption for a neighbourhood, or '' (no list, or the collection is off). */
  _freeRideChecklistCaption(hood: string): string {
    if (!this.freeRide) return '';
    const progress = this._freeRideChecklistProgress(hood);
    return progress ? checklistLine(hood, progress, { underQuestion: this.quizCurrentName, copy: CHECKLIST_COPY }).count : '';
  }

  /** The current neighbourhood's unopened places, for the radar, and the
   *  coin's place whenever the coin is not drawn in frame: off screen, over
   *  the corridor or under the HUD, the radar carries its bearing (#286; on a
   *  phone the coin was off screen at 6 of 7 stops, ride review #280). */
  _freeRideRadarPlaces(): WorldPoint[] {
    const collection = this._freeRideCollection;
    if (!this.freeRide || !collection) return [];
    const list = this._freeRideChecklist(this.currentNeighborhood);
    const places: WorldPoint[] = list ? list.places.filter(place => !collection.opened.has(place.key)) : [];
    const token = collection.token;
    if (token && !collection.tokenScreen && !collection.opened.has(token.key)
      && !places.some(place => Math.hypot(place.x - token.x, place.y - token.y) < 1)) places.push({ x: token.x, y: token.y });
    return places;
  }

  /** Draw the markers, nearest first, keeping off the HUD, the open card and
   *  the vehicle. Their boxes are the tap targets until the next frame. */
  _renderFreeRideMarkers(): void {
    this._freeRideMarkers = [];
    const fade = (this._freeRideMarkerFade ||= new LabelFade<string>());
    const last = (this._freeRideMarkerLast ||= new Map());
    fade.begin(performance.now());
    const nearby = this._freeRideNearby;
    if (!this.freeRide || !this.player) { for (const key of fade.leftovers()) fade.drop(key); return; }
    const ctx = this.ctx;
    const surface = window.CanalRecallUi.hudSurface;
    const compact = this.viewport?.mode === 'compact';
    const fontSize = compact ? 13 : 12;
    const height = compact ? 26 : 22;
    const font = `700 ${fontSize}px ${surface.fontUi}`;
    ctx.save();
    ctx.font = font;
    const requests: Array<MarkerRequest & { label: string; kind: FreeRideNearby['kind'] }> = [];
    for (const place of nearby || []) {
      // No choice of a "Which building is this?" question is named while it is open (G3).
      if (this.quizPromptName && (place.name === this.quizPromptName || this.quizWithheldNames?.includes(place.name))) continue;
      if (this.landmarkApproachWithheld?.includes(place.name)) continue;
      const at = this.camera.worldToScreen(place.x, place.y);
      const label = markerLabel(place.name, undefined, text => ctx.measureText(text).width);
      const width = Math.ceil(ctx.measureText(label).width) + height + 8;
      requests.push({ key: place.key, kind: place.kind, label, anchorX: at.x, anchorY: at.y, width, height });
      last.set(place.key, { x: place.x, y: place.y, label, kind: place.kind, width, height });
    }
    // Markers on screen a moment ago claim their place first (placement
    // hysteresis): a neighbour cannot take it on a one-frame jitter (#122).
    requests.sort((a, b) => Number(fade.alpha(b.key) > 0) - Number(fade.alpha(a.key) > 0));
    const layout = this._hudRects();
    const rect = (r: { x: number; y: number; width: number; height: number } | null | undefined): ScreenRect | null =>
      r && r.width > 0 && r.height > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
    const vehicle = this.camera.worldToScreen(this.player.x, this.player.y);
    const blocked = [
      rect(layout.recall), rect(layout.compass), this.showMiniMap ? rect(layout.minimap) : null,
      layout.dpad ? rect(layout.dpad.bounds) : null,
      this._landmarkCardBounds,
      { x: vehicle.x - 28, y: vehicle.y - 40, w: 56, h: 60 },
      this._freeRideBarRect(),
    ].filter((r): r is ScreenRect => !!r);
    const placed = layoutMarkers(requests, { width: CANVAS_W, height: CANVAS_H }, blocked);
    const activeId = this._landmarkNotice?.id || '';
    const collection = this._freeRideCollection;
    // Markers fade with distance (user 2026-10-30), with the collection on or off (F1, #311).
    const distanceOf = new Map((nearby || []).map(place => [place.key, place.distance / PIXELS_PER_METER]));
    const far = (key: string) => distanceAlpha(distanceOf.get(key) ?? Infinity);
    const draw = (key: string, kind: FreeRideNearby['kind'], label: string, anchorX: number, anchorY: number, box: ScreenRect, rawAlpha: number) => {
      const alpha = rawAlpha * (activeId === key ? 1 : far(key));
      const active = activeId === key || (kind === 'bridge' && this._landmarkNotice?.name === nearby?.find(p => p.key === key)?.name);
      const dot = kind === 'bridge' ? BRIDGE_COLOUR : surface.arrow;
      // Stem and the anchor dot on the place itself.
      ctx.strokeStyle = surface.ink;
      ctx.globalAlpha = 0.55 * alpha;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(anchorX, box.y + box.h);
      ctx.lineTo(anchorX, anchorY);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(anchorX, anchorY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // The label plate.
      ctx.shadowColor = surface.shadow;
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = active ? surface.ink : surface.cardSolid;
      roundRect(ctx, box.x, box.y, box.w, box.h, box.h / 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = active ? surface.ink : surface.border;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(box.x + box.h / 2, box.y + box.h / 2, box.h * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = active ? surface.cardSolid : surface.ink;
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, box.x + box.h - 2, box.y + box.h / 2 + 0.5);
      ctx.globalAlpha = 1;
    };
    // Markers fade in and out over LABEL_FADE_MS (user 2026-10-30: "they at least need a fade").
    const shown = new Set<string>();
    for (const marker of placed) {
      shown.add(marker.key);
      const request = requests.find(r => r.key === marker.key)!;
      draw(marker.key, request.kind, request.label, marker.anchorX, marker.anchorY, marker.box, fade.want(marker.key, true));
    }
    // Lost the layout, or out of range: fade where it stands (above its anchor, as layoutMarkers puts it).
    const fading = (key: string, anchorX: number, anchorY: number, item: { label: string; kind: FreeRideNearby['kind']; width: number; height: number }, noHold: boolean) => {
      const alpha = fade.want(key, false, { noHold });
      if (alpha <= 0) return;
      const box = { x: anchorX - item.width / 2, y: anchorY - MARKER_STEM - item.height, w: item.width, h: item.height };
      draw(key, item.kind, item.label, anchorX, anchorY, box, alpha);
    };
    for (const request of requests) if (!shown.has(request.key)) fading(request.key, request.anchorX, request.anchorY, request, false);
    for (const key of fade.leftovers()) {
      const item = last.get(key);
      if (!item) { fade.drop(key); continue; }
      const at = this.camera.worldToScreen(item.x, item.y);
      fading(key, at.x, at.y, item, true);
    }
    ctx.restore();
    this._freeRideMarkers = placed;
    if (collection) this._renderFreeRideToken(blocked);
  }

  /** The discovery token on the landmark that carries it: smaller and
   *  fainter with distance, never over the corridor ahead or a HUD card. */
  _renderFreeRideToken(blocked: readonly ScreenRect[]): void {
    const collection = this._freeRideCollection;
    if (!collection || !this.player) return;
    collection.tokenScreen = null;
    collection.tokenHidden = null;
    const collected = collection.collected;
    if (collected) {
      const t = (performance.now() - collected.at) / COLLECT_FLIP_MS;
      if (t >= 1) collection.collected = null;
      else {
        const at = this.camera.worldToScreen(collected.x, collected.y);
        const size = TOKEN_NEAR_PX_CSS / Math.max(0.01, this.canvas.getBoundingClientRect().width / CANVAS_W);
        drawCollectedToken(this.ctx, at.x, at.y, size, t);
      }
    }
    const vehicle = this.camera.worldToScreen(this.player.x, this.player.y);
    collection.corridor = {
      path: [vehicle, ...corridorAhead(this.player, CORRIDOR_AHEAD_M * PIXELS_PER_METER).slice(1)
        .map(point => this.camera.worldToScreen(point.x, point.y))],
      halfWidth: CORRIDOR_HALF_WIDTH_PX,
    };
    const token = collection.token;
    if (!token || collection.opened.has(token.key)) return;
    const live = Math.hypot(token.x - this.player.x, token.y - this.player.y) / PIXELS_PER_METER;
    // The size cap is in CSS px; the canvas may be drawn larger or smaller than it is shown.
    const shown = this.canvas.getBoundingClientRect().width;
    const cssPerCanvas = shown > 0 ? shown / CANVAS_W : 1;
    const size = tokenSizePx(live) / cssPerCanvas;
    const alpha = distanceAlpha(live);
    const at = this.camera.worldToScreen(token.x, token.y);
    const r = size / 2;
    if (!Number.isFinite(at.x) || at.x < r || at.y < r || at.x > CANVAS_W - r || at.y > CANVAS_H - r) { collection.tokenHidden = 'offscreen'; return; }
    if (overCorridor(at, r, collection.corridor)) { collection.tokenHidden = 'corridor'; return; }
    if (blocked.some(b => at.x + r > b.x && at.x - r < b.x + b.w && at.y + r > b.y && at.y - r < b.y + b.h)) { collection.tokenHidden = 'hud'; return; }
    collection.tokenHidden = null;
    drawDiscoveryToken(this.ctx, at.x, at.y, size, alpha);
    collection.tokenScreen = { key: token.key, x: at.x, y: at.y, size, alpha };
  }

  /** The Free ride · Exit bar in canvas units, so markers keep off it. */
  _freeRideBarRect(): ScreenRect | null {
    const bar = this._freeRideBar;
    if (!bar || bar.hidden) return null;
    const box = bar.getBoundingClientRect();
    const canvas = this.canvas.getBoundingClientRect();
    if (!box.width || !canvas.width) return null;
    const sx = CANVAS_W / canvas.width, sy = CANVAS_H / canvas.height;
    return { x: (box.left - canvas.left) * sx, y: (box.top - canvas.top) * sy, w: box.width * sx, h: box.height * sy };
  }

  /** The marker under a canvas point, for the hover cursor. */
  _freeRideMarkerAt(x: number, y: number): PlacedMarker | null {
    return this.freeRide ? markerAt(this._freeRideMarkers || [], x, y) : null;
  }

  /**
   * A tap in Free Ride: a marker opens its place; otherwise the building
   * under the tap answers as it does in every mode; failing that, the street
   * or canal under the tap is named, with its origin card where there is one.
   * Returns true when something opened.
   */
  _freeRideClick(x: number, y: number, clientX: number, clientY: number): boolean {
    const token = this._freeRideCollection?.tokenScreen;
    if (token && Math.hypot(x - token.x, y - token.y) <= token.size / 2 + 10) return this._openFreeRideLandmark(token.key);
    const marker = this._freeRideMarkerAt(x, y);
    if (marker) return this._openFreeRidePlace(marker.key);
    const before = this._landmarkNotice;
    this._inspectBuildingAt(clientX, clientY);
    if (this._landmarkNotice && this._landmarkNotice !== before) {
      this._noteFreeRideOpened(this._landmarkNotice.id);
      return true;
    }
    return this._openFreeRideWayAt(clientX, clientY);
  }

  /** Open a landmark's card by id (the token's place need not have a marker). */
  _openFreeRideLandmark(key: string): boolean {
    const landmark = this.landmarks.find(l => l.id === key);
    if (!landmark) return false;
    this.quizFeedback = '';
    this._showLandmarkNotice(landmark, { kind: 'sticky' }, 'click');
    this.vectorMap.setActiveLandmark(landmark);
    this._noteFreeRideOpened(key);
    return true;
  }

  _openFreeRidePlace(key: string): boolean {
    const place = this._freeRideNearby?.find(p => p.key === key);
    if (!place) return false;
    this.quizFeedback = '';
    if (place.kind === 'landmark') {
      const landmark = this.landmarks.find(l => l.id === key);
      if (!landmark) return false;
      this._showLandmarkNotice(landmark, { kind: 'sticky' }, 'click');
      this.vectorMap.setActiveLandmark(landmark);
      this._noteFreeRideOpened(key);
      return true;
    }
    const bridge = this.bridges.find(b => `bridge:${b.id}` === key);
    if (!bridge) return false;
    if (this._openKnowledgeCard(bridge.name, 'bridge')) {
      this._noteFreeRideOpened(key);
      return true;
    }
    // A bridge the register and the encyclopedia say nothing about still
    // answers with its name and whatever the extract carries.
    this._showLandmarkNotice({
      id: key, name: place.name, type: 'bridge',
      detail: bridge.detail || '', wikipediaUrl: bridge.wikipediaUrl || '',
    }, { kind: 'sticky' }, 'click');
    this._noteFreeRideOpened(key);
    return true;
  }

  /** The street or canal under a tap, named; its origin card when the
   *  extract has one. False when the tap is not on a way. */
  _openFreeRideWayAt(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const world = this.vectorMap.screenToWorld?.(clientX - rect.left, clientY - rect.top, rect, this.osmLoader);
    if (!world || !this.track) return false;
    const contact = this.track.getNearestRoad(world.x, world.y);
    if (!contact || !tapNamesWay(contact, WAY_TAP_SLOP_PX)) return false;
    const name = this.track.segments[contact.segIdx]?.name || '';
    if (!name) return false;
    const type = isBoat(this.travelMode) ? 'water' : 'street';
    if (!this._openKnowledgeCard(name, type)) {
      this._showLandmarkNotice({ id: `free-way:${name}`, name, type: type === 'water' ? 'waterway' : 'street' }, { kind: 'sticky' }, 'click');
    }
    this._noteFreeRideOpened(this._landmarkNotice?.id || name);
    return true;
  }

  /** Open the shipped origin/register card for a name, even if it was shown
   *  earlier this ride (a tap is a request, not a drive-by). */
  _openKnowledgeCard(name: string, type: 'street' | 'water' | 'bridge'): boolean {
    const before = this._landmarkNotice;
    this._seenStreetKnowledge = new Set();
    this._showStreetKnowledge(name, type, true);
    const opened = !!this._landmarkNotice && this._landmarkNotice !== before;
    if (opened) {
      // Asked for, so it opens at full strength and never folds itself away.
      this._landmarkNoticeSource = 'click';
      this._landmarkNoticeState.elapsed = DEFAULT_NOTICE_CONFIG.fadeSeconds;
      this._landmarkNoticeAlpha = 1;
    }
    return opened;
  }

  _noteFreeRideOpened(id: string): void {
    const ride = (this._freeRideOpened ||= new Set());
    if (!id || ride.has(id)) return;
    ride.add(id);
    bumpSessionCounter('placesOpened');
    const collection = this._freeRideCollection;
    if (!collection || collection.opened.has(id)) return;
    collection.opened.add(id);
    collection.state = noteOpened(collection.state, id);
    const store = typeof localStorage === 'undefined' ? null : localStorage;
    this._freeRideChecklists();
    const hood = this._freeRideLists?.hoodOfKey.get(id);
    if (hood) {
      const progress = this._freeRideChecklistProgress(hood);
      const today = new Date().toISOString().slice(0, 10);
      const stamped = stampIfComplete(collection.state, store ? readPassport(store) : { stamped: [] }, hood, progress, today);
      if (stamped.fresh) {
        collection.state = stamped.state;
        if (store) savePassport(store, stamped.passport);
        bumpSessionCounter('stampsEarned');
        collection.stampMoment = { hood, until: performance.now() + STAMP_MOMENT_SECONDS * 1000 };
        // The postcard comes back with the stamp on it, once the landmark card
        // just opened has closed (one-card rule; landmarkRuntime). On a phone
        // too: it is the once-per-buurt reward, not a per-place pop-up, and a
        // plaque line alone read as no payoff (ride review #280, defect 10).
        collection.stampPostcard = hood;
        this._postcardPending = hood;
      }
    }
    saveCollection(store, collection.state);
  }

  /** The "Free ride · Exit" bar: where the destination card sits on a wide
   *  screen, under the plaque on a phone. */
  _showFreeRideBar(visible: boolean): void {
    let bar = this._freeRideBar ?? document.getElementById('free-ride-bar');
    if (!bar && visible) {
      bar = document.createElement('div');
      bar.id = 'free-ride-bar';
      bar.setAttribute('role', 'group');
      bar.innerHTML = '<span class="free-ride-badge enamel-plaque"></span><button id="free-ride-exit" type="button"></button>';
      bar.querySelector('button')!.addEventListener('click', () => {
        this._openRouteSetup?.();
      });
      document.body.appendChild(bar);
    }
    this._freeRideBar = bar;
    if (!bar) return;
    bar.hidden = !visible;
    this._freeRideBarKey = '';
    if (!visible) return;
    bar.setAttribute('aria-label', tr('freeRide.badge'));
    bar.querySelector('.free-ride-badge')!.textContent = tr('freeRide.badge');
    const exit = bar.querySelector('button')!;
    exit.textContent = tr('freeRide.exit');
    exit.setAttribute('aria-label', tr('freeRide.exitLabel'));
  }

  /** Called each frame while riding free; moves the bar only when the layout
   *  moved. Hidden while a card or panel owns the screen. */
  _placeFreeRideBar(): void {
    const bar = this._freeRideBar;
    if (!bar || !this.freeRide) return;
    const layout = this._hudRects();
    const rect = this.canvas.getBoundingClientRect();
    const sx = rect.width / CANVAS_W;
    const sy = rect.height / CANVAS_H;
    const hidden = !!this._utilityOpen || this.state !== GameState.RACING;
    let key: string;
    let style: Partial<CSSStyleDeclaration>;
    if (layout.destinationInRecall) {
      const top = (layout.recall.y + layout.recall.height + 10) * sy + rect.top;
      key = `c|${top.toFixed(1)}|${hidden}`;
      style = { top: `${top}px`, left: '50%', right: '', transform: 'translateX(-50%)' };
    } else {
      const d = layout.destination;
      const top = d.y * sy + rect.top;
      const right = window.innerWidth - ((d.x + d.width) * sx + rect.left);
      key = `w|${top.toFixed(1)}|${right.toFixed(1)}|${hidden}`;
      style = { top: `${top}px`, right: `${right}px`, left: '', transform: '' };
    }
    if (key === this._freeRideBarKey) return;
    this._freeRideBarKey = key;
    Object.assign(bar.style, style);
    bar.hidden = hidden;
  }
}

/** Free Ride ships inside the presentation bundle, one runtime module per
 *  bundle (scripts/check-game-decomposition.mjs): `presentationRuntime.ts`
 *  installs these methods on its own class rather than registering a second
 *  module. */
export function installFreeRide(target: { prototype: object }): void {
  for (const name of Object.getOwnPropertyNames(GameFreeRideRuntime.prototype)) {
    if (name === 'constructor') continue;
    Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(GameFreeRideRuntime.prototype, name)!);
  }
}
