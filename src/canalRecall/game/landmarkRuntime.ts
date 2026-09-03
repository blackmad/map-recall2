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
  englishTitle,
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
import { buildRouteKnowledgeIndex, routeKnowledgeFor } from './routeKnowledge';

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
  _streetSummaryRequests?: Set<string>;

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
    this._ensureLandmarkSummary(nearest);
    // A click can land on something far away, or on a footprint with no world
    // position at all, so proximity says nothing here: hold it for a fixed read.
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
  }

  /**
   * Replace the card's lede with the next fact in this feature's rotation.
   *
   * Returns the card unchanged when the feature has no generated facts, which
   * is the normal case until a batch has been reviewed and published — the
   * Wikipedia lede is the fallback, not an error.
   */
  _withRotatedFact(notice: LandmarkNotice): LandmarkNotice {
    if (!this._facts || !this._facts.size) return notice;
    const chosen = factCardText(notice.id, this._facts, this._factRotation);
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

  /**
   * Only 112 of the 300 landmarks ship an extract, so the rest showed a bare
   * name. Wikipedia's REST summary endpoint sends CORS headers, so the missing
   * text is fetched on demand — no proxy, one request per landmark, cached for
   * the session.
   */
  _ensureLandmarkSummary(landmark: LandmarkNotice | null): void {
    if (!landmark || landmark.longDetail || landmark.detail) return;
    if (!landmark.wikidata && !englishTitle(landmark.wikipedia)) return;
    this._summaryRequests = this._summaryRequests || new Set();
    if (this._summaryRequests.has(landmark.id)) return;
    this._summaryRequests.add(landmark.id);
    this._fetchEnglishSummary(landmark).catch(() => { /* the card falls back to its name */ });
  }

  /**
   * The `wikipedia` tag OSM carries is nearly always the Dutch article
   * ("nl:Blauwbrug"), so fetching the summary it names filled the card with
   * Dutch. The English article is resolved through the feature's Wikidata id
   * instead, and if English has nothing to say about the place the card keeps
   * its name rather than showing a language the player did not ask for.
   */
  async _fetchEnglishSummary(landmark: LandmarkNotice): Promise<void> {
    let title = englishTitle(landmark.wikipedia);
    if (!title && landmark.wikidata) {
      const entity = new URL('https://www.wikidata.org/w/api.php');
      entity.search = new URLSearchParams({
        action: 'wbgetentities', format: 'json', props: 'sitelinks',
        sitefilter: 'enwiki', ids: landmark.wikidata, origin: '*',
      }).toString();
      const response = await fetch(entity, { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json() as {
        entities?: Record<string, { sitelinks?: { enwiki?: { title?: string } } }>;
      };
      title = data?.entities?.[landmark.wikidata]?.sitelinks?.enwiki?.title || '';
    }
    if (!title) return;
    const summary = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const response = await fetch(summary, { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json() as { extract?: string };
    if (!data?.extract) return;
    const split = splitDetail(data.extract);
    landmark.detail = split.detail;
    landmark.longDetail = split.longDetail;
    landmark.extractLang = 'en';
  }

  async _fetchEnglishStreetSummary(entry: StreetKnowledgeEntry): Promise<{ detail: string; longDetail: string } | null> {
    const wikidata = entry.wikidata;
    if (!wikidata) return null;

    // Resolve the English article title through Wikidata, then fetch the
    // English intro summary.
    const entity = new URL('https://www.wikidata.org/w/api.php');
    entity.search = new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      props: 'sitelinks',
      sitefilter: 'enwiki',
      ids: wikidata,
      origin: '*',
    }).toString();

    const entityResponse = await fetch(entity, { headers: { accept: 'application/json' } });
    if (!entityResponse.ok) return null;

    const data = await entityResponse.json() as {
      entities?: Record<string, { sitelinks?: { enwiki?: { title?: string } } }>;
    };
    const title = data?.entities?.[wikidata]?.sitelinks?.enwiki?.title || '';
    if (!title) return null;

    const summary = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const response = await fetch(summary, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;

    const summaryData = await response.json() as { extract?: string };
    if (!summaryData?.extract) return null;

    // Update the entry so the next render uses the cached extract without
    // another request.
    entry.wikipediaExtract = summaryData.extract;

    const split = splitDetail(summaryData.extract);
    return { detail: split.detail, longDetail: split.longDetail };
  }

  /** The extract carries a Wikipedia URL for 236 of its 300 landmarks, which
   *  the canvas card cannot make clickable — so it is offered on a key. */
  _openLandmarkArticle(): void {
    const notice = this._landmarkNotice;
    if (!notice || !notice.wikipediaUrl) return;
    window.open(notice.wikipediaUrl, '_blank', 'noopener');
  }

  _showStreetKnowledge(name: string, type: 'street' | 'water' = 'street'): void {
    const key = this._normaliseCanalName(name);
    const entry = routeKnowledgeFor(this.streetKnowledge, name, type,
      (value) => this._normaliseCanalName(value));
    if (!entry) return;
    const noticeId = entry.id || `${type}-knowledge:${key}`;
    const split = splitDetail(entry.wikipediaExtract || '');
    this._showLandmarkNotice({
      id: noticeId,
      name: entry.name || name,
      type: 'street',
      detail: split.detail,
      longDetail: split.longDetail,
      wikipediaUrl: entry.wikipediaUrl || '',
      extractLang: 'en',
    }, { kind: 'timed', seconds: CLICKED_NOTICE_SECONDS });

    // Many streets already have `wikipediaUrl` but not `wikipediaExtract`.
    // If we have a wikidata id, fetch an English intro summary on demand and
    // patch the open card.
    if (!entry.wikipediaExtract && entry.wikidata && entry.wikipediaUrl) {
      this._streetSummaryRequests = this._streetSummaryRequests || new Set();
      if (this._streetSummaryRequests.has(noticeId)) return;
      this._streetSummaryRequests.add(noticeId);
      this._fetchEnglishStreetSummary(entry)
        .then((split2) => {
          if (!split2) return;
          if (!this._landmarkNotice || this._landmarkNotice.id !== noticeId) return;
          this._landmarkNotice = {
            ...this._landmarkNotice,
            detail: split2.detail,
            longDetail: split2.longDetail,
            extractLang: 'en',
          };
        })
        .catch(() => { /* keep link-only card on failure */ });
    }
  }

  // ---- Loading the extract ----

  async _loadLandmarks(
    this: LandmarkHost,
    centerLat: number,
    centerLng: number,
    segments: RoadSegment[],
  ): Promise<void> {
    try {
      const base = window.location.href;
      const url = (name: string) => new URL(`../data/extracts/amsterdam/${name}`, base);
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

      this.landmarks = buildLandmarks(features, (lat, lng) =>
        this.osmLoader.latLngToGamePoint(lat, lng, centerLat, centerLng, segments, false));

      // Photos are fetched as the player approaches, not up front. Preloading
      // the 50 most prominent landmarks in the city meant 229 landmarks had a
      // Wikipedia photo and only the top 50 could ever show it: DeLaMar ranks
      // 89th and its card came up bare. It also spent bandwidth on the
      // Rijksmuseum for a route that never goes near it.
      this._landmarkImages = new Map();
      this._landmarkImageRequests = new Set();

      const metersPerDegreeLat = 111320;
      const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
      const toWorld = ([lat, lng]: LatLng): WorldPoint => ({
        x: (lng - centerLng) * metersPerDegreeLng * PIXELS_PER_METER + this.osmLoader._lastOffsetX,
        y: -(lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER + this.osmLoader._lastOffsetY,
      });

      this.neighborhoods = buildNeighborhoods(boundaries, neighborhoodEnriched, toWorld);
      this.bridges = buildBridges(bridgeFeatures, crossingIndex, toWorld);

      // Postcard images load on demand — see _warmRouteNeighborhoodImages.
      // Preloading the whole city cost ~26 fetches per route for postcards
      // most trips never reach.
      this._neighborhoodImages = new Map();
      this._neighborhoodLetterArt = new Map();
      this._neighborhoodImageRequests = new Set();
    } catch (error) {
      console.warn('Landmark notes unavailable:', error);
      this.landmarks = [];
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
      if (!this.quizPromptName && this.raceTime > NEIGHBORHOOD_NOTICE_GRACE) {
        if (hood) this._ensureNeighborhoodImage(hood);
        this._neighborhoodNotice = hood || { name: this.currentNeighborhood };
        this._neighborhoodNoticeTimer = NEIGHBORHOOD_NOTICE_SECONDS;
      }
    }

    let nearest: Landmark | null = null;
    let nearestDistance = DRIVE_BY_RADIUS;
    for (const landmark of this.landmarks) {
      const distance = Math.hypot(landmark.x - this.player.x, landmark.y - this.player.y);
      if (distance < LANDMARK_IMAGE_PREFETCH_RADIUS) this._ensureLandmarkImage(landmark);
      if (this._seenLandmarks.has(landmark.id)) continue;
      // A card with nothing but a name interrupts the driving corridor to teach
      // nothing. Clicking such a building still answers; driving past it does not.
      if (!isWorthACard(landmark)) continue;
      if (distance < nearestDistance) { nearest = landmark; nearestDistance = distance; }
    }
    if (this._landmarkNotice) return;
    if (nearest) {
      this._seenLandmarks.add(nearest.id);
      this._seenLandmarkNames.add(nearest.name);
      this._ensureLandmarkSummary(nearest);
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
    const ctx = this.ctx;
    const alpha = this._landmarkNoticeAlpha;
    if (alpha <= 0) return;

    const img = this._landmarkImages && this._landmarkImages.get(lm.id);
    const hasImage = !!(img && img.complete && img.naturalWidth > 0);
    const cards = window.CanalRecallCards;
    const measure = (text: string, font: string): number => { ctx.font = font; return ctx.measureText(text).width; };
    const card = cards.measureLandmarkCard({
      name: lm.name,
      body: lm.longDetail || lm.detail || cards.placeOnlyDetail(lm.type, this.currentNeighborhood),
      category: lm.type ? lm.type.toUpperCase() : '',
      factKind: lm.factKind,
      extractLang: lm.extractLang,
      hasArticle: !!lm.wikipediaUrl,
      hasImage,
    }, measure, window.CanalRecallUi.landmarkCardWidth(this.viewport));

    // Trivia belongs at the bottom of the screen. Across the top it sat exactly
    // where the player is looking to see what is coming, so a card about a
    // church already passed hid the junction ahead.
    const postcardShowing = !!(this._neighborhoodNotice && this._neighborhoodNoticeTimer > 0);
    const bottomLayout = window.CanalRecallUi.hudLayout({
      viewport: this.viewport,
      tripWidth: 180, postcardVisible: postcardShowing,
      landmarkWidth: card.width, landmarkHeight: card.height,
      feedbackVisible: !!this.quizFeedback,
      neighborhoodVisible: !!this.currentNeighborhood,
      minimapVisible: this.showMiniMap,
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
   * The expanded card. `measureLandmarkCard` cuts the body to two or four
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
      || cards.placeOnlyDetail(lm.type, this.currentNeighborhood);

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
    if (this.quizPromptName) return;
    const ctx = this.ctx;
    const duration = NEIGHBORHOOD_NOTICE_SECONDS;
    const alpha = Math.min(1, this._neighborhoodNoticeTimer * 2.5, (duration - this._neighborhoodNoticeTimer) * 2.5);
    if (alpha <= 0) return;

    const img = this._neighborhoodImages && this._neighborhoodImages.get(hood.name);
    const hasImage = !!(img && img.complete && img.naturalWidth > 0);
    const measure = (text: string, font: string): number => { ctx.font = font; return ctx.measureText(text).width; };
    const card = window.CanalRecallCards.measurePostcard(
      { name: hood.name, kind: hood.kind, imageArea: hood.imageArea, hasImage }, measure,
      window.CanalRecallUi.postcardWidth(this.viewport));

    const bottomLayout = window.CanalRecallUi.hudLayout({
      viewport: this.viewport, tripWidth: 180,
      postcardHeight: card.height,
      neighborhoodVisible: !!this.currentNeighborhood,
      minimapVisible: this.showMiniMap,
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
