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
  function isLocatorMapImage(url) {
    if (!url) return false;
    return /Map[_-]NL[_-]|Map_-_NL[_-]|\/Map_NL_|locator.?map|_kaart\./i.test(url);
  }
  function buildNeighborhoods(boundaries, enrichments, toWorld) {
    const enrichmentByName = new Map(enrichments.map((entry) => [entry.name, entry]));
    const neighborhoods = boundaries.filter((boundary) => boundary.geometry && NEIGHBORHOOD_KIND_RANKS[boundary.kind]).map((boundary) => {
      const enriched = enrichmentByName.get(boundary.name);
      const rawUrl = enriched?.imageUrl || "";
      return {
        name: boundary.name,
        kind: boundary.kind,
        rank: NEIGHBORHOOD_KIND_RANKS[boundary.kind],
        rings: (boundary.geometry || []).map((polygon) => (polygon[0] || []).map(toWorld)).filter((ring) => ring.length > 2),
        wikipediaExtract: enriched?.wikipediaExtract || "",
        imageUrl: isLocatorMapImage(rawUrl) ? "" : rawUrl,
        imageAttribution: isLocatorMapImage(rawUrl) ? "" : enriched?.imageAttribution || ""
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

  // src/canalRecall/facts/factRotation.ts
  function emptyRotationState() {
    return { history: {}, shown: 0, recentKinds: [] };
  }
  var RECENT_KIND_MEMORY = 3;
  function factKey(featureId, fact) {
    const normalised = fact.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    let hash = 2166136261;
    for (let index = 0; index < normalised.length; index++) {
      hash ^= normalised.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${featureId}:${(hash >>> 0).toString(36)}`;
  }
  var KIND_APPEAL = {
    surprise: 5,
    naming: 4,
    culture: 3,
    people: 3,
    history: 2,
    design: 1
  };
  function chooseFact(featureId, facts, state) {
    if (!facts.length) return null;
    const scored = facts.map((fact) => {
      const key = factKey(featureId, fact);
      const lastShown = state.history[key];
      const seen = lastShown !== void 0;
      const recency = state.recentKinds.indexOf(fact.kind);
      const kindPenalty = recency < 0 ? 0 : (RECENT_KIND_MEMORY - recency) * 2;
      return {
        fact,
        key,
        seen,
        lastShown: lastShown ?? -1,
        score: (seen ? 0 : 100) + KIND_APPEAL[fact.kind] - kindPenalty
      };
    });
    scored.sort((a, b) => (
      // Unseen first; then among seen, the one shown longest ago; then appeal.
      Number(b.score > 0 && !b.seen) - Number(a.score > 0 && !a.seen) || (a.seen && b.seen ? a.lastShown - b.lastShown : 0) || b.score - a.score
    ));
    const best = scored[0];
    return { fact: best.fact, key: best.key, repeat: best.seen };
  }
  function recordShown(state, choice) {
    const shown = state.shown + 1;
    return {
      history: { ...state.history, [choice.key]: shown },
      shown,
      recentKinds: [choice.fact.kind, ...state.recentKinds].slice(0, RECENT_KIND_MEMORY)
    };
  }
  function expandedFacts(facts, shownText, limit = 3) {
    return facts.filter((fact) => fact.text !== shownText).slice().sort((a, b) => KIND_APPEAL[b.kind] - KIND_APPEAL[a.kind]).slice(0, limit);
  }
  function pruneHistory(state, maxEntries = 4e3) {
    const entries = Object.entries(state.history);
    if (entries.length <= maxEntries) return state;
    const kept = entries.sort((a, b) => b[1] - a[1]).slice(0, maxEntries);
    return { ...state, history: Object.fromEntries(kept) };
  }

  // src/canalRecall/facts/factQuality.ts
  var CATEGORY_WORDS = "bridge|street|canal|park|square|church|museum|building|monument|neighbourhood|neighborhood|district|area|tower|gate|house|hotel|theatre|theater|station|market|island|quay|harbour|harbor|cemetery|garden|school|university|synagogue|mosque|windmill|lock|sluice|library|hall|palace|mill|club|stadium|arena|prison|hospital|brewery|factory|chapel|gallery|zoo|dock|street|lane|road|avenue|tunnel|fountain|statue";
  var LEDE_RESTATEMENT = new RegExp(
    `^\\s*(the\\s+)?[^.]{2,60}?\\s+(is|was)\\s+(a|an|the)\\s+(\\w+[- ]){0,3}(${CATEGORY_WORDS})\\b[^.]{0,40}\\b(in|of|on|near|at|situated at|located at)\\s+(the\\s+)?[A-Z0-9][^.]{0,40}\\.?\\s*$`,
    "i"
  );
  var FILLER_CLAUSE = new RegExp(
    "\\s*,\\s+(?:(?:marking|showcasing|highlighting|demonstrating|reflecting|contributing|offering|underscoring|emphasi[sz]ing|solidifying|cementing|symboli[sz]ing|illustrating|making it|cementing its)\\b[^,]*|(?:a|an|the)\\s+(?:\\w+\\s+){0,2}(?:striking|significant|notable|remarkable|hidden|unique|key|major|important|impressive|beloved|popular)\\s+(?:\\w+\\s+){0,2}(?:feature|milestone|achievement|aspect|element|landmark|detail|addition|space|example|part|symbol|sight)[^,]*)\\s*\\.?\\s*$",
    "i"
  );
  function words(text) {
    return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  }
  function similarity(a, b) {
    const left = new Set(words(a));
    const right = new Set(words(b));
    if (!left.size || !right.size) return 0;
    let shared = 0;
    for (const word of left) if (right.has(word)) shared++;
    return shared / Math.min(left.size, right.size);
  }

  // src/canalRecall/facts/factTypes.ts
  var FACT_KIND_LABELS = {
    naming: "Name",
    history: "History",
    people: "People",
    design: "Design",
    culture: "Culture",
    surprise: "Curiosity"
  };

  // src/canalRecall/facts/factStore.ts
  function buildFactIndex(file) {
    const index = /* @__PURE__ */ new Map();
    for (const feature of file?.features || []) {
      if (feature?.id && feature.facts?.length) {
        index.set(feature.id, {
          facts: feature.facts,
          opening: feature.opening?.trim() || void 0
        });
      }
    }
    return index;
  }
  function openingSentence(text, maxChars = 160) {
    const trimmed = (text || "").replace(/\s+/g, " ").trim();
    if (!trimmed) return "";
    const abbreviations = /* @__PURE__ */ new Set([
      "st",
      "sint",
      "ste",
      "mr",
      "mrs",
      "ms",
      "dr",
      "prof",
      "ir",
      "ing",
      "drs",
      "jr",
      "sr",
      "nr",
      "no",
      "vs",
      "ca",
      "ong",
      "bijv",
      "nl",
      "oa",
      "dwz",
      "zgn",
      "etc",
      "incl",
      "excl",
      "eeuw",
      "eeuwse"
    ]);
    const isSentenceEnd = (index) => {
      if (trimmed[index] !== ".") return true;
      const before = /([\p{L}]+)$/u.exec(trimmed.slice(0, index));
      if (!before) return true;
      const word = before[1];
      if (word.length === 1) return false;
      return !abbreviations.has(word.toLocaleLowerCase());
    };
    let end = -1;
    for (const match of trimmed.matchAll(/[.!?](?=\s|$)/g)) {
      if (isSentenceEnd(match.index)) {
        end = match.index + 1;
        break;
      }
    }
    const sentence = (end > 0 ? trimmed.slice(0, end) : trimmed).trim();
    if (sentence.length <= maxChars) return sentence;
    const window2 = sentence.slice(0, maxChars);
    let boundary = -1;
    for (const match of window2.matchAll(/[.!?](?=\s|$)/g)) {
      if (isSentenceEnd(match.index)) boundary = match.index + 1;
    }
    if (boundary > maxChars * 0.5) return window2.slice(0, boundary).trim();
    const cut = Math.max(window2.lastIndexOf(", "), window2.lastIndexOf(" "));
    return `${(cut > maxChars * 0.5 ? window2.slice(0, cut) : window2).trim()}\u2026`;
  }
  function composeFactWithOpening(factText, opening) {
    const lead = openingSentence(opening);
    if (!lead) return { detail: factText };
    if (similarity(lead, factText) >= 0.55) return { detail: factText };
    const leadStem = lead.replace(/[.!?…]+$/, "").toLowerCase();
    if (leadStem.length >= 24 && factText.toLowerCase().includes(leadStem.slice(0, Math.min(48, leadStem.length)))) {
      return { detail: factText };
    }
    return { detail: `${lead} ${factText}`, opening: lead };
  }
  var ROTATION_STORAGE_KEY = "canalRecall.factRotation.v1";
  function loadRotationState(storage) {
    try {
      const raw = storage?.getItem(ROTATION_STORAGE_KEY);
      if (!raw) return emptyRotationState();
      const parsed = JSON.parse(raw);
      return {
        history: parsed.history && typeof parsed.history === "object" ? parsed.history : {},
        shown: Number.isFinite(parsed.shown) ? Number(parsed.shown) : 0,
        recentKinds: Array.isArray(parsed.recentKinds) ? parsed.recentKinds.slice(0, 3) : []
      };
    } catch {
      return emptyRotationState();
    }
  }
  function saveRotationState(storage, state) {
    try {
      storage?.setItem(ROTATION_STORAGE_KEY, JSON.stringify(pruneHistory(state)));
    } catch {
    }
  }
  function factCardText(featureId, index, state, fallbackOpening) {
    const entry = index.get(featureId);
    if (!entry?.facts?.length) return null;
    const choice = chooseFact(featureId, entry.facts, state);
    if (!choice) return null;
    const composed = composeFactWithOpening(
      choice.fact.text,
      entry.opening || fallbackOpening
    );
    const others = expandedFacts(entry.facts, choice.fact.text);
    const all = composed.opening ? [composed.opening, choice.fact.text, ...others.map((fact) => fact.text)] : [choice.fact.text, ...others.map((fact) => fact.text)];
    return {
      choice,
      text: {
        detail: composed.detail,
        longDetail: all.join(" "),
        factTexts: all,
        factKind: FACT_KIND_LABELS[choice.fact.kind]
      }
    };
  }
  function commitShownFact(storage, state, choice) {
    const next = recordShown(state, choice);
    saveRotationState(storage, next);
    return next;
  }

  // src/canalRecall/game/routeKnowledge.ts
  var eligible = (entry) => entry.wikipediaUrl || entry.wikipediaExtract;
  function buildRouteKnowledgeIndex(legacy, streets, waters, normalise) {
    const index = /* @__PURE__ */ new Map();
    const add = (entry, type) => {
      index.set(`${type}:${normalise(entry.name)}`, { ...entry, type });
    };
    for (const entry of legacy) add(entry, entry.type === "water" ? "water" : "street");
    for (const entry of streets) if (eligible(entry)) add(entry, "street");
    for (const entry of waters) if (eligible(entry)) add(entry, "water");
    return index;
  }
  function routeKnowledgeFor(index, name, type, normalise) {
    const key = normalise(name);
    return index.get(`${type}:${key}`) || index.get(`${type === "street" ? "water" : "street"}:${key}`);
  }
  function shouldOfferStreetKnowledge(input) {
    if (!input.hasExtract || input.alreadyShownThisDrive) return false;
    if (input.quizOpen) return false;
    if (input.landmarkCardOpen && !input.replaceOpenCard) return false;
    return true;
  }

  // src/canalRecall/game/teachingSurface.ts
  function teachingOwnsBottom(input) {
    return input.quizOpen || input.feedbackVisible || input.promptVisible || input.utilityOpen;
  }
  function canShowTeachingCard(input) {
    return !teachingOwnsBottom(input);
  }
  function canShowMiniMap(enabled, input) {
    return enabled && !input.utilityOpen;
  }

  // src/canalRecall/game/landmarkRuntime.ts
  var CLICKED_NOTICE_SECONDS = 8;
  var CLICK_SELECT_RADIUS = 120;
  var DRIVE_BY_RADIUS = 300;
  async function readJson(response, fallback) {
    if (!response.ok) return fallback;
    try {
      return await response.json();
    } catch {
      return fallback;
    }
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
      this._showLandmarkNotice(nearest, { kind: "timed", seconds: CLICKED_NOTICE_SECONDS });
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
    _showLandmarkNotice(notice, hold) {
      this._landmarkNotice = this._withRotatedFact(notice);
      this._landmarkNoticeHold = hold;
      this._landmarkNoticeState = openNotice();
      this._landmarkNoticeAlpha = 0;
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
    _withRotatedFact(notice) {
      if (!this._facts || !this._facts.size) return notice;
      const chosen = factCardText(
        notice.id,
        this._facts,
        this._factRotation,
        notice.detail || notice.longDetail
      );
      if (!chosen) return notice;
      this._commitFact(chosen.choice);
      return { ...notice, ...chosen.text };
    }
    _commitFact(choice) {
      this._factRotation = commitShownFact(
        typeof localStorage === "undefined" ? null : localStorage,
        this._factRotation,
        choice
      );
    }
    _clearLandmarkNotice() {
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
    /** The extract carries a Wikipedia URL for 236 of its 300 landmarks, which
     *  the canvas card cannot make clickable — so it is offered on a key. */
    _openLandmarkArticle() {
      const notice = this._landmarkNotice;
      if (!notice || !notice.wikipediaUrl) return;
      window.open(notice.wikipediaUrl, "_blank", "noopener");
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
    _showStreetKnowledge(name, type = "street", replaceOpenCard = false) {
      const key = this._normaliseCanalName(name);
      const entry = routeKnowledgeFor(
        this.streetKnowledge,
        name,
        type,
        (value) => this._normaliseCanalName(value)
      );
      if (!entry) return;
      const noticeId = entry.id || `${type}-knowledge:${key}`;
      this._seenStreetKnowledge = this._seenStreetKnowledge || /* @__PURE__ */ new Set();
      if (!shouldOfferStreetKnowledge({
        hasExtract: !!(entry.wikipediaUrl || entry.wikipediaExtract),
        alreadyShownThisDrive: this._seenStreetKnowledge.has(noticeId),
        quizOpen: !!this.quizPromptName,
        landmarkCardOpen: !!this._landmarkNotice,
        replaceOpenCard
      })) return;
      this._seenStreetKnowledge.add(noticeId);
      const split = splitDetail(entry.wikipediaExtract || "");
      this._showLandmarkNotice({
        id: noticeId,
        name: entry.name || name,
        type: "street",
        detail: split.detail,
        longDetail: split.longDetail,
        wikipediaUrl: entry.wikipediaUrl || "",
        extractLang: entry.wikipediaExtractLang || "en"
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
          streetResponse,
          waterResponse,
          brandedPoiResponse,
          factResponse
        ] = await Promise.all([
          fetch(url("landmarks.json")),
          fetch(url("boundaries.json")),
          fetch(url("neighborhoods-enriched.json")),
          fetch(url("bridges.json")),
          fetch(url("bridge-crossings.json")),
          fetch(url("street-knowledge.json")),
          fetch(url("streets.json")),
          fetch(url("water.json")),
          fetch(url("branded-pois.json")),
          // Generated trivia. Absent until a batch has been reviewed and
          // published, and the cards fall back to the Wikipedia lede when it is.
          fetch(url("facts.json")).catch(() => new Response("null", { status: 404 }))
        ]);
        if (!landmarkResponse.ok || !boundaryResponse.ok) throw new Error("Cached place data unavailable");
        const [
          features,
          boundaries,
          neighborhoodEnriched,
          bridgeFeatures,
          crossingIndex,
          streetKnowledge,
          streetFeatures,
          waterFeatures,
          brandedPois,
          factsFile
        ] = await Promise.all([
          landmarkResponse.json(),
          boundaryResponse.json(),
          readJson(neighborhoodEnrichedResponse, []),
          readJson(bridgeResponse, []),
          readJson(crossingResponse, { bridges: {} }),
          readJson(streetKnowledgeResponse, []),
          readJson(streetResponse, []),
          readJson(waterResponse, []),
          readJson(brandedPoiResponse, []),
          readJson(factResponse, null)
        ]);
        this._facts = buildFactIndex(factsFile);
        this._factRotation = loadRotationState(
          typeof localStorage === "undefined" ? null : localStorage
        );
        this.streetKnowledge = buildRouteKnowledgeIndex(
          streetKnowledge,
          streetFeatures,
          waterFeatures,
          (name) => this._normaliseCanalName(name)
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
        if (canShowTeachingCard(this._teachingGate()) && this.raceTime > NEIGHBORHOOD_NOTICE_GRACE) {
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
      if (!canShowTeachingCard(this._teachingGate())) return;
      if (nearest) {
        this._seenLandmarks.add(nearest.id);
        this._seenLandmarkNames.add(nearest.name);
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
      this._landmarkCardBounds = null;
      if (!lm) return;
      if (!canShowTeachingCard(this._teachingGate())) return;
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
        factKind: lm.factKind,
        extractLang: lm.extractLang,
        hasArticle: !!lm.wikipediaUrl,
        hasImage
      }, measure, window.CanalRecallUi.landmarkCardWidth(this.viewport));
      const postcardShowing = !!(this._neighborhoodNotice && this._neighborhoodNoticeTimer > 0) && canShowTeachingCard(this._teachingGate());
      const bottomLayout = window.CanalRecallUi.hudLayout({
        viewport: this.viewport,
        tripWidth: 180,
        postcardVisible: postcardShowing,
        landmarkWidth: card.width,
        landmarkHeight: card.height,
        feedbackVisible: !!this.quizFeedback,
        neighborhoodVisible: !!this.currentNeighborhood,
        minimapVisible: canShowMiniMap(this.showMiniMap, this._teachingGate()),
        zoomVisible: this._zoomBadgeTimer > 0,
        controlsVisible: !this.input.isMobile && this.raceTime < CONTROLS_HINT_DURATION
      });
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
    _expandLandmarkNotice() {
      const lm = this._landmarkNotice;
      const panel = this._landmarkPanel;
      if (!lm || !panel) return false;
      const cards = window.CanalRecallCards;
      const body = (lm.factTexts && lm.factTexts.length ? lm.factTexts.join("\n\n") : "") || lm.longDetail || lm.detail || cards.placeOnlyDetail(lm.type, this.currentNeighborhood);
      const badges = panel.querySelector("#landmark-panel-badges");
      badges.textContent = "";
      const pushBadge = (label, kind) => {
        const chip = document.createElement("span");
        chip.dataset.kind = kind;
        chip.textContent = label;
        badges.appendChild(chip);
      };
      if (lm.type) pushBadge(lm.type.toUpperCase().replace(/_/g, " "), "category");
      if (lm.factKind) pushBadge(lm.factKind.toUpperCase(), "fact");
      if (lm.extractLang && lm.extractLang !== "en") {
        pushBadge(`${lm.extractLang.toUpperCase()} \u2014 NOT TRANSLATED YET`, "lang");
      }
      panel.querySelector("#landmark-panel-title").textContent = lm.name || "";
      panel.querySelector("#landmark-panel-body").textContent = body;
      const image = panel.querySelector("#landmark-panel-image");
      if (lm.imageUrl) {
        image.src = lm.imageUrl;
        image.alt = lm.name || "";
        image.hidden = false;
      } else {
        image.removeAttribute("src");
        image.hidden = true;
      }
      const link = panel.querySelector("#landmark-panel-link");
      if (lm.wikipediaUrl) {
        link.href = lm.wikipediaUrl;
        link.hidden = false;
      } else {
        link.removeAttribute("href");
        link.hidden = true;
      }
      panel.querySelector("#landmark-panel-scroll").scrollTop = 0;
      this._toggleUtilityPanel(panel);
      return true;
    }
    _renderNeighborhoodNotice() {
      const hood = this._neighborhoodNotice;
      if (!hood || this._neighborhoodNoticeTimer <= 0) return;
      if (!canShowTeachingCard(this._teachingGate())) return;
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
        measure,
        window.CanalRecallUi.postcardWidth(this.viewport)
      );
      const bottomLayout = window.CanalRecallUi.hudLayout({
        viewport: this.viewport,
        tripWidth: 180,
        postcardHeight: card.height,
        neighborhoodVisible: !!this.currentNeighborhood,
        minimapVisible: canShowMiniMap(this.showMiniMap, this._teachingGate())
      });
      const cardX = bottomLayout.postcard.x;
      const baseCardY = bottomLayout.postcard.y;
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
