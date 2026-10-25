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
  isFreeRidePattern,
  layoutMarkers,
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
  _freeRideOpened?: Set<string>;
  _freeRideRestore?: { labels: boolean } | null;
  _freeRideBar?: HTMLElement | null;
  _freeRideBarKey?: string;
  _freeRideLabels?: { labels: unknown; names: Set<string>; index: StreetLabelCandidates<StreetLabelAnchor> } | null;

  _showLandmarkNotice(notice: LandmarkNotice, hold: NoticeHold, source?: NoticeSource): void;
  _showStreetKnowledge(name: string, type?: 'street' | 'water' | 'bridge' | 'line', replaceOpenCard?: boolean): void;
  _ensureLandmarkImage(landmark: LandmarkNotice | null): void;
  _inspectBuildingAt(clientX: number, clientY: number): void;
  _hudRects(): HudLayout;
  _openRouteSetup?(): void;
}

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
    for (const landmark of this.landmarks || []) {
      if (!isWorthACard(landmark)) continue;
      places.push({ key: landmark.id, kind: 'landmark', name: landmark.name, x: landmark.x, y: landmark.y });
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
    this._freeRideRefresh = (this._freeRideRefresh ?? 0) - dt;
    if (this._freeRideRefresh > 0) return;
    this._freeRideRefresh = FREE_RIDE_REFRESH_SECONDS;
    this._freeRideNearby = nearbyPlaces(this.player, this._freeRideCatalog(), {
      radiusPx: FREE_RIDE_MARKER_RADIUS_M * PIXELS_PER_METER,
      bridgeRadiusPx: FREE_RIDE_BRIDGE_RADIUS_M * PIXELS_PER_METER,
    });
    // The photo is ready by the time the rider taps.
    for (const place of this._freeRideNearby) {
      if (place.kind !== 'landmark') continue;
      this._ensureLandmarkImage(this.landmarks.find(landmark => landmark.id === place.key) ?? null);
    }
  }

  /** The plaque's line in place of the score. */
  _freeRideTally(): string {
    const { key, count } = freeRideTallyKey(this._freeRideOpened?.size ?? 0);
    return tr(key, { count });
  }

  /** Draw the markers, nearest first, keeping off the HUD, the open card and
   *  the vehicle. Their boxes are the tap targets until the next frame. */
  _renderFreeRideMarkers(): void {
    this._freeRideMarkers = [];
    const nearby = this._freeRideNearby;
    if (!this.freeRide || !this.player || !nearby?.length) return;
    const ctx = this.ctx;
    const surface = window.CanalRecallUi.hudSurface;
    const compact = this.viewport?.mode === 'compact';
    const fontSize = compact ? 13 : 12;
    const height = compact ? 26 : 22;
    const font = `700 ${fontSize}px ${surface.fontUi}`;
    ctx.save();
    ctx.font = font;
    const requests: Array<MarkerRequest & { label: string; kind: FreeRideNearby['kind'] }> = [];
    for (const place of nearby) {
      const at = this.camera.worldToScreen(place.x, place.y);
      const label = markerLabel(place.name);
      requests.push({
        key: place.key, kind: place.kind, label,
        anchorX: at.x, anchorY: at.y,
        width: Math.ceil(ctx.measureText(label).width) + height + 8,
        height,
      });
    }
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
    for (const marker of placed) {
      const request = requests.find(r => r.key === marker.key)!;
      const active = activeId === marker.key || (request.kind === 'bridge' && this._landmarkNotice?.name === nearby.find(p => p.key === marker.key)?.name);
      const dot = request.kind === 'bridge' ? BRIDGE_COLOUR : surface.arrow;
      const { box } = marker;
      // Stem and the anchor dot on the place itself.
      ctx.strokeStyle = surface.ink;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(marker.anchorX, box.y + box.h);
      ctx.lineTo(marker.anchorX, marker.anchorY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(marker.anchorX, marker.anchorY, 3.5, 0, Math.PI * 2);
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
      ctx.fillText(request.label, box.x + box.h - 2, box.y + box.h / 2 + 0.5);
    }
    ctx.restore();
    this._freeRideMarkers = placed;
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
    (this._freeRideOpened ||= new Set()).add(id);
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
