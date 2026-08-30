"use strict";
(() => {
  // src/canalRecall/answerPath.ts
  function normaliseAnswer(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  // src/canalRecall/game/landmarkData.ts
  var GENERIC_BRIDGE_NAME_PATTERN = /^\s*(brug\s*)?\d+\s*$/i;
  var NEIGHBORHOOD_KIND_RANKS = {
    city_block: 5,
    neighbourhood: 4,
    neighborhood: 4,
    quarter: 3,
    locality: 2,
    suburb: 1
  };
  function sentences(text) {
    return text.split(/(?<=[.!?])\s/);
  }
  function splitDetail(text) {
    const parts = sentences(text || "");
    return {
      detail: (parts[0] || "").slice(0, 150),
      longDetail: parts.slice(0, 3).join(" ").slice(0, 280)
    };
  }
  function englishTitle(wikipedia) {
    if (!wikipedia) return "";
    const separator = wikipedia.indexOf(":");
    if (separator < 0) return "";
    return wikipedia.slice(0, separator) === "en" ? wikipedia.slice(separator + 1) : "";
  }
  function kmBetween(a, b) {
    const latKm = (a.lat - b.lat) * 111.32;
    const lngKm = (a.lng - b.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180);
    return Math.hypot(latKm, lngKm);
  }
  function pointInPolygon(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (a.y > y !== b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function neighborhoodAt(neighborhoods, x, y) {
    return neighborhoods.find((hood) => hood.rings.some((ring) => pointInPolygon(x, y, ring))) || null;
  }
  function displayGeometry(feature, center) {
    const sourcePaths = feature.paths || (feature.path ? [feature.path] : []);
    const geometryFeatures = sourcePaths.filter((path) => path && path.length > 1).map((path) => {
      const coordinates = path.map(([lat, lng]) => [lng, lat]);
      const first = coordinates[0], last = coordinates[coordinates.length - 1];
      const closed = coordinates.length > 3 && first[0] === last[0] && first[1] === last[1];
      return {
        type: "Feature",
        properties: {},
        geometry: closed ? { type: "Polygon", coordinates: [coordinates] } : { type: "LineString", coordinates }
      };
    });
    if (!geometryFeatures.length) {
      geometryFeatures.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [center[1], center[0]] }
      });
    }
    return geometryFeatures;
  }
  function buildLandmarks(features, project) {
    const landmarks = [];
    for (const feature of features) {
      const center = feature.center || feature.path && feature.path[0];
      if (!center) continue;
      const point = project(center[0], center[1]);
      if (!point) continue;
      const { detail, longDetail } = splitDetail(feature.funFact || feature.wikipediaExtract || "");
      landmarks.push({
        id: feature.id,
        name: feature.name,
        type: feature.type || "",
        imageUrl: feature.wikipediaImageUrl || "",
        x: point.x,
        y: point.y,
        lngLat: [center[1], center[0]],
        detail,
        longDetail,
        prominenceScore: feature.prominenceScore || 0,
        wikipediaUrl: feature.wikipediaUrl || "",
        wikidata: feature.wikidata || "",
        wikipedia: feature.wikipedia || "",
        extractLang: feature.wikipediaExtractLang || "en",
        geojson: { type: "FeatureCollection", features: displayGeometry(feature, center) }
      });
    }
    return landmarks;
  }
  function buildNeighborhoods(boundaries, enrichments, toWorld) {
    const enrichmentByName = new Map(enrichments.map((entry) => [entry.name, entry]));
    const neighborhoods = boundaries.filter((boundary) => boundary.geometry && NEIGHBORHOOD_KIND_RANKS[boundary.kind]).map((boundary) => {
      const enriched = enrichmentByName.get(boundary.name);
      return {
        name: boundary.name,
        kind: boundary.kind,
        rank: NEIGHBORHOOD_KIND_RANKS[boundary.kind],
        rings: (boundary.geometry || []).map((polygon) => (polygon[0] || []).map(toWorld)).filter((ring) => ring.length > 2),
        wikipediaExtract: enriched?.wikipediaExtract || "",
        imageUrl: enriched?.imageUrl || "",
        imageAttribution: enriched?.imageAttribution || ""
      };
    }).filter((hood) => hood.rings.length).sort((a, b) => b.rank - a.rank);
    for (const hood of neighborhoods) {
      if (hood.imageUrl) continue;
      const sample = hood.rings[0] && hood.rings[0][0];
      if (!sample) continue;
      const parent = neighborhoods.find((candidate) => candidate.rank < hood.rank && candidate.imageUrl && candidate.rings.some((ring) => pointInPolygon(sample.x, sample.y, ring)));
      if (parent) {
        hood.imageUrl = parent.imageUrl;
        hood.imageAttribution = parent.imageAttribution;
        hood.imageArea = parent.name;
      }
    }
    return neighborhoods;
  }
  function buildBridges(features, crossingIndex, toWorld) {
    const bridges = [];
    for (const feature of features) {
      const sourcePaths = feature.paths || (feature.path ? [feature.path] : []);
      const lines = sourcePaths.map((path) => (path || []).map(toWorld)).filter((line) => line.length > 1);
      if (!feature.name || lines.length === 0 || GENERIC_BRIDGE_NAME_PATTERN.test(feature.name)) continue;
      if (feature.carriesRailway && !feature.carriesRoad) continue;
      const published = (crossingIndex.bridges || {})[feature.id];
      let source;
      if (published && published.length) {
        source = published;
      } else if (feature.center) {
        source = [{
          index: 0,
          center: feature.center,
          waterway: null,
          waterwayType: null,
          waterDistractors: [],
          spans: lines.length
        }];
      } else {
        continue;
      }
      bridges.push({
        id: feature.id,
        name: feature.name,
        lines,
        crossings: source.map((crossing) => ({ ...crossing, ...toWorld(crossing.center) })),
        distractors: (feature.distractors || []).filter((name) => !GENERIC_BRIDGE_NAME_PATTERN.test(name)),
        wikipediaUrl: feature.wikipediaUrl || "",
        detail: splitDetail(feature.wikipediaExtract).detail
      });
    }
    return bridges;
  }
  function isWorthACard(landmark) {
    return !!(landmark.detail || landmark.longDetail || landmark.imageUrl || landmark.wikipediaUrl);
  }
  function matchLandmarkToBuilding(landmarks, building, buildingName) {
    if (building.id) {
      const byId = landmarks.find((landmark) => landmark.id === building.id);
      if (byId) return byId;
    }
    if (buildingName) {
      const wanted = normaliseAnswer(buildingName);
      const byName = landmarks.find((landmark) => normaliseAnswer(landmark.name) === wanted);
      if (byName) return byName;
    }
    if (!building.lngLat) return null;
    let nearest = null, nearestKm = 0.06;
    for (const landmark of landmarks) {
      if (!landmark.lngLat) continue;
      const km = kmBetween(
        { lat: building.lngLat[1], lng: building.lngLat[0] },
        { lat: landmark.lngLat[1], lng: landmark.lngLat[0] }
      );
      if (km < nearestKm) {
        nearest = landmark;
        nearestKm = km;
      }
    }
    return nearest;
  }

  // src/canalRecall/game/landmarkNotice.ts
  var DEFAULT_NOTICE_CONFIG = {
    exitRadius: 480,
    minSeconds: 6,
    fadeSeconds: 0.8
  };
  function openNotice() {
    return { elapsed: 0, fadeRemaining: null };
  }
  function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }
  function advanceNotice(state, hold, playerPosition, dt, config = DEFAULT_NOTICE_CONFIG) {
    const elapsed = state.elapsed + dt;
    let held;
    switch (hold.kind) {
      case "sticky":
        held = true;
        break;
      case "timed":
        held = elapsed < hold.seconds;
        break;
      case "proximity": {
        if (!playerPosition) {
          held = true;
          break;
        }
        const distance = Math.hypot(hold.anchor.x - playerPosition.x, hold.anchor.y - playerPosition.y);
        held = distance <= config.exitRadius || elapsed < config.minSeconds;
        break;
      }
    }
    const fadeRemaining = held ? null : (state.fadeRemaining === null ? config.fadeSeconds : state.fadeRemaining) - dt;
    const next = { elapsed, fadeRemaining };
    const fadeIn = clamp01(elapsed / config.fadeSeconds);
    const fadeOut = fadeRemaining === null ? 1 : clamp01(fadeRemaining / config.fadeSeconds);
    return {
      state: next,
      alpha: Math.min(fadeIn, fadeOut),
      visible: fadeRemaining === null || fadeRemaining > 0
    };
  }

  // src/canalRecall/game/landmarkRuntime.ts
  var CLICKED_NOTICE_SECONDS = 8;
  var CLICK_SELECT_RADIUS = 120;
  var DRIVE_BY_RADIUS = 300;
  async function readJson(response, fallback) {
    return response.ok ? await response.json() : fallback;
  }
  var GameLandmarkRuntime = class {
    // ---- Clicking a building ----
    _inspectBuildingAt(clientX, clientY) {
      if (!this.player || this.quizPromptName || this._utilityOpen) return;
      const rect = this.canvas.getBoundingClientRect();
      const screen = {
        x: (clientX - rect.left) * CANVAS_W / rect.width,
        y: (clientY - rect.top) * CANVAS_H / rect.height
      };
      const building = this.vectorMap.inspectBuilding(clientX - rect.left, clientY - rect.top, rect);
      let nearest = null;
      let nearestDistance = CLICK_SELECT_RADIUS;
      for (const landmark of this.landmarks) {
        const point = this.camera.worldToScreen(landmark.x, landmark.y);
        const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
        if (distance < nearestDistance) {
          nearest = landmark;
          nearestDistance = distance;
        }
      }
      if (nearest && building && building.featureTarget) {
        nearest = { ...nearest, featureTarget: building.featureTarget };
      }
      if (!nearest) {
        if (!building) return;
        nearest = this._cardForClickedBuilding(building);
      }
      this._ensureLandmarkSummary(nearest);
      this._showLandmarkNotice(nearest, { kind: "timed", seconds: CLICKED_NOTICE_SECONDS });
      this.vectorMap.setActiveLandmark(nearest);
    }
    /** Open a landmark card, saying why it is up — which is what decides when it
     *  comes down. */
    _showLandmarkNotice(notice, hold) {
      this._landmarkNotice = notice;
      this._landmarkNoticeHold = hold;
      this._landmarkNoticeState = openNotice();
      this._landmarkNoticeAlpha = 0;
    }
    _clearLandmarkNotice() {
      this._landmarkNotice = null;
      this._landmarkNoticeState = openNotice();
      this._landmarkNoticeAlpha = 0;
    }
    /**
     * A nameless footprint cannot teach the player anything, but swallowing the
     * click makes the map look broken. Acknowledge it without inventing a name
     * or presenting it as encyclopedia content.
     */
    _cardForClickedBuilding(building) {
      const buildingName = building.name || "";
      const matched = matchLandmarkToBuilding(this.landmarks, building, buildingName);
      if (matched) return { ...matched, featureTarget: building.featureTarget };
      return {
        id: `clicked-${building.id || building.lngLat.join("-")}`,
        name: buildingName || "No building details",
        detail: buildingName ? "Mapped building \u2014 click nearby landmarks to learn more." : "This building has no name in the map data.",
        lngLat: building.lngLat,
        featureTarget: building.featureTarget
      };
    }
    // ---- Encyclopedia text ----
    /**
     * Only 112 of the 300 landmarks ship an extract, so the rest showed a bare
     * name. Wikipedia's REST summary endpoint sends CORS headers, so the missing
     * text is fetched on demand — no proxy, one request per landmark, cached for
     * the session.
     */
    _ensureLandmarkSummary(landmark) {
      if (!landmark || landmark.longDetail || landmark.detail) return;
      if (!landmark.wikidata && !englishTitle(landmark.wikipedia)) return;
      this._summaryRequests = this._summaryRequests || /* @__PURE__ */ new Set();
      if (this._summaryRequests.has(landmark.id)) return;
      this._summaryRequests.add(landmark.id);
      this._fetchEnglishSummary(landmark).catch(() => {
      });
    }
    /**
     * The `wikipedia` tag OSM carries is nearly always the Dutch article
     * ("nl:Blauwbrug"), so fetching the summary it names filled the card with
     * Dutch. The English article is resolved through the feature's Wikidata id
     * instead, and if English has nothing to say about the place the card keeps
     * its name rather than showing a language the player did not ask for.
     */
    async _fetchEnglishSummary(landmark) {
      let title = englishTitle(landmark.wikipedia);
      if (!title && landmark.wikidata) {
        const entity = new URL("https://www.wikidata.org/w/api.php");
        entity.search = new URLSearchParams({
          action: "wbgetentities",
          format: "json",
          props: "sitelinks",
          sitefilter: "enwiki",
          ids: landmark.wikidata,
          origin: "*"
        }).toString();
        const response2 = await fetch(entity, { headers: { accept: "application/json" } });
        if (!response2.ok) return;
        const data2 = await response2.json();
        title = data2?.entities?.[landmark.wikidata]?.sitelinks?.enwiki?.title || "";
      }
      if (!title) return;
      const summary = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
      const response = await fetch(summary, { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const data = await response.json();
      if (!data?.extract) return;
      const split = splitDetail(data.extract);
      landmark.detail = split.detail;
      landmark.longDetail = split.longDetail;
      landmark.extractLang = "en";
    }
    /** The extract carries a Wikipedia URL for 236 of its 300 landmarks, which
     *  the canvas card cannot make clickable — so it is offered on a key. */
    _openLandmarkArticle() {
      const notice = this._landmarkNotice;
      if (!notice || !notice.wikipediaUrl) return;
      window.open(notice.wikipediaUrl, "_blank", "noopener");
    }
    _showStreetKnowledge(name) {
      const key = this._normaliseCanalName(name);
      const entry = this.streetKnowledge.get(key);
      if (!entry) return;
      const split = splitDetail(entry.wikipediaExtract || "");
      this._showLandmarkNotice({
        id: `street-knowledge:${key}`,
        name: entry.name || name,
        type: "street",
        detail: split.detail,
        longDetail: split.longDetail,
        wikipediaUrl: entry.wikipediaUrl || "",
        extractLang: "en"
      }, { kind: "timed", seconds: CLICKED_NOTICE_SECONDS });
    }
    // ---- Loading the extract ----
    async _loadLandmarks(centerLat, centerLng, segments) {
      try {
        const base = window.location.href;
        const url = (name) => new URL(`../data/extracts/amsterdam/${name}`, base);
        const [
          landmarkResponse,
          boundaryResponse,
          neighborhoodEnrichedResponse,
          bridgeResponse,
          crossingResponse,
          streetKnowledgeResponse,
          brandedPoiResponse
        ] = await Promise.all([
          fetch(url("landmarks.json")),
          fetch(url("boundaries.json")),
          fetch(url("neighborhoods-enriched.json")),
          fetch(url("bridges.json")),
          fetch(url("bridge-crossings.json")),
          fetch(url("street-knowledge.json")),
          fetch(url("branded-pois.json"))
        ]);
        if (!landmarkResponse.ok || !boundaryResponse.ok) throw new Error("Cached place data unavailable");
        const [features, boundaries, neighborhoodEnriched, bridgeFeatures, crossingIndex, streetKnowledge, brandedPois] = await Promise.all([
          landmarkResponse.json(),
          boundaryResponse.json(),
          readJson(neighborhoodEnrichedResponse, []),
          readJson(bridgeResponse, []),
          readJson(crossingResponse, { bridges: {} }),
          readJson(streetKnowledgeResponse, []),
          readJson(brandedPoiResponse, [])
        ]);
        this.streetKnowledge = new Map(
          streetKnowledge.map((entry) => [this._normaliseCanalName(entry.name), entry])
        );
        this.vectorMap.setPlaces(features, boundaries);
        this.vectorMap.setBrandedPois(brandedPois);
        this.landmarks = buildLandmarks(features, (lat, lng) => this.osmLoader.latLngToGamePoint(lat, lng, centerLat, centerLng, segments, false));
        this._landmarkImages = /* @__PURE__ */ new Map();
        this._landmarkImageRequests = /* @__PURE__ */ new Set();
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
        const toWorld = ([lat, lng]) => ({
          x: (lng - centerLng) * metersPerDegreeLng * PIXELS_PER_METER + this.osmLoader._lastOffsetX,
          y: -(lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER + this.osmLoader._lastOffsetY
        });
        this.neighborhoods = buildNeighborhoods(boundaries, neighborhoodEnriched, toWorld);
        this.bridges = buildBridges(bridgeFeatures, crossingIndex, toWorld);
        this._neighborhoodImages = /* @__PURE__ */ new Map();
        this._neighborhoodLetterArt = /* @__PURE__ */ new Map();
        this._neighborhoodImageRequests = /* @__PURE__ */ new Set();
      } catch (error) {
        console.warn("Landmark notes unavailable:", error);
        this.landmarks = [];
      }
    }
    // ---- Per-frame ----
    _updateLandmarks(dt) {
      if (this._neighborhoodNoticeTimer > 0) this._neighborhoodNoticeTimer -= dt;
      if (this._landmarkNotice) {
        const visibility = advanceNotice(
          this._landmarkNoticeState,
          this._landmarkNoticeHold,
          this.player,
          dt
        );
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
        candidateSeconds: this._neighborhoodCandidateTimer
      }, detectedHood ? detectedHood.name : "", dt);
      this.currentNeighborhood = transition.state.current;
      this._neighborhoodCandidate = transition.state.candidate;
      this._neighborhoodCandidateTimer = transition.state.candidateSeconds;
      const hood = this.neighborhoods.find((area) => area.name === this.currentNeighborhood) || detectedHood;
      if (this.currentNeighborhood) this._visitedNeighborhoods.add(this.currentNeighborhood);
      if (this.currentNeighborhood && this.currentNeighborhood !== this._previousNeighborhood) {
        this._previousNeighborhood = this.currentNeighborhood;
        if (!this.quizPromptName && this.raceTime > NEIGHBORHOOD_NOTICE_GRACE) {
          if (hood) this._ensureNeighborhoodImage(hood);
          this._neighborhoodNotice = hood || { name: this.currentNeighborhood };
          this._neighborhoodNoticeTimer = NEIGHBORHOOD_NOTICE_SECONDS;
        }
      }
      let nearest = null;
      let nearestDistance = DRIVE_BY_RADIUS;
      for (const landmark of this.landmarks) {
        const distance = Math.hypot(landmark.x - this.player.x, landmark.y - this.player.y);
        if (distance < LANDMARK_IMAGE_PREFETCH_RADIUS) this._ensureLandmarkImage(landmark);
        if (this._seenLandmarks.has(landmark.id)) continue;
        if (!isWorthACard(landmark)) continue;
        if (distance < nearestDistance) {
          nearest = landmark;
          nearestDistance = distance;
        }
      }
      if (this._landmarkNotice) return;
      if (nearest) {
        this._seenLandmarks.add(nearest.id);
        this._seenLandmarkNames.add(nearest.name);
        this._ensureLandmarkSummary(nearest);
        this._showLandmarkNotice(nearest, { kind: "proximity", anchor: { x: nearest.x, y: nearest.y } });
        this.vectorMap.setActiveLandmark(nearest);
      }
    }
    _neighborhoodAt(x, y) {
      return neighborhoodAt(this.neighborhoods, x, y);
    }
    // ---- Images ----
    /**
     * Fetch a landmark photo once, on demand. Every landmark the extract has a
     * Wikipedia image for can show one; the card falls back to text until it
     * arrives, and a failure is remembered so it is not retried every frame.
     */
    _ensureLandmarkImage(landmark) {
      if (!landmark || !landmark.imageUrl) return;
      if (!this._landmarkImageRequests) this._landmarkImageRequests = /* @__PURE__ */ new Set();
      if (this._landmarkImageRequests.has(landmark.id)) return;
      this._landmarkImageRequests.add(landmark.id);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => this._landmarkImages.set(landmark.id, img);
      img.onerror = () => console.warn("Landmark image unavailable:", landmark.name, landmark.imageUrl);
      img.src = landmark.imageUrl;
    }
    /** The postcard renderer falls back to its typographic composition until the
     *  image lands, so this can stay lazy. */
    _ensureNeighborhoodImage(hood) {
      if (!hood || !hood.imageUrl) return;
      if (!this._neighborhoodImageRequests) this._neighborhoodImageRequests = /* @__PURE__ */ new Set();
      if (this._neighborhoodImageRequests.has(hood.name)) return;
      this._neighborhoodImageRequests.add(hood.name);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => this._neighborhoodImages.set(hood.name, img);
      img.onerror = () => console.warn("Neighborhood image unavailable:", hood.name, hood.imageUrl);
      img.src = hood.imageUrl;
    }
    // ---- Cards ----
    _renderLandmarkNotice() {
      const lm = this._landmarkNotice;
      if (!lm) return;
      const ctx = this.ctx;
      const alpha = this._landmarkNoticeAlpha;
      if (alpha <= 0) return;
      const img = this._landmarkImages && this._landmarkImages.get(lm.id);
      const hasImage = !!(img && img.complete && img.naturalWidth > 0);
      const cards = window.CanalRecallCards;
      const measure = (text, font) => {
        ctx.font = font;
        return ctx.measureText(text).width;
      };
      const card = cards.measureLandmarkCard({
        name: lm.name,
        body: lm.longDetail || lm.detail || cards.placeOnlyDetail(lm.type, this.currentNeighborhood),
        category: lm.type ? lm.type.toUpperCase() : "",
        extractLang: lm.extractLang,
        hasArticle: !!lm.wikipediaUrl,
        hasImage
      }, measure);
      const postcardShowing = !!(this._neighborhoodNotice && this._neighborhoodNoticeTimer > 0);
      const bottomLayout = window.CanalRecallBottomHud?.bottomHudLayout({
        tripWidth: 180,
        postcardVisible: postcardShowing,
        landmarkWidth: card.width,
        landmarkHeight: card.height,
        zoomVisible: this._zoomBadgeTimer > 0,
        controlsVisible: !this.input.isMobile && this.raceTime < CONTROLS_HINT_DURATION
      });
      const cardX = bottomLayout ? bottomLayout.landmark.x : CANVAS_W / 2 - card.width / 2;
      const cardY = bottomLayout ? bottomLayout.landmark.y : CANVAS_H - card.height - 30;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      this.renderer.drawLandmarkCard(ctx, card, cardX, cardY, hasImage && img ? img : null);
      ctx.restore();
    }
    _renderNeighborhoodNotice() {
      const hood = this._neighborhoodNotice;
      if (!hood || this._neighborhoodNoticeTimer <= 0) return;
      if (this.quizPromptName) return;
      const ctx = this.ctx;
      const duration = NEIGHBORHOOD_NOTICE_SECONDS;
      const alpha = Math.min(1, this._neighborhoodNoticeTimer * 2.5, (duration - this._neighborhoodNoticeTimer) * 2.5);
      if (alpha <= 0) return;
      const img = this._neighborhoodImages && this._neighborhoodImages.get(hood.name);
      const hasImage = !!(img && img.complete && img.naturalWidth > 0);
      const measure = (text, font) => {
        ctx.font = font;
        return ctx.measureText(text).width;
      };
      const card = window.CanalRecallCards.measurePostcard(
        { name: hood.name, kind: hood.kind, imageArea: hood.imageArea, hasImage },
        measure
      );
      const bottomLayout = window.CanalRecallBottomHud?.bottomHudLayout({ tripWidth: 180 });
      const cardX = bottomLayout ? bottomLayout.postcard.x : CANVAS_W - card.width - 20;
      const baseCardY = bottomLayout ? bottomLayout.postcard.y : CANVAS_H - card.height - 76;
      const slideT = Math.min(1, (duration - this._neighborhoodNoticeTimer) / 0.3);
      const cardY = baseCardY + (1 - (1 - Math.pow(1 - slideT, 3))) * 50;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      this.renderer.drawPostcard(ctx, card, cardX, cardY, hasImage && img ? img : null);
      ctx.restore();
    }
  };
  window.CanalRecallGameModules = window.CanalRecallGameModules || [];
  window.CanalRecallGameModules.push(GameLandmarkRuntime);
})();
