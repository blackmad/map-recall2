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
  function sentencesUpTo(parts, max) {
    let out = "";
    for (const part of parts) {
      const next = out ? `${out} ${part}` : part;
      if (next.length > max) break;
      out = next;
    }
    if (out || !parts.length) return out;
    const cut = parts[0].slice(0, max - 1);
    const space = cut.lastIndexOf(" ");
    return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}\u2026`;
  }
  function splitDetail(text) {
    const parts = sentences((text || "").trim()).filter(Boolean);
    return {
      detail: sentencesUpTo(parts.slice(0, 1), 150),
      longDetail: sentencesUpTo(parts.slice(0, 3), 280)
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
  var eligible = (entry) => entry.wikipediaUrl || entry.wikipediaExtract || entry.nameOrigin;
  function buildRouteKnowledgeIndex(legacy, streets, waters, normalise, origins = []) {
    const index = /* @__PURE__ */ new Map();
    const add = (entry, type) => {
      index.set(`${type}:${normalise(entry.name)}`, { ...entry, type });
    };
    for (const entry of legacy) add(entry, entry.type === "water" ? "water" : "street");
    for (const entry of streets) if (eligible(entry)) add(entry, "street");
    for (const entry of waters) if (eligible(entry)) add(entry, "water");
    for (const origin of origins) {
      if (!origin.en) continue;
      const type = origin.kind;
      const key = `${type}:${normalise(origin.name)}`;
      const existing = index.get(key);
      index.set(key, existing ? { ...existing, nameOrigin: origin.en } : { name: origin.name, type, nameOrigin: origin.en });
    }
    return index;
  }
  var sentencesOf = (text) => text.trim().split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  var STREET_CARD_DETAIL_CHARS = 150;
  var STREET_CARD_LONG_CHARS = 280;
  function streetCardText(entry) {
    const origin = sentencesOf(entry.nameOrigin || "");
    const extract = sentencesOf(entry.wikipediaExtract || "");
    if (!origin.length) {
      return { detail: sentencesUpTo(extract.slice(0, 1), STREET_CARD_DETAIL_CHARS), longDetail: sentencesUpTo(extract.slice(0, 3), STREET_CARD_LONG_CHARS) };
    }
    return {
      detail: sentencesUpTo(origin, STREET_CARD_DETAIL_CHARS),
      longDetail: sentencesUpTo([...origin, ...extract], STREET_CARD_LONG_CHARS)
    };
  }
  function routeKnowledgeFor(index, name, type, normalise) {
    const key = normalise(name);
    if (type === "bridge") return index.get(`bridge:${key}`);
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
  function canShowDriveByCard(viewportMode, input) {
    return viewportMode !== "compact" && canShowTeachingCard(input);
  }
  function canShowMiniMap(enabled, input) {
    return enabled && !input.utilityOpen;
  }

  // src/canalRecall/game/modes.ts
  function isTransit(mode) {
    return mode === "transit";
  }

  // src/canalRecall/buildingFacts.ts
  var BUILDING_TYPES = [
    "warehouse",
    "church",
    "chapel",
    "cathedral",
    "mosque",
    "synagogue",
    "temple",
    "school",
    "university",
    "hospital",
    "train_station",
    "industrial",
    "office",
    "retail",
    "commercial",
    "hotel",
    "windmill",
    "houseboat",
    "civic",
    "government",
    "public",
    "kindergarten",
    "college",
    "museum",
    "theatre"
  ];
  var TYPE_LABELS = {
    warehouse: "warehouse",
    church: "church",
    chapel: "chapel",
    cathedral: "cathedral",
    mosque: "mosque",
    synagogue: "synagogue",
    temple: "temple",
    school: "school",
    university: "university building",
    hospital: "hospital",
    train_station: "station building",
    industrial: "industrial building",
    office: "office building",
    retail: "shop building",
    commercial: "commercial building",
    hotel: "hotel",
    windmill: "windmill",
    houseboat: "houseboat",
    civic: "civic building",
    government: "government building",
    public: "public building",
    kindergarten: "nursery school",
    college: "college",
    museum: "museum building",
    theatre: "theatre"
  };
  var MONUMENT_FUNCTIONS = [
    ["wonen", "housing"],
    ["onderwijs en wetenschap", "education and science"],
    ["religie", "worship"],
    ["verkeer en vervoer", "transport"],
    ["zorg en welzijn", "care and welfare"],
    ["bestuur en recht", "government and justice"],
    ["horeca, sport en recreatie", "hospitality, sport and recreation"],
    ["landbouw en bosbouw", "farming"],
    ["nutsvoorziening", "a public utility"],
    ["industrie en ambacht", "industry and crafts"],
    ["kunst en cultuur", "the arts"],
    ["waterstaat", "water management"],
    ["oorlog en defensie", "defence"],
    ["begraven", "burial"],
    ["herdenken", "remembrance"],
    ["landgoederen en buitenplaatsen", "a country estate"]
  ];
  var BUILDING_FACT_ZOOM = 14;
  var shortBuildingId = (id) => id.replace(/^NL\.IMBAG\.Pand\./, "P");
  function plausibleYear(year, now = (/* @__PURE__ */ new Date()).getFullYear()) {
    return Number.isInteger(year) && year >= 1200 && year <= now + 2;
  }
  function periodOf(year) {
    if (year < 1588) return "before the Dutch Golden Age";
    if (year <= 1672) return "in the Dutch Golden Age";
    if (year < 1700) return "in the late seventeenth century";
    if (year < 1800) return "in the eighteenth century";
    if (year < 1860) return "in the early nineteenth century";
    if (year < 1900) return "in the late nineteenth century";
    if (year < 1940) return "in the early twentieth century";
    if (year < 1946) return "during the Second World War";
    if (year < 1975) return "in the post-war decades";
    if (year < 2e3) return "in the late twentieth century";
    return "this century";
  }
  var HERITAGE_LABELS = {
    0: "",
    1: "Part of a World Heritage site.",
    2: "A national monument (rijksmonument).",
    3: "A municipal monument."
  };
  function storeysFor(heightMetres) {
    if (!heightMetres || !(heightMetres > 2.5)) return null;
    return Math.max(1, Math.round(heightMetres / 3.2));
  }
  function describeBuilding(row, heightMetres, name = "") {
    const storeys = storeysFor(heightMetres);
    const type = row && row[1] >= 0 ? TYPE_LABELS[BUILDING_TYPES[row[1]]] : "";
    const monument = row && row.length > 3 ? row[3] : null;
    const monumentYear = monument?.y ? Number(monument.y.slice(0, 4)) : NaN;
    const year = plausibleYear(monumentYear) ? monumentYear : row && plausibleYear(row[0]) ? row[0] : null;
    const years = plausibleYear(monumentYear) ? monument.y : year ? String(year) : "";
    const shownName = name || monument?.n || "";
    const title = shownName || (year ? `Built ${year}` : type ? capitalise(type) : "No building details");
    const parts = [];
    const designed = monument?.a ? `, designed by ${monument.a}` : "";
    if (year) {
      parts.push(type ? `A ${type}, built in ${years}, ${periodOf(year)}${designed}.` : `Built in ${years}, ${periodOf(year)}${designed}.`);
    } else if (designed) {
      parts.push(`Designed by ${monument.a}.`);
    } else if (type && shownName) {
      parts.push(`A ${type}.`);
    }
    const heritage = row ? HERITAGE_LABELS[row[2]] : "";
    const purpose = monument?.f != null && MONUMENT_FUNCTIONS[monument.f] && monument.f > 0 ? `Originally built for ${MONUMENT_FUNCTIONS[monument.f][1]}.` : "";
    if (heritage) parts.push(heritage);
    if (purpose) parts.push(purpose);
    if (storeys) parts.push(`About ${Math.round(heightMetres)} m tall, some ${storeys} ${storeys === 1 ? "storey" : "storeys"}.`);
    return { name: title, detail: parts.join(" ") || "This building has no name or date in the map data." };
  }
  var capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  function factTileOf(lng, lat) {
    const n = 2 ** BUILDING_FACT_ZOOM;
    return {
      x: Math.floor((lng + 180) / 360 * n),
      y: Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n)
    };
  }
  var BuildingFactStore = class {
    constructor(base, fetchImpl = (...args) => fetch(...args)) {
      this.base = base;
      this.fetchImpl = fetchImpl;
    }
    rows = /* @__PURE__ */ new Map();
    requested = /* @__PURE__ */ new Set();
    lastCentre = "";
    setBase(base) {
      if (base === this.base) return;
      this.base = base;
      this.rows.clear();
      this.requested.clear();
      this.lastCentre = "";
    }
    /** Load the tile under a point and its eight neighbours. Cheap when unchanged. */
    prefetchAround(lng, lat) {
      const { x, y } = factTileOf(lng, lat);
      const centre = `${x}/${y}`;
      if (centre === this.lastCentre) return;
      this.lastCentre = centre;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) void this.load(x + dx, y + dy);
    }
    lookup(id) {
      return id == null ? null : this.rows.get(shortBuildingId(String(id))) ?? null;
    }
    async load(x, y) {
      const key = `${x}/${y}`;
      if (this.requested.has(key)) return;
      this.requested.add(key);
      try {
        const response = await this.fetchImpl(`${this.base.replace(/\/$/, "")}/building-facts/${BUILDING_FACT_ZOOM}/${key}.json.gz`);
        if (!response.ok) return;
        const bytes = new Uint8Array(await response.arrayBuffer());
        const gzipped = bytes.length >= 2 && bytes[0] === 31 && bytes[1] === 139;
        const text = gzipped && typeof DecompressionStream !== "undefined" ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(bytes);
        const tile = JSON.parse(text);
        for (const [id, row] of Object.entries(tile.buildings || {})) this.rows.set(id, row);
      } catch {
      }
    }
  };

  // src/canalRecall/game/routeSelection.ts
  function nearestRouteIndex(route, player) {
    if (route.length === 1) return { index: 0, distance: Math.hypot(route[0].x - player.x, route[0].y - player.y) };
    let index = 0, distance = Infinity;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((player.x - a.x) * dx + (player.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(a.x + dx * t - player.x, a.y + dy * t - player.y);
      if (d < distance) {
        distance = d;
        index = i;
      }
    }
    return { index, distance };
  }

  // src/canalRecall/game/driveByTrigger.ts
  var DRIVE_BY_RADIUS = 300;
  var DRIVE_BY_LOOKAHEAD_SECONDS = 3;
  var DRIVE_BY_MIN_LOOKAHEAD = DRIVE_BY_RADIUS;
  var DRIVE_BY_ROUTE_TOLERANCE = 140;
  var DRIVE_BY_PASSED_BEHIND = 90;
  var PREEMPT_AFTER_SECONDS = 2.5;
  function pathAhead(rider, route) {
    const reach = Math.max(DRIVE_BY_MIN_LOOKAHEAD, Math.abs(rider.speed) * DRIVE_BY_LOOKAHEAD_SECONDS);
    if (route && route.length >= 2) {
      const nearest = nearestRouteIndex(route, rider);
      if (nearest.distance <= DRIVE_BY_ROUTE_TOLERANCE) {
        const path = [{ x: rider.x, y: rider.y }];
        let left = reach;
        for (let i = nearest.index + 1; i < route.length && left > 0; i++) {
          const from = path[path.length - 1];
          const step = Math.hypot(route[i].x - from.x, route[i].y - from.y);
          if (step >= left) {
            const t = left / step;
            path.push({ x: from.x + (route[i].x - from.x) * t, y: from.y + (route[i].y - from.y) * t });
            left = 0;
          } else {
            path.push({ x: route[i].x, y: route[i].y });
            left -= step;
          }
        }
        if (path.length >= 2) return path;
      }
    }
    const direction = rider.speed < 0 ? rider.angle + Math.PI : rider.angle;
    return [
      { x: rider.x, y: rider.y },
      { x: rider.x + Math.cos(direction) * reach, y: rider.y + Math.sin(direction) * reach }
    ];
  }
  function approachAlong(path, point) {
    const start = path[0];
    const lead = path[1];
    const leadLength = Math.hypot(lead.x - start.x, lead.y - start.y) || 1;
    const forward = ((point.x - start.x) * (lead.x - start.x) + (point.y - start.y) * (lead.y - start.y)) / leadLength;
    if (forward < -DRIVE_BY_PASSED_BEHIND) return null;
    let travelled = 0;
    let best = null;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (length * length))) : 0;
      const distance = Math.hypot(a.x + dx * t - point.x, a.y + dy * t - point.y);
      if (!best || distance < best.distance) best = { distance, along: travelled + length * t };
      travelled += length;
    }
    return best && best.distance <= DRIVE_BY_RADIUS ? best.along : null;
  }
  function pickDriveBy(candidates, path) {
    let chosen = null;
    let soonest = Infinity;
    for (const candidate of candidates) {
      const along = approachAlong(path, candidate);
      if (along !== null && along < soonest) {
        chosen = candidate;
        soonest = along;
      }
    }
    return chosen;
  }
  function mayReplaceNotice(source, hold, elapsed) {
    if (!source || !hold) return true;
    if (source === "click" || source === "arrival" || hold.kind === "sticky") return false;
    return elapsed >= PREEMPT_AFTER_SECONDS;
  }

  // src/canalRecall/transit/corridorStreets.ts
  function pointToSegDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 <= 1e-9) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function buildCorridorStreetIndex(streets, project) {
    const segments = [];
    const names = [];
    const distractorsByName = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    for (const street of streets) {
      if (!street.name) continue;
      if (!seen.has(street.name)) {
        seen.add(street.name);
        names.push(street.name);
        if (street.distractors && street.distractors.length) {
          distractorsByName.set(street.name, street.distractors);
        }
      }
      for (const path of street.paths) {
        if (!path || path.length < 2) continue;
        let prev = null;
        for (const [lat, lng] of path) {
          const point = project(lat, lng);
          if (!point) {
            prev = null;
            continue;
          }
          if (prev) {
            segments.push({
              name: street.name,
              ax: prev.x,
              ay: prev.y,
              bx: point.x,
              by: point.y
            });
          }
          prev = point;
        }
      }
    }
    return { segments, names, distractorsByName };
  }
  function distanceToPath(path, x, y) {
    if (!path.length) return Infinity;
    if (path.length === 1) return Math.hypot(path[0].x - x, path[0].y - y);
    let best = Infinity;
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1];
      const b = path[i];
      best = Math.min(best, pointToSegDist(x, y, a.x, a.y, b.x, b.y));
    }
    return best;
  }

  // src/canalRecall/game/landmarkRuntime.ts
  var CLICKED_NOTICE_SECONDS = 8;
  var CLICK_SELECT_RADIUS = 120;
  var CLICK_MARKER_RADIUS = 40;
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
      const owner = building && building.id != null ? this.landmarks.find((landmark) => landmark.buildingIds?.includes(String(building.id))) : void 0;
      if (owner) nearest = owner;
      else if (nearest && building && nearestDistance > CLICK_MARKER_RADIUS) nearest = null;
      if (nearest && !owner && building && building.featureTarget) {
        nearest = { ...nearest, featureTarget: building.featureTarget };
      }
      if (!nearest) {
        if (!building) return;
        nearest = this._cardForClickedBuilding(building);
      }
      this._showLandmarkNotice(nearest, { kind: "timed", seconds: CLICKED_NOTICE_SECONDS }, "click");
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
    _showLandmarkNotice(notice, hold, source = "click") {
      if (this._landmarkNotice) this.vectorMap?.setActiveLandmark(null);
      this._landmarkNotice = this._withRotatedFact(notice);
      this._landmarkNoticeHold = hold;
      this._landmarkNoticeSource = source;
      this._landmarkNoticeState = openNotice();
      this._landmarkNoticeAlpha = 0;
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
      if (this._landmarkNotice) this.vectorMap?.setActiveLandmark(null);
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
      let row = this._buildingFacts?.lookup(building.id) ?? null;
      const spoils = this.vectorMap._spoils;
      const monument = row && row.length > 3 ? row[3] : void 0;
      if (row && monument?.n && spoils?.call(this.vectorMap, monument.n)) {
        const { n: _hidden, ...rest } = monument;
        row = [row[0], row[1], row[2], rest];
      }
      const facts = describeBuilding(row, building.height, buildingName);
      return {
        id: `clicked-${building.id || building.lngLat.join("-")}`,
        name: facts.name,
        type: "building",
        detail: facts.detail,
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
      if (type === "line") return;
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
        hasExtract: !!(entry.wikipediaUrl || entry.wikipediaExtract || entry.nameOrigin),
        alreadyShownThisDrive: this._seenStreetKnowledge.has(noticeId),
        quizOpen: !!this.quizPromptName,
        landmarkCardOpen: !!this._landmarkNotice,
        replaceOpenCard
      })) return;
      this._seenStreetKnowledge.add(noticeId);
      const split = streetCardText(entry);
      this._showLandmarkNotice({
        id: noticeId,
        name: entry.name || name,
        type: type === "bridge" ? "bridge" : "street",
        detail: split.detail,
        longDetail: split.longDetail,
        imageUrl: entry.wikipediaImageUrl || "",
        wikipediaUrl: entry.wikipediaUrl || "",
        extractLang: entry.wikipediaExtractLang || "en"
      }, { kind: "timed", seconds: CLICKED_NOTICE_SECONDS }, "street");
    }
    // ---- Loading the extract ----
    async _loadLandmarks(centerLat, centerLng, segments) {
      try {
        const Prefs = window.CanalRecallPreferences;
        const city = Prefs && Prefs.cityById ? Prefs.cityById(this.cityId || Prefs.DEFAULT_CITY_ID || "amsterdam") : { extractPath: "../data/extracts/amsterdam" };
        const base = window.location.href;
        const url = (name) => new URL(`${city.extractPath}/${name}`, base);
        const factBase = new URL(`${city.extractPath}/`, base).href;
        if (this._buildingFacts) this._buildingFacts.setBase(factBase);
        else this._buildingFacts = new BuildingFactStore(factBase);
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
          factResponse,
          landmarkBuildingResponse
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
          fetch(url("facts.json")).catch(() => new Response("null", { status: 404 })),
          // Which streamed building each landmark is, resolved at extract time.
          fetch(url("landmark-buildings.json")).catch(() => new Response("null", { status: 404 }))
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
          factsFile,
          landmarkBuildings
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
          readJson(factResponse, null),
          readJson(landmarkBuildingResponse, null)
        ]);
        this._facts = buildFactIndex(factsFile);
        this._factRotation = loadRotationState(
          typeof localStorage === "undefined" ? null : localStorage
        );
        const normalise = (name) => this._normaliseCanalName(name);
        const knowledge = buildRouteKnowledgeIndex(streetKnowledge, streetFeatures, waterFeatures, normalise);
        this.streetKnowledge = knowledge;
        void fetch(url("street-name-origins.json")).then((response) => readJson(response, null)).catch(() => null).then((originsFile) => {
          if (!originsFile?.origins?.length || this.streetKnowledge !== knowledge) return;
          this.streetKnowledge = buildRouteKnowledgeIndex(
            streetKnowledge,
            streetFeatures,
            waterFeatures,
            normalise,
            originsFile.origins
          );
        });
        const transitStops = this.osmLoader?.transitLoad?.stops || [];
        this.vectorMap.setSpoilerNames([
          ...streetFeatures,
          ...waterFeatures,
          ...bridgeFeatures,
          ...transitStops
        ].map((item) => item.name || "").filter(Boolean));
        this.vectorMap.setPlaces(features, boundaries);
        this.vectorMap.setBrandedPois(brandedPois);
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
        const toWorld = ([lat, lng]) => ({
          x: (lng - centerLng) * metersPerDegreeLng * PIXELS_PER_METER + this.osmLoader._lastOffsetX,
          y: -(lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER + this.osmLoader._lastOffsetY
        });
        this.landmarks = buildLandmarks(features, (lat, lng) => isTransit(this.travelMode) ? toWorld([lat, lng]) : this.osmLoader.latLngToGamePoint(lat, lng, centerLat, centerLng, segments, false));
        if (landmarkBuildings?.buildings) {
          for (const landmark of this.landmarks) landmark.buildingIds = landmarkBuildings.buildings[landmark.id] ?? [];
        }
        this._landmarkImages = /* @__PURE__ */ new Map();
        this._landmarkImageRequests = /* @__PURE__ */ new Set();
        this.neighborhoods = buildNeighborhoods(boundaries, neighborhoodEnriched, toWorld);
        this.bridges = buildBridges(bridgeFeatures, crossingIndex, toWorld);
        if (isTransit(this.travelMode)) {
          const corridorStreets = streetFeatures.map((street) => ({
            name: street.name,
            paths: (street.paths || (street.path ? [street.path] : [])).map((path) => path.map(([lat, lng]) => [lat, lng])),
            distractors: street.distractors
          }));
          this._corridorStreetIndex = buildCorridorStreetIndex(
            corridorStreets,
            (lat, lng) => toWorld([lat, lng])
          );
        } else {
          this._corridorStreetIndex = null;
        }
        this._neighborhoodImages = /* @__PURE__ */ new Map();
        this._neighborhoodLetterArt = /* @__PURE__ */ new Map();
        this._neighborhoodImageRequests = /* @__PURE__ */ new Set();
      } catch (error) {
        console.warn("Landmark notes unavailable:", error);
        this.landmarks = [];
        this._corridorStreetIndex = null;
      }
    }
    // ---- Per-frame ----
    _updateLandmarks(dt) {
      if (this._buildingFacts && this.player && this._toLatLon) {
        const at = this._toLatLon(this.player.x, this.player.y);
        if (at) this._buildingFacts.prefetchAround(at[1], at[0]);
      }
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
        if (canShowDriveByCard(this.viewport?.mode, this._teachingGate()) && this.raceTime > NEIGHBORHOOD_NOTICE_GRACE) {
          if (hood) this._ensureNeighborhoodImage(hood);
          this._neighborhoodNotice = hood || { name: this.currentNeighborhood };
          this._neighborhoodNoticeTimer = NEIGHBORHOOD_NOTICE_SECONDS;
        }
      }
      const routePath = this.routePath;
      const landmarkRouteRadiusPx = isTransit(this.travelMode) ? (window.CanalRecallTransit?.TRANSIT_LANDMARK_ROUTE_RADIUS_M ?? 120) * PIXELS_PER_METER : Infinity;
      const candidates = [];
      const player = this.player;
      const ahead = pathAhead(player, routePath);
      const reach = ahead.reduce((sum, point, i) => i ? sum + Math.hypot(point.x - ahead[i - 1].x, point.y - ahead[i - 1].y) : 0, 0) + DRIVE_BY_RADIUS;
      for (const landmark of this.landmarks) {
        const distance = Math.hypot(landmark.x - this.player.x, landmark.y - this.player.y);
        if (distance < LANDMARK_IMAGE_PREFETCH_RADIUS) this._ensureLandmarkImage(landmark);
        if (this._seenLandmarks.has(landmark.id)) continue;
        if (!isWorthACard(landmark)) continue;
        if (distance > reach) continue;
        if (isTransit(this.travelMode) && routePath && routePath.length >= 2) {
          if (distanceToPath(routePath, landmark.x, landmark.y) > landmarkRouteRadiusPx) continue;
        }
        candidates.push(landmark);
      }
      if (!canShowDriveByCard(this.viewport?.mode, this._teachingGate())) return;
      if (this._landmarkNotice && !mayReplaceNotice(
        this._landmarkNoticeSource ?? null,
        this._landmarkNoticeHold,
        this._landmarkNoticeState.elapsed
      )) return;
      const nearest = pickDriveBy(candidates, ahead);
      if (nearest && nearest.id !== this._landmarkNotice?.id) {
        this._seenLandmarks.add(nearest.id);
        this._seenLandmarkNames.add(nearest.name);
        this._showLandmarkNotice(nearest, { kind: "proximity", anchor: { x: nearest.x, y: nearest.y } }, "drive-by");
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
        body: lm.longDetail || lm.detail || cards.placeOnlyDetail(
          lm.type,
          this.currentNeighborhood,
          this._cityDisplayName()
        ),
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
      const body = (lm.factTexts && lm.factTexts.length ? lm.factTexts.join("\n\n") : "") || lm.longDetail || lm.detail || cards.placeOnlyDetail(lm.type, this.currentNeighborhood, this._cityDisplayName());
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
      const city = typeof this._activeCity === "function" ? this._activeCity() : null;
      const card = window.CanalRecallCards.measurePostcard(
        {
          name: hood.name,
          kind: hood.kind,
          imageArea: hood.imageArea,
          hasImage,
          cityName: city?.name || this._cityDisplayName?.() || "Amsterdam",
          provinceCaption: city?.provinceCaption || ""
        },
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
