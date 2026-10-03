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
import { buildRouteKnowledgeIndex, routeKnowledgeFor, shouldOfferStreetKnowledge, streetCardText, type StreetNameOrigin } from './routeKnowledge';
import { canShowDriveByCard, canShowMiniMap, canShowTeachingCard } from './teachingSurface';
import { isTransit } from './modes';
import { BuildingFactStore, describeBuilding } from '../buildingFacts';
import type { BridgeRegisterFile } from '../bridgeRegister';
import { loadEntryCounts, postcardForLull, postcardOnEntry, recordEntry } from './postcardPacing';
import { DRIVE_BY_RADIUS, driveByGapElapsed, mayReplaceNotice, pathAhead, pickDriveBy, type NoticeSource, type Rider } from './driveByTrigger';
import {
  buildCorridorStreetIndex,
  distanceToPath,
  type CorridorStreetFeature,
} from '../transit/corridorStreets';

/** Seconds a clicked card stays up. A drive-by card is held by proximity
 *  instead — see `landmarkNotice.ts`. */
/** px — how far a click may be from a landmark's marker and still select it. */
const CLICK_SELECT_RADIUS = 120;
/** px — a click this close to a landmark's marker means the landmark, even
 *  over another building. */
const CLICK_MARKER_RADIUS = 40;

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

/** Files the ride start waits for, in the order `_loadLandmarks` reads them. */
export const START_EXTRACTS = [
  'landmarks.json', 'boundaries.json', 'neighborhoods-enriched.json',
  'bridges.json', 'bridge-crossings.json', 'streets.json', 'water.json',
] as const;

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
    // A building that is a landmark's own, by the extract-time join, is that
    // landmark. Otherwise a landmark nearby wins only when its marker itself
    // was clicked: within 120 px it used to take any click, and lit the
    // ordinary house next door as the museum.
    const owner = building && building.id != null
      ? this.landmarks.find(landmark => landmark.buildingIds?.includes(String(building.id)))
      : undefined;
    if (owner) nearest = owner;
    else if (nearest && building && nearestDistance > CLICK_MARKER_RADIUS) nearest = null;
    if (nearest && !owner && building && building.featureTarget) {
      // Keep the curated card identity, but highlight the actual extrusion
      // under the click rather than rebuilding its approximate OSM footprint.
      nearest = { ...nearest, featureTarget: building.featureTarget };
    }
    if (!nearest) {
      if (!building) return;
      nearest = this._cardForClickedBuilding(building);
    }
    this._showLandmarkNotice(nearest, { kind: 'sticky' }, 'click');
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
  _showLandmarkNotice(notice: LandmarkNotice, hold: NoticeHold, source: NoticeSource = 'click'): void {
    if (this._landmarkNotice) this.vectorMap?.setActiveLandmark(null);
    this._landmarkNotice = this._withRotatedFact(notice);
    this._landmarkNoticeHold = hold;
    this._landmarkNoticeSource = source;
    this._landmarkNoticeState = openNotice();
    if (source !== 'arrival') this._lastTriviaAt = this.raceTime;
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
    // The yellow building belongs to the card: closing the card any way at
    // all (a question opening, a new route) takes the highlight down with it.
    // Only the fade-out path cleared it, so a building stayed yellow with no
    // card on screen (user report 2026-09-29).
    if (this._landmarkNotice) this.vectorMap?.setActiveLandmark(null);
    this._landmarkNotice = null;
    this._landmarkNoticeState = openNotice();
    this._landmarkNoticeAlpha = 0;
    this._landmarkCardBounds = null;
    this._landmarkCloseBounds = null;
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
    // Not a landmark: say what the register knows (year, type, listing, size)
    // rather than "no building details".
    // A monument's own name can carry a quiz answer ("Pakhuis Prinsengracht");
    // screen it like every other label before it becomes a title.
    let row = this._buildingFacts?.lookup(building.id) ?? null;
    const spoils = (this.vectorMap as { _spoils?: (name: string) => boolean })._spoils;
    const monument = row && row.length > 3 ? row[3] : undefined;
    if (row && monument?.n && spoils?.call(this.vectorMap, monument.n)) {
      const { n: _hidden, ...rest } = monument;
      row = [row[0], row[1], row[2], rest];
    }
    const facts = describeBuilding(row, building.height, buildingName);
    return {
      id: `clicked-${building.id || building.lngLat.join('-')}`,
      name: facts.name,
      type: 'building',
      detail: facts.detail,
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
  _showStreetKnowledge(name: string, type: 'street' | 'water' | 'bridge' | 'line' = 'street', replaceOpenCard = false): void {
    // Transit lines/stops are not in the street/water encyclopedia extract yet.
    if (type === 'line') return;
    const key = this._normaliseCanalName(name);
    const entry = routeKnowledgeFor(this.streetKnowledge, name, type,
      (value) => this._normaliseCanalName(value));
    if (!entry) return;
    const noticeId = entry.id || `${type}-knowledge:${key}`;
    this._seenStreetKnowledge = this._seenStreetKnowledge || new Set();
    if (!shouldOfferStreetKnowledge({
      hasExtract: !!(entry.wikipediaUrl || entry.wikipediaExtract || entry.nameOrigin || entry.structureFact),
      alreadyShownThisDrive: this._seenStreetKnowledge.has(noticeId),
      quizOpen: !!this.quizPromptName,
      landmarkCardOpen: !!this._landmarkNotice,
      replaceOpenCard,
    })) return;
    this._seenStreetKnowledge.add(noticeId);
    const split = streetCardText(entry);
    this._showLandmarkNotice({
      id: noticeId,
      name: entry.name || name,
      type: type === 'bridge' ? 'bridge' : 'street',
      detail: split.detail,
      longDetail: split.longDetail,
      imageUrl: entry.wikipediaImageUrl || '',
      wikipediaUrl: entry.wikipediaUrl || '',
      extractLang: entry.wikipediaExtractLang || 'en',
    }, { kind: 'sticky' }, 'street');
  }

  // ---- Loading the extract ----

  /**
   * Warm the HTTP cache with the files the ride start waits for, while the
   * player is still on the setup screen. They are the same for every ride in
   * a city and served with max-age=3600, so the start then reads them from
   * cache: "Building street network…" spent 2.7 s on a 4 Mbps link fetching
   * them (2026-10-01). Low priority, once per city, failures ignored.
   */
  _prefetchCityExtracts(this: LandmarkHost): void {
    const Prefs = window.CanalRecallPreferences;
    const cityId = this.cityId || (Prefs && Prefs.DEFAULT_CITY_ID) || 'amsterdam';
    if (this._prefetchedCityId === cityId || typeof fetch !== 'function') return;
    this._prefetchedCityId = cityId;
    const city = Prefs && Prefs.cityById ? Prefs.cityById(cityId) : { extractPath: '../data/extracts/amsterdam' };
    for (const name of START_EXTRACTS) {
      fetch(new URL(`${city.extractPath}/${name}`, window.location.href), { priority: 'low' } as RequestInit).catch(() => {});
    }
  }

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
      const factBase = new URL(`${city.extractPath}/`, base).href;
      if (this._buildingFacts) this._buildingFacts.setBase(factBase);
      else this._buildingFacts = new BuildingFactStore(factBase);
      // Only what the start needs is awaited (START_EXTRACTS): the places,
      // areas and bridges the first seconds use, and every street and water
      // name, which must reach the spoiler list before any label is drawn.
      const [
        landmarkResponse, boundaryResponse, neighborhoodEnrichedResponse,
        bridgeResponse, crossingResponse, streetResponse, waterResponse,
      ] = await Promise.all(START_EXTRACTS.map((name) => fetch(url(name))));
      if (!landmarkResponse.ok || !boundaryResponse.ok) throw new Error('Cached place data unavailable');

      const [features, boundaries, neighborhoodEnriched, bridgeFeatures, crossingIndex,
        streetFeatures, waterFeatures] =
        await Promise.all([
          landmarkResponse.json() as Promise<LandmarkFeature[]>,
          boundaryResponse.json() as Promise<BoundaryFeature[]>,
          readJson<NeighborhoodEnrichment[]>(neighborhoodEnrichedResponse, []),
          readJson<BridgeFeature[]>(bridgeResponse, []),
          readJson<BridgeCrossingIndex>(crossingResponse, { bridges: {} }),
          readJson<StreetKnowledgeEntry[]>(streetResponse, []),
          readJson<StreetKnowledgeEntry[]>(waterResponse, []),
        ]);
      const streetKnowledge: StreetKnowledgeEntry[] = [];

      this._facts = buildFactIndex(null);
      this._factRotation = loadRotationState(
        typeof localStorage === 'undefined' ? null : localStorage);

      const normalise = (name: string) => this._normaliseCanalName(name);
      const knowledge = buildRouteKnowledgeIndex(streetKnowledge, streetFeatures, waterFeatures, normalise);
      this.streetKnowledge = knowledge;
      // Why each street is called what it is (municipal register, English).
      // 1.2 MB (364 KB gzipped) for 5,333 names, and no card needs it before
      // the first correct answer, so it no longer holds up the ride's start:
      // it merges in when it arrives, unless another load has replaced this one.
      // The bridge register (number, type, material, year) rides along.
      const deferredJson = <T>(name: string) => fetch(url(name))
        .then(response => readJson<T | null>(response, null))
        .catch(() => null);
      // Likewise the reviewed trivia (2 MB of facts), the encyclopedia
      // ledes, brand dots and landmark-building links: no card or label needs
      // them in the first seconds, so they merge in when they arrive. Cards
      // fall back to the Wikipedia lede until the facts are in.
      void Promise.all([
        deferredJson<{ origins?: StreetNameOrigin[] }>('street-name-origins.json'),
        deferredJson<BridgeRegisterFile>('bridge-register.json'),
        deferredJson<StreetKnowledgeEntry[]>('street-knowledge.json'),
        deferredJson<FactsFile>('facts.json'),
        deferredJson<unknown[]>('branded-pois.json'),
        deferredJson<{ buildings?: Record<string, string[]> }>('landmark-buildings.json'),
      ]).then(([originsFile, bridgeRegister, encyclopedia, factsFile, brandedPois, landmarkBuildings]) => {
        // Another load replaced this one: its own merge will run.
        if (this.streetKnowledge !== knowledge) return;
        if (factsFile) this._facts = buildFactIndex(factsFile);
        if (originsFile?.origins?.length || bridgeRegister?.bridges || encyclopedia?.length) {
          this.streetKnowledge = buildRouteKnowledgeIndex(
            encyclopedia ?? [], streetFeatures, waterFeatures, normalise, originsFile?.origins ?? [], bridgeRegister?.bridges ?? {});
        }
        if (brandedPois) this.vectorMap.setBrandedPois(brandedPois);
        // With the resolved file, a landmark it does not list has no building
        // (a tree, a statue) and keeps its dot; without it, the map guesses.
        // The highlight reads buildingIds when it draws, so late is fine.
        if (landmarkBuildings?.buildings && this.landmarks === landmarks) {
          for (const landmark of landmarks) landmark.buildingIds = landmarkBuildings.buildings[landmark.id] ?? [];
        }
      });
      // Everything the game can ask about, so no orientation label says it
      // first. Stops join in transit mode, where a stop name is the answer.
      const transitStops = (this.osmLoader as { transitLoad?: { stops?: Array<{ name?: string }> } })
        ?.transitLoad?.stops || [];
      this.vectorMap.setSpoilerNames([
        ...streetFeatures, ...waterFeatures, ...bridgeFeatures, ...transitStops,
      ].map(item => (item as { name?: string }).name || '').filter(Boolean));
      this.vectorMap.setPlaces(features, boundaries);

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
      const landmarks = this.landmarks;

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
    // Keep the clicked-building facts for the tiles around the rider loaded.
    if (this._buildingFacts && this.player && this._toLatLon) {
      const at = this._toLatLon(this.player.x, this.player.y);
      if (at) this._buildingFacts.prefetchAround(at[1], at[0]);
    }
    if (this._neighborhoodNoticeTimer > 0) this._neighborhoodNoticeTimer -= dt;
    if (this._landmarkNotice) {
      const visibility = advanceNotice(
        this._landmarkNoticeState, this._landmarkNoticeHold, this.player, dt);
      this._landmarkNoticeState = visibility.state;
      this._landmarkNoticeAlpha = visibility.alpha;
      if (!visibility.visible) {
        this._clearLandmarkNotice();
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
    //
    // Whether the entry is worth a postcard is `postcardPacing`'s call: always
    // for the first few entries, otherwise only after a stretch without
    // trivia. A worthwhile postcard waits for the band to be free rather than
    // being lost to a quiz that happened to be open at the boundary.
    if (this.currentNeighborhood && this.currentNeighborhood !== this._previousNeighborhood) {
      this._previousNeighborhood = this.currentNeighborhood;
      this._neighborhoodEnteredAt = this.raceTime;
      const cityId = this.cityId || 'amsterdam';
      if (this._neighborhoodEntries?.cityId !== cityId) {
        this._neighborhoodEntries = { cityId, counts: loadEntryCounts(typeof localStorage === 'undefined' ? null : localStorage, cityId) };
      }
      const priorEntries = recordEntry(typeof localStorage === 'undefined' ? null : localStorage,
        cityId, this._neighborhoodEntries.counts, this.currentNeighborhood);
      this._postcardPending = postcardOnEntry({
        now: this.raceTime, priorEntries, lastTriviaAt: this._lastTriviaAt ?? null, lastPostcardAt: this._lastPostcardAt ?? null,
      }) ? this.currentNeighborhood : null;
    } else if (this.currentNeighborhood && !this._postcardPending && postcardForLull({
      now: this.raceTime, enteredAt: this._neighborhoodEnteredAt ?? 0,
      lastTriviaAt: this._lastTriviaAt ?? null, lastPostcardAt: this._lastPostcardAt ?? null,
    })) {
      this._postcardPending = this.currentNeighborhood;
    }
    if (this._postcardPending && this._postcardPending === this.currentNeighborhood
      && canShowDriveByCard(this.viewport?.mode, this._teachingGate()) && this.raceTime > NEIGHBORHOOD_NOTICE_GRACE) {
      this._postcardPending = null;
      this._lastPostcardAt = this.raceTime;
      if (hood) this._ensureNeighborhoodImage(hood);
      this._neighborhoodNotice = hood || { name: this.currentNeighborhood };
      this._neighborhoodNoticeTimer = NEIGHBORHOOD_NOTICE_SECONDS;
    }

    const routePath = this.routePath;
    const landmarkRouteRadiusPx = isTransit(this.travelMode)
      ? (window.CanalRecallTransit?.TRANSIT_LANDMARK_ROUTE_RADIUS_M ?? 120) * PIXELS_PER_METER
      : Infinity;
    const candidates: Landmark[] = [];
    const player = this.player as Rider;
    const ahead = pathAhead(player, routePath);
    const reach = ahead.reduce((sum, point, i) => i ? sum + Math.hypot(point.x - ahead[i - 1].x, point.y - ahead[i - 1].y) : 0, 0)
      + DRIVE_BY_RADIUS;
    for (const landmark of this.landmarks) {
      const distance = Math.hypot(landmark.x - this.player.x, landmark.y - this.player.y);
      if (distance < LANDMARK_IMAGE_PREFETCH_RADIUS) this._ensureLandmarkImage(landmark);
      if (this._seenLandmarks.has(landmark.id)) continue;
      // A card with nothing but a name interrupts the driving corridor to teach
      // nothing. Clicking such a building still answers; driving past it does not.
      if (!isWorthACard(landmark)) continue;
      if (distance > reach) continue;
      if (isTransit(this.travelMode) && routePath && routePath.length >= 2) {
        if (distanceToPath(routePath, landmark.x, landmark.y) > landmarkRouteRadiusPx) continue;
      }
      candidates.push(landmark);
    }
    if (!canShowDriveByCard(this.viewport?.mode, this._teachingGate())) return;
    if (!driveByGapElapsed(this._lastDriveByAt, this.raceTime)) return;
    if (this._landmarkNotice && !mayReplaceNotice(
      this._landmarkNoticeSource ?? null, this._landmarkNoticeHold, this._landmarkNoticeState.elapsed)) return;
    // Look ahead along where the rider is going, so the card is up before
    // they reach the landmark rather than as they pass it.
    const nearest = pickDriveBy(candidates, ahead);
    if (nearest && nearest.id !== this._landmarkNotice?.id) {
      this._seenLandmarks.add(nearest.id);
      this._seenLandmarkNames.add(nearest.name);
      // Held until the player closes it or another card takes the slot: it
      // used to fade once the rider was 480 px past, often mid-sentence (user
      // request 2026-10-03, "leave the trivia cards onscreen longer").
      this._showLandmarkNotice(nearest, { kind: 'sticky' }, 'drive-by');
      this._lastDriveByAt = this.raceTime;
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
  _ensureLandmarkImage(landmark: Landmark | LandmarkNotice | null): void {
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
    this._landmarkCloseBounds = null;
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
    this._landmarkCloseBounds = { x: cardX + card.closeHit.x, y: cardY + card.closeHit.y, w: card.closeHit.width, h: card.closeHit.height };
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
