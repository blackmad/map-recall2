"use strict";
(() => {
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
      const point = project(center[0], center[1], feature);
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
        sourceUrl: feature.sourceUrl,
        researchSourceUrl: feature.researchSourceUrl,
        researchDetail: feature.researchDetail,
        buildingIds: feature.buildingIds,
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

  // src/canalRecall/clickPoiInfo.ts
  function validPoiWebsite(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(/^[a-z]+:/i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
      return /^(https?:)$/.test(url.protocol) && url.hostname.includes(".") && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }
  function inRing(point, ring) {
    let inside = false;
    const [x, y] = point;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j], [bx, by] = ring[i];
      const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
      if (Math.abs(cross) < 1e-14 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && y >= Math.min(ay, by) && y <= Math.max(ay, by)) return true;
      if (ay > y !== by > y && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    }
    return inside;
  }
  function poiInsideBuilding(point, geometry) {
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    return polygons.some((rings) => rings.length && inRing(point, rings[0]) && !rings.slice(1).some((hole) => inRing(point, hole)));
  }
  var osmUrl = (id) => `https://www.openstreetmap.org/${{ n: "node", w: "way", r: "relation" }[id[0]]}/${id.slice(1)}`;
  var cell = (lng, lat) => `${Math.floor(lng * 1e3)}/${Math.floor(lat * 1e3)}`;
  var ClickPoiIndex = class {
    cells = /* @__PURE__ */ new Map();
    rows = [];
    constructor(file) {
      if (file?.version !== 1 || !Array.isArray(file.points)) return;
      for (const row of file.points) {
        if (!Array.isArray(row) || !/^[nwr]\d+$/.test(row[0]) || !row[1] || !Number.isFinite(row[2]) || !Number.isFinite(row[3])) continue;
        this.rows.push(row);
        const key = cell(row[2], row[3]);
        const group = this.cells.get(key) ?? [];
        group.push(row);
        this.cells.set(key, group);
      }
    }
    contained(geometry) {
      const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
      const outer = polygons.flatMap((rings) => rings[0] ?? []);
      if (!outer.length) return [];
      const xs = outer.map((p) => Math.floor(p[0] * 1e3)), ys = outer.map((p) => Math.floor(p[1] * 1e3));
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const candidates = [];
      if ((maxX - minX + 1) * (maxY - minY + 1) > 2e3) candidates.push(...this.rows);
      else for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) candidates.push(...this.cells.get(`${x}/${y}`) ?? []);
      const found = candidates.filter((row) => poiInsideBuilding([row[2], row[3]], geometry)).sort((a, b) => Number(!!b[8]) - Number(!!a[8]) || Number(!!b[7]) - Number(!!a[7]) || a[0].localeCompare(b[0]));
      const seen = /* @__PURE__ */ new Set();
      return found.filter((row) => {
        const key = row[1].normalize("NFC").toLocaleLowerCase("nl").trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    card(building) {
      if (!building.footprint) return null;
      const places = this.contained(building.footprint);
      if (!places.length) return null;
      const summaries = places.slice(0, 8).map((row) => `${row[1]} is mapped as ${row[5] || row[4]}${row[6] ? ` at ${row[6]}` : ""}.` + (row[8] ? ` ${row[8]}` : ""));
      const paragraphs = summaries.map((summary, i) => summary + (validPoiWebsite(places[i][7]) ? `
Website: ${validPoiWebsite(places[i][7])}` : "") + `
Map source: ${osmUrl(places[i][0])}`);
      const first = places[0];
      return {
        id: `clicked-poi-${building.id}`,
        name: places.length > 1 ? `${first[1]} + ${places.length - 1} mapped places` : first[1],
        type: first[4],
        detail: `${first[1]} is mapped as ${first[5] || first[4]}${first[6] ? ` at ${first[6]}` : ""}.`,
        longDetail: summaries.join("\n\n"),
        factTexts: paragraphs,
        sourceUrl: osmUrl(first[0]),
        lngLat: [first[2], first[3]],
        featureTarget: building.featureTarget
      };
    }
  };

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

  // src/canalRecall/bridgeRegister.ts
  function describeRegisteredBridge(fact) {
    const kind = [fact.movable ? "movable" : "", fact.material].filter(Boolean).join(" ");
    const noun = `${kind ? `${/^[aeiou]/i.test(kind) ? "an" : "a"} ${kind} ` : "a "}bridge`;
    const carries = fact.carries ? ` for ${fact.carries}` : "";
    const dated = fact.year ? `, dated ${fact.year} in the city's bridge register` : "";
    const lead = fact.nr != null ? `Bridge ${fact.nr}: ${noun}` : capitalise(noun);
    if (!kind && !carries && !dated && fact.nr == null) return "";
    return `${lead}${carries}${dated}.`;
  }
  var capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  // src/canalRecall/game/routeKnowledge.ts
  var eligible = (entry) => entry.wikipediaUrl || entry.wikipediaExtract || entry.nameOrigin;
  function buildRouteKnowledgeIndex(legacy, streets, waters, normalise, origins = [], bridgeRegister = {}) {
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
    for (const [name, fact] of Object.entries(bridgeRegister)) {
      const structureFact = describeRegisteredBridge(fact);
      if (!structureFact) continue;
      const key = `bridge:${normalise(name)}`;
      const existing = index.get(key);
      index.set(key, existing ? { ...existing, structureFact } : { name, type: "bridge", structureFact });
    }
    return index;
  }
  var sentencesOf = (text) => text.trim().split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  var STREET_CARD_DETAIL_CHARS = 150;
  var STREET_CARD_LONG_CHARS = 280;
  function streetCardText(entry) {
    const fact = (entry.structureFact || "").trim();
    const text = structureLessCardText(entry);
    if (!fact) return text;
    if (!text.detail) return { detail: fact, longDetail: fact };
    const room = STREET_CARD_LONG_CHARS - fact.length - 1;
    const lead = sentencesUpTo(sentencesOf(`${entry.nameOrigin || ""} ${entry.wikipediaExtract || ""}`), room);
    return { detail: text.detail, longDetail: lead ? `${lead} ${fact}` : fact };
  }
  function structureLessCardText(entry) {
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
    const title = shownName || (year ? `Built ${year}` : type ? capitalise2(type) : "No building details");
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
  var capitalise2 = (text) => text.charAt(0).toUpperCase() + text.slice(1);
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

  // src/canalRecall/landmarks/surveyedLandmarks.json
  var surveyedLandmarks_default = [
    {
      id: "westerkerk",
      name: "Westerkerk",
      author: "City of Amsterdam, Geo en Vastgoedinformatie",
      warehouseId: "11e419e09f0c9a7e270fcd68188626b2",
      landmarkId: "extract_landmarks_1692085215",
      landmarkName: "Westerkerk",
      address: "Prinsengracht 277, Amsterdam",
      anchor: [
        4.88396309426941,
        52.374553951618516
      ],
      footprint: {
        centre: [
          4.8839111908456285,
          52.37456267500661
        ],
        headingDegrees: 92.95334409606835,
        lengthMetres: 60.46473582847,
        widthMetres: 43.35976262783471
      },
      anchorToLandmarkMetres: 29.8
    },
    {
      id: "stadhuis",
      name: "Stadhuis (City hall)",
      author: "City of Amsterdam, Geo en Vastgoedinformatie",
      warehouseId: "5995fd7a0e7fa47d99c802e874695f6b",
      landmarkId: "extract_landmarks_1919682395",
      landmarkName: "Dutch National Opera & Ballet",
      address: "Waterlooplein 28, Amsterdam",
      anchor: [
        4.900961341213284,
        52.367703988914265
      ],
      footprint: null,
      anchorToLandmarkMetres: 35.1
    },
    {
      id: "oude-kerk",
      name: "Oude Kerk (Old Church)",
      author: "City of Amsterdam, Geo en Vastgoedinformatie",
      warehouseId: "5ec8bf3fa426e5d622fc8389905f949e",
      landmarkId: "extract_landmarks_1522513904",
      landmarkName: "Old Church",
      address: "Oudekerksplein 23, Amsterdam",
      anchor: [
        4.898107149173812,
        52.37429820721874
      ],
      footprint: {
        centre: [
          4.898073280113648,
          52.37435793355251
        ],
        headingDegrees: 86.59811535561408,
        lengthMetres: 81.88802279426366,
        widthMetres: 64.00195512396668
      },
      anchorToLandmarkMetres: 25.3
    },
    {
      id: "centraal-station",
      name: "Centraal station",
      author: "City of Amsterdam, Geo en Vastgoedinformatie",
      warehouseId: "6e8629eaefa7ab9f4e5ba763a187284e",
      landmarkId: "extract_landmarks_332626598",
      landmarkName: "Cuypersgebouw",
      address: "Stationsplein",
      anchor: [
        4.9000903650085235,
        52.378838075868146
      ],
      footprint: {
        centre: [
          4.899750668752946,
          52.37855998792934
        ],
        headingDegrees: 120.65330083236796,
        lengthMetres: 244.34798071019168,
        widthMetres: 30.916412054875813
      },
      anchorToLandmarkMetres: 44.1
    },
    {
      id: "national-monument-on-the-dam",
      name: "National Monument on the Dam",
      author: "City of Amsterdam, Geo en Vastgoedinformatie",
      warehouseId: "80385c387986217491e131c17526634a",
      landmarkId: "extract_landmarks_720777797",
      landmarkName: "National Monument",
      address: "Dam, Amsterdam",
      anchor: [
        4.8936960138168075,
        52.37278222735422
      ],
      footprint: {
        centre: [
          4.8936883137407685,
          52.37282184707071
        ],
        headingDegrees: 176.47702002174162,
        lengthMetres: 34.53751303400255,
        widthMetres: 34.522229825201435
      },
      anchorToLandmarkMetres: 20.6
    },
    {
      id: "nemo",
      name: "NEMO",
      author: "City of Amsterdam, Geo en Vastgoedinformatie",
      warehouseId: "a2a1d7c7726cb7e065a54e9dd3ee74f",
      landmarkId: "extract_landmarks_1875483593",
      landmarkName: "Nemo",
      address: "Oosterdok 2, Amsterdam",
      anchor: [
        4.912047425587275,
        52.37396981022394
      ],
      footprint: null,
      anchorToLandmarkMetres: 13.7
    },
    {
      id: "rijksmuseum",
      name: "Rijksmuseum",
      author: "City of Amsterdam, Geo en Vastgoedinformatie",
      warehouseId: "a57b8c559152b7851aeb638739e9b807",
      landmarkId: "extract_landmarks_512243549",
      landmarkName: "Rijksmuseum",
      address: "Jan Luijkenstraat 1, Amsterdam",
      anchor: [
        4.885146056364321,
        52.35975292731005
      ],
      footprint: {
        centre: [
          4.884979214003914,
          52.35995618631319
        ],
        headingDegrees: 102.66684543249102,
        lengthMetres: 216.0340626582873,
        widthMetres: 191.08233490964875
      },
      anchorToLandmarkMetres: 103.2
    },
    {
      id: "de-beurs-van-berlage",
      name: "De Beurs van Berlage (Stock Exchange)",
      author: "City of Amsterdam, Geo en Vastgoedinformatie",
      warehouseId: "c5a0708f3e4b36fe622758e070290bc2",
      landmarkId: "extract_landmarks_1104215352",
      landmarkName: "Berlage's Stock Market",
      address: "Damrak 277, Amsterdam",
      anchor: [
        4.896348334822169,
        52.37503529982596
      ],
      footprint: {
        centre: [
          4.896282358992785,
          52.37500164690132
        ],
        headingDegrees: 37.10231784305506,
        lengthMetres: 143.68034104351068,
        widthMetres: 54.265141530449334
      },
      anchorToLandmarkMetres: 30.5
    },
    {
      id: "palace-on-the-dam",
      name: "Palace on the Dam",
      author: "City of Amsterdam, Geo en Vastgoedinformatie",
      warehouseId: "d1ad512d8df5fc6745407e0587dff10e",
      landmarkId: "extract_landmarks_342809743",
      landmarkName: "Royal Palace",
      address: "Nieuwezijds Voorburgwal 147, Amsterdam",
      anchor: [
        4.891409500306835,
        52.373196352182916
      ],
      footprint: {
        centre: [
          4.891336694593322,
          52.37314491172975
        ],
        headingDegrees: 1.4350192765089105,
        lengthMetres: 80.97600419214265,
        widthMetres: 65.49286921449004
      },
      anchorToLandmarkMetres: 28.9
    },
    {
      id: "munttoren-amsterdam",
      name: "Munttoren Amsterdam",
      author: "OnO",
      warehouseId: "289437190bd7efc1c0de3c0357f9a9da",
      landmarkId: "extract_landmarks_1375175685",
      landmarkName: "Mint Tower",
      address: "Muntplein Amsterdam",
      anchor: [
        4.893198211404391,
        52.3670118642164
      ],
      footprint: {
        centre: [
          4.893206481413279,
          52.367049898093235
        ],
        headingDegrees: 125.79927526445167,
        lengthMetres: 9.13476982005432,
        widthMetres: 4.419992279890443
      },
      anchorToLandmarkMetres: 2
    },
    {
      id: "montelbaanstoren-amsterdam",
      name: "Montelbaanstoren, Amsterdam.",
      author: "OnO",
      warehouseId: "917a5cc60a9c5469c0de3c0357f9a9da",
      landmarkId: "extract_landmarks_1027016792",
      landmarkName: "Montelbaanstoren",
      address: "Oudeschans 2.. Amsterdam, The Netherlands",
      anchor: [
        4.905658,
        52.372047
      ],
      footprint: {
        centre: [
          4.905666212830665,
          52.37204293900936
        ],
        headingDegrees: 14.7477799747804,
        lengthMetres: 11.178574490070794,
        widthMetres: 10.278398345692779
      },
      anchorToLandmarkMetres: 7.4
    },
    {
      id: "heineken-experience-amsterdam",
      name: "Heineken Experience, Amsterdam.",
      author: "marcinplymouth",
      warehouseId: "4e77b7d365245b8239a65e5e29a6306",
      landmarkId: "extract_landmarks_914627337",
      landmarkName: "Heineken Experience",
      address: null,
      anchor: [
        4.89184165895771,
        52.35768328228659
      ],
      footprint: null,
      anchorToLandmarkMetres: 17.9
    },
    {
      id: "concertgebouw",
      name: "Concertgebouw (ALMOST FINISHED)",
      author: "Gijs",
      warehouseId: "702e13dbca79c53796fa299c99288367",
      landmarkId: "extract_landmarks_626684803",
      landmarkName: "Concertgebouw",
      address: "Amsterdam, the Netherlands, Europe",
      anchor: [
        4.879062953458586,
        52.35618133090705
      ],
      footprint: {
        centre: [
          4.878993599624139,
          52.3562349750812
        ],
        headingDegrees: 57.53032726644909,
        lengthMetres: 88.76752438404172,
        widthMetres: 64.43221798070718
      },
      anchorToLandmarkMetres: 36.5
    }
  ];

  // src/canalRecall/landmarks/manualCatalogue.json
  var manualCatalogue_default = [
    {
      id: "van-gogh-museum",
      name: "Van Gogh Museum",
      landmarkId: "extract_landmarks_2070637412",
      modelUrl: "./models/van-gogh-museum.glb",
      suppressOsmIds: [
        "r6577680"
      ],
      footprint: {
        centre: [
          4.881046973181264,
          52.35839801249034
        ],
        headingDegrees: 147.75744680394797,
        lengthMetres: 59.00779161686317,
        widthMetres: 52.127957130108186
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Van Gogh Museum",
        author: "Map Recall",
        sourceUrl: "https://www.vangoghmuseum.nl/nl/over/organisatie/het-gebouw",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour low-poly reconstruction using visual references and OpenStreetMap footprint alignment. Approximate architectural dimensions, no reference image textures or imported geometry."
      }
    },
    {
      id: "stedelijk-museum",
      name: "Stedelijk Museum",
      landmarkId: "extract_landmarks_1719479765",
      modelUrl: "./models/stedelijk-museum.glb",
      suppressOsmIds: [
        "w44508819"
      ],
      footprint: {
        centre: [
          4.879830319756338,
          52.35792078508553
        ],
        headingDegrees: 66.37991087111777,
        lengthMetres: 100.85707403797215,
        widthMetres: 82.04982538671491
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Stedelijk Museum",
        author: "Map Recall",
        sourceUrl: "https://www.benthemcrouwel.com/projects/stedelijk-museum",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour low-poly reconstruction using visual references and OpenStreetMap footprint alignment. Approximate architectural dimensions, no reference image textures or imported geometry."
      }
    },
    {
      id: "adam-tower",
      name: "A\u2019DAM Tower",
      landmarkId: "adam-tower",
      modelUrl: "./models/adam-tower.glb",
      suppressOsmIds: [
        "w44824385"
      ],
      footprint: {
        centre: [
          4.902217394449075,
          52.383774274858496
        ],
        headingDegrees: 139.08611969097242,
        lengthMetres: 62.381961899454694,
        widthMetres: 36.20922563625085
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "A\u2019DAM Tower",
        author: "Map Recall",
        sourceUrl: "https://adamtoren.nl/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour low-poly reconstruction using visual references and OpenStreetMap footprint alignment. Approximate architectural dimensions, no reference image textures or imported geometry."
      }
    },
    {
      id: "pontsteiger",
      name: "Pontsteiger",
      landmarkId: "pontsteiger",
      modelUrl: "./models/pontsteiger.glb",
      suppressOsmIds: [
        "r13123696"
      ],
      footprint: {
        centre: [
          4.886200223567619,
          52.39323956218515
        ],
        headingDegrees: 139.67770384126857,
        lengthMetres: 89.26245888721829,
        widthMetres: 87.17557208386057
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Pontsteiger",
        author: "Map Recall",
        sourceUrl: "https://arcam.nl/architectuur-gids/pontsteiger/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour low-poly reconstruction using visual references and OpenStreetMap footprint alignment. Approximate architectural dimensions, no reference image textures or imported geometry."
      }
    },
    {
      id: "oba-oosterdok",
      name: "OBA Oosterdok",
      landmarkId: "extract_landmarks_751632752",
      modelUrl: "./models/oba-oosterdok.glb",
      suppressOsmIds: [
        "w1487606300",
        "w1487606301",
        "w1487606302",
        "w1487606303",
        "w1487606304",
        "w1487606305",
        "w1487606306",
        "w1487606307",
        "w1487606308",
        "w1487606309",
        "w1487606310",
        "w1487606311"
      ],
      footprint: {
        centre: [
          4.908303881212726,
          52.37600837944057
        ],
        headingDegrees: 172.17112613676915,
        lengthMetres: 64.40470560623255,
        widthMetres: 38.70079461141226
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "OBA Oosterdok",
        author: "Map Recall",
        sourceUrl: "https://oba.nl/nl/locaties/oba-oosterdok",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free native surveyed model: pale limestone portal and thin cantilever canopy, recessed cedar square window bays, glass plinth and stairs, open side terraces, stepped restaurant/theatre roofs and separate north stair core. Current OSM footprint parts own scope; model scale1. Upper facade arrangements and roof thickness approximate from architect photographs; no imported mesh or photo pixels."
      },
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.908303881212726,
          52.37600837944057
        ],
        northOffsetDegrees: 0,
        source: "Current OSM twelve exact building parts, native east/south; BAG envelope shared with college is intentionally not suppressed."
      }
    },
    {
      id: "rem-eiland",
      name: "REM-eiland",
      landmarkId: "rem-eiland",
      modelUrl: "./models/rem-eiland.glb",
      suppressOsmIds: [
        "w169906479",
        "NL.IMBAG.Pand.0363100012238479"
      ],
      footprint: {
        centre: [
          4.883275104301525,
          52.39872817898343
        ],
        headingDegrees: 140.85611828259619,
        lengthMetres: 26.055565349606344,
        widthMetres: 12.011365706204316
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "REM-eiland",
        author: "Map Recall",
        sourceUrl: "https://www.remeiland.nl/nl/historie",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour low-poly reconstruction using visual references and OpenStreetMap footprint alignment. Approximate architectural dimensions, no reference image textures or imported geometry."
      },
      surveyed: {
        anchor: [
          4.883275104301525,
          52.39872817898343
        ],
        northOffsetDegrees: 50.856118282596185,
        source: "Existing native OSM w169906479 footprint centre and heading; current ref:bag 0363100012238479 verified 2026-10-06. Stair appendages do not rescale the platform."
      },
      spatialSuppression: false
    },
    {
      id: "paradiso",
      name: "Paradiso",
      landmarkId: "paradiso",
      modelUrl: "./models/paradiso.glb",
      suppressOsmIds: [
        "w57857350"
      ],
      footprint: {
        centre: [
          4.883800679368446,
          52.36216899080454
        ],
        headingDegrees: 37.75613184714064,
        lengthMetres: 38.545097684005455,
        widthMetres: 20.61145838101024
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Paradiso",
        author: "Map Recall",
        sourceUrl: "https://www.paradiso.nl/en/info/about-us/paradiso-vandaag",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour low-poly reconstruction using visual references and OpenStreetMap footprint alignment. Approximate architectural dimensions, no reference image textures or imported geometry."
      }
    },
    {
      id: "melkweg",
      name: "Melkweg",
      landmarkId: "extract_landmarks_1586263374",
      modelUrl: "./models/melkweg.glb",
      suppressOsmIds: [
        "w267565714"
      ],
      footprint: {
        centre: [
          4.881114921160033,
          52.36474434271804
        ],
        headingDegrees: 140.28036879963844,
        lengthMetres: 49.67162760006897,
        widthMetres: 35.589591569044984
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Melkweg",
        author: "Map Recall",
        sourceUrl: "https://www.melkweg.nl/en/info/about-us/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour low-poly reconstruction using visual references and OpenStreetMap footprint alignment. Approximate architectural dimensions, no reference image textures or imported geometry."
      }
    },
    {
      id: "embassy-free-mind",
      name: "Embassy of the Free Mind",
      landmarkId: "extract_landmarks_740511540",
      relatedLandmarkIds: [
        "extract_landmarks_554373448"
      ],
      modelUrl: "./models/embassy-free-mind.glb",
      suppressOsmIds: [
        "w266604553"
      ],
      footprint: {
        centre: [
          4.887456462723575,
          52.37638237926428
        ],
        headingDegrees: 119.43055315122695,
        lengthMetres: 19.34692195663892,
        widthMetres: 17.000397123090277
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 270,
      attribution: {
        title: "Embassy of the Free Mind",
        author: "Map Recall",
        sourceUrl: "https://www.embassyofthefreemind.com/house-with-the-heads",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      },
      spatialSuppression: false
    },
    {
      id: "the-movies",
      name: "The Movies",
      landmarkId: "extract_landmarks_1215417346",
      modelUrl: "./models/the-movies.glb",
      suppressOsmIds: [
        "w266597659"
      ],
      footprint: {
        centre: [
          4.88449931907834,
          52.38388108169651
        ],
        headingDegrees: 42.500973669600626,
        lengthMetres: 37.318300814398086,
        widthMetres: 17.236152679607894
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "The Movies",
        author: "Map Recall",
        sourceUrl: "https://themovies.nl/special/the-movies-renoveert-2/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      }
    },
    {
      id: "delamar",
      name: "DeLaMar",
      landmarkId: "extract_landmarks_984169544",
      modelUrl: "./models/delamar.glb",
      suppressOsmIds: [
        "w267565782"
      ],
      footprint: {
        centre: [
          4.880400054157671,
          52.36434979965863
        ],
        headingDegrees: 37.39619010728296,
        lengthMetres: 64.0719941600419,
        widthMetres: 57.92999384246876
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "DeLaMar",
        author: "Map Recall",
        sourceUrl: "https://delamar.nl/en/business/about-us/history/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      }
    },
    {
      id: "magna-plaza",
      name: "Magna Plaza",
      landmarkId: "magna-plaza",
      modelUrl: "./models/magna-plaza.glb",
      suppressOsmIds: [
        "w57861220"
      ],
      footprint: {
        centre: [
          4.890243858773726,
          52.373625430653085
        ],
        headingDegrees: 19.41044315188728,
        lengthMetres: 80.34979895320416,
        widthMetres: 36.56344566440207
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Magna Plaza",
        author: "Map Recall",
        sourceUrl: "https://www.magnaplaza.nl/the-story-behind-magna-plaza/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      }
    },
    {
      id: "felix-meritis",
      name: "Felix Meritis",
      landmarkId: "extract_landmarks_2044416411",
      modelUrl: "./models/felix-meritis.glb",
      suppressOsmIds: [
        "w30044304"
      ],
      footprint: {
        centre: [
          4.883664696612664,
          52.36999669819762
        ],
        headingDegrees: 93.27205563832936,
        lengthMetres: 86.01825038403021,
        widthMetres: 22.923712728591294
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Felix Meritis",
        author: "Map Recall",
        sourceUrl: "https://felixmeritis.nl/over-felix-meritis/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      }
    },
    {
      id: "kleine-komedie",
      name: "De Kleine Komedie",
      landmarkId: "extract_landmarks_916929647",
      modelUrl: "./models/kleine-komedie.glb",
      suppressOsmIds: [
        "w267116750"
      ],
      footprint: {
        centre: [
          4.896025822037456,
          52.36678815648692
        ],
        headingDegrees: 174.06110855527527,
        lengthMetres: 33.76302592451122,
        widthMetres: 24.22524092603205
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 270,
      attribution: {
        title: "De Kleine Komedie",
        author: "Map Recall",
        sourceUrl: "https://www.dekleinekomedie.nl/over-de-kleine-komedie-q9t1",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      }
    },
    {
      id: "de-balie",
      name: "De Balie",
      landmarkId: "extract_landmarks_1675243450",
      modelUrl: "./models/de-balie.glb",
      suppressOsmIds: [
        "w114538342"
      ],
      footprint: {
        centre: [
          4.882893998003039,
          52.3630001538405
        ],
        headingDegrees: 60.2484903518546,
        lengthMetres: 44.743762978920266,
        widthMetres: 33.664517593624694
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "De Balie",
        author: "Map Recall",
        sourceUrl: "https://debalie.nl/geschiedenis/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      }
    },
    {
      id: "anne-frank-house",
      name: "Anne Frank House",
      landmarkId: "extract_landmarks_614625734",
      modelUrl: "./models/anne-frank-house.glb",
      suppressOsmIds: [
        "w266616469"
      ],
      footprint: {
        centre: [
          4.884199790545408,
          52.37526883046758
        ],
        headingDegrees: 209.51208512104333,
        lengthMetres: 5.7829377506704365,
        widthMetres: 24.06129202854212
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Anne Frank House",
        author: "Map Recall",
        sourceUrl: "https://www.annefrank.org/en/anne-frank/front-section/prinsengracht-263/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour reconstruction guided by museum photographs and OpenStreetMap building geometry. Historic building only; adjoining museum extensions and neighboring houses retain their own geometry."
      },
      surveyed: {
        anchor: [
          4.884199790545408,
          52.37526883046758
        ],
        northOffsetDegrees: 119.51208512104333
      },
      spatialSuppression: false
    },
    {
      id: "rembrandt-house",
      name: "Rembrandt House",
      landmarkId: "extract_landmarks_25101431",
      modelUrl: "./models/rembrandt-house.glb",
      suppressOsmIds: [
        "w268782575"
      ],
      footprint: {
        centre: [
          4.9012522,
          52.369299500000004
        ],
        headingDegrees: 304.19839036962065,
        lengthMetres: 16.397795731819166,
        widthMetres: 17.55161456163473
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Rembrandt House",
        author: "Map Recall",
        sourceUrl: "https://www.rembrandthuis.nl/en/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour reconstruction guided by museum photographs and OpenStreetMap building geometry. Historic building only; adjoining museum extensions and neighboring houses retain their own geometry."
      },
      surveyed: {
        anchor: [
          4.9012522,
          52.369299500000004
        ],
        northOffsetDegrees: 214.19839036962065
      },
      spatialSuppression: false
    },
    {
      id: "moco-museum",
      name: "Moco Museum",
      landmarkId: "extract_landmarks_1523176628",
      modelUrl: "./models/moco-museum.glb",
      suppressOsmIds: [
        "w277108702"
      ],
      footprint: {
        centre: [
          4.881916866090669,
          52.35869759396733
        ],
        headingDegrees: 149.38748131134253,
        lengthMetres: 22.562529441173467,
        widthMetres: 15.58665338562756
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Moco Museum",
        author: "Map Recall",
        sourceUrl: "https://www.mocomuseum.com/amsterdam/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour reconstruction guided by museum photographs and OpenStreetMap building geometry. Historic building only; adjoining museum extensions and neighboring houses retain their own geometry."
      },
      surveyed: {
        anchor: [
          4.881916866090669,
          52.35869759396733
        ],
        northOffsetDegrees: 59.387481311342526
      },
      spatialSuppression: false
    },
    {
      id: "museum-van-loon",
      name: "Museum Van Loon",
      landmarkId: "extract_landmarks_211818595",
      modelUrl: "./models/museum-van-loon.glb",
      suppressOsmIds: [
        "w268283622"
      ],
      footprint: {
        centre: [
          4.893349043681814,
          52.36338835201399
        ],
        headingDegrees: 282.3449814578558,
        lengthMetres: 14.896446612910355,
        widthMetres: 22.823605180965057
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Museum Van Loon",
        author: "Map Recall",
        sourceUrl: "https://www.museumvanloon.nl/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour reconstruction guided by museum photographs and OpenStreetMap building geometry. Historic building only; adjoining museum extensions and neighboring houses retain their own geometry."
      },
      surveyed: {
        anchor: [
          4.893349043681814,
          52.36338835201399
        ],
        northOffsetDegrees: 192.3449814578558
      },
      spatialSuppression: false
    },
    {
      id: "amstelkerk",
      name: "Amstelkerk",
      landmarkId: "extract_landmarks_444968372",
      modelUrl: "./models/amstelkerk.glb",
      suppressOsmIds: [
        "w57862594"
      ],
      footprint: {
        centre: [
          4.896631258458023,
          52.36231406217453
        ],
        headingDegrees: 162.77460287081203,
        lengthMetres: 32.33797500418897,
        widthMetres: 28.68211205174098
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Amstelkerk",
        author: "Map Recall",
        sourceUrl: "https://stadsherstel.nl/monumenten/de-amstelkerk/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      }
    },
    {
      id: "he-hua-temple",
      name: "Fo Guang Shan He Hua Temple",
      landmarkId: "extract_landmarks_944681607",
      modelUrl: "./models/he-hua-temple.glb",
      suppressOsmIds: [
        "w267091468"
      ],
      footprint: {
        centre: [
          4.900066205093341,
          52.373727761786604
        ],
        headingDegrees: 4.424469025937611,
        lengthMetres: 38.46371394807869,
        widthMetres: 15.688531853006925
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Fo Guang Shan He Hua Temple",
        author: "Map Recall",
        sourceUrl: "https://ibps.nl/he-hua-temple/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      }
    },
    {
      id: "haarlemmerpoort",
      name: "Haarlemmerpoort",
      landmarkId: "extract_landmarks_498862002",
      modelUrl: "./models/haarlemmerpoort.glb",
      suppressOsmIds: [
        "w33202039"
      ],
      footprint: {
        centre: [
          4.883079796368743,
          52.384966999977514
        ],
        headingDegrees: 42.81534677084582,
        lengthMetres: 35.36444542075912,
        widthMetres: 19.964773212277446
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Haarlemmerpoort",
        author: "Map Recall",
        sourceUrl: "https://stadsherstel.nl/monumenten/haarlemmerpoort/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      }
    },
    {
      id: "het-schip",
      name: "Museum Het Schip",
      landmarkId: "extract_landmarks_975578776",
      modelUrl: "./models/het-schip.glb",
      suppressOsmIds: [
        "w57857095",
        "w274039865",
        "w274039880",
        "w274039890",
        "w274039928",
        "w274039961",
        "w274039965",
        "w274039970",
        "w274040061",
        "w274040252",
        "w274040255",
        "w274040262",
        "w274040271",
        "w274040276",
        "w274040281",
        "w274040284",
        "w274040290",
        "w274040293",
        "w274040296",
        "w274040305",
        "w274040311",
        "w274040314",
        "w274040317",
        "w274040326",
        "w274040331",
        "w274040334",
        "w274040338",
        "w274040342",
        "w274040348",
        "w274040351",
        "w274040357",
        "w274040362",
        "w274040371",
        "w274040375",
        "w274040415",
        "w274040419",
        "w274040437",
        "w274040452",
        "w274040559",
        "w274040564"
      ],
      footprint: {
        centre: [
          4.8734670680245165,
          52.3902157496525
        ],
        headingDegrees: 153.90696093135256,
        lengthMetres: 115.22286870841877,
        widthMetres: 66.04156587363654
      },
      surveyed: {
        anchor: [
          4.8734670680245165,
          52.3902157496525
        ],
        northOffsetDegrees: 0
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Museum Het Schip",
        author: "Map Recall",
        sourceUrl: "https://www.hetschip.nl/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly architectural reconstruction. Exact OpenStreetMap building polygons retain courtyards and offsets; heights and sculptural details are approximated from building tags and photographs."
      },
      spatialSuppression: false
    },
    {
      id: "scheepvaarthuis",
      name: "Scheepvaarthuis",
      landmarkId: "scheepvaarthuis",
      modelUrl: "./models/scheepvaarthuis.glb",
      suppressOsmIds: [
        "w57863677"
      ],
      footprint: {
        centre: [
          4.903908332712785,
          52.37432204329201
        ],
        headingDegrees: 132.30446233848764,
        lengthMetres: 76.97848116218616,
        widthMetres: 66.4167813949489
      },
      surveyed: {
        anchor: [
          4.903908332712785,
          52.37432204329201
        ],
        northOffsetDegrees: 0
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Scheepvaarthuis",
        author: "Map Recall",
        sourceUrl: "https://www.amrathamsterdam.com/en/information/history/the-scheepvaarthuis",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly architectural reconstruction. Exact OpenStreetMap building polygons retain courtyards and offsets; heights and sculptural details are approximated from building tags and photographs."
      },
      spatialSuppression: false
    },
    {
      id: "rialto",
      name: "Rialto",
      landmarkId: "extract_landmarks_1428677427",
      modelUrl: "./models/rialto.glb",
      suppressOsmIds: [
        "w277244583"
      ],
      footprint: {
        centre: [
          4.89396640278434,
          52.35291910893182
        ],
        headingDegrees: 167.64151226366334,
        lengthMetres: 24.608901125734388,
        widthMetres: 12.087697796837961
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 180,
      attribution: {
        title: "Rialto",
        author: "Map Recall",
        sourceUrl: "https://depijp.rialtofilm.nl/en/information/about-rialto",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      },
      surveyed: {
        anchor: [
          4.89396640278434,
          52.35291910893182
        ],
        northOffsetDegrees: 257.64151226366334,
        source: "OSM building w277244583 footprint, short north-facing Ceintuurbaan facade"
      },
      spatialSuppression: false
    },
    {
      id: "kriterion",
      name: "Kriterion",
      landmarkId: "extract_landmarks_1605152135",
      modelUrl: "./models/kriterion.glb",
      suppressOsmIds: [
        "w268999077"
      ],
      footprint: {
        centre: [
          4.910484137908315,
          52.36263900277887
        ],
        headingDegrees: 161.44363710419276,
        lengthMetres: 45.2242965083953,
        widthMetres: 30.547694670912293
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 270,
      attribution: {
        title: "Kriterion",
        author: "Map Recall",
        sourceUrl: "https://www.stichtingkriterion.nl/geschiedenis",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      },
      surveyed: {
        anchor: [
          4.910484137908315,
          52.36263900277887
        ],
        northOffsetDegrees: 251.44363710419276,
        source: "OSM building w268999077 polygon, east-facing Roetersstraat street house"
      },
      spatialSuppression: false
    },
    {
      id: "de-bijenkorf",
      name: "De Bijenkorf",
      landmarkId: "de-bijenkorf",
      modelUrl: "./models/de-bijenkorf.glb",
      suppressOsmIds: [
        "w23582490",
        "w751128372",
        "w751128373",
        "w751128376",
        "w751128377",
        "w751128378",
        "w751128379",
        "w751128380",
        "w751128381",
        "w751128382",
        "w751128383",
        "w751128384",
        "w751128385",
        "w751235773",
        "w751235774",
        "w751235775",
        "w751235776",
        "w751235777",
        "w751235778",
        "w751235779",
        "w751235780",
        "NL.IMBAG.Pand.0363100012168052",
        "w751128374",
        "w751128375"
      ],
      footprint: {
        centre: [
          4.894352481530528,
          52.373581327421924
        ],
        headingDegrees: 39.69686744069807,
        lengthMetres: 111.74151268014535,
        widthMetres: 39.11553890323157
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 270,
      attribution: {
        title: "De Bijenkorf",
        author: "Map Recall",
        sourceUrl: "https://www.cultureelerfgoeddebijenkorf.nl/architectuur/bouwfasesamsterdam",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction of full historic Damrak and Dam fronts, curved pediments, mansard dormers, paired-window/pilaster rhythm, surveyed cupola and separate rear extension. Supplied SketchUp preview used as visual reference only; no imported mesh or texture."
      },
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.8943519,
          52.3736161
        ],
        northOffsetDegrees: 129.69686744069807,
        source: "Current BAG0363100012168052 and OSM original store/roof parts; native scale1, +Z Damrak frontage309.697 degrees, +X Dam end219.697 degrees. Original historic roof/facades reconciled with primary RCE518426 and 3DBAG AHN roof envelope (cupola45.43m above ground)."
      }
    },
    {
      id: "gashouder",
      name: "Gashouder",
      landmarkId: "gashouder",
      modelUrl: "./models/gashouder.glb",
      suppressOsmIds: [
        "w57865152",
        "w1488057568",
        "w1488057569",
        "w1488057570",
        "w1488057571",
        "w1488057572",
        "w1488057573"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.868872884498755,
          52.386820591571
        ],
        headingDegrees: 77.7474623915898,
        lengthMetres: 74.73646232909658,
        widthMetres: 65.55857175817337
      },
      surveyed: {
        anchor: [
          4.868872884498755,
          52.386820591571
        ],
        northOffsetDegrees: 0
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Gashouder",
        author: "Map Recall",
        sourceUrl: "https://gashouder.nl/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour low-poly reconstruction using museum and venue photographs for architectural silhouette and OpenStreetMap polygons for placement. Includes the full mapped venue footprint; dimensions and roof ornament are approximate."
      }
    },
    {
      id: "stadsschouwburg",
      name: "Stadsschouwburg Amsterdam",
      landmarkId: "extract_landmarks_1939633952",
      modelUrl: "./models/stadsschouwburg.glb",
      suppressOsmIds: [
        "w57863115",
        "NL.IMBAG.Pand.0363100012168738"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.881898232685734,
          52.36435694049734
        ],
        headingDegrees: 52.40783486526533,
        lengthMetres: 54.077617043745775,
        widthMetres: 104.27101523772704
      },
      surveyed: {
        anchor: [
          4.881898232685734,
          52.36435694049734
        ],
        northOffsetDegrees: -37.59216513473467
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Stadsschouwburg Amsterdam",
        author: "Map Recall",
        sourceUrl: "https://ita.nl/nl/stadsschouwburg-amsterdam/geschiedenis-van-het-huis",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour low-poly reconstruction using museum and venue photographs for architectural silhouette and OpenStreetMap polygons for placement. Includes the full mapped venue footprint; dimensions and roof ornament are approximate."
      }
    },
    {
      id: "tuschinski",
      name: "Path\xE9 Tuschinski",
      landmarkId: "extract_landmarks_1697896624",
      modelUrl: "./models/tuschinski.glb",
      suppressOsmIds: [
        "w267116768"
      ],
      footprint: {
        centre: [
          4.89452384707487,
          52.366265889625566
        ],
        headingDegrees: 22.491832353133248,
        lengthMetres: 64.08757870689,
        widthMetres: 36.59157632446773
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 3.5081676468667524,
      attribution: {
        title: "Path\xE9 Tuschinski",
        author: "Map Recall",
        sourceUrl: "https://pers.pathe.nl/koninklijk-theater-tuschinski/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      },
      surveyed: {
        anchor: [
          4.89452384707487,
          52.366265889625566
        ],
        northOffsetDegrees: 0,
        source: "OSM w267116768 outline and repository measured Reguliersbreestraat front; local east/south metres"
      },
      spatialSuppression: false
    },
    {
      id: "pathe-city",
      name: "Path\xE9 City",
      landmarkId: "extract_landmarks_798381271",
      modelUrl: "./models/pathe-city.glb",
      suppressOsmIds: [
        "w267565634"
      ],
      footprint: {
        centre: [
          4.88399306215679,
          52.36346037602056
        ],
        headingDegrees: 139.45829105802886,
        lengthMetres: 37.33397539170063,
        widthMetres: 36.529338631103656
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Path\xE9 City",
        author: "Map Recall",
        sourceUrl: "https://www.pathe.nl/en/cinemas/pathe-city",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official venue imagery; approximate architectural details aligned to the OpenStreetMap building footprint."
      },
      spatialSuppression: false
    },
    {
      id: "oude-kerk",
      name: "Oude Kerk",
      landmarkId: "extract_landmarks_1522513904",
      modelUrl: "./models/oude-kerk.glb",
      suppressOsmIds: [
        "w57857592",
        "w747868970",
        "w747868971",
        "w747868972",
        "w747868973",
        "w747868974",
        "w747868975",
        "w747868976",
        "w747868977",
        "w747868978",
        "w747868979",
        "w747868980",
        "w747868981",
        "w747868982",
        "w747868984"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.898072331391026,
          52.374357755718066
        ],
        headingDegrees: 86.48218640835745,
        lengthMetres: 81.97608859440939,
        widthMetres: 63.9732853832862
      },
      surveyed: {
        anchor: [
          4.89807215,
          52.37436065
        ],
        northOffsetDegrees: 0
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Oude Kerk",
        author: "Map Recall",
        sourceUrl: "https://www.oudekerk.nl/nu-te-zien/evenementen/bezoek-oudekerkstoren/39591",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free Gothic reconstruction using museum photographic references and actual OpenStreetMap church/chapel/tower polygons. Surveyed placement in metres; decorative tracery and roof details are approximate."
      }
    },
    {
      id: "nieuwe-kerk",
      name: "Nieuwe Kerk",
      landmarkId: "extract_landmarks_239964759",
      modelUrl: "./models/nieuwe-kerk.glb",
      suppressOsmIds: [
        "w220749328",
        "w174987150",
        "w747911435",
        "w747911436",
        "w747911437",
        "w747911438",
        "w747911439",
        "w747911440",
        "w747911441",
        "w747924617",
        "w747924618",
        "w747924619",
        "w747924621",
        "w747924622",
        "w747924623",
        "w747924624",
        "w747924625",
        "w747924626",
        "w748997143",
        "w748997144",
        "NL.IMBAG.Pand.0363100012169079"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.891777577968536,
          52.37394620723149
        ],
        headingDegrees: 90,
        lengthMetres: 94.96254563554697,
        widthMetres: 66.11294799981863
      },
      surveyed: {
        anchor: [
          4.891777577968536,
          52.37394620723149
        ],
        northOffsetDegrees: 0,
        source: "Native current parent and mapped church/chapel/tourelle parts; source roofs and 34m tourelles preserved, approximate 46m crossing finial retained."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Nieuwe Kerk",
        author: "Map Recall",
        sourceUrl: "https://www.nieuwekerk.nl/pers/beeldbank/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free Gothic stone-striped brick church rebuilt from exact current roof/chapel polygons and official church exterior/restoration photos. Pointed tracery, rose, portals, balustrades, mapped tourelles and gilded crossing finial approximated with shared-palette meshes; no imported geometry or copied photograph pixels. Adjacent Palace, shops and streets retained."
      }
    },
    {
      id: "buiksloterkerk",
      name: "Buiksloterkerk",
      landmarkId: "extract_landmarks_1198118755",
      modelUrl: "./models/buiksloterkerk.glb",
      suppressOsmIds: [
        "w44825314"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.916339590226489,
          52.40181965170745
        ],
        headingDegrees: 85.98901818904636,
        lengthMetres: 32.25158238481576,
        widthMetres: 17.735686367161463
      },
      surveyed: {
        anchor: [
          4.916339590226489,
          52.40181965170745
        ],
        northOffsetDegrees: 0,
        source: "Actual OSM church outline and tower part; local east/south metre coordinates"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Buiksloterkerk",
        author: "Map Recall",
        sourceUrl: "https://buiksloterkerk.nl/gebouw/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction from official church photographs and OSM footprints (ODbL). Mapped maximum height from 3DBAG; wall/roof division and decorative details approximate. No reference pixels or model geometry imported."
      }
    },
    {
      id: "english-reformed-church",
      name: "English Reformed Church",
      landmarkId: "extract_landmarks_1187067601",
      modelUrl: "./models/english-reformed-church.glb",
      suppressOsmIds: [
        "w57858493",
        "w1425764020"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.890147908845572,
          52.36934141794237
        ],
        headingDegrees: 74.7564361014704,
        lengthMetres: 36.964534844831036,
        widthMetres: 17.897307676559574
      },
      surveyed: {
        anchor: [
          4.890147908845572,
          52.36934141794237
        ],
        northOffsetDegrees: 0,
        source: "Actual OSM church outline and tower part; local east/south metre coordinates"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "English Reformed Church",
        author: "Map Recall",
        sourceUrl: "https://www.erc.amsterdam/about",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction from official church photographs and OSM footprints (ODbL). Mapped maximum height from 3DBAG; wall/roof division and decorative details approximate. No reference pixels or model geometry imported."
      }
    },
    {
      id: "de-papegaai",
      name: "De Papegaai",
      landmarkId: "extract_landmarks_1601841225",
      modelUrl: "./models/de-papegaai.glb",
      suppressOsmIds: [
        "w266903909"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8914874867156035,
          52.3712251052276
        ],
        headingDegrees: 65.28136792399175,
        lengthMetres: 50.0801457619763,
        widthMetres: 23.700591646413127
      },
      surveyed: {
        anchor: [
          4.8914874867156035,
          52.3712251052276
        ],
        northOffsetDegrees: 0,
        source: "Actual OSM church outline and tower part; local east/south metre coordinates"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "De Papegaai",
        author: "Map Recall",
        sourceUrl: "https://www.nicolaas-parochie.nl/papegaai/over-ons/gebouw/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction from official church photographs and OSM footprints (ODbL). Mapped maximum height from 3DBAG; wall/roof division and decorative details approximate. No reference pixels or model geometry imported."
      }
    },
    {
      id: "de-hallen",
      name: "De Hallen / Foodhallen / Filmhallen",
      landmarkId: "extract_landmarks_564717297",
      relatedLandmarkIds: [
        "extract_landmarks_935859030",
        "extract_landmarks_1004895807"
      ],
      modelUrl: "./models/de-hallen.glb",
      suppressOsmIds: [
        "w94517266"
      ],
      footprint: {
        centre: [
          4.868094135610376,
          52.36705123990049
        ],
        headingDegrees: 156.4336677813015,
        lengthMetres: 138.92102637771075,
        widthMetres: 102.3948245125872
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90.00366778130149,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.868094135610376,
          52.36705123990049
        ],
        northOffsetDegrees: 66.4336677813015,
        source: "Actual OSM polygon contours in local east/south metres; courtyard recesses and double-house split preserved."
      },
      attribution: {
        title: "De Hallen / Foodhallen / Filmhallen",
        author: "Map Recall",
        sourceUrl: "https://www.dehallen-amsterdam.nl/historie",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official architectural imagery, with surveyed OpenStreetMap contours; no imported mesh or image textures."
      }
    },
    {
      id: "huis-bartolotti",
      name: "Huis Bartolotti",
      landmarkId: "extract_landmarks_1450151185",
      modelUrl: "./models/huis-bartolotti.glb",
      suppressOsmIds: [
        "w174193863",
        "w266616315"
      ],
      footprint: {
        centre: [
          4.886722670237744,
          52.37412259415594
        ],
        headingDegrees: 106.44208897821662,
        lengthMetres: 31.771102166533325,
        widthMetres: 22.603326969147606
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -6.442088978216617,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.886722670237744,
          52.37412259415594
        ],
        northOffsetDegrees: -80,
        source: "Actual OSM polygon contours in local east/south metres; courtyard recesses and double-house split preserved."
      },
      attribution: {
        title: "Huis Bartolotti",
        author: "Map Recall",
        sourceUrl: "https://www.hendrickdekeyser.nl/de-huizen/huis-bartolotti",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by official architectural imagery, with surveyed OpenStreetMap contours; no imported mesh or image textures."
      }
    },
    {
      id: "hart-museum",
      name: "H'ART Museum \u2014 Amstelhof",
      landmarkId: "extract_landmarks_352379234",
      modelUrl: "./models/hart-museum.glb",
      suppressOsmIds: [
        "r3604193",
        "NL.IMBAG.Pand.0363100012165553"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.902899923436612,
          52.36539923653881
        ],
        headingDegrees: 162.6932525153169,
        lengthMetres: 102.78905473145181,
        widthMetres: 80.97941766115503
      },
      surveyed: {
        anchor: [
          4.902899923436612,
          52.36539923653881
        ],
        northOffsetDegrees: 72.7
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "H'ART Museum \u2014 Amstelhof",
        author: "Map Recall",
        sourceUrl: "https://www.hartmuseum.nl/en/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of the mapped historic museum complex and genuine open courtyard. Actual OpenStreetMap relation polygon retained; original window, hip-roof, dormer and gate geometry informed by official museum photographs. Dimensions and ornament approximate; future renovation volumes are not represented."
      }
    },
    {
      id: "amsterdam-museum",
      name: "Amsterdam Museum \u2014 Burgerweeshuis",
      landmarkId: "extract_landmarks_2083029836",
      modelUrl: "./models/amsterdam-museum.glb",
      suppressOsmIds: [
        "r3583133",
        "NL.IMBAG.Pand.0363100012168198"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.890522675661112,
          52.37023504304229
        ],
        headingDegrees: 73.00211651228418,
        lengthMetres: 120.66940764415725,
        widthMetres: 71.720449445128
      },
      surveyed: {
        anchor: [
          4.890522675661112,
          52.37023504304229
        ],
        northOffsetDegrees: 72.7
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 9.997883487715825,
      attribution: {
        title: "Amsterdam Museum \u2014 Burgerweeshuis",
        author: "Map Recall",
        sourceUrl: "https://www.amsterdammuseum.nl/en/het-nieuwe-amsterdam-museum",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of the mapped historic museum complex and genuine open courtyard. Actual OpenStreetMap relation polygon retained; original window, hip-roof, dormer and gate geometry informed by official museum photographs. Dimensions and ornament approximate; future renovation volumes are not represented."
      }
    },
    {
      id: "national-holocaust-museum",
      name: "National Holocaust Museum",
      landmarkId: "extract_landmarks_1327496450",
      modelUrl: "./models/national-holocaust-museum.glb",
      suppressOsmIds: [
        "r3604241",
        "NL.IMBAG.Pand.0363100012165551",
        "NL.IMBAG.Pand.0363100012247157"
      ],
      footprint: {
        centre: [
          4.911270057976236,
          52.366984398405435
        ],
        headingDegrees: 29.778712634106,
        lengthMetres: 46.683565196739146,
        widthMetres: 44.31436936593857
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 179.221287365894,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.911270057976236,
          52.366984398405435
        ],
        northOffsetDegrees: 29,
        source: "Current PDOK BAG polygon contours; surveyed plan retains courtyard holes and explicitly identified contextual nursery."
      },
      attribution: {
        title: "National Holocaust Museum",
        author: "Map Recall",
        sourceUrl: "https://www.winhov.com/en/projects/national-holocaust-museum/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by Office Winhov and museum official imagery; current BAG contours fetched 2026-10-04, no imported meshes/textures."
      }
    },
    {
      id: "hollandsche-schouwburg",
      name: "Hollandsche Schouwburg",
      landmarkId: "extract_landmarks_1588171596",
      modelUrl: "./models/hollandsche-schouwburg.glb",
      suppressOsmIds: [
        "w269009084",
        "NL.IMBAG.Pand.0363100012180950"
      ],
      footprint: {
        centre: [
          4.911038960823893,
          52.36635690328413
        ],
        headingDegrees: 29.417858823710475,
        lengthMetres: 34.30706097325767,
        widthMetres: 15.904390015706582
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -0.4178588237104748,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.911038960823893,
          52.36635690328413
        ],
        northOffsetDegrees: 209,
        source: "Current PDOK BAG polygon contours; surveyed plan retains courtyard holes and explicitly identified contextual nursery."
      },
      attribution: {
        title: "Hollandsche Schouwburg",
        author: "Map Recall",
        sourceUrl: "https://www.winhov.com/en/projects/national-holocaust-museum/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction guided by Office Winhov and museum official imagery; current BAG contours fetched 2026-10-04, no imported meshes/textures."
      }
    },
    {
      id: "jewish-museum",
      name: "Jewish Museum \u2014 four synagogues",
      landmarkId: "extract_landmarks_273619808",
      modelUrl: "./models/jewish-museum.glb",
      suppressOsmIds: [
        "w57857987",
        "NL.IMBAG.Pand.0363100012182037",
        "w268783367",
        "NL.IMBAG.Pand.0363100012182038"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.903832029030724,
          52.367121119501086
        ],
        headingDegrees: 152.62263086955193,
        lengthMetres: 49.95563109474972,
        widthMetres: 41.556824510722855
      },
      surveyed: {
        anchor: [
          4.903832029030724,
          52.367121119501086
        ],
        northOffsetDegrees: 242.62263086955193
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90.00000000000003,
      attribution: {
        title: "Jewish Museum",
        author: "Map Recall",
        sourceUrl: "https://jck.nl/en/location/jewish-museum",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of the surveyed historic synagogue complex from actual OpenStreetMap polygons and official Jewish Cultural Quarter exterior photographs. Separate historic roof volumes, arched windows, classical stone cornices and entrance details; Esnoga courtyard kept open. Heights and ornament approximate."
      }
    },
    {
      id: "portuguese-synagogue",
      name: "Portuguese Synagogue \u2014 Esnoga",
      landmarkId: "extract_landmarks_1311905515",
      modelUrl: "./models/portuguese-synagogue.glb",
      suppressOsmIds: [
        "w57861363",
        "NL.IMBAG.Pand.0363100012170255",
        "w268783311",
        "NL.IMBAG.Pand.0363100012170258",
        "w268783350",
        "NL.IMBAG.Pand.0363100012170254",
        "w268783384",
        "NL.IMBAG.Pand.0363100012170253",
        "w268783415",
        "NL.IMBAG.Pand.0363100012181882"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.905113942222338,
          52.36760831616318
        ],
        headingDegrees: 119.70503311355918,
        lengthMetres: 80.01812229172724,
        widthMetres: 43.48098484850878
      },
      surveyed: {
        anchor: [
          4.905113942222338,
          52.36760831616318
        ],
        northOffsetDegrees: 28.672090322555675
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 204.29496688644082,
      attribution: {
        title: "Portuguese Synagogue",
        author: "Map Recall",
        sourceUrl: "https://jck.nl/en/press/beeldmateriaal/portuguese-synagogue",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of the surveyed historic synagogue complex from actual OpenStreetMap polygons and official Jewish Cultural Quarter exterior photographs. Separate historic roof volumes, arched windows, classical stone cornices and entrance details; Esnoga courtyard kept open. Heights and ornament approximate."
      }
    },
    {
      id: "homomonument",
      name: "Homomonument",
      assetKind: "memorial",
      landmarkId: "extract_landmarks_7630368",
      modelUrl: "./models/homomonument.glb",
      suppressOsmIds: [
        "w37737807"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8846925,
          52.37443243333333
        ],
        headingDegrees: 90,
        lengthMetres: 34.72792283999182,
        widthMetres: 35.65579599983266
      },
      surveyed: {
        anchor: [
          4.8846925,
          52.37443243333333
        ],
        northOffsetDegrees: 0,
        source: "Three extreme vertices of the current mapped whole-monument perimeter; local east/south metres: 111320 latitude and 111320*cos(latitude) longitude. Waterside stair-platform tip intentionally extends into Keizersgracht."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Homomonument",
        author: "Map Recall",
        sourceUrl: "https://www.cultureelerfgoed.nl/onderwerpen/p/post-65-erfgoed/verhalen-en-tijdlijnen/beschrijvingen-post-65-objecten/homomonument-amsterdam",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original geometric interpretation of the mapped whole-monument outline and primary RCE overhead photograph. Waterside stair-platform projection into Keizersgracht retained intentionally. OSM maps the whole arrangement, not three individual stone polygons; individual 10 m triangles/heights/stair treads approximate. No surrounding ground or host buildings replaced."
      }
    },
    {
      id: "micropia-ledenlokalen",
      name: "ARTIS Micropia / Ledenlokalen",
      landmarkId: "extract_landmarks_1369065076",
      modelUrl: "./models/micropia-ledenlokalen.glb",
      suppressOsmIds: [
        "w57857205",
        "NL.IMBAG.Pand.0363100012170549"
      ],
      footprint: {
        centre: [
          4.91252702449228,
          52.36671446028425
        ],
        headingDegrees: 29.62256147607775,
        lengthMetres: 78.36566837716668,
        widthMetres: 30.10354919257424
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 269.37743852392225,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.9124796703067215,
          52.3667230808103
        ],
        northOffsetDegrees: 119,
        source: "Current 2021-updated BAG contour including both end pavilions and the built rear conservatory; stale 2014 OSM hall outline is suppressed. Published native origin retained."
      },
      attribution: {
        title: "ARTIS Micropia / Ledenlokalen",
        author: "Map Recall",
        sourceUrl: "https://www.rappange.nl/projecten/ledenlokalen-artis-micropia/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction; no imported meshes or textures. Individual footprints preserve public Artisplein and neighboring Groote Museum."
      }
    },
    {
      id: "artis-entrance",
      name: "ARTIS entrance gate and kiosks",
      landmarkId: "extract_landmarks_2001162595",
      modelUrl: "./models/artis-entrance.glb",
      suppressOsmIds: [
        "w269020382",
        "NL.IMBAG.Pand.0363100012181131",
        "w269020400",
        "NL.IMBAG.Pand.0363100012181128"
      ],
      footprint: {
        centre: [
          4.912695619709629,
          52.36720632230263
        ],
        headingDegrees: 28.93815525735573,
        lengthMetres: 20.421311223951083,
        widthMetres: 3.0659945811082725
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 270.06184474264427,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.912695619709629,
          52.36720632230263
        ],
        northOffsetDegrees: 119,
        source: "Mapped individual OSM/BAG contours, native model +X bearing 209 degrees; street front +Z bearing 299 degrees."
      },
      attribution: {
        title: "ARTIS entrance gate and kiosks",
        author: "Map Recall",
        sourceUrl: "https://www.monumenten.nl/monument/4103",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction; no imported meshes or textures. Individual footprints preserve public Artisplein and neighboring Groote Museum."
      }
    },
    {
      id: "hortus-greenhouses",
      name: "Hortus Botanicus \u2014 greenhouses and orangery",
      landmarkId: "hortus-botanicus",
      modelUrl: "./models/hortus-greenhouses.glb",
      suppressOsmIds: [
        "w57863706",
        "NL.IMBAG.Pand.0363100012181028",
        "w57863916",
        "NL.IMBAG.Pand.0363100012164942",
        "w57856456",
        "NL.IMBAG.Pand.0363100012182570"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.907562825146495,
          52.36667455153043
        ],
        headingDegrees: 115.67678459307069,
        lengthMetres: 135.42441302242912,
        widthMetres: 65.33673807094493
      },
      surveyed: {
        anchor: [
          4.907562825146495,
          52.36667455153043
        ],
        northOffsetDegrees: 0
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 74.3,
      attribution: {
        title: "Hortus Botanicus \u2014 greenhouses and orangery",
        author: "Map Recall",
        sourceUrl: "https://www.dehortus.nl/en/garden-and-greenhouses/climate-house/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of three separate surveyed buildings with no garden parcel fill: the 1911 Palm House circular dome/perpendicular wings, 2025 Climate House ETFE canopy and retained external steel cable skeleton, and historic orangery. Actual OpenStreetMap building outlines; official Hortus aerial photography and ZJA 2025 architect plan/section references. Heights and ornamental details approximate."
      }
    },
    {
      id: "arcam",
      name: "Arcam \u2014 Amsterdam Centre for Architecture",
      landmarkId: "extract_landmarks_2001179186",
      modelUrl: "./models/arcam.glb",
      suppressOsmIds: [
        "w31980601",
        "NL.IMBAG.Pand.0363100012180470"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.912601916666667,
          52.37145868333334
        ],
        headingDegrees: 134.5,
        lengthMetres: 26.773420132289857,
        widthMetres: 11.68397608971833
      },
      surveyed: {
        anchor: [
          4.912601916666667,
          52.37145868333334
        ],
        northOffsetDegrees: 44.5,
        source: "Actual mapped footprint; local+X follows street, +Z faces Prins Hendrikkade"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Arcam",
        author: "Map Recall",
        sourceUrl: "https://www.renevanzuuk.nl/arcam",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original simplified curved shell and window reconstruction. Footprint and height sourced; folds, seams and glass-opening contours approximate. No imported mesh or photo texture."
      }
    },
    {
      id: "brakke-grond",
      name: "Vlaams Cultuurhuis de Brakke Grond",
      landmarkId: "extract_landmarks_9366648",
      modelUrl: "./models/brakke-grond.glb",
      suppressOsmIds: [
        "w57859598",
        "NL.IMBAG.Pand.0363100012168529"
      ],
      footprint: {
        centre: [
          4.894160923761204,
          52.371060301942144
        ],
        headingDegrees: 93.24769955052625,
        lengthMetres: 82.56081513635031,
        widthMetres: 58.812151618836445
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -88.24769955052625,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.894160923761204,
          52.371060301942144
        ],
        northOffsetDegrees: 185,
        source: "Current PDOK BAG contour; native +X275\xB0 and entrance +Z5\xB0 face the public Nesplein. Cafe facade faces opposite185\xB0, while west side follows Nes."
      },
      attribution: {
        title: "Vlaams Cultuurhuis de Brakke Grond",
        author: "Map Recall",
        sourceUrl: "https://brakkegrond.nl/over-ons/de-geschiedenis-van-de-brakke-grond",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction from primary venue/heritage architecture references, current BAG outlines and mapped 2025 3DBAG height; no imported meshes or textures."
      }
    },
    {
      id: "frascati",
      name: "Frascati",
      landmarkId: "osm_theatre_2724220323",
      modelUrl: "./models/frascati.glb",
      suppressOsmIds: [
        "w266932399",
        "NL.IMBAG.Pand.0363100012168465"
      ],
      footprint: {
        centre: [
          4.893913835356087,
          52.37036795599974
        ],
        headingDegrees: 92.01886487244738,
        lengthMetres: 54.685246723089925,
        widthMetres: 38.14016308987897
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 182.98113512755262,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.893913835356087,
          52.37036795599974
        ],
        northOffsetDegrees: 95,
        source: "Current PDOK BAG individual building contours with named street frontage orientation; precise native metre geometry preserves courtyards and neighbors."
      },
      attribution: {
        title: "Frascati",
        author: "Map Recall",
        sourceUrl: "https://www.frascatitheater.nl/nl/contact-en-route-hvkz",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction from primary venue/heritage architecture references, current BAG outlines and mapped 2025 3DBAG height; no imported meshes or textures."
      }
    },
    {
      id: "boom-chicago",
      name: "Boom Chicago / Rozentheater",
      landmarkId: "extract_landmarks_855923099",
      modelUrl: "./models/boom-chicago.glb",
      suppressOsmIds: [
        "w266659986",
        "NL.IMBAG.Pand.0363100012174999"
      ],
      footprint: {
        centre: [
          4.879140883714867,
          52.372669186374516
        ],
        headingDegrees: 157.26777098353097,
        lengthMetres: 43.760989498567824,
        widthMetres: 17.890234957107282
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 180.73222901646903,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.879140883714867,
          52.372669186374516
        ],
        northOffsetDegrees: 158,
        source: "Current PDOK BAG individual building contours with named street frontage orientation; precise native metre geometry preserves courtyards and neighbors."
      },
      attribution: {
        title: "Boom Chicago / Rozentheater",
        author: "Map Recall",
        sourceUrl: "https://arcam.nl/architectuur-gids/rozentheater-2/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction from primary venue/heritage architecture references, current BAG outlines and mapped 2025 3DBAG height; no imported meshes or textures."
      }
    },
    {
      id: "foam",
      name: "Foam \u2014 Fodor Museum canal houses",
      landmarkId: "extract_landmarks_1875254501",
      modelUrl: "./models/foam.glb",
      suppressOsmIds: [
        "w268283689",
        "NL.IMBAG.Pand.0363100012167983",
        "r3596865",
        "NL.IMBAG.Pand.0363100012167977",
        "r3596866",
        "NL.IMBAG.Pand.0363100012167978"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.893417347733199,
          52.36407363385784
        ],
        headingDegrees: 12.003412745985031,
        lengthMetres: 29.89426360518473,
        widthMetres: 22.51366543490861
      },
      surveyed: {
        anchor: [
          4.893417347733199,
          52.36407363385784
        ],
        northOffsetDegrees: 12.599999999999994
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 180.59658725401496,
      attribution: {
        title: "Foam \u2014 Fodor Museum canal houses",
        author: "Map Recall",
        sourceUrl: "https://www.benthemcrouwel.com/projects/foam",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of precisely scoped historic canal museum buildings using actual OpenStreetMap/current BAG geometry and official museum/architect exterior photographs. Original window, gable, doorcase and stair geometry; rear courtyard/lightwell rings and the OnsSolder public alley preserved. Foam light courts represented with low glass covers as described by its architect. Dimensions and ornament approximate."
      }
    },
    {
      id: "huis-marseille",
      name: "Huis Marseille \u2014 two canal houses",
      landmarkId: "extract_landmarks_204772388",
      modelUrl: "./models/huis-marseille.glb",
      suppressOsmIds: [
        "w266679116",
        "NL.IMBAG.Pand.0363100012172340",
        "r3581187",
        "NL.IMBAG.Pand.0363100012172341"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.885023211366768,
          52.367655981132486
        ],
        headingDegrees: 93.69918033754192,
        lengthMetres: 31.747527439675313,
        widthMetres: 13.145083902037701
      },
      surveyed: {
        anchor: [
          4.885023211366768,
          52.367655981132486
        ],
        northOffsetDegrees: 93.19999999999999
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 179.50081966245807,
      attribution: {
        title: "Huis Marseille \u2014 two canal houses",
        author: "Map Recall",
        sourceUrl: "https://huismarseille.nl/en/history/the-house/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of precisely scoped historic canal museum buildings using actual OpenStreetMap/current BAG geometry and official museum/architect exterior photographs. Original window, gable, doorcase and stair geometry; rear courtyard/lightwell rings and the OnsSolder public alley preserved. Foam light courts represented with low glass covers as described by its architect. Dimensions and ornament approximate."
      }
    },
    {
      id: "agnietenkapel",
      name: "Agnietenkapel (UvA)",
      landmarkId: "extract_landmarks_736156087",
      modelUrl: "./models/agnietenkapel.glb",
      suppressOsmIds: [
        "w158853695",
        "NL.IMBAG.Pand.0363100012180211"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.895042658823529,
          52.36992318235294
        ],
        headingDegrees: 90,
        lengthMetres: 34.05858877984683,
        widthMetres: 15.39822200008075
      },
      surveyed: {
        anchor: [
          4.895042658823529,
          52.36992318235294
        ],
        northOffsetDegrees: 0,
        source: "Actual mapped chapel and courtyard wall; local east/south metre coordinates"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Agnietenkapel",
        author: "Map Recall",
        sourceUrl: "https://arcam.nl/architectuur-gids/agnietenkapel/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Exact mapped chapel plan and courtyard wall; roof divisions, tracery and carved gate details approximate. Reference photos guide geometry only."
      }
    },
    {
      id: "lab111",
      name: "LAB111 / Pathological Anatomical Laboratory",
      landmarkId: "osm_arts_centre_44532021",
      modelUrl: "./models/lab111.glb",
      suppressOsmIds: [
        "w44532021",
        "NL.IMBAG.Pand.0363100012237077"
      ],
      footprint: {
        centre: [
          4.867419736081726,
          52.36366317589964
        ],
        headingDegrees: 66.93701729326187,
        lengthMetres: 55.81708423248726,
        widthMetres: 37.18983549504506
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.867419736081726,
          52.36366317589964
        ],
        northOffsetDegrees: -23.062982706738126,
        source: "Individual current PDOK BAG building polygon and OSM/2025 3DBAG height, native frontage faces named entrance street. No replacement of adjacent complex buildings."
      },
      attribution: {
        title: "LAB111 / Pathological Anatomical Laboratory",
        author: "Map Recall",
        sourceUrl: "https://www.lab111.nl/over-ons/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction from primary venue/heritage references with individual current BAG plans; no imported meshes or textures."
      }
    },
    {
      id: "occii",
      name: "OCCII / former horse-tram coach house",
      landmarkId: "extract_landmarks_1988696513",
      modelUrl: "./models/occii.glb",
      suppressOsmIds: [
        "w276906892",
        "NL.IMBAG.Pand.0363100012233440"
      ],
      footprint: {
        centre: [
          4.854958401332961,
          52.35427766374001
        ],
        headingDegrees: 69.11143834993021,
        lengthMetres: 64.57938007152399,
        widthMetres: 13.368354678900868
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.854958401332961,
          52.35427766374001
        ],
        northOffsetDegrees: -110.88856165006979,
        source: "Individual current PDOK BAG building polygon and OSM/2025 3DBAG height, native frontage faces named entrance street. No replacement of adjacent complex buildings."
      },
      attribution: {
        title: "OCCII / former horse-tram coach house",
        author: "Map Recall",
        sourceUrl: "https://occii.org/hut-chicken-legs-occiis-architecture/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction from primary venue/heritage references with individual current BAG plans; no imported meshes or textures."
      }
    },
    {
      id: "ketelhuis",
      name: "Het Ketelhuis",
      landmarkId: "extract_landmarks_2037503288",
      modelUrl: "./models/ketelhuis.glb",
      suppressOsmIds: [
        "w57860887",
        "NL.IMBAG.Pand.0363100012135793"
      ],
      footprint: {
        centre: [
          4.873528379404577,
          52.38635735977405
        ],
        headingDegrees: 88.40235146891928,
        lengthMetres: 23.336638256284797,
        widthMetres: 18.16711235417388
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.873528379404577,
          52.38635735977405
        ],
        northOffsetDegrees: -1.597648531080722,
        source: "Individual current PDOK BAG building polygon and OSM/2025 3DBAG height, native frontage faces named entrance street. No replacement of adjacent complex buildings."
      },
      attribution: {
        title: "Het Ketelhuis",
        author: "Map Recall",
        sourceUrl: "https://westergas.nl/map/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction from primary venue/heritage references with individual current BAG plans; no imported meshes or textures."
      }
    },
    {
      id: "wereldmuseum-amsterdam",
      name: "Wereldmuseum Amsterdam \u2014 KIT complex",
      landmarkId: "extract_landmarks_754896207",
      modelUrl: "./models/wereldmuseum-amsterdam.glb",
      suppressOsmIds: [
        "r3697339",
        "w750932737",
        "w750932738",
        "w750932739",
        "w750932740",
        "w750932741",
        "w750932742",
        "w750932743",
        "w750932744",
        "w750932745",
        "w750932746",
        "w750932747",
        "w750932748",
        "w750932749",
        "w750932750",
        "w750932751",
        "w750932752",
        "w750932753",
        "w750932754",
        "w750932755",
        "w750932756",
        "w750932757",
        "w750939953",
        "w750939954",
        "w750939955",
        "w750939956",
        "w750939957",
        "w750939958",
        "w750939959",
        "w750940954",
        "w751004889",
        "w751004890",
        "w751004891",
        "w751004892",
        "w751004893",
        "w751004894",
        "w751004895",
        "w751004896",
        "w751004897",
        "NL.IMBAG.Pand.0363100012237251"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.92160227871942,
          52.36254354571057
        ],
        headingDegrees: 86.1554630626917,
        lengthMetres: 187.2199743118305,
        widthMetres: 87.93109064053408
      },
      surveyed: {
        anchor: [
          4.92160227871942,
          52.36254354571057
        ],
        northOffsetDegrees: 239.89999999999998
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 243.74453693730828,
      attribution: {
        title: "Wereldmuseum Amsterdam \u2014 KIT complex",
        author: "Map Recall",
        sourceUrl: "https://amsterdam.wereldmuseum.nl/en/whats-on/exhibitions/building-full-stories",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Exact OpenStreetMap parent/parts polygons cross-checked against current PDOK BAG footprints; original texture-free meshes informed by primary architecture photographs. Whole actual cadastral building is represented with separate measured roof/body portions, preserving genuine open courts."
      }
    },
    {
      id: "dutch-resistance-museum",
      name: "Dutch Resistance Museum \u2014 Plancius",
      landmarkId: "extract_landmarks_435355441",
      modelUrl: "./models/dutch-resistance-museum.glb",
      suppressOsmIds: [
        "r3604243",
        "w252753161",
        "NL.IMBAG.Pand.0363100012170669"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.912335391811038,
          52.3678438887728
        ],
        headingDegrees: 29.638214355817865,
        lengthMetres: 71.45008265644202,
        widthMetres: 62.890100946325326
      },
      surveyed: {
        anchor: [
          4.912335391811038,
          52.3678438887728
        ],
        northOffsetDegrees: -60.1
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0.2617856441821331,
      attribution: {
        title: "Dutch Resistance Museum \u2014 Plancius",
        author: "Map Recall",
        sourceUrl: "https://www.verzetsmuseum.org/en/history-of-the-museum",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Exact OpenStreetMap parent/parts polygons cross-checked against current PDOK BAG footprints; original texture-free meshes informed by primary architecture photographs. Whole actual cadastral building is represented with separate measured roof/body portions, preserving genuine open courts."
      }
    },
    {
      id: "allard-pierson",
      name: "Allard Pierson Museum",
      landmarkId: "extract_landmarks_275245540",
      modelUrl: "./models/allard-pierson.glb",
      suppressOsmIds: [
        "w266914044",
        "NL.IMBAG.Pand.0363100012165686"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8936619689743805,
          52.36902112113398
        ],
        headingDegrees: 85.42197001499528,
        lengthMetres: 120.1193593401295,
        widthMetres: 29.62057461638325
      },
      surveyed: {
        anchor: [
          4.8936619689743805,
          52.36902112113398
        ],
        northOffsetDegrees: 68.9
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 73.47802998500472,
      attribution: {
        title: "Allard Pierson Museum",
        author: "Map Recall",
        sourceUrl: "https://www.atelierpro.nl/en/projecten/allard-pierson",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Exact OpenStreetMap parent/parts polygons cross-checked against current PDOK BAG footprints; original texture-free meshes informed by primary architecture photographs. Whole actual cadastral building is represented with separate measured roof/body portions, preserving genuine open courts."
      }
    },
    {
      id: "dominicuskerk",
      name: "Dominicuskerk",
      landmarkId: "extract_landmarks_1569842434",
      modelUrl: "./models/dominicuskerk.glb",
      suppressOsmIds: [
        "w266621545",
        "NL.IMBAG.Pand.0363100012171033",
        "w749287651",
        "w749287652",
        "w749287653",
        "w749287654",
        "w749599657"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.89321725882353,
          52.3769672
        ],
        headingDegrees: 90,
        lengthMetres: 49.880298147937275,
        widthMetres: 43.05533000047106
      },
      surveyed: {
        anchor: [
          4.89321725882353,
          52.3769672
        ],
        northOffsetDegrees: 0,
        source: "Actual OSM/BAG plan and mapped roof/tower parts; local east/south metre coordinates"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Dominicuskerk",
        author: "Map Recall",
        sourceUrl: "https://dominicusamsterdam.nl/gebouw-en-historie/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction. Exact current church parent and four contained roof/body parts. Mapped church roof part w749599657 is rebuilt above21m and clipped to the current parent to avoid encroaching on adjacent BAG0363100012179327; no neighboring building is suppressed. Parent height28.6m and historical part tags up to29m differ; decorative divisions approximate. Unfinished hexagonal tower stump retained; no proposed85m tower built."
      }
    },
    {
      id: "vredeskerk",
      name: "Vredeskerk",
      landmarkId: "extract_landmarks_77247220",
      modelUrl: "./models/vredeskerk.glb",
      suppressOsmIds: [
        "w44451461",
        "NL.IMBAG.Pand.0363100012107328",
        "w995323510",
        "w995323511",
        "w995323512"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.889909207894737,
          52.349861886842106
        ],
        headingDegrees: 90,
        lengthMetres: 54.83400106963944,
        widthMetres: 42.447359999649734
      },
      surveyed: {
        anchor: [
          4.889909207894737,
          52.349861886842106
        ],
        northOffsetDegrees: 0,
        source: "Actual OSM/BAG plan and mapped roof/tower parts; local east/south metre coordinates"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Vredeskerk",
        author: "Map Recall",
        sourceUrl: "https://www.amsterdam.vredeskerk.nl/his.index.htm",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction. Exact church parent and tower parts. Parish/diocese describe50m including iron spire; historical mapped tower part49m. Nave roof/wall division and checkerboard tile details approximate. No plaza trees or fountain positions invented."
      }
    },
    {
      id: "badhuistheater",
      name: "Badhuistheater / Boerhaaveplein bath house",
      landmarkId: "extract_landmarks_1884008891",
      modelUrl: "./models/badhuistheater.glb",
      suppressOsmIds: [
        "w81362448",
        "NL.IMBAG.Pand.0363100012135740"
      ],
      footprint: {
        centre: [
          4.912708742836539,
          52.35946578999055
        ],
        headingDegrees: 18.508703067779862,
        lengthMetres: 19.31788960379386,
        widthMetres: 19.040379422032384
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.912708742836539,
          52.35946578999055
        ],
        northOffsetDegrees: -161.49129693222014,
        source: "Individual current BAG outer polygon and courtyard rings, native axes aligned to named streets. Current venue entrances from primary official references; mapped heights from OSM/3DBAG."
      },
      attribution: {
        title: "Badhuistheater / Boerhaaveplein bath house",
        author: "Map Recall",
        sourceUrl: "https://items.amsterdamse-school.nl/details/objects/892",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction from primary architecture/venue photos; individual current BAG footprint with courtyards retained. No imported meshes."
      }
    },
    {
      id: "cinecenter",
      name: "Cinecenter",
      landmarkId: "extract_landmarks_2066573666",
      modelUrl: "./models/cinecenter.glb",
      suppressOsmIds: [
        "w267565713",
        "NL.IMBAG.Pand.0363100012173768"
      ],
      footprint: {
        centre: [
          4.881781412209045,
          52.36504920795147
        ],
        headingDegrees: 51.32964359660497,
        lengthMetres: 30.133997865222117,
        widthMetres: 25.388899781308155
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.881781412209045,
          52.36504920795147
        ],
        northOffsetDegrees: -128.67035640339503,
        source: "Individual current BAG outer polygon and courtyard rings, native axes aligned to named streets. Current venue entrances from primary official references; mapped heights from OSM/3DBAG."
      },
      attribution: {
        title: "Cinecenter",
        author: "Map Recall",
        sourceUrl: "https://www.cinecenter.nl/info/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction from primary architecture/venue photos; individual current BAG footprint with courtyards retained. No imported meshes."
      }
    },
    {
      id: "studiok",
      name: "Timorplein school / Studio K",
      landmarkId: "osm_school_3699016",
      modelUrl: "./models/studiok.glb",
      suppressOsmIds: [
        "r3699016",
        "NL.IMBAG.Pand.0363100012237325"
      ],
      footprint: {
        centre: [
          4.9359819354640555,
          52.36529993337992
        ],
        headingDegrees: 89.0647456396652,
        lengthMetres: 74.58075217954416,
        widthMetres: 51.08127989623449
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.9359819354640555,
          52.36529993337992
        ],
        northOffsetDegrees: -0.9352543603347954,
        source: "Individual current BAG outer polygon and courtyard rings, native axes aligned to named streets. Current venue entrances from primary official references; mapped heights from OSM/3DBAG."
      },
      attribution: {
        title: "Timorplein school / Studio K",
        author: "Map Recall",
        sourceUrl: "https://arcam.nl/architectuur-gids/voormalige-technische-school-timorplein/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction from primary architecture/venue photos; individual current BAG footprint with courtyards retained. No imported meshes."
      }
    },
    {
      id: "groote-museum",
      name: "ARTIS Groote Museum",
      landmarkId: "extract_landmarks_402613958",
      modelUrl: "./models/groote-museum.glb",
      suppressOsmIds: [
        "w269020374",
        "NL.IMBAG.Pand.0363100012165614"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.913127461904327,
          52.366173715262796
        ],
        headingDegrees: 120.18889601770292,
        lengthMetres: 71.91223163195569,
        widthMetres: 19.842842472567856
      },
      surveyed: {
        anchor: [
          4.913127461904327,
          52.366173715262796
        ],
        northOffsetDegrees: 209.89999999999998
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 179.71110398229706,
      attribution: {
        title: "ARTIS Groote Museum",
        author: "Map Recall",
        sourceUrl: "https://www.artis.nl/en/artis-groote-museum/to-see-in-artis-groote-museum/building",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction of the exact mapped individual ARTIS building, cross-checked against current PDOK BAG and primary museum/architect imagery. Actual historic permanent roof silhouette retained; dates follow documented architecture history, and temporary works or unconfirmed solar-panel layout are not represented."
      }
    },
    {
      id: "artis-library",
      name: "ARTIS Library \u2014 Fauna Building",
      landmarkId: "extract_landmarks_1124317571",
      modelUrl: "./models/artis-library.glb",
      suppressOsmIds: [
        "w269020356",
        "NL.IMBAG.Pand.0363100012164975"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.9149289852780305,
          52.36553813024979
        ],
        headingDegrees: 119.53591573579465,
        lengthMetres: 80.2468587459968,
        widthMetres: 11.025797003150897
      },
      surveyed: {
        anchor: [
          4.9149289852780305,
          52.36553813024979
        ],
        northOffsetDegrees: 29.900000000000006
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0.3640842642053599,
      attribution: {
        title: "ARTIS Library \u2014 Fauna Building",
        author: "Map Recall",
        sourceUrl: "https://www.allardpierson.nl/en/artis-library",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction of the exact mapped individual ARTIS building, cross-checked against current PDOK BAG and primary museum/architect imagery. Actual historic permanent roof silhouette retained; dates follow documented architecture history, and temporary works or unconfirmed solar-panel layout are not represented."
      }
    },
    {
      id: "de-dokwerker",
      name: "De Dokwerker",
      assetKind: "memorial",
      landmarkId: "extract_landmarks_1098130181",
      modelUrl: "./models/de-dokwerker.glb",
      suppressOsmIds: [
        "n34051159"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.9050146,
          52.3671957
        ],
        headingDegrees: 135,
        lengthMetres: 1.5,
        widthMetres: 1.2
      },
      surveyed: {
        anchor: [
          4.9050146,
          52.3671957
        ],
        northOffsetDegrees: 45,
        source: "OSM surveyed memorial node; southwestern facing visually interpreted from primary photographs, not a surveyed bearing"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "De Dokwerker \u2014 original faceted interpretation",
        author: "Map Recall; commemorated sculpture by Mari Andriessen",
        sourceUrl: "https://www.4en5mei.nl/oorlogsmonumenten/zoeken/1434/amsterdam-de-dokwerker",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free geometric silhouette with documented1.60m pedestal and2.60m standing figure; body/pose divisions and facing approximate. Exact node position. No surrounding buildings or plaza replaced."
      }
    },
    {
      id: "willet-holthuysen",
      name: "Willet-Holthuysen House",
      landmarkId: "extract_landmarks_154293883",
      modelUrl: "./models/willet-holthuysen.glb",
      suppressOsmIds: [
        "w267116763",
        "NL.IMBAG.Pand.0363100012171562"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.898971038437082,
          52.36568706873301
        ],
        headingDegrees: 163.11579731148294,
        lengthMetres: 25.94850886864895,
        widthMetres: 14.953045719179908
      },
      surveyed: {
        anchor: [
          4.898971038437082,
          52.36568706873301
        ],
        northOffsetDegrees: -16
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -89.11579731148294,
      attribution: {
        title: "Willet-Holthuysen House",
        author: "Map Recall",
        sourceUrl: "https://www.amsterdammuseum.nl/en/tickets-and-visit/locations/huis-willet-holthuysen/3632",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly museum reconstruction from primary museum photographs and exact OSM/current PDOK BAG building outlines. Willet-Holthuysen\u2019s open French garden and the Pipe Museum\u2019s central courtyard notch are retained; adjacent canal houses are outside the model and suppression scope."
      }
    },
    {
      id: "amsterdam-pipe-museum",
      name: "Amsterdam Pipe Museum",
      landmarkId: "extract_landmarks_301593654",
      modelUrl: "./models/amsterdam-pipe-museum.glb",
      suppressOsmIds: [
        "w267565677",
        "NL.IMBAG.Pand.0363100012169037"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.885162575010229,
          52.36406118702082
        ],
        headingDegrees: 48.361372776468016,
        lengthMetres: 31.302749222414075,
        widthMetres: 9.508166304295873
      },
      surveyed: {
        anchor: [
          4.885162575010229,
          52.36406118702082
        ],
        northOffsetDegrees: 225.3
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 266.93862722353197,
      attribution: {
        title: "Amsterdam Pipe Museum",
        author: "Map Recall",
        sourceUrl: "https://pipemuseum.nl/en/article/de-geschiedenis-van-het-pijpenkabinet-van-particuliere-collectie-tot-nationaal-museum",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly museum reconstruction from primary museum photographs and exact OSM/current PDOK BAG building outlines. Willet-Holthuysen\u2019s open French garden and the Pipe Museum\u2019s central courtyard notch are retained; adjacent canal houses are outside the model and suppression scope."
      }
    },
    {
      id: "athenaeum",
      name: "Athenaeum bookshop / Nieuwscentrum",
      landmarkId: "osm_shop_1772991830",
      modelUrl: "./models/athenaeum.glb",
      suppressOsmIds: [
        "w266697389",
        "NL.IMBAG.Pand.0363100012175036"
      ],
      footprint: {
        centre: [
          4.889010436459753,
          52.36896764373011
        ],
        headingDegrees: 89.63588020742122,
        lengthMetres: 20.29241050175719,
        widthMetres: 16.21092442777015
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 89.83191979257879,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.889058364860993,
          52.36892986410698
        ],
        northOffsetDegrees: -0.5322000000000031,
        source: "Current individual BAG polygon, actual street facade surveyed against OSM geometry. Primary facade photographs and AHN5/3DBAG heights above local terrain."
      },
      attribution: {
        title: "Athenaeum bookshop / Nieuwscentrum",
        author: "Map Recall",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Amsterdam_Athenaeum_Boekhandel.jpg",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction; no imported meshes or photographic textures. Exact mapped parent retained with neighboring buildings excluded."
      },
      relatedLandmarkIds: [
        "osm_shop_3868737201"
      ]
    },
    {
      id: "scheltema",
      name: "Scheltema / Rokin 9\u201315",
      landmarkId: "osm_shop_266934444",
      modelUrl: "./models/scheltema.glb",
      suppressOsmIds: [
        "w266934444",
        "NL.IMBAG.Pand.0363100012167909"
      ],
      footprint: {
        centre: [
          4.893568102495726,
          52.37212259797889
        ],
        headingDegrees: 102.7116791473693,
        lengthMetres: 26.57905429659337,
        widthMetres: 24.20944735155051
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 180.1196208526307,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.893404379268778,
          52.372135134784074
        ],
        northOffsetDegrees: 102.8313,
        source: "Current individual BAG polygon, actual street facade surveyed against OSM geometry. Primary facade photographs and AHN5/3DBAG heights above local terrain."
      },
      attribution: {
        title: "Scheltema / Rokin 9\u201315",
        author: "Map Recall",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:2022_Rokin_9-15,_Asd_(01).jpg",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction; no imported meshes or photographic textures. Exact mapped parent retained with neighboring buildings excluded."
      }
    },
    {
      id: "haarlemmermeerstation",
      name: "Haarlemmermeerstation",
      landmarkId: "extract_landmarks_1993361519",
      modelUrl: "./models/haarlemmermeerstation.glb",
      suppressOsmIds: [
        "w57862882",
        "NL.IMBAG.Pand.0363100012154509"
      ],
      footprint: {
        centre: [
          4.856654491697236,
          52.34934579394123
        ],
        headingDegrees: 166.09587226381385,
        lengthMetres: 36.29384848701365,
        widthMetres: 22.400340181713553
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -97.63617226381385,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.856727367238149,
          52.3493589147138
        ],
        northOffsetDegrees: 248.4597,
        source: "Current individual BAG polygon, actual street facade surveyed against OSM geometry. Primary facade photographs and AHN5/3DBAG heights above local terrain."
      },
      attribution: {
        title: "Haarlemmermeerstation",
        author: "Map Recall",
        sourceUrl: "https://www.museumtramlijn.org/station/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction; no imported meshes or photographic textures. Exact mapped parent retained with neighboring buildings excluded."
      }
    },
    {
      id: "begijnhofkapel",
      name: "Begijnhofkapel \u2014 HH. Johannes en Ursula",
      landmarkId: "extract_landmarks_643362629",
      modelUrl: "./models/begijnhofkapel.glb",
      suppressOsmIds: [
        "w266903904",
        "NL.IMBAG.Pand.0363100012168060"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.88955916,
          52.369376188
        ],
        headingDegrees: 90,
        lengthMetres: 21.525620909399965,
        widthMetres: 40.921907999888134
      },
      surveyed: {
        anchor: [
          4.88955916,
          52.369376188
        ],
        northOffsetDegrees: 0,
        source: "Actual shared OSM/BAG plan, local east/south metres; current3DBAG ridge15.794m aboveground"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Begijnhofkapel",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/368",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction. Exact sharedBAG plan, two bent three-bay fronts, Empire windows and projecting stone portal. Authored simplified rear roof/wall divisions within current3DBAG height; church has no spire. EnglishReformedChurch and neighboring houses retained."
      }
    },
    {
      id: "huis-de-pinto",
      name: "Huis De Pinto",
      landmarkId: "extract_landmarks_560548170",
      modelUrl: "./models/huis-de-pinto.glb",
      suppressOsmIds: [
        "w175846919",
        "NL.IMBAG.Pand.0363100012182911"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.900947893723509,
          52.37012639422018
        ],
        headingDegrees: 72.79839529693228,
        lengthMetres: 21.772135341096394,
        widthMetres: 12.27648518938112
      },
      surveyed: {
        anchor: [
          4.900947893723509,
          52.37012639422018
        ],
        northOffsetDegrees: 78
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 95.20160470306772,
      attribution: {
        title: "Huis De Pinto",
        author: "Map Recall",
        sourceUrl: "https://stadsherstel.nl/monumenten/huis-de-pinto/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction of the exact mapped museum/cultural-house building, cross-checked against current PDOK BAG. Pinto\u2019s twin historic roofs remain behind the monumental parapet; the Tulip Museum occupies the actual combined 1927 Prinsengracht116\u2013118 apartment/shop block with straight brick cornice. Neighboring buildings and any open rear spaces are retained."
      }
    },
    {
      id: "amsterdam-tulip-museum",
      name: "Amsterdam Tulip Museum",
      landmarkId: "extract_landmarks_339731654",
      modelUrl: "./models/amsterdam-tulip-museum.glb",
      suppressOsmIds: [
        "w266561396",
        "NL.IMBAG.Pand.0363100012174699"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.884088419391602,
          52.37632814296878
        ],
        headingDegrees: 119.76088510470072,
        lengthMetres: 14.680859994520542,
        widthMetres: 9.493627369251168
      },
      surveyed: {
        anchor: [
          4.884088419391602,
          52.37632814296878
        ],
        northOffsetDegrees: -61
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90.76088510470072,
      attribution: {
        title: "Amsterdam Tulip Museum",
        author: "Map Recall",
        sourceUrl: "https://amsterdamtulipmuseum.com/pages/about-amsterdam-tulip-museum",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction of the exact mapped museum/cultural-house building, cross-checked against current PDOK BAG. Pinto\u2019s twin historic roofs remain behind the monumental parapet; the Tulip Museum occupies the actual combined 1927 Prinsengracht116\u2013118 apartment/shop block with straight brick cornice. Neighboring buildings and any open rear spaces are retained."
      }
    },
    {
      id: "ot301",
      name: "OT301 / former Film Academy",
      landmarkId: "extract_landmarks_1988238017",
      modelUrl: "./models/ot301.glb",
      suppressOsmIds: [
        "w276420914",
        "NL.IMBAG.Pand.0363100012138646"
      ],
      footprint: {
        centre: [
          4.865818145598819,
          52.36011157597592
        ],
        headingDegrees: 69.89213180174445,
        lengthMetres: 29.669648058764523,
        widthMetres: 16.385921212879335
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 269.85026819825555,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.865769599943963,
          52.360078554569874
        ],
        northOffsetDegrees: 159.7424,
        source: "Individual current BAG parents and actual street axes. Primary owner/venue/municipal architectural photos; AHN5/3DBAG roof surfaces verified above local terrain."
      },
      attribution: {
        title: "OT301 / former Film Academy",
        author: "Map Recall",
        sourceUrl: "https://www.ot301.nl/about-contact",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-palette low-poly geometry from primary reference photos and surveyed footprints. No imported meshes or texture images. Shared courtyards and separate neighboring parents retained."
      }
    },
    {
      id: "cavia",
      name: "Filmhuis Cavia / former twin-school complex",
      landmarkId: "extract_landmarks_2115483451",
      modelUrl: "./models/cavia.glb",
      suppressOsmIds: [
        "w276272880",
        "NL.IMBAG.Pand.0363100012118954",
        "w276272821",
        "NL.IMBAG.Pand.0363100012117132",
        "w276272948",
        "NL.IMBAG.Pand.0363100012164519"
      ],
      footprint: {
        centre: [
          4.870052028940552,
          52.38190186277704
        ],
        headingDegrees: 167.79050507678784,
        lengthMetres: 46.333902117182305,
        widthMetres: 42.23061649285789
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90.08355507678783,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.87016028922798,
          52.38200245851402
        ],
        northOffsetDegrees: 257.70695,
        source: "Individual current BAG parents and actual street axes. Primary owner/venue/municipal architectural photos; AHN5/3DBAG roof surfaces verified above local terrain."
      },
      attribution: {
        title: "Filmhuis Cavia / former twin-school complex",
        author: "Map Recall",
        sourceUrl: "https://filmhuiscavia.nl/over-cavia/about-cavia",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-palette low-poly geometry from primary reference photos and surveyed footprints. No imported meshes or texture images. Shared courtyards and separate neighboring parents retained."
      }
    },
    {
      id: "orgelpark",
      name: "Orgelpark / Parkkerk",
      landmarkId: "extract_landmarks_1851884741",
      modelUrl: "./models/orgelpark.glb",
      suppressOsmIds: [
        "w152508197",
        "NL.IMBAG.Pand.0363100012082170"
      ],
      footprint: {
        centre: [
          4.868224357468281,
          52.35983534853001
        ],
        headingDegrees: 159.34344754145258,
        lengthMetres: 36.2085078763728,
        widthMetres: 26.104344344553603
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 180.1335524585474,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.868256447423842,
          52.35985026617333
        ],
        northOffsetDegrees: 159.477,
        source: "Individual current BAG parents and actual street axes. Primary owner/venue/municipal architectural photos; AHN5/3DBAG roof surfaces verified above local terrain."
      },
      attribution: {
        title: "Orgelpark / Parkkerk",
        author: "Map Recall",
        sourceUrl: "https://stadsherstel.nl/monumenten/orgelpark/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-palette low-poly geometry from primary reference photos and surveyed footprints. No imported meshes or texture images. Shared courtyards and separate neighboring parents retained."
      }
    },
    {
      id: "houten-huys",
      name: "Houten Huys \u2014 Begijnhof 34",
      landmarkId: "extract_landmarks_630735672",
      modelUrl: "./models/houten-huys.glb",
      suppressOsmIds: [
        "w266903979",
        "NL.IMBAG.Pand.0363100012175498"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.88969626,
          52.36909782
        ],
        headingDegrees: 90,
        lengthMetres: 12.608234423445666,
        widthMetres: 10.578678000310333
      },
      surveyed: {
        anchor: [
          4.88969626,
          52.36909782
        ],
        northOffsetDegrees: 0,
        source: "Exact current OSM/BAG corner-house plan in local east/south metres; actual narrow NE gable front and current3DBAG height aboveground."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Houten Huys",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/371",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly model: narrow black timber gables, overhanging upper front, white masonry base and leaded windows. Exact BAG plan and current3DBAG height; side/rear details and roof are simplified. No photograph pixels or downloaded mesh geometry. Courtyard statue, trees, fences and neighboring houses retained."
      }
    },
    {
      id: "herepoort-bergpoort",
      name: "Herepoort / Bergpoort \u2014 Rijksmuseum garden",
      landmarkId: "extract_landmarks_1613749874",
      modelUrl: "./models/herepoort-bergpoort.glb",
      suppressOsmIds: [
        "w277104741",
        "NL.IMBAG.Pand.0363100012229949"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.88359005,
          52.36021645833333
        ],
        headingDegrees: 90,
        lengthMetres: 8.164708297908032,
        widthMetres: 8.887415999396495
      },
      surveyed: {
        anchor: [
          4.88359005,
          52.36021645833333
        ],
        northOffsetDegrees: 0,
        source: "CurrentOSM/BAG gate parent, nativeeast/south metres. Rijksmuseum published pairedfacade9x6.7m and9x8.5m dimensions; currentAHN5 supports8.4m roofmaximum."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Herepoort / Bergpoort",
        author: "Map Recall",
        sourceUrl: "https://www.rijksmuseum.nl/en/collection/object/Facade-van-de-Herenpoort--63cb930a4b01ebfb38602d3c669c8ce2",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction of pairedmuseumgardenfacades: openarch passage, sandstoneHerepoort with pairedcolumns/niches and brick/stoneBergpoort reverse. Surveyedparent and publisheddimensions; carvedreliefs, roof and archproportions simplified from photos. No downloadedmesh geometry or referenceimage pixels. Othermuseumgarden objects retained."
      }
    },
    {
      id: "huis-aan-drie-grachten",
      name: "Huis aan de Drie Grachten",
      landmarkId: "extract_landmarks_1614063354",
      modelUrl: "./models/huis-aan-drie-grachten.glb",
      suppressOsmIds: [
        "w266932427",
        "NL.IMBAG.Pand.0363100012168466"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.89468947030048,
          52.36937961104943
        ],
        headingDegrees: 106.52373678073104,
        lengthMetres: 14.12965803339511,
        widthMetres: 12.990739658930853
      },
      surveyed: {
        anchor: [
          4.89468947030048,
          52.36937961104943
        ],
        northOffsetDegrees: 103.5
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 86.97626321926896,
      attribution: {
        title: "Huis aan de Drie Grachten",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/6096",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction from primary monument descriptions and original photographer references, scoped to current PDOK BAG. Huis aan de Drie Grachten retains three stepped gables and transverse tiled roofs; De Dolphijn models both current restored Renaissance facade halves within ONE actual parent whose VBO addresses are Singel140 and142. Adjacent Singel138/BAG0363100012167969 and house247/BAG0363100012179859 are retained. Current photographic silhouette takes priority over older register wording about incomplete/restored tops."
      }
    },
    {
      id: "de-dolphijn",
      name: "De Dolphijn",
      landmarkId: "extract_landmarks_1604899229",
      modelUrl: "./models/de-dolphijn.glb",
      suppressOsmIds: [
        "w266620771",
        "NL.IMBAG.Pand.0363100012167968"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.889886838805892,
          52.37568578980617
        ],
        headingDegrees: 123.83730488963849,
        lengthMetres: 31.287332178361126,
        widthMetres: 14.221836472519911
      },
      surveyed: {
        anchor: [
          4.889886838805892,
          52.37568578980617
        ],
        northOffsetDegrees: -56.16
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -89.99730488963849,
      attribution: {
        title: "De Dolphijn",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/5303",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction from primary monument descriptions and original photographer references, scoped to current PDOK BAG. Huis aan de Drie Grachten retains three stepped gables and transverse tiled roofs; De Dolphijn models both current restored Renaissance facade halves within ONE actual parent whose VBO addresses are Singel140 and142. Adjacent Singel138/BAG0363100012167969 and house247/BAG0363100012179859 are retained. Current photographic silhouette takes priority over older register wording about incomplete/restored tops."
      }
    },
    {
      id: "rode-hoed",
      name: "De Rode Hoed / former Remonstrant church",
      landmarkId: "extract_landmarks_933328743",
      modelUrl: "./models/rode-hoed.glb",
      suppressOsmIds: [
        "w31742462",
        "NL.IMBAG.Pand.0363100012167695"
      ],
      footprint: {
        centre: [
          4.886977068632325,
          52.377399662040965
        ],
        headingDegrees: 119.33760650003984,
        lengthMetres: 50.248894059454734,
        widthMetres: 28.67251006008804
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0.16239349996016017,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.8873364,
          52.37732955
        ],
        northOffsetDegrees: -60.5,
        source: "Individual current BAG parent, frontage surveyed against mapped street axis; primary current venue/architect photos and detailed AHN5/3DBAG roof surfaces above local terrain."
      },
      attribution: {
        title: "De Rode Hoed / former Remonstrant church",
        author: "Map Recall",
        sourceUrl: "https://rodehoed.nl/index.php/over-rode-hoed/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-palette low-poly geometry; no imported meshes or texture images. Exact mapped scope with neighboring houses, courtyard recesses and park grounds retained."
      }
    },
    {
      id: "theater-amsterdam",
      name: "Theater Amsterdam",
      landmarkId: "extract_landmarks_707691223",
      modelUrl: "./models/theater-amsterdam.glb",
      suppressOsmIds: [
        "w265853828",
        "NL.IMBAG.Pand.0363100012242100"
      ],
      footprint: {
        centre: [
          4.877233932262727,
          52.39704600970005
        ],
        headingDegrees: 73.64238721269251,
        lengthMetres: 86.099781433493,
        widthMetres: 70.46676920649148
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -0.2423872126925346,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.8778458,
          52.3970485
        ],
        northOffsetDegrees: 253.39999999999998,
        source: "Individual current BAG parent, frontage surveyed against mapped street axis; primary current venue/architect photos and detailed AHN5/3DBAG roof surfaces above local terrain."
      },
      attribution: {
        title: "Theater Amsterdam",
        author: "Map Recall",
        sourceUrl: "https://dedato.com/project/een-theater-voor-anne-frank/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-palette low-poly geometry; no imported meshes or texture images. Exact mapped scope with neighboring houses, courtyard recesses and park grounds retained."
      }
    },
    {
      id: "vondelpark-open-air-theater",
      name: "Vondelpark Open Air Theater / stage canopy",
      landmarkId: "extract_landmarks_1467127381",
      modelUrl: "./models/vondelpark-open-air-theater.glb",
      suppressOsmIds: [
        "w230377611"
      ],
      footprint: {
        centre: [
          4.871116555823464,
          52.35842738077742
        ],
        headingDegrees: 0.7307111567452864,
        lengthMetres: 13.860467166636939,
        widthMetres: 13.429006472367991
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 269.99998884325476,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.8711157,
          52.35843215
        ],
        northOffsetDegrees: 90.73070000000001,
        source: "Exact current BAG / OSM parent footprint and street-facing axis; primary architectural photos and roof surfaces. Stage dimensions from official operator drawings; roof curvature and envelope approximated from primary venue photo."
      },
      attribution: {
        title: "Vondelpark Open Air Theater / stage canopy",
        author: "Map Recall",
        sourceUrl: "https://www.openluchttheater.nl/techniek/plattegronden/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-palette low-poly geometry; no imported meshes or texture images. Exact mapped scope with neighboring houses, courtyard recesses and park grounds retained."
      }
    },
    {
      id: "vondelpark-bandstand",
      name: "Vondelpark Muziektent / iron bandstand",
      landmarkId: "osm_bandstand_561468937",
      modelUrl: "./models/vondelpark-bandstand.glb",
      suppressOsmIds: [
        "w561468937"
      ],
      footprint: {
        centre: [
          4.871422757741471,
          52.35900936120375
        ],
        headingDegrees: 2.7423133534936426,
        lengthMetres: 8.988583900747946,
        widthMetres: 8.88511289151667
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 123.8328039969667,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.871428790909091,
          52.35900799090909
        ],
        northOffsetDegrees: -53.424882649539654,
        source: "Exact mapped pavilion roof, entrance faces the private footbridge. PDOK AHN DSM/DTM samples constrain total roof height; thin finial may be undersampled. Columns/ornament proportions reconstructed from primary heritage photographs."
      },
      attribution: {
        title: "Vondelpark Muziektent / iron bandstand",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/504754",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly pavilion geometry. No meshes or images imported. Existing park island, footbridge and audience grounds retained."
      }
    },
    {
      id: "oost-indisch-huis",
      name: "Oost-Indisch Huis and Bushuis",
      landmarkId: "extract_landmarks_1570040251",
      modelUrl: "./models/oost-indisch-huis.glb",
      suppressOsmIds: [
        "r3584291",
        "NL.IMBAG.Pand.0363100012165008"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.897856122169366,
          52.37090523766349
        ],
        headingDegrees: 30.132385501566773,
        lengthMetres: 65.47131796665981,
        widthMetres: 50.924392605043664
      },
      surveyed: {
        anchor: [
          4.897856122169366,
          52.37090523766349
        ],
        northOffsetDegrees: -59.6
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0.2676144984332254,
      attribution: {
        title: "Oost-Indisch Huis and Bushuis",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/2012",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of the current Oost-Indisch Huis/Bushuis university complex from exact mapped geometry and original primary photographer references, cross-checked against current PDOK BAG and its Kloveniersburgwal48 onderwijsfunctie VBO. Height references measured from 3DBAG AHN5 LoD2.2 planes (NAP ground0.834; Bushuis roof about14.2\u201321.7m relative, historic courtyard wings about10.3\u201317.1m); mesh uses original authored simplified roofs and details, no imported source triangles. The single actual courtyard hole and west perimeter notches remain open; adjoining Waalse Kerk and neighboring houses are retained. The historical courtyard Renaissance gable and separate 1890/1891 Peters Bushuis23-bay Neo-Renaissance canal facade have distinct silhouettes."
      }
    },
    {
      id: "het-veem",
      name: "Werkgebouw Het Veem / Oranje Nassau warehouse",
      landmarkId: "extract_landmarks_1698086177",
      modelUrl: "./models/het-veem.glb",
      suppressOsmIds: [
        "w274024256",
        "NL.IMBAG.Pand.0363100012087482"
      ],
      footprint: {
        centre: [
          4.887202592481908,
          52.39037709872149
        ],
        headingDegrees: 101.67970825541758,
        lengthMetres: 60.104736117452,
        widthMetres: 27.178718637417326
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 89.99429174458243,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.8872008000000005,
          52.3903738
        ],
        northOffsetDegrees: 11.674000000000007,
        source: "Exact OSM/current BAG parent footprint; native scale1. Roof heights/regions checked against current 3DBAG LoD2.2 survey and primary exterior photographs. Manual facade, roof and ornament reconstruction."
      },
      attribution: {
        title: "Werkgebouw Het Veem / Oranje Nassau warehouse",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/526741",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly geometry. No imported mesh or image. Other buildings, park/plaza surfaces and public paths preserved."
      }
    },
    {
      id: "tobacco-theater",
      name: "TOBACCO Theater / former Gebing tobacco office",
      landmarkId: "extract_landmarks_421921642",
      modelUrl: "./models/tobacco-theater.glb",
      suppressOsmIds: [
        "w266932382",
        "NL.IMBAG.Pand.0363100012179546"
      ],
      footprint: {
        centre: [
          4.893494636681719,
          52.3695890593804
        ],
        headingDegrees: 7.720948917293072,
        lengthMetres: 28.734665985711672,
        widthMetres: 21.449225500078356
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 271.5790510827069,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.8934941,
          52.3695978
        ],
        northOffsetDegrees: 99.30000000000001,
        source: "Exact OSM/current BAG parent footprint; native scale1. Roof heights/regions checked against current 3DBAG LoD2.2 survey and primary exterior photographs. Manual facade, roof and ornament reconstruction."
      },
      attribution: {
        title: "TOBACCO Theater / former Gebing tobacco office",
        author: "Map Recall",
        sourceUrl: "https://tobacco.nl/historie/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly geometry. No imported mesh or image. Other buildings, park/plaza surfaces and public paths preserved."
      }
    },
    {
      id: "plein-theater",
      name: "Plein Theater / shared residential building",
      landmarkId: "extract_landmarks_1701367153",
      modelUrl: "./models/plein-theater.glb",
      suppressOsmIds: [
        "w278102241",
        "NL.IMBAG.Pand.0363100012124352"
      ],
      footprint: {
        centre: [
          4.913864151085397,
          52.36093771367041
        ],
        headingDegrees: 66.99917691629415,
        lengthMetres: 31.258641973745252,
        widthMetres: 27.715535739441457
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 95.50082308370588,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.91386355,
          52.360944950000004
        ],
        northOffsetDegrees: -17.5,
        source: "Exact OSM/current BAG parent footprint; native scale1. Roof heights/regions checked against current 3DBAG LoD2.2 survey and primary exterior photographs. Manual facade, roof and ornament reconstruction."
      },
      attribution: {
        title: "Plein Theater / shared residential building",
        author: "Map Recall",
        sourceUrl: "https://www.plein-theater.nl/over-ons",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly geometry. No imported mesh or image. Other buildings, park/plaza surfaces and public paths preserved."
      }
    },
    {
      id: "hash-marihuana-hemp-museum",
      name: "Hash Marihuana & Hemp Museum",
      landmarkId: "extract_landmarks_741048430",
      modelUrl: "./models/hash-marihuana-hemp-museum.glb",
      suppressOsmIds: [
        "w266952908",
        "NL.IMBAG.Pand.0363100012178837"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.896852208624917,
          52.371801540474635
        ],
        headingDegrees: 122.45219898026488,
        lengthMetres: 20.08306280385528,
        widthMetres: 5.657733210129706
      },
      surveyed: {
        anchor: [
          4.896852208624917,
          52.371801540474635
        ],
        northOffsetDegrees: -57.6
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90.05219898026488,
      attribution: {
        title: "Hash Marihuana & Hemp Museum",
        author: "Map Recall",
        sourceUrl: "https://hashmuseum.com/en/amsterdam/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of the actual narrow red-brick three-bay Oudezijds Achterburgwal148 house, cross-checked against the museum owner\u2019s original frontage photographs and current148H VBO/Pand records. The adjoining black Sensi Seeds146 house is retained. Exact mapped rear recesses remain open. Height references use 3DBAG AHN5 relative roofmax16.672m; simplified roof and facade meshes are authored originally, with no imported source faces or textures."
      }
    },
    {
      id: "hemp-gallery",
      name: "Hemp Gallery",
      landmarkId: "osm_museum_2724369153",
      modelUrl: "./models/hemp-gallery.glb",
      suppressOsmIds: [
        "w266952890",
        "NL.IMBAG.Pand.0363100012171247"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.897208314885277,
          52.372126997533954
        ],
        headingDegrees: 122.701239396414,
        lengthMetres: 17.85028279658754,
        widthMetres: 12.500123403170502
      },
      surveyed: {
        anchor: [
          4.897208314885277,
          52.372126997533954
        ],
        northOffsetDegrees: -57.6
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90.30123939641399,
      attribution: {
        title: "Hemp Gallery",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/518459",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of the single actual five-bay Oudezijds Achterburgwal128\u2013132 block containing Hemp Gallery130, verified against RCE518459, the museum owner and current original photographer reference. Rademaker\u2019s1879\u20131881 neo-Renaissance facade has a rusticated ground floor, three full upper floors and mezzanine, with white pilasters and projecting cornices. The OSM1993 date is a register mismatch, not the architectural date. Exact rear return remains scoped to the actual building; adjoining houses remain unsuppressed. Roof reference measured from3DBAG AHN5 maxrelative19.311m; all asset meshes are original simplified geometry."
      }
    },
    {
      id: "madame-tussauds",
      name: "Madame Tussauds / Peek & Cloppenburg",
      landmarkId: "extract_landmarks_1227471359",
      modelUrl: "./models/madame-tussauds.glb",
      suppressOsmIds: [
        "w168680283",
        "NL.IMBAG.Pand.0363100012175378"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8924166515045835,
          52.372525122237114
        ],
        headingDegrees: 94.103759466783,
        lengthMetres: 43.81294642372319,
        widthMetres: 30.69666420139541
      },
      surveyed: {
        anchor: [
          4.8924166515045835,
          52.372525122237114
        ],
        northOffsetDegrees: 184.5
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 180.396240533217,
      attribution: {
        title: "Madame Tussauds / Peek & Cloppenburg",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/518421",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of Joling\u2019s1914\u20131917 Peek & Cloppenburg department-store building occupied in part by Madame Tussauds. RCE518421 and original photographer frontage guide the stone11-bay Dam facade,9-bay Rokin facade,colossal pilasters,open balconies,rose-window central gable,dormers and decorative roof vents. CurrentPDOK confirms single actualBAG2175378 with Dam20,Rokin6,Kromelleboogsteeg2 VBOs; mapped1900 date is not the architecturaldate. ExactL-shaped parent outline and rear recesses are retained. Original simplified roof regions follow AHN5 approximate21.8m eaves,31.3m mainhips,33.9m vents, and lower innerrear rooms13.85/17.3m. No imported source faces or textures; exact-only suppression retains all neighboring buildings."
      }
    },
    {
      id: "amsterdam-dungeon",
      name: "Amsterdam Dungeon / Nieuwezijds Kapel",
      landmarkId: "extract_landmarks_1198863663",
      modelUrl: "./models/amsterdam-dungeon.glb",
      suppressOsmIds: [
        "w266903954",
        "w266903867",
        "NL.IMBAG.Pand.0363100012168346",
        "NL.IMBAG.Pand.0363100012175269"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8919633178149855,
          52.37020123860339
        ],
        headingDegrees: 15.012596956822051,
        lengthMetres: 40.36408570166537,
        widthMetres: 32.38051115446507
      },
      surveyed: {
        anchor: [
          4.8919633178149855,
          52.37020123860339
        ],
        northOffsetDegrees: -74.5
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0.4874030431779488,
      attribution: {
        title: "Amsterdam Dungeon / Nieuwezijds Kapel",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/518455",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free model scoped to the two actual buildings used by Amsterdam Dungeon: currentPDOK Rokin78 bijeenkomstfunctie1277m\xB2 VBO0363010003702386 is linked to both BAG2168346 (chapel/side rooms) and2175269 (entrance wing). Other RCE518455 compound buildings including Rokin80/82 BAG2175268 andKalverstraat81/87 BAG2168348 remain visible and unsuppressed. PrimaryArcam exterior confirms two gabled venue wings and portal; the neighboring streetcorner dome is outside model scope. Original octagonal chapel,tent roof/open lantern,sculpted brick gables,stone bands and measured lower wings refer to Posthumus Meyjes\u20191908\u20131912 architecture. Heights approximate13.3\u201317.8m front,7\u201316m side rooms,18m chapel eaves,24.7m truncated tent roof and29m lantern: AHN5 raw height26.9m and reconstructedplanepeaks29.1m differ; OSM32.3m is not used as a flat mass. Exact mapped recesses retained; no imported mesh faces or textures."
      }
    },
    {
      id: "sint-jorishof",
      name: "Sint Jorishof / historic courtyard complex",
      landmarkId: "osm_building_267001389",
      modelUrl: "./models/sint-jorishof.glb",
      suppressOsmIds: [
        "w267001389",
        "NL.IMBAG.Pand.0363100012165371"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.897190642415213,
          52.37077101390563
        ],
        headingDegrees: 107.86167823744009,
        lengthMetres: 64.29186811748798,
        widthMetres: 49.53789148287094
      },
      surveyed: {
        anchor: [
          4.897190642415213,
          52.37077101390563
        ],
        northOffsetDegrees: -70.5,
        source: "Native metres/current exact PDOK perimeter; roof zones original visual simplifications measured against current AHN5 survey."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -88.36167823744009,
      attribution: {
        title: "Sint Jorishof / historic courtyard complex",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/5550",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original simplified reconstruction of current shared courtyard complex. Exact current PDOK perimeter remains concave and open, retaining Waalse Kerk and Oost-Indisch Huis. AHN5/3DBAG ground NAP0.611 and reference roofs range roughly8.1\u201320.1m above ground; original separate authored roof zones avoid treating the 20.1m maximum as every wall height. Primary heritage photos guide three-storey courtyard facades, white cornices and entrance portal. Portal position is the first intersection of the mapped alley axis with the exact parent, local[-15.8236,-13.9174]; direct RD survey polygon containment confirms its low9.059\u201311.236m roof. The small cupola position local[-15.9283,-11.0778] is explicitly inferred from primary photographs plus the tiny elevated survey roof227(0.87m2,15.322\u201316.838m). Its simplified open stage/finial are visual approximations, not exact survey measurements. Survey measurements are references, not imported roof triangles. Current BAG year1005 is not treated as historical architectural evidence; RCE records1579/1747 and earlier than1700 wings. The central courtyard axis includes the photographed1747 stone tablet and restrained original reliefs."
      }
    },
    {
      id: "walloon-church",
      name: "Walloon Church",
      landmarkId: "extract_landmarks_56521997",
      modelUrl: "./models/walloon-church.glb",
      suppressOsmIds: [
        "w158206091",
        "NL.IMBAG.Pand.0363100012171206",
        "w749356521",
        "w749356522",
        "w749356523",
        "w749386975",
        "w749386976"
      ],
      footprint: {
        centre: [
          4.897371867711793,
          52.37106990634758
        ],
        headingDegrees: 94.49689812817684,
        lengthMetres: 45.69206999573948,
        widthMetres: 40.69967153575252
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 198.73310187182324,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.8973534999999995,
          52.3710305
        ],
        northOffsetDegrees: 113.22999999999999,
        source: "Current BAG/OSM exact parent footprint at native surveyed scale 1; original simplified volumes reconciled with 3DBAG LoD2.2 roof sections, heritage description and primary exterior photographs."
      },
      attribution: {
        title: "Walloon Church",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/50",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly facade, roof and ornament geometry; no imported mesh or image. Exact parent suppression retains neighboring buildings and public open space."
      }
    },
    {
      id: "schreierstoren",
      name: "Schreierstoren / Weepers Tower",
      landmarkId: "extract_landmarks_240585875",
      modelUrl: "./models/schreierstoren.glb",
      suppressOsmIds: [
        "w57859248",
        "NL.IMBAG.Pand.0363100012182530"
      ],
      footprint: {
        centre: [
          4.902247139590537,
          52.376359237178846
        ],
        headingDegrees: 21.28079662509981,
        lengthMetres: 22.559922962138025,
        widthMetres: 10.52902743701412
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 269.91920337490023,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.902237749999999,
          52.376358249999996
        ],
        northOffsetDegrees: 111.19999999999999,
        source: "Current BAG/OSM exact parent footprint at native surveyed scale 1; original simplified volumes reconciled with 3DBAG LoD2.2 roof sections, heritage description and primary exterior photographs."
      },
      attribution: {
        title: "Schreierstoren / Weepers Tower",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/4148",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly facade, roof and ornament geometry; no imported mesh or image. Exact parent suppression retains neighboring buildings and public open space."
      }
    },
    {
      id: "huize-lydia",
      name: "Huize Lydia / Huis van de Wijk Lydia",
      landmarkId: "extract_landmarks_366321397",
      modelUrl: "./models/huize-lydia.glb",
      suppressOsmIds: [
        "w277121147",
        "NL.IMBAG.Pand.0363100012119530"
      ],
      footprint: {
        centre: [
          4.8815378377866,
          52.352868413309864
        ],
        headingDegrees: 145.5052311128626,
        lengthMetres: 49.595429224093074,
        widthMetres: 38.95435970755049
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 273.29076888713735,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.8815018,
          52.35285595
        ],
        northOffsetDegrees: 238.796,
        source: "Current BAG/OSM exact parent footprint at native surveyed scale 1; original simplified volumes reconciled with 3DBAG LoD2.2 roof sections, heritage description and primary exterior photographs."
      },
      attribution: {
        title: "Huize Lydia / Huis van de Wijk Lydia",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/505630",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly facade, roof and ornament geometry; no imported mesh or image. Exact parent suppression retains neighboring buildings and public open space."
      }
    },
    {
      id: "eye-filmmuseum",
      name: "EYE Filmmuseum",
      landmarkId: "extract_landmarks_681957397",
      modelUrl: "./models/eye-filmmuseum.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012237838",
        "w127505497",
        "w1206726812",
        "w1207014127"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.900944,
          52.384387
        ],
        headingDegrees: 90,
        lengthMetres: 110.59346833808135,
        widthMetres: 86.4647613760225
      },
      surveyed: {
        anchor: [
          4.900944,
          52.384387
        ],
        northOffsetDegrees: 0,
        source: "Native east/south metres; current shared BAG plan and AHN5 envelope, original simplified roof folds."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 180,
      attribution: {
        title: "EYE Filmmuseum",
        author: "Map Recall",
        sourceUrl: "https://www.dmaa.at/work/eye-film-institute",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free folded-shell reconstruction. Current BAG parent scope, recorded lower-level outline and approximate roof heights constrain original rounded control points. White inclined panels, southern glass ribbon, recessed lower storey and eastern cantilever are interpreted from architect photographs and the supplied Warehouse viewer. Individual roof folds, glazing contours, mullion spacing and stairs remain approximations. No imported Warehouse or survey mesh geometry; no photo pixels. The extract teaching ID681957397 is retained only as teaching identity, not suppressed as a current OSM way: current OSM way681957397 is in another country. Only verified EYE parent/levels are suppressed; A\u2019DAM, promenade and park remain separate."
      }
    },
    {
      id: "royal-theater-carre",
      name: "Royal Theater Carr\xE9",
      landmarkId: "extract_landmarks_1137362739",
      modelUrl: "./models/royal-theater-carre.glb",
      suppressOsmIds: [
        "w269000174",
        "NL.IMBAG.Pand.0363100012165489"
      ],
      footprint: {
        centre: [
          4.904245736017089,
          52.36243042368101
        ],
        headingDegrees: 73.15109016624513,
        lengthMetres: 60.15133144122461,
        widthMetres: 51.934439973235555
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 179.83737933711802,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.90426525,
          52.3624545
        ],
        northOffsetDegrees: 72.98846950336312,
        source: "Current active BAG/OSM whole theatre parent; native scale1, Amstel facade axis162.988 degrees. AHN5/3DBAG LoD2.2 envelope reconciled with primary theatre/architectural photographs; original simplified zinc cloister dome and separate modern ribbed stagehouse."
      },
      attribution: {
        title: "Royal Theater Carr\xE9",
        author: "Map Recall",
        sourceUrl: "https://arcam.nl/architectuur-gids/koninklijk-theater-carre/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly theatre, facade and ornament geometry. No imported mesh or image; exact current parent replacement preserves neighboring Amstel houses and Onbekendegracht."
      }
    },
    {
      id: "sint-nicolaas",
      name: "Sint Nicolaas Basilica",
      landmarkId: "extract_landmarks_1272308587",
      modelUrl: "./models/sint-nicolaas.glb",
      suppressOsmIds: [
        "w174996833",
        "NL.IMBAG.Pand.0363100012165691",
        "w645534930",
        "w645534931",
        "w749289632",
        "w749289633",
        "w749289634",
        "w750217059",
        "w750217060",
        "w750217061",
        "w750217062",
        "w750217063",
        "w750217064",
        "w750591088",
        "w750591090"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.9011602841322865,
          52.37644052156187
        ],
        headingDegrees: 150.27603524728386,
        lengthMetres: 52.451608220779384,
        widthMetres: 22.869811981363846
      },
      surveyed: {
        anchor: [
          4.9011602841322865,
          52.37644052156187
        ],
        northOffsetDegrees: 150.27603524728386
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Sint Nicolaas Basilica",
        author: "Map Recall",
        sourceUrl: "https://nicolaas-parochie.nl/nicolaas/over-ons/gebouw/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction of Bleijs\u2019s1884\u20131887 SintNicolaas basilica. Native geometry retains the actual52.45\xD722.87m church plan, thirteen measured in-parent OSM building parts, staggered twin6m west towers,13m octagonal crossing drum and stepped aisle/nave/transept/apse roofs. The parish documents58m dome height; modeled58m cross and56m tower crowns extend above AHN5 bulkroofmax50.889m, which does not capture fine lantern crosses. Ornament/curved metal crowns/rose window/arcaded entrance and clerestory are original simplified geometry from primary parish and architecture photographer references, with no imported source meshes/textures. Five adjacent rectory/side-annex parts outside the exact church parent and ordinary neighbors remain unsuppressed. Same-part proceduralSintNicolaas kit is replaced by this model; currentBAG1875 date is not treated as architectural evidence."
      }
    },
    {
      id: "rijksmuseum",
      name: "Rijksmuseum",
      landmarkId: "extract_landmarks_512243549",
      modelUrl: "./models/rijksmuseum.glb",
      suppressOsmIds: [
        "w431070185",
        "w431070791",
        "w431070942",
        "w517791046",
        "w749429987",
        "w749429988",
        "w749429989",
        "w749429990",
        "w749429991",
        "w749429992",
        "w749429993",
        "w749429994",
        "w749429995",
        "w749429996",
        "w749429997",
        "w749429998",
        "w749429999",
        "w749430000",
        "w749430001",
        "w749805753",
        "w749805754",
        "w749805755",
        "w749805756",
        "w749805757",
        "w749805758",
        "w749805759",
        "w749805760",
        "w749805761",
        "w749805762",
        "w749805763",
        "w749805764"
      ],
      footprint: {
        centre: [
          4.885063574936609,
          52.35986465365779
        ],
        headingDegrees: 129.4,
        lengthMetres: 137.93519237901404,
        widthMetres: 120.49669215065194
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.885063574936609,
          52.35986465365779
        ],
        northOffsetDegrees: 219.4,
        source: "OSM museum mainparent w431070185 and30 mappedparts with27\u201354m roof heights; exact groundpassage and roofedatrium voids retained."
      },
      spatialSuppression: false,
      attribution: {
        title: "Rijksmuseum",
        author: "Map Recall",
        sourceUrl: "https://www.rijksmuseum.nl/en/visitor-information/inside-the-rijksmuseum/-the-building-from-the-exterior",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free shared-palette reconstruction of Cuypers museum from official exterior imagery and exact current OpenStreetMap polygons/heights. Open central bicycle passage, hollow roofed atria, tall paired towers and Philips wing retained. Warehouse reference viewed only; no imported geometry or photo textures."
      }
    },
    {
      id: "silodam",
      name: "Silodam",
      landmarkId: "silodam",
      modelUrl: "./models/silodam.glb",
      suppressOsmIds: [
        "w57864184",
        "NL.IMBAG.Pand.0363100012149391",
        "w1038324509",
        "w1038324510",
        "w1038324511"
      ],
      footprint: {
        centre: [
          4.8905845781125485,
          52.39274079370824
        ],
        headingDegrees: 164.76785231590262,
        lengthMetres: 65.91515774263391,
        widthMetres: 40.43657598726371
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Silodam",
        author: "Map Recall",
        sourceUrl: "https://www.mvrdv.com/projects/163/silodam",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction rebuilt from MVRDV primary exterior photographs and the supplied SketchUp thumbnail as visual references only. No imported SketchUp/Warehouse geometry or photo textures. Native mapped parent and three building parts retain the ten-storey 20m-deep housing, 29m flat roof, open piles, and separate mapped 3\u20137m projecting office/public balcony. Four distinct facade neighbourhoods include continuous red gallery strips, yellow-framed double-height glass, corrugated silver cladding, large white-framed lower panes, and orange-base cladding represented by the shared warm-gold project palette. Exact current BAG/OSM identities suppress only this building; neighboring historic silos remain."
      },
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.8905845781125485,
          52.39274079370824
        ],
        northOffsetDegrees: 74.76785231590262
      }
    },
    {
      id: "westerkerk",
      name: "Westerkerk / Westertoren",
      landmarkId: "extract_landmarks_1692085215",
      modelUrl: "./models/westerkerk.glb",
      suppressOsmIds: [
        "w99203577",
        "w99205257",
        "w749268115",
        "w749268116",
        "w749268117",
        "w749268118",
        "w749287964",
        "w751083595",
        "w751083596",
        "w751083597",
        "w751083598",
        "w751083599",
        "NL.IMBAG.Pand.0363100012174221",
        "NL.IMBAG.Pand.0363100012164998"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.883896010526316,
          52.37449989605263
        ],
        headingDegrees: 273.2,
        lengthMetres: 61.11872292780377,
        widthMetres: 43.35214296082779
      },
      surveyed: {
        anchor: [
          4.883896010526316,
          52.37449989605263
        ],
        northOffsetDegrees: 3.1999999999999886,
        source: "Actual current church/tower parents and10sourceparts; native mapped roof tiers and official85m crown/87m rooster. AnneFrank complex and adjacent buildings excluded."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Westerkerk / Westertoren",
        author: "Map Recall",
        sourceUrl: "https://westerkerk.nl/bezoek-de-westerkerk-amsterdam/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free shared-palette reconstruction from current mapped church/tower polygons and official church/municipal exterior references. Double-cross roof plan, Renaissance arched windows/pilasters, stone clock tiers and blue-gold imperial crown. No imported geometry or reference pixels. Ornamental details approximate; exact source grounds and neighboring buildings retained."
      }
    },
    {
      id: "sexmuseum-venustempel",
      name: "Sexmuseum Venustempel",
      landmarkId: "extract_landmarks_175435208",
      modelUrl: "./models/sexmuseum-venustempel.glb",
      suppressOsmIds: [
        "w266648604",
        "NL.IMBAG.Pand.0363100012170952"
      ],
      footprint: {
        centre: [
          4.8970676572826966,
          52.376651769064054
        ],
        headingDegrees: 111.44082364949816,
        lengthMetres: 40.50561572553951,
        widthMetres: 9.120788613138604
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 16.05305661503553,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.897056093786398,
          52.376641612729955
        ],
        northOffsetDegrees: -52.506119735466314,
        source: "Current BAG0363100012170952 physical parent and OSMw266648604; native scale1, simplified original roof envelope calibrated to AHN5/3DBAG LoD2.2 measurements and primary architectural photographs."
      },
      attribution: {
        title: "Sexmuseum Venustempel",
        author: "Map Recall",
        sourceUrl: "https://sexmuseumamsterdam.nl/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free architectural reconstruction; no imported mesh or photograph. Exact current parent scope, neighboring narrow houses and mapped courts preserved."
      }
    },
    {
      id: "oude-lutherse-kerk",
      name: "Oude Lutherse Kerk",
      landmarkId: "extract_landmarks_1463154066",
      modelUrl: "./models/oude-lutherse-kerk.glb",
      suppressOsmIds: [
        "r3583147",
        "NL.IMBAG.Pand.0363100012165085"
      ],
      footprint: {
        centre: [
          4.889496169962845,
          52.36837375043232
        ],
        headingDegrees: 69.47451985894676,
        lengthMetres: 55.03645269255932,
        widthMetres: 40.86683779238047
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 179.85916855874166,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.889502176322695,
          52.36839687826118
        ],
        northOffsetDegrees: 69.33368841768836,
        source: "Current BAG0363100012165085 physical parent and OSM relation r3583147; native scale1, simplified original roof envelope calibrated to AHN5/3DBAG LoD2.2 measurements and primary architectural photographs."
      },
      attribution: {
        title: "Oude Lutherse Kerk",
        author: "Map Recall",
        sourceUrl: "https://www.luthersamsterdam.nl/orgel",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free architectural reconstruction; no imported mesh or photograph. Exact current parent scope, neighboring narrow houses and mapped courts preserved."
      }
    },
    {
      id: "kattenkabinet",
      name: "KattenKabinet",
      landmarkId: "extract_landmarks_1164156962",
      modelUrl: "./models/kattenkabinet.glb",
      suppressOsmIds: [
        "w267123217",
        "NL.IMBAG.Pand.0363100012168340"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.891564718450845,
          52.36565041913723
        ],
        headingDegrees: 12.612191418343116,
        lengthMetres: 20.976262163393297,
        widthMetres: 14.92796102524749
      },
      surveyed: {
        anchor: [
          4.891564718450845,
          52.36565041913723
        ],
        northOffsetDegrees: 12.267173108393777
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 89.65498169005066,
      attribution: {
        title: "KattenKabinet",
        author: "Map Recall",
        sourceUrl: "https://kattenkabinet.nl/over/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original low-poly reconstruction of Herengracht497: exact currentBAG parent, six-bay doublehouse with central classicalpediment, nineteenth-centuryT-windows, currentground-levelentrance and hippedroof withtwo dormers/twochimneys. Historicaldouble stoopremoved1837 is not invented; neighboringHerengracht495/499 remain. Native roofenvelope calibrated to AHN5 approximate13.86m eaves/19.53m ridge andlower rearreturns, sourceimages visualreference only, no imported mesh/texture."
      }
    },
    {
      id: "pianola-museum",
      name: "Pianola Museum",
      landmarkId: "extract_landmarks_660242980",
      modelUrl: "./models/pianola-museum.glb",
      suppressOsmIds: [
        "w266555881",
        "NL.IMBAG.Pand.0363100012173588"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.883565911555713,
          52.378646506954865
        ],
        headingDegrees: 162.91758463448625,
        lengthMetres: 18.220444424257835,
        widthMetres: 13.947608047202838
      },
      surveyed: {
        anchor: [
          4.883565911555713,
          52.378646506954865
        ],
        northOffsetDegrees: -16.68392197665763
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -89.60150661114388,
      attribution: {
        title: "Pianola Museum",
        author: "Map Recall",
        sourceUrl: "https://pianolamuseum.online/en/about-us/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original low-poly reconstruction of the1905former police stationWesterstraat106/currentPianolaMuseum parent: exactcurrentBAGplan with projectingoriel, asymmetricfivebaystreetfront, centralcrenellatedtower, round-head dormers, reddishtile roof andlowerrearflatwings. Actual3DBAGapprox12.84m eaves/16.37m ridge, currentmuseumground-levelentrance; adjacentparents retained. Sourcesvisualreferenceonly; no importedmesh/texture."
      }
    },
    {
      id: "montelbaanstoren-amsterdam",
      name: "Montelbaanstoren",
      landmarkId: "extract_landmarks_1027016792",
      modelUrl: "./models/montelbaanstoren-amsterdam.glb",
      suppressOsmIds: [
        "w57864086",
        "w751647817",
        "w751647818",
        "w751647819",
        "w751647820",
        "NL.IMBAG.Pand.0363100012181906"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.90566385,
          52.3720335
        ],
        headingDegrees: 90,
        lengthMetres: 11.621912657196383,
        widthMetres: 11.933504000244284
      },
      surveyed: {
        anchor: [
          4.90566385,
          52.3720335
        ],
        northOffsetDegrees: 0,
        source: "Exact mapped round foundation and four stepped octagonal tower parts; local east/south metres. Native48m ornamental top from primaryheritage reference."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Montelbaanstoren",
        author: "Map Recall",
        sourceUrl: "https://www.archivolt.eu/files/projects/028/amsterdam-montelbaanstoren-a4_w.pdf",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free shared-palette reconstruction from exact current mapped footing/steppedtiers and restorationarchitect exteriorphotograph. Redbrick roundbase, white Renaissance lanterns, gilded open-finial silhouette. Window/ornament details approximate. No imported geometry/photo texture; adjacent houses/canal retained."
      }
    },
    {
      id: "munttoren-amsterdam",
      name: "Munttoren / Muntgebouw",
      landmarkId: "extract_landmarks_1375175685",
      modelUrl: "./models/munttoren-amsterdam.glb",
      suppressOsmIds: [
        "w57862728",
        "w751683816",
        "w751683817",
        "w751683818",
        "w751683819",
        "w751683820",
        "w751698382",
        "w751698383",
        "w751698384",
        "NL.IMBAG.Pand.0363100012168045"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8932132,
          52.3670559
        ],
        headingDegrees: 90,
        lengthMetres: 28.69100677281662,
        widthMetres: 8.738620000084438
      },
      surveyed: {
        anchor: [
          4.8932132,
          52.3670559
        ],
        northOffsetDegrees: 0,
        source: "Actual mapped Munttoren compound parent/eight source parts, preserved 3 m covered link. Native 41 m upper finial per conservation heritage description/current photographs; no model fitting."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Munttoren / Muntgebouw",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/3729",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free shared-palette reconstruction from exact current mapped footing/host/tier polygons and current conservation expert photographs. Round brick base, octagonal stone/lead tiers, large black/gold dials and open bell/pear-shaped finial. Window/ornament details approximate; no imported geometry/photo texture. Covered ground link retained; bridge, streets and neighbors omitted."
      }
    },
    {
      id: "national-monument-on-the-dam",
      name: "National Monument on the Dam",
      assetKind: "memorial",
      landmarkId: "extract_landmarks_720777797",
      modelUrl: "./models/national-monument-on-the-dam.glb",
      suppressOsmIds: [
        "w168680619",
        "n5413222221",
        "n5413222222",
        "w940729263",
        "w1320477257"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8936887569767435,
          52.37281966395349
        ],
        headingDegrees: 90,
        lengthMetres: 47.93140716581357,
        widthMetres: 46.54650399967858
      },
      surveyed: {
        anchor: [
          4.8936887569767435,
          52.37281966395349
        ],
        northOffsetDegrees: 0,
        source: "Current mapped 36.97 m circular podium, exact curved urn wall and pylon/relief base, plus separately mapped lion positions. Native local east/south coordinates; no legacy fitted rectangle. Internal heights and sculpture details approximate."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "National Monument on the Dam",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/530906",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free shared-palette reconstruction from the exact mapped podium, curved wall, pylon/relief base and separate lion positions, primary heritage description and Committee photographs. Six concentric steps, pale conical pylon, curved urn wall and original faceted sculpture silhouettes. Internal details approximate; surrounding Dam square and host buildings retained. No downloaded geometry or photo pixels."
      }
    },
    {
      id: "de-beurs-van-berlage",
      name: "Beurs van Berlage",
      landmarkId: "extract_landmarks_1104215352",
      modelUrl: "./models/de-beurs-van-berlage.glb",
      suppressOsmIds: [
        "w57858502",
        "w749918629",
        "w749918630",
        "w749918631",
        "w749918632",
        "w749918633",
        "w749918634",
        "w749918635",
        "w749918636",
        "w749918637",
        "w749918638",
        "w749918639",
        "w749918641",
        "w749918642",
        "w749918643",
        "w749918644",
        "w749918645",
        "w749918646",
        "w749918647",
        "w749918648",
        "w749918649",
        "w749918650",
        "w749918651",
        "w749918652",
        "w749918653",
        "w749918654",
        "w749931375",
        "w749931376",
        "w749931377",
        "w749931378",
        "w749931379",
        "w749931380",
        "w749931381",
        "w749931382",
        "w749931383",
        "w750005616",
        "w750005617",
        "w750166476",
        "w750166477",
        "w750166478",
        "w750166479",
        "NL.IMBAG.Pand.0363100012171966"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.896210789570552,
          52.37513358466257
        ],
        headingDegrees: 90,
        lengthMetres: 128.82427674050848,
        widthMetres: 135.5654960006973
      },
      surveyed: {
        anchor: [
          4.896210789570552,
          52.37513358466257
        ],
        northOffsetDegrees: 0,
        source: "Current exact parent and forty mapped roof/tower/inner-court parts; native anchor, source heights and roof slopes. No legacy fitted rectangle or adjacent buildings."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Beurs van Berlage",
        author: "Map Recall",
        sourceUrl: "https://beursvanberlage.com/a-building-like-the-beurs-deserves-care/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free shared-palette reconstruction from exact current mapped parent/forty parts and official restored-exterior photographs. Brick facades, stone-framed paired windows, entrance arches, low inner roofs and 40 m clock tower with original blue/red/gold dial interpretation. Window/ornament details approximate. No imported mesh or photo pixels; adjacent streets and buildings retained."
      }
    },
    {
      id: "amsta-de-poort",
      name: "Amsta De Poort",
      landmarkId: "amsta-de-poort",
      modelUrl: "./models/amsta-de-poort.glb",
      suppressOsmIds: [
        "w220525683",
        "NL.IMBAG.Pand.0363100012237064"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8735112432713015,
          52.37350397269679
        ],
        headingDegrees: 71.81808321129071,
        lengthMetres: 72.03219885973493,
        widthMetres: 51.065153370485824
      },
      surveyed: {
        anchor: [
          4.873552902185253,
          52.373488756470465
        ],
        northOffsetDegrees: -18.319999999999993
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 89.8619167887093,
      attribution: {
        title: "Amsta De Poort",
        author: "Map Recall",
        sourceUrl: "https://www.amsta.nl/locaties/de-poort",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original low-poly reconstruction of actual1966 nursing-home parent with1969 operation recorded separately: six occupied facade rows, recessed brick-column ground storey, ochre-panel glass room strips, projecting front bays, rooftop ribbon/setback, actual14.1m rear wing and23.65/27.75m main roofs. Small service structure reaches31.7m; whole footprint is not extruded to the old31.7m OSM maximum. Official facade imagery is visual reference only, no imported mesh or photo texture. CurrentBAG and AHN5 survey calibrate native massing; attached neighboring residential/school parents and courtyard void remain. Front glazing follows the owner facade photograph; rear/side window rhythm is inferred rather than measured. Explicit roof panels own upward caps to avoid coplanar flicker."
      }
    },
    {
      id: "rembrandt-tower",
      name: "Rembrandt Tower",
      landmarkId: "osm_building_44451577",
      modelUrl: "./models/rembrandt-tower.glb",
      suppressOsmIds: [
        "w44451577",
        "NL.IMBAG.Pand.0363100012113758",
        "w754399963",
        "w754399964",
        "w754399965",
        "w754399966",
        "w754399967",
        "w754399968",
        "w754399969",
        "w754399970",
        "w754399971",
        "w754399972",
        "w754399973"
      ],
      footprint: {
        centre: [
          4.917060393089527,
          52.34506421222511
        ],
        headingDegrees: 159.4775109936597,
        lengthMetres: 48.0924042566222,
        widthMetres: 48.05852548433693
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0.22248900634028246,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.917031687807691,
          52.3450817261875
        ],
        northOffsetDegrees: -20.3,
        source: "Current BAG 0363100012113758 and exact OSM parent; native +X heading 69.7 degrees, scale 1. Original simplified roof/terrace massing based on 3DBAG/AHN measured envelope and primary architectural references; published architecture heights guide visible crowns rather than copying a third-party mesh."
      },
      attribution: {
        title: "Rembrandt Tower",
        author: "Map Recall",
        sourceUrl: "https://arcam.nl/architectuur-gids/rembrandttoren/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction. Exact physical parent scope; separate Blookerhuisje, Rotonda, neighbouring towers and the shared public square retained."
      }
    },
    {
      id: "breitner-tower",
      name: "Breitner Tower / Breitner Center",
      landmarkId: "osm_building_279841030",
      modelUrl: "./models/breitner-tower.glb",
      suppressOsmIds: [
        "w279841030",
        "NL.IMBAG.Pand.0363100012070861",
        "w754399978",
        "w463020446",
        "w754399974",
        "w754399975",
        "w754399976",
        "w754399977",
        "w754399979",
        "w754399980",
        "r10396839"
      ],
      footprint: {
        centre: [
          4.9163509978620015,
          52.34472019794773
        ],
        headingDegrees: 159.49559371157028,
        lengthMetres: 111.69773778800698,
        widthMetres: 28.675251217411237
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0.2044062884297091,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.916345037374623,
          52.34470057536986
        ],
        northOffsetDegrees: -20.3,
        source: "Current BAG 0363100012070861 and exact OSM parent; native +X heading 69.7 degrees, scale 1. Original simplified roof/terrace massing based on 3DBAG/AHN measured envelope and primary architectural references; published architecture heights guide visible crowns rather than copying a third-party mesh."
      },
      attribution: {
        title: "Breitner Tower / Breitner Center",
        author: "Map Recall",
        sourceUrl: "https://www.zzdp.nl/nl/project/de-omval",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction. Exact physical parent scope; separate Blookerhuisje, Rotonda, neighbouring towers and the shared public square retained."
      }
    },
    {
      id: "mondriaan-tower",
      name: "Mondriaan Tower",
      landmarkId: "osm_building_279842059",
      modelUrl: "./models/mondriaan-tower.glb",
      suppressOsmIds: [
        "w279842059",
        "NL.IMBAG.Pand.0363100012097541",
        "w754399954",
        "w754399955",
        "w754399956",
        "w754399957",
        "w754399958",
        "w754399959",
        "w754399960",
        "w754399961",
        "r10396838"
      ],
      footprint: {
        centre: [
          4.9173687631678735,
          52.3440175406779
        ],
        headingDegrees: 69.48566007198855,
        lengthMetres: 59.170833187125076,
        widthMetres: 29.340644963658846
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90.21433992801144,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.917383745624289,
          52.34402338555016
        ],
        northOffsetDegrees: -20.3,
        source: "Current BAG 0363100012097541 and exact OSM parent; native +X heading 69.7 degrees, scale 1. Original simplified roof/terrace massing based on 3DBAG/AHN measured envelope and primary architectural references; published architecture heights guide visible crowns rather than copying a third-party mesh."
      },
      attribution: {
        title: "Mondriaan Tower",
        author: "Map Recall",
        sourceUrl: "https://www.mondriaan-tower.nl/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction. Exact physical parent scope; separate Blookerhuisje, Rotonda, neighbouring towers and the shared public square retained."
      }
    },
    {
      id: "de-piramides",
      name: "De Piramides",
      landmarkId: "osm_building_276272893",
      modelUrl: "./models/de-piramides.glb",
      suppressOsmIds: [
        "w276272893",
        "NL.IMBAG.Pand.0363100012110293",
        "w1080809439",
        "w1080809440",
        "w1080809441",
        "w1080809442",
        "w1080809443",
        "w1080809444",
        "w1080809445",
        "w1080809446",
        "w1080809447",
        "w1080809448",
        "w1080809449",
        "w1080809450",
        "w1080809451",
        "w1080809452"
      ],
      footprint: {
        centre: [
          4.866884215446545,
          52.37540721557084
        ],
        headingDegrees: 81.45079813511978,
        lengthMetres: 65.5709901923359,
        widthMetres: 25.170773722289375
      },
      groundAltitudeMetres: 0,
      spatialSuppression: false,
      facingOffsetDegrees: 90.04920186488022,
      surveyed: {
        anchor: [
          4.866881797272151,
          52.3754167167955
        ],
        northOffsetDegrees: -8.5,
        source: "Current BAG 0363100012110293 and fourteen exact mapped building parts. Native +X heading 81.5degrees, scale 1; measured 3DBAG 55.083 m roof envelope relative to ground, mapped 55 m twin crowns. Primary architect photos guide original masonry/window/terrace details."
      },
      attribution: {
        title: "De Piramides",
        author: "Map Recall",
        sourceUrl: "https://pphp.nl/project/piramides-amsterdam-concept/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly reconstruction of the actual twin stepped residential building. Adjacent Marcanti College and surrounding low-rise housing remain separate."
      }
    },
    {
      id: "zuiveringshal-west",
      name: "Zuiveringshal West \xB7 Fabrique des Lumi\xE8res",
      landmarkId: "fabrique-des-lumieres",
      modelUrl: "./models/zuiveringshal-west.glb",
      suppressOsmIds: [
        "w274066572",
        "NL.IMBAG.Pand.0363100012236268",
        "w274066787",
        "NL.IMBAG.Pand.0363100012236955",
        "w274066816",
        "NL.IMBAG.Pand.0363100012235891",
        "w274066616",
        "NL.IMBAG.Pand.0363100012236658",
        "w274066838",
        "NL.IMBAG.Pand.0363100012236031",
        "w274066643",
        "NL.IMBAG.Pand.0363100012236961",
        "w274066620",
        "NL.IMBAG.Pand.0363100012236221",
        "w274066822",
        "NL.IMBAG.Pand.0363100012236613",
        "w274066793",
        "NL.IMBAG.Pand.0363100012236642",
        "w274066820",
        "NL.IMBAG.Pand.0363100012235912",
        "w274066812",
        "NL.IMBAG.Pand.0363100012237038",
        "w274066717",
        "NL.IMBAG.Pand.0363100012236152",
        "w274066798",
        "NL.IMBAG.Pand.0363100012236665",
        "w274066818",
        "NL.IMBAG.Pand.0363100012236260",
        "w274066824",
        "NL.IMBAG.Pand.0363100012236412"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.872148914070394,
          52.38597705909584
        ],
        headingDegrees: 88.38277400738434,
        lengthMetres: 68.12957158750693,
        widthMetres: 41.41800754626077
      },
      surveyed: {
        anchor: [
          4.872149301126166,
          52.3859766755098
        ],
        northOffsetDegrees: -1.6200000000000045
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90.00277400738435,
      attribution: {
        title: "Zuiveringshal West \xB7 Fabrique des Lumi\xE8res",
        author: "Map Recall",
        sourceUrl: "https://www.fabrique-lumieres.com/en",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly Westergas hall ensemble authored against current disjoint BAG/OSM parents. High17.34m/17.9m halls retain separately mapped low~10.55m street/rear wings, gray pitched roofs and rooflights; primary venue photographs guide arched industrial windows and current entrance portals. AHN5/3DBAG roof envelopes calibrate native height hierarchy, not imported source mesh. Window rhythm and ornamental finial heights are approximate from visual references. Exact-only replacement excludes central connector2236902, existing Gashouder/Ketelhuis and all neighboring ensembles. Each independently operated venue retains its own route/card identity; Krakeling uses the current game identity at Pazzanistraat15, not its former city-center location."
      }
    },
    {
      id: "amsterdam-in-motion",
      name: "Amsterdam in Motion \xB7 Zuiveringshal Oost",
      landmarkId: "amsterdam-in-motion",
      modelUrl: "./models/amsterdam-in-motion.glb",
      suppressOsmIds: [
        "w274066840",
        "NL.IMBAG.Pand.0363100012236269",
        "w274066772",
        "NL.IMBAG.Pand.0363100012236486",
        "w274066814",
        "NL.IMBAG.Pand.0363100012236952",
        "w274066625",
        "NL.IMBAG.Pand.0363100012236651",
        "w274066800",
        "NL.IMBAG.Pand.0363100012237235",
        "w274066776",
        "NL.IMBAG.Pand.0363100012236699",
        "w274066807",
        "NL.IMBAG.Pand.0363100012236180",
        "w274066632",
        "NL.IMBAG.Pand.0363100012237241"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.873243911684909,
          52.385996221555054
        ],
        headingDegrees: 178.38518176963328,
        lengthMetres: 41.46894644246084,
        widthMetres: 32.87974491271963
      },
      surveyed: {
        anchor: [
          4.873240886305469,
          52.385996206559895
        ],
        northOffsetDegrees: -1.6200000000000045
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -180.00518176963328,
      attribution: {
        title: "Amsterdam in Motion \xB7 Zuiveringshal Oost",
        author: "Map Recall",
        sourceUrl: "https://www.amsterdammuseum.nl/tickets-en-bezoek/locaties/amsterdam-in-motion/228553",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly Westergas hall ensemble authored against current disjoint BAG/OSM parents. High17.34m/17.9m halls retain separately mapped low~10.55m street/rear wings, gray pitched roofs and rooflights; primary venue photographs guide arched industrial windows and current entrance portals. AHN5/3DBAG roof envelopes calibrate native height hierarchy, not imported source mesh. Window rhythm and ornamental finial heights are approximate from visual references. Exact-only replacement excludes central connector2236902, existing Gashouder/Ketelhuis and all neighboring ensembles. Each independently operated venue retains its own route/card identity; Krakeling uses the current game identity at Pazzanistraat15, not its former city-center location."
      }
    },
    {
      id: "de-krakeling",
      name: "Theater De Krakeling",
      landmarkId: "extract_landmarks_1635482107",
      modelUrl: "./models/de-krakeling.glb",
      suppressOsmIds: [
        "w274066580",
        "NL.IMBAG.Pand.0363100012235989",
        "w274066614",
        "NL.IMBAG.Pand.0363100012236443",
        "w274066641",
        "NL.IMBAG.Pand.0363100012237301",
        "w274066587",
        "NL.IMBAG.Pand.0363100012236702",
        "w274066806",
        "NL.IMBAG.Pand.0363100012236527",
        "w274066662",
        "NL.IMBAG.Pand.0363100012236566"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.873736814604472,
          52.38600465670549
        ],
        headingDegrees: 88.39749239264023,
        lengthMetres: 52.10799579808097,
        widthMetres: 41.461485886013406
      },
      surveyed: {
        anchor: [
          4.873684349406492,
          52.38600418652962
        ],
        northOffsetDegrees: -1.6200000000000045
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90.01749239264024,
      attribution: {
        title: "Theater De Krakeling",
        author: "Map Recall",
        sourceUrl: "https://krakeling.nl/over-ons",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly Westergas hall ensemble authored against current disjoint BAG/OSM parents. High17.34m/17.9m halls retain separately mapped low~10.55m street/rear wings, gray pitched roofs and rooflights; primary venue photographs guide arched industrial windows and current entrance portals. AHN5/3DBAG roof envelopes calibrate native height hierarchy, not imported source mesh. Window rhythm and ornamental finial heights are approximate from visual references. Exact-only replacement excludes central connector2236902, existing Gashouder/Ketelhuis and all neighboring ensembles. Each independently operated venue retains its own route/card identity; Krakeling uses the current game identity at Pazzanistraat15, not its former city-center location."
      }
    },
    {
      id: "nemo",
      name: "NEMO Science Museum",
      landmarkId: "extract_landmarks_1875483593",
      modelUrl: "./models/nemo.glb",
      suppressOsmIds: [
        "w57856769",
        "w1390692763",
        "w1390692764",
        "w1390692765",
        "w1390692766",
        "w1390692767",
        "w1390692768",
        "w1390692769",
        "w1390692770",
        "w1390692771",
        "w1390692772",
        "NL.IMBAG.Pand.0363100012164988"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.912322028079611,
          52.3741956935447
        ],
        headingDegrees: 90,
        lengthMetres: 44.8339207526614,
        widthMetres: 117.2867519998627
      },
      surveyed: {
        anchor: [
          4.912322028079611,
          52.3741956935447
        ],
        northOffsetDegrees: 0,
        source: "Exact current parent and ten roof/stair/annex polygons, native coordinates and part maximum heights. Original curved roofs/flared copper shell; no old import fitting or street slab."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "NEMO Science Museum",
        author: "Map Recall",
        sourceUrl: "https://www.rpbw.com/project/nemo-national-center-for-science-and-technology",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction from current mapped parent/ten parts and primary architect/museum exterior photographs. Copper-green flared wedge, ascending roof stairs, mapped green roof and glazed lobby. Curvature and ornaments approximate; no downloaded mesh or photo pixels. Bridge, tunnel approaches and nearby buildings retained."
      }
    },
    {
      id: "sloterdijk-station",
      name: "Amsterdam Sloterdijk Station",
      landmarkId: "osm_building_268460687",
      modelUrl: "./models/sloterdijk-station.glb",
      suppressOsmIds: [
        "w268460687",
        "NL.IMBAG.Pand.0363100012120833"
      ],
      footprint: {
        centre: [
          4.838214466204455,
          52.388991330978456
        ],
        headingDegrees: 90.96814969006601,
        lengthMetres: 108.01202901198465,
        widthMetres: 79.4406584713856
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 89.03185030993399,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.8382093052835575,
          52.38899714869885
        ],
        northOffsetDegrees: 0,
        source: "Current BAG 0363100012120833 and exact OSM parent. Native +X faces east at 90 degrees, scale 1; primary current facade photos and measured 3DBAG roof envelope guide original texture-free geometry."
      },
      attribution: {
        title: "Amsterdam Sloterdijk Station",
        author: "Map Recall",
        sourceUrl: "https://arcam.nl/architectuur-gids/station-sloterdijk/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original glass hall, open white table trusses and raised deck; open circulation below retained. Separate platform canopies, Orlyplein public space and adjacent hotel not suppressed."
      }
    },
    {
      id: "hnk-sloterdijk",
      name: "HNK Amsterdam Sloterdijk",
      landmarkId: "osm_building_57866724",
      modelUrl: "./models/hnk-sloterdijk.glb",
      suppressOsmIds: [
        "w57866724",
        "NL.IMBAG.Pand.0363100012131039"
      ],
      footprint: {
        centre: [
          4.835183318193806,
          52.39104959620991
        ],
        headingDegrees: 176.4349486881305,
        lengthMetres: 68.38611907408828,
        widthMetres: 42.50977977676619
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 3.565051311869496,
      spatialSuppression: false,
      surveyed: {
        anchor: [
          4.835180875927809,
          52.39104404000188
        ],
        northOffsetDegrees: 0,
        source: "Current BAG 0363100012131039 and exact OSM parent. Native +X faces east at 90 degrees, scale 1; primary current facade photos and measured 3DBAG roof envelope guide original texture-free geometry."
      },
      attribution: {
        title: "HNK Amsterdam Sloterdijk",
        author: "Map Recall",
        sourceUrl: "https://hnk.nl/en/locations/amsterdam-sloterdijk",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original white pronged office block, curved glazing, exposed escape stairs and measured roof plant. Former FNV/ArboNed labels are historical occupants, not additional destinations or exterior architect attribution."
      }
    },
    {
      id: "palace-on-the-dam",
      name: "Royal Palace Amsterdam",
      landmarkId: "extract_landmarks_342809743",
      modelUrl: "./models/palace-on-the-dam.glb",
      suppressOsmIds: [
        "r3580875",
        "w748659170",
        "w748659171",
        "w748659172",
        "w748659173",
        "w748659174",
        "w748659175",
        "w748659176",
        "w748659177",
        "w748659178",
        "w748659179",
        "w748659180",
        "w748659181",
        "w748659182",
        "w748659183",
        "w748659184",
        "w748659185",
        "w748659186",
        "w748659187",
        "w57856712",
        "NL.IMBAG.Pand.0363100012167579"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.891336076094146,
          52.373148321742
        ],
        headingDegrees: 90,
        lengthMetres: 66.09371218019203,
        widthMetres: 82.3879320001754
      },
      surveyed: {
        anchor: [
          4.891336076094146,
          52.373148321742
        ],
        northOffsetDegrees: 0,
        source: "Exact current parent relation, 18 parts and two open courtyard holes; native placement and source roof profiles. Original 55m tower corroborated by official Palace and current 3DBAG 55.201m maximum above ground."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Royal Palace Amsterdam",
        author: "Map Recall",
        sourceUrl: "https://www.paleisamsterdam.nl/en/discover-palace/new-town-hall-amsterdam/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free stone classical facade, mapped slate roof wings, corner pavilions, two open courtyards, central pediment and open 55m domed clock tower. Exact OSM/BAG footprint; original ornaments approximated from official Palace photograph. No copied imported geometry or reference pixels."
      }
    },
    {
      id: "machinegebouw",
      name: "Machinegebouw \xB7 Cantine",
      landmarkId: "cantine-de-caron",
      modelUrl: "./models/machinegebouw.glb",
      suppressOsmIds: [
        "w42298030",
        "NL.IMBAG.Pand.0363100012152471"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.872808548242466,
          52.38634502299453
        ],
        headingDegrees: 88.31856627968506,
        lengthMetres: 25.7027472649258,
        widthMetres: 17.955190280247155
      },
      surveyed: {
        anchor: [
          4.872808548242466,
          52.38634502756621
        ],
        northOffsetDegrees: -1.681433720314942
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Machinegebouw \xB7 Cantine",
        author: "Map Recall",
        sourceUrl: "https://cantine.nl/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly architecture. Exact current BAG/OSM outline and AHN5/3DBAG roof envelope guide manually authored walls and unequal roof levels; primary owner photographs and RCE descriptions guide original arched windows, masonry bands and current entrance. Window ornament is approximate. Machinegebouw retains two parallel unequal ridges at 12.8 and 10.15 metres; De Wester retains the 15.33-metre main hall and separate low western entrance roof. No imported mesh or textures, no vanished chimney or roof ventilator. Exact-only parent replacement preserves adjacent WestWeelde and all other Westergas buildings."
      }
    },
    {
      id: "de-wester",
      name: "De Wester \xB7 Transformatorhuis",
      landmarkId: "de-wester",
      modelUrl: "./models/de-wester.glb",
      suppressOsmIds: [
        "w57867037",
        "NL.IMBAG.Pand.0363100012166956"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.870118520583264,
          52.38684718893202
        ],
        headingDegrees: 88.6360509504791,
        lengthMetres: 48.010353075402364,
        widthMetres: 19.673421387625524
      },
      surveyed: {
        anchor: [
          4.870119186757984,
          52.38685189098992
        ],
        northOffsetDegrees: -1.3639490495208975
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 180,
      attribution: {
        title: "De Wester \xB7 Transformatorhuis",
        author: "Map Recall",
        sourceUrl: "https://westergas.nl/en/de-wester-as-event-venue/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly architecture. Exact current BAG/OSM outline and AHN5/3DBAG roof envelope guide manually authored walls and unequal roof levels; primary owner photographs and RCE descriptions guide original arched windows, masonry bands and current entrance. Window ornament is approximate. Machinegebouw retains two parallel unequal ridges at 12.8 and 10.15 metres; De Wester retains the 15.33-metre main hall and separate low western entrance roof. No imported mesh or textures, no vanished chimney or roof ventilator. Exact-only parent replacement preserves adjacent WestWeelde and all other Westergas buildings."
      }
    },
    {
      id: "amstel-hotel",
      name: "Amstel Hotel",
      landmarkId: "amstel-hotel",
      modelUrl: "./models/amstel-hotel.glb",
      suppressOsmIds: [
        "w268998398",
        "NL.IMBAG.Pand.0363100012165491"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.90511362939625,
          52.35997963537399
        ],
        headingDegrees: 163.2148645974187,
        lengthMetres: 87.12102267135651,
        widthMetres: 30.42622936228252
      },
      surveyed: {
        anchor: [
          4.905142672706717,
          52.35999084096068
        ],
        northOffsetDegrees: 73.21486459741871
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90,
      attribution: {
        title: "Amstel Hotel",
        author: "Map Recall",
        sourceUrl: "https://www.amstelhotel.com/history/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly architecture calibrated to the current canonical PDOK parent and large AHN5/3DBAG roof levels. Principal mansard roofs25.3\u201327.1m, end pavilions28.35m and central pavilion29.54m retain low3.5m terrace and8.5\u201311.5m river conservatory. Primary hotel/Intercontinental photos guide original masonry/window/dormer rhythm and simplified corner lion sculptures. Ornament and turrets approximate from photographs; no imported mesh or texture and no neighboring suppression."
      }
    },
    {
      id: "concertgebouw",
      name: "Royal Concertgebouw",
      landmarkId: "extract_landmarks_626684803",
      modelUrl: "./models/concertgebouw.glb",
      suppressOsmIds: [
        "w46696080",
        "NL.IMBAG.Pand.0363100012233435",
        "w754269603",
        "w754269604",
        "w754269605",
        "w754269606",
        "w754269607",
        "w754269608",
        "w754269609",
        "w754269610",
        "w754269611",
        "w754276795",
        "w754276796",
        "w754276797"
      ],
      footprint: {
        centre: [
          4.879022231224272,
          52.35624462484694
        ],
        headingDegrees: 58.92662097254748,
        lengthMetres: 85.33398544808925,
        widthMetres: 64.24249063999933
      },
      spatialSuppression: false,
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 368.37337902745253,
      surveyed: {
        anchor: [
          4.879044208914783,
          52.35621988842513
        ],
        northOffsetDegrees: 247.3,
        source: "Current BAG whole parent with both inner courts retained, current OSM mapped parts and primary Concertgebouw facade/restoration photographs. Native front axis337.3 degrees, +Z faces northeast. AHN5 roof plane envelopes guide original low-poly roof surfaces; old OSM25m pavilion tags rejected for measured21.6m caps."
      },
      attribution: {
        title: "Royal Concertgebouw",
        author: "Map Recall",
        sourceUrl: "https://www.concertgebouw.nl/en/our-history/history",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original project-native pale-stone/red-brick classical facade, columned pediment, golden lyre, four roof pavilions and Pi de Bruijn glass promenade. No imported legacy mesh or textures; roof contours derived from open surveyed data."
      }
    },
    {
      id: "stadhuis",
      name: "Stadhuis / Nationale Opera & Ballet",
      landmarkId: "extract_landmarks_1919682395",
      modelUrl: "./models/stadhuis.glb",
      suppressOsmIds: [
        "w268782345",
        "w751591420",
        "w751559653",
        "w751559654",
        "w751559655",
        "w751559656",
        "w751559657",
        "w751559658",
        "w751559659",
        "w751559660",
        "w751559661",
        "w751559663",
        "w751559664",
        "w751559665",
        "w751567319",
        "w751567320",
        "w751567321",
        "w751573304",
        "w751573305",
        "w751573306",
        "w751591418",
        "w751591419",
        "w751612860",
        "w751612861",
        "w751612862",
        "NL.IMBAG.Pand.0363100012186092"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.90086458624536,
          52.367798989750916
        ],
        headingDegrees: 90,
        lengthMetres: 209.20768610521935,
        widthMetres: 198.1495999996173
      },
      surveyed: {
        anchor: [
          4.90086458624536,
          52.367798989750916
        ],
        northOffsetDegrees: 0,
        source: "Exact current two same-BAG parents and 23 mapped parts including recorded elevated volumes/glazed passage roofs; mapped heights5\u201322m, complex 3DBAG maximum not assigned to whole component."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Stadhuis / Nationale Opera & Ballet",
        author: "Map Recall",
        sourceUrl: "https://www.operaballet.nl/stopera-amsterdam",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free shared-palette city-hall and opera ensemble, rebuilt against native current roof/part polygons. Curved marble foyer bays, brick auditorium, stepped office wings, glazed passage canopy and raised volumes preserve source apertures. No imported geometry/textures, whole-parcel cap or proposed future garden interiors."
      }
    },
    {
      id: "heineken-experience-amsterdam",
      name: "Heineken Experience",
      landmarkId: "extract_landmarks_914627337",
      modelUrl: "./models/heineken-experience-amsterdam.glb",
      suppressOsmIds: [
        "w44451454",
        "NL.IMBAG.Pand.0363100012166152"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.891634499471685,
          52.35771184229546
        ],
        headingDegrees: 275.66,
        lengthMetres: 96.73778031683932,
        widthMetres: 44.705812770835806
      },
      surveyed: {
        anchor: [
          4.891634499471685,
          52.35771184229546
        ],
        northOffsetDegrees: 185.66000000000003
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Heineken Experience",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/complexen/527808",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original manual facade details and regional massing. AHN5 2023 roof-plane samples calibrate rebuilt roof patch surfaces; no imported asset mesh. Current single BAG parent encloses three surviving historic fronts and low museum wings; surrounding 1990s residences/retail stay outside exact suppression. BAG nominal 1886 does not date all present parts: RCE identifies 1911\u201313/1925/1933\u201334."
      }
    },
    {
      id: "faralda-crane-hotel",
      name: "Faralda NDSM Crane Hotel Amsterdam",
      landmarkId: "extract_landmarks_1759004236",
      modelUrl: "./models/faralda-crane-hotel.glb",
      suppressOsmIds: [
        "w280619914",
        "NL.IMBAG.Pand.0363100012241774"
      ],
      footprint: {
        centre: [
          4.894817040473574,
          52.39937946222803
        ],
        headingDegrees: 101.98499708839654,
        lengthMetres: 11.939848301110935,
        widthMetres: 8.634885206243403
      },
      spatialSuppression: false,
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90.08499708839653,
      surveyed: {
        anchor: [
          4.894841236019676,
          52.39937627409353
        ],
        northOffsetDegrees: 11.900000000000006,
        source: "Current in-use BAG 0363100012241774 crane base; canonical OSM w280619914. Original open steel structure constrained by primary IAA, operator and shipyard height/photographs. Native +X heading 101.9 degrees follows base edges; rotating crane boom is shown at a representative orientation. 3DBAG 14.925m roof is studio-only undersampling, not the true 50m crane."
      },
      attribution: {
        title: "Faralda Crane Hotel",
        author: "Map Recall",
        sourceUrl: "https://www.iaa-architecten.nl/projecten/feralda-crane-hotel/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original project-native open steel crane, red hotel suites/lifts, yellow lattice boom and counterweight. No imported meshes/textures."
      }
    },
    {
      id: "ing-house",
      name: "ING House / Infinity",
      landmarkId: "osm-way-57856367",
      modelUrl: "./models/ing-house.glb",
      suppressOsmIds: [
        "w57856367",
        "NL.IMBAG.Pand.0363100012068127"
      ],
      footprint: {
        centre: [
          4.85519,
          52.33717
        ],
        headingDegrees: 85,
        lengthMetres: 137.75,
        widthMetres: 28.62
      },
      spatialSuppression: false,
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.85519,
          52.33717
        ],
        northOffsetDegrees: 5,
        source: "Current in-use BAG0363100012068127;OSMw57856367 exact surveyed outline. 138m longitudinal eastward85deg axis, roof profile measured from AHN5/3DBAG and calibrated against primary MVSA photos. Original native-scale reconstruction, not imported mesh."
      },
      attribution: {
        title: "ING House / Infinity",
        author: "Map Recall",
        sourceUrl: "https://mvsa-architects.com/en/projects/ing-house/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free flat-color glass/aluminium wedge, rounded auditorium nose, 16steel supports, double-skin facade and ground lobby. Exact surveyed BAG boundary, open undercroft. Heights use real roof planes;equipment peaks excluded. No imported third-party meshes or image pixels."
      }
    },
    {
      id: "muiderpoort",
      name: "Muiderpoort",
      landmarkId: "extract_landmarks_1639856562",
      modelUrl: "./models/muiderpoort.glb",
      suppressOsmIds: [
        "w45038672",
        "NL.IMBAG.Pand.0363100012169095"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.9194747,
          52.3637334
        ],
        headingDegrees: 56.7,
        lengthMetres: 24.5,
        widthMetres: 17.8
      },
      surveyed: {
        anchor: [
          4.9194747,
          52.3637334
        ],
        northOffsetDegrees: 0,
        source: "Current OSM w45038672/BAG0363100012169095 exact polygon retrieved2026-10-04. Nativeeast/southmetres; authoredaxes33.3degrees relativeeast. 28.2m OSM3DBAG maximum; subordinateheightstages estimated from ownerphotos."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Muiderpoort",
        author: "Map Recall",
        sourceUrl: "https://stadsherstel.nl/monumenten/muiderpoort/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original surveyedtexture-free citygate with openarchedpassage, sandstoneDoricorders, heraldicpediments, brickwings, offsetoctagonal dome and clocklantern. Photos guideoriginalgeometry only; no downloadedmeshes or photopixels. Carvings/vault simplified; stageheights estimated."
      }
    },
    {
      id: "idfa-pavilion",
      name: "IDFA Het Documentaire Paviljoen",
      landmarkId: "osm-way-57857054",
      modelUrl: "./models/idfa-pavilion.glb",
      suppressOsmIds: [
        "w57857054",
        "NL.IMBAG.Pand.0363100012237216"
      ],
      footprint: {
        centre: [
          4.875,
          52.36108
        ],
        headingDegrees: 116.4,
        lengthMetres: 44.1,
        widthMetres: 29.8
      },
      spatialSuppression: false,
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.875,
          52.36108
        ],
        northOffsetDegrees: 26.4,
        source: "Current BAG parent0363100012237216; native facade xaxis116.4degrees/+Z206.4degrees. AHN5 surveyed roof planes relative to groundNAP-1.514m. RCE504833 and Arcam photographs guide original exposed loggias, domes and terrace."
      },
      attribution: {
        title: "IDFA Het Documentaire Paviljoen",
        author: "Map Recall",
        sourceUrl: "https://www.idfa.nl/en/vondelpark/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free plaster/brick pavilion with exposed arched loggias, balustrades, corner domes, central classical facade and native surveyed roof contours. No imported mesh or photo pixels."
      }
    },
    {
      id: "social-history",
      name: "International Institute of Social History",
      landmarkId: "extract_landmarks_742782013",
      modelUrl: "./models/social-history.glb",
      suppressOsmIds: [
        "w57859743",
        "NL.IMBAG.Pand.0363100012164130"
      ],
      footprint: {
        centre: [
          4.939438,
          52.369089
        ],
        headingDegrees: 90,
        lengthMetres: 76.6,
        widthMetres: 37.6
      },
      spatialSuppression: false,
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.939438,
          52.369089
        ],
        northOffsetDegrees: 0,
        source: "Native current BAG0363100012164130 footprint, current OSMw57859743. Facade assemblies and relative vertical dimensions from AtelierPRO references."
      },
      attribution: {
        title: "International Institute of Social History",
        author: "Map Recall",
        sourceUrl: "https://www.atelierpro.nl/projecten/internationaal-instituut-voor-sociale-geschiedenis",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of the1961 concrete cocoa warehouse transformed by AtelierPRO in1989; off-white vertical ribs, blind archives, raised entrance, library cantilever, tall harbour atrium and rounded glass pavilion. No imported meshes or image pixels. Exact BAG/OSM suppression preserves the adjacent historic warehouse and waterfront."
      }
    },
    {
      id: "dageraad",
      name: "Museum De Dageraad",
      landmarkId: "extract_landmarks_897347854",
      modelUrl: "./models/dageraad.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012076951"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.898997149741256,
          52.34985665994483
        ],
        headingDegrees: 90,
        lengthMetres: 14.929,
        widthMetres: 14.850999999999999
      },
      surveyed: {
        anchor: [
          4.898997149741256,
          52.34985665994483
        ],
        northOffsetDegrees: 0,
        source: "Current museum VBO/parent identity; native RD east/south surveyed footprint, 3DBAG2020 AHN4 semantic roof levels; museum occupies corner shop only."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Museum De Dageraad",
        author: "Map Recall",
        sourceUrl: "https://www.hetschip.nl/de-dageraad",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free low-poly corner parent only, with rounded stepped brickwork, scalloped narrow tower crown, horizontal white window rods and green shop entrances. Native survey17.56m main roof and21.34m narrow tower. Museum-name lettering omitted. Operator/heritage photographs guide geometry; no imported mesh or photo pixels. Adjoining estate parents and court remain."
      }
    },
    {
      id: "ons-lieve-heer-op-solder",
      name: "Ons\u2019 Lieve Heer op Solder \u2014 historic church and entrance",
      landmarkId: "extract_landmarks_1791250152",
      modelUrl: "./models/ons-lieve-heer-op-solder.glb",
      suppressOsmIds: [
        "w266941199",
        "NL.IMBAG.Pand.0363100012178021",
        "w266940951",
        "NL.IMBAG.Pand.0363100012178040"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.899258769422396,
          52.375132921670925
        ],
        headingDegrees: 121.0851936786699,
        lengthMetres: 23.644547311709523,
        widthMetres: 21.08931723774654
      },
      surveyed: {
        anchor: [
          4.899258769422396,
          52.375132921670925
        ],
        northOffsetDegrees: -59
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -0.08519367866989569,
      attribution: {
        title: "Ons\u2019 Lieve Heer op Solder \u2014 historic church and entrance",
        author: "Map Recall",
        sourceUrl: "https://opsolder.nl/en/the-monument/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free surveyed reconstruction of historic museum and separate modern entrance. Exact OSM/BAG identity suppression; open Heintje Hoekssteeg preserved. Photo-derived sash and modern facade assemblies, bounded upward roof planes and gables; dimensions above surveyed plan approximate."
      },
      relatedLandmarkIds: [
        "extract_landmarks_769225968"
      ]
    },
    {
      id: "canals-museum",
      name: "Museum of the Canals \u2014 Herengracht 386",
      landmarkId: "extract_landmarks_915035378",
      modelUrl: "./models/canals-museum.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012176537"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8861835,
          52.3678965
        ],
        headingDegrees: 92.93335363117035,
        lengthMetres: 21.784371314611192,
        widthMetres: 14.711695885297168
      },
      surveyed: {
        anchor: [
          4.8861835,
          52.3678965
        ],
        northOffsetDegrees: -87.06664636882965
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 180,
      attribution: {
        title: "Museum of the Canals",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/1828",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free native BAG footprint model; source-supported pilaster facade and central pediment. Dimensions/ornament approximate. Current facade checked against operator photo; removed inter-pilaster festoons omitted."
      }
    },
    {
      id: "niod",
      name: "NIOD Institute for War, Holocaust, and Genocide Studies",
      landmarkId: "extract_landmarks_1742509310",
      modelUrl: "./models/niod.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012169506"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.885957632081178,
          52.36811466960355
        ],
        headingDegrees: 92.85016810608217,
        lengthMetres: 17.310609999999997,
        widthMetres: 54.51096
      },
      surveyed: {
        anchor: [
          4.885957632081178,
          52.36811466960355
        ],
        northOffsetDegrees: -87.14983221643158,
        source: "Exact current PDOK BAG parent; native metres/front axis from actual east frontage."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "NIOD Institute for War, Holocaust, and Genocide Studies",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/1826",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free sandstone French neo-Renaissance double house. Exact BAG perimeter at scale1 with separately low middle/rear roof zones. Salm1888drawing resolves window groups, carriage entry, dormer assemblies;2016municipalphoto overrides obsolete standing ridge figures and small dormers. AHN5roof levels guide heights; carved reliefs and skylight are visual approximations. No imported mesh or reference-photo pixels."
      }
    },
    {
      id: "multatuli",
      name: "Multatuli Museum \u2014 Korsjespoortsteeg20",
      landmarkId: "extract_landmarks_1273422573",
      modelUrl: "./models/multatuli.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012167937"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.891125589486711,
          52.37749205605756
        ],
        headingDegrees: 33.29545565140216,
        lengthMetres: 11.661932831321346,
        widthMetres: 4.646381856369287
      },
      surveyed: {
        anchor: [
          4.891125589486711,
          52.37749205605756
        ],
        northOffsetDegrees: 33.29545565140216,
        source: "PDOK exact VBO-to-Pand parent/current footprint, local facade basis"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 180,
      attribution: {
        title: "Multatuli Museum",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/3133",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free native current BAG house, restrained bell gable and cream timber pui after2022facade photos. Coherent main gable and lower rear extensions informed by AHN5survey; facade details and fine ornament approximate. No photo pixels or third-party mesh."
      }
    },
    {
      id: "singelkerk",
      name: "Singelkerk",
      landmarkId: "extract_landmarks_760984505",
      modelUrl: "./models/singelkerk.glb",
      suppressOsmIds: [
        "w267123307",
        "NL.IMBAG.Pand.0363100012171741",
        "w267123332",
        "NL.IMBAG.Pand.0363100012177610"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8883,
          52.367535
        ],
        headingDegrees: 49,
        lengthMetres: 54,
        widthMetres: 29
      },
      surveyed: {
        anchor: [
          4.8883,
          52.367535
        ],
        northOffsetDegrees: 0,
        source: "Current PDOK BAG church (1639) and service house Singel 452, exact parent identities; native east/south metres. Original surfaces reconstructed from AHN5 2023 semantic roof observations. Singel 454 is separate and retained."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Singelkerk",
        author: "Map Recall",
        sourceUrl: "https://www.doopsgezindamsterdam.nl/historie/singelkerk-4/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free hidden church and domestic Singel 452 frontage, sourced straight cornices, round-head tracery, open forecourt, iron rail and surveyed intersecting hipped roofs. No imported render meshes or photo pixels. Tiny reliefs and roof details simplified; source pack archived privately."
      }
    },
    {
      id: "sint-agneskerk",
      name: "Sint-Agneskerk",
      landmarkId: "extract_landmarks_736359928",
      modelUrl: "./models/sint-agneskerk.glb",
      suppressOsmIds: [
        "w57859521",
        "w98672987",
        "NL.IMBAG.Pand.0363100012166358",
        "NL.IMBAG.Pand.0363100012197426"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8581,
          52.35028
        ],
        headingDegrees: 90,
        lengthMetres: 30.519442485800624,
        widthMetres: 61.76237319625609
      },
      surveyed: {
        anchor: [
          4.8581,
          52.35028
        ],
        northOffsetDegrees: 0,
        source: "Current PDOK BAG polygons; authoring aligned 66.1deg local-to-east/south rotation, geometry baked into east/south metres"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Sint-Agneskerk",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/505910",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original native-scale texture-free geometry using current BAG plan, researched neo-Romanesque basilica and detached open campanile. Pastorie and neighboring school preserved; no photo pixels or downloaded meshes."
      }
    },
    {
      id: "petruskerk",
      name: "Petruskerk",
      landmarkId: "extract_landmarks_800494636",
      modelUrl: "./models/petruskerk.glb",
      suppressOsmIds: [
        "w8891046",
        "NL.IMBAG.Pand.0363100012163298"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.846546,
          52.386716
        ],
        headingDegrees: 90,
        lengthMetres: 29,
        widthMetres: 14.3
      },
      surveyed: {
        anchor: [
          4.846546,
          52.386716
        ],
        northOffsetDegrees: 0,
        source: "Current BAG native shape; geometry baked east/south metres"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Petruskerk",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/6775",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free geometry from native BAG footprint, operator facade photographs and roof survey. Separate houses, tomb parents and open churchyard preserved."
      }
    },
    {
      id: "boomkerk",
      name: "Boomkerk",
      landmarkId: "extract_landmarks_746878126",
      modelUrl: "./models/boomkerk.glb",
      suppressOsmIds: [
        "w276234088",
        "NL.IMBAG.Pand.0363100012119680"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.850806,
          52.383285
        ],
        headingDegrees: 90,
        lengthMetres: 52,
        widthMetres: 29
      },
      surveyed: {
        anchor: [
          4.850806,
          52.383285
        ],
        northOffsetDegrees: 0,
        source: "Current BAG native shape; geometry baked east/south metres"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Boomkerk",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/529085",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free native BAG church reconstruction; separate presbytery and school retained. Roof heights from AHN5/3DBAG, architectural detail from RCE and reference photographs."
      }
    },
    {
      id: "w139",
      name: "W139",
      landmarkId: "extract_landmarks_1875699888",
      modelUrl: "./models/w139.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012171952"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.896302961217267,
          52.37358068148385
        ],
        headingDegrees: 0,
        lengthMetres: 52.863119999999995,
        widthMetres: 64.15679
      },
      surveyed: {
        anchor: [
          4.896302961217267,
          52.37358068148385
        ],
        northOffsetDegrees: 0,
        source: "Current PDOK exact BAG parent; east/south native metres, AHN5 bounded roof zones"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "W139 restored neoclassical front and former theatre",
        author: "Map Recall",
        sourceUrl: "https://www.smuldersarchitecten.nl/projecten/w139-amsterdam",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free native current BAG complex with interpreted AHN5 bounded roof surfaces; restored four-storey plaster three-bay front, low bent-cornice entrance wing, red deep-house roof and low rear theatre. Fine facade detail approximate. No imported mesh or photo pixels."
      }
    },
    {
      id: "conservatorium",
      name: "Mandarin Oriental Conservatorium, Amsterdam",
      landmarkId: "requested-conservatorium",
      modelUrl: "./models/conservatorium.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012152618",
        "NL.IMBAG.Pand.0363100012236413"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.87881,
          52.35871
        ],
        headingDegrees: 335,
        lengthMetres: 68,
        widthMetres: 70
      },
      surveyed: {
        anchor: [
          4.87881,
          52.35871
        ],
        northOffsetDegrees: 245
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: -90,
      attribution: {
        title: "Mandarin Oriental Conservatorium, Amsterdam",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/287",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free flat-color architecture built at native surveyed BAG scope and scale1 with coherent footprint-clipped gable, hip and flattened-tent roofs calibrated to major AHN5 measurements, exposed arches and dormers, pale stone main gable, open polygonal corner turret and transparent courtyard frame. Thin ornament heights/spacing approximate from source photos. No neighboring rectangular suppression."
      }
    },
    {
      id: "kinderkookkafe",
      name: "Kinderkookkaf\xE9",
      landmarkId: "extract_landmarks_565545475",
      modelUrl: "./models/kinderkookkafe.glb",
      suppressOsmIds: [
        "w276423157",
        "w276423122",
        "NL.IMBAG.Pand.0363100012158470",
        "NL.IMBAG.Pand.0363100012165580"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.864856,
          52.359184
        ],
        headingDegrees: 90,
        lengthMetres: 23.2,
        widthMetres: 26.5
      },
      surveyed: {
        anchor: [
          4.864856,
          52.359184
        ],
        northOffsetDegrees: 0,
        source: "Exact current BAG twin shed polygons plus AHN4/AHN5 3DBAG roof rings; source supported original facade details"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Kinderkookkaf\xE9 / paired Vondelpark manure sheds",
        author: "Map Recall",
        sourceUrl: "https://stadsherstel.nl/monumenten/vondelpark-6b/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free native survey reconstruction. No reference pixels or downloaded meshes. Gable/entrance relief and pane divisions photographic approximations."
      }
    },
    {
      id: "beta-boulders",
      name: "Beta Boulders",
      landmarkId: "osm-node-2815512499",
      modelUrl: "./models/beta-boulders.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012087748"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.85597144276366,
          52.344404391103
        ],
        headingDegrees: 0,
        lengthMetres: 64.6,
        widthMetres: 80.2
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.85597144276366,
          52.344404391103
        ],
        northOffsetDegrees: 0,
        source: "Native RD east/south axes centeredRD118800/484187; PDOK VBO0363010012116375\u2192Pand0363100012087748; AHN5roof envelope relativeNAP0.72. Genuine mapped leisure node2815512499 retained."
      },
      attribution: {
        title: "Beta Boulders / The Garage north Citroen complex",
        author: "Map Recall",
        sourceUrl: "https://betaboulders.nl/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original native texture-free surveyed shared building and photo-guided curtain walls. No imported mesh/photo pixels. Exact BAG parent only; other tenants retained."
      }
    },
    {
      id: "beest-boulders",
      name: "Beest Boulders Amsterdam",
      landmarkId: "n8805218642",
      modelUrl: "./models/beest-boulders.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012151240"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8590257886306105,
          52.382092992601216
        ],
        headingDegrees: 0,
        lengthMetres: 222,
        widthMetres: 42
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.8590257886306105,
          52.382092992601216
        ],
        northOffsetDegrees: 0,
        source: "PDOK BAG0363100012151240 and AHN5 native roof regions; local coordinates baked into east/south world axes."
      },
      attribution: {
        title: "Beest Boulders Amsterdam shared industrial host",
        author: "Map Recall",
        sourceUrl: "https://beestboulders.com/beest-boulders-amsterdam/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original native shared-host geometry with the source-observed complete western frontage and user-authorized real vector sign graphics. Reference photos guide geometry only. Preserve genuine Beest and Padel identities."
      },
      relatedLandmarkIds: [
        "n3974788355"
      ],
      destinationLandmarkIds: [
        "n8805218642",
        "n3974788355"
      ],
      preservePositionPrecision: true
    },
    {
      id: "klimmuur-centraal",
      name: "Klimmuur Centraal",
      landmarkId: "osm-node-2743587102",
      modelUrl: "./models/klimmuur-centraal.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012170819",
        "w35048037"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.911646745330801,
          52.37662105881722
        ],
        headingDegrees: 0,
        lengthMetres: 33,
        widthMetres: 21
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.911646745330801,
          52.37662105881722
        ],
        northOffsetDegrees: 0,
        source: "Native RD east/south; current BAG host and AHN5 roof planes, source-rounded roof reconstruction"
      },
      attribution: {
        title: "Klimmuur Centraal Dijksgracht2",
        author: "Map Recall",
        sourceUrl: "https://www.deklimmuur.nl/klimmen/klimmuur-centraal/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original house-style geometry; no photo textures or imported asset mesh. Only exact BAG host replaced."
      }
    },
    {
      id: "mountain-network",
      name: "Climbing Center Amsterdam (Mountain Network)",
      landmarkId: "n2231887299",
      modelUrl: "./models/mountain-network.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012237533"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8417,
          52.3743
        ],
        headingDegrees: 0,
        lengthMetres: 208,
        widthMetres: 66
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.8417,
          52.3743
        ],
        northOffsetDegrees: 0,
        source: "Official Erasmusgracht297 VBO0363010011157132 joins2011 Pand0363100012237533; full host reconstructed from current3DBAG survey rings with archived2025 panorama facade evidence."
      },
      attribution: {
        title: "Mountain Network Amsterdam / De Tribune",
        author: "Map Recall",
        sourceUrl: "https://arcam.nl/architectuur-gids/de-tribune/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free house-style reconstruction of surveyed full host; no source photo pixels or third-party artistic mesh."
      }
    },
    {
      id: "keith-haring-mural",
      name: "Muurschildering van Keith Haring",
      landmarkId: "n9021384965",
      modelUrl: "./models/keith-haring-mural.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012201630"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.86495,
          52.38046
        ],
        headingDegrees: 0,
        lengthMetres: 43,
        widthMetres: 41
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.86495,
          52.38046
        ],
        northOffsetDegrees: 0,
        source: "PDOK current BAG0363100012201630; east/south native axes, west-wall artwork node9021384965. Wikipedia coordinate denotes public viewing position, not host."
      },
      attribution: {
        title: "Koelhuis and Keith Haring west-wall mural",
        author: "Map Recall; mural composition after Keith Haring (1986)",
        sourceUrl: "https://www.amsterdam.nl/stadsdelen/west/nieuws/fantasiebeest-keith-haring/",
        licence: "Original project geometry; underlying artwork by Keith Haring",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free surveyed building and hand-authored white stroke interpretation; no reference pixels or imported mesh."
      },
      galleryView: {
        theta: -1.3,
        phi: 1.15
      }
    },
    {
      id: "valley",
      name: "Valley",
      landmarkId: "osm_building_896762181",
      modelUrl: "./models/valley.glb",
      suppressOsmIds: [
        "w896762181",
        "NL.IMBAG.Pand.0363100012250045"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.877550164997548,
          52.337557127430884
        ],
        headingDegrees: 0,
        lengthMetres: 140,
        widthMetres: 54
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.877550164997548,
          52.337557127430884
        ],
        northOffsetDegrees: 0,
        source: "Native RD east/south contours scale 1; BAG parent0363100012250045, OSMw896762181. Original reconstructed shells using current3DBAG near-horizontal roof outlines; glass outer envelope, stone terraced inner valley. Published north/middle/south100/67/81m heights; equipment maxima excluded."
      },
      attribution: {
        title: "Valley Amsterdam",
        author: "Map Recall",
        sourceUrl: "https://www.mvrdv.com/projects/233/valley-t",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free house-style reconstruction; surveyed tier contours and photo-guided stone/glass assemblies. No downloaded render mesh or photograph pixels."
      }
    },
    {
      id: "ndsm-warehouse-complex",
      name: "NDSM-loods",
      landmarkId: "extract_landmarks_1741957518",
      modelUrl: "./models/ndsm-warehouse-complex.glb",
      suppressOsmIds: [
        "w44824309",
        "NL.IMBAG.Pand.0363100012062886"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.896426,
          52.4013
        ],
        headingDegrees: 0,
        lengthMetres: 205,
        widthMetres: 199
      },
      surveyed: {
        anchor: [
          4.896426,
          52.4013
        ],
        northOffsetDegrees: 0,
        source: "Current BAG Pand0363100012062886 and OSMw44824309;AHN5 native roof layout,2024 municipal facade evidence"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "NDSM Scheepsbouwloods",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/528251",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-color native shipbuilding warehouse; survey-derived six-bay rooflights, high transverse mallenzolder and low attached halls. Brick/steel grid, tall glazed groups and blue doors, physical open entry. Independent shipyard buildings and existing Faralda/Treehouse retained; no downloaded mesh or photo pixels."
      }
    },
    {
      id: "midwest",
      name: "MidWest",
      landmarkId: "w119042875",
      modelUrl: "./models/midwest.glb",
      suppressOsmIds: [
        "w119042875",
        "NL.IMBAG.Pand.0363100012081251"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.85495,
          52.369735
        ],
        headingDegrees: 90,
        lengthMetres: 45,
        widthMetres: 27
      },
      surveyed: {
        anchor: [
          4.85495,
          52.369735
        ],
        northOffsetDegrees: 0,
        source: "Native BAG/3DBAG stepped terraces baked east/south metres; 2023 AHN5 roof evidence"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "MidWest",
        author: "Map Recall",
        sourceUrl: "https://www.inmidwest.nl/cabralstraat-1-het-monument/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free native scale school reconstruction, surveyed stepped roofs, twin open-headed towers and facade rhythms from archived references."
      }
    },
    {
      id: "nikolaas-myrakerk",
      name: "Heilige Nikolaas van Myrakerk",
      landmarkId: "extract_landmarks_2003244540",
      modelUrl: "./models/nikolaas-myrakerk.glb",
      suppressOsmIds: [
        "w266555973",
        "NL.IMBAG.Pand.0363100012169397"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.88047,
          52.37908
        ],
        headingDegrees: 0,
        lengthMetres: 42,
        widthMetres: 43
      },
      surveyed: {
        anchor: [
          4.88047,
          52.37908
        ],
        northOffsetDegrees: 0,
        source: "Current BAG parent 0363100012169397 (1912), OSM w266555973. Native surveyed AHN5 roof observations, exact forecourt notch preserved."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Heilige Nikolaas van Myrakerk / Tichelkerk",
        author: "Map Recall",
        sourceUrl: "https://orthodox-amsterdam.nl/wie-wijzijn/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free surveyed church and former monastery, grouped round-headed windows, oculus, open slate bell lantern, courtyard and iron entrance. Photographic proportions approximate small details. No source mesh or photo pixels."
      }
    },
    {
      id: "naco-house",
      name: "NACO-house",
      landmarkId: "extract_landmarks_1769455774",
      modelUrl: "./models/naco-house.glb",
      suppressOsmIds: [
        "w1535749695",
        "NL.IMBAG.Pand.0363100012570001"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.905443,
          52.3786995
        ],
        headingDegrees: 102.4663266966,
        lengthMetres: 7.5,
        widthMetres: 19.3
      },
      surveyed: {
        anchor: [
          4.905443,
          52.3786995
        ],
        northOffsetDegrees: 12.4663266966,
        source: "Current BAG 0363100012570001 and OSM w1535749695 moved location beside bridge2274. Native local metre reconstruction; 3DBAG AHN5 2023 roof heights; RCE518409 and Stadsherstel references. Dock and nearby bus shelter omitted."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "NACO-house",
        author: "Map Recall",
        sourceUrl: "https://stadsherstel.nl/monumenten/de-ruijterkade-naco-huisje/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free timber office on five concrete supports, open ground-floor passage, orange curved-gable/hip roof, white glazing and sawtooth trims. No third-party pixels/meshes."
      }
    },
    {
      id: "jeruzalemkerk",
      name: "Jeruzalemkerk",
      landmarkId: "extract_landmarks_2017340658",
      modelUrl: "./models/jeruzalemkerk.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012120412",
        "NL.IMBAG.Pand.0363100012133330",
        "NL.IMBAG.Pand.0363100012144824"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.85196,
          52.371445
        ],
        headingDegrees: 15.18,
        lengthMetres: 43,
        widthMetres: 31
      },
      surveyed: {
        anchor: [
          4.85196,
          52.371445
        ],
        northOffsetDegrees: 0,
        source: "Current BAG exact three parents: church and designed attached corner residences. Native east/south metres scale1; independent adjacent houses and opposite Jan Maijenschool retained."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Jeruzalemkerk",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/527155",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-color native surveyed church and corner residences, stepped cubic masses, projecting brick window piers, stained glazing, three entrances and squat open bell tower. No imported meshes/photo pixels; lettering omitted."
      }
    },
    {
      id: "blauwe-theehuis",
      name: "Blauwe Theehuis",
      landmarkId: "extract_landmarks_57862001",
      modelUrl: "./models/blauwe-theehuis.glb",
      suppressOsmIds: [
        "w57862001",
        "NL.IMBAG.Pand.0363100012093476"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.87258,
          52.358848
        ],
        headingDegrees: 90,
        lengthMetres: 20.5,
        widthMetres: 20.5
      },
      surveyed: {
        anchor: [
          4.87258,
          52.358848
        ],
        northOffsetDegrees: 0,
        source: "BAG core/OSM open terrace; native east X south Z"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Blauwe Theehuis",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/504760",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free geometry. Exact BAG ground core and OSM terrace; upper dodecagon/window partitions/vertical tiers estimated from register/photo ratios under surveyed overall height."
      }
    },
    {
      id: "groot-melkhuis",
      name: "Groot Melkhuis",
      landmarkId: "extract_landmarks_291097138",
      modelUrl: "./models/groot-melkhuis.glb",
      suppressOsmIds: [
        "w57855717",
        "NL.IMBAG.Pand.0363100012166911"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.868295,
          52.3585254
        ],
        headingDegrees: 90,
        lengthMetres: 26.5,
        widthMetres: 20.1
      },
      surveyed: {
        anchor: [
          4.868295,
          52.3585254
        ],
        northOffsetDegrees: 0,
        source: "Current BAG/OSM outline and 2023 AHN5 height; native east X/south Z"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Groot Melkhuis",
        author: "Map Recall",
        sourceUrl: "https://grootmelkhuis.nl/historie/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction with exact BAG ground footprint, photo-backed hipped upper house/veranda/awnings. Roof surface simplified from photo with survey envelope; no imported mesh or pixels."
      }
    },
    {
      id: "beest-het-lab",
      name: "Beest Boulders Het Lab",
      landmarkId: "requested-het-lab",
      modelUrl: "./models/beest-het-lab.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012123591"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.85133,
          52.39261
        ],
        headingDegrees: 0,
        lengthMetres: 74,
        widthMetres: 43
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.85133,
          52.39261
        ],
        northOffsetDegrees: 0,
        source: "Current PDOK BAG0363100012123591 plus3DBAG roof planes and July2025 municipal panorama. Native metres."
      },
      attribution: {
        title: "Beest Boulders Het Lab",
        author: "Map Recall",
        sourceUrl: "https://beestboulders.com/boulderen/het-lab-amsterdam/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free geometry based on survey polygons and municipal panorama observations; exact source suppression preserves adjacent east warehouse."
      }
    },
    {
      id: "kesbeke",
      name: "Kesbeke Fijne Tafelzuren",
      landmarkId: "w276264363",
      modelUrl: "./models/kesbeke.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012132306"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.857491067626641,
          52.383076488700894
        ],
        headingDegrees: 0,
        lengthMetres: 40.70900000000256,
        widthMetres: 65.0680000000284
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.857491067626641,
          52.383076488700894
        ],
        northOffsetDegrees: 0,
        source: "Native RD anchor118935/488489; AHN5 individual semantic roof planes, groundNAP0.41499999165534973; exact official BAG address/VBO/Pand relationship"
      },
      attribution: {
        title: "Kesbeke factory and office",
        author: "Map Recall",
        sourceUrl: "https://www.kesbeke.nl/contact-keuze/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original native flat-color reconstruction with sharp original vector signage following actual walls; reference photos inform geometry only; no photo pixels or imported mesh."
      },
      materialOverrides: {
        brick: "#8a7159",
        gold: "#f4c400"
      }
    },
    {
      id: "kesbeke-shop",
      name: "Kesbeke Zoet & Zuur winkel",
      landmarkId: "n9071288363",
      modelUrl: "./models/kesbeke-shop.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012120245"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.856803137299997,
          52.38287567988049
        ],
        headingDegrees: 0,
        lengthMetres: 13.054000000003725,
        widthMetres: 13.628000000026077
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.856803137299997,
          52.38287567988049
        ],
        northOffsetDegrees: 0,
        source: "Native RD anchor118888/488467; AHN5 individual semantic roof planes, groundNAP0.4180000126361847; exact official BAG address/VBO/Pand relationship"
      },
      attribution: {
        title: "Kesbeke shop and its residential BAG parent",
        author: "Map Recall",
        sourceUrl: "https://www.kesbeke.nl/ons-winkeltje/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original native flat-color reconstruction with sharp original vector signage following actual walls; reference photos inform geometry only; no photo pixels or imported mesh."
      },
      materialOverrides: {
        brick: "#8a7159",
        gold: "#f4c400"
      }
    },
    {
      id: "ndsm-container-arch",
      name: "De Containerboog",
      landmarkId: "osm_w1304785589",
      modelUrl: "./models/ndsm-container-arch.glb",
      suppressOsmIds: [
        "w1304785589"
      ],
      spatialSuppression: false,
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      footprint: {
        centre: [
          4.894597625,
          52.401558625
        ],
        headingDegrees: 127.737,
        lengthMetres: 18.452,
        widthMetres: 6.48
      },
      surveyed: {
        anchor: [
          4.894597625,
          52.401558625
        ],
        northOffsetDegrees: 217.737,
        source: "OSM w1304785589 area outline, current 2026 NDSM operator photographs. Local +X is long-axis bearing307.737 (same undirected footprint axis127.737)\xB0. Photo-derived square box ends2.44m, radius8.006m, depth6.48m, top10.446m; dimensions approximate, not ISO or engineering survey. Principal striped ends face local -Z (southwest)."
      },
      materialOverrides: {
        frame: "#603075",
        dark: "#24162c",
        blue: "#51ddd0",
        pink: "#ee0679",
        gold: "#ffce0a",
        ochre: "#fa9504"
      },
      attribution: {
        title: "De Containerboog \u2014 FIRESTARTER (2026)",
        author: "Map Recall",
        sourceUrl: "https://www.ndsm.nl/en/kunst/firestarter",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original nine separate native-scale containers with open wedge spacers, open central passage and simplified original flat-colour FIRESTARTER-inspired turquoise/magenta/yellow motifs. No third-party pixels, meshes or identification text."
      }
    },
    {
      id: "wine-guildhall",
      name: "Wine buyers\u2019 guildhall / Wijnkopersgildehuis",
      landmarkId: "extract_landmarks_1958595244",
      modelUrl: "./models/wine-guildhall.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012178460"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.898323421104812,
          52.37197131788289
        ],
        headingDegrees: 90,
        lengthMetres: 20.664916001602627,
        widthMetres: 23.658623804187897
      },
      surveyed: {
        anchor: [
          4.898323421104812,
          52.37197131788289
        ],
        northOffsetDegrees: 0,
        source: "Current BAG0363100012178460 native east/south metres; actual northeast Koestraat principal frontage0\u21921\u2192\u2026\u21929 (13.856m), confirmed open street against opposite BAG1634. Rear10\u219214 abuts BAG8212; partywall9\u219210 adjoins Koestraat8. AHN variable roof/courtyard retained."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Wijnkopersgildehuis",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/3051",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free flat-colour house style; actual BAG holed plan and variable measured roof regions constrain newly generated geometry. Principal facade follows actual northeast13.856m street boundary0\u21929 with source-supported six sash groups, three reconstructed neck tops, sober block ornament and right-half1633 Saint Urbanus portal. Thin front masonry support stays on true perimeter. No neighboring buildings or source pixels/lettering/imported mesh. Superseded partywall9\u219210 and rear10\u219214 facade placements failed native acceptance."
      }
    },
    {
      id: "the-rock",
      name: "The Rock",
      landmarkId: "osm-way-52156815",
      modelUrl: "./models/the-rock.glb",
      suppressOsmIds: [
        "w52156815",
        "NL.IMBAG.Pand.0363100012114135"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.87011,
          52.33761
        ],
        headingDegrees: 0,
        lengthMetres: 54,
        widthMetres: 49
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.87011,
          52.33761
        ],
        northOffsetDegrees: 0,
        source: "BAG0363100012114135/OSMw52156815 native surveyed boundary and 3DBAG roof plans in RD east/south axes, scale1. RD/WGS84 angular correction <0.5degree; exact replacement identities only."
      },
      attribution: {
        title: "The Rock / Erick van Egeraat",
        author: "Map Recall",
        sourceUrl: "https://therock-zuidas.nl/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free flat-color surveyed footprint shells, continuous articulated glass/aluminium curtain fields, clustered broad/slit glazing in deep layered stone frames and bounded surveyed roof heights; photo-guided dark charcoal/brown stone; no imported meshes or photo pixels."
      },
      materialOverrides: {
        greyBrick: "#4b4a44"
      }
    },
    {
      id: "rai-amsterdam",
      name: "RAI Amsterdam",
      landmarkId: "n2817982961",
      modelUrl: "./models/rai-amsterdam.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012093034",
        "w806950194",
        "w806950195",
        "w806950196",
        "w806950197",
        "w43783760",
        "NL.IMBAG.Pand.0363100012093905",
        "w277270903",
        "w461439852",
        "NL.IMBAG.Pand.0363100012218586",
        "w277270901",
        "w1238963818",
        "w807090339",
        "w807204806",
        "w807204801",
        "w807204802",
        "w807204803"
      ],
      footprint: {
        centre: [
          4.88998,
          52.341315
        ],
        headingDegrees: 90,
        lengthMetres: 332.1,
        widthMetres: 358
      },
      spatialSuppression: false,
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.88998,
          52.341315
        ],
        northOffsetDegrees: 0,
        source: "Independent Elicium BAG0363100012093034, current PDOK perimeter, installed OSM raised hall/tower parts, AHN5 2023 ground0.982NAP and tower47.672NAP. Native east/south; original rounded profile from architect section.; combined native Europacomplex parent0363100012093905 and independent Signaal0363100012218586. Bounded2026 OSM original map resolves genuine mainvenue node2817982961; architectural parts still under review. Scope repair: named1963 Westhal/hall2 and1961 Zuidhal/hall3 exact OSM source12m envelopes; named1969 Amstelhal full three surveyed glazed/gabled strips height15m/roof3m approximation. Independent source critic agreed physical ownership; actual current-hash game acceptance pending."
      },
      attribution: {
        title: "RAI Elicium, Europacomplex, Westhal, Amstelhal and Het Signaal",
        author: "Map Recall",
        sourceUrl: "https://www.benthemcrouwel.com/projects/rai-elicium",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original native flat-color texture-free Elicium, Europacomplex barrel and surrounding halls,1963 Westhal,1969 Amstelhal and Signaal. Source-supported exact named hall/strip outlines; OSM heights and repeated glazing approximate. Full RAI coverage including separate Amtrium/Hollandcomplex/Congress Centre pending. Broad partially owned compoundw807090334 remains unsuppressed."
      }
    },
    {
      id: "pulitzer-amsterdam",
      name: "Pulitzer Amsterdam",
      landmarkId: "osm-node-331630133",
      modelUrl: "./models/pulitzer-amsterdam.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012169022",
        "NL.IMBAG.Pand.0363100012169021"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.8839,
          52.3727
        ],
        headingDegrees: 266.4,
        lengthMetres: 88.3,
        widthMetres: 79.3
      },
      surveyed: {
        anchor: [
          4.8839,
          52.3727
        ],
        northOffsetDegrees: -0.398848,
        source: "Current PDOK BAG0363100012169022 and0363100012169021 at native RD metres; RD grid-east bearing89.601152deg. AHN4/3DBAG2020 individually surveyed roofregions, four courtyardholes; no parcel slab or importedmesh."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Pulitzer Amsterdam",
        author: "Map Recall",
        sourceUrl: "https://www.pulitzeramsterdam.com/nl/over-het-hotel/onze-geschiedenis/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free flat-color connected historic canal houses. Native currentBAG exteriors; original shells constructed from clipped survey roof-plane regions, four preserved sourcecourts, independently authored street elevations/windows/entries/plinths/crowns. Modern2016black entrance; diverse tuit/hals/klok/lijst family mixture; Saxenburg four-bay sandstonefront with attiek; Jansz corner/Reestraat row. Tinycarvedrelief and joinery spacing photo-guided; retiredaddress fuzzyfallbacks rejected. No downloadedmesh or photo pixels."
      }
    },
    {
      id: "de-gooyer",
      name: "De Gooyer",
      landmarkId: "extract_landmarks_33057057",
      modelUrl: "./models/de-gooyer.glb",
      suppressOsmIds: [
        "w269052487",
        "NL.IMBAG.Pand.0363100012169758"
      ],
      spatialSuppression: false,
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      footprint: {
        centre: [
          4.926172908055607,
          52.36680769280531
        ],
        headingDegrees: 84.8,
        lengthMetres: 10.97,
        widthMetres: 11.05
      },
      surveyed: {
        anchor: [
          4.926172908055607,
          52.36680769280531
        ],
        northOffsetDegrees: -5.2,
        source: "Current in-use BAG0363100012169758 rectangle, official Funenkade5 VBO0363010000641344. Author +X bearing84.8deg from BAG long edges. Gallery17.8m and sailspan26.6m from owner. Tower/cap heights photo-calibrated approximation; cap and stationary sails are a representative rotational state."
      },
      attribution: {
        title: "De Gooyer",
        author: "Map Recall",
        sourceUrl: "https://stadsherstel.nl/monumenten/funenkade-5-molen-de-gooyer/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free native-scale square brick base, thatched octagons, open gallery, rounded cap, old-Dutch lattice sails; no imported meshes or photo pixels."
      }
    },
    {
      id: "nieuw-dakota",
      name: "Former Nieuw Dakota",
      landmarkId: "extract_landmarks_2781756860",
      modelUrl: "./models/nieuw-dakota.glb",
      suppressOsmIds: [
        "w280620202",
        "NL.IMBAG.Pand.0363100012064117"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.89215,
          52.4004
        ],
        headingDegrees: 90,
        lengthMetres: 26.52,
        widthMetres: 47.54
      },
      surveyed: {
        anchor: [
          4.89215,
          52.4004
        ],
        northOffsetDegrees: 0,
        source: "Exact BAG shared host incl narrow south extension and AHN5 roof rings; municipal2024/2025photos"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Former Nieuw Dakota shared warehouse",
        author: "Map Recall",
        sourceUrl: "https://www.nieuwdakota.com/nl/over/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free reconstruction of measured twin-gabled host, pale metal corrugation, blue front and green glazing; preserves northern tenant front and low extension. No copied source pixels or meshes; painted name words omitted."
      }
    },
    {
      id: "pllek",
      name: "Pllek",
      landmarkId: "n4913392670",
      modelUrl: "./models/pllek.glb",
      suppressOsmIds: [
        "w500238189",
        "NL.IMBAG.Pand.0363100012241285"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.893035,
          52.39915
        ],
        headingDegrees: 0,
        lengthMetres: 57,
        widthMetres: 26
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.893035,
          52.39915
        ],
        northOffsetDegrees: 0,
        source: "Native currentBAG0363100012241285/OSMw500238189; curved hall roofs from owner originals; AHNground1.153m removed."
      },
      attribution: {
        title: "Pllek",
        author: "Map Recall",
        sourceUrl: "https://pllek.nl/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-color container restaurant compound with two red barrelvaults and waterfront glass,source-supported tall yellowtower; nativeplan/exactIDs retain Treehouse,NDSMbeach and shipyardneighbors. No photo textures or copiedmeshes."
      }
    },
    {
      id: "monk-amsterdam",
      name: "Monk Amsterdam",
      landmarkId: "extract_landmarks_2270458123",
      modelUrl: "./models/monk-amsterdam.glb",
      suppressOsmIds: [
        "w280838840",
        "NL.IMBAG.Pand.0363100012136881"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.9293,
          52.38405
        ],
        headingDegrees: 0,
        lengthMetres: 181,
        widthMetres: 155
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.9293,
          52.38405
        ],
        northOffsetDegrees: 0,
        source: "Full shared BAG host 0363100012136881; all native LoD2.2 roof patches and walls, registered to current BAG boundary."
      },
      attribution: {
        title: "Monk Amsterdam shared industrial host",
        author: "Map Recall",
        sourceUrl: "https://monk.nl/amsterdam/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free full shared factory geometry; black folded steel, exposed window ribbon, differentiated loading and tenant openings. Monk remains one venue identity within the host."
      },
      scopeWarning: "Fullhost draft replaces only w280838840 / BAG0363100012136881 after visual acceptance and successful model load. Never describe entire host as Monk-owned. Neighboring parents and exterior lanes retained; gallery/game review pending.",
      sharedHost: {
        bagParent: "0363100012136881",
        tenantVbo: "0363010012074249",
        tenantCount: 14,
        labelPolicy: "Monk labels the venue destination; whole shared factory not renamed or assigned exclusive tenant ownership."
      }
    },
    {
      id: "straat-museum",
      name: "STRAAT Museum",
      landmarkId: "extract_landmarks_6741685223",
      modelUrl: "./models/straat-museum.glb",
      suppressOsmIds: [
        "w717827611",
        "NL.IMBAG.Pand.0363100012079735"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.894349,
          52.40231
        ],
        headingDegrees: 90,
        lengthMetres: 118.1,
        widthMetres: 128.8
      },
      surveyed: {
        anchor: [
          4.894349,
          52.40231
        ],
        northOffsetDegrees: 0,
        source: "Exact current BAG Lasloods host incl office; AHN5 roof planes and October2024 municipal panorama"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "STRAAT Museum / Lasloods",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/528252",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-color reconstruction using survey dimensions and primary current photographs. Four flattened roof lights, brick walls, annex glazing and restrained original geometric mural interpretation; no copied mesh or photo pixels."
      }
    },
    {
      id: "treehouse-ndsm",
      name: "Treehouse NDSM",
      landmarkId: "w1163404107",
      modelUrl: "./models/treehouse-ndsm.glb",
      suppressOsmIds: [
        "w717022796",
        "NL.IMBAG.Pand.0363100012252476",
        "w717022787",
        "NL.IMBAG.Pand.0363100012252477",
        "w717022799",
        "NL.IMBAG.Pand.0363100012252479",
        "w717022798",
        "NL.IMBAG.Pand.0363100012252480",
        "w717022786",
        "NL.IMBAG.Pand.0363100012252481",
        "w717022795",
        "NL.IMBAG.Pand.0363100012252482",
        "w717022791",
        "NL.IMBAG.Pand.0363100012252483",
        "w1509690547",
        "NL.IMBAG.Pand.0363100012252484",
        "w717022784",
        "NL.IMBAG.Pand.0363100012252486",
        "w717022803",
        "NL.IMBAG.Pand.0363100012252487",
        "w717022788",
        "NL.IMBAG.Pand.0363100012252488",
        "w717022801",
        "NL.IMBAG.Pand.0363100012252489",
        "w717022789",
        "NL.IMBAG.Pand.0363100012252490",
        "w717022792",
        "NL.IMBAG.Pand.0363100012252491",
        "w717022783",
        "NL.IMBAG.Pand.0363100012252492",
        "w717022804",
        "NL.IMBAG.Pand.0363100012252493"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.89311,
          52.39948
        ],
        headingDegrees: 0,
        lengthMetres: 60,
        widthMetres: 57
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      surveyed: {
        anchor: [
          4.89311,
          52.39948
        ],
        northOffsetDegrees: 0,
        source: "CurrentPDOK16separateBAGPands inOSMsitew1163404107. AHNroofplanes+perPandgroundcalibration. Outsideparcelneverfilled."
      },
      attribution: {
        title: "Treehouse NDSM",
        author: "Map Recall",
        sourceUrl: "https://www.treehousendsm.com/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free studio/container village;16nativeseparatefootprints,sourcewhitepitchedcabinsandlargeworkhalls,observedcoloredcorrugationandnorthblackslats. Source-derivedroofplanes,notimportedmesh. Courtyards/alleys/Pllekneighbors retained."
      }
    },
    {
      id: "vondeltuin",
      name: "De Vondeltuin",
      landmarkId: "extract_landmarks_620869345",
      modelUrl: "./models/vondeltuin.glb",
      suppressOsmIds: [
        "w1243333955",
        "NL.IMBAG.Pand.0363100012253390"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.85651048,
          52.35492528
        ],
        headingDegrees: 90,
        lengthMetres: 12.6,
        widthMetres: 15.9
      },
      surveyed: {
        anchor: [
          4.85651048,
          52.35492528
        ],
        northOffsetDegrees: 0,
        source: "Native exact BAG polygon, surveyed AHN5 roof outlines/heights cross-checked with published architect photos/section"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "De Vondeltuin",
        author: "Map Recall",
        sourceUrl: "https://doorarchitecten.nl/portfolio/horecapaviljoen-vondeltuin-gemeente-amsterdam/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-color reconstruction of surveyed shell and source-backed glazing/shingle/sunshade assemblies. No copied reference pixels or third-party mesh. Fine pane/slat divisions photographic approximations."
      }
    },
    {
      id: "centrale-markthal",
      name: "Centrale Markthal",
      landmarkId: "manual_centrale_markthal",
      modelUrl: "./models/centrale-markthal.glb",
      suppressOsmIds: [
        "NL.IMBAG.Pand.0363100012210502",
        "w276272968",
        "w1080812379",
        "w1080812380",
        "w1080812381",
        "w1080812382",
        "w1080812383",
        "w1080812384",
        "w1080812385",
        "w1080812386",
        "w1080812387",
        "w1080812388",
        "w1080812389",
        "w1080812390",
        "w1080812391",
        "w1080812392"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.86579375,
          52.37877065
        ],
        headingDegrees: 167.2,
        lengthMetres: 130.699,
        widthMetres: 72.318
      },
      surveyed: {
        anchor: [
          4.86579375,
          52.37877065
        ],
        northOffsetDegrees: -12.8,
        source: "Native PDOK BAG0363100012210502; local surveyed transverse/long-axis coordinates; AHN5 roofs"
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Centrale Markthal original surveyed reconstruction",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/526739",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-color texture-free geometry based on current BAG footprint, AHN5 roof massing, RCE architectural description and Museum Het Schip facade photos. No imported mesh or image pixels. Demolished northeast clock tower omitted. Fine facade and upper footprint details approximate."
      }
    },
    {
      id: "rasphuispoort",
      name: "Rasphuispoort",
      landmarkId: "extract_landmarks_953524097",
      modelUrl: "./models/rasphuispoort.glb",
      suppressOsmIds: [],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.891053469773061,
          52.367740805556565
        ],
        headingDegrees: 0,
        lengthMetres: 4.46,
        widthMetres: 0.97
      },
      surveyed: {
        anchor: [
          4.891053469773061,
          52.367740805556565
        ],
        northOffsetDegrees: 0,
        source: "Current BAG 0363100012165086 facade edge 24\u201325 retrieved 2026-10-05; native additive portal at scale 1, rotated -149.4246 degrees. Opening uses exact installed tile edge 18\u201319 and runtime east/height/south projection. Vertical/depth dimensions estimated from 2020 photo."
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 0,
      attribution: {
        title: "Rasphuispoort",
        author: "Map Recall",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/1482",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free additive gate with open round arch, half-columns, colored cart relief and three-figure crown. Native exact host-edge opening available only with the loaded model; no whole-host suppression. Approximate elevations; no photo pixels or imported geometry."
      },
      hostWallOpenings: [
        {
          hostIdentity: "NL.IMBAG.Pand.0363100012165086",
          enabled: true,
          anchorLngLat: [
            4.891053469773061,
            52.367740805556565
          ],
          wallEdge: [
            [
              2.1430316621888177,
              -1.3479737773575096
            ],
            [
              -1.7990851086602186,
              0.8628262225587946
            ]
          ],
          authorAngleRadians: -2.6079504457462543,
          halfWidth: 1.07,
          springHeight: 2.63,
          crownHeight: 3.7,
          portalDepth: 0.94,
          revealLayer: 0
        }
      ],
      galleryView: {
        theta: 3.691592653589793,
        phi: 1.1
      }
    }
  ];

  // scripts/landmarks/hospital-footprints.json
  var hospital_footprints_default = {
    source: "OpenStreetMap local Amsterdam.osm.pbf, extracted 2026-10-03",
    licence: "ODbL-1.0",
    sites: [
      {
        id: "olvg-west",
        outline: [
          [
            4.8377426,
            52.370064
          ],
          [
            4.8378196,
            52.3700426
          ],
          [
            4.8383124,
            52.3699686
          ],
          [
            4.8387147,
            52.3699007
          ],
          [
            4.8395639,
            52.3697924
          ],
          [
            4.8400414,
            52.3697479
          ],
          [
            4.8413937,
            52.3696621
          ],
          [
            4.8417194,
            52.3696594
          ],
          [
            4.8417096,
            52.3697808
          ],
          [
            4.8416252,
            52.3705452
          ],
          [
            4.8415508,
            52.3711712
          ],
          [
            4.8414903,
            52.3715776
          ],
          [
            4.841466,
            52.3718151
          ],
          [
            4.8414642,
            52.3718943
          ],
          [
            4.8414632,
            52.3719401
          ],
          [
            4.8402143,
            52.3721385
          ],
          [
            4.8393919,
            52.3722644
          ],
          [
            4.8389577,
            52.3723324
          ],
          [
            4.8387767,
            52.372362
          ],
          [
            4.8387107,
            52.3721991
          ],
          [
            4.8383643,
            52.3714339
          ],
          [
            4.8377426,
            52.370064
          ]
        ],
        buildings: [
          {
            type: "Feature",
            id: "w274704704",
            geometry: {
              type: "MultiPolygon",
              coordinates: [
                [
                  [
                    [
                      4.8407126,
                      52.3717944
                    ],
                    [
                      4.8407726,
                      52.3717827
                    ],
                    [
                      4.8407802,
                      52.3717972
                    ],
                    [
                      4.8407204,
                      52.3718089
                    ],
                    [
                      4.8407202,
                      52.3718089
                    ],
                    [
                      4.8407126,
                      52.3717944
                    ]
                  ]
                ]
              ]
            },
            properties: {
              building: "yes",
              "ref:bag": "0363100012186327",
              source: "BAG",
              "source:date": "2025-11-27",
              start_date: "1966"
            }
          },
          {
            type: "Feature",
            id: "w274704714",
            geometry: {
              type: "MultiPolygon",
              coordinates: [
                [
                  [
                    [
                      4.8393557,
                      52.3720996
                    ],
                    [
                      4.839423,
                      52.372089
                    ],
                    [
                      4.8394355,
                      52.372119
                    ],
                    [
                      4.8393683,
                      52.3721296
                    ],
                    [
                      4.8393557,
                      52.3720996
                    ]
                  ]
                ]
              ]
            },
            properties: {
              building: "yes",
              "ref:bag": "0363100012187037",
              source: "BAG",
              "source:date": "2014-03-24",
              start_date: "1966"
            }
          },
          {
            type: "Feature",
            id: "w1837609",
            geometry: {
              type: "MultiPolygon",
              coordinates: [
                [
                  [
                    [
                      4.8381998,
                      52.3708035
                    ],
                    [
                      4.8383604,
                      52.3707784
                    ],
                    [
                      4.8383614,
                      52.370781
                    ],
                    [
                      4.8383587,
                      52.3707816
                    ],
                    [
                      4.8383706,
                      52.3708103
                    ],
                    [
                      4.8385505,
                      52.370782
                    ],
                    [
                      4.8387142,
                      52.3711742
                    ],
                    [
                      4.8390167,
                      52.3711264
                    ],
                    [
                      4.8390812,
                      52.3711162
                    ],
                    [
                      4.8388857,
                      52.3706494
                    ],
                    [
                      4.8388724,
                      52.3706514
                    ],
                    [
                      4.8388706,
                      52.370647
                    ],
                    [
                      4.8388741,
                      52.3706464
                    ],
                    [
                      4.838863,
                      52.3706185
                    ],
                    [
                      4.8388594,
                      52.3706191
                    ],
                    [
                      4.8388577,
                      52.3706148
                    ],
                    [
                      4.8389474,
                      52.3706008
                    ],
                    [
                      4.8389484,
                      52.3706031
                    ],
                    [
                      4.8391037,
                      52.3705788
                    ],
                    [
                      4.8393246,
                      52.3711054
                    ],
                    [
                      4.8395769,
                      52.3710657
                    ],
                    [
                      4.8394412,
                      52.3707452
                    ],
                    [
                      4.8395503,
                      52.3707276
                    ],
                    [
                      4.8395006,
                      52.3706108
                    ],
                    [
                      4.8394727,
                      52.370544
                    ],
                    [
                      4.8394603,
                      52.3705459
                    ],
                    [
                      4.8394592,
                      52.3705432
                    ],
                    [
                      4.8394622,
                      52.3705428
                    ],
                    [
                      4.8394492,
                      52.3705119
                    ],
                    [
                      4.8394465,
                      52.3705125
                    ],
                    [
                      4.8394454,
                      52.3705098
                    ],
                    [
                      4.8395988,
                      52.3704857
                    ],
                    [
                      4.8395998,
                      52.3704881
                    ],
                    [
                      4.8395973,
                      52.3704885
                    ],
                    [
                      4.8396087,
                      52.370516
                    ],
                    [
                      4.8396114,
                      52.3705155
                    ],
                    [
                      4.8396121,
                      52.370517
                    ],
                    [
                      4.8397197,
                      52.3705003
                    ],
                    [
                      4.8398788,
                      52.3708787
                    ],
                    [
                      4.8400198,
                      52.3708568
                    ],
                    [
                      4.8400989,
                      52.3710456
                    ],
                    [
                      4.8400167,
                      52.3710586
                    ],
                    [
                      4.84013,
                      52.3713292
                    ],
                    [
                      4.8403814,
                      52.3712901
                    ],
                    [
                      4.8403828,
                      52.3712933
                    ],
                    [
                      4.8404073,
                      52.3712895
                    ],
                    [
                      4.840272,
                      52.3709667
                    ],
                    [
                      4.8402773,
                      52.3709659
                    ],
                    [
                      4.8402694,
                      52.3709471
                    ],
                    [
                      4.8402641,
                      52.3709479
                    ],
                    [
                      4.8402396,
                      52.3708894
                    ],
                    [
                      4.8404543,
                      52.3708558
                    ],
                    [
                      4.840463,
                      52.3708768
                    ],
                    [
                      4.8406582,
                      52.3708462
                    ],
                    [
                      4.8406494,
                      52.3708251
                    ],
                    [
                      4.8408125,
                      52.3707995
                    ],
                    [
                      4.8408369,
                      52.370858
                    ],
                    [
                      4.8408317,
                      52.3708588
                    ],
                    [
                      4.8408396,
                      52.3708776
                    ],
                    [
                      4.8408787,
                      52.3708715
                    ],
                    [
                      4.8409102,
                      52.3709467
                    ],
                    [
                      4.8408934,
                      52.3709493
                    ],
                    [
                      4.8409327,
                      52.3710432
                    ],
                    [
                      4.8409275,
                      52.371044
                    ],
                    [
                      4.8409381,
                      52.3710694
                    ],
                    [
                      4.8409434,
                      52.3710686
                    ],
                    [
                      4.8409512,
                      52.3710873
                    ],
                    [
                      4.840968,
                      52.3710847
                    ],
                    [
                      4.8410074,
                      52.3711788
                    ],
                    [
                      4.8409906,
                      52.3711814
                    ],
                    [
                      4.8409984,
                      52.3711999
                    ],
                    [
                      4.840925,
                      52.3712114
                    ],
                    [
                      4.8409356,
                      52.3712368
                    ],
                    [
                      4.8409406,
                      52.371236
                    ],
                    [
                      4.8409825,
                      52.3713361
                    ],
                    [
                      4.8405631,
                      52.3714019
                    ],
                    [
                      4.8405433,
                      52.3713545
                    ],
                    [
                      4.8404684,
                      52.3713662
                    ],
                    [
                      4.8404837,
                      52.371403
                    ],
                    [
                      4.8402618,
                      52.3714381
                    ],
                    [
                      4.8404581,
                      52.3719055
                    ],
                    [
                      4.8400678,
                      52.3719673
                    ],
                    [
                      4.8400298,
                      52.3718768
                    ],
                    [
                      4.8399961,
                      52.3717879
                    ],
                    [
                      4.8399715,
                      52.3717915
                    ],
                    [
                      4.8399593,
                      52.3717616
                    ],
                    [
                      4.839984,
                      52.3717589
                    ],
                    [
                      4.8399506,
                      52.3716781
                    ],
                    [
                      4.8399471,
                      52.3716782
                    ],
                    [
                      4.839875,
                      52.3715048
                    ],
                    [
                      4.8397758,
                      52.3715201
                    ],
                    [
                      4.8398295,
                      52.3716505
                    ],
                    [
                      4.8395876,
                      52.3716884
                    ],
                    [
                      4.8397103,
                      52.3719862
                    ],
                    [
                      4.8394432,
                      52.372027
                    ],
                    [
                      4.839368,
                      52.3718457
                    ],
                    [
                      4.8394091,
                      52.3718392
                    ],
                    [
                      4.8394075,
                      52.3718355
                    ],
                    [
                      4.8394066,
                      52.3718356
                    ],
                    [
                      4.8393141,
                      52.3716146
                    ],
                    [
                      4.839213,
                      52.3716306
                    ],
                    [
                      4.8389247,
                      52.3716761
                    ],
                    [
                      4.8390882,
                      52.3720674
                    ],
                    [
                      4.8387677,
                      52.3721178
                    ],
                    [
                      4.8385463,
                      52.371589
                    ],
                    [
                      4.8385055,
                      52.3714908
                    ],
                    [
                      4.8384513,
                      52.3713604
                    ],
                    [
                      4.8384256,
                      52.3713644
                    ],
                    [
                      4.8383687,
                      52.3712284
                    ],
                    [
                      4.8383937,
                      52.3712245
                    ],
                    [
                      4.8382311,
                      52.3708371
                    ],
                    [
                      4.838215,
                      52.3708396
                    ],
                    [
                      4.8382139,
                      52.370837
                    ],
                    [
                      4.8382168,
                      52.3708364
                    ],
                    [
                      4.8382037,
                      52.3708058
                    ],
                    [
                      4.8382009,
                      52.3708062
                    ],
                    [
                      4.8381998,
                      52.3708035
                    ]
                  ],
                  [
                    [
                      4.8395289,
                      52.3717083
                    ],
                    [
                      4.8395423,
                      52.3717428
                    ],
                    [
                      4.839574,
                      52.3717387
                    ],
                    [
                      4.839582,
                      52.3717587
                    ],
                    [
                      4.8395523,
                      52.3717636
                    ],
                    [
                      4.8395702,
                      52.3718096
                    ],
                    [
                      4.8395691,
                      52.3718102
                    ],
                    [
                      4.8395908,
                      52.3718625
                    ],
                    [
                      4.8396244,
                      52.3718571
                    ],
                    [
                      4.8395607,
                      52.3717028
                    ],
                    [
                      4.8395289,
                      52.3717083
                    ]
                  ],
                  [
                    [
                      4.8404546,
                      52.3709851
                    ],
                    [
                      4.8405424,
                      52.3711947
                    ],
                    [
                      4.8407771,
                      52.3711578
                    ],
                    [
                      4.8407675,
                      52.3711348
                    ],
                    [
                      4.8407681,
                      52.3711345
                    ],
                    [
                      4.8407771,
                      52.3711333
                    ],
                    [
                      4.8406997,
                      52.3709467
                    ],
                    [
                      4.8404546,
                      52.3709851
                    ]
                  ]
                ]
              ]
            },
            properties: {
              building: "hospital",
              "building:levels": "10",
              "ref:bag": "0363100012074757",
              "roof:levels": "0",
              "roof:shape": "flat",
              source: "BAG",
              "source:date": "2014-03-24",
              start_date: "1966",
              wikidata: "Q3269552"
            }
          },
          {
            type: "Feature",
            id: "w12206467",
            geometry: {
              type: "MultiPolygon",
              coordinates: [
                [
                  [
                    [
                      4.8390778,
                      52.3702749
                    ],
                    [
                      4.8390922,
                      52.3702727
                    ],
                    [
                      4.8391538,
                      52.3702633
                    ],
                    [
                      4.8390967,
                      52.3701225
                    ],
                    [
                      4.8390951,
                      52.3701184
                    ],
                    [
                      4.8393733,
                      52.3700763
                    ],
                    [
                      4.8393746,
                      52.3700796
                    ],
                    [
                      4.8393789,
                      52.3700903
                    ],
                    [
                      4.8393808,
                      52.3700948
                    ],
                    [
                      4.8393822,
                      52.3700984
                    ],
                    [
                      4.8393836,
                      52.3701018
                    ],
                    [
                      4.839385,
                      52.3701054
                    ],
                    [
                      4.8393864,
                      52.3701087
                    ],
                    [
                      4.839395,
                      52.37013
                    ],
                    [
                      4.8394319,
                      52.3702213
                    ],
                    [
                      4.8395079,
                      52.3702097
                    ],
                    [
                      4.8395303,
                      52.370264
                    ],
                    [
                      4.8395437,
                      52.3702966
                    ],
                    [
                      4.8395196,
                      52.3703004
                    ],
                    [
                      4.8395177,
                      52.3702956
                    ],
                    [
                      4.8394751,
                      52.370302
                    ],
                    [
                      4.8394771,
                      52.3703068
                    ],
                    [
                      4.8394712,
                      52.3703076
                    ],
                    [
                      4.8394693,
                      52.3703029
                    ],
                    [
                      4.8394266,
                      52.3703093
                    ],
                    [
                      4.8394286,
                      52.3703142
                    ],
                    [
                      4.8394227,
                      52.3703151
                    ],
                    [
                      4.8394208,
                      52.3703102
                    ],
                    [
                      4.8393781,
                      52.3703167
                    ],
                    [
                      4.8393801,
                      52.3703216
                    ],
                    [
                      4.8393741,
                      52.3703225
                    ],
                    [
                      4.8393722,
                      52.3703176
                    ],
                    [
                      4.8393298,
                      52.370324
                    ],
                    [
                      4.8393318,
                      52.3703289
                    ],
                    [
                      4.8393259,
                      52.3703298
                    ],
                    [
                      4.839324,
                      52.3703249
                    ],
                    [
                      4.8392812,
                      52.3703313
                    ],
                    [
                      4.8392832,
                      52.3703363
                    ],
                    [
                      4.8392775,
                      52.3703372
                    ],
                    [
                      4.8392755,
                      52.3703322
                    ],
                    [
                      4.8392328,
                      52.3703387
                    ],
                    [
                      4.8392348,
                      52.3703436
                    ],
                    [
                      4.839229,
                      52.3703446
                    ],
                    [
                      4.8392269,
                      52.3703396
                    ],
                    [
                      4.8391844,
                      52.370346
                    ],
                    [
                      4.8391864,
                      52.370351
                    ],
                    [
                      4.83918,
                      52.3703518
                    ],
                    [
                      4.839178,
                      52.370347
                    ],
                    [
                      4.8391357,
                      52.3703534
                    ],
                    [
                      4.8391376,
                      52.3703581
                    ],
                    [
                      4.8391136,
                      52.3703618
                    ],
                    [
                      4.8390778,
                      52.3702749
                    ]
                  ],
                  [
                    [
                      4.8392068,
                      52.3701586
                    ],
                    [
                      4.8392392,
                      52.3702384
                    ],
                    [
                      4.8393247,
                      52.3702254
                    ],
                    [
                      4.8392923,
                      52.3701456
                    ],
                    [
                      4.8392068,
                      52.3701586
                    ]
                  ]
                ]
              ]
            },
            properties: {
              building: "garages",
              "ref:bag": "0363100012242128",
              source: "BAG",
              "source:date": "2021-01-18",
              start_date: "2015"
            }
          },
          {
            type: "Feature",
            id: "w1454128989",
            geometry: {
              type: "MultiPolygon",
              coordinates: [
                [
                  [
                    [
                      4.8405588,
                      52.3716997
                    ],
                    [
                      4.8405621,
                      52.3716847
                    ],
                    [
                      4.8405768,
                      52.3716729
                    ],
                    [
                      4.8407129,
                      52.3716335
                    ],
                    [
                      4.8407253,
                      52.3716246
                    ],
                    [
                      4.8407286,
                      52.3716095
                    ],
                    [
                      4.8407451,
                      52.3714941
                    ],
                    [
                      4.8407552,
                      52.3714842
                    ],
                    [
                      4.8407754,
                      52.3714772
                    ],
                    [
                      4.8410428,
                      52.3714573
                    ],
                    [
                      4.8410697,
                      52.3714654
                    ],
                    [
                      4.8410803,
                      52.3714822
                    ],
                    [
                      4.8410526,
                      52.3717158
                    ],
                    [
                      4.8410347,
                      52.3717471
                    ],
                    [
                      4.8410007,
                      52.3717717
                    ],
                    [
                      4.840952,
                      52.3717904
                    ],
                    [
                      4.8406774,
                      52.3718692
                    ],
                    [
                      4.8406437,
                      52.3718666
                    ],
                    [
                      4.8406283,
                      52.3718586
                    ],
                    [
                      4.8406187,
                      52.3718428
                    ],
                    [
                      4.8405588,
                      52.3716997
                    ]
                  ]
                ]
              ]
            },
            properties: {
              building: "construction",
              construction: "yes",
              "ref:bag": "0363100100091814",
              source: "BAG",
              "source:date": "2025-11-27",
              start_date: "2024"
            }
          },
          {
            type: "Feature",
            id: "w1488945488",
            geometry: {
              type: "MultiPolygon",
              coordinates: [
                [
                  [
                    [
                      4.8382614,
                      52.3703477
                    ],
                    [
                      4.838423,
                      52.370322
                    ],
                    [
                      4.8384473,
                      52.3703804
                    ],
                    [
                      4.838451,
                      52.3703893
                    ],
                    [
                      4.838454,
                      52.3703971
                    ],
                    [
                      4.8382911,
                      52.370423
                    ],
                    [
                      4.8382614,
                      52.3703477
                    ]
                  ]
                ]
              ]
            },
            properties: {
              building: "yes",
              height: "3.3",
              "ref:bag": "0363100012246187",
              source: "BAG",
              "source:date": "2026-03-13",
              "source:height": "3DBAG",
              "source:height:date": "2025-09-03",
              start_date: "2016"
            }
          }
        ]
      },
      {
        id: "olvg-oost",
        outline: [
          [
            4.9133947,
            52.3582259
          ],
          [
            4.914054,
            52.357267
          ],
          [
            4.9172493,
            52.3580671
          ],
          [
            4.9166089,
            52.3590348
          ],
          [
            4.9163797,
            52.3589753
          ],
          [
            4.9162653,
            52.358942
          ],
          [
            4.914941,
            52.3586108
          ],
          [
            4.9133947,
            52.3582259
          ]
        ],
        buildings: [
          {
            type: "Feature",
            id: "w44451612",
            geometry: {
              type: "MultiPolygon",
              coordinates: [
                [
                  [
                    [
                      4.9134241,
                      52.3582118
                    ],
                    [
                      4.9136787,
                      52.3578355
                    ],
                    [
                      4.9138941,
                      52.3578902
                    ],
                    [
                      4.913924,
                      52.3578462
                    ],
                    [
                      4.9140171,
                      52.3578699
                    ],
                    [
                      4.9139874,
                      52.3579138
                    ],
                    [
                      4.9142866,
                      52.3579897
                    ],
                    [
                      4.9144265,
                      52.3577829
                    ],
                    [
                      4.9143775,
                      52.3577705
                    ],
                    [
                      4.9144243,
                      52.357701
                    ],
                    [
                      4.9144129,
                      52.3576981
                    ],
                    [
                      4.914361,
                      52.3577759
                    ],
                    [
                      4.9142922,
                      52.3578753
                    ],
                    [
                      4.9138846,
                      52.3577727
                    ],
                    [
                      4.9139513,
                      52.3576728
                    ],
                    [
                      4.9143128,
                      52.3577641
                    ],
                    [
                      4.9143655,
                      52.357686
                    ],
                    [
                      4.9142373,
                      52.3576535
                    ],
                    [
                      4.9142185,
                      52.3576809
                    ],
                    [
                      4.9140524,
                      52.3576384
                    ],
                    [
                      4.9140538,
                      52.3576364
                    ],
                    [
                      4.9140326,
                      52.357631
                    ],
                    [
                      4.9140307,
                      52.3576339
                    ],
                    [
                      4.9139677,
                      52.3576179
                    ],
                    [
                      4.9139613,
                      52.3576272
                    ],
                    [
                      4.9139215,
                      52.357617
                    ],
                    [
                      4.9139277,
                      52.3576078
                    ],
                    [
                      4.9138461,
                      52.3575871
                    ],
                    [
                      4.9138486,
                      52.3575833
                    ],
                    [
                      4.9138501,
                      52.3575837
                    ],
                    [
                      4.9140177,
                      52.3573367
                    ],
                    [
                      4.9140162,
                      52.3573363
                    ],
                    [
                      4.9140484,
                      52.3572887
                    ],
                    [
                      4.9140684,
                      52.3572937
                    ],
                    [
                      4.9140778,
                      52.3572799
                    ],
                    [
                      4.9140854,
                      52.3572818
                    ],
                    [
                      4.9140848,
                      52.3572828
                    ],
                    [
                      4.9142146,
                      52.3573157
                    ],
                    [
                      4.9142152,
                      52.3573148
                    ],
                    [
                      4.9142225,
                      52.3573167
                    ],
                    [
                      4.9142057,
                      52.3573416
                    ],
                    [
                      4.9142328,
                      52.3573485
                    ],
                    [
                      4.9142315,
                      52.3573503
                    ],
                    [
                      4.9142831,
                      52.3573635
                    ],
                    [
                      4.9142521,
                      52.357409
                    ],
                    [
                      4.9142009,
                      52.3573959
                    ],
                    [
                      4.9141797,
                      52.357427
                    ],
                    [
                      4.9141693,
                      52.3574243
                    ],
                    [
                      4.9140859,
                      52.3575467
                    ],
                    [
                      4.9140925,
                      52.3575484
                    ],
                    [
                      4.9140739,
                      52.3575758
                    ],
                    [
                      4.9140701,
                      52.3575748
                    ],
                    [
                      4.9140671,
                      52.3575792
                    ],
                    [
                      4.914088,
                      52.3575845
                    ],
                    [
                      4.914205,
                      52.3574076
                    ],
                    [
                      4.9142612,
                      52.3574228
                    ],
                    [
                      4.9142963,
                      52.3573711
                    ],
                    [
                      4.9144081,
                      52.3573993
                    ],
                    [
                      4.9142557,
                      52.3576268
                    ],
                    [
                      4.914443,
                      52.3576744
                    ],
                    [
                      4.9146007,
                      52.3574429
                    ],
                    [
                      4.9151567,
                      52.3575848
                    ],
                    [
                      4.9151431,
                      52.3576024
                    ],
                    [
                      4.915075,
                      52.3577031
                    ],
                    [
                      4.9152823,
                      52.3577556
                    ],
                    [
                      4.9153586,
                      52.3576429
                    ],
                    [
                      4.9157278,
                      52.3577365
                    ],
                    [
                      4.9157237,
                      52.3577427
                    ],
                    [
                      4.9158915,
                      52.3577853
                    ],
                    [
                      4.9158958,
                      52.3577789
                    ],
                    [
                      4.916265,
                      52.3578726
                    ],
                    [
                      4.9162608,
                      52.3578792
                    ],
                    [
                      4.9164287,
                      52.3579214
                    ],
                    [
                      4.916433,
                      52.357915
                    ],
                    [
                      4.916712,
                      52.3579856
                    ],
                    [
                      4.9167129,
                      52.3579859
                    ],
                    [
                      4.9167081,
                      52.3579925
                    ],
                    [
                      4.9168764,
                      52.358035
                    ],
                    [
                      4.9168787,
                      52.3580315
                    ],
                    [
                      4.9170169,
                      52.3580658
                    ],
                    [
                      4.9170461,
                      52.3580232
                    ],
                    [
                      4.9171747,
                      52.3580557
                    ],
                    [
                      4.9171737,
                      52.358058
                    ],
                    [
                      4.9172218,
                      52.3580703
                    ],
                    [
                      4.9172083,
                      52.3580901
                    ],
                    [
                      4.9172193,
                      52.3580929
                    ],
                    [
                      4.9169434,
                      52.3585019
                    ],
                    [
                      4.9169194,
                      52.3584959
                    ],
                    [
                      4.9168731,
                      52.3585649
                    ],
                    [
                      4.9168715,
                      52.3585682
                    ],
                    [
                      4.9168693,
                      52.3585718
                    ],
                    [
                      4.9168677,
                      52.3585746
                    ],
                    [
                      4.9168655,
                      52.3585777
                    ],
                    [
                      4.9168604,
                      52.3585838
                    ],
                    [
                      4.9168138,
                      52.358653
                    ],
                    [
                      4.91684,
                      52.3586599
                    ],
                    [
                      4.9166334,
                      52.3589664
                    ],
                    [
                      4.9166287,
                      52.3589649
                    ],
                    [
                      4.9165916,
                      52.3590203
                    ],
                    [
                      4.9165249,
                      52.3590033
                    ],
                    [
                      4.9165219,
                      52.3590078
                    ],
                    [
                      4.9165094,
                      52.3590046
                    ],
                    [
                      4.9165123,
                      52.3590003
                    ],
                    [
                      4.9164477,
                      52.3589833
                    ],
                    [
                      4.916417,
                      52.3589759
                    ],
                    [
                      4.9164145,
                      52.3589806
                    ],
                    [
                      4.9164017,
                      52.3589772
                    ],
                    [
                      4.9164069,
                      52.3589691
                    ],
                    [
                      4.916414,
                      52.358971
                    ],
                    [
                      4.9164389,
                      52.358934
                    ],
                    [
                      4.9164318,
                      52.3589329
                    ],
                    [
                      4.9164372,
                      52.3589243
                    ],
                    [
                      4.916444,
                      52.358926
                    ],
                    [
                      4.916469,
                      52.358889
                    ],
                    [
                      4.9164621,
                      52.358888
                    ],
                    [
                      4.9164675,
                      52.3588796
                    ],
                    [
                      4.9164743,
                      52.3588812
                    ],
                    [
                      4.9164976,
                      52.3588438
                    ],
                    [
                      4.9164924,
                      52.3588431
                    ],
                    [
                      4.916498,
                      52.3588349
                    ],
                    [
                      4.9165048,
                      52.3588366
                    ],
                    [
                      4.916529,
                      52.3588
                    ],
                    [
                      4.9165228,
                      52.3587983
                    ],
                    [
                      4.9165283,
                      52.3587901
                    ],
                    [
                      4.9165339,
                      52.358792
                    ],
                    [
                      4.9165595,
                      52.3587553
                    ],
                    [
                      4.916553,
                      52.3587535
                    ],
                    [
                      4.9165586,
                      52.3587452
                    ],
                    [
                      4.9165642,
                      52.3587466
                    ],
                    [
                      4.9165899,
                      52.3587104
                    ],
                    [
                      4.9165831,
                      52.3587087
                    ],
                    [
                      4.916589,
                      52.3587003
                    ],
                    [
                      4.916595,
                      52.358702
                    ],
                    [
                      4.9166204,
                      52.3586657
                    ],
                    [
                      4.9166134,
                      52.3586639
                    ],
                    [
                      4.9166192,
                      52.3586556
                    ],
                    [
                      4.9166258,
                      52.3586573
                    ],
                    [
                      4.9166507,
                      52.3586208
                    ],
                    [
                      4.9166438,
                      52.358619
                    ],
                    [
                      4.916647,
                      52.3586142
                    ],
                    [
                      4.9166237,
                      52.3586083
                    ],
                    [
                      4.9165255,
                      52.3585833
                    ],
                    [
                      4.9163405,
                      52.3585362
                    ],
                    [
                      4.9163348,
                      52.3585446
                    ],
                    [
                      4.9163406,
                      52.3585514
                    ],
                    [
                      4.9163455,
                      52.3585584
                    ],
                    [
                      4.9163496,
                      52.3585657
                    ],
                    [
                      4.9163527,
                      52.3585731
                    ],
                    [
                      4.916355,
                      52.3585807
                    ],
                    [
                      4.9163563,
                      52.3585883
                    ],
                    [
                      4.9163567,
                      52.3585959
                    ],
                    [
                      4.9163562,
                      52.3586036
                    ],
                    [
                      4.9163547,
                      52.3586112
                    ],
                    [
                      4.9163536,
                      52.358615
                    ],
                    [
                      4.9163508,
                      52.3586225
                    ],
                    [
                      4.916347,
                      52.3586298
                    ],
                    [
                      4.9163424,
                      52.3586369
                    ],
                    [
                      4.9163397,
                      52.3586404
                    ],
                    [
                      4.9163369,
                      52.3586438
                    ],
                    [
                      4.9163306,
                      52.3586504
                    ],
                    [
                      4.9163235,
                      52.3586567
                    ],
                    [
                      4.9163156,
                      52.3586627
                    ],
                    [
                      4.9163071,
                      52.3586683
                    ],
                    [
                      4.9162979,
                      52.3586735
                    ],
                    [
                      4.916288,
                      52.3586783
                    ],
                    [
                      4.9162777,
                      52.3586826
                    ],
                    [
                      4.9162612,
                      52.3586881
                    ],
                    [
                      4.9162497,
                      52.3586911
                    ],
                    [
                      4.9162379,
                      52.3586937
                    ],
                    [
                      4.9162196,
                      52.3586964
                    ],
                    [
                      4.9162073,
                      52.3586975
                    ],
                    [
                      4.9161948,
                      52.3586981
                    ],
                    [
                      4.9161822,
                      52.3586981
                    ],
                    [
                      4.9161697,
                      52.3586975
                    ],
                    [
                      4.9161512,
                      52.3586956
                    ],
                    [
                      4.9161437,
                      52.3586944
                    ],
                    [
                      4.9161261,
                      52.3586908
                    ],
                    [
                      4.9161148,
                      52.3586877
                    ],
                    [
                      4.9160986,
                      52.3586821
                    ],
                    [
                      4.9160835,
                      52.3586755
                    ],
                    [
                      4.9160697,
                      52.3586679
                    ],
                    [
                      4.9160613,
                      52.3586623
                    ],
                    [
                      4.91605,
                      52.3586533
                    ],
                    [
                      4.9160404,
                      52.3586436
                    ],
                    [
                      4.9160376,
                      52.3586402
                    ],
                    [
                      4.9160326,
                      52.3586332
                    ],
                    [
                      4.9160285,
                      52.3586261
                    ],
                    [
                      4.9160252,
                      52.3586188
                    ],
                    [
                      4.9160239,
                      52.3586151
                    ],
                    [
                      4.916022,
                      52.3586076
                    ],
                    [
                      4.9160208,
                      52.3585962
                    ],
                    [
                      4.9160212,
                      52.3585887
                    ],
                    [
                      4.9159221,
                      52.3585636
                    ],
                    [
                      4.9158337,
                      52.3586941
                    ],
                    [
                      4.9161286,
                      52.3587694
                    ],
                    [
                      4.9161073,
                      52.3588008
                    ],
                    [
                      4.9161153,
                      52.3588035
                    ],
                    [
                      4.91612,
                      52.3588058
                    ],
                    [
                      4.9161259,
                      52.35881
                    ],
                    [
                      4.916129,
                      52.3588132
                    ],
                    [
                      4.9161313,
                      52.3588166
                    ],
                    [
                      4.9161333,
                      52.3588221
                    ],
                    [
                      4.9161333,
                      52.3588276
                    ],
                    [
                      4.9161323,
                      52.3588313
                    ],
                    [
                      4.9161315,
                      52.358833
                    ],
                    [
                      4.9161292,
                      52.3588362
                    ],
                    [
                      4.9161263,
                      52.3588394
                    ],
                    [
                      4.9161225,
                      52.3588424
                    ],
                    [
                      4.9161157,
                      52.3588461
                    ],
                    [
                      4.9161132,
                      52.3588472
                    ],
                    [
                      4.9161078,
                      52.3588489
                    ],
                    [
                      4.916102,
                      52.3588501
                    ],
                    [
                      4.916093,
                      52.358851
                    ],
                    [
                      4.9160839,
                      52.3588506
                    ],
                    [
                      4.9160751,
                      52.358849
                    ],
                    [
                      4.9160542,
                      52.3588805
                    ],
                    [
                      4.9158104,
                      52.3588191
                    ],
                    [
                      4.9156645,
                      52.358782
                    ],
                    [
                      4.9156744,
                      52.3587675
                    ],
                    [
                      4.9156542,
                      52.3587623
                    ],
                    [
                      4.9157227,
                      52.3586608
                    ],
                    [
                      4.9158041,
                      52.3586813
                    ],
                    [
                      4.9158633,
                      52.3585928
                    ],
                    [
                      4.9158327,
                      52.3585852
                    ],
                    [
                      4.9158579,
                      52.3585474
                    ],
                    [
                      4.9157331,
                      52.3585158
                    ],
                    [
                      4.9156692,
                      52.3586102
                    ],
                    [
                      4.9156456,
                      52.3586043
                    ],
                    [
                      4.9155536,
                      52.3587416
                    ],
                    [
                      4.9155451,
                      52.3587543
                    ],
                    [
                      4.9154883,
                      52.35874
                    ],
                    [
                      4.915588,
                      52.3585927
                    ],
                    [
                      4.9154827,
                      52.3585657
                    ],
                    [
                      4.9153819,
                      52.3587145
                    ],
                    [
                      4.9149317,
                      52.3586005
                    ],
                    [
                      4.9149321,
                      52.3585998
                    ],
                    [
                      4.9149248,
                      52.3585979
                    ],
                    [
                      4.9149314,
                      52.3585878
                    ],
                    [
                      4.9149305,
                      52.3585876
                    ],
                    [
                      4.9149371,
                      52.3585777
                    ],
                    [
                      4.9150785,
                      52.3583682
                    ],
                    [
                      4.9150414,
                      52.3583589
                    ],
                    [
                      4.9150382,
                      52.3583638
                    ],
                    [
                      4.9150138,
                      52.3583573
                    ],
                    [
                      4.9149891,
                      52.3583512
                    ],
                    [
                      4.9150011,
                      52.3583341
                    ],
                    [
                      4.9149984,
                      52.3583334
                    ],
                    [
                      4.9150006,
                      52.3583302
                    ],
                    [
                      4.9149626,
                      52.3583206
                    ],
                    [
                      4.9149479,
                      52.3583415
                    ],
                    [
                      4.9149418,
                      52.3583413
                    ],
                    [
                      4.9149298,
                      52.3583403
                    ],
                    [
                      4.914918,
                      52.3583388
                    ],
                    [
                      4.9149064,
                      52.3583367
                    ],
                    [
                      4.9148951,
                      52.358334
                    ],
                    [
                      4.9148841,
                      52.3583308
                    ],
                    [
                      4.9148736,
                      52.3583272
                    ],
                    [
                      4.9148636,
                      52.358323
                    ],
                    [
                      4.9148541,
                      52.3583184
                    ],
                    [
                      4.9148687,
                      52.3582969
                    ],
                    [
                      4.914856,
                      52.3582937
                    ],
                    [
                      4.9147885,
                      52.3583938
                    ],
                    [
                      4.914875,
                      52.3584156
                    ],
                    [
                      4.9148795,
                      52.3584171
                    ],
                    [
                      4.9148852,
                      52.35842
                    ],
                    [
                      4.9148895,
                      52.3584237
                    ],
                    [
                      4.9148914,
                      52.3584266
                    ],
                    [
                      4.9148925,
                      52.3584295
                    ],
                    [
                      4.9148927,
                      52.3584311
                    ],
                    [
                      4.9148925,
                      52.3584341
                    ],
                    [
                      4.9148914,
                      52.3584371
                    ],
                    [
                      4.9148905,
                      52.3584385
                    ],
                    [
                      4.9148022,
                      52.3585693
                    ],
                    [
                      4.9144342,
                      52.3584763
                    ],
                    [
                      4.9145071,
                      52.3583679
                    ],
                    [
                      4.9145259,
                      52.3583726
                    ],
                    [
                      4.9145857,
                      52.3582847
                    ],
                    [
                      4.914519,
                      52.3582678
                    ],
                    [
                      4.9145021,
                      52.3582925
                    ],
                    [
                      4.9143875,
                      52.3582634
                    ],
                    [
                      4.9143937,
                      52.3582543
                    ],
                    [
                      4.9138414,
                      52.3581144
                    ],
                    [
                      4.9138577,
                      52.3580914
                    ],
                    [
                      4.9138181,
                      52.3580808
                    ],
                    [
                      4.9138021,
                      52.3581033
                    ],
                    [
                      4.9138242,
                      52.3581092
                    ],
                    [
                      4.9138031,
                      52.3581393
                    ],
                    [
                      4.9138344,
                      52.3581473
                    ],
                    [
                      4.9137906,
                      52.3582119
                    ],
                    [
                      4.9137875,
                      52.3582111
                    ],
                    [
                      4.9137676,
                      52.3582406
                    ],
                    [
                      4.9138599,
                      52.3582646
                    ],
                    [
                      4.9138608,
                      52.3582632
                    ],
                    [
                      4.9138721,
                      52.3582661
                    ],
                    [
                      4.9138796,
                      52.3582554
                    ],
                    [
                      4.9139476,
                      52.3582729
                    ],
                    [
                      4.9139035,
                      52.358336
                    ],
                    [
                      4.9134241,
                      52.3582118
                    ]
                  ]
                ]
              ]
            },
            properties: {
              building: "hospital",
              "ref:bag": "0363100012124921",
              source: "BAG",
              "source:date": "2014-03-24",
              start_date: "1900"
            }
          },
          {
            type: "Feature",
            id: "w278102390",
            geometry: {
              type: "MultiPolygon",
              coordinates: [
                [
                  [
                    [
                      4.9141073,
                      52.3583888
                    ],
                    [
                      4.9141521,
                      52.3583224
                    ],
                    [
                      4.9143893,
                      52.3583826
                    ],
                    [
                      4.9143489,
                      52.3584428
                    ],
                    [
                      4.9143446,
                      52.358449
                    ],
                    [
                      4.9141073,
                      52.3583888
                    ]
                  ]
                ]
              ]
            },
            properties: {
              building: "yes",
              height: "5.7",
              "ref:bag": "0363100012159066",
              source: "BAG",
              "source:date": "2014-03-24",
              "source:height": "3DBAG",
              "source:height:date": "2025-09-03",
              start_date: "1990"
            }
          }
        ]
      }
    ]
  };

  // src/canalRecall/landmarks/manualModels.ts
  var ownAttribution = (title, sourceUrl) => ({ title, author: "Map Recall", sourceUrl, licence: "Original project asset", licenceUrl: "./LICENSE", modifications: "Original low-poly reconstruction; reference used for silhouette only. Flat materials, no imported model geometry or image textures. Hospital footprints from OpenStreetMap (ODbL); heights and architectural details are approximate." });
  var MANUAL_LANDMARKS = [
    {
      id: "centraal-station",
      name: "Amsterdam Centraal \u2014 station complex",
      landmarkId: "extract_landmarks_332626598",
      modelUrl: "./models/centraal-station.glb",
      suppressOsmIds: ["w332626598", "w57856845", "w1239767708", "w1239767706", "w451533145", "w451533147", "w451533149", "w506192827", "NL.IMBAG.Pand.0363100012185598", "NL.IMBAG.Pand.0363100012242112", "NL.IMBAG.Pand.0363100012240304", "NL.IMBAG.Pand.0363100012245758", "NL.IMBAG.Pand.0363100012245759", "NL.IMBAG.Pand.0363100012246251"],
      spatialSuppression: false,
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 210.6533,
      footprint: { centre: [4.899750668752946, 52.37855998792934], headingDegrees: 120.65330083236796, lengthMetres: 244.34798071019168, widthMetres: 30.916412054875813 },
      surveyed: { anchor: [4.899750668752946, 52.37855998792934], northOffsetDegrees: 30.65330083236796, source: "OSM Cuypersgebouw anchor/bearing; four exact current train/bus roof outlines. Zuidkap 23 m /50 frames per ProRail; other profiles and bus deck approximately reconstructed from architect photographs and 3DBAG." },
      attribution: { ...ownAttribution("Amsterdam Centraal", "https://www.benthemcrouwel.com/projects/bus-station-amsterdam-cs"), modifications: "Original texture-free Cuypers facade and four arched roof structures. Current mapped roof perimeters retained at native scale; approximate interior roof profiles, frame details and raised bus deck. Published Zuidkap 23 m height and 50 frames. Colored AMSTERDAM glass panels follow architect photographs. No imported geometry or photo pixels. Metro, ferry piers, hotel/postal buildings and ground-level streets omitted." }
    },
    {
      id: "muziekgebouw-bimhuis",
      name: "Muziekgebouw aan \u2019t IJ / Bimhuis",
      landmarkId: "extract_landmarks_1912967098",
      relatedLandmarkIds: ["extract_landmarks_1651446989"],
      modelUrl: "./models/muziekgebouw-bimhuis.glb",
      suppressOsmIds: ["w755464127", "w755464129", "w755464130", "w755464132", "w755504271", "w755504272", "w755504273", "w755504274", "w755504275", "w755464126", "w755464128"],
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 196,
      surveyed: { anchor: [4.91313365, 52.37829585], northOffsetDegrees: 15.8, source: "OSM main auditorium w755464132 rectangle centre / bearing" },
      attribution: ownAttribution("Muziekgebouw and Bimhuis", "https://www.studiocarchitecten.nl/en/bimhuis")
    },
    ...manualCatalogue_default,
    ...hospital_footprints_default.sites.map((s) => ({ id: s.id, name: s.id === "olvg-west" ? "OLVG West" : "OLVG Oost", landmarkId: s.id, modelUrl: `./models/${s.id}.glb`, suppressOsmIds: s.buildings.filter((f) => f.properties.building !== "construction").flatMap((f) => [f.id, ...f.properties["ref:bag"] ? [`NL.IMBAG.Pand.${f.properties["ref:bag"]}`] : []]), spatialSuppression: false, groundAltitudeMetres: 0, facingOffsetDegrees: 0, surveyed: { anchor: s.id === "olvg-west" ? [4.8397, 52.37115] : [4.9153, 52.3582], northOffsetDegrees: 0, source: "OSM building rings; local east/south metres" }, attribution: ownAttribution(s.id === "olvg-west" ? "OLVG West" : "OLVG Oost", "https://www.olvg.nl/over-olvg/") }))
  ];

  // public/canal-drive/ordinary-buildings-data/catalogue.json
  var catalogue_default = {
    version: 1,
    models: [
      {
        id: "ordinary-0363100012242125",
        buildingId: "NL.IMBAG.Pand.0363100012242125",
        name: "Simple gray metal industrial shed",
        anchor: [
          4.788693,
          52.394305
        ],
        cameraBearing: 1.109596432550859,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.788421,
                52.394573
              ],
              [
                4.788421,
                52.394591
              ],
              [
                4.788368,
                52.394591
              ],
              [
                4.788368,
                52.394573
              ],
              [
                4.788085,
                52.394573
              ],
              [
                4.788085,
                52.394447
              ],
              [
                4.788087,
                52.394019
              ],
              [
                4.789301,
                52.394021
              ],
              [
                4.789298,
                52.394575
              ],
              [
                4.788421,
                52.394573
              ]
            ]
          ]
        },
        height: 14.307202339172363,
        modelUrl: "./models/ordinary-buildings/0363100012242125.glb",
        bounds: {
          min: [
            -41.319515228271484,
            0,
            -31.855520248413086
          ],
          max: [
            41.319515228271484,
            14.307202339172363,
            31.855520248413086
          ]
        },
        triangles: 678,
        bytes: 162728,
        materials: 2,
        hash: "565d60ca36f881907407f903b52b0d440e3e24c36bc4eff35a6e3dea9debfa8f",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012242125/reference-0363100012242125-2025-recording_2025-07-01_04-12-51_02405.jpg",
          "./ordinary-buildings-data/references/0363100012242125/reference-0363100012242125-2025-recording_2025-07-01_04-12-51_02391.jpg",
          "./ordinary-buildings-data/references/0363100012242125/reference-0363100012242125-2024-recording_2024-09-18_07-45-49_01251.jpg"
        ],
        sourcePack: "experiments/ordinary-ten/west/0363100012242125",
        traits: [
          "Large native rectangular metal industrial shed, flat roof edge: overwhelmingly blank pale-gray northern facade and darker gray east facade. Preserve vertical fine corrugation; do not apply domestic window grid.",
          "Full-resolution north-centered photo has straight horizontal top; NE-corner image apparent peak is perspective convergence of horizontal perimeter edges, not a pitched ridge.",
          "West end has two upper rows of narrow rectangular office windows, about 0.9\u20131.2 m wide by 1.8\u20132.1 m tall, above dark covered loading/vehicle bays one storey (about 3.5\u20134 m) high. Native west face edges 4/5.",
          "Thin pale lower curb and very restrained roof perimeter trim; use neutral gray roof surface inferred from edge material, record it as approximate where top itself unseen.",
          "External round tank and neighboring delivery/service building lie outside exact polygon. Dark west loading recess is local industrial frontage, with no evidence for a public through-passage or surveyed court; do not invent a traversable underpass."
        ],
        simplifications: [
          "Minor roof/equipment patches below0.8% footprint area omitted; main fitted roof planes retained."
        ],
        sourceTiming: {
          sourceRequestStartedAt: "2026-10-06T19:23:13+00:00",
          recipeCompletedAt: "2026-10-06T19:28:44.675454+00:00",
          sourceAndReviewElapsedSeconds: 332,
          scope: "Shared bounded acquisition/cropping/visual review for eight candidates; excludes initial local selection time and root modeling/game acceptance."
        },
        heightEvidence: "Official fitted roof plane vertices minus b3_h_maaiveld; dominant regions clipped to native footprint, eaves and local roof slopes retained. Equipment planes below0.8% footprint area omitted.",
        facadeRecipe: {
          levels: 1,
          kind: "corrugated",
          bayPitchMetres: 2.2,
          groupWidthMetres: 1.1,
          groupHeightMetres: 2,
          panes: 1,
          groundExceptionalBandHeightMetres: 4,
          corrugationPitchMetres: 0.4,
          corrugationColor: "#909895",
          edges: {
            "4": {
              kind: "industrial-office",
              levels: 2,
              firstSillMetres: 5,
              floorPitchMetres: 3,
              doors: [
                {
                  kind: "loading",
                  pitchMetres: 7,
                  widthMetres: 5,
                  heightMetres: 3.7
                }
              ]
            },
            "5": {
              kind: "industrial-office",
              levels: 2,
              firstSillMetres: 5,
              floorPitchMetres: 3,
              doors: [
                {
                  kind: "loading",
                  pitchMetres: 7,
                  widthMetres: 5,
                  heightMetres: 3.7
                }
              ]
            }
          }
        },
        official3D: {
          summaryPath: "experiments/3dbag-screen/0363100012242125/geometry-summary.json",
          groundNAP: 1.3380000591278076,
          rectangleFill: 0.971,
          courtyardArea: 0,
          dominantRoofPlaneCount: 1
        },
        generationMilliseconds: 43,
        reviewState: "Reviewed standard exterior; documented source dates and unseen-side approximations apply.",
        sourceUrls: [
          "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012242125",
          "https://data.amsterdam.nl/data/geozoek?center=52.394305,4.788693&lagen=pano-pano2025bi"
        ],
        sourceCommit: "9ed72ffa39b0107d1a60c6efea88f7169b87c591"
      },
      {
        id: "ordinary-0363100012074248",
        buildingId: "NL.IMBAG.Pand.0363100012074248",
        name: "Dark brick commercial block",
        anchor: [
          4.939452,
          52.397391999999996
        ],
        cameraBearing: 213.35269921891947,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.939442,
                52.397051
              ],
              [
                4.939816,
                52.397401
              ],
              [
                4.939803,
                52.397406
              ],
              [
                4.939872,
                52.397471
              ],
              [
                4.939879,
                52.397468
              ],
              [
                4.940003,
                52.397583
              ],
              [
                4.93963,
                52.397733
              ],
              [
                4.939435,
                52.397551
              ],
              [
                4.939274,
                52.397615
              ],
              [
                4.938901,
                52.397268
              ],
              [
                4.939442,
                52.397051
              ]
            ]
          ]
        },
        height: 9.221973419189453,
        modelUrl: "./models/ordinary-buildings/0363100012074248.glb",
        bounds: {
          min: [
            -37.9761848449707,
            0,
            -37.97515106201172
          ],
          max: [
            37.441917419433594,
            9.221973419189453,
            38.79574203491211
          ]
        },
        triangles: 680,
        bytes: 102140,
        materials: 3,
        hash: "6f1caa9ba460aac28ecec052231f4fdb6f22e8d4e6116e4429505b1be8be161f",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012074248/reference-0363100012074248-2025-0.jpg"
        ],
        sourcePack: "experiments/ordinary-ten/east/0363100012074248",
        traits: [
          "Low dark-brick commercial block with flat pale-edged roof.",
          "Upper facade long horizontally grouped glazing beneath slim eave; small square windows on plainer wall runs.",
          "A pale opaque projecting balcony/canopy band lies in front of upper glazing on reviewed street face.",
          "Ground face mostly dark opaque wall/service entries; do not fill with evenly repeated housing windows.",
          "2025 aerial confirms filled native roof plan and surface setback/equipment zones, open parking exterior."
        ],
        simplifications: [
          "Minor roof/equipment patches below0.8% footprint area omitted; main fitted roof planes retained."
        ],
        sourceTiming: {
          startedAt: "2026-10-06T19:22:00Z",
          finishedAt: "2026-10-06T19:30:51.694861+00:00"
        },
        heightEvidence: "Official fitted roof plane vertices minus b3_h_maaiveld; dominant regions clipped to native footprint, eaves and local roof slopes retained. Equipment planes below0.8% footprint area omitted.",
        facadeRecipe: {
          kind: "sparse",
          levels: 2,
          bayPitchMetres: 4,
          groupWidthMetres: 3.1,
          groupHeightMetres: 1.6,
          panes: 3,
          floorPitchMetres: 4.3,
          groundExceptionalBandHeightMetres: 3.2,
          sillHeightMetres: 0.65,
          edges: {
            "9": {
              kind: "commercial-upper",
              canopy: {
                bottomMetres: 4.425,
                heightMetres: 0.75,
                depthMetres: 1
              },
              firstSillMetres: 1,
              floorPitchMetres: 4.2,
              groupHeightMetres: 2.25
            }
          }
        },
        official3D: {
          summaryPath: "experiments/3dbag-screen/0363100012074248/geometry-summary.json",
          groundNAP: -3.609999895095825,
          rectangleFill: 0.891,
          courtyardArea: 0,
          dominantRoofPlaneCount: 2
        },
        generationMilliseconds: 11,
        reviewState: "Reviewed standard exterior; documented source dates and unseen-side approximations apply.",
        sourceUrls: [
          "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012074248",
          "https://data.amsterdam.nl/data/geozoek?center=52.397391999999996,4.939452&lagen=pano-pano2025bi"
        ],
        sourceCommit: "9ed72ffa39b0107d1a60c6efea88f7169b87c591"
      },
      {
        id: "ordinary-0363100012223044",
        buildingId: "NL.IMBAG.Pand.0363100012223044",
        name: "Gray factory hall with high narrow glazing",
        anchor: [
          4.939824,
          52.385817
        ],
        cameraBearing: 17.370603278811984,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.939613,
                52.386128
              ],
              [
                4.939395,
                52.385605
              ],
              [
                4.940036,
                52.385506
              ],
              [
                4.940253,
                52.386028
              ],
              [
                4.939613,
                52.386128
              ]
            ]
          ]
        },
        height: 8.899999618530273,
        modelUrl: "./models/ordinary-buildings/0363100012223044.glb",
        bounds: {
          min: [
            -29.16507339477539,
            0,
            -34.63795852661133
          ],
          max: [
            29.165075302124023,
            8.899999618530273,
            34.637969970703125
          ]
        },
        triangles: 430,
        bytes: 75480,
        materials: 2,
        hash: "ca5ce520e24899890c7df78111cc171b9216da6cffae19a42ab6706a49ca297a",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012223044/reference-0363100012223044-2017-0.jpg",
          "./ordinary-buildings-data/references/0363100012223044/reference-0363100012223044-2017-1.jpg",
          "./ordinary-buildings-data/references/0363100012223044/reference-0363100012223044-2017-2.jpg",
          "./ordinary-buildings-data/references/0363100012223044/reference-0363100012223044-2017-3.jpg"
        ],
        sourcePack: "experiments/ordinary-ten/boxes/0363100012223044",
        traits: [
          "2017 clear north canal facade photos show gray metal cladding, repeated high narrow slit windows, muted blue loading doors and light vertical piers.",
          "North face has sparse blue loading doors about3.5\xD74m plus a wider vertical glazed loading or stair assembly. The neighboring red brick wall and continuous roof glazing are outside this footprint.",
          "2025 aerial and2023 AHN3DBAG support a solid rectangular hall with8\u20139m roof. A fresh230m panorama search found2021 context but no clear newer target facade. Preserve the2017 facade currentness gap and conditional acceptance.",
          "Broad upper glazing and pale piers above two loading gates; regular shallow roof panel rhythm from2025 aerial."
        ],
        simplifications: [
          "Only observed primary facades support pattern placement; other faces use neutral industrial material.",
          "Door counts and dimensions are approximate visual estimates, not surveys.",
          "Omit minor branding; do not invent building-name text.",
          "Minor roof/equipment patches below0.8% footprint area omitted; main fitted roof planes retained.",
          "Regular6\xD77 shallow roof panel grid approximates observed aerial rhythm; fitted patch noise omitted. Glazing/pier proportions are visual estimates from2017 facade."
        ],
        sourceTiming: null,
        heightEvidence: "Source aerial and official dominant8.683m plane support8.7m hall; original regular shallow roof panel relief approximated at0.2m. Noisy fitted patch boundaries rejected after visual review.",
        facadeRecipe: {
          kind: "corrugated",
          levels: 1,
          corrugationPitchMetres: 0.3,
          corrugationColor: "#909b96",
          plinthHeightMetres: 0.6,
          edges: {
            "3": {
              doors: [
                {
                  kind: "loading",
                  xMetres: 13.211983350666854,
                  widthMetres: 3.5,
                  heightMetres: 4,
                  color: "#394f62"
                },
                {
                  kind: "loading",
                  xMetres: 28.173966701333708,
                  widthMetres: 3.5,
                  heightMetres: 4,
                  color: "#394f62"
                }
              ],
              kind: "corrugated",
              levels: 1,
              firstSillMetres: 7.583,
              groupWidthMetres: 0.65,
              groupHeightMetres: 0.55,
              groundGroupHeightMetres: 0.55,
              bayPitchMetres: 5,
              panes: 1,
              sparseWindows: [
                {
                  xMetres: 1,
                  sillMetres: 7.8,
                  widthMetres: 42.5,
                  heightMetres: 0.55,
                  panes: 18
                }
              ],
              glazedAssemblies: [
                {
                  xMetres: 12.7119833507,
                  sillMetres: 4.15,
                  widthMetres: 4.5,
                  heightMetres: 4.1,
                  panes: 2,
                  crossbarMetres: 6.2,
                  pierWidthMetres: 0.3
                },
                {
                  xMetres: 27.6739667013,
                  sillMetres: 4.15,
                  widthMetres: 4.5,
                  heightMetres: 4.1,
                  panes: 2,
                  crossbarMetres: 6.2,
                  pierWidthMetres: 0.3
                }
              ]
            }
          }
        },
        official3D: {
          summaryPath: "experiments/ordinary-ten/boxes/0363100012223044/3dbag-geometry-summary.json",
          rectangleFill: 1,
          courtyardArea: 0,
          groundNAP: 0.949999988079071,
          dominantRoofHeightMetres: 8.683,
          dominantRoofPlaneCount: 26
        },
        generationMilliseconds: 23,
        reviewState: "Reviewed standard exterior, conditional on2017 facade reference; newer clear facade still needed.",
        sourceUrls: [
          "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012223044",
          "https://data.amsterdam.nl/data/geozoek?center=52.385817,4.939824&lagen=pano-pano2025bi"
        ],
        sourceCommit: "9ed72ffa39b0107d1a60c6efea88f7169b87c591"
      },
      {
        id: "ordinary-0363100012123231",
        buildingId: "NL.IMBAG.Pand.0363100012123231",
        name: "Dark ribbed hall with red loading doors",
        anchor: [
          4.813311000000001,
          52.400291499999994
        ],
        cameraBearing: 193.8162032703822,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.812852,
                52.399752
              ],
              [
                4.81377,
                52.399753
              ],
              [
                4.81377,
                52.400831
              ],
              [
                4.812852,
                52.40083
              ],
              [
                4.812852,
                52.399752
              ]
            ]
          ]
        },
        height: 9.832123756408691,
        modelUrl: "./models/ordinary-buildings/0363100012123231.glb",
        bounds: {
          min: [
            -31.19369888305664,
            0,
            -60.075138092041016
          ],
          max: [
            31.19369888305664,
            9.832123756408691,
            60.075138092041016
          ]
        },
        triangles: 1385,
        bytes: 157384,
        materials: 2,
        hash: "e36863c9adc373d0f8d305b012eb530035d55db563ebb6575651fc2de903e228",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012123231/reference-0363100012123231-2025-0.jpg",
          "./ordinary-buildings-data/references/0363100012123231/reference-0363100012123231-2025-1.jpg"
        ],
        sourcePack: "experiments/ordinary-ten/boxes/0363100012123231",
        traits: [
          "2025 south front views show charcoal green gray corrugated metal, a flat roof edge and low gray plinth.",
          "Large muted red sectional loading doors about3.5\xD74m; occasional blue or dark personnel door. The portable blue cabin lies outside the installed footprint.",
          "A truck obscures the second view. Visible wall is mostly blank metal. Preserve shallow fitted roof elevations9.21\u20139.53m and avoid an invented office grid."
        ],
        simplifications: [
          "Only observed primary facades support pattern placement; other faces use neutral industrial material.",
          "Door counts and dimensions are approximate visual estimates, not surveys.",
          "Omit minor branding; do not invent building-name text.",
          "Minor roof/equipment patches below0.8% footprint area omitted; main fitted roof planes retained."
        ],
        sourceTiming: null,
        heightEvidence: "Official fitted roof plane vertices minus b3_h_maaiveld; dominant regions clipped to native footprint, eaves and local roof slopes retained. Equipment planes below0.8% footprint area omitted.",
        facadeRecipe: {
          kind: "corrugated",
          levels: 1,
          corrugationPitchMetres: 0.22,
          corrugationColor: "#65706f",
          plinthHeightMetres: 0.6,
          edges: {
            "0": {
              doors: [
                {
                  kind: "loading",
                  xMetres: 19.03383186809997,
                  widthMetres: 3.5,
                  heightMetres: 4,
                  color: "#865753"
                },
                {
                  kind: "loading",
                  xMetres: 39.81766373619994,
                  widthMetres: 3.5,
                  heightMetres: 4,
                  color: "#865753"
                }
              ]
            }
          }
        },
        official3D: {
          summaryPath: "experiments/ordinary-ten/boxes/0363100012123231/3dbag-geometry-summary.json",
          rectangleFill: 0.999,
          courtyardArea: 0,
          groundNAP: 1.2059999704360962,
          dominantRoofHeightMetres: 9.411,
          dominantRoofPlaneCount: 2
        },
        generationMilliseconds: 22,
        reviewState: "Reviewed standard exterior; documented source dates and unseen-side approximations apply.",
        sourceUrls: [
          "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012123231",
          "https://data.amsterdam.nl/data/geozoek?center=52.400291499999994,4.813311000000001&lagen=pano-pano2025bi"
        ],
        sourceCommit: "9ed72ffa39b0107d1a60c6efea88f7169b87c591"
      },
      {
        id: "ordinary-0363100012183449",
        buildingId: "NL.IMBAG.Pand.0363100012183449",
        name: "Charcoal port warehouse behind containers",
        anchor: [
          4.814140999999999,
          52.4036035
        ],
        cameraBearing: 221.6056697938902,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.813468,
                52.40312
              ],
              [
                4.815148,
                52.403446
              ],
              [
                4.814816,
                52.404087
              ],
              [
                4.813134,
                52.403762
              ],
              [
                4.813468,
                52.40312
              ]
            ]
          ]
        },
        height: 11.610169410705566,
        modelUrl: "./models/ordinary-buildings/0363100012183449.glb",
        bounds: {
          min: [
            -68.40837860107422,
            0,
            -53.84038162231445
          ],
          max: [
            68.40838623046875,
            11.610169410705566,
            53.84037399291992
          ]
        },
        triangles: 1496,
        bytes: 177004,
        materials: 2,
        hash: "c3d3d9cac6fca3814408add09a2a3c769563b700e92373d7a5094bad4c206ed9",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012183449/reference-0363100012183449-2022-0.jpg",
          "./ordinary-buildings-data/references/0363100012183449/reference-0363100012183449-2022-1.jpg",
          "./ordinary-buildings-data/references/0363100012183449/reference-0363100012183449-2022-2.jpg",
          "./ordinary-buildings-data/references/0363100012183449/reference-0363100012183449-2022-3.jpg"
        ],
        sourcePack: "experiments/ordinary-ten/boxes/0363100012183449",
        traits: [
          "2022 southwest context shows a simple charcoal corrugated metal rectangle with a straight roof edge.",
          "Containers obscure ground frontage; one tall loading opening is visible near the western end. Keep containers, scaffold and cranes outside the building mass.",
          "Use sparse loading doors only on observed south and west faces. Record the2022 image gap; fitted2023 AHN roof supports an11.2\u201311.46m hall."
        ],
        simplifications: [
          "Only observed primary facades support pattern placement; other faces use neutral industrial material.",
          "Door counts and dimensions are approximate visual estimates, not surveys.",
          "Omit minor branding; do not invent building-name text.",
          "Minor roof/equipment patches below0.8% footprint area omitted; main fitted roof planes retained."
        ],
        sourceTiming: null,
        heightEvidence: "Official fitted roof plane vertices minus b3_h_maaiveld; dominant regions clipped to native footprint, eaves and local roof slopes retained. Equipment planes below0.8% footprint area omitted.",
        facadeRecipe: {
          kind: "corrugated",
          levels: 1,
          corrugationPitchMetres: 0.22,
          corrugationColor: "#65706f",
          plinthHeightMetres: 0.6,
          edges: {
            "0": {
              doors: [
                {
                  kind: "loading",
                  xMetres: 57.36541125852885,
                  widthMetres: 5,
                  heightMetres: 5,
                  color: "#313534"
                }
              ]
            },
            "3": {
              doors: [
                {
                  kind: "loading",
                  xMetres: 34.99051031384674,
                  widthMetres: 5,
                  heightMetres: 5,
                  color: "#313534"
                }
              ]
            }
          }
        },
        official3D: {
          summaryPath: "experiments/ordinary-ten/boxes/0363100012183449/3dbag-geometry-summary.json",
          rectangleFill: 0.999,
          courtyardArea: 0,
          groundNAP: 0.8410000205039978,
          dominantRoofHeightMetres: 11.369,
          dominantRoofPlaneCount: 2
        },
        generationMilliseconds: 27,
        reviewState: "Reviewed standard exterior; documented source dates and unseen-side approximations apply.",
        sourceUrls: [
          "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012183449",
          "https://data.amsterdam.nl/data/geozoek?center=52.4036035,4.814140999999999&lagen=pano-pano2025bi"
        ],
        sourceCommit: "9ed72ffa39b0107d1a60c6efea88f7169b87c591"
      },
      {
        id: "ordinary-0363100012191215",
        buildingId: "NL.IMBAG.Pand.0363100012191215",
        name: "Pale gray warehouse beyond canal scrub",
        anchor: [
          4.78618,
          52.401129999999995
        ],
        cameraBearing: 353.5377022200746,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.785516,
                52.400858
              ],
              [
                4.786846,
                52.400859
              ],
              [
                4.786844,
                52.401402
              ],
              [
                4.785514,
                52.4014
              ],
              [
                4.785516,
                52.400858
              ]
            ]
          ]
        },
        height: 14.428999900817871,
        modelUrl: "./models/ordinary-buildings/0363100012191215.glb",
        bounds: {
          min: [
            -45.25246810913086,
            0,
            -30.297039031982422
          ],
          max: [
            45.25246810913086,
            14.428999900817871,
            30.297040939331055
          ]
        },
        triangles: 1637,
        bytes: 202324,
        materials: 2,
        hash: "1e3053f0ca6946e57d69cc3b2f997f7d247de319e43238e7925162e79e80e632",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012191215/reference-0363100012191215-2020-0.jpg",
          "./ordinary-buildings-data/references/0363100012191215/reference-0363100012191215-2020-1.jpg",
          "./ordinary-buildings-data/references/0363100012191215/reference-0363100012191215-2020-2.jpg",
          "./ordinary-buildings-data/references/0363100012191215/reference-0363100012191215-2020-3.jpg"
        ],
        sourcePack: "experiments/ordinary-ten/boxes/0363100012191215",
        traits: [
          "2020 north canal context shows light gray vertical metal panels, dark vertical seams and a muted purple gray top band.",
          "Scrub obscures lower frontage. There is no supported door or window count; maintain blank industrial walls.",
          "The lower structure at the right lies outside the exact footprint and remains separate. Main fitted roof is13.6\u201313.86m, with small14.3m roof patches."
        ],
        simplifications: [
          "Only observed primary facades support pattern placement; other faces use neutral industrial material.",
          "Door counts and dimensions are approximate visual estimates, not surveys.",
          "Omit minor branding; do not invent building-name text.",
          "Minor roof/equipment patches below0.8% footprint area omitted; main fitted roof planes retained.",
          "Upper muted purple-gray band contrast and width approximate; scrub-obscured lower facade remains conservative."
        ],
        sourceTiming: null,
        heightEvidence: "Official fitted roof plane vertices minus b3_h_maaiveld; dominant regions clipped to native footprint, eaves and local roof slopes retained. Equipment planes below0.8% footprint area omitted.",
        facadeRecipe: {
          kind: "corrugated",
          levels: 1,
          corrugationPitchMetres: 0.25,
          corrugationColor: "#909b96",
          plinthHeightMetres: 0.6,
          edges: {
            "2": {
              doors: [],
              topBandColor: "#75717d",
              topBandHeightMetres: 1.3,
              panelSeamPitchMetres: 12
            }
          },
          topBandHeightMetres: 1.2,
          topBandColor: "#827d8b"
        },
        official3D: {
          summaryPath: "experiments/ordinary-ten/boxes/0363100012191215/3dbag-geometry-summary.json",
          rectangleFill: 1,
          courtyardArea: 0,
          groundNAP: 1.371000051498413,
          dominantRoofHeightMetres: 13.854,
          dominantRoofPlaneCount: 6
        },
        generationMilliseconds: 22,
        reviewState: "Reviewed standard exterior; documented source dates and unseen-side approximations apply.",
        sourceUrls: [
          "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012191215",
          "https://data.amsterdam.nl/data/geozoek?center=52.401129999999995,4.78618&lagen=pano-pano2025bi"
        ],
        sourceCommit: "9ed72ffa39b0107d1a60c6efea88f7169b87c591"
      },
      {
        id: "ordinary-0363100012224669",
        buildingId: "NL.IMBAG.Pand.0363100012224669",
        name: "Dark metal warehouse with red delivery portals",
        anchor: [
          4.7617615,
          52.4123705
        ],
        cameraBearing: 341.4372824937231,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.762121,
                52.412883
              ],
              [
                4.760986,
                52.412663
              ],
              [
                4.761403,
                52.411858
              ],
              [
                4.762537,
                52.412078
              ],
              [
                4.762121,
                52.412883
              ]
            ]
          ]
        },
        height: 10.386124610900879,
        modelUrl: "./models/ordinary-buildings/0363100012224669.glb",
        bounds: {
          min: [
            -52.675411224365234,
            0,
            -57.06865310668945
          ],
          max: [
            52.675411224365234,
            10.386124610900879,
            57.06865310668945
          ]
        },
        triangles: 1509,
        bytes: 201488,
        materials: 2,
        hash: "a934d602de2914253e25c769fc6a0665a80e541e1f71211e5daaffbe856f7796",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012224669/reference-0363100012224669-2025-0.jpg",
          "./ordinary-buildings-data/references/0363100012224669/reference-0363100012224669-2025-1.jpg",
          "./ordinary-buildings-data/references/0363100012224669/reference-0363100012224669-2025-2.jpg"
        ],
        sourcePack: "experiments/ordinary-ten/boxes/0363100012224669",
        traits: [
          "2025 north panoramas show a dark charcoal metal hall with broad vertical panel joints and a low gray concrete plinth.",
          "North front has muted red loading doors about4\xD74.5m and adjacent small pale personnel doors. Minor logos and tenant words may be omitted.",
          "The low glazed neighboring structure and containers sit outside the exact rectangle. Fitted roof planes lie at9.95\u201310.15m; this is a shallow roof variation."
        ],
        simplifications: [
          "Only observed primary facades support pattern placement; other faces use neutral industrial material.",
          "Door counts and dimensions are approximate visual estimates, not surveys.",
          "Omit minor branding; do not invent building-name text.",
          "Minor roof/equipment patches below0.8% footprint area omitted; main fitted roof planes retained."
        ],
        sourceTiming: null,
        heightEvidence: "Official fitted roof plane vertices minus b3_h_maaiveld; dominant regions clipped to native footprint, eaves and local roof slopes retained. Equipment planes below0.8% footprint area omitted.",
        facadeRecipe: {
          kind: "corrugated",
          levels: 1,
          corrugationPitchMetres: 0.2,
          corrugationColor: "#65706f",
          plinthHeightMetres: 0.6,
          edges: {
            "0": {
              doors: [
                {
                  kind: "loading",
                  xMetres: 18.21668590646236,
                  widthMetres: 4,
                  heightMetres: 4.5,
                  color: "#8a4b50"
                },
                {
                  kind: "loading",
                  xMetres: 38.43337181292472,
                  widthMetres: 4,
                  heightMetres: 4.5,
                  color: "#8a4b50"
                },
                {
                  kind: "loading",
                  xMetres: 58.65005771938708,
                  widthMetres: 4,
                  heightMetres: 4.5,
                  color: "#8a4b50"
                },
                {
                  xMetres: 9.434453423015766,
                  widthMetres: 1,
                  heightMetres: 2.1,
                  color: "#b0b7b0"
                },
                {
                  xMetres: 36.390034631632254,
                  widthMetres: 1,
                  heightMetres: 2.1,
                  color: "#b0b7b0"
                }
              ],
              panelSeamPitchMetres: 4.5
            }
          }
        },
        official3D: {
          summaryPath: "experiments/ordinary-ten/boxes/0363100012224669/3dbag-geometry-summary.json",
          rectangleFill: 0.999,
          courtyardArea: 0,
          groundNAP: 1.0770000219345093,
          dominantRoofHeightMetres: 10.071,
          dominantRoofPlaneCount: 2
        },
        generationMilliseconds: 26,
        reviewState: "Reviewed standard exterior; documented source dates and unseen-side approximations apply.",
        sourceUrls: [
          "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012224669",
          "https://data.amsterdam.nl/data/geozoek?center=52.4123705,4.7617615&lagen=pano-pano2025bi"
        ],
        sourceCommit: "9ed72ffa39b0107d1a60c6efea88f7169b87c591"
      },
      {
        id: "ordinary-0363100012067126",
        buildingId: "NL.IMBAG.Pand.0363100012067126",
        name: "Pale corrugated shed with faded coral stripes",
        anchor: [
          4.7641575,
          52.410713
        ],
        cameraBearing: 161.98867550171224,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.763517,
                52.41106
              ],
              [
                4.76396,
                52.410204
              ],
              [
                4.764798,
                52.410366
              ],
              [
                4.764356,
                52.411222
              ],
              [
                4.763517,
                52.41106
              ]
            ]
          ]
        },
        height: 16.322999954223633,
        modelUrl: "./models/ordinary-buildings/0363100012067126.glb",
        bounds: {
          min: [
            -43.510231018066406,
            0,
            -56.679039001464844
          ],
          max: [
            43.51023483276367,
            16.322999954223633,
            56.679039001464844
          ]
        },
        triangles: 1058,
        bytes: 146696,
        materials: 2,
        hash: "c723bd505e06960dd1bb292222f9675168251e6667f6f0a046284cb0dc551ec2",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012067126/reference-0363100012067126-2025-0.jpg",
          "./ordinary-buildings-data/references/0363100012067126/reference-0363100012067126-2025-1.jpg",
          "./ordinary-buildings-data/references/0363100012067126/reference-0363100012067126-2025-2.jpg"
        ],
        sourcePack: "experiments/ordinary-ten/boxes/0363100012067126",
        traits: [
          "2025 south views confirm a pale gray green corrugated metal hall with a flat edge and no domestic glazing grid.",
          "Observed south face has three broad faded salmon vertical stripes, about1.5m wide, and two dark personnel doors about1\xD72.1m.",
          "Low gray aggregate plinth about0.6m high. Use restrained metal material on unseen faces; do not extrapolate decorative stripes."
        ],
        simplifications: [
          "Only observed primary facades support pattern placement; other faces use neutral industrial material.",
          "Door counts and dimensions are approximate visual estimates, not surveys.",
          "Omit minor branding; do not invent building-name text.",
          "Native rectangular gable preserves two fitted12.5degree roofplanes; tiny perimeter survey irregularities omitted.",
          "Minor roof/equipment patches below0.8% footprint area omitted; main fitted roof planes retained."
        ],
        heightEvidence: "Official fitted roof plane vertices minus b3_h_maaiveld; dominant regions clipped to native footprint, eaves and local roof slopes retained. Equipment planes below0.8% footprint area omitted.",
        facadeRecipe: {
          kind: "corrugated",
          levels: 1,
          corrugationPitchMetres: 0.2,
          corrugationColor: "#909b98",
          plinthHeightMetres: 0.6,
          edges: {
            "1": {
              stripes: [
                {
                  fraction: 0.2,
                  widthMetres: 1.5,
                  color: "#bb9090"
                },
                {
                  fraction: 0.5,
                  widthMetres: 1.5,
                  color: "#bb9090"
                },
                {
                  fraction: 0.8,
                  widthMetres: 1.5,
                  color: "#bb9090"
                }
              ],
              doors: [
                {
                  xMetres: 16.71418564826386,
                  widthMetres: 1,
                  heightMetres: 2.1
                },
                {
                  xMetres: 38.800788112041104,
                  widthMetres: 1,
                  heightMetres: 2.1
                }
              ]
            }
          }
        },
        official3D: {
          summaryPath: "experiments/ordinary-ten/boxes/0363100012067126/3dbag-geometry-summary.json",
          rectangleFill: 1,
          courtyardArea: 0,
          groundNAP: 1.11899995803833,
          dominantRoofPlaneCount: 2
        },
        generationMilliseconds: 26,
        reviewState: "Reviewed standard exterior; documented source dates and unseen-side approximations apply.",
        sourceUrls: [
          "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012067126",
          "https://data.amsterdam.nl/data/geozoek?center=52.410713,4.7641575&lagen=pano-pano2025bi"
        ],
        sourceCommit: "9ed72ffa39b0107d1a60c6efea88f7169b87c591"
      },
      {
        id: "ordinary-0363100012159282",
        buildingId: "NL.IMBAG.Pand.0363100012159282",
        name: "White metal industrial box with concrete lower wall",
        anchor: [
          4.7512865,
          52.405080999999996
        ],
        cameraBearing: 282.8297665422222,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.751975,
                52.405421
              ],
              [
                4.750883,
                52.405563
              ],
              [
                4.750612,
                52.404781
              ],
              [
                4.750605,
                52.404782
              ],
              [
                4.750604,
                52.404779
              ],
              [
                4.750611,
                52.404778
              ],
              [
                4.750598,
                52.404741
              ],
              [
                4.751691,
                52.404599
              ],
              [
                4.751704,
                52.404636
              ],
              [
                4.751711,
                52.404635
              ],
              [
                4.751712,
                52.404639
              ],
              [
                4.751705,
                52.40464
              ],
              [
                4.751975,
                52.405421
              ]
            ]
          ]
        },
        height: 13.608752250671387,
        modelUrl: "./models/ordinary-buildings/0363100012159282.glb",
        bounds: {
          min: [
            -46.77606964111328,
            0,
            -53.67384338378906
          ],
          max: [
            46.776084899902344,
            13.608752250671387,
            53.67384338378906
          ]
        },
        triangles: 1182,
        bytes: 197156,
        materials: 2,
        hash: "a39a8ad7058df126df507f97a767bb5b6561788be9877e15215f637e2df5c1be",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012159282/reference-0363100012159282-2025-0.jpg",
          "./ordinary-buildings-data/references/0363100012159282/reference-0363100012159282-2025-1.jpg",
          "./ordinary-buildings-data/references/0363100012159282/reference-0363100012159282-2025-2.jpg"
        ],
        sourcePack: "experiments/ordinary-ten/boxes/0363100012159282",
        traits: [
          "Clear2025 west views show the exact2159282 white corrugated metal box with a gray concrete lower wall about3m high.",
          "Main wall is mostly blank white metal with horizontal panel joints and stronger vertical bay seams around4.5\u20135m apart. Sparse dark personnel doors about1\xD72.1m sit in the lower concrete strip.",
          "No supported window grid or tall loading doors on photographed west face; preserve neighboring sister sheds separately."
        ],
        simplifications: [
          "Unseen faces use restrained same industrial material, without invented doors or glazing.",
          "Door count and panel spacing are visual estimates.",
          "Minor roof/equipment patches below0.8% footprint area omitted; main fitted roof planes retained."
        ],
        sourceTiming: null,
        heightEvidence: "Official fitted roof plane vertices minus b3_h_maaiveld; dominant regions clipped to native footprint, eaves and local roof slopes retained. Equipment planes below0.8% footprint area omitted.",
        facadeRecipe: {
          kind: "corrugated",
          levels: 1,
          corrugationPitchMetres: 0.25,
          corrugationColor: "#c4ccc8",
          plinthHeightMetres: 3,
          plinthColor: "#a1a9a5",
          horizontalJointPitchMetres: 1.2,
          edges: {
            "1": {
              doors: [
                {
                  xMetres: 10.380593692053823,
                  widthMetres: 1,
                  heightMetres: 2.1,
                  color: "#3d4544"
                },
                {
                  xMetres: 40.03943281220761,
                  widthMetres: 1,
                  heightMetres: 2.1,
                  color: "#3d4544"
                }
              ],
              panelSeamPitchMetres: 4.5
            },
            "2": {
              panelSeamPitchMetres: 4.5
            },
            "3": {
              panelSeamPitchMetres: 4.5
            },
            "4": {
              panelSeamPitchMetres: 4.5
            },
            "5": {
              panelSeamPitchMetres: 4.5
            }
          }
        },
        official3D: {
          summaryPath: "experiments/ordinary-ten/boxes/0363100012159282/3dbag-geometry-summary.json",
          rectangleFill: 0.987,
          courtyardArea: 0,
          groundNAP: 0.4050000011920929,
          dominantRoofHeightMetres: 12.963,
          dominantRoofPlaneCount: 2
        },
        generationMilliseconds: 24,
        reviewState: "Reviewed standard exterior; documented source dates and unseen-side approximations apply.",
        sourceUrls: [
          "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012159282",
          "https://data.amsterdam.nl/data/geozoek?center=52.405080999999996,4.7512865&lagen=pano-pano2025bi"
        ],
        sourceCommit: "9ed72ffa39b0107d1a60c6efea88f7169b87c591"
      },
      {
        id: "ordinary-0363100012238052",
        buildingId: "NL.IMBAG.Pand.0363100012238052",
        name: "Tall charcoal ribbed industrial box with low southwest strip",
        anchor: [
          4.937098000000001,
          52.3134115
        ],
        cameraBearing: 145.9215859028709,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.938083,
                52.313292
              ],
              [
                4.938083,
                52.313292
              ],
              [
                4.938058,
                52.31332
              ],
              [
                4.938071,
                52.313349
              ],
              [
                4.938119,
                52.313365
              ],
              [
                4.938092,
                52.313395
              ],
              [
                4.938106,
                52.313423
              ],
              [
                4.938151,
                52.313439
              ],
              [
                4.938151,
                52.313439
              ],
              [
                4.937673,
                52.313964
              ],
              [
                4.937673,
                52.313964
              ],
              [
                4.937627,
                52.313948
              ],
              [
                4.937581,
                52.313956
              ],
              [
                4.937554,
                52.313985
              ],
              [
                4.937507,
                52.31397
              ],
              [
                4.93746,
                52.313977
              ],
              [
                4.937434,
                52.314005
              ],
              [
                4.937433,
                52.314005
              ],
              [
                4.936116,
                52.313555
              ],
              [
                4.936116,
                52.313554
              ],
              [
                4.936118,
                52.313552
              ],
              [
                4.936045,
                52.313527
              ],
              [
                4.936691,
                52.312818
              ],
              [
                4.936764,
                52.312843
              ],
              [
                4.936766,
                52.312841
              ],
              [
                4.936767,
                52.312841
              ],
              [
                4.938083,
                52.313292
              ]
            ]
          ]
        },
        height: 31.42022705078125,
        modelUrl: "./models/ordinary-buildings/0363100012238052.glb",
        bounds: {
          min: [
            -71.84332275390625,
            0,
            -66.0841293334961
          ],
          max: [
            71.67719268798828,
            31.42022705078125,
            66.08412170410156
          ]
        },
        triangles: 1796,
        bytes: 325680,
        materials: 2,
        hash: "a8ef4d387120b97114b4645522aedf79782bbdacfb7d785c4bcd529d19eb36d8",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012238052/reference-0363100012238052-2025-0.jpg",
          "./ordinary-buildings-data/references/0363100012238052/reference-0363100012238052-2025-1.jpg",
          "./ordinary-buildings-data/references/0363100012238052/reference-0363100012238052-2025-2.jpg",
          "./ordinary-buildings-data/references/0363100012238052/reference-0363100012238052-2025-3.jpg"
        ],
        sourcePack: "experiments/ordinary-ten/tall-boxes/0363100012238052",
        traits: [
          "One tall nearly rectangular volume, about31m high, no office window grid",
          "Dense full-height vertical metal ribs from about5m base to eaves",
          "Ground treatment differs by long side: SE charcoal doors/panels; NW pale concrete panels",
          "Low5m strip separate from tall shell on SW short face",
          "Small roof equipment does not define whole-building height"
        ],
        simplifications: [
          "Four34mroofequipmenthousings omitted; they do not define occupied buildingheight.",
          "Unobserved northeast and lowstripfaces conservatively carry plain darkbase and uppermetalassembly; no inventedglazing.",
          "Source mainandlowstriproofplanes retained via nativeplanintersections.",
          "Minor roof/equipment patches below0.8% footprint area omitted; main fitted roof planes retained."
        ],
        sourceTiming: {
          checkedAt: "2026-10-06T19:54:30.522Z"
        },
        heightEvidence: "Official fitted roof plane vertices minus b3_h_maaiveld; dominant regions clipped to native footprint, eaves and local roof slopes retained. Equipment planes below0.8% footprint area omitted.",
        facadeRecipe: {
          kind: "corrugated",
          levels: 1,
          corrugationPitchMetres: 0.25,
          corrugationColor: "#252c2f",
          plinthHeightMetres: 5.4,
          plinthColor: "#55575a",
          edges: {
            "8": {},
            "17": {
              plinthColor: "#c7ccc9",
              panelSeamPitchMetres: 3.2,
              panelSeamColor: "#8b9491",
              baseVents: {
                pitchMetres: 3.2,
                sillMetres: 4.4,
                widthMetres: 0.45,
                heightMetres: 0.3
              },
              lintelBand: {
                bottomMetres: 5,
                heightMetres: 0.4,
                color: "#303839"
              }
            },
            "21": {},
            "25": {
              doors: [
                {
                  xMetres: 10,
                  widthMetres: 2.5,
                  heightMetres: 3.7,
                  color: "#262b2c"
                },
                {
                  xMetres: 45,
                  widthMetres: 2.5,
                  heightMetres: 3.7,
                  color: "#262b2c"
                },
                {
                  xMetres: 75,
                  widthMetres: 2.5,
                  heightMetres: 3.7,
                  color: "#262b2c"
                }
              ]
            }
          }
        },
        official3D: {
          summaryPath: "experiments/ordinary-ten/tall-boxes/0363100012238052/geometry-summary.json",
          groundNAP: -3.1649999618530273,
          annexHeightMetres: 5.27,
          annexFootprintFraction: 0.048,
          rectangleFill: 0.981,
          courtyardArea: 0,
          dominantRoofPlaneCount: 2
        },
        generationMilliseconds: 58,
        reviewState: "Reviewed standard exterior; documented source dates and unseen-side approximations apply.",
        sourceUrls: [
          "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012238052",
          "https://data.amsterdam.nl/data/geozoek?center=52.3134115,4.937098000000001&lagen=pano-pano2025bi"
        ],
        sourceCommit: "9ed72ffa39b0107d1a60c6efea88f7169b87c591"
      },
      {
        id: "ordinary-0363100012177576",
        buildingId: "NL.IMBAG.Pand.0363100012177576",
        name: "Koning David / De David",
        anchor: [
          4.887598499999999,
          52.381433
        ],
        cameraBearing: 222.2,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.887802,
                52.381493
              ],
              [
                4.887678,
                52.381562
              ],
              [
                4.887395,
                52.381373
              ],
              [
                4.887519,
                52.381304
              ],
              [
                4.887802,
                52.381493
              ]
            ]
          ]
        },
        height: 15.688265800476074,
        modelUrl: "./models/ordinary-buildings/0363100012177576.glb",
        bounds: {
          min: [
            -13.949356079101562,
            0,
            -14.373581886291504
          ],
          max: [
            13.84109878540039,
            15.688265800476074,
            14.486138343811035
          ]
        },
        triangles: 1355,
        bytes: 142396,
        materials: 3,
        hash: "c472127efcb726f8cdc88a0900b0841051e9b86bd73e1f6b15b6ed44eff2a2a3",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012177576/reference-0363100012177576-2025-wide.jpg",
          "./ordinary-buildings-data/references/0363100012177576/reference-0363100012177576-2025.jpg",
          "./ordinary-buildings-data/references/0363100012177576/official-roof-plan.png"
        ],
        sourcePack: "experiments/canal-belt-overnight/warehouses-01/0363100012177576",
        traits: [
          "Two broad brick gables and separate crest lines",
          "Three rows of tall glazed loading openings with outward burgundy planked shutters",
          "Cream projecting landing/lintel slabs, thin black Juliet rails",
          "Small paired cream-framed side windows flank each large central loading bay",
          "Lower central roof volumes between tall front/rear blocks retained"
        ],
        simplifications: [
          "Rear openings unobserved: restrained plain brick, no invented grid.",
          "Atlas encodes original window mullions, brick arches and rails; shallow physical shutters/sills/gable caps preserve recognition.",
          "Small source-supported cursive ground name omitted pending exact lettering review."
        ],
        heightEvidence: "Official 2023 fitted survey roof surfaces minus groundNAP; high front/rear and low centre preserved. Front wall silhouette follows roofs; assemblies estimated from 2025 perspective.",
        facadeRecipe: {
          kind: "blank",
          edges: {
            "2": {
              kind: "blank",
              windowTiers: [
                {
                  startMetres: 2.001508525903279,
                  pitchMetres: 5.703017051806558,
                  count: 2,
                  widthMetres: 1.7,
                  sillMetres: 3,
                  heightMetres: 2.45,
                  panes: 2,
                  transomHeightsMetres: [
                    1.65
                  ],
                  shutters: {
                    widthMetres: 0.85,
                    color: "#713e43"
                  }
                },
                {
                  startMetres: 0.28045255777098377,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 3.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 4.272564494035574,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 3.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 5.983469609577541,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 3.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 9.975581545842134,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 3.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 2.001508525903279,
                  pitchMetres: 5.703017051806558,
                  count: 2,
                  widthMetres: 1.7,
                  sillMetres: 6,
                  heightMetres: 2.45,
                  panes: 2,
                  transomHeightsMetres: [
                    1.65
                  ],
                  shutters: {
                    widthMetres: 0.85,
                    color: "#713e43"
                  }
                },
                {
                  startMetres: 0.28045255777098377,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 6.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 4.272564494035574,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 6.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 5.983469609577541,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 6.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 9.975581545842134,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 6.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 2.001508525903279,
                  pitchMetres: 5.703017051806558,
                  count: 2,
                  widthMetres: 1.7,
                  sillMetres: 9,
                  heightMetres: 2.35,
                  panes: 2,
                  transomHeightsMetres: [
                    1.65
                  ],
                  shutters: {
                    widthMetres: 0.85,
                    color: "#713e43"
                  }
                },
                {
                  startMetres: 0.28045255777098377,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 9.5,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 4.272564494035574,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 9.5,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 5.983469609577541,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 9.5,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 9.975581545842134,
                  pitchMetres: 12.406034103613116,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 9.5,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 2.1765085259032793,
                  pitchMetres: 5.703017051806558,
                  count: 2,
                  widthMetres: 1.35,
                  sillMetres: 12.2,
                  heightMetres: 1.75,
                  panes: 2,
                  shutters: {
                    widthMetres: 0.65,
                    color: "#713e43"
                  }
                }
              ],
              frameWidthMetres: 0.11,
              plinthHeightMetres: 0.3,
              plinthColor: "#524d43",
              balconyGroups: [
                {
                  xMetres: 2.001508525903279,
                  bottomMetres: 3,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                },
                {
                  xMetres: 2.001508525903279,
                  bottomMetres: 6,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                },
                {
                  xMetres: 2.001508525903279,
                  bottomMetres: 9,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                },
                {
                  xMetres: 7.704525577709838,
                  bottomMetres: 3,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                },
                {
                  xMetres: 7.704525577709838,
                  bottomMetres: 6,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                },
                {
                  xMetres: 7.704525577709838,
                  bottomMetres: 9,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                }
              ],
              canopyGroups: [
                {
                  xMetres: 1.851508525903279,
                  bottomMetres: 5.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                },
                {
                  xMetres: 1.851508525903279,
                  bottomMetres: 8.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                },
                {
                  xMetres: 1.851508525903279,
                  bottomMetres: 11.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                },
                {
                  xMetres: 7.554525577709837,
                  bottomMetres: 5.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                },
                {
                  xMetres: 7.554525577709837,
                  bottomMetres: 8.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                },
                {
                  xMetres: 7.554525577709837,
                  bottomMetres: 11.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                }
              ],
              shutterGroups: [
                {
                  xMetres: 2.001508525903279,
                  bottomMetres: 3,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.45,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 7.704525577709838,
                  bottomMetres: 3,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.45,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 2.001508525903279,
                  bottomMetres: 6,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.45,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 7.704525577709838,
                  bottomMetres: 6,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.45,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 2.001508525903279,
                  bottomMetres: 9,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.35,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 7.704525577709838,
                  bottomMetres: 9,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.35,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 2.1765085259032793,
                  bottomMetres: 12.2,
                  openingWidthMetres: 1.35,
                  widthMetres: 0.65,
                  heightMetres: 1.75,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 7.879525577709837,
                  bottomMetres: 12.2,
                  openingWidthMetres: 1.35,
                  widthMetres: 0.65,
                  heightMetres: 1.75,
                  openAngleDegrees: 55
                }
              ],
              gableTrim: true,
              groundEntries: [
                {
                  xMetres: 1.7015085259032792,
                  bottomMetres: 0.1,
                  widthMetres: 2.3,
                  heightMetres: 2.5,
                  kind: "glazed",
                  panes: 2,
                  frameWidthMetres: 0.2,
                  transomHeightsMetres: [
                    1.85
                  ]
                },
                {
                  xMetres: 7.604525577709837,
                  bottomMetres: 0.1,
                  widthMetres: 1.9,
                  heightMetres: 2.5,
                  kind: "glazed",
                  panes: 2,
                  frameWidthMetres: 0.2
                },
                {
                  xMetres: 0.3,
                  bottomMetres: 0.1,
                  widthMetres: 1.1,
                  heightMetres: 2.4,
                  kind: "glazed",
                  panes: 1,
                  head: "round",
                  crownRiseMetres: 0.55,
                  frameColor: "#675e50",
                  brickArch: {
                    color: "#8a765e"
                  }
                }
              ],
              bands: [
                {
                  xMetres: 1.551508525903279,
                  bottomMetres: 2.6,
                  widthMetres: 3.7,
                  heightMetres: 0.35,
                  color: "#e6e4cd"
                },
                {
                  xMetres: 7.454525577709838,
                  bottomMetres: 2.6,
                  widthMetres: 3.2,
                  heightMetres: 0.35,
                  color: "#e6e4cd"
                }
              ]
            }
          }
        },
        official3D: {
          summaryPath: "experiments/canal-belt-overnight/warehouses-01/0363100012177576/geometry-summary.json",
          groundNAP: 0.38600000739097595,
          annexHeightMetres: 6.1
        },
        generationMilliseconds: 53,
        reviewState: "Source/gallery and native-game reviewed; unseen rear finish, estimated facade detail and loading-stall limits documented.",
        sourceCommit: "9c29e89655ab177fa1125320ad1a6f0fc0cfc8e6",
        galleryFrontage: {
          target: [
            4.8874569999999995,
            52.3813385
          ],
          distanceMetres: 35
        },
        updatedAt: "2026-10-07T06:38:49.107683+00:00"
      },
      {
        id: "ordinary-0363100012177571",
        buildingId: "NL.IMBAG.Pand.0363100012177571",
        name: "Groene Valk / Grauwe Valk",
        anchor: [
          4.887475,
          52.381502
        ],
        cameraBearing: 222.2,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.887678,
                52.381562
              ],
              [
                4.887554,
                52.381631
              ],
              [
                4.887272,
                52.381443
              ],
              [
                4.887395,
                52.381373
              ],
              [
                4.887678,
                52.381562
              ]
            ]
          ]
        },
        height: 15.676854133605957,
        modelUrl: "./models/ordinary-buildings/0363100012177571.glb",
        bounds: {
          min: [
            -13.91659164428711,
            0,
            -14.373581886291504
          ],
          max: [
            13.80710220336914,
            15.676854133605957,
            14.485940933227539
          ]
        },
        triangles: 1259,
        bytes: 136200,
        materials: 3,
        hash: "027344d234046566e7c955cc55c64a16b9c880170a39bc0442d8f5fa66b6fb3d",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012177571/reference-0363100012177571-2025-wide.jpg",
          "./ordinary-buildings-data/references/0363100012177571/reference-0363100012177571-2025.jpg",
          "./ordinary-buildings-data/references/0363100012177571/official-roof-plan.png"
        ],
        sourcePack: "experiments/canal-belt-overnight/warehouses-01/0363100012177571",
        traits: [
          "Two broad brick gables and separate crest lines",
          "Three rows of tall glazed loading openings with outward burgundy planked shutters",
          "Cream projecting landing/lintel slabs, thin black Juliet rails",
          "Small paired cream-framed side windows flank each large central loading bay",
          "Lower central roof volumes between tall front/rear blocks retained"
        ],
        simplifications: [
          "Rear openings unobserved: restrained plain brick, no invented grid.",
          "Atlas encodes original window mullions, brick arches and rails; shallow physical shutters/sills/gable caps preserve recognition.",
          "Small source-supported cursive ground name omitted pending exact lettering review."
        ],
        heightEvidence: "Official 2023 fitted survey roof surfaces minus groundNAP; high front/rear and low centre preserved. Front wall silhouette follows roofs; assemblies estimated from 2025 perspective.",
        facadeRecipe: {
          kind: "blank",
          edges: {
            "2": {
              kind: "blank",
              windowTiers: [
                {
                  startMetres: 2.0078618947189946,
                  pitchMetres: 5.715723789437989,
                  count: 2,
                  widthMetres: 1.7,
                  sillMetres: 3,
                  heightMetres: 2.45,
                  panes: 2,
                  transomHeightsMetres: [
                    1.65
                  ],
                  shutters: {
                    widthMetres: 0.85,
                    color: "#713e43"
                  }
                },
                {
                  startMetres: 0.2823585684156984,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 3.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 4.283365221022291,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 3.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 5.998082357853687,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 3.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 9.999089010460281,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 3.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 2.0078618947189946,
                  pitchMetres: 5.715723789437989,
                  count: 2,
                  widthMetres: 1.7,
                  sillMetres: 6,
                  heightMetres: 2.45,
                  panes: 2,
                  transomHeightsMetres: [
                    1.65
                  ],
                  shutters: {
                    widthMetres: 0.85,
                    color: "#713e43"
                  }
                },
                {
                  startMetres: 0.2823585684156984,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 6.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 4.283365221022291,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 6.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 5.998082357853687,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 6.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 9.999089010460281,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 6.55,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 2.0078618947189946,
                  pitchMetres: 5.715723789437989,
                  count: 2,
                  widthMetres: 1.7,
                  sillMetres: 9,
                  heightMetres: 2.35,
                  panes: 2,
                  transomHeightsMetres: [
                    1.65
                  ],
                  shutters: {
                    widthMetres: 0.85,
                    color: "#713e43"
                  }
                },
                {
                  startMetres: 0.2823585684156984,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 9.5,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 4.283365221022291,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 9.5,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 5.998082357853687,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 9.5,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 9.999089010460281,
                  pitchMetres: 12.431447578875979,
                  count: 1,
                  widthMetres: 1.15,
                  sillMetres: 9.5,
                  heightMetres: 1.35,
                  panes: 2,
                  transomHeightsMetres: []
                },
                {
                  startMetres: 2.182861894718995,
                  pitchMetres: 5.715723789437989,
                  count: 2,
                  widthMetres: 1.35,
                  sillMetres: 12.2,
                  heightMetres: 1.75,
                  panes: 2,
                  shutters: {
                    widthMetres: 0.65,
                    color: "#713e43"
                  }
                }
              ],
              frameWidthMetres: 0.11,
              plinthHeightMetres: 0.3,
              plinthColor: "#524d43",
              balconyGroups: [
                {
                  xMetres: 2.0078618947189946,
                  bottomMetres: 3,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                },
                {
                  xMetres: 2.0078618947189946,
                  bottomMetres: 6,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                },
                {
                  xMetres: 2.0078618947189946,
                  bottomMetres: 9,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                },
                {
                  xMetres: 7.723585684156985,
                  bottomMetres: 3,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                },
                {
                  xMetres: 7.723585684156985,
                  bottomMetres: 6,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                },
                {
                  xMetres: 7.723585684156985,
                  bottomMetres: 9,
                  widthMetres: 1.7,
                  railHeightMetres: 0.95,
                  railColor: "#272b2a",
                  barPitchMetres: 0.17,
                  barWidthMetres: 0.025,
                  depthMetres: 0.2,
                  slabHeightMetres: 0.18
                }
              ],
              canopyGroups: [
                {
                  xMetres: 1.8578618947189947,
                  bottomMetres: 5.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                },
                {
                  xMetres: 1.8578618947189947,
                  bottomMetres: 8.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                },
                {
                  xMetres: 1.8578618947189947,
                  bottomMetres: 11.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                },
                {
                  xMetres: 7.573585684156985,
                  bottomMetres: 5.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                },
                {
                  xMetres: 7.573585684156985,
                  bottomMetres: 8.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                },
                {
                  xMetres: 7.573585684156985,
                  bottomMetres: 11.45,
                  widthMetres: 2,
                  heightMetres: 0.14,
                  depthMetres: 0.15
                }
              ],
              shutterGroups: [
                {
                  xMetres: 2.0078618947189946,
                  bottomMetres: 3,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.45,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 7.723585684156985,
                  bottomMetres: 3,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.45,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 2.0078618947189946,
                  bottomMetres: 6,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.45,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 7.723585684156985,
                  bottomMetres: 6,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.45,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 2.0078618947189946,
                  bottomMetres: 9,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.35,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 7.723585684156985,
                  bottomMetres: 9,
                  openingWidthMetres: 1.7,
                  widthMetres: 0.85,
                  heightMetres: 2.35,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 2.182861894718995,
                  bottomMetres: 12.2,
                  openingWidthMetres: 1.35,
                  widthMetres: 0.65,
                  heightMetres: 1.75,
                  openAngleDegrees: 55
                },
                {
                  xMetres: 7.898585684156985,
                  bottomMetres: 12.2,
                  openingWidthMetres: 1.35,
                  widthMetres: 0.65,
                  heightMetres: 1.75,
                  openAngleDegrees: 55
                }
              ],
              gableTrim: true,
              groundEntries: [
                {
                  xMetres: 1.8578618947189947,
                  bottomMetres: 0.1,
                  widthMetres: 2,
                  heightMetres: 2.6,
                  kind: "glazed",
                  panes: 2,
                  frameColor: "#4c4b40",
                  head: "round",
                  crownRiseMetres: 1,
                  transomHeightsMetres: [
                    1.7
                  ],
                  brickArch: {
                    color: "#947c5e",
                    bandHeightMetres: 0.22
                  },
                  shutters: {
                    widthMetres: 0.8,
                    color: "#713e43"
                  }
                },
                {
                  xMetres: 7.573585684156985,
                  bottomMetres: 0.1,
                  widthMetres: 2,
                  heightMetres: 2.6,
                  kind: "glazed",
                  panes: 2,
                  frameColor: "#4c4b40",
                  head: "round",
                  crownRiseMetres: 1,
                  transomHeightsMetres: [
                    1.7
                  ],
                  brickArch: {
                    color: "#947c5e",
                    bandHeightMetres: 0.22
                  },
                  shutters: {
                    widthMetres: 0.8,
                    color: "#713e43"
                  }
                }
              ]
            }
          }
        },
        official3D: {
          summaryPath: "experiments/canal-belt-overnight/warehouses-01/0363100012177571/geometry-summary.json",
          groundNAP: 0.39399999380111694,
          annexHeightMetres: 6.1
        },
        generationMilliseconds: 26,
        reviewState: "Source/gallery and native-game reviewed; unseen rear finish, estimated facade detail and loading-stall limits documented.",
        sourceCommit: "9c29e89655ab177fa1125320ad1a6f0fc0cfc8e6",
        galleryFrontage: {
          target: [
            4.8873335,
            52.381408
          ],
          distanceMetres: 35
        },
        updatedAt: "2026-10-07T06:38:49.107683+00:00"
      },
      {
        id: "ordinary-0363100012165119",
        buildingId: "NL.IMBAG.Pand.0363100012165119",
        name: "Pale glazed commercial corner on Spuistraat",
        anchor: [
          4.889293,
          52.3729795
        ],
        cameraBearing: 41,
        footprint: {
          type: "Polygon",
          coordinates: [
            [
              [
                4.889488,
                52.373119
              ],
              [
                4.88948,
                52.373119
              ],
              [
                4.88948,
                52.37312
              ],
              [
                4.889219,
                52.373132
              ],
              [
                4.889183,
                52.373115
              ],
              [
                4.889072,
                52.372827
              ],
              [
                4.889202,
                52.372853
              ],
              [
                4.889462,
                52.372905
              ],
              [
                4.889514,
                52.373079
              ],
              [
                4.889506,
                52.373098
              ],
              [
                4.889498,
                52.373096
              ],
              [
                4.889488,
                52.373119
              ]
            ]
          ]
        },
        height: 25.489049911499023,
        modelUrl: "./models/ordinary-buildings/0363100012165119.glb",
        bounds: {
          min: [
            -15.049013137817383,
            0,
            -17.249170303344727
          ],
          max: [
            15.049324035644531,
            25.489049911499023,
            17.072500228881836
          ]
        },
        triangles: 1906,
        bytes: 219068,
        materials: 3,
        hash: "b576d23ba164a2c48352baeddff02b6f81106f00f289c1bdae490e3be0bc60b1",
        referenceImages: [
          "./ordinary-buildings-data/references/0363100012165119/reference-0363100012165119-2025-1.jpg",
          "./ordinary-buildings-data/references/0363100012165119/reference-0363100012165119-2025-2.jpg",
          "./ordinary-buildings-data/references/0363100012165119/reference-0363100012165119-2025-0.jpg"
        ],
        sourcePack: "experiments/canal-belt-overnight/modern-01/0363100012165119",
        traits: [
          "Pale concrete frame and dark grouped glazing dominate the corner and long Spuistraat street wall.",
          "The lowest office floor is visibly taller than upper tiers; ground-floor shops and dark doors stay separate.",
          "Retain shallow projecting glazed stacks and measured roof height steps; a flat box with an even grid would lose the source character.",
          "The real vertical MAXWELLHOUSE sign occupies the pale corner panel. Use narrow upright sans capitals with restrained strokes; exact typeface is unknown."
        ],
        simplifications: [
          "Minor roof patches below0.8% footprint may be omitted only where recognition permits. Main steps18/21/22/24/25m remain.",
          "Projecting glass bays use estimated0.28m relief, supported visually but not surveyed.",
          "Small joinery, interiors and tenant logos are omitted.",
          "Source-corrected raised regions0/7 have estimated upper glazing21.8\u201324.6m; region4 remains dark technical enclosure. Measured roof polygons/heights preserved. Ground doors distinguish narrow recessed dark entrances from shop glass; obscured details conservative.",
          "Northeast terrace-facing upper office glazing is source-derived; bay counts/heights estimated within measured roof envelope. Unknown rooftop side faces remain plain."
        ],
        heightEvidence: "Official LoD2.2 roof regions supply the dominant22.308m plane plus source-supported18/21/24/25m steps. Do not use the equipment maximum as whole-building height. Photos show stepped roofline and dark rounded corner cap. Roof vertices are measured source geometry; facade openings are visual estimates.",
        facadeRecipe: {
          kind: "blank",
          levels: 0,
          edges: {
            "2": {
              kind: "modern-office",
              levels: 5,
              windowTiers: [
                {
                  sillMetres: 3.7,
                  heightMetres: 4.1,
                  startMetres: 0.35,
                  pitchMetres: 4.447139384449518,
                  count: 4,
                  widthMetres: 3.747139384449518,
                  panes: 3,
                  transomHeightsMetres: [
                    3.55
                  ]
                },
                {
                  sillMetres: 8.3,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.447139384449518,
                  count: 4,
                  widthMetres: 3.747139384449518,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 11.7,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.447139384449518,
                  count: 4,
                  widthMetres: 3.747139384449518,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 15.1,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.447139384449518,
                  count: 4,
                  widthMetres: 3.747139384449518,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 18.5,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.447139384449518,
                  count: 4,
                  widthMetres: 3.747139384449518,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                }
              ],
              bands: [
                {
                  bottomMetres: 3.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 7.8,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 11.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 14.55,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 17.95,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 21.35,
                  heightMetres: 0.45,
                  color: "#454e50"
                }
              ],
              groundEntries: [
                {
                  xMetres: 0.35,
                  widthMetres: 3.747139384449518,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 1,
                  transomHeightsMetres: [
                    2.1
                  ]
                },
                {
                  xMetres: 4.797139384449518,
                  widthMetres: 3.747139384449518,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                },
                {
                  xMetres: 9.244278768899036,
                  widthMetres: 1.35,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 1,
                  transomHeightsMetres: [
                    2.1
                  ],
                  frameColor: "#353e40",
                  glassColor: "#394a4f"
                },
                {
                  xMetres: 13.691418153348556,
                  widthMetres: 3.747139384449518,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 1,
                  transomHeightsMetres: [
                    2.1
                  ]
                }
              ],
              projectionGroups: [
                {
                  xMetres: 0.35,
                  widthMetres: 3.747139384449518,
                  bottomMetres: 3.7,
                  heightMetres: 14.2,
                  depthMetres: 0.28
                },
                {
                  xMetres: 13.691418153348556,
                  widthMetres: 3.747139384449518,
                  bottomMetres: 3.7,
                  heightMetres: 14.2,
                  depthMetres: 0.28
                }
              ],
              roundedCap: {
                heightMetres: 0.85,
                depthMetres: 0.45,
                minTopMetres: 22.1,
                maxTopMetres: 22.65
              }
            },
            "3": {
              kind: "modern-office",
              levels: 5,
              windowTiers: [
                {
                  sillMetres: 3.7,
                  heightMetres: 4.1,
                  startMetres: 0.35,
                  pitchMetres: 3.093138198074501,
                  count: 1,
                  widthMetres: 2.3931381980745012,
                  panes: 3,
                  transomHeightsMetres: [
                    3.55
                  ]
                },
                {
                  sillMetres: 8.3,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 3.093138198074501,
                  count: 1,
                  widthMetres: 2.3931381980745012,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 11.7,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 3.093138198074501,
                  count: 1,
                  widthMetres: 2.3931381980745012,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 15.1,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 3.093138198074501,
                  count: 1,
                  widthMetres: 2.3931381980745012,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 18.5,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 3.093138198074501,
                  count: 1,
                  widthMetres: 2.3931381980745012,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                }
              ],
              bands: [
                {
                  bottomMetres: 3.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 7.8,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 11.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 14.55,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 17.95,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 21.35,
                  heightMetres: 0.45,
                  color: "#454e50"
                }
              ],
              groundEntries: [
                {
                  xMetres: 0.35,
                  widthMetres: 2.3931381980745012,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                }
              ],
              roundedCap: {
                heightMetres: 0.85,
                depthMetres: 0.45,
                minTopMetres: 22.1,
                maxTopMetres: 22.65
              }
            },
            "4": {
              kind: "modern-office",
              levels: 5,
              windowTiers: [
                {
                  sillMetres: 3.7,
                  heightMetres: 4.1,
                  startMetres: 0.35,
                  pitchMetres: 4.1169696267356475,
                  count: 8,
                  widthMetres: 3.4169696267356473,
                  panes: 3,
                  transomHeightsMetres: [
                    3.55
                  ]
                },
                {
                  sillMetres: 8.3,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.1169696267356475,
                  count: 8,
                  widthMetres: 3.4169696267356473,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 11.7,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.1169696267356475,
                  count: 8,
                  widthMetres: 3.4169696267356473,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 15.1,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.1169696267356475,
                  count: 8,
                  widthMetres: 3.4169696267356473,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 18.5,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.1169696267356475,
                  count: 8,
                  widthMetres: 3.4169696267356473,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                }
              ],
              bands: [
                {
                  bottomMetres: 3.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 7.8,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 11.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 14.55,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 17.95,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 21.35,
                  heightMetres: 0.45,
                  color: "#454e50"
                }
              ],
              groundEntries: [
                {
                  xMetres: 0.35,
                  widthMetres: 1.3,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 1,
                  transomHeightsMetres: [
                    2.1
                  ],
                  frameColor: "#343b3d",
                  glassColor: "#344247"
                },
                {
                  xMetres: 4.466969626735647,
                  widthMetres: 3.4169696267356473,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                },
                {
                  xMetres: 8.583939253471295,
                  widthMetres: 1.2,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 1,
                  transomHeightsMetres: [
                    2.1
                  ],
                  frameColor: "#343b3d",
                  glassColor: "#344247"
                },
                {
                  xMetres: 12.700908880206942,
                  widthMetres: 3.4169696267356473,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                },
                {
                  xMetres: 16.81787850694259,
                  widthMetres: 3.4169696267356473,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                },
                {
                  xMetres: 20.934848133678237,
                  widthMetres: 1.15,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "solid",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ],
                  color: "#505858"
                },
                {
                  xMetres: 25.051817760413886,
                  widthMetres: 3.4169696267356473,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                },
                {
                  xMetres: 29.168787387149536,
                  widthMetres: 3.4169696267356473,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                }
              ],
              projectionGroups: [
                {
                  xMetres: 0.35,
                  widthMetres: 3.4169696267356473,
                  bottomMetres: 3.7,
                  heightMetres: 14.2,
                  depthMetres: 0.28
                }
              ],
              roundedCap: {
                heightMetres: 0.85,
                depthMetres: 0.45,
                minTopMetres: 22.1,
                maxTopMetres: 22.65
              }
            },
            "7": {
              kind: "modern-office",
              levels: 5,
              windowTiers: [
                {
                  sillMetres: 3.7,
                  heightMetres: 4.1,
                  startMetres: 0.35,
                  pitchMetres: 4.922360819132907,
                  count: 4,
                  widthMetres: 4.2223608191329065,
                  panes: 3,
                  transomHeightsMetres: [
                    3.55
                  ]
                },
                {
                  sillMetres: 8.3,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.922360819132907,
                  count: 4,
                  widthMetres: 4.2223608191329065,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 11.7,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.922360819132907,
                  count: 4,
                  widthMetres: 4.2223608191329065,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 15.1,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.922360819132907,
                  count: 4,
                  widthMetres: 4.2223608191329065,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 18.5,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 4.922360819132907,
                  count: 4,
                  widthMetres: 4.2223608191329065,
                  panes: 3,
                  transomHeightsMetres: [
                    2.25
                  ]
                }
              ],
              bands: [
                {
                  bottomMetres: 3.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 7.8,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 11.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 14.55,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 17.95,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 21.35,
                  heightMetres: 0.45,
                  color: "#454e50"
                },
                {
                  xMetres: 14.5,
                  widthMetres: 1.3,
                  bottomMetres: 3.2,
                  heightMetres: 18.8,
                  color: "#deddd3"
                }
              ],
              groundEntries: [
                {
                  xMetres: 0.35,
                  widthMetres: 4.2223608191329065,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                },
                {
                  xMetres: 5.272360819132906,
                  widthMetres: 4.2223608191329065,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                },
                {
                  xMetres: 10.194721638265813,
                  widthMetres: 4.2223608191329065,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                },
                {
                  xMetres: 15.11708245739872,
                  widthMetres: 4.2223608191329065,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                }
              ],
              roundedCap: {
                heightMetres: 0.85,
                depthMetres: 0.45,
                minTopMetres: 22.1,
                maxTopMetres: 22.65
              }
            },
            "8": {
              kind: "modern-office",
              levels: 5,
              windowTiers: [
                {
                  sillMetres: 3.7,
                  heightMetres: 4.1,
                  startMetres: 0.35,
                  pitchMetres: 2.183844540162013,
                  count: 1,
                  widthMetres: 1.483844540162013,
                  panes: 2,
                  transomHeightsMetres: [
                    3.55
                  ]
                },
                {
                  sillMetres: 8.3,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 2.183844540162013,
                  count: 1,
                  widthMetres: 1.483844540162013,
                  panes: 2,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 11.7,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 2.183844540162013,
                  count: 1,
                  widthMetres: 1.483844540162013,
                  panes: 2,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 15.1,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 2.183844540162013,
                  count: 1,
                  widthMetres: 1.483844540162013,
                  panes: 2,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 18.5,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 2.183844540162013,
                  count: 1,
                  widthMetres: 1.483844540162013,
                  panes: 2,
                  transomHeightsMetres: [
                    2.25
                  ]
                }
              ],
              bands: [
                {
                  bottomMetres: 3.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 7.8,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 11.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 14.55,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 17.95,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 21.35,
                  heightMetres: 0.45,
                  color: "#454e50"
                }
              ],
              groundEntries: [
                {
                  xMetres: 0.35,
                  widthMetres: 1.483844540162013,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                }
              ],
              roundedCap: {
                heightMetres: 0.85,
                depthMetres: 0.45,
                minTopMetres: 22.1,
                maxTopMetres: 22.65
              }
            },
            "10": {
              kind: "modern-office",
              levels: 5,
              windowTiers: [
                {
                  sillMetres: 3.7,
                  heightMetres: 4.1,
                  startMetres: 0.35,
                  pitchMetres: 2.6490261481263744,
                  count: 1,
                  widthMetres: 1.9490261481263744,
                  panes: 2,
                  transomHeightsMetres: [
                    3.55
                  ]
                },
                {
                  sillMetres: 8.3,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 2.6490261481263744,
                  count: 1,
                  widthMetres: 1.9490261481263744,
                  panes: 2,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 11.7,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 2.6490261481263744,
                  count: 1,
                  widthMetres: 1.9490261481263744,
                  panes: 2,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 15.1,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 2.6490261481263744,
                  count: 1,
                  widthMetres: 1.9490261481263744,
                  panes: 2,
                  transomHeightsMetres: [
                    2.25
                  ]
                },
                {
                  sillMetres: 18.5,
                  heightMetres: 2.8,
                  startMetres: 0.35,
                  pitchMetres: 2.6490261481263744,
                  count: 1,
                  widthMetres: 1.9490261481263744,
                  panes: 2,
                  transomHeightsMetres: [
                    2.25
                  ]
                }
              ],
              bands: [
                {
                  bottomMetres: 3.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 7.8,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 11.15,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 14.55,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 17.95,
                  heightMetres: 0.45,
                  color: "#deddd3"
                },
                {
                  bottomMetres: 21.35,
                  heightMetres: 0.45,
                  color: "#454e50"
                }
              ],
              groundEntries: [
                {
                  xMetres: 0.35,
                  widthMetres: 1.9490261481263744,
                  heightMetres: 2.65,
                  bottomMetres: 0.35,
                  kind: "glazed",
                  panes: 2,
                  transomHeightsMetres: [
                    2.1
                  ]
                }
              ],
              roundedCap: {
                heightMetres: 0.85,
                depthMetres: 0.45,
                minTopMetres: 22.1,
                maxTopMetres: 22.65
              }
            }
          }
        },
        official3D: {
          summaryPath: "experiments/canal-belt-overnight/modern-01/0363100012165119/geometry-summary.json",
          groundNAP: 0.9670000076293945,
          rectangleFill: 0.752,
          courtyardArea: 0
        },
        generationMilliseconds: 98,
        reviewState: "Source/gallery and native-game reviewed; unseen rear finish, estimated facade detail and loading-stall limits documented.",
        sourceCommit: "9c29e89655ab177fa1125320ad1a6f0fc0cfc8e6",
        galleryFrontage: {
          target: [
            4.88948,
            52.3731
          ],
          distanceMetres: 48
        },
        updatedAt: "2026-10-07T06:38:49.107683+00:00"
      }
    ]
  };

  // src/canalRecall/landmarks/ordinaryModels.ts
  var models = catalogue_default.models;
  var ORDINARY_BUILDING_VERSIONS = Object.fromEntries(models.map((m) => [m.id, m.hash]));
  var ORDINARY_BUILDINGS = models.map((m) => ({
    id: m.id,
    assetKind: "ordinary-building",
    name: m.name,
    landmarkId: "",
    modelUrl: m.modelUrl,
    suppressOsmIds: [m.buildingId, ...m.aliases ?? []],
    spatialSuppression: false,
    buildingFootprint: m.footprint,
    heightMetres: m.height,
    heightToleranceMetres: 0.5,
    groundAltitudeMetres: 0,
    facingOffsetDegrees: 0,
    // Radius is used for visibility/loading only; suppression always uses exact IDs.
    footprint: { centre: m.anchor, headingDegrees: 90, lengthMetres: m.bounds.max[0] - m.bounds.min[0], widthMetres: m.bounds.max[2] - m.bounds.min[2] },
    surveyed: { anchor: m.anchor, northOffsetDegrees: 0, source: "Installed native footprint; source-specific facade and roof recipe. Heights/details retain documented approximations." },
    attribution: { title: m.name, author: "Map Recall", sourceUrl: m.sourceUrls?.[0] ?? "https://data.amsterdam.nl/", licence: "Original project asset", licenceUrl: "./LICENSE", modifications: "Original procedural facade patterns and shallow geometry on native surveyed footprints. No reference-photo pixels or imported model geometry. See ordinary building recipe for source/height uncertainties." }
  }));

  // src/canalRecall/landmarks/signatureModels.ts
  var EXPECTED_HEIGHTS = {
    "palace-on-the-dam": { metres: 55, tolerance: 1.5 }
  };
  var FACADE_BEARINGS = {
    "palace-on-the-dam": 91,
    // east, onto the Dam
    "centraal-station": 187,
    // south, down the Damrak
    "rijksmuseum": 13,
    // north, towards the city
    "westerkerk": 93,
    // east, onto the Prinsengracht
    "oude-kerk": 93,
    // east, onto the Oudekerksplein
    "de-beurs-van-berlage": 97,
    "nemo": 250,
    "stadhuis": 270,
    "national-monument-on-the-dam": 271,
    "munttoren-amsterdam": 200,
    "montelbaanstoren-amsterdam": 250,
    "concertgebouw": 12,
    "bimhuis-in-amsterdam-the-netherlands": 200,
    "heineken-experience-amsterdam": 100,
    "netherlands-film-and-television-academy-the-netherlands": 180
  };
  var WAREHOUSE_LICENCE = {
    licence: "3D Warehouse General Model License",
    licenceUrl: "https://3dwarehouse.sketchup.com/tos/",
    modifications: "Cleaned up for the web, not changed artistically: SketchUp construction edges removed, faces made double-sided so inward-facing normals stop rendering black, all materials set non-metallic (they arrive at glTF's default metallicFactor 1.0, which renders black with no environment map), unpainted faces darkened from SketchUp's near-white, spare UV sets and tangents dropped, textures re-encoded as WebP, geometry quantized and meshopt-compressed. Placed at the city's own published coordinate at its surveyed size, unscaled and unrotated."
  };
  function osmIdCandidates(landmarkId) {
    const digits = landmarkId.replace(/^\D+/, "");
    if (!/^\d+$/.test(digits)) return [];
    return [`w${digits}`, `r${digits}`];
  }
  function specFromCatalogue(entry) {
    const height = EXPECTED_HEIGHTS[entry.id];
    return {
      id: entry.id,
      name: entry.name,
      landmarkId: entry.landmarkId,
      modelUrl: `./models/${entry.id}.glb`,
      // Both prefixes for the same number, because the extract records a
      // landmark as `extract_landmarks_<id>` without saying whether that id is a
      // way or a relation — the Palace is relation 3580875 whose outer ring is
      // way 342809743, and which of the two the tiles carry is not knowable from
      // here. An id that does not exist simply never matches, so offering both
      // costs nothing and guessing wrong would cost the suppression.
      suppressOsmIds: osmIdCandidates(entry.landmarkId),
      footprint: entry.footprint ?? void 0,
      heightMetres: height?.metres,
      heightToleranceMetres: height?.tolerance,
      groundAltitudeMetres: 0,
      facingOffsetDegrees: FACADE_BEARINGS[entry.id] ?? 0,
      surveyed: {
        anchor: entry.anchor,
        northOffsetDegrees: 0,
        source: `3D Warehouse entity ${entry.warehouseId}, geo attribute`
      },
      attribution: {
        title: entry.name,
        author: entry.author,
        sourceUrl: `https://3dwarehouse.sketchup.com/model/${entry.warehouseId}`,
        licence: WAREHOUSE_LICENCE.licence,
        licenceUrl: WAREHOUSE_LICENCE.licenceUrl,
        modifications: WAREHOUSE_LICENCE.modifications
      }
    };
  }
  var SIGNATURE_MODELS = [...surveyedLandmarks_default.filter((entry) => !MANUAL_LANDMARKS.some((model) => model.id === entry.id)).map(specFromCatalogue), ...MANUAL_LANDMARKS, ...ORDINARY_BUILDINGS];

  // src/canalRecall/game/manual-poi-data.json
  var manual_poi_data_default = [
    {
      modelId: "centraal-station",
      name: "Amsterdam Centraal",
      description: "Amsterdam Centraal was designed by Pierre Cuypers and opened in 1889. Its monumental station building stands on artificial islands along the IJ.",
      sourceUrl: "https://arcam.nl/architectuur-gids/centraal-station/"
    },
    {
      modelId: "adam-tower",
      name: "A\u2019DAM Tower",
      description: "A\u2019DAM Tower brings an observation deck, music companies, restaurants, a hotel and a nightclub together across the IJ from Amsterdam Centraal.",
      sourceUrl: "https://adamtoren.nl/"
    },
    {
      modelId: "pontsteiger",
      name: "Pontsteiger",
      description: "Arons & Gelauff designed this chair-shaped residential building in the IJ. Its raised lower floors leave a public waterside square beneath the large upper volume.",
      sourceUrl: "https://arcam.nl/architectuur-gids/pontsteiger/"
    },
    {
      modelId: "rem-eiland",
      name: "REM-eiland",
      description: "This former North Sea platform broadcast commercial television in 1964. It was moved to Amsterdam\u2019s Nieuwe Houthaven in 2011 and converted into a restaurant.",
      sourceUrl: "https://www.remeiland.nl/nl/historie"
    },
    {
      modelId: "paradiso",
      name: "Paradiso",
      description: "Paradiso is a music venue in a former church near Leidseplein. The main hall retains the church\u2019s tall stained-glass windows.",
      sourceUrl: "https://www.paradiso.nl/en/info/about-us/paradiso-vandaag"
    },
    {
      modelId: "magna-plaza",
      name: "Magna Plaza",
      description: "Magna Plaza occupies Amsterdam\u2019s former main post office. P.C. Peters designed the monumental building, which was later converted into a shopping centre.",
      sourceUrl: "https://www.magnaplaza.nl/the-story-behind-magna-plaza/"
    },
    {
      modelId: "scheepvaarthuis",
      name: "Scheepvaarthuis",
      description: "Six shipping companies commissioned this Amsterdam School headquarters. Its sculpted facade uses maritime symbols, and the building now houses Grand Hotel Amr\xE2th.",
      sourceUrl: "https://www.amrathamsterdam.com/en/information/history/the-scheepvaarthuis"
    },
    {
      modelId: "de-bijenkorf",
      name: "De Bijenkorf",
      description: "The Bijenkorf\u2019s Dam Square department store opened in 1914. Its original monumental facades were extended as the store expanded along Damrak.",
      sourceUrl: "https://www.cultureelerfgoeddebijenkorf.nl/architectuur/bouwfasesamsterdam"
    },
    {
      modelId: "gashouder",
      name: "Gashouder",
      description: "The circular Gashouder is an industrial landmark at the former Westergas gasworks. Its large column-free interior is used for cultural events.",
      sourceUrl: "https://gashouder.nl/"
    },
    {
      modelId: "hortus-greenhouses",
      name: "Hortus Botanicus greenhouses",
      description: "The Hortus Climate House brings contrasting plant habitats together under one greenhouse roof. The garden also contains historic palm and orangery buildings.",
      sourceUrl: "https://www.dehortus.nl/en/garden-and-greenhouses/climate-house/"
    },
    {
      modelId: "frascati",
      name: "Frascati",
      description: "Frascati is a theatre and production house on the Nes, presenting contemporary theatre and performance in the heart of Amsterdam.",
      sourceUrl: "https://www.frascatitheater.nl/"
    },
    {
      modelId: "lab111",
      name: "LAB111",
      description: "LAB111 is an independent cinema in a former pathological anatomical laboratory. Its name recalls the building\u2019s earlier scientific use.",
      sourceUrl: "https://www.lab111.nl/over-ons/"
    },
    {
      modelId: "studiok",
      name: "Studio/K \u2014 Timorplein school",
      description: "Studio/K occupies part of the former technical school on Timorplein. The school complex was repurposed for cinema, cultural activity and other shared uses.",
      sourceUrl: "https://arcam.nl/architectuur-gids/voormalige-technische-school-timorplein/"
    },
    {
      modelId: "athenaeum",
      name: "Athenaeum Bookshop",
      description: "Athenaeum is a bookshop on the Spui. Its neighbouring Nieuwscentrum specialises in newspapers and magazines.",
      sourceUrl: "https://www.athenaeum.nl/"
    },
    {
      modelId: "scheltema",
      name: "Scheltema",
      description: "Scheltema is a bookshop on the Rokin, with books spread across several floors in a historic city-centre building.",
      sourceUrl: "https://www.scheltema.nl/"
    },
    {
      modelId: "vondelpark-bandstand",
      name: "Vondelpark bandstand",
      description: "This open iron bandstand stands on an island in Vondelpark. Its slender columns support a tent-shaped roof with a decorative finial.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/504754"
    },
    {
      modelId: "hemp-gallery",
      name: "Hemp Gallery",
      description: "The Hemp Gallery opened in 2009 as the Hash Marihuana & Hemp Museum\u2019s second Amsterdam venue. It explores hemp\u2019s uses in paper, sails, food, clothing and design.",
      sourceUrl: "https://hashmuseum.com/en/amsterdam/"
    },
    {
      modelId: "sint-jorishof",
      name: "Sint Jorishof",
      description: "Sint Jorishof is a protected historic complex on the Korte Spinhuissteeg. Its buildings enclose a courtyard within the dense city-centre block.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/5550"
    },
    {
      modelId: "silodam",
      name: "Silodam",
      description: "MVRDV designed Silodam as a mixed-use building at the edge of Amsterdam\u2019s harbour. Different housing types are expressed as blocks of contrasting colours and materials.",
      sourceUrl: "https://www.mvrdv.com/projects/163/silodam"
    },
    {
      modelId: "olvg-west",
      name: "OLVG West",
      description: "OLVG West is one of OLVG\u2019s two main Amsterdam hospital locations. OLVG provides hospital care for the city across its eastern and western sites.",
      sourceUrl: "https://www.olvg.nl/over-olvg/"
    },
    {
      modelId: "olvg-oost",
      name: "OLVG Oost",
      description: "OLVG Oost is one of OLVG\u2019s two main Amsterdam hospital locations. OLVG provides hospital care for the city across its eastern and western sites.",
      sourceUrl: "https://www.olvg.nl/over-olvg/"
    },
    {
      modelId: "amsta-de-poort",
      name: "Amsta De Poort",
      description: "De Poort has provided residential care on Hugo de Grootkade since 1969. Its canal-side setting gives residents wide views across Amsterdam. The ground-floor De Ontmoeting brings residents and neighbors together, with a restaurant that also provides work and learning opportunities for local students.",
      sourceUrl: "https://www.amsta.nl/locaties/de-poort"
    },
    {
      modelId: "rembrandt-tower",
      name: "Rembrandt Tower",
      sourceUrl: "https://arcam.nl/architectuur-gids/rembrandttoren/",
      description: "The Rembrandt Tower is an office skyscraper at De Omval, completed in 1995. Its stepped granite crown and glass corner bays recall American skyscrapers of the 1930s."
    },
    {
      modelId: "breitner-tower",
      name: "Breitner Tower / Breitner Center",
      sourceUrl: "https://nl.linkedin.com/posts/zzdp-architecten_breitnertoren-philips-som-activity-7343676714033569792-l8Qf",
      description: "The Breitner Tower and its lower Breitner Center wing form part of De Omval\u2019s three-tower ensemble near Amstelstation. The glass tower was completed in 2001 for Philips, designed by SOM with ZZDP."
    },
    {
      modelId: "mondriaan-tower",
      name: "Mondriaan Tower",
      sourceUrl: "https://www.mondriaan-tower.nl/",
      description: "The Mondriaan Tower is a 30-floor office tower at Amstelplein, completed in 2002. Its solid central block is flanked by stepped glass bays, with a glass lookout near the top."
    },
    {
      modelId: "de-piramides",
      name: "De Piramides",
      sourceUrl: "https://pphp.nl/project/piramides-amsterdam-concept/",
      description: "De Piramides consists of two interlocking stepped residential towers on Marcanti-eiland, designed by Sjoerd Soeters\u2019s practice and completed in 2006. Their terraces follow the triangular island; two lower towers replaced an earlier proposal for one 75-metre pyramid."
    },
    {
      modelId: "zuiveringshal-west",
      name: "Fabrique des Lumi\xE8res",
      description: "Fabrique des Lumi\xE8res opened in 2022 in Zuiveringshal West. The former gas-purification hall now turns its industrial walls and floors into immersive artworks using large-scale light projections and music. Its two exhibition spaces occupy around 2,800 square metres of the historic Westergas complex.",
      sourceUrl: "https://westergas.nl/en/press-release-latelier-des-lumieres/"
    },
    {
      modelId: "amsterdam-in-motion",
      name: "Amsterdam in Motion",
      description: "Amsterdam in Motion opened in 2025 for the city\u2019s 750th anniversary. Curated by the Amsterdam Museum in Zuiveringshal Oost, it tells the city\u2019s story through a 200-square-metre multimedia model and an interactive exhibition about Amsterdam\u2019s future.",
      sourceUrl: "https://www.amsterdammuseum.nl/tickets-en-bezoek/locaties/amsterdam-in-motion/228553"
    },
    {
      modelId: "de-krakeling",
      name: "Theater De Krakeling",
      description: "De Krakeling is a theater devoted to young audiences. Founded in 1978 by Hans Snoek, it moved to the former Westergastheater on Pazzanistraat 15 in 2020. Its main auditorium is named the Hans Snoek Zaal in her honor.",
      sourceUrl: "https://krakeling.nl/over-ons"
    },
    {
      modelId: "sloterdijk-station",
      name: "Amsterdam Sloterdijk Station",
      sourceUrl: "https://arcam.nl/architectuur-gids/station-sloterdijk/",
      description: "Amsterdam Sloterdijk\u2019s glass-and-steel station was designed by Harry Reijnders and completed in 1986. Its white table-like trusses frame a transport interchange where railway lines cross at different heights.",
      center: [
        52.3890237,
        4.8374469
      ],
      centerSourceUrl: "https://www.openstreetmap.org/node/3938569974"
    },
    {
      modelId: "hnk-sloterdijk",
      name: "HNK Amsterdam Sloterdijk",
      sourceUrl: "https://hnk.nl/en/locations/amsterdam-sloterdijk",
      description: "HNK Amsterdam Sloterdijk occupies the white office building at Radarweg 60. The renewed venue opened in 2023 with shared workspaces, a library, podcast studio and The Social hospitality space; the building itself dates from 1992."
    },
    {
      modelId: "machinegebouw",
      name: "Cantine \xB7 Machinegebouw",
      description: "Cantine occupies the freestanding Machinegebouw at Westergas. The former gasworks building has two parallel halls with unequal pitched roofs, tall paired arched windows and terracotta roof crests. Its industrial interior now houses a French restaurant.",
      sourceUrl: "https://cantine.nl/"
    },
    {
      modelId: "de-wester",
      name: "De Wester \xB7 Transformatorhuis",
      description: "De Wester is an event venue in the former Westergas water-gas factory, built in 1904 and later used as a transformer workshop. Its long brick hall has paired arched windows and a steep pitched roof. The neighboring WestWeelde buildings remain separate spaces.",
      sourceUrl: "https://westergas.nl/en/de-wester-as-event-venue/"
    },
    {
      modelId: "amstel-hotel",
      name: "Amstel Hotel",
      description: "The Amstel Hotel was completed in 1867 to a design by Cornelis Outshoorn, following Samuel Sarphati\u2019s ambition for a grand riverside hotel. Its mansard roofs and pale stone details give it the silhouette of a French ch\xE2teau. Recent restoration brought back eight 1.60-metre roof lions, while a lower glass lounge overlooks the Amstel.",
      sourceUrl: "https://www.amstelhotel.com/history/"
    },
    {
      modelId: "concertgebouw",
      name: "Royal Concertgebouw",
      sourceUrl: "https://www.concertgebouw.nl/en/our-history/history",
      description: "The Royal Concertgebouw was designed by Adolf Leonard van Gendt and opened on 11 April 1888. Its famous classical facade is crowned by a golden lyre. Pi de Bruijn\u2019s 1985\u20131988 renovation added the glass promenade beside the historic halls."
    },
    {
      modelId: "heineken-experience-amsterdam",
      landmarkId: "extract_landmarks_914627337",
      name: "Heineken Experience",
      description: "The brewery on Stadhouderskade made Heineken beer from 1867 until 1988. Its surviving street front combines a 1911\u201313 brew house with paired arched windows, a 1925 malt silo and the largely windowless 1933\u201334 cooling and storage building. Today the former brewery houses the Heineken Experience.",
      sourceUrl: "https://www.heinekenexperience.com/en/about-the-experience",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/complexen/527808",
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/527809",
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/527810",
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/527811"
      ]
    },
    {
      modelId: "faralda-crane-hotel",
      landmarkId: "extract_landmarks_1759004236",
      name: "Faralda NDSM Crane Hotel Amsterdam",
      description: "Faralda occupies NDSM\u2019s former Crane 13, built in 1950 and restored by Talsma in 2013. It opened as a hotel in 2014. Three suites sit at 35, 40 and 45 metres, with a rooftop jacuzzi above them; the restored steel is blue-gray and yellow, while new lifts and stairs are red.",
      sourceUrl: "https://talsmashipyards.nl/en/projecten/specials-en/ndsm-cranehotel/",
      additionalSources: [
        "https://www.iaa-architecten.nl/projecten/feralda-crane-hotel/",
        "https://www.faralda.com/hotels/"
      ]
    },
    {
      modelId: "ing-house",
      landmarkId: "osm-way-57856367",
      name: "ING House / Infinity",
      sourceUrl: "https://mvsa-architects.com/en/projects/ing-house/",
      sourceUrls: [
        "https://mvsa-architects.com/en/projects/ing-house/",
        "https://www.amsterdam.nl/stadsarchief/stukken/plannen/zuidas/",
        "https://www.breeam.nl/projecten/infinity-amsterdam-16223",
        "https://www.lexence.com/wp-content/uploads/2025/02/Routebeschrijving-2.pdf"
      ],
      wikidata: "Q645881",
      wikipedia: "nl:Infinity (gebouw)",
      address: "Amstelveenseweg 500, 1081 KL Amsterdam",
      center: [
        52.3369407,
        4.8553107
      ],
      description: "Meyer and Van Schooten Architects completed ING House in 2002. Its glass-and-aluminium wedge rests on 16 inclined steel legs, 9\u201312 metres above ground, keeping a route open beneath its silver belly. The double-skin facade shields offices from A10 noise while drawing fresh air from the quieter south side. Six interior gardens form part of the design. ING moved out in 2015; the building became the multi-tenant Infinity offices.",
      destinationNotes: "The arrival pin is the public bicycle approach on Sk\xFBtsjespad at mapped road/footway junction n6407529791, matching installed routing_7438. It marks the approach to the complex, not a door. From there the mapped footway and steps connect to the covered pedestrian passage beneath ING House. The separately recorded main entrance n1339449505, Amstelveenseweg 500, lies inside its exact current BAG footprint. Primary Lexence visitor directions confirm ground-floor lift and visitor access. Keep the selected ING House identity when routing fails; do not substitute the closer northern busway or another POI.",
      entrance: {
        center: [
          52.3371561,
          4.8560226
        ],
        sourceUrl: "https://www.openstreetmap.org/node/1339449505",
        precision: "OSM entrance=main node n1339449505 with house number 500, last edited in 2019 as version 7. It lies within the current BAG parent and connects to the covered pedestrian passage. This is a mapped entrance location, not an independent door survey."
      },
      streetApproach: {
        center: [
          52.3369407,
          4.8553107
        ],
        sourceUrl: "https://www.openstreetmap.org/way/7381220",
        precision: "Actual mapped road node n6407529791 where footway w684001541 branches into steps to the covered passage. This is the public bicycle arrival approach, not a surveyed door."
      }
    },
    {
      modelId: "muiderpoort",
      landmarkId: "extract_landmarks_1639856562",
      name: "Muiderpoort",
      description: "The Muiderpoort is a surviving gate of Amsterdam\u2019s former city wall. Cornelis Rauws designed the present classical gate after its predecessor collapsed in 1769; it was built in 1770\u20131771. Its two sculpted pediments show different city emblems: a medieval cog ship on the city side and the three Saint Andrew\u2019s crosses on the outer side. Napoleon entered Amsterdam through this gate in 1811. The open passage retains a brick vault beneath the octagonal dome and clock lantern.",
      sourceUrl: "https://stadsherstel.nl/monumenten/muiderpoort/",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/5139",
        "https://erfgoedregister.amsterdam.nl/monument/f665a00b-f8e3-4242-8b0f-ce071282d956/?collection=2017-stad-en-land"
      ]
    },
    {
      modelId: "idfa-pavilion",
      landmarkId: "osm-way-57857054",
      name: "IDFA Het Documentaire Paviljoen",
      center: [
        52.36108,
        4.875
      ],
      sourceUrl: "https://www.idfa.nl/en/vondelpark/",
      description: "IDFA\u2019s year-round documentary home occupies Willem Hamer\u2019s Vondelparkpaviljoen, built in 1879\u20131881 as a caf\xE9-restaurant. Its Italian Renaissance facade combines open columned loggias, corner domes and a raised terrace. The historic pavilion previously housed the Nederlands Filmmuseum; today it brings documentary screenings, conversations and exhibitions to Vondelpark, with Caf\xE9 Vertigo downstairs.",
      sourceLinks: [
        {
          title: "IDFA documentary pavilion",
          url: "https://www.idfa.nl/en/vondelpark/"
        },
        {
          title: "National heritage register 504833",
          url: "https://monumentenregister.cultureelerfgoed.nl/monumenten/504833"
        },
        {
          title: "IDFA practical information and Caf\xE9 Vertigo",
          url: "https://www.idfa.nl/vondelpark/verhuur/praktische-informatie/"
        },
        {
          title: "IDFA2023 annual report: pavilion opened March2024",
          url: "https://www.idfa.nl/en/about-idfa/meet-the-team/annual-reports/annualreport-2023/het-documentaire-paviljoen/"
        }
      ]
    },
    {
      modelId: "social-history",
      landmarkId: "extract_landmarks_742782013",
      name: "International Institute of Social History",
      center: [
        52.3690003,
        4.9393848
      ],
      sourceUrl: "https://www.atelierpro.nl/projecten/internationaal-instituut-voor-sociale-geschiedenis",
      description: "The IISG preserves archives of labour and social movements. Its Cruquiusweg home began as the massive concrete cocoa warehouse Koning Willem I in1961. AtelierPRO converted it into an archive and research centre in1989: the heavy structure carries the collections, while a great harbour window lights the atrium. The former loading platform supports the projecting reading room. The institute was founded in1935 by historian Nicolaas Posthumus.",
      sourceLinks: [
        {
          title: "AtelierPRO: warehouse conversion and reading room",
          url: "https://www.atelierpro.nl/projecten/internationaal-instituut-voor-sociale-geschiedenis"
        },
        {
          title: "Arcam: cocoa warehouse, atrium and former press museum",
          url: "https://arcam.nl/architectuur-gids/internationaal-instituut-voor-sociale-geschiedenis/"
        },
        {
          title: "IISG: visiting the collections at Cruquiusweg31",
          url: "https://iisg.amsterdam/nl/collecties/plan-uw-bezoek"
        },
        {
          title: "KNAW: social history archive and research institute",
          url: "https://www.knaw.nl/instituten/internationaal-instituut-voor-sociale-geschiedenis-iisg"
        }
      ]
    },
    {
      id: "extract_landmarks_897347854",
      name: "Museum De Dageraad",
      center: [
        52.3498616,
        4.8990404
      ],
      description: "Museum De Dageraad occupies a former shop in the Amsterdam School housing complex designed by Michel de Klerk and Piet Kramer. Its exhibitions connect the expressive brick architecture with social housing and Berlage\u2019s Plan Zuid; guided walks reveal how the architects designed both street and rear facades as a total artwork.",
      funFact: "De Klerk and Kramer designed the street facades, rear facades and home layouts together. The museum occupies a former corner shop, while the surrounding complex remains housing.",
      sourceUrls: [
        "https://www.hetschip.nl/de-dageraad",
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/1508",
        "https://amsterdamse-school.nl/blog/museum-de-dageraad"
      ],
      website: "https://www.hetschip.nl/de-dageraad",
      modelId: "dageraad",
      landmarkId: "extract_landmarks_897347854",
      sourceUrl: "https://www.hetschip.nl/de-dageraad"
    },
    {
      modelId: "ons-lieve-heer-op-solder",
      name: "Our Lord in the Attic",
      sourceUrl: "https://opsolder.nl/en/the-monument/",
      description: "Merchant Jan Hartman bought the canal house and two rear alley houses in 1661 and joined their attics to create a hidden Catholic church, when public Catholic worship was forbidden. The surviving church is an example of Amsterdam\u2019s tolerated private worship. The museum opened in 1888; its 2015 entrance at number 38 links to the historic house underground, leaving Heintje Hoekssteeg open.",
      sourceUrls: [
        "https://opsolder.nl/en/the-monument/",
        "https://opsolder.nl/en/media-and-press/",
        "https://www.nlbouwmeesters.nl/projecten/museum-ons-lieve-heer-op-solder/",
        "https://vekemans.nl/2015/04/15/historische-gevel-opnieuw-opgebouwd/",
        "https://opsolder.nl/wp-content/uploads/2024/04/haantje46.pdf"
      ],
      landmarkId: "extract_landmarks_1791250152"
    },
    {
      modelId: "canals-museum",
      landmarkId: "extract_landmarks_915035378",
      name: "Museum of the Canals",
      center: [
        52.3678921,
        4.8862198
      ],
      description: "The Museum of the Canals explains how Amsterdam's seventeenth-century canal belt was created, inside a double-width merchant's house at Herengracht 386. Karel Gerards commissioned Philips Vingboons in 1663; the museum dates the completed house to 1665. Its classical facade has stacked pilasters and a central triangular pediment. Later resident Jan Willink helped finance American independence through loans to John Adams.",
      funFact: "The Andriessenkamer's landscape murals were painted in 1776 and probably moved here during a later alteration. Its apparently historic ceiling was actually painted by Pascal Amblard in 2022.",
      sourceUrl: "https://grachten.museum/stijlkamers-en-gebouw/",
      sourceLinks: [
        {
          title: "Museum house, residents and historic rooms",
          url: "https://grachten.museum/stijlkamers-en-gebouw/"
        },
        {
          title: "National heritage register 1828",
          url: "https://monumentenregister.cultureelerfgoed.nl/monumenten/1828"
        },
        {
          title: "Museum public address and entrance",
          url: "https://grachten.museum/adres-en-route/"
        }
      ],
      website: "https://grachten.museum/",
      identityNotes: "Preserve existing genuine extract destination and center; this is one double house, not two invented POIs. Center lies inside BAG parent0363100012176537; existing canal-facing destination remains used."
    },
    {
      modelId: "niod",
      landmarkId: "extract_landmarks_1742509310",
      name: "NIOD Institute for War, Holocaust, and Genocide Studies",
      center: [
        52.3680936,
        4.8863164
      ],
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/1826",
      description: "NIOD studies war, the Holocaust and genocide from this richly carved sandstone double house on the Herengracht. Abraham and G.B. Salm designed the French neo-Renaissance house, built in 1888\u20131890. Its right-hand carriage entrance and elaborate three-part dormer facade preserve the ambition of its original private residence. The house had an innovative glazed roof bringing daylight into its staircase, hall and bathroom.",
      sourceLinks: [
        {
          title: "RCE: monument 1826, sandstone double house and pavement lanterns",
          url: "https://monumentenregister.cultureelerfgoed.nl/monumenten/1826"
        },
        {
          title: "NIOD: Als de muren konden spreken",
          url: "https://www.niod.nl/longreads/als-de-muren-konden-spreken/"
        },
        {
          title: "Amsterdam: ambitious building technology on the Herengracht",
          url: "https://openresearch.amsterdam/nl/page/151733/erfgoed-van-de-week-ambitieuze-techniek-op-de-herengracht"
        },
        {
          title: "NIOD: contact and public address",
          url: "https://www.niod.nl/contact-en-bereikbaarheid/"
        }
      ]
    },
    {
      modelId: "multatuli",
      landmarkId: "extract_landmarks_1273422573",
      name: "Multatuli Museum",
      center: [
        52.3774872,
        4.8911258
      ],
      description: "This small house on Korsjespoortsteeg is the birthplace of Eduard Douwes Dekker, better known as Multatuli. His novel Max Havelaar challenged exploitation in the Dutch East Indies, where he had worked as a colonial civil servant. The museum preserves his workplace, furniture and books. The protected house has a bell gable and a memorial stone on its street facade.",
      funFact: "Multatuli also argued for women\u2019s emancipation and voting rights, and for workers\u2019 rights; his campaigns reached beyond the colonial abuses exposed by Max Havelaar.",
      sourceUrl: "https://www.multatuli-museum.nl/museum",
      sourceLinks: [
        {
          title: "Museum and writer",
          url: "https://www.multatuli-museum.nl/museum"
        },
        {
          title: "National monument3133",
          url: "https://monumentenregister.cultureelerfgoed.nl/monumenten/3133"
        },
        {
          title: "Museum entrance at Korsjespoortsteeg20",
          url: "https://www.multatuli-museum.nl/bezoekersinformatie"
        }
      ],
      website: "https://www.multatuli-museum.nl/",
      identityNotes: "Keep existing genuine museum destination; both museum and residence belong to same Pand, no duplicate residential POI."
    },
    {
      modelId: "singelkerk",
      landmarkId: "extract_landmarks_760984505",
      name: "Singelkerk",
      description: "The Singelkerk is a Mennonite hidden church between the Singel and Herengracht. In 1639 a larger church replaced an earlier wooden meeting place on the back lot. Its domestic canal frontage conceals a hall with double galleries on Tuscan columns; the organ case dates from 1777. The Herengracht side was rebuilt around 1840, giving the church its pale facade and open forecourt behind an iron fence. The rebus stone on Singel 452 recalls the reunion of Mennonite congregations in 1801.",
      sourceUrl: "https://www.doopsgezindamsterdam.nl/historie/singelkerk-4/",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/5402",
        "https://www.doopsgezindamsterdam.nl/locaties/"
      ],
      destinationOverride: {
        center: [
          52.36770787,
          4.88862596
        ],
        reason: "Official BAG address point for actual Singel 452; old extract point incorrectly lies on neighboring Singel 454.",
        sourceUrl: "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=Singel%20452%20Amsterdam&fq=type:adres&rows=3"
      }
    },
    {
      landmarkId: "extract_landmarks_736359928",
      name: "Sint-Agneskerk",
      lat: 52.350116,
      lng: 4.857814,
      description: "Jan Stuyt designed this neo-Romanesque basilica as a free interpretation of Sant\u2019Agnese in Rome. Its nave and aisles opened in 1921; the transept, choir and separate Italian-style campanile followed in 1930\u20131932. The church contains an unusually rich collection of twentieth-century religious art, including Joep Nicolas\u2019s opaline glass mosaic in the apse.",
      funFact: "The freestanding campanile and early-Christian basilica plan recall Italian churches. Inside, the apse mosaic uses opaline glass backed with a shining metal layer.",
      sourceUrls: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/505910",
        "https://agneskerk.nl/contact-route/"
      ],
      wikipediaUrl: "https://nl.wikipedia.org/wiki/Sint-Agneskerk_(Amsterdam)",
      modelId: "sint-agneskerk",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/505910"
    },
    {
      name: "Petruskerk",
      description: "The old village church of Sloterdijk has a late-medieval tower inside a nave rebuilt in 1664. Its monumental tombs occupy the spaces between heavy outer buttresses, preserving the churchyard as a remarkable open-air extension of the church.",
      funFact: "Vincent van Gogh\u2019s grandparents married here in 1811. The restored church now hosts weddings and community events among Sloterdijk\u2019s modern offices.",
      sourceUrls: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/6775",
        "https://www.oudsloterdijk.nl/"
      ],
      wikipediaUrl: "https://nl.wikipedia.org/wiki/Petruskerk_(Sloterdijk)",
      landmarkId: "extract_landmarks_800494636",
      lat: 52.386718,
      lng: 4.846343,
      modelId: "petruskerk",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/6775",
      center: [
        52.386718,
        4.846343
      ]
    },
    {
      name: "Boomkerk",
      landmarkId: "extract_landmarks_746878126",
      description: "The neo-Romanesque Church of St Francis of Assisi was designed by P.J. Bekkers in 1910 and completed in 1911. Its Latin-cross basilica, wheel window and three arched portals lead to a tall corner tower beside Van Gentstraat.",
      funFact: "De Boom replaced a concealed Catholic church in the Kalverstraat dating from 1730. Its two old facade stones, paintings, altars and 1774 Hilgers organ were carried into the new church.",
      sourceUrls: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/529085",
        "https://www.rkamsterdamwest.nl/locaties/de-boom"
      ],
      wikipediaUrl: "https://nl.wikipedia.org/wiki/De_Boom_(Amsterdam)",
      lat: 52.3830729,
      lng: 4.8505888,
      entranceSource: "RCE identifies SW three-portal entrance; point derived just outside surveyed front wall toward Admiraal de Ruijterweg",
      modelId: "boomkerk",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/529085",
      center: [
        52.3830729,
        4.8505888
      ],
      destinationOverride: {
        center: [
          52.3830729,
          4.8505888
        ],
        reason: "RCE identifies SW three-portal entrance; point derived just outside surveyed front wall toward Admiraal de Ruijterweg",
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/529085"
      }
    },
    {
      modelId: "w139",
      name: "W139",
      description: "W139 occupies a restored historic complex behind Warmoesstraat139. The former theatre and soci\xEBteit De Vereeniging were once used by Amsterdam\u2019s securities traders; today artists develop ambitious exhibitions here.",
      sourceUrl: "https://w139.nl/en/about/",
      center: [
        52.3737514,
        4.8959885
      ],
      sourceLinks: [
        {
          label: "W139 \u2014 artist-run history",
          url: "https://w139.nl/en/about/"
        },
        {
          label: "Arcam \u2014 architecture and restoration",
          url: "https://arcam.nl/architectuur-gids/w139/"
        },
        {
          label: "Smulders Architecten \u2014 2006\u201307 project",
          url: "https://www.smuldersarchitecten.nl/projecten/w139-amsterdam"
        }
      ]
    },
    {
      modelId: "conservatorium",
      name: "Mandarin Oriental Conservatorium, Amsterdam",
      description: "This hotel began as the Rijkspostspaarbank headquarters, built in 1899\u20131901 by Rijksbouwmeester Dani\xEBl Knuttel. It housed the Sweelinck Conservatorium from 1985 to 2008 before becoming a hotel in 2011. Its modern steel-and-glass atrium contrasts with the preserved brick and stone bank building. Mandarin Oriental adopted its current name in January 2026.",
      sourceUrl: "https://arcam.nl/architectuur-gids/conservatorium-hotel/",
      center: [
        52.35847,
        4.87914
      ],
      website: "https://www.mandarinoriental.com/en/amsterdam/conservatorium",
      sourceLinks: [
        {
          title: "monumentenregister.cultureelerfgoed.nl",
          url: "https://monumentenregister.cultureelerfgoed.nl/monumenten/287"
        },
        {
          title: "arcam.nl",
          url: "https://arcam.nl/architectuur-gids/conservatorium-hotel/"
        },
        {
          title: "press.mandarinoriental.com",
          url: "https://press.mandarinoriental.com/amsterdam-rebranding/?lang=eng"
        }
      ]
    },
    {
      modelId: "kinderkookkafe",
      name: "Kinderkookkaf\xE9",
      description: "Children cook and serve real meals in this caf\xE9, housed in one of the Vondelpark\u2019s former manure sheds. City engineer J.G. van Niftrik designed the paired brick sheds in the 1880s to replace open manure storage; their pointed gables and decorative brickwork give this practical park building an unusually rich silhouette. A glass conservatory was added during its conversion for the caf\xE9.",
      sourceUrl: "https://stadsherstel.nl/monumenten/vondelpark-6b/",
      center: [
        52.3591999,
        4.8647759
      ],
      preferDescription: true
    },
    {
      modelId: "beta-boulders",
      name: "Beta Boulders",
      center: [
        52.3441243,
        4.855954
      ],
      sourceUrl: "https://betaboulders.nl/",
      description: "Beta Boulders combines a climbing gym, fitness space, co-working area and caf\xE9 inside the northern former Citro\xEBn garage beside the Olympic Stadium. Jan Wils designed this maintenance garage separately from the older southern showroom. Its later transformation into The Garage restored the glass curtain wall and connected offices, restaurants and other shared uses along the original car ramp. Beta occupies part of this multi-tenant building.",
      sourceLinks: [
        {
          title: "Beta Boulders: gym, workspace and caf\xE9",
          url: "https://betaboulders.nl/"
        },
        {
          title: "The Olympic tenant directory: Beta Boulders",
          url: "https://theolympicamsterdam.nl/nl/single-company/beta-boulders"
        },
        {
          title: "Rijnboutt: restoration of the northern Citro\xEBn building",
          url: "https://rijnboutt.nl/actueel/nieuws/parool-het-citroengebouw-van-jan-wils-glorieert-weer/"
        }
      ],
      preferDescription: true
    },
    {
      modelId: "beest-boulders",
      name: "Beest Boulders Amsterdam",
      description: "Beest Boulders Amsterdam occupies a converted industrial hall on Willem de Zwijgerlaan. Its broad curved roof and pale corrugated walls belong to a much longer shared factory complex. Bouldering uses short climbing routes over landing mats rather than ropes; the venue renews part of its routes weekly and also has a restaurant. This Amsterdam venue is separate from Het Lab on Transformatorweg.",
      sourceUrl: "https://beestboulders.com/beest-boulders-amsterdam/",
      center: [
        52.3816671,
        4.8593849
      ],
      preferDescription: true,
      destinations: [
        {
          landmarkId: "n3974788355",
          name: "Padel NEXT",
          center: [
            52.3817412,
            4.8592628
          ],
          description: "Padel NEXT is the indoor padel venue at Willem de Zwijgerlaan 338C. Its Americano tournaments rotate partners and opponents, so participants play with and against one another rather than staying in a fixed pair.",
          sourceUrl: "https://padelnext.nl/",
          preferDescription: true
        }
      ]
    },
    {
      modelId: "klimmuur-centraal",
      name: "Klimmuur Centraal",
      description: "Klimmuur Centraal is the climbing hall on Dijksgracht beside Oosterdok. Its sharply sloping shell contains a hall over16metres tall. A folding steel-and-glass climbing wall lets the climbing activity face the waterfront terrace. The waterfront glass wall is itself climbable: its four folding elements carry holds and can slide aside. The architect used electromagnets to secure the doors while people climb.",
      sourceUrl: "https://www.nationalestaalprijs.nl/project/klimwand",
      center: [
        52.3766271,
        4.9115779
      ],
      preferDescription: true
    },
    {
      modelId: "mountain-network",
      name: "Climbing Center Amsterdam (Mountain Network)",
      description: "Climbing Center Amsterdam, formerly Mountain Network Amsterdam, occupies the pale corner tower of De Tribune at Erasmusgracht 297. Its operator lists 15-metre climbing walls, 200 m\xB2 of bouldering space and an outdoor toprope wall. The 2011 complex by Claus en Kaan combines housing and sport facilities. Dark steel-and-glass ribbons on the motorway side form a sound screen for Laan van Spartaan; the city side has light brick, balconies, rounded corners and stepped heights.",
      sourceUrl: "https://www.climbingnetwork.nl/indoor/locatie/climbingcenter-amsterdam",
      center: [
        52.375078,
        4.842064
      ],
      preferDescription: true,
      destinationOverride: {
        center: [
          52.375078,
          4.842064
        ],
        sourceUrl: "https://www.climbingnetwork.nl/indoor/locatie/climbingcenter-amsterdam",
        reason: "Source-supported northern public entrance outside surveyed tower boundary; genuine mapped node identity retained."
      }
    },
    {
      modelId: "keith-haring-mural",
      landmarkId: "n9021384965",
      name: "Muurschildering van Keith Haring",
      lat: 52.3804742,
      lng: 4.8645934,
      category: "artwork",
      sourceUrl: "https://www.amsterdam.nl/stadsdelen/west/nieuws/fantasiebeest-keith-haring/",
      description: "Keith Haring painted this 15-by-12-metre fantasy animal and its rider on the west wall of the Koelhuis in 1986, during his Stedelijk Museum exhibition. The rider carries an Amsterdam St Andrew\u2019s cross. This mostly windowless 1935 cold-storage building later held museum collections. Metal cladding hid the work until 2018; restoration followed in 2020. It is on the former museum depot, north of the Centrale Markthal, and can be viewed across the water from Willem de Zwijgerlaan.",
      sources: [
        {
          label: "Amsterdam municipality current mural history",
          url: "https://www.amsterdam.nl/stadsdelen/west/nieuws/fantasiebeest-keith-haring/"
        },
        {
          label: "Koelhuis architectural history and1933 elevations",
          url: "https://amsterdamopdekaart.nl/1850-1940/Centrale_Groothandelsmarkt/Koelhuis"
        },
        {
          label: "Current2023 west elevation, Alfvanbeem CC0 photograph",
          url: "https://commons.wikimedia.org/wiki/File:Keith_Haring_Muurschildering,_Amsterdam.jpg"
        }
      ],
      identityNote: "Genuine OSM artwork node9021384965, wikidataQ55372120. New researched artwork destination, separate from Centrale Markthal. Physical building click card must map replaced Pand to this artwork.",
      center: [
        52.3804742,
        4.8645934
      ],
      artworkCenter: [
        52.3804742,
        4.8645934
      ],
      integrationNote: "Preserve center as actual mural node; use routeDestination.center only for public viewing arrival via routeCenter plumbing.",
      additionalSources: [
        "https://amsterdamopdekaart.nl/1850-1940/Centrale_Groothandelsmarkt/Koelhuis",
        "https://commons.wikimedia.org/wiki/File:Keith_Haring_Muurschildering,_Amsterdam.jpg"
      ],
      routeDestination: {
        center: [
          52.3802778,
          4.8619444
        ],
        sourceUrl: "https://nl.wikipedia.org/wiki/Muurschildering_van_Keith_Haring",
        reason: "Wikipedia explicitly identifies coordinate as public viewing spot, at Willem de Zwijgerlaan near Karel Doormanstraat. Preserve actual artwork pin at host."
      }
    },
    {
      modelId: "valley",
      name: "Valley",
      sourceUrl: "https://www.mvrdv.com/projects/233/valley-t",
      description: "Valley is MVRDV\u2019s mixed-use Zuidas complex, opened in 2022. Three towers rise 67, 81 and 100 metres around an elevated public valley. Its smooth outer glass skin contrasts with jagged limestone apartments and cantilevered terraces planted by landscape designer Piet Oudolf.",
      sourceUrls: [
        "https://www.mvrdv.com/projects/233/valley-t",
        "https://zuidas.nl/construction-project/valley/",
        "https://valley.nl/en/contact/"
      ],
      center: [
        52.3378633,
        4.8772123
      ],
      destinationOverride: {
        center: [
          52.3378633,
          4.8772123
        ],
        sourceUrl: "https://www.openstreetmap.org/way/1097646403",
        reason: "Ground end of current access=yes northwestern public steps; original OSM incline=down node order and architect public-valley description."
      }
    },
    {
      id: "extract_landmarks_1741957518",
      name: "NDSM-loods",
      type: "landmark",
      cityId: "amsterdam",
      center: [
        52.401019,
        4.895504
      ],
      description: "The former NDSM shipbuilding warehouse contains a six-bay longitudinal hall and a transverse hall that once held the mould loft. Its riveted steel framework, roof lights and enormous blue doors survive from the shipyard. Today Stichting Kinetisch Noord manages it as a centre for art, design and crafts: the Kunststad contains around85 studios with more than250 makers. The outdoor shipyard has a separate operator, Stichting NDSM-werf.",
      funFact: "The warehouse was brought into use in1922\u20131923. Artists now build their own studio spaces inside the former steel-plate workshop.",
      sourceUrls: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/528251",
        "https://www.ndsmloods.nl/bezoek/ndsm-loods/",
        "https://www.ndsmloods.nl/english/"
      ],
      website: "https://www.ndsmloods.nl/",
      identityNotes: "Genuine existing extract destination retained; Kunststad, NDSM Loods and Scheepsbouwloods are names for this shared physical hall, not duplicate destinations. Existing tenant identities should remain selectable where genuine.",
      modelId: "ndsm-warehouse-complex",
      sourceUrl: "https://www.ndsmloods.nl/bezoek/ndsm-loods/",
      preferDescription: true
    },
    {
      name: "MidWest",
      landmarkId: "w119042875",
      description: "This Amsterdam School building was designed in 1924 as two primary schools sharing a gymnasium. Its classroom windows face the inner gardens, while sculptural almost blind ends address the streets; two slender towers mark the Cabralstraat entrance. The former gym is now a neighborhood canteen, retaining its gym floor, rings and climbing equipment. MidWest began using the building in 2012 and bought it in 2016, restoring historic details and turning its playgrounds into gardens that store rainwater.",
      funFact: "The former gym is now a neighborhood canteen, retaining its gym floor, rings and climbing equipment. MidWest began using the building in 2012 and bought it in 2016, restoring historic details and turning its playgrounds into gardens that store rainwater.",
      sourceUrls: [
        "https://www.inmidwest.nl/cabralstraat-1-het-monument/",
        "https://www.inmidwest.nl/contact/",
        "https://items.amsterdamse-school.nl/details/objects/630"
      ],
      modelId: "midwest",
      center: [
        52.36966835140684,
        4.854636936174082
      ],
      destinationOverride: {
        center: [
          52.36966835140684,
          4.854636936174082
        ],
        sourceUrl: "https://www.inmidwest.nl/contact/",
        reason: "Cabralstraat1 public entrance between source-observed twin towers on native surveyed west edge; avoid inaccessible school courtyard centroid."
      },
      sourceUrl: "https://www.inmidwest.nl/cabralstraat-1-het-monument/"
    },
    {
      modelId: "nikolaas-myrakerk",
      landmarkId: "extract_landmarks_2003244540",
      name: "Heilige Nikolaas van Myrakerk",
      description: "The Tichelkerk was built in 1912 as the Capuchins\u2019 Sint-Antoniuskerk and monastery. The Orthodox Nikolaas parish acquired the complex in 2004\u20132005. Its modest canal-side entrance leads into an open courtyard, while the long Romanesque church facade lines Tichelstraat. The former Capuchin church and monastery were largely built by the friars themselves; the complex became home to the Orthodox Nikolaas parish in 2005.",
      sourceUrl: "https://orthodox-amsterdam.nl/wie-wijzijn/",
      additionalSources: [
        "https://amsterdamopdekaart.nl/1850-1940/Tichelstraat/Tichelkerk",
        "https://www.raadvankerken.nl/nieuws/2012/08/100-jaar-tichelkerk/"
      ]
    },
    {
      modelId: "naco-house",
      landmarkId: "extract_landmarks_1769455774",
      name: "NACO-house",
      funFact: "This timber shipping office was designed by G.F. la Croix in 1919. Its projecting pointed roof mixes Amsterdam School architecture with Indonesian influences. Moved to Zaandam in 2004 for the expansion of Centraal Station, it returned to Amsterdam on 13 December 2021 after restoration.",
      sourceUrl: "https://stadsherstel.nl/monumenten/de-ruijterkade-naco-huisje/",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/518409"
      ]
    },
    {
      modelId: "jeruzalemkerk",
      landmarkId: "extract_landmarks_2017340658",
      name: "Jeruzalemkerk",
      funFact: "Ferdinand B. Jantzen designed this Amsterdam School church, opened in1929, as one ensemble with its attached corner apartments. The stepped cubic brick volumes and squat bell tower frame three entrances. Its stained-glass program moves from Creation to Paradise and the heavenly Jerusalem, and Jantzen designed the original interior fittings as well.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/527155",
      additionalSources: [
        "https://www.jeruzalem-kerk.nl/ons-gebouw/uniek-monument/"
      ]
    },
    {
      modelId: "blauwe-theehuis",
      name: "Blauwe Theehuis",
      description: "The pavilion combines an eight-pointed ground-floor plan with a twelve-sided upper room, an open circular roof crown and a terrace carried by twelve blue steel columns. The Baanders brothers designed it in the Nieuwe Bouwen style; it opened in 1937 after the previous tea house burned down.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/504760",
      center: [
        52.358848,
        4.87258
      ],
      additionalSources: [
        {
          title: "RCE monument 504760",
          url: "https://monumentenregister.cultureelerfgoed.nl/monumenten/504760"
        },
        {
          title: "Brouwerij \u2019t IJ \u2014 Blauwe Theehuis",
          url: "https://brouwerijhetij.nl/en/tasting-rooms/t-blauwe-theehuis"
        }
      ]
    },
    {
      modelId: "groot-melkhuis",
      name: "Groot Melkhuis",
      description: "This caf\xE9 began as a farm in 1874, selling fresh milk from cows grazing where Festina\u2019s tennis courts now stand. Park maintenance was partly funded by its rent. The present house gained its surrounding ground-floor extensions in 1938.",
      sourceUrl: "https://grootmelkhuis.nl/historie/",
      center: [
        52.3585441,
        4.8684443
      ],
      additionalSources: [
        {
          title: "Groot Melkhuis history",
          url: "https://grootmelkhuis.nl/historie/"
        }
      ]
    },
    {
      modelId: "beest-het-lab",
      name: "Beest Boulders Het Lab",
      description: "Het Lab is a bouldering hall at Transformatorweg32 in a former industrial warehouse. Bouldering uses short climbing routes above landing mats, without ropes. The converted hall combines climbing walls, a training area and a cafe; its brick exterior, clerestory glazing and sawtooth factory roof retain the industrial character of Sloterdijk. Het Lab and the larger Beest Boulders Amsterdam are separate venues.",
      sourceUrl: "https://beestboulders.com/boulderen/het-lab-amsterdam/",
      center: [
        52.392268,
        4.8512397
      ],
      additionalSources: [
        {
          title: "Operator: Het Lab Amsterdam",
          url: "https://beestboulders.com/boulderen/het-lab-amsterdam/"
        },
        {
          title: "I amsterdam: Amsterdam bouldering venues",
          url: "https://www.iamsterdam.com/en/see-and-do/nature-and-active/climbing-and-bouldering-in-amsterdam"
        }
      ]
    },
    {
      modelId: "kesbeke",
      name: "Kesbeke Fijne Tafelzuren",
      description: "This factory was designed by H. Tuininga in 1948 for machinery maker Joh. Moes & Zonen. Brick crosses and large yellow Kesbeke lettering distinguish the office from the low production halls. Kesbeke moved here in 1977 after starting in a Waterlooplein cellar.",
      sourceUrl: "https://amsterdamopdekaart.nl/wederopbouw/Adolf_van_Nassaustraat/2",
      preferDescription: true,
      center: [
        52.38287280299574,
        4.857204443898143
      ],
      routeDestination: {
        center: [
          52.38287280299574,
          4.857204443898143
        ],
        sourceUrl: "https://amsterdamopdekaart.nl/wederopbouw/Adolf_van_Nassaustraat/2",
        note: "Public street immediately outside the source-observed west office entrance; RD118915.32/488466.48, one metre outward from surveyed facade."
      }
    },
    {
      modelId: "kesbeke-shop",
      name: "Kesbeke Zoet & Zuur winkel",
      center: [
        52.3828246,
        4.8567913
      ],
      description: "Kesbeke\u2019s shop at Adolf van Nassaustraat 3 faces the family\u2019s pickle factory. Alongside its Amsterdam pickles and other preserved vegetables, the shop sells oils, cheeses and accompaniments for the table.",
      sourceUrl: "https://www.kesbeke.nl/ons-winkeltje/",
      preferDescription: true
    },
    {
      modelId: "ndsm-container-arch",
      landmarkId: "osm_w1304785589",
      name: "De Containerboog",
      longitude: 4.894597625,
      latitude: 52.401558625,
      description: "Nine shipping containers form this open arch on the NDSM shipyard. It began as a DGTL festival installation in 2018 and became a changing canvas for public art. Gabi Brunhoso\u2019s FIRESTARTER is the operator-listed artwork from 3 April 2026 to 3 April 2027, commissioned by Stichting NDSM-werf with DGTL. Earlier commissions include SEEYOUSIOE\u2019s EMPOWER (2024) and VAAF\u2019s The only way is up (2025).",
      sourceUrl: "https://www.ndsm.nl/en/magazine/de-verschillende-jasjes-van-de-icoontainerboog",
      additionalSources: [
        "https://www.ndsm.nl/en/kunst/firestarter",
        "https://www.ndsm.nl/en/kunst/the-only-way-is-up",
        "https://www.ndsm.nl/magazine/interview-seeyousioe-over-hun-werk-empower"
      ],
      identityNote: "Genuine OSM artwork way1304785589; no existing extract landmark found. Root must preserve this identity across route/pin/card; no aliases of NDSM-loods or STRAAT."
    },
    {
      modelId: "wine-guildhall",
      landmarkId: "extract_landmarks_1958595244",
      name: "Wine buyers\u2019 guildhall",
      description: "The triple neck-gabled front on Koestraat joins three houses that were combined in 1611. The wine buyers purchased the property in 1630 and divided it in 1633: the right half became their guildhall, with a hall behind it, while the other half remained a separate residence. Pieter de Keyser designed the stone entrance, whose pediment depicts Saint Urbanus, patron of vineyard workers. The present neck-shaped tops were reconstructed, and the interior arrangement changed during restoration. Purchases by wine merchant Jacobus Boelen in 1917\u20131918 helped inspire the founding of Vereniging Hendrick de Keyser.",
      sourceUrl: "https://www.hendrickdekeyser.nl/de-huizen/wijnkopersgildehuis",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/3051"
      ]
    },
    {
      modelId: "the-rock",
      landmarkId: "osm-way-52156815",
      name: "The Rock",
      center: [
        52.33746770593688,
        4.8704548554961224
      ],
      sourceUrl: "https://therock-zuidas.nl/",
      description: "Erick van Egeraat designed The Rock as a dramatic transition from a transparent glass base to a heavy natural-stone crown. Shifted volumes and irregular openings give the 90-metre office tower a different profile from every angle. The owner dates completion to 2009. A renovation began in late 2024, with entrances on Claude Debussylaan and the north side facing the future Brittenpassage at Amsterdam Zuid.",
      sourceLinks: [
        {
          title: "The Rock: current building owner and architectural materials",
          url: "https://therock-zuidas.nl/"
        },
        {
          title: "City of Amsterdam Zuidas: tower design and renovation",
          url: "https://zuidas.nl/construction-project/the-rock/"
        },
        {
          title: "Owner brochure: ground-floor entrances (page 8)",
          url: "https://therock-zuidas.nl/files/images/content/downloads/The%20Rock%20%20Amsterdam%20brochure.pdf"
        },
        {
          title: "City of Amsterdam: renovation announced October 2024",
          url: "https://zuidas.nl/blog/2024/10/07/the-rock-keert-zich-naar-de-toekomst/"
        }
      ],
      pinNotes: "Approximate southeast street-contact point scaled from the owner\u2019s 2025 brochure ground-floor plan, page 8, using the surveyed BAG outline. Entrance symbol faces Claude Debussylaan; exact installed threshold and route reachability remain unverified. Not a surveyed door coordinate.",
      destinationOverride: {
        center: [
          52.33746770593688,
          4.8704548554961224
        ],
        sourceUrl: "https://therock-zuidas.nl/",
        reason: "Approximate southeast street-contact point scaled from the owner\u2019s 2025 brochure ground-floor plan, page 8, using the surveyed BAG outline. Entrance symbol faces Claude Debussylaan; exact installed threshold and route reachability remain unverified. Not a surveyed door coordinate."
      }
    },
    {
      id: "n2817982961",
      name: "RAI Amsterdam",
      description: "The RAI exhibition complex opened at Europaplein in 1961. Alexander Bodon\u2019s Europahal and Het Signaal are protected as a national monument. The Westhal followed in 1963 and Amstelhal in 1969; those additions share the present campus but have distinct construction periods. Benthem Crouwel\u2019s Elicium, added in 2009, links the halls above an open ground-level circulation area.",
      sources: [
        {
          title: "RAI contact and public address",
          url: "https://www.rai.nl/contact"
        },
        {
          title: "Benthem Crouwel \u2014 RAI Elicium",
          url: "https://www.benthemcrouwel.com/projects/rai-elicium"
        },
        {
          title: "National monument 532206 \u2014 Europahal and Het Signaal",
          url: "https://monumentenregister.cultureelerfgoed.nl/monumenten/pdf/532206"
        },
        {
          title: "Amsterdam municipal RAI construction history \u2014 page 106",
          url: "https://openresearch.amsterdam/image/2024/11/18/van_rai_complex_naar_rai_district.pdf"
        }
      ],
      identityNote: "Genuine OSM main exhibition-centre n2817982961; distinct RAI Theater retained. Scoped modeled compound includes source-labeled Westhal1963 and Amstelhal1969, not the entire campus.",
      modelId: "rai-amsterdam",
      sourceUrl: "https://www.rai.nl/contact",
      center: [
        52.3412264,
        4.8899065
      ]
    },
    {
      modelId: "pulitzer-amsterdam",
      landmarkId: "osm-node-331630133",
      name: "Pulitzer Amsterdam",
      osmId: "n331630133",
      wikidata: "Q4500456",
      center: [
        52.37282921590418,
        4.883288222258304
      ],
      lngLat: [
        4.883288222258304,
        52.37282921590418
      ],
      buildingIds: [
        "NL.IMBAG.Pand.0363100012169022",
        "NL.IMBAG.Pand.0363100012169021"
      ],
      description: "Peter Pulitzer began turning canal houses into a hotel in 1970. Today Pulitzer links 25 historic houses around gardens between the Prinsengracht and Keizersgracht. Its street fronts retain their individual identities, including the sandstone Saxenburg house and former warehouses; the black Prinsengracht entrance dates from the 2016 renovation.",
      sourceUrl: "https://www.pulitzeramsterdam.com/nl/over-het-hotel/onze-geschiedenis/",
      sourceUrls: [
        "https://www.pulitzeramsterdam.com/nl/over-het-hotel/onze-geschiedenis/",
        "https://www.pulitzeramsterdam.com/media/tj3ixoce/floorplan-capacity-chart-2024.pdf",
        "https://www.amsterdamsebinnenstad.nl/binnenstad/277/kindertekening-pulitzer.php",
        "https://amsterdam-monumentenstad.nl/database/grachtenboek_objecten.php?id=128"
      ],
      destinationPinSource: "Source-address Prinsengracht323 publicentrance positioned on the current surveyed principal front-edge midpoint, rather than the indoor hotelPOI node or the inaccessible compound centroid.",
      preserveDistinctDestination: "Jansz/PulitzersBar share existing hotelmesh; do not manufacture destinations for housealiases or secondarymeshparts.",
      destinationOverride: {
        center: [
          52.37282921590418,
          4.883288222258304
        ],
        sourceUrl: "https://www.pulitzeramsterdam.com/en/about-us/",
        reason: "Source principal hotel entrance Prinsengracht323 on surveyed frontage; retained genuine hotel OSM identity."
      }
    },
    {
      modelId: "de-gooyer",
      landmarkId: "extract_landmarks_33057057",
      osmId: "n33057057",
      name: "De Gooyer",
      coordinates: [
        4.9261523,
        52.3667975
      ],
      description: "De Gooyer is the Netherlands\u2019 tallest wooden windmill. Its octagonal grain mill was built around 1725 and moved here in 1814 after a barracks obstructed its wind. It stands on the raised square brick base of a former city water mill. The gallery is 17.8 metres above ground and the sails span 26.6 metres. Brouwerij \u2019t IJ occupies the separate former bathhouse next door.",
      sourceUrl: "https://stadsherstel.nl/monumenten/funenkade-5-molen-de-gooyer/",
      additionalSources: [
        "https://www.molens.nl/ontdek-molens/alle-molens/de-gooyer-te-amsterdam",
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/1107"
      ],
      locationNote: "Exterior viewing destination. Geographic pin uses genuine mapped mill node n33057057; route finish uses public Funenkade pedestrian/footway junction n1450614806 north of the mill, not its inaccessible interior. Confirm chosen destination and failure behavior in live route.",
      destinationCoordinates: [
        4.9261089,
        52.3669
      ],
      destinationEvidence: {
        sourceUrl: "https://www.openstreetmap.org/way/146834049",
        cachedSource: "models/de-gooyer/files/osm-map.xml",
        wayIds: [
          "w146834049",
          "w136179600"
        ],
        nodeId: "n1450614806",
        tags: "highway=pedestrian meets highway=footway; name=Funenkade",
        status: "Source-supported public outdoor approach; not represented as an indoor mill entrance"
      },
      center: [
        52.3667975,
        4.9261523
      ],
      destinationOverride: {
        center: [
          52.3669,
          4.9261089
        ],
        sourceUrl: "https://stadsherstel.nl/monumenten/funenkade-5-molen-de-gooyer/",
        reason: "Source-backed public exterior viewing point."
      }
    },
    {
      id: "extract_landmarks_2781756860",
      name: "Former Nieuw Dakota",
      osmId: "n2781756860",
      osmType: "node",
      coordinates: [
        4.8920341,
        52.4004374
      ],
      destinationCoordinates: [
        4.89194,
        52.400438
      ],
      website: "https://www.nieuwdakota.com/",
      description: "Nieuw Dakota was an independent exhibition space for contemporary art on the NDSM wharf. Founded in 2009, it presented experimental exhibitions and performances for fifteen years. Its owner says the venue closed to the public in January 2025 while exploring a restart; this destination marks the former venue\u2019s exterior.",
      facts: [
        {
          text: "The organization says Nieuw Dakota is currently not accessible to the public and closed its public doors from January 2025.",
          source: "https://www.nieuwdakota.com/nl/steun-ons/"
        },
        {
          text: "Founded in 2009, Nieuw Dakota offered experimental exhibitions, performances, tours and educational activities on the NDSM wharf.",
          source: "https://www.nieuwdakota.com/nl/over/"
        }
      ],
      identityNotes: {
        bagPand: "0363100012064117",
        osmBuilding: "w280620202",
        osmPOI: "n2781756860",
        canonicalPOI: "extract_landmarks_2781756860",
        sharedMappedPlace: "n2781756856",
        sharedVBO: "0363010011872205",
        relationship: "41B former Nieuw Dakota shares one current physical Pand with41A mappedVous Etes Ici. Current photo has Beautiful Distress House paint on northern gable; active tenant identity not inferred from old OSM label or paint. Preserve both separate physical fronts and entrances. No duplicate physical asset or invented compound destination."
      },
      preserveExistingFacts: true,
      destinationReason: "West public street by former Nieuw Dakota door, not inside private warehouse; route-check necessary. Explicit requested former venue, not advertised as open museum.",
      integrationState: "Genuine mapped shop-art node absent current landmark extract. Promote same identity with honest former/closure card. Retain mapped41A place and separate door; no second asset or invented host destination.",
      modelId: "nieuw-dakota",
      landmarkId: "extract_landmarks_2781756860",
      sourceUrl: "https://www.nieuwdakota.com/nl/over/",
      center: [
        52.4004374,
        4.8920341
      ],
      destinationOverride: {
        center: [
          52.400438,
          4.89194
        ],
        sourceUrl: "https://www.nieuwdakota.com/nl/over/",
        reason: "West public street by former Nieuw Dakota door, not inside private warehouse; route-check necessary. Explicit requested former venue, not advertised as open museum."
      }
    },
    {
      modelId: "pllek",
      landmarkId: "n4913392670",
      name: "Pllek",
      center: [
        52.399077,
        4.893322
      ],
      sourceUrl: "https://pllek.nl/",
      description: "Pllek combines a restaurant, live music and cultural events on the NDSM waterfront. Reused shipping containers frame two curved red-roofed halls with large windows facing the IJ. Outside, its sandy city beach continues the former shipyard\u2019s tradition of inventive reuse. The restaurant emphasizes plant-based food and seasonal ingredients.",
      sourceLinks: [
        {
          title: "Pllek: restaurant and cultural program",
          url: "https://pllek.nl/"
        },
        {
          title: "NDSM: waterfront cultural district",
          url: "https://www.ndsm.nl/"
        }
      ],
      genuineOsmIdentity: "n4913392670",
      destinationPinNotes: "Public east-side entrance approach; root verify chosenroutefinish,manualpin and physicalclickcard.",
      id: "n4913392670"
    },
    {
      modelId: "monk-amsterdam",
      landmarkId: "extract_landmarks_2270458123",
      name: "Monk Amsterdam",
      center: [
        52.38347556,
        4.92940658
      ],
      genuineOsmIdentity: "n2270458123",
      sourceUrl: "https://monk.nl/amsterdam/",
      description: "Monk Amsterdam is a bouldering gym on the IJ waterfront in Amsterdam Noord. Its climbing walls occupy part of a large industrial factory compound; the black corrugated facade, tall workshop doors and upper glazing retain the building\u2019s working character. The gym combines climbing with a waterside caf\xE9 and terrace.",
      sourceLinks: [
        {
          title: "Monk Amsterdam: climbing and waterfront caf\xE9",
          url: "https://monk.nl/amsterdam/"
        }
      ],
      destinationPinNotes: "Public entrance Aambeeldstraat26; coordinate from BAG VBO. Root preserve actual existing extract identity if found, do not create duplicate alias."
    },
    {
      id: "extract_landmarks_6741685223",
      name: "STRAAT Museum",
      osmId: "n6741685223",
      osmType: "node",
      coordinates: [
        4.8938542,
        52.4019462
      ],
      destinationCoordinates: [
        4.8936,
        52.40181
      ],
      destinationReason: "Public southwest office/mural entrance approach; coordinator must route-check surveyed position. Centroid inside large closed industrial hall is not the public entrance.",
      website: "https://straatmuseum.com/",
      description: "STRAAT presents street art and graffiti inside the former NDSM welding hall. This Lasloods is a separate monument from the adjoining NDSM shipbuilding warehouse. Its huge two-aisle industrial interior retains the steel structure of the shipyard.",
      facts: [
        {
          text: "Built in 1952 to designs by J.D. and A.E.G. Postma, the welding hall has closed brick walls, blue loading doors and four flattened roof-light strips.",
          source: "https://monumentenregister.cultureelerfgoed.nl/monumenten/528252"
        },
        {
          text: "Eduardo Kobra\u2019s Anne Frank mural, Let Me Be Myself, marks the outside of the museum.",
          source: "https://www.straatmuseum.com/collectie/let-me-be-myself"
        },
        {
          text: "The museum occupies the former welding hall; STRAAT Caf\xE9 overlooks its exhibition from upper levels.",
          source: "https://www.straatmuseum.com/faq"
        }
      ],
      identityNotes: {
        osmBuilding: "w717827611",
        osmPOI: "n6741685223",
        bagPand: "0363100012079735",
        rceMonument: "528252",
        rceComplex: "528250",
        canonicalPOI: "extract_landmarks_6741685223",
        existingNDSMPoi: "extract_landmarks_1741957518",
        relationship: "Lasloods is a separate physical Pand from NDSM-loods/Scheepsbouwloods. STRAAT genuine museum POI occupies Lasloods; no duplicate destination for hall/office. Three VBOs share host; no inference that each is a new tenant POI."
      },
      preserveExistingFacts: true,
      integrationState: "Genuine OSM museum node absent current landmark extract; coordinator must promote same identity, not duplicate NDSM-loods destination. No alias destination for Lasloods or office.",
      modelId: "straat-museum",
      landmarkId: "extract_landmarks_6741685223",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/528252",
      center: [
        52.4019462,
        4.8938542
      ],
      destinationOverride: {
        center: [
          52.40181,
          4.8936
        ],
        sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/528252",
        reason: "Public southwest office/mural entrance approach; coordinator must route-check surveyed position. Centroid inside large closed industrial hall is not the public entrance."
      }
    },
    {
      modelId: "treehouse-ndsm",
      landmarkId: "w1163404107",
      name: "Treehouse NDSM",
      center: [
        52.399698,
        4.893228
      ],
      sourceUrl: "https://www.treehousendsm.com/",
      description: "Treehouse NDSM is a creative studio village built from reused shipping containers and cabins on the former shipyard. More than 100 studios share exhibition and performance space, workshops, a courtyard and a terrace. The incubator asks residents to engage with the public through exhibitions, concerts and open studios; the container lanes form a small working neighborhood inside the NDSM cultural district.",
      sourceLinks: [
        {
          title: "Treehouse: studios and community",
          url: "https://www.treehousendsm.com/pages/concept-story"
        },
        {
          title: "NDSM: Treehouse studio village",
          url: "https://www.ndsm.nl/en/locaties/treehouse-ndsm"
        }
      ],
      genuineOsmIdentity: "w1163404107",
      destinationPinNotes: "Northeasternpublicapproach Treehouseentrance,notcenterofprivatecourtyard. Rootroute/clickverify.",
      id: "w1163404107"
    },
    {
      id: "extract_landmarks_620869345",
      name: "De Vondeltuin",
      center: [
        52.35492528,
        4.85651048
      ],
      type: "landmark",
      cityId: "amsterdam",
      funFact: "Amsterdam\u2019s first circular municipal building opened here in2020. DOOR architecten drew inspiration from the neighboring Batak-style hut and used roof shingles made from Amsterdam trees, reused window-frame hardwood and a floor recovered from a gymnasium.",
      description: "A timber pavilion with two offset roofs, glass gable ends and projecting wooden sunshades beside Vondelpark\u2019s playground.",
      website: "https://devondeltuin.nl/",
      sources: [
        {
          title: "DOOR architecten \u2014 Vondeltuin",
          url: "https://doorarchitecten.nl/portfolio/horecapaviljoen-vondeltuin-gemeente-amsterdam/"
        }
      ],
      sourceIdentity: "Existing mapped caf\xE9 node n620869345 absent landmark extract; coordinator promote genuine node once.",
      modelId: "vondeltuin",
      landmarkId: "extract_landmarks_620869345",
      sourceUrl: "https://doorarchitecten.nl/portfolio/horecapaviljoen-vondeltuin-gemeente-amsterdam/"
    },
    {
      id: "manual_centrale_markthal",
      name: "Centrale Markthal",
      category: "building",
      coordinates: [
        4.86579375,
        52.37877065
      ],
      description: "Designed by municipal architect Nicolaas Lansdorp in1932 and completed in1934, the Centrale Markthal brought Amsterdam\u2019s wholesale produce trade into one central hall. Its sixteen steel frames span the open interior without intermediate columns, while transverse roof lights illuminate the market floor. The yellow-brick exterior combines loading doors, projecting offices and long rows of steel-framed windows. The original northeast clock tower has been demolished.",
      facts: [
        "The hall was served by both the eastern and western market canals; its original docking inlets were later filled.",
        "The steel roof structure spans the large undivided market floor; the exterior was designed in businesslike Expressionist style."
      ],
      sources: [
        {
          title: "RCE monument526739",
          url: "https://monumentenregister.cultureelerfgoed.nl/monumenten/526739"
        },
        {
          title: "Centrale Markthal history",
          url: "https://centralemarkthal.nl/the-building/the-past/"
        },
        {
          title: "Museum Het Schip architectural photographs",
          url: "https://items.amsterdamse-school.nl/details/objects/900"
        }
      ],
      integrationNotes: "No matching genuine identity found in current extract landmarks; coordinator must add one explicit manual POI destination, geographic label and meaningful card. Centroid is draft pin; verify accessible sourced public entrance and route reachability before acceptance.",
      modelId: "centrale-markthal",
      landmarkId: "manual_centrale_markthal",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/526739",
      center: [
        52.37877065,
        4.86579375
      ]
    },
    {
      id: "extract_landmarks_953524097",
      name: "Rasphuispoort",
      funFact: "The sandstone gate on Heiligeweg survives from the Rasphuis, where prisoners rasped brazilwood into powder for red textile dye. Its 1603 portal is attributed, with uncertainty, to Hendrick de Keyser; the crowning figures were added later. Today it leads into the Kalverpassage.",
      description: "A surviving prison gate with sandstone half-columns, a cart-and-keeper relief and a later group of three figures. The historic gate dates from 1603; the surrounding shopping complex is a separate BAG building registered as 1997.",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Rasphuis",
      sourceUrls: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/1482",
        "https://www.amsterdam-monumentenstad.nl/database/grachtenboek_objecten.php?id=4151",
        "https://commons.wikimedia.org/wiki/File:De_Rasphuispoort_aan_de_Heiligeweg_(2020).jpg"
      ],
      sourceNotes: "Preserve existing genuineextract identity and its researched prison/dyework facts. Namegate independentlyof wikidataQ1460467(prison); gateQ2307025 is architecturalrelatedidentity, not a newdestination.",
      modelId: "rasphuispoort",
      landmarkId: "extract_landmarks_953524097",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/1482"
    }
  ];

  // src/canalRecall/game/manualPoiCatalog.ts
  var supplemental = new Map(manual_poi_data_default.map((fact) => [fact.modelId, fact]));
  function mergeManualPoiFeatures(features, cityId = "amsterdam") {
    if (cityId !== "amsterdam") return [...features];
    const merged = new Map(features.map((feature) => [feature.id, { ...feature }]));
    for (const model of SIGNATURE_MODELS) {
      const fallback = supplemental.get(model.id);
      const anchor = model.surveyed?.anchor ?? model.footprint?.centre;
      if (!anchor) continue;
      const ids = [model.landmarkId, ...model.relatedLandmarkIds ?? []].filter(Boolean);
      const destinations = model.destinationLandmarkIds ?? (model.id === "muziekgebouw-bimhuis" ? ids : ids.slice(0, 1));
      for (const id of destinations) {
        const venue = fallback?.destinations?.find((p) => p.landmarkId === id);
        const specific = venue ?? fallback;
        const existing = merged.get(id);
        merged.set(id, {
          ...existing,
          id,
          name: existing?.name || specific?.name || model.name,
          // Explicit sourced corrections fix mislabeled neighbors or use a public entrance.
          center: specific?.destinationOverride?.center ?? existing?.center ?? specific?.center ?? [anchor[1], anchor[0]],
          routeCenter: venue?.routeDestination?.center ?? (id === model.landmarkId ? fallback?.routeDestination?.center : void 0) ?? existing?.routeCenter,
          type: existing?.type || "landmark",
          // Opt-in researched descriptions can improve generic address summaries while retaining extract history.
          funFact: existing?.funFact || specific?.funFact || (specific?.preferDescription || !existing?.wikipediaExtract ? specific?.description : void 0),
          sourceUrl: (!existing?.funFact && specific?.funFact ? specific?.sourceUrl : existing?.sourceUrl) || specific?.sourceUrl || model.attribution.sourceUrl,
          researchSourceUrl: specific?.sourceUrl || existing?.researchSourceUrl,
          researchDetail: specific?.funFact || specific?.description || existing?.researchDetail,
          manualPoi: true,
          modelId: model.id,
          buildingIds: [.../* @__PURE__ */ new Set([...existing?.buildingIds ?? [], ...model.suppressOsmIds ?? []])],
          prominenceScore: Math.max(existing?.prominenceScore ?? 0, 220)
        });
      }
      if (model.id !== "muziekgebouw-bimhuis") {
        for (const alias of ids.slice(1)) if (!destinations.includes(alias)) merged.delete(alias);
      }
    }
    return [...merged.values()];
  }

  // src/canalRecall/game/postcardPacing.ts
  var POSTCARD_FIRST_VISITS = 3;
  var POSTCARD_QUIET_SECONDS = 45;
  var POSTCARD_MIN_GAP_SECONDS = 120;
  var POSTCARD_LULL_SECONDS = 90;
  var POSTCARD_LULL_GAP_SECONDS = 180;
  var since = (now, at) => at == null || at > now ? Infinity : now - at;
  function postcardOnEntry(input) {
    if (input.priorEntries < POSTCARD_FIRST_VISITS) return true;
    return since(input.now, input.lastTriviaAt) >= POSTCARD_QUIET_SECONDS && since(input.now, input.lastPostcardAt) >= POSTCARD_MIN_GAP_SECONDS;
  }
  function postcardForLull(input) {
    const trivia = input.lastTriviaAt != null && input.lastTriviaAt <= input.now ? input.lastTriviaAt : -Infinity;
    return since(input.now, Math.max(input.enteredAt, trivia)) >= POSTCARD_LULL_SECONDS && since(input.now, input.lastPostcardAt) >= POSTCARD_LULL_GAP_SECONDS;
  }
  var storageKey = (cityId) => `canalRecall.neighborhoodEntries.${cityId}`;
  function loadEntryCounts(storage, cityId) {
    try {
      const raw = storage?.getItem(storageKey(cityId));
      const parsed = raw ? JSON.parse(raw) : {};
      return new Map(Object.entries(parsed).filter((e) => typeof e[1] === "number"));
    } catch {
      return /* @__PURE__ */ new Map();
    }
  }
  function recordEntry(storage, cityId, counts, name) {
    const prior = counts.get(name) ?? 0;
    counts.set(name, prior + 1);
    try {
      storage?.setItem(storageKey(cityId), JSON.stringify(Object.fromEntries(counts)));
    } catch {
    }
    return prior;
  }

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
  var DRIVE_BY_RADIUS = 135;
  var DRIVE_BY_LOOKAHEAD_SECONDS = 3;
  var DRIVE_BY_MIN_LOOKAHEAD = DRIVE_BY_RADIUS;
  var DRIVE_BY_ROUTE_TOLERANCE = 140;
  var DRIVE_BY_PASSED_BEHIND = 90;
  var PREEMPT_AFTER_SECONDS = 6;
  var DRIVE_BY_MIN_GAP_SECONDS = 15;
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
  var CLICK_PREEMPT_AFTER_SECONDS = 20;
  function mayReplaceNotice(source, hold, elapsed) {
    if (!source || !hold) return true;
    if (source === "arrival") return false;
    return elapsed >= (source === "click" ? CLICK_PREEMPT_AFTER_SECONDS : PREEMPT_AFTER_SECONDS);
  }
  function driveByGapElapsed(lastShownAt, now) {
    return lastShownAt == null || lastShownAt > now || now - lastShownAt >= DRIVE_BY_MIN_GAP_SECONDS;
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
  async function readJson(response, fallback) {
    if (!response.ok) return fallback;
    try {
      return await response.json();
    } catch {
      return fallback;
    }
  }
  var START_EXTRACTS = [
    "landmarks.json",
    "boundaries.json",
    "neighborhoods-enriched.json",
    "bridges.json",
    "bridge-crossings.json",
    "streets.json",
    "water.json"
  ];
  var GameLandmarkRuntime = class {
    // ---- Clicking a building ----
    _inspectBuildingAt(clientX, clientY) {
      if (!this.player || this.quizPromptName || this._utilityOpen) return;
      const rect = this.canvas.getBoundingClientRect();
      const building = this.vectorMap.inspectBuilding(clientX - rect.left, clientY - rect.top, rect);
      let nearest = building?.landmarkId ? this.landmarks.find((landmark) => landmark.id === building.landmarkId) ?? null : null;
      const owner = building && building.id != null ? this.landmarks.find((landmark) => landmark.buildingIds?.includes(String(building.id))) : void 0;
      if (owner && !nearest) nearest = owner;
      if (!nearest || !isWorthACard(nearest)) {
        if (building) nearest = this._cardForClickedBuilding(building);
      }
      if (!nearest || !isWorthACard(nearest)) {
        this.vectorMap.setActiveLandmark(null);
        this._landmarkNotice = null;
        this._lastDriveByAt = this.raceTime;
        return;
      }
      this.quizFeedback = "";
      if (this._prompt) this._prompt.style.display = "none";
      this._showLandmarkNotice(nearest, { kind: "sticky" }, "click");
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
      if (source !== "arrival") this._lastTriviaAt = this.raceTime;
      if (source === "click") this._landmarkNoticeState.elapsed = DEFAULT_NOTICE_CONFIG.fadeSeconds;
      this._landmarkNoticeAlpha = source === "click" ? 1 : 0;
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
      this._landmarkCloseBounds = null;
    }
    /** Exact researched owner first, then mapped places inside the actual plan. */
    _cardForClickedBuilding(building) {
      const buildingName = building.name || "";
      const matched = this.landmarks.find((landmark) => landmark.id === String(building.id) || landmark.buildingIds?.includes(String(building.id)));
      if (matched && isWorthACard(matched)) return { ...matched, featureTarget: building.featureTarget };
      const mapped = this._clickPoiInfo?.card(building);
      if (mapped) return mapped;
      let row = this._buildingFacts?.lookup(building.id) ?? null;
      const spoils = this.vectorMap._spoils;
      const monument = row && row.length > 3 ? row[3] : void 0;
      if (row && monument?.n && spoils?.call(this.vectorMap, monument.n)) {
        const { n: _hidden, ...rest } = monument;
        row = [row[0], row[1], row[2], rest];
      }
      const facts = describeBuilding(row, building.height, buildingName);
      if (!monument || !(monument.a || monument.f != null && monument.f > 0)) return null;
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
      const source = notice?.wikipediaUrl || notice?.sourceUrl;
      if (!source) return;
      window.open(source, "_blank", "noopener");
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
        hasExtract: !!(entry.wikipediaUrl || entry.wikipediaExtract || entry.nameOrigin || entry.structureFact),
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
      }, { kind: "sticky" }, "street");
    }
    // ---- Loading the extract ----
    /**
     * Warm the HTTP cache with the files the ride start waits for, while the
     * player is still on the setup screen. They are the same for every ride in
     * a city and served with max-age=3600, so the start then reads them from
     * cache: "Building street network…" spent 2.7 s on a 4 Mbps link fetching
     * them (2026-10-01). Low priority, once per city, failures ignored.
     */
    _prefetchCityExtracts() {
      const Prefs = window.CanalRecallPreferences;
      const cityId = this.cityId || Prefs && Prefs.DEFAULT_CITY_ID || "amsterdam";
      if (this._prefetchedCityId === cityId || typeof fetch !== "function") return;
      this._prefetchedCityId = cityId;
      const city = Prefs && Prefs.cityById ? Prefs.cityById(cityId) : { extractPath: "../data/extracts/amsterdam" };
      for (const name of START_EXTRACTS) {
        fetch(new URL(`${city.extractPath}/${name}`, window.location.href), { priority: "low" }).catch(() => {
        });
      }
    }
    async _loadLandmarks(centerLat, centerLng, segments) {
      try {
        const Prefs = window.CanalRecallPreferences;
        const city = Prefs && Prefs.cityById ? Prefs.cityById(this.cityId || Prefs.DEFAULT_CITY_ID || "amsterdam") : { extractPath: "../data/extracts/amsterdam" };
        const base = window.location.href;
        const url = (name) => new URL(`${city.extractPath}/${name}`, base);
        const factBase = new URL(`${city.extractPath}/`, base).href;
        this._clickPoiInfo = null;
        if (this._buildingFacts) this._buildingFacts.setBase(factBase);
        else this._buildingFacts = new BuildingFactStore(factBase);
        const [
          landmarkResponse,
          boundaryResponse,
          neighborhoodEnrichedResponse,
          bridgeResponse,
          crossingResponse,
          streetResponse,
          waterResponse
        ] = await Promise.all(START_EXTRACTS.map((name) => fetch(url(name))));
        if (!landmarkResponse.ok || !boundaryResponse.ok) throw new Error("Cached place data unavailable");
        const [
          rawFeatures,
          boundaries,
          neighborhoodEnriched,
          bridgeFeatures,
          crossingIndex,
          streetFeatures,
          waterFeatures
        ] = await Promise.all([
          landmarkResponse.json(),
          boundaryResponse.json(),
          readJson(neighborhoodEnrichedResponse, []),
          readJson(bridgeResponse, []),
          readJson(crossingResponse, { bridges: {} }),
          readJson(streetResponse, []),
          readJson(waterResponse, [])
        ]);
        const features = mergeManualPoiFeatures(rawFeatures, this.cityId || "amsterdam");
        const streetKnowledge = [];
        this._facts = buildFactIndex(null);
        this._factRotation = loadRotationState(
          typeof localStorage === "undefined" ? null : localStorage
        );
        const normalise = (name) => this._normaliseCanalName(name);
        const knowledge = buildRouteKnowledgeIndex(streetKnowledge, streetFeatures, waterFeatures, normalise);
        this.streetKnowledge = knowledge;
        const deferredJson = (name) => fetch(url(name)).then((response) => readJson(response, null)).catch(() => null);
        void Promise.all([
          deferredJson("street-name-origins.json"),
          deferredJson("bridge-register.json"),
          deferredJson("street-knowledge.json"),
          deferredJson("facts.json"),
          deferredJson("branded-pois.json"),
          deferredJson("landmark-buildings.json"),
          deferredJson("click-poi-info.json")
        ]).then(([originsFile, bridgeRegister, encyclopedia, factsFile, brandedPois, landmarkBuildings, clickPoiInfo]) => {
          if (this.streetKnowledge !== knowledge) return;
          this._clickPoiInfo = new ClickPoiIndex(clickPoiInfo);
          if (factsFile) this._facts = buildFactIndex(factsFile);
          if (originsFile?.origins?.length || bridgeRegister?.bridges || encyclopedia?.length) {
            this.streetKnowledge = buildRouteKnowledgeIndex(
              encyclopedia ?? [],
              streetFeatures,
              waterFeatures,
              normalise,
              originsFile?.origins ?? [],
              bridgeRegister?.bridges ?? {}
            );
          }
          if (brandedPois) this.vectorMap.setBrandedPois(brandedPois);
          if (landmarkBuildings?.buildings && this.landmarks === landmarks) {
            for (const landmark of landmarks) landmark.buildingIds = [.../* @__PURE__ */ new Set([
              ...landmark.buildingIds ?? [],
              ...landmarkBuildings.buildings[landmark.id] ?? []
            ])];
          }
        });
        const transitStops = this.osmLoader?.transitLoad?.stops || [];
        this.vectorMap.setSpoilerNames([
          ...streetFeatures,
          ...waterFeatures,
          ...bridgeFeatures,
          ...transitStops
        ].map((item) => item.name || "").filter(Boolean));
        this.vectorMap.setPlaces(features, boundaries);
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
        const toWorld = ([lat, lng]) => ({
          x: (lng - centerLng) * metersPerDegreeLng * PIXELS_PER_METER + this.osmLoader._lastOffsetX,
          y: -(lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER + this.osmLoader._lastOffsetY
        });
        this.landmarks = buildLandmarks(features, (lat, lng, feature) => feature.manualPoi || isTransit(this.travelMode) ? toWorld([lat, lng]) : this.osmLoader.latLngToGamePoint(lat, lng, centerLat, centerLng, segments, false));
        const landmarks = this.landmarks;
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
        this._neighborhoodEnteredAt = this.raceTime;
        const cityId = this.cityId || "amsterdam";
        if (this._neighborhoodEntries?.cityId !== cityId) {
          this._neighborhoodEntries = { cityId, counts: loadEntryCounts(typeof localStorage === "undefined" ? null : localStorage, cityId) };
        }
        const priorEntries = recordEntry(
          typeof localStorage === "undefined" ? null : localStorage,
          cityId,
          this._neighborhoodEntries.counts,
          this.currentNeighborhood
        );
        this._postcardPending = postcardOnEntry({
          now: this.raceTime,
          priorEntries,
          lastTriviaAt: this._lastTriviaAt ?? null,
          lastPostcardAt: this._lastPostcardAt ?? null
        }) ? this.currentNeighborhood : null;
      } else if (this.currentNeighborhood && !this._postcardPending && postcardForLull({
        now: this.raceTime,
        enteredAt: this._neighborhoodEnteredAt ?? 0,
        lastTriviaAt: this._lastTriviaAt ?? null,
        lastPostcardAt: this._lastPostcardAt ?? null
      })) {
        this._postcardPending = this.currentNeighborhood;
      }
      if (this._postcardPending && this._postcardPending === this.currentNeighborhood && canShowDriveByCard(this.viewport?.mode, this._teachingGate()) && this.raceTime > NEIGHBORHOOD_NOTICE_GRACE) {
        this._postcardPending = null;
        this._lastPostcardAt = this.raceTime;
        if (hood) this._ensureNeighborhoodImage(hood);
        this._neighborhoodNotice = hood || { name: this.currentNeighborhood };
        this._neighborhoodNoticeTimer = NEIGHBORHOOD_NOTICE_SECONDS;
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
      if (!driveByGapElapsed(this._lastDriveByAt, this.raceTime)) return;
      if (this._landmarkNotice && !mayReplaceNotice(
        this._landmarkNoticeSource ?? null,
        this._landmarkNoticeHold,
        this._landmarkNoticeState.elapsed
      )) return;
      const nearest = pickDriveBy(candidates, ahead);
      if (nearest && nearest.id !== this._landmarkNotice?.id) {
        this._seenLandmarks.add(nearest.id);
        this._seenLandmarkNames.add(nearest.name);
        this._showLandmarkNotice(nearest, { kind: "sticky" }, "drive-by");
        this._lastDriveByAt = this.raceTime;
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
      this._landmarkCloseBounds = null;
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
        hasArticle: !!(lm.wikipediaUrl || lm.sourceUrl),
        articleLabel: lm.wikipediaUrl ? "W  WIKIPEDIA" : "W  SOURCE",
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
    _expandLandmarkNotice() {
      const lm = this._landmarkNotice;
      const panel = this._landmarkPanel;
      if (!lm || !panel) return false;
      const cards = window.CanalRecallCards;
      const originalBody = (lm.factTexts && lm.factTexts.length ? lm.factTexts.join("\n\n") : "") || lm.longDetail || lm.detail || cards.placeOnlyDetail(lm.type, this.currentNeighborhood, this._cityDisplayName());
      const body = lm.researchDetail && !originalBody.includes(lm.researchDetail) ? `${originalBody}

${lm.researchDetail}` : originalBody;
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
      if (lm.wikipediaUrl || lm.sourceUrl) {
        link.href = lm.wikipediaUrl || lm.sourceUrl;
        link.textContent = lm.wikipediaUrl ? "Wikipedia \u2197" : "Research source \u2197";
        link.hidden = false;
      } else {
        link.removeAttribute("href");
        link.hidden = true;
      }
      let research = panel.querySelector("#landmark-panel-research-source");
      if (!research) {
        research = document.createElement("a");
        research.id = "landmark-panel-research-source";
        research.target = "_blank";
        research.rel = "noopener";
        research.style.marginLeft = "12px";
        link.insertAdjacentElement("afterend", research);
      }
      const researchUrl = lm.researchSourceUrl;
      research.hidden = !researchUrl || researchUrl === (lm.wikipediaUrl || lm.sourceUrl);
      if (researchUrl) research.href = researchUrl;
      else research.removeAttribute("href");
      research.textContent = "Research source \u2197";
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
