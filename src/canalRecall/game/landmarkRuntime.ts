// Landmarks, neighborhood postcards and the encyclopedia cards.
//
// This file is the browser-facing half of the subsystem: clicks, timers,
// fetches, images and canvas. Everything that decides *what* the player is
// told lives in `landmarkData.ts`, where it is tested without a canvas. Keep
// that split — a rule about which buildings are nameable belongs there, not in
// a method that also measures a card.
//
// Methods are copied onto `Game.prototype` by `game.js`, so `this` is the Game
// instance. The interface merged into the class below is what types it.

import {
  buildBridges,
  buildLandmarks,
  buildNeighborhoods,
  isWorthACard,
  matchLandmarkToBuilding,
  neighborhoodAt,
  splitDetail,
} from './landmarkData';
import type { RoadSegment } from './collaborators';
import type {
  BoundaryFeature,
  BridgeCrossingIndex,
  BridgeFeature,
  LandmarkFeature,
  LatLng,
  NeighborhoodEnrichment,
  StreetKnowledgeEntry,
} from './extracts';
import {
  advanceNotice,
  openNotice,
  type NoticeHold,
} from './landmarkNotice';
import {
  buildFactIndex,
  commitShownFact,
  factCardText,
  loadRotationState,
} from '../facts/factStore';
import type { FactsFile } from '../facts/factTypes';
import type { FactChoice } from '../facts/factRotation';
import type { LandmarkHost } from './host';
import type { BuildingHit, Landmark, LandmarkNotice, Neighborhood, WorldPoint } from './worldTypes';
import { buildRouteKnowledgeIndex, routeKnowledgeFor, shouldOfferStreetKnowledge } from './routeKnowledge';
import { canShowMiniMap, canShowTeachingCard } from './teachingSurface';
import { isTransit } from './modes';
import {
  buildCorridorStreetIndex,
  distanceToPath,
  type CorridorStreetFeature,
} from '../transit/corridorStreets';

/** Seconds a clicked card stays up. A drive-by card is held by proximity
 *  instead — see `landmarkNotice.ts`. */
const CLICKED_NOTICE_SECONDS = 8;
/** px — how far a click may be from a landmark's marker and still select it. */
const CLICK_SELECT_RADIUS = 120;
/** px — how close the vehicle must come before a landmark card opens by
 *  itself. About 100 m at the current world scale. */
const DRIVE_BY_RADIUS = 300;

async function readJson<T>(response: Response, fallback: T): Promise<T> {
  if (!response.ok) return fallback;
  try {
    return (await response.json()) as T;
  } catch {
    // Vite/Express history fallbacks can answer a missing optional JSON file
    // with index.html and HTTP 200. Optional enrichment must never take the
    // required landmark and boundary data down with it.
    return fallback;
  }
}

export interface GameLandmarkRuntime extends LandmarkHost {}

export class GameLandmarkRuntime {
  // ---- Clicking a building ----

  _inspectBuildingAt(clientX: number, clientY: number): void {
    if (!this.player || this.quizPromptName || this._utilityOpen) return;
    const rect = this.canvas.getBoundingClientRect();
    const screen = {
      x: (clientX - rect.left) * CANVAS_W / rect.width,
      y: (clientY - rect.top) * CANVAS_H / rect.height,
    };
    const building = this.vectorMap.inspectBuilding(clientX - rect.left, clientY - rect.top, rect);

    let nearest: LandmarkNotice | null = null;
    let nearestDistance = CLICK_SELECT_RADIUS;
    for (const landmark of this.landmarks) {
      const point = this.camera.worldToScreen(landmark.x, landmark.y);
      const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
      if (distance < nearestDistance) { nearest = landmark; nearestDistance = distance; }
    }
    if (nearest && building && building.featureTarget) {
      // Keep the curated card identity, but highlight the actual extrusion
      // under the click rather than rebuilding its approximate OSM footprint.
      nearest = { ...nearest, featureTarget: building.featureTarget };
    }
    if (!nearest) {
      if (!building) return;
      nearest = this._cardForClickedBuilding(building);
    }
    this._showLandmarkNotice(nearest, { kind: 'timed', seconds: CLICKED_NOTICE_SECONDS });
    this.vectorMap.setActiveLandmark(nearest);
  }

  /** Open a landmark card, saying why it is up — which is what decides when it
   *  comes down.
   *
   *  Both ways a card can open — clicking a building and driving past one —
   *  come through here, which is why the fact rotation is applied at this seam
   *  rather than at either caller. It is also the first moment the card is
   *  certain to be shown, and a fact must not be spent on a card that never
   *  appears: `factCardText` chooses, and `commitShownFact` is what marks the
   *  sentence as told. */
  _showLandmarkNotice(notice: LandmarkNotice, hold: NoticeHold): void {
    this._landmarkNotice = this._withRotatedFact(notice);
    this._landmarkNoticeHold = hold;
    this._landmarkNoticeState = openNotice();
    // Start transparent so the card fades in, and so a new card never inherits
    // the alpha the previous one happened to be at.
    this._landmarkNoticeAlpha = 0;
    // Street/water encyclopedia cards arrive here without a proximity prefetch,
    // so kick the image load as soon as the notice opens.
    this._ensureLandmarkImage(this._landmarkNotice);
  }

  /**
   * Replace the card's lede with the next fact in this feature's rotation,
   * keeping a same-article opening sentence ahead of the trivia so the
   * punchline stays in context.
   *
   * Returns the card unchanged when the feature has no generated facts, which
   * is the normal case until a batch has been reviewed and published — the
   * Wikipedia lede is the fallback, not an error.
   */
  _withRotatedFact(notice: LandmarkNotice): LandmarkNotice {
    if (!this._facts || !this._facts.size) return notice;
    // Prefer the catalog opening; fall back to the encyclopedia lede already
    // on this notice before rotation overwrites `detail`.
    const chosen = factCardText(
      notice.id,
      this._facts,
      this._factRotation,
      notice.detail || notice.longDetail,
    );
    if (!chosen) return notice;
    this._commitFact(chosen.choice);
    return { ...notice, ...chosen.text };
  }

  _commitFact(choice: FactChoice): void {
    this._factRotation = commitShownFact(
      typeof localStorage === 'undefined' ? null : localStorage,
      this._factRotation,
      choice,
    );
  }

  _clearLandmarkNotice(): void {
    this._landmarkNotice = null;
    this._landmarkNoticeState = openNotice();
    this._landmarkNoticeAlpha = 0;
    this._landmarkCardBounds = null;
  }

  /**
   * A nameless footprint cannot teach the player anything, but swallowing the
   * click makes the map look broken. Acknowledge it without inventing a name
   * or presenting it as encyclopedia content.
   */
  _cardForClickedBuilding(building: BuildingHit): LandmarkNotice {
    const buildingName = building.name || '';
    const matched = matchLandmarkToBuilding(this.landmarks, building, buildingName);
    if (matched) return { ...matched, featureTarget: building.featureTarget };
    return {
      id: `clicked-${building.id || building.lngLat.join('-')}`,
      name: buildingName || 'No building details',
      detail: buildingName
        ? 'Mapped building — click nearby landmarks to learn more.'
        : 'This building has no name in the map data.',
      lngLat: building.lngLat,
      featureTarget: building.featureTarget,
    };
  }

  // ---- Encyclopedia text ----

  /** The extract carries a Wikipedia URL for 236 of its 300 landmarks, which
   *  the canvas card cannot make clickable — so it is offered on a key. */
  _openLandmarkArticle(): void {
    const notice = this._landmarkNotice;
    if (!notice || !notice.wikipediaUrl) return;
    window.open(notice.wikipediaUrl, '_blank', 'noopener');
  }

  /**
   * Show a shipped encyclopedia card for a named street or waterway.
   *
   * Text comes only from the published extract (`streets.json` / `water.json` /
   * `street-knowledge.json`), filled offline by `enrich:amsterdam-wikipedia`
   * and made English by `enrich:english`. Missing coverage stays silent — the
   * game must not fetch Wikipedia at runtime (that path shipped Dutch ledes
   * with an NL badge).
   */
  _showStreetKnowledge(name: string, type: 'street' | 'water' | 'line' = 'street', replaceOpenCard = false): void {
    // Transit lines/stops are not in the street/water encyclopedia extract yet.
    if (type === 'line') return;
    const key = this._normaliseCanalName(name);
    const entry = routeKnowledgeFor(this.streetKnowledge, name, type,
      (value) => this._normaliseCanalName(value));
    if (!entry) return;
    const noticeId = entry.id || `${type}-knowledge:${key}`;
    this._seenStreetKnowledge = this._seenStreetKnowledge || new Set();
    if (!shouldOfferStreetKnowledge({
      hasExtract: !!(entry.wikipediaUrl || entry.wikipediaExtract),
      alreadyShownThisDrive: this._seenStreetKnowledge.has(noticeId),
      quizOpen: !!this.quizPromptName,
      landmarkCardOpen: !!this._landmarkNotice,
      replaceOpenCard,
    })) return;
    this._seenStreetKnowledge.add(noticeId);
    const split = splitDetail(entry.wikipediaExtract || '');
    this._showLandmarkNotice({
      id: noticeId,
      name: entry.name || name,
      type: 'street',
      detail: split.detail,
      longDetail: split.longDetail,
      imageUrl: entry.wikipediaImageUrl || '',
      wikipediaUrl: entry.wikipediaUrl || '',
      extractLang: entry.wikipediaExtractLang || 'en',
    }, { kind: 'timed', seconds: CLICKED_NOTICE_SECONDS });
  }

  // ---- Loading the extract ----

  async _loadLandmarks(
    this: LandmarkHost,
    centerLat: number,
    centerLng: number,
    segments: RoadSegment[],
  ): Promise<void> {
    try {
      const Prefs = window.CanalRecallPreferences;
      const city = Prefs && Prefs.cityById
        ? Prefs.cityById(this.cityId || Prefs.DEFAULT_CITY_ID || 'amsterdam')
        : { extractPath: '../data/extracts/amsterdam' };
      const base = window.location.href;
      const url = (name: string) => new URL(`${city.extractPath}/${name}`, base);
      const [
        landmarkResponse, boundaryResponse, neighborhoodEnrichedResponse,
        bridgeResponse, crossingResponse, streetKnowledgeResponse, streetResponse,
        waterResponse, brandedPoiResponse,
        factResponse,
      ] = await Promise.all([
        fetch(url('landmarks.json')),
        fetch(url('boundaries.json')),
        fetch(url('neighborhoods-enriched.json')),
        fetch(url('bridges.json')),
        fetch(url('bridge-crossings.json')),
        fetch(url('street-knowledge.json')),
        fetch(url('streets.json')),
        fetch(url('water.json')),
        fetch(url('branded-pois.json')),
        // Generated trivia. Absent until a batch has been reviewed and
        // published, and the cards fall back to the Wikipedia lede when it is.
        fetch(url('facts.json')).catch(() => new Response('null', { status: 404 })),
      ]);
      if (!landmarkResponse.ok || !boundaryResponse.ok) throw new Error('Cached place data unavailable');

      const [features, boundaries, neighborhoodEnriched, bridgeFeatures, crossingIndex,
        streetKnowledge, streetFeatures, waterFeatures, brandedPois, factsFile] =
        await Promise.all([
          landmarkResponse.json() as Promise<LandmarkFeature[]>,
          boundaryResponse.json() as Promise<BoundaryFeature[]>,
          readJson<NeighborhoodEnrichment[]>(neighborhoodEnrichedResponse, []),
          readJson<BridgeFeature[]>(bridgeResponse, []),
          readJson<BridgeCrossingIndex>(crossingResponse, { bridges: {} }),
          readJson<StreetKnowledgeEntry[]>(streetKnowledgeResponse, []),
          readJson<StreetKnowledgeEntry[]>(streetResponse, []),
          readJson<StreetKnowledgeEntry[]>(waterResponse, []),
          readJson<unknown[]>(brandedPoiResponse, []),
          readJson<FactsFile | null>(factResponse, null),
        ]);

      this._facts = buildFactIndex(factsFile);
      this._factRotation = loadRotationState(
        typeof localStorage === 'undefined' ? null : localStorage);

      this.streetKnowledge = buildRouteKnowledgeIndex(
        streetKnowledge, streetFeatures, waterFeatures,
        (name) => this._normaliseCanalName(name),
      );
      this.vectorMap.setPlaces(features, boundaries);
      this.vectorMap.setBrandedPois(brandedPois);

      const metersPerDegreeLat = 111320;
      const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
      const toWorld = ([lat, lng]: LatLng): WorldPoint => ({
        x: (lng - centerLng) * metersPerDegreeLng * PIXELS_PER_METER + this.osmLoader._lastOffsetX,
        y: -(lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER + this.osmLoader._lastOffsetY,
      });
      // Transit corridors must not snap landmarks onto the rails — that pulled
      // off-corridor museums onto the tram shape. Boat/bike still snap so a
      // landmark standing beside a named way lands on the mapped network.
      this.landmarks = buildLandmarks(features, (lat, lng) => (
        isTransit(this.travelMode)
          ? toWorld([lat, lng])
          : this.osmLoader.latLngToGamePoint(lat, lng, centerLat, centerLng, segments, false)
      ));

      // Photos are fetched as the player approaches, not up front. Preloading
      // the 50 most prominent landmarks in the city meant 229 landmarks had a
      // Wikipedia photo and only the top 50 could ever show it: DeLaMar ranks
      // 89th and its card came up bare. It also spent bandwidth on the
      // Rijksmuseum for a route that never goes near it.
      this._landmarkImages = new Map();
      this._landmarkImageRequests = new Set();

      this.neighborhoods = buildNeighborhoods(boundaries, neighborhoodEnriched, toWorld);
      this.bridges = buildBridges(bridgeFeatures, crossingIndex, toWorld);

      // Read-only street centrelines for transit corridor quizzes — never
      // driveable, only nearest-name lookup along the rails.
      if (isTransit(this.travelMode)) {
        const corridorStreets: CorridorStreetFeature[] = streetFeatures.map((street) => ({
          name: street.name,
          paths: (street.paths || (street.path ? [street.path] : []))
            .map((path) => path.map(([lat, lng]) => [lat, lng] as [number, number])),
          distractors: street.distractors,
        }));
        this._corridorStreetIndex = buildCorridorStreetIndex(
          corridorStreets,
          (lat, lng) => toWorld([lat, lng]),
        );
      } else {
        this._corridorStreetIndex = null;
      }

      // Postcard images load on demand — see _warmRouteNeighborhoodImages.
      // Preloading the whole city cost ~26 fetches per route for postcards
      // most trips never reach.
      this._neighborhoodImages = new Map();
      this._neighborhoodLetterArt = new Map();
      this._neighborhoodImageRequests = new Set();
    } catch (error) {
      console.warn('Landmark notes unavailable:', error);
      this.landmarks = [];
      this._corridorStreetIndex = null;
    }
  }

  // ---- Per-frame ----

  _updateLandmarks(dt: number): void {
    if (this._neighborhoodNoticeTimer > 0) this._neighborhoodNoticeTimer -= dt;
    if (this._landmarkNotice) {
      const visibility = advanceNotice(
        this._landmarkNoticeState, this._landmarkNoticeHold, this.player, dt);
      this._landmarkNoticeState = visibility.state;
      this._landmarkNoticeAlpha = visibility.alpha;
      if (!visibility.visible) {
        this._clearLandmarkNotice();
        this.vectorMap.setActiveLandmark(null);
      }
    }
    if (!this.player) return;

    const detectedHood = this._neighborhoodAt(this.player.x, this.player.y);
    const transition = CanalRecallNeighborhood.advanceNeighborhood({
      current: this.currentNeighborhood,
      candidate: this._neighborhoodCandidate,
      candidateSeconds: this._neighborhoodCandidateTimer,
    }, detectedHood ? detectedHood.name : '', dt);
    this.currentNeighborhood = transition.state.current;
    this._neighborhoodCandidate = transition.state.candidate;
    this._neighborhoodCandidateTimer = transition.state.candidateSeconds;

    const hood = this.neighborhoods.find(area => area.name === this.currentNeighborhood) || detectedHood;
    if (this.currentNeighborhood) this._visitedNeighborhoods.add(this.currentNeighborhood);
    // Arriving somewhere is worth a postcard the first time too. Previously an
    // empty `_previousNeighborhood` swallowed the opening entry, so the card
    // for the neighborhood the route starts in never appeared at all.
    if (this.currentNeighborhood && this.currentNeighborhood !== this._previousNeighborhood) {
      this._previousNeighborhood = this.currentNeighborhood;
      if (canShowTeachingCard(this._teachingGate()) && this.raceTime > NEIGHBORHOOD_NOTICE_GRACE) {
        if (hood) this._ensureNeighborhoodImage(hood);
        this._neighborhoodNotice = hood || { name: this.currentNeighborhood };
        this._neighborhoodNoticeTimer = NEIGHBORHOOD_NOTICE_SECONDS;
      }
    }

    let nearest: Landmark | null = null;
    let nearestDistance = DRIVE_BY_RADIUS;
    const routePath = this.routePath;
    const landmarkRouteRadiusPx = isTransit(this.travelMode)
      ? (window.CanalRecallTransit?.TRANSIT_LANDMARK_ROUTE_RADIUS_M ?? 120) * PIXELS_PER_METER
      : Infinity;
    for (const landmark of this.landmarks) {
      const distance = Math.hypot(landmark.x - this.player.x, landmark.y - this.player.y);
      if (distance < LANDMARK_IMAGE_PREFETCH_RADIUS) this._ensureLandmarkImage(landmark);
      if (this._seenLandmarks.has(landmark.id)) continue;
      // A card with nothing but a name interrupts the driving corridor to teach
      // nothing. Clicking such a building still answers; driving past it does not.
      if (!isWorthACard(landmark)) continue;
      if (isTransit(this.travelMode) && routePath && routePath.length >= 2) {
        if (distanceToPath(routePath, landmark.x, landmark.y) > landmarkRouteRadiusPx) continue;
      }
      if (distance < nearestDistance) { nearest = landmark; nearestDistance = distance; }
    }
    if (this._landmarkNotice) return;
    if (!canShowTeachingCard(this._teachingGate())) return;
    if (nearest) {
      this._seenLandmarks.add(nearest.id);
      this._seenLandmarkNames.add(nearest.name);
      // Held while the player is still near it, rather than for a fixed six
      // seconds that expired while they were still approaching.
      this._showLandmarkNotice(nearest, { kind: 'proximity', anchor: { x: nearest.x, y: nearest.y } });
      this.vectorMap.setActiveLandmark(nearest);
    }
  }

  _neighborhoodAt(x: number, y: number): Neighborhood | null {
    return neighborhoodAt(this.neighborhoods, x, y);
  }

  // ---- Images ----

  /**
   * Fetch a landmark photo once, on demand. Every landmark the extract has a
   * Wikipedia image for can show one; the card falls back to text until it
   * arrives, and a failure is remembered so it is not retried every frame.
   */
  _ensureLandmarkImage(landmark: Landmark | null): void {
    if (!landmark || !landmark.imageUrl) return;
    if (!this._landmarkImageRequests) this._landmarkImageRequests = new Set();
    if (this._landmarkImageRequests.has(landmark.id)) return;
    this._landmarkImageRequests.add(landmark.id);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => this._landmarkImages.set(landmark.id, img);
    img.onerror = () => console.warn('Landmark image unavailable:', landmark.name, landmark.imageUrl);
    img.src = landmark.imageUrl;
  }

  /** The postcard renderer falls back to its typographic composition until the
   *  image lands, so this can stay lazy. */
  _ensureNeighborhoodImage(hood: { name: string; imageUrl?: string } | null): void {
    if (!hood || !hood.imageUrl) return;
    if (!this._neighborhoodImageRequests) this._neighborhoodImageRequests = new Set();
    if (this._neighborhoodImageRequests.has(hood.name)) return;
    this._neighborhoodImageRequests.add(hood.name);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => this._neighborhoodImages.set(hood.name, img);
    img.onerror = () => console.warn('Neighborhood image unavailable:', hood.name, hood.imageUrl);
    img.src = hood.imageUrl;
  }

  // ---- Cards ----

  _renderLandmarkNotice(): void {
    const lm = this._landmarkNotice;
    // The card is its own hit target, so the bounds only exist for as long as
    // it is actually on screen. A stale rectangle would keep swallowing clicks
    // over open map after the card faded out.
    this._landmarkCardBounds = null;
    if (!lm) return;
    if (!canShowTeachingCard(this._teachingGate())) return;
    const ctx = this.ctx;
    const alpha = this._landmarkNoticeAlpha;
    if (alpha <= 0) return;

    const img = this._landmarkImages && this._landmarkImages.get(lm.id);
    const hasImage = !!(img && img.complete && img.naturalWidth > 0);
    const cards = window.CanalRecallCards;
    const measure = (text: string, font: string): number => { ctx.font = font; return ctx.measureText(text).width; };
    const card = cards.measureLandmarkCard({
      name: lm.name,
      body: lm.longDetail || lm.detail || cards.placeOnlyDetail(
        lm.type,
        this.currentNeighborhood,
        this._cityDisplayName(),
      ),
      category: lm.type ? lm.type.toUpperCase() : '',
      factKind: lm.factKind,
      extractLang: lm.extractLang,
      hasArticle: !!lm.wikipediaUrl,
      hasImage,
    }, measure, window.CanalRecallUi.landmarkCardWidth(this.viewport));

    // Trivia belongs at the bottom of the screen. Across the top it sat exactly
    // where the player is looking to see what is coming, so a card about a
    // church already passed hid the junction ahead.
    const postcardShowing = !!(this._neighborhoodNotice && this._neighborhoodNoticeTimer > 0)
      && canShowTeachingCard(this._teachingGate());
    const bottomLayout = window.CanalRecallUi.hudLayout({
      viewport: this.viewport,
      tripWidth: 180, postcardVisible: postcardShowing,
      landmarkWidth: card.width, landmarkHeight: card.height,
      feedbackVisible: !!this.quizFeedback,
      neighborhoodVisible: !!this.currentNeighborhood,
      minimapVisible: canShowMiniMap(this.showMiniMap, this._teachingGate()),
      zoomVisible: this._zoomBadgeTimer > 0,
      controlsVisible: !this.input.isMobile && this.raceTime < CONTROLS_HINT_DURATION,
    });
    // On a phone the card spans the width it is given rather than its measured
    // desktop width, so a 480 px card cannot hang off a 390 px screen.
    const cardX = bottomLayout.landmark.x;
    const cardY = bottomLayout.landmark.y;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    this.renderer.drawLandmarkCard(ctx, card, cardX, cardY, hasImage && img ? img : null);
    ctx.restore();
    this._landmarkCardBounds = { x: cardX, y: cardY, w: card.width, h: card.height };
  }

  /**
   * The expanded card. `measureLandmarkCard` cuts the body to three or four
   * lines so the driving corridor stays visible; this is where the rest of the
   * extract lives, in HTML, where it can scroll and carry a real link.
   *
   * Opening it goes through the utility-panel machinery, so it pauses the
   * controls and closes on Esc like the help and settings panels do.
   */
  _expandLandmarkNotice(): boolean {
    const lm = this._landmarkNotice;
    const panel = this._landmarkPanel;
    if (!lm || !panel) return false;

    const cards = window.CanalRecallCards;
    // One fact per paragraph when these are generated facts: the panel is
    // `pre-wrap`, and four unrelated sentences run together read as one
    // rambling one.
    const body = (lm.factTexts && lm.factTexts.length ? lm.factTexts.join('\n\n') : '')
      || lm.longDetail || lm.detail
      || cards.placeOnlyDetail(lm.type, this.currentNeighborhood, this._cityDisplayName());

    const badges = panel.querySelector('#landmark-panel-badges') as HTMLElement;
    badges.textContent = '';
    const pushBadge = (label: string, kind: string) => {
      const chip = document.createElement('span');
      chip.dataset.kind = kind;
      chip.textContent = label;
      badges.appendChild(chip);
    };
    if (lm.type) pushBadge(lm.type.toUpperCase().replace(/_/g, ' '), 'category');
    if (lm.factKind) pushBadge(lm.factKind.toUpperCase(), 'fact');
    if (lm.extractLang && lm.extractLang !== 'en') {
      // Say plainly that this is not the English article rather than leaving
      // the reader to work out why the text is Dutch.
      pushBadge(`${lm.extractLang.toUpperCase()} — NOT TRANSLATED YET`, 'lang');
    }

    (panel.querySelector('#landmark-panel-title') as HTMLElement).textContent = lm.name || '';
    (panel.querySelector('#landmark-panel-body') as HTMLElement).textContent = body;

    const image = panel.querySelector('#landmark-panel-image') as HTMLImageElement;
    if (lm.imageUrl) {
      image.src = lm.imageUrl;
      image.alt = lm.name || '';
      image.hidden = false;
    } else {
      image.removeAttribute('src');
      image.hidden = true;
    }

    const link = panel.querySelector('#landmark-panel-link') as HTMLAnchorElement;
    if (lm.wikipediaUrl) {
      link.href = lm.wikipediaUrl;
      link.hidden = false;
    } else {
      link.removeAttribute('href');
      link.hidden = true;
    }

    (panel.querySelector('#landmark-panel-scroll') as HTMLElement).scrollTop = 0;
    this._toggleUtilityPanel(panel);
    return true;
  }

  _renderNeighborhoodNotice(): void {
    const hood = this._neighborhoodNotice;
    if (!hood || this._neighborhoodNoticeTimer <= 0) return;
    if (!canShowTeachingCard(this._teachingGate())) return;
    const ctx = this.ctx;
    const duration = NEIGHBORHOOD_NOTICE_SECONDS;
    const alpha = Math.min(1, this._neighborhoodNoticeTimer * 2.5, (duration - this._neighborhoodNoticeTimer) * 2.5);
    if (alpha <= 0) return;

    const img = this._neighborhoodImages && this._neighborhoodImages.get(hood.name);
    const hasImage = !!(img && img.complete && img.naturalWidth > 0);
    const measure = (text: string, font: string): number => { ctx.font = font; return ctx.measureText(text).width; };
    const city = typeof this._activeCity === 'function' ? this._activeCity() : null;
    const card = window.CanalRecallCards.measurePostcard(
      {
        name: hood.name,
        kind: hood.kind,
        imageArea: hood.imageArea,
        hasImage,
        cityName: city?.name || this._cityDisplayName?.() || 'Amsterdam',
        provinceCaption: city?.provinceCaption || '',
      },
      measure,
      window.CanalRecallUi.postcardWidth(this.viewport));

    const bottomLayout = window.CanalRecallUi.hudLayout({
      viewport: this.viewport, tripWidth: 180,
      postcardHeight: card.height,
      neighborhoodVisible: !!this.currentNeighborhood,
      minimapVisible: canShowMiniMap(this.showMiniMap, this._teachingGate()),
    });
    const cardX = bottomLayout.postcard.x;
    const baseCardY = bottomLayout.postcard.y;
    // Slide up into place rather than appearing; the offset is animation, not
    // layout, so it is applied after the band has been arbitrated.
    const slideT = Math.min(1, (duration - this._neighborhoodNoticeTimer) / 0.3);
    const cardY = baseCardY + (1 - (1 - Math.pow(1 - slideT, 3))) * 50;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    this.renderer.drawPostcard(ctx, card, cardX, cardY, hasImage && img ? img : null);
    ctx.restore();
  }
}

window.CanalRecallGameModules = window.CanalRecallGameModules || [];
window.CanalRecallGameModules.push(GameLandmarkRuntime);
