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
        "w1487606301",
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
      facingOffsetDegrees: 90,
      attribution: {
        title: "OBA Oosterdok",
        author: "Map Recall",
        sourceUrl: "https://oba.nl/nl/locaties/oba-oosterdok",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original flat-colour low-poly reconstruction using visual references and OpenStreetMap footprint alignment. Approximate architectural dimensions, no reference image textures or imported geometry."
      }
    },
    {
      id: "rem-eiland",
      name: "REM-eiland",
      landmarkId: "rem-eiland",
      modelUrl: "./models/rem-eiland.glb",
      suppressOsmIds: [
        "w169906479"
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
      }
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
        "w747911436",
        "w747911437",
        "w747911438",
        "w747911439",
        "w747911440",
        "w747911441",
        "w747924617",
        "w747924618",
        "w747924619",
        "w747924620",
        "w747924621",
        "w747924622",
        "w747924623",
        "w747924624",
        "w747924625",
        "w747924626"
      ],
      spatialSuppression: false,
      footprint: {
        centre: [
          4.89174203315766,
          52.373932974434126
        ],
        headingDegrees: 51.267866875012544,
        lengthMetres: 94.47997996878692,
        widthMetres: 62.97060523555761
      },
      surveyed: {
        anchor: [
          4.89174605,
          52.37393705
        ],
        northOffsetDegrees: 0
      },
      groundAltitudeMetres: 0,
      facingOffsetDegrees: 90,
      attribution: {
        title: "Nieuwe Kerk",
        author: "Map Recall",
        sourceUrl: "https://www.nieuwekerk.nl/de-nieuwe-kerk/",
        licence: "Original project asset",
        licenceUrl: "./LICENSE",
        modifications: "Original texture-free Gothic reconstruction using museum photographic references and actual OpenStreetMap church/chapel/tower polygons. Surveyed placement in metres; decorative tracery and roof details are approximate."
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
      id: "ons-lieve-heer-op-solder",
      name: "Ons\u2019 Lieve Heer op Solder \u2014 historic church and entrance",
      landmarkId: "extract_landmarks_769225968",
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
  var SIGNATURE_MODELS = [...surveyedLandmarks_default.filter((entry) => !MANUAL_LANDMARKS.some((model) => model.id === entry.id)).map(specFromCatalogue), ...MANUAL_LANDMARKS];

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
      const destinations = model.id === "muziekgebouw-bimhuis" ? ids : ids.slice(0, 1);
      for (const id of destinations) {
        const existing = merged.get(id);
        merged.set(id, {
          ...existing,
          id,
          name: existing?.name || fallback?.name || model.name,
          // Large transport complexes can use a surveyed public entrance.
          center: existing?.center ?? fallback?.center ?? [anchor[1], anchor[0]],
          type: existing?.type || "landmark",
          funFact: existing?.funFact || (!existing?.wikipediaExtract ? fallback?.description : void 0),
          sourceUrl: existing?.sourceUrl || fallback?.sourceUrl || model.attribution.sourceUrl,
          manualPoi: true,
          modelId: model.id,
          buildingIds: [.../* @__PURE__ */ new Set([...existing?.buildingIds ?? [], ...model.suppressOsmIds ?? []])],
          prominenceScore: Math.max(existing?.prominenceScore ?? 0, 220)
        });
      }
      if (model.id !== "muziekgebouw-bimhuis") {
        for (const alias of ids.slice(1)) merged.delete(alias);
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
      if (lm.wikipediaUrl || lm.sourceUrl) {
        link.href = lm.wikipediaUrl || lm.sourceUrl;
        link.textContent = lm.wikipediaUrl ? "Wikipedia \u2197" : "Research source \u2197";
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
