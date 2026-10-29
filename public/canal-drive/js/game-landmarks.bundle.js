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
        wikipediaPageviews60d: feature.wikipediaPageviews60d,
        wikidataSitelinks: feature.wikidataSitelinks,
        heritage: feature.heritage,
        wikidataInstanceOf: feature.wikidataInstanceOf,
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
  var CROSSING_WATER_LINE_METERS = 90;
  function crossingWaterLines(waters, waterway, center, toWorld, radiusMeters = CROSSING_WATER_LINE_METERS) {
    const lines = [];
    const mLat = 111320;
    const mLng = 111320 * Math.cos(center[0] * Math.PI / 180);
    const local = ([lat, lng]) => ({ x: (lng - center[1]) * mLng, y: (lat - center[0]) * mLat });
    for (const water of waters) {
      if (water.name !== waterway) continue;
      for (const path of water.paths || (water.path ? [water.path] : [])) {
        for (let i = 1; i < (path || []).length; i++) {
          const a = local(path[i - 1]), b = local(path[i]);
          const dx = b.x - a.x, dy = b.y - a.y;
          const len2 = dx * dx + dy * dy;
          const t2 = len2 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2)) : 0;
          if (Math.hypot(a.x + dx * t2, a.y + dy * t2) > radiusMeters) continue;
          lines.push([toWorld(path[i - 1]), toWorld(path[i])]);
        }
      }
    }
    return lines;
  }
  function buildBridges(features, crossingIndex, toWorld, waters = []) {
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
        ...feature.displayName ? { displayName: feature.displayName } : {},
        lines,
        crossings: source.map((crossing) => {
          const waterLines = crossing.waterway && waters.length ? crossingWaterLines(waters, crossing.waterway, crossing.center, toWorld) : [];
          return { ...crossing, ...toWorld(crossing.center), ...waterLines.length ? { waterLines } : {} };
        }),
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
      const title = places.findIndex((row) => row[1] === building.name || row[5] === "a mall");
      if (title > 0) places.unshift(...places.splice(title, 1));
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
    let shared2 = 0;
    for (const word of left) if (right.has(word)) shared2++;
    return shared2 / Math.min(left.size, right.size);
  }

  // src/i18n/messages/en.ts
  var en = {
    // --- Language switch ------------------------------------------------------
    "language.label": "Language",
    "language.en": "English",
    "language.nl": "Nederlands",
    "language.enShort": "EN",
    "language.nlShort": "NL",
    "language.switchedTo": "Language: {language}",
    // --- Shared words ---------------------------------------------------------
    "common.more": "More",
    "common.done": "Done",
    "common.off": "Off",
    "common.back": "Back",
    // --- Route setup ----------------------------------------------------------
    "setup.city": "City",
    "setup.travel": "Travel",
    "setup.travel.boat": "Boat",
    "setup.travel.bike": "Bike",
    "setup.travel.transit": "Transit",
    "setup.view": "View",
    "setup.view.north": "North up",
    "setup.view.northHint": "Flat map, north at top",
    "setup.view.heading": "Heading up",
    "setup.view.headingHint": "Flat map, turns with you",
    "setup.view.chase": "Chase",
    "setup.view.chaseHint": "Low 3D, behind the vehicle",
    "setup.view.cockpit": "Cockpit",
    "setup.view.cockpitHint": "Low 3D, over the bumper",
    "setup.look": "Building look",
    "setup.look.photo": "Photo",
    "setup.look.photoHint": "Brick and sash windows",
    "setup.look.procedural": "Painted",
    "setup.look.proceduralHint": "Fitted windows and doors",
    "setup.look.storybook": "Storybook",
    "setup.look.storybookHint": "Softly painted, natural colours",
    "setup.look.cartoon": "Cartoon",
    "setup.look.cartoonHint": "Flat, bold, cel-shaded",
    "setup.look.untextured": "Untextured",
    "setup.look.untexturedHint": "Plain colours, lightest on the phone",
    "setup.route": "Route",
    "setup.route.surprise": "Surprise",
    "setup.route.surpriseHint": "Landmark to landmark",
    "setup.route.home": "Home",
    "setup.route.homeHint": "Nearby first, expands as you learn",
    "setup.route.here": "Here",
    "setup.route.hereHint": "Start from where you are now",
    "setup.route.free": "Free ride",
    "setup.route.freeHint": "No route, no questions: ride anywhere and tap what you pass",
    "freeRide.badge": "Free ride",
    "freeRide.exit": "Exit",
    "freeRide.exitLabel": "Leave free ride and go back to setup",
    "freeRide.tallyNone": "Tap a marker or a building",
    "freeRide.tallyOne": "1 place opened",
    "freeRide.tallyMany": "{count} places opened",
    "setup.difficulty": "Difficulty",
    "setup.difficulty.easy": "Easy",
    "setup.difficulty.medium": "Medium",
    "setup.difficulty.hard": "Hard",
    "setup.difficulty.expert": "Expert",
    "setup.difficulty.custom": "Custom",
    "setup.difficulty.harder": "Harder difficulties",
    "setup.difficulty.harderGloss": "Expert hides assists. Custom appears when you tweak assists below.",
    "setup.difficulty.customGloss": "Your own mix of help, set under More options.",
    "setup.difficulty.chooseName": "Pick the name from a list.",
    "setup.difficulty.typeName": "Type each name.",
    "setup.difficulty.assistsOff": "No {assists}.",
    "setup.difficulty.assistsOffList": "{list} or {last}",
    "setup.difficulty.lineOn": "Route line shown.",
    "setup.assist.routeLine": "route line",
    "setup.assist.arrow": "arrow",
    "setup.assist.minimap": "minimap",
    "setup.destination": "Destination",
    "setup.destination.surprise": "Surprise me",
    "setup.destination.tourStops": "Tour stops",
    "setup.tours": "Tours",
    "setup.tours.none": "No tour",
    "setup.tours.stops": "{count} stops by bike, one leg at a time",
    "setup.tours.checked": " \xB7 {checked}, shops change",
    "setup.tours.brief": "Ride the {tour} tour stop by stop. Each arrival tells you why it is on the list.",
    "setup.homeAddress": "Home address",
    "setup.homeAddress.placeholder": "Street and number, {city}",
    "setup.homeAddress.saved": "Saved \xB7 starts nearby, expands as you learn \xB7 boats use nearby water",
    "setup.homeAddress.learning": "Learning near home \xB7 ~{km} km \xB7 expands as you learn",
    "setup.liveLocation": "Live location",
    "setup.liveLocation.note": "Starts from where you are now \u2014 not a saved home address. Allow location when asked.",
    "setup.moreOptions": "More options",
    "setup.review": "Review",
    "setup.review.dueOnly": "Due names only",
    "setup.review.dueOnlyHint": "Ask only names due for review",
    "setup.review.measuredColours": "Reviewed colours",
    "setup.review.measuredColoursHint": "Only buildings with checked wall colours",
    "setup.review.measuredColoursHidden": "Buildings without reviewed wall colours are hidden. Coverage may be empty.",
    "setup.savedData": "Your saved data",
    "setup.resetKnowledge": "Reset knowledge\u2026",
    "setup.clearAll": "Clear all data\u2026",
    "setup.startRoute": "Start route",
    "setup.startFreeRide": "Start free ride",
    "setup.startTour": "Start tour",
    "setup.scrollMoreOptions": "Scroll for more options",
    // --- Ride options (setup + live settings) ---------------------------------
    "options.tilt": "3D tilt",
    "options.spin": "3D spin",
    "options.zoom": "Zoom",
    "options.controls": "Controls",
    "options.controls.follow": "Follow",
    "options.controls.followHint": "Rides along the street; choose each turn",
    "options.controls.steer": "Steer",
    "options.controls.steerHint": "Left and right turn the vehicle",
    "options.controls.point": "Point",
    "options.controls.pointHint": "Push the way you want to go",
    "options.answers": "Answers",
    "options.answers.choose": "Choose",
    "options.answers.chooseHint": "Pick from a few names",
    "options.answers.type": "Type",
    "options.answers.typeHint": "Spell the name yourself",
    "options.asksPerMinute": "Questions a minute",
    "options.asksPerMinuteGloss": "Route questions asked per minute while you ride. Off still shows each street name after you pass it.",
    "options.onTheMap": "On the map",
    "options.routeLine": "Route line",
    "options.arrow": "Arrow",
    "options.arrowHint": "Points at the destination",
    "options.minimap": "Minimap",
    "options.scores": "Scores",
    "options.scoresHint": "Points, streaks and ribbons",
    "options.comfort": "Comfort & detail",
    "options.lessMotion": "Less motion",
    "options.trees": "Trees",
    // --- Ride settings panel --------------------------------------------------
    "settings.title": "Ride settings",
    "settings.progress": "My progress",
    "settings.knowledge": "Your knowledge",
    "settings.routeSetup": "Route setup",
    "settings.scrollMore": "Scroll for more settings",
    "settings.signedInAs": "Signed in as {name}",
    // --- Knowledge screen -----------------------------------------------------
    "knowledge.title": "Your city knowledge",
    "knowledge.subtitle": "What is sticking, what is fading, and what to ride next.",
    "knowledge.plan": "Plan review \xB7 {count} due",
    "knowledge.nothingDue": "Nothing due now",
    "knowledge.emptyTitle": "Your map starts with one answer",
    "knowledge.emptyBody": "Complete a route and recall a street, canal, bridge, stop, or line. It will appear here with its next review time.",
    "knowledge.firstRoute": "Choose a first route",
    "knowledge.summary": "Knowledge summary",
    "knowledge.dueNow": "due now",
    "knowledge.dueNowBody": "These names have reached their review window.",
    "knowledge.caughtUp": "You are caught up. New reviews will appear here.",
    "knowledge.tracked": "Names tracked",
    "knowledge.mastered": "Mastered",
    "knowledge.recallRate": "Recall rate",
    "knowledge.reviewsLogged": "Reviews logged",
    "knowledge.mapKey": "Map key",
    "knowledge.status.due": "Due for review",
    "knowledge.status.learning": "Learning",
    "knowledge.status.known": "Known",
    "knowledge.status.mastered": "Mastered",
    "knowledge.queue": "Review queue",
    "knowledge.search": "Search knowledge",
    "knowledge.searchPlaceholder": "Search names or cities",
    "knowledge.statusLabel": "Knowledge status",
    "knowledge.filter.due": "Due",
    "knowledge.filter.learning": "Learning",
    "knowledge.filter.known": "Known",
    "knowledge.filter.mastered": "Mastered",
    "knowledge.filter.all": "All",
    "knowledge.queued": "Queued",
    "knowledge.practiceAgain": "Practice again",
    "knowledge.noNames": "No names here",
    "knowledge.noNamesSearch": "Try another search or status.",
    "knowledge.noNamesBody": "Your answers will move names into this group.",
    "knowledge.activity": "Past 7 days",
    "knowledge.activityLabel": "Reviews in the past seven days",
    "knowledge.byCity": "By city",
    "knowledge.explainer": "Mastery rises across successful reviews. A name turns copper when its spaced-review interval expires.",
    "knowledge.backToSetup": "Route setup",
    "knowledge.backToRide": "Back to ride",
    "knowledge.count.one": "{count} name in this view",
    "knowledge.count.other": "{count} names in this view",
    "knowledge.masteryPercent": "{percent} percent mastery",
    "knowledge.successful": "{count} successful",
    "knowledge.lapse.one": "{count} lapse",
    "knowledge.lapse.other": "{count} lapses",
    "knowledge.forget": "Forget",
    "knowledge.places.one": "{count} place",
    "knowledge.places.other": "{count} places",
    "knowledge.reviews.one": "{count} review",
    "knowledge.reviews.other": "{count} reviews",
    "knowledge.weekTotal.one": "{count} review this week",
    "knowledge.weekTotal.other": "{count} reviews this week",
    "knowledge.cityTracked": "{count} tracked",
    "knowledge.cityDue": "{due} due \xB7 {mastered} mastered",
    "knowledge.unit.min": "min",
    "knowledge.unit.hour": "hr",
    "knowledge.unit.day": "day",
    "knowledge.overdue": "{amount} {unit} overdue",
    "knowledge.inFuture": "in {amount} {unit}",
    // --- HUD (canvas) ---------------------------------------------------------
    "hud.tally": "{correct} / {attempts} named",
    "hud.tallyCompact": "{correct}/{attempts} named",
    "hud.points": "{points} pts",
    "hud.zoom": "Zoom {percent}%",
    "hud.streak": "{streak} streak \xB7 {mult}\xD7",
    "hud.streakCompact": "{streak}\xD7streak",
    "hud.toDestination": "to {name}",
    "hud.lap": "LAP {current} / {total}",
    "hud.complete": "{percent}% COMPLETE",
    "hud.ordinal.one": "{position}st",
    "hud.ordinal.two": "{position}nd",
    "hud.ordinal.three": "{position}rd",
    "hud.ordinal.other": "{position}th",
    "hud.recall": "RECALL",
    "hud.street": "STREET",
    // --- Quiz card ------------------------------------------------------------
    "card.noIdea": "No idea",
    "card.submit": "Check",
    "card.correct": "Correct",
    "card.wrong": "Not quite",
    "card.answerWas": "It was {name}",
    "card.continue": "Continue",
    // --- Ride errors and status ----------------------------------------------
    "ride.question.waterway": "Which waterway are you on now?",
    "ride.question.street": "Which street are you on now?",
    "ride.question.line": "Which line are you on now?",
    "ride.question.bridge": "Which bridge are you on?",
    "ride.context.bridge": "Crossing a waterway",
    "ride.context.transit": "Riding the corridor",
    "ride.context.start": "Where you set off",
    "ride.context.turn": "You made a turn",
    "ride.context.nameChanged": "The street name changed",
    "ride.noun.canals": "Canals",
    "ride.noun.streets": "Streets",
    "ride.noun.lines": "Lines",
    "ride.noun.linesAndStops": "lines and stops",
    "ride.network.waterways": "waterways",
    "ride.network.waterway": "waterway",
    "ride.network.streets": "streets",
    "ride.network.street": "street",
    "ride.network.tramLines": "tram lines",
    "ride.network.line": "line",
    "ride.load.city": "Loading {city} {network}\u2026",
    "ride.load.noNamed": "No named {noun} found here.",
    "ride.load.buildingNetwork": "Building the {noun} network\u2026",
    "ride.load.preparingMap": "Preparing the vector map\u2026",
    "ride.load.choosingStart": "Choosing a starting {noun}\u2026",
    "ride.load.renderingStreets": "Rendering streets\u2026",
    "ride.load.renderingTrams": "Rendering tram lines\u2026",
    "ride.load.renderingWaterways": "Rendering waterways\u2026",
    "ride.load.settling": "Settling the map\u2026",
    "ride.load.ready": "Ready!",
    "ride.load.findingWay": "Finding your way\u2026",
    "ride.error.noStartPoint": "No reachable starting point is available for this destination.",
    "ride.error.transitAnchors": "Transit stop anchors failed to load for {city}.",
    "ride.error.notEnoughLandmarks": "Not enough landmarks loaded for {city}.",
    "ride.error.tourUnavailable": "That tour is unavailable. Pick another below.",
    "ride.error.tourUnavailableShort": "That tour is unavailable.",
    "ride.error.snapFailed": "Could not snap your location to a mapped street or waterway. Move closer to the network, or try Surprise.",
    "ride.error.addressTooFar": "That address is too far from a connected mapped waterway. Try a nearby bridge or canal-side address.",
    "ride.error.startFinishClose": "Start and finish are too close. Try different points.",
    "ride.error.routeNotFound": "Route not found between start and finish \u2014 the route line will not display",
    "ride.error.exactAddress": "Could not find that exact {city} address",
    "ride.error.unreachableDestination": "Could not reach {destination} on the mapped {network}. Try another travel mode or destination.",
    "ride.error.addressSearch": "Address search is unavailable right now",
    "ride.error.areaTooSmall": "Area too small. Try a different area.",
    "ride.error.network": "Could not build the canal network.",
    "ride.error.addressNotFound": "Could not find that address.",
    "ride.error.placeRoute": "Could not place start/finish. Try different points.",
    "ride.error.planRoute": "Could not plan a ride from your location. Try Surprise or Home.",
    "ride.error.location": "Could not read your location.",
    "ride.error.homeAddress": "Enter a home address first.",
    "ride.error.waterways": "Failed to load waterways",
    "ride.status.findingYou": "Finding where you are\u2026",
    "ride.status.findingHome": "Finding your home base\u2026",
    "ride.holdSteer": "hold here to drive \u2014 slide to steer, pull back to brake",
    "ride.holdPoint": "hold here and point where you want to go",
    // --- Help panel -----------------------------------------------------------
    "help.keyboard": "Keyboard",
    "help.rideSection": "Ride",
    "help.answerSection": "Answer",
    "help.viewSection": "View",
    "help.arrows": "Steer and accelerate / brake",
    "help.space": "Handbrake",
    "help.pause": "Pause",
    "help.routeSetup": "Route setup",
    "help.settings": "Settings",
    "help.sound": "Sound",
    "help.multipleChoice": "Multiple-choice answer",
    "help.noIdeaTellMe": "No idea \u2014 tell me",
    "help.wikipediaLandmark": "Wikipedia for the on-screen landmark",
    "help.fullArticle": "Full landmark article",
    "help.minimap": "Minimap",
    "help.routeLine": "Route line",
    "help.destinationArrow": "Destination arrow",
    "help.northUpToggle": "North-up / heading-up",
    "help.zoom": "Zoom (or pinch)",
    "help.panCamera": "Pan camera",
    "help.recenter": "Recenter",
    "help.tilt3d": "3D tilt (Chase view)",
    "help.spin3d": "Spin 3D camera around vehicle",
    "help.spinTrackpad": "Spin 3D camera (trackpad twist in Safari)",
    "help.developerKeys": "Developer keys",
    "help.roadNames": "Road name labels",
    "help.buildingLook": "Building look",
    "help.panCameraKeys": "Pan camera",
    "help.debugOverlay": "Debug overlay",
    "help.close": "Close",
    "prompt.label.street": "Street",
    "prompt.label.waterway": "Waterway",
    "prompt.label.water": "Water",
    "prompt.label.bridge": "Bridge",
    "prompt.label.line": "Line",
    "prompt.label.stop": "Stop",
    "prompt.placeholder.street": "Street name",
    "prompt.placeholder.waterway": "Waterway name",
    "prompt.placeholder.water": "Canal or river name",
    "prompt.placeholder.bridge": "Bridge name",
    "prompt.placeholder.line": "Line name",
    "prompt.placeholder.stop": "Stop name",
    "prompt.waterway": "Waterway",
    "prompt.turn": "You made a turn",
    "prompt.submit": "Submit answer",
    "prompt.noIdea": "No idea \u2014 tell me",
    "prompt.ridingOn": "Riding on",
    "utility.settings": "Settings",
    "utility.help": "How to play",
    "landmark.readArticle": "Read the full article on Wikipedia",
    "help.title": "How to play",
    "help.replayIntro": "Show the 3-step intro",
    "help.rideTitle": "Ride",
    "help.rideTouch": "Hold the ring at the bottom of the screen and slide. Sideways steers, up goes faster, back brakes. In compass mode, point where you want to go.",
    "help.ridePointer": "Arrow keys or WASD steer. In compass mode they point the way instead: \u2192 rides east on a north-up map.",
    "help.nameTitle": "Name it",
    "help.nameBody": "Turn onto a new canal or street and the ride stops to ask its name. Pick it, type it, or choose No idea \u2014 either way the answer is shown, and the right one lights up on the map. Nothing on screen names it before you answer.",
    "help.rememberTitle": "Remember it",
    "help.rememberBody": "Names you get right come back later, just before you would forget them (spaced review). Knowledge on the setup screen shows what is due. \u201C% new\u201D on the destination card is how much of the route you have not ridden before.",
    // --- Mission briefing -----------------------------------------------------
    "mission.destination": "your destination",
    "mission.city": "the city",
    "mission.home": "home",
    "mission.boat.1": "Find your way to {destination} by water",
    "mission.boat.2": "Canal hop to {destination}",
    "mission.boat.3": "Drift toward {destination} \u2014 name what you ride",
    "mission.bike.1": "Ride toward {destination}",
    "mission.bike.2": "Pedal to {destination} \u2014 learn the turns",
    "mission.bike.3": "Learn the way to {destination}",
    "mission.transit.1": "Ride the line toward {destination}",
    "mission.transit.2": "One hop to {destination} \u2014 own the corridor",
    "mission.transit.3": "Transfer-ready: get to {destination}",
    "mission.home.1": "Learn the streets within ~{km} km of home",
    "mission.home.2": "Rides from home reach further as you learn",
    "mission.home.3": "Errand mode: leave knowing the way back",
    "mission.here.1": "From here toward {destination}",
    "mission.here.2": "Start from where you are",
    "mission.here.3": "Start from where you are \u2014 not a saved address",
    "mission.reviewOne": "Review ride: 1 overdue name on the way",
    "mission.reviewMany": "Review ride: {count} overdue names on the way",
    "mission.reviewFirstMinute": "A review waits in the first minute",
    "mission.warmUp": "Warm up with one overdue name",
    "mission.arrive": "Arrive knowing more of {city}",
    // --- Map Quest quiz ------------------------------------------------------
    "quiz.pinpoint": "Pinpoint",
    "quiz.pinpointHint": "Place the named feature on the map",
    "quiz.guessName": "Guess Name",
    "quiz.guessNameHint": "Name the feature highlighted on the map",
    "quiz.highlighted": "Highlighted on the map",
    "quiz.which": "Which {kind} is this?",
    "quiz.inContext": "In {context}",
    "quiz.noIdeaReveal": "No idea \u2014 reveal the answer",
    "quiz.skipped": "Skipped",
    "quiz.correct": "Correct",
    "quiz.notQuite": "Not quite",
    "quiz.answerWas": "It is {name}",
    "quiz.pts": "PTS",
    "quiz.points": "pts",
    "quiz.seeScore": "See score",
    "quiz.next": "Next",
    "quiz.nextNearby": "Next \xB7 nearby",
    "quiz.hint": "Hint",
    "quiz.hintWithCeiling": "Hint \xB7 up to {points}",
    "quiz.hideHint": "Hide hint",
    "quiz.showHint": "Show hint",
    "quiz.pinPlaced": "Pin placed",
    "quiz.tapToPlace": "Tap the map to place a pin",
    "quiz.tapToMove": "Tap again to move it",
    "quiz.anywhere": "Anywhere you think it is",
    "quiz.confirmPin": "Confirm pin location",
    "quiz.placeFirst": "Place a pin on the map first",
    "quiz.confirm": "Confirm",
    "quiz.placePinFirst": "Place a pin first",
    "quiz.distanceLine": "Dashed line shows distance on map",
    "quiz.sessionComplete": "Session complete",
    "quiz.accuracy": "Accuracy",
    "quiz.finalScore": "Final Score",
    "quiz.missed": "Missed",
    "quiz.overall": "Overall",
    "quiz.playAgain": "Play Again",
    "quiz.reviewOnMap": "Review on map",
    "quiz.showResults": "Show Results Summary",
    "quiz.mapReview": "Map Review: Explore your pins & correct street lines",
    "quiz.greetingsFrom": "Greetings from",
    "quiz.nameLabel": "Name:",
    "quiz.nothingDue": "Nothing due \xB7 0 known yet \u2014 start with canals",
    "quiz.dailyFive": "Daily five",
    "quiz.twoPlaces": "Two places",
    "quiz.bothHighlighted": "Both highlighted",
    "quiz.bonus": "Bonus",
    "quiz.skip": "Skip",
    "quiz.tapMap": "Tap the map",
    "quiz.loadingOsm": "OpenStreetMap data",
    "quiz.cancelAnytime": "You can cancel at any time",
    "quiz.cancelLoading": "Cancel Loading",
    "quiz.startWith": "Start with",
    "quiz.also": "Also",
    "quiz.mode": "Mode",
    "quiz.startNearHome": "Start near home",
    "quiz.started": "Quiz started",
    "quiz.couldNotLoad": "Couldn\u2019t load map features",
    "quiz.loadingLocation": "Finding location\u2026",
    "quiz.loadingBoundaries": "Discovering local boundaries\u2026",
    "quiz.geolocation": "Requesting device geolocation...",
    "quiz.geolocationCoords": "Pinpointing coordinates...",
    "quiz.reverseGeocode": "Reverse geocoding local district...",
    "quiz.couldNotLoadFeatures": "Could not load OpenStreetMap features.",
    "quiz.couldNotLoadLocation": "Could not load this location",
    "quiz.couldNotFindLocation": "Could not find that location",
    "quiz.seenBefore": "Seen before",
    "quiz.currentLocation": "Current Location: {city}",
    "quiz.adjustRadius": "Adjust search radius or administrative boundary",
    "quiz.cycleScope": "Cycle administrative scope",
    "quiz.radiusKm": "{km} km radius",
    "quiz.hood": "Hood",
    "quiz.region": "Region",
    "quiz.city": "City",
    "quiz.featureFilter": "Feature Type Filter: {label}",
    "quiz.encyclopedia": "Encyclopedia",
    "quiz.encyclopediaOnlyTitle": "Only quiz features that have an encyclopedia page",
    "quiz.roundOf": "Round {round} of {total}",
    "quiz.blindMapOn": "Blind Map Mode active (labels hidden). Click to toggle.",
    "quiz.noLabels": "No Labels",
    "quiz.menu": "Open Menu & Settings",
    "quiz.searchArea": "Search area",
    "quiz.searchPlaceholder": "City, address, or postcode",
    "quiz.searchLocation": "Search location",
    "quiz.findThisLocation": "Find this location using the selected radius",
    "quiz.customRadius": "Custom radius circle",
    "quiz.showBoundary": "Show boundary on map",
    "quiz.optionsTitle": "Map Quest Options",
    "quiz.guestProgress": "Guest progress",
    "quiz.syncActive": "Progress sync is active",
    "quiz.savedHere": "Reviews are saved on this device",
    "quiz.myProgress": "My progress",
    "quiz.signOut": "Sign out",
    "quiz.signInToSync": "Sign in to sync",
    "quiz.cloudNotConfigured": "Cloud sync not configured",
    "quiz.signInToSyncTitle": "Sign in to sync progress",
    "quiz.addFirebase": "Add Firebase environment variables to enable cloud sync",
    "quiz.questionPool": "Question pool",
    "quiz.featureCount": "{count} features",
    "quiz.encyclopediaOnlyHint": "Only quiz places with an encyclopedia page",
    "quiz.gameMode": "Game mode",
    "quiz.modeExplainer": "Pinpoint places a named spot on the map. Guess Name names what the map highlights. Neighborhood places area boundaries.",
    "quiz.locateOnMap": "Locate on map",
    "quiz.nameTheHighlight": "Name the highlight",
    "quiz.cityLocation": "City / Location",
    "quiz.useMyLocation": "Use My Location",
    "quiz.locating": "Locating...",
    "quiz.blankBaseMap": "Label-less Base Map",
    "quiz.blankBaseMapHint": "Hides text labels on map tiles (Default: Active)",
    "quiz.mapStyle": "Map Style",
    "quiz.units": "Units",
    "quiz.quizAndMapSettings": "Quiz and map settings",
    "quiz.on": "On",
    "quiz.off": "Off",
    "quiz.kind.water": "Canal / Waterway",
    "quiz.kind.bridge": "Bridge",
    "quiz.kind.square": "Square / Plaza",
    "quiz.kind.park": "Park / Greenway",
    "quiz.kind.landmark": "Landmark",
    "quiz.kind.neighborhood": "Neighborhood",
    "quiz.kind.street": "Street",
    "quiz.known": "Known",
    "quiz.knownHint": "answered well again",
    "quiz.shaky": "Still shaky",
    "quiz.shakyHint": "back soon",
    "quiz.mixed": "Mixed",
    "quiz.rankFirst": "A useful first pass",
    "quiz.rankKnowMap": "You know this map",
    "quiz.rankStrong": "Strong sense of place",
    "quiz.rankBearings": "Getting your bearings",
    "quiz.avgError": "Avg. Error",
    "quiz.averageDistance": "Average distance",
    "quiz.guessMode": "Guess mode",
    "quiz.tryOther": "Try {mode}",
    "quiz.moreAbout": "More about {name}",
    "quiz.nothingDueShort": "Nothing due",
    "quiz.currentLocationLabel": "Current Location",
    "quiz.bonusWhere": "where is {place}?",
    "quiz.bonusTapWhere": "where {place} is",
    "quiz.new": "New",
    "quiz.newHint": "first time right",
    "quiz.roundWord": "Round {round}",
    "quiz.postcardOpen": "Greetings from {name}: open the postcard",
    "quiz.dueTodayLabel": "Due today",
    "account.guest": "Playing as guest",
    "account.guestNote": "Sign in to keep your progress on every device",
    "account.signIn": "Sign in",
    "account.signOut": "Sign out",
    "account.signingIn": "Signing in\u2026",
    "account.syncNote": "Progress syncs to every device",
    "account.signInTitle": "Sign in with Google to keep your progress on every device",
    "account.unavailable": "Sign-in is not configured on this build",
    "account.fallback": "Account",
    "account.masteredSynced": "{count} synced",
    "onb.close": "Close the intro",
    "onb.skip": "Skip",
    "onb.back": "Back",
    "onb.gotIt": "Got it",
    "onb.next": "Next",
    "onb.step": "Step {current} of {total}",
    "onb.rideTitle": "Ride the real city",
    "onb.rideBody": "Pick Boat or Bike and press Start route. Ride to the destination named in the top-right corner; the orange arrow points the way.",
    "onb.ringCaption": "Hold the ring at the bottom and slide: sideways steers, up speeds up, back brakes.",
    "onb.keysCaption": "Arrow keys or WASD steer. Space brakes.",
    "onb.nameTitle": "Name it",
    "onb.nameBody": "When you turn onto a new canal or street, the ride stops and asks its name. The card in the top-left shows ? ? ? until you answer. Not sure? Choose No idea. You see the answer either way.",
    "onb.tapCaption": "Tap a name to answer. On Hard you type it.",
    "onb.pressCaption": "Press 1\u20134 to pick a name, 0 for No idea. On Hard you type it.",
    "onb.scoreTitle": "Points and names learned",
    "onb.scoreBody": "A right answer earns points: more on harder settings, in a streak, and for a name that is new to you. Names you get right come back later for review, so they stick.",
    "onb.tally": "3/4 named \xB7 290 pts",
    "onb.scoreCaption": "3 named out of 4 asked. Knowledge, on the start screen, lists every name you have learned.",
    "site.home": "Home",
    "site.ride": "Ride",
    "site.quiz": "Quiz",
    "site.progress": "Progress",
    "site.buildings": "Buildings",
    "site.label": "Ride Amsterdam",
    "settings.quizTitle": "Quiz & Map Configuration",
    "settings.locationScope": "Location Quiz Scope",
    "settings.neighborhoodScope": "Neighbourhood (~2.2 km)",
    "settings.neighborhoodScopeBody": "A walkable set of streets, canals and landmarks around you.",
    "settings.regionScope": "Region (~15 km)",
    "settings.regionScopeBody": "Uses the county or province returned for your position.",
    "settings.cityScope": "Whole City (~4.5 km)",
    "settings.cityScopeBody": "Encompasses major city canals, bridges, plazas, and citywide landmarks.",
    "settings.boundary": "Administrative Boundary",
    "settings.boundaryBody": "Use an exact OpenStreetMap political boundary, or switch back to the custom radius.",
    "settings.boundaryAdminLevel": "{name} \u2014 admin level {level}",
    "settings.radius": "Search Radius",
    "settings.radiusBody": "Administrative scope chooses the place name; radius controls the actual circular OSM query independently.",
    "settings.importantWaters": "Important canals & waters first",
    "settings.blankMap": "Label-less Base Map (Default)",
    "settings.blankMapBody": "Hides text labels on map tiles; the quiz is about names, not reading them off the map.",
    "settings.mapTheme": "Map Style Theme",
    "settings.units": "Distance Units",
    "settings.unitsBody": "Metric (m / km) or Imperial (ft / mi)",
    "settings.difficulty": "Difficulty",
    "settings.difficultyBody": "Hard hides the landmark and shop clues inside a neighbourhood",
    "settings.rounds": "Rounds per Quiz",
    "settings.roundsBody": "Number of street features per session",
    "settings.cache": "Offline Feature Cache",
    "settings.cacheBody": "Caches queried neighbourhoods, street geometry, and clues locally to provide instant load times and reduce network requests.",
    "settings.cacheCount": "{features} cached places across {entries} area queries",
    "settings.clearCache": "Clear Cache",
    "settings.clearCacheConfirm": "Clear all cached map features? Locations will be re-fetched on demand.",
    "settings.apply": "Apply & Continue",
    "auth.createAccount": "Create account",
    "auth.signIn": "Sign in",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.pleaseWait": "Please wait\u2026",
    "auth.haveAccount": "Already have an account? Sign in",
    "auth.newHere": "New here? Create an account",
    "auth.couldNotSignIn": "Could not sign in.",
    "postcard.saving": "Saving\u2026",
    "postcard.saveError": "Could not save, try again",
    "postcard.save": "Save postcard",
    "feedback.reportProblem": "Report a problem",
    "ride.hint.keys": "Arrow Keys / WASD - Drive    SPACE - Drift    TAB - Map    -/+ Zoom",
    "ride.hint.touch": "Left side: Steer    Right side: Gas/Brake    Double-tap: Drift",
    "ride.introStreets": "Navigate the real street network and name each street after you turn",
    "ride.introCanals": "Navigate the real canal network and name each waterway after you turn",
    "ride.introTransit": "Ride real tram corridors and name the lines and stops",
    "ride.nextRoute": "Next route",
    "ride.nextStop": "Next stop",
    "ride.routeSetup": "Route setup",
    "ride.shareRoute": "Share this route",
    "ride.linkCopied": "Link copied",
    "ride.startExploring": "Start exploring",
    "ride.noCycling": "No cycling in real life",
    "ride.wikipediaLink": "Wikipedia \u2197",
    "ride.researchSource": "Research source \u2197",
    "ride.rules.title": "HOW TO PLAY",
    "ride.rules.bike1": "1. Use WASD or the arrow keys to steer the bike",
    "ride.rules.bike2": "2. Stay on mapped streets; the road guard keeps you on the network",
    "ride.rules.bike3": "3. After entering a differently named street, name it",
    "ride.rules.boat1": "1. Use WASD or the arrow keys to steer the boat",
    "ride.rules.boat2": "2. The boat slows dramatically when it leaves mapped water",
    "ride.rules.boat3": "3. After entering a differently named waterway, name it",
    "ride.rules.transit1": "1. Follow the mapped corridor toward the destination",
    "ride.rules.transit2": "2. Stops and line names are the questions here",
    "ride.rules.transit3": "3. After entering a differently named line, name it",
    "ride.rules.labels": "4. Map labels are hidden: navigate from the shape of the city",
    "ride.rules.map": "5. TAB toggles the overview map; -/+ changes zoom",
    "ride.rules.prototype": "6. This is an early prototype \u2014 feedback is the point",
    "finish.destination": "your destination",
    "finish.newNames.one": "{count} new name",
    "finish.newNames.other": "{count} new names",
    "finish.newNeighborhoods.one": "{count} new neighbourhood",
    "finish.newNeighborhoods.other": "{count} new neighbourhoods",
    "finish.newLandmarks.one": "{count} landmark",
    "finish.newLandmarks.other": "{count} landmarks",
    "finish.arrivedWith": "You made it to {destination} \xB7 {bits}",
    "finish.arrived": "Arrived at {destination}",
    "finish.sticks": "That knowledge sticks on your {city} map.",
    "finish.cleanRide": "A clean ride \u2014 review something overdue next time.",
    "finish.passport": "Passport: {stamps}",
    "finish.youKnow": "You know {name}",
    "finish.streakFirst": "First new place today",
    "finish.streakDays": "{count}-day place streak"
  };

  // src/i18n/messages/nl.ts
  var nl = {
    // --- Taalkeuze ------------------------------------------------------------
    "language.label": "Taal",
    "language.en": "English",
    "language.nl": "Nederlands",
    "language.enShort": "EN",
    "language.nlShort": "NL",
    "language.switchedTo": "Taal: {language}",
    // --- Algemeen -------------------------------------------------------------
    "common.more": "Meer",
    "common.done": "Klaar",
    "common.off": "Uit",
    "common.back": "Terug",
    // --- Route instellen ------------------------------------------------------
    "setup.city": "Stad",
    "setup.travel": "Vervoer",
    "setup.travel.boat": "Boot",
    "setup.travel.bike": "Fiets",
    "setup.travel.transit": "OV",
    "setup.view": "Beeld",
    "setup.view.north": "Noord boven",
    "setup.view.northHint": "Platte kaart, noorden boven",
    "setup.view.heading": "Koers boven",
    "setup.view.headingHint": "Platte kaart, draait met je mee",
    "setup.view.chase": "Volgcam",
    "setup.view.chaseHint": "Laag 3D, achter het voertuig",
    "setup.view.cockpit": "Cockpit",
    "setup.view.cockpitHint": "Laag 3D, over de motorkap",
    "setup.look": "Gebouwen",
    "setup.look.photo": "Foto",
    "setup.look.photoHint": "Baksteen en schuiframen",
    "setup.look.procedural": "Geschilderd",
    "setup.look.proceduralHint": "Passende ramen en deuren",
    "setup.look.storybook": "Sprookje",
    "setup.look.storybookHint": "Zacht geschilderd, natuurlijke kleuren",
    "setup.look.cartoon": "Cartoon",
    "setup.look.cartoonHint": "Plat en vet, met contourlijnen",
    "setup.look.untextured": "Zonder textuur",
    "setup.look.untexturedHint": "Effen kleuren, het lichtst op de telefoon",
    "setup.route": "Route",
    "setup.route.surprise": "Verrassing",
    "setup.route.surpriseHint": "Van landmark naar landmark",
    "setup.route.home": "Thuis",
    "setup.route.homeHint": "Eerst dichtbij, groeit mee",
    "setup.route.here": "Hier",
    "setup.route.hereHint": "Start waar je nu bent",
    "setup.route.free": "Vrij rijden",
    "setup.route.freeHint": "Geen route, geen vragen: rijd waar je wilt en tik op wat je ziet",
    "freeRide.badge": "Vrij rijden",
    "freeRide.exit": "Stoppen",
    "freeRide.exitLabel": "Stop met vrij rijden en ga terug naar het startscherm",
    "freeRide.tallyNone": "Tik op een markering of een gebouw",
    "freeRide.tallyOne": "1 plek geopend",
    "freeRide.tallyMany": "{count} plekken geopend",
    "setup.difficulty": "Moeilijkheid",
    "setup.difficulty.easy": "Makkelijk",
    "setup.difficulty.medium": "Gemiddeld",
    "setup.difficulty.hard": "Moeilijk",
    "setup.difficulty.expert": "Expert",
    "setup.difficulty.custom": "Aangepast",
    "setup.difficulty.harder": "Moeilijkere niveaus",
    "setup.difficulty.harderGloss": "Expert verbergt hulpjes. Aangepast verschijnt zodra je hieronder hulpjes aanpast.",
    "setup.difficulty.customGloss": "Je eigen mix van hulpjes, ingesteld onder Meer opties.",
    "setup.difficulty.chooseName": "Kies de naam uit een lijst.",
    "setup.difficulty.typeName": "Typ elke naam.",
    "setup.difficulty.assistsOff": "Geen {assists}.",
    "setup.difficulty.assistsOffList": "{list} of {last}",
    "setup.difficulty.lineOn": "Routelijn zichtbaar.",
    "setup.assist.routeLine": "routelijn",
    "setup.assist.arrow": "pijl",
    "setup.assist.minimap": "minikaart",
    "setup.destination": "Bestemming",
    "setup.destination.surprise": "Verras me",
    "setup.destination.tourStops": "Tourstops",
    "setup.tours": "Tours",
    "setup.tours.none": "Geen tour",
    "setup.tours.stops": "{count} stops per fiets, etappe voor etappe",
    "setup.tours.checked": " \xB7 {checked}, winkels wisselen",
    "setup.tours.brief": "Rijd de tour {tour} stop voor stop. Bij elke stop zie je waarom die op de lijst staat.",
    "setup.homeAddress": "Thuisadres",
    "setup.homeAddress.placeholder": "Straat en huisnummer, {city}",
    "setup.homeAddress.saved": "Opgeslagen \xB7 begint dichtbij, groeit mee \xB7 boten varen op water in de buurt",
    "setup.homeAddress.learning": "Leren rond huis \xB7 ~{km} km \xB7 groeit mee",
    "setup.liveLocation": "Live locatie",
    "setup.liveLocation.note": "Start waar je nu bent \u2014 niet vanaf een opgeslagen thuisadres. Sta locatie toe als daarom wordt gevraagd.",
    "setup.moreOptions": "Meer opties",
    "setup.review": "Herhaling",
    "setup.review.dueOnly": "Alleen namen die herhaald moeten worden",
    "setup.review.dueOnlyHint": "Vraag alleen namen die aan herhaling toe zijn",
    "setup.review.measuredColours": "Gecontroleerde kleuren",
    "setup.review.measuredColoursHint": "Alleen gebouwen met gecontroleerde gevelkleuren",
    "setup.review.measuredColoursHidden": "Gebouwen zonder gecontroleerde gevelkleuren zijn verborgen. De dekking kan leeg zijn.",
    "setup.savedData": "Je opgeslagen gegevens",
    "setup.resetKnowledge": "Kennis wissen\u2026",
    "setup.clearAll": "Alle gegevens wissen\u2026",
    "setup.startRoute": "Start route",
    "setup.startFreeRide": "Begin vrij rijden",
    "setup.startTour": "Start tour",
    "setup.scrollMoreOptions": "Scroll voor meer opties",
    // --- Ritopties (instellen en live instellingen) ---------------------------
    "options.tilt": "3D-kanteling",
    "options.spin": "3D-draai",
    "options.zoom": "Zoom",
    "options.controls": "Besturing",
    "options.controls.follow": "Volgen",
    "options.controls.followHint": "Rijdt de straat af; jij kiest elke afslag",
    "options.controls.steer": "Sturen",
    "options.controls.steerHint": "Links en rechts draaien het voertuig",
    "options.controls.point": "Richten",
    "options.controls.pointHint": "Duw naar waar je heen wilt",
    "options.answers": "Antwoorden",
    "options.answers.choose": "Kiezen",
    "options.answers.chooseHint": "Kies uit een paar namen",
    "options.answers.type": "Typen",
    "options.answers.typeHint": "Spel de naam zelf",
    "options.asksPerMinute": "Vragen per minuut",
    "options.asksPerMinuteGloss": "Routevragen per minuut tijdens het rijden. Uit toont nog steeds elke straatnaam nadat je er langs bent.",
    "options.onTheMap": "Op de kaart",
    "options.routeLine": "Routelijn",
    "options.arrow": "Pijl",
    "options.arrowHint": "Wijst naar de bestemming",
    "options.minimap": "Minikaart",
    "options.scores": "Scores",
    "options.scoresHint": "Punten, reeksen en linten",
    "options.comfort": "Comfort en detail",
    "options.lessMotion": "Minder beweging",
    "options.trees": "Bomen",
    // --- Ritinstellingen ------------------------------------------------------
    "settings.title": "Ritinstellingen",
    "settings.progress": "Mijn voortgang",
    "settings.knowledge": "Jouw kennis",
    "settings.routeSetup": "Route instellen",
    "settings.scrollMore": "Scroll voor meer instellingen",
    "settings.signedInAs": "Ingelogd als {name}",
    // --- Kennis ---------------------------------------------------------------
    "knowledge.title": "Jouw stadskennis",
    "knowledge.subtitle": "Wat blijft hangen, wat vervaagt, en wat je hierna rijdt.",
    "knowledge.plan": "Herhaling plannen \xB7 {count} te doen",
    "knowledge.nothingDue": "Nu niets te doen",
    "knowledge.emptyTitle": "Je kaart begint met \xE9\xE9n antwoord",
    "knowledge.emptyBody": "Rijd een route en noem een straat, gracht, brug, halte of lijn. Die verschijnt hier met het volgende herhaalmoment.",
    "knowledge.firstRoute": "Kies een eerste route",
    "knowledge.summary": "Kennisoverzicht",
    "knowledge.dueNow": "nu te doen",
    "knowledge.dueNowBody": "Deze namen zijn toe aan herhaling.",
    "knowledge.caughtUp": "Je bent bij. Nieuwe herhalingen verschijnen hier.",
    "knowledge.tracked": "Namen gevolgd",
    "knowledge.mastered": "Beheerst",
    "knowledge.recallRate": "Trefferquote",
    "knowledge.reviewsLogged": "Herhalingen gedaan",
    "knowledge.mapKey": "Legenda",
    "knowledge.status.due": "Toe aan herhaling",
    "knowledge.status.learning": "Lerend",
    "knowledge.status.known": "Bekend",
    "knowledge.status.mastered": "Beheerst",
    "knowledge.queue": "Herhaalwachtrij",
    "knowledge.search": "Kennis zoeken",
    "knowledge.searchPlaceholder": "Zoek namen of steden",
    "knowledge.statusLabel": "Kennisstatus",
    "knowledge.filter.due": "Te doen",
    "knowledge.filter.learning": "Lerend",
    "knowledge.filter.known": "Bekend",
    "knowledge.filter.mastered": "Beheerst",
    "knowledge.filter.all": "Alles",
    "knowledge.queued": "In de wachtrij",
    "knowledge.practiceAgain": "Nog eens oefenen",
    "knowledge.noNames": "Hier geen namen",
    "knowledge.noNamesSearch": "Probeer een andere zoekopdracht of status.",
    "knowledge.noNamesBody": "Je antwoorden verplaatsen namen naar deze groep.",
    "knowledge.activity": "Afgelopen 7 dagen",
    "knowledge.activityLabel": "Herhalingen in de afgelopen zeven dagen",
    "knowledge.byCity": "Per stad",
    "knowledge.explainer": "Beheersing groeit met elke goede herhaling. Een naam wordt koperkleurig zodra het herhaalinterval verloopt.",
    "knowledge.backToSetup": "Route instellen",
    "knowledge.backToRide": "Terug naar de rit",
    "knowledge.count.one": "{count} naam in dit overzicht",
    "knowledge.count.other": "{count} namen in dit overzicht",
    "knowledge.masteryPercent": "{percent} procent beheerst",
    "knowledge.successful": "{count} keer goed",
    "knowledge.lapse.one": "{count} keer vergeten",
    "knowledge.lapse.other": "{count} keer vergeten",
    "knowledge.forget": "Vergeten",
    "knowledge.places.one": "{count} plek",
    "knowledge.places.other": "{count} plekken",
    "knowledge.reviews.one": "{count} herhaling",
    "knowledge.reviews.other": "{count} herhalingen",
    "knowledge.weekTotal.one": "{count} herhaling deze week",
    "knowledge.weekTotal.other": "{count} herhalingen deze week",
    "knowledge.cityTracked": "{count} gevolgd",
    "knowledge.cityDue": "{due} te doen \xB7 {mastered} beheerst",
    "knowledge.unit.min": "min",
    "knowledge.unit.hour": "uur",
    "knowledge.unit.day": "dag",
    "knowledge.overdue": "{amount} {unit} te laat",
    "knowledge.inFuture": "over {amount} {unit}",
    // --- HUD (canvas) ---------------------------------------------------------
    "hud.tally": "{correct} / {attempts} benoemd",
    "hud.tallyCompact": "{correct}/{attempts} benoemd",
    "hud.points": "{points} pnt",
    "hud.zoom": "Zoom {percent}%",
    "hud.streak": "{streak} op rij \xB7 {mult}\xD7",
    "hud.streakCompact": "{streak}\xD7op rij",
    "hud.toDestination": "naar {name}",
    "hud.lap": "RONDE {current} / {total}",
    "hud.complete": "{percent}% VOLTOOID",
    "hud.ordinal.one": "{position}e",
    "hud.ordinal.two": "{position}e",
    "hud.ordinal.three": "{position}e",
    "hud.ordinal.other": "{position}e",
    "hud.recall": "NOEM",
    "hud.street": "STRAAT",
    // --- Vraagkaart -----------------------------------------------------------
    "card.noIdea": "Geen idee",
    "card.submit": "Controleer",
    "card.correct": "Goed",
    "card.wrong": "Bijna",
    "card.answerWas": "Het was {name}",
    "card.continue": "Verder",
    // --- Ritfouten en status --------------------------------------------------
    "ride.question.waterway": "Welke waterweg ben je nu op?",
    "ride.question.street": "Welke straat ben je nu op?",
    "ride.question.line": "Welke lijn ben je nu op?",
    "ride.question.bridge": "Welke brug ben je op?",
    "ride.context.bridge": "Je steekt een waterweg over",
    "ride.context.transit": "Je rijdt op de corridor",
    "ride.context.start": "Waar je bent vertrokken",
    "ride.context.turn": "Je sloeg af",
    "ride.context.nameChanged": "De straatnaam veranderde",
    "ride.noun.canals": "Grachten",
    "ride.noun.streets": "Straten",
    "ride.noun.lines": "Lijnen",
    "ride.noun.linesAndStops": "lijnen en haltes",
    "ride.network.waterways": "waterwegen",
    "ride.network.waterway": "waterweg",
    "ride.network.streets": "straten",
    "ride.network.street": "straat",
    "ride.network.tramLines": "tramlijnen",
    "ride.network.line": "lijn",
    "ride.load.city": "{city} {network} laden\u2026",
    "ride.load.noNamed": "Hier geen benoemde {noun} gevonden.",
    "ride.load.buildingNetwork": "Het {noun}netwerk opbouwen\u2026",
    "ride.load.preparingMap": "De vectorkaart voorbereiden\u2026",
    "ride.load.choosingStart": "Een startpunt op de {noun} kiezen\u2026",
    "ride.load.renderingStreets": "Straten tekenen\u2026",
    "ride.load.renderingTrams": "Tramlijnen tekenen\u2026",
    "ride.load.renderingWaterways": "Waterwegen tekenen\u2026",
    "ride.load.settling": "De kaart wordt bijgewerkt\u2026",
    "ride.load.ready": "Klaar!",
    "ride.load.findingWay": "Je route wordt gezocht\u2026",
    "ride.error.noStartPoint": "Er is geen bereikbaar startpunt voor deze bestemming.",
    "ride.error.transitAnchors": "De halten voor de OV-route in {city} zijn niet geladen.",
    "ride.error.notEnoughLandmarks": "Te weinig landmarks geladen voor {city}.",
    "ride.error.tourUnavailable": "Die tour is niet beschikbaar. Kies hieronder een andere.",
    "ride.error.tourUnavailableShort": "Die tour is niet beschikbaar.",
    "ride.error.snapFailed": "Je locatie kon niet aan een gemapte straat of waterweg worden gekoppeld. Ga dichter bij het netwerk staan, of probeer Verrassing.",
    "ride.error.addressTooFar": "Dat adres ligt te ver van een aangesloten gemapte waterweg. Probeer een brug of een adres aan de gracht.",
    "ride.error.startFinishClose": "Start en finish liggen te dicht bij elkaar. Probeer andere punten.",
    "ride.error.routeNotFound": "Geen route gevonden tussen start en finish \u2014 de routelijn wordt niet getoond",
    "ride.error.exactAddress": "Dat exacte adres in {city} is niet gevonden",
    "ride.error.unreachableDestination": "Kon {destination} niet bereiken via de gemapte {network}. Probeer een ander vervoer of een andere bestemming.",
    "ride.error.addressSearch": "Adres zoeken is nu niet beschikbaar",
    "ride.error.areaTooSmall": "Gebied te klein. Probeer een ander gebied.",
    "ride.error.network": "Kon het grachtennetwerk niet opbouwen.",
    "ride.error.addressNotFound": "Dat adres is niet gevonden.",
    "ride.error.placeRoute": "Kon start en finish niet plaatsen. Probeer andere punten.",
    "ride.error.planRoute": "Kon geen rit vanaf je locatie plannen. Probeer Verrassing of Thuis.",
    "ride.error.location": "Kon je locatie niet lezen.",
    "ride.error.homeAddress": "Vul eerst een thuisadres in.",
    "ride.error.waterways": "Waterwegen laden mislukte",
    "ride.status.findingYou": "Je locatie wordt gezocht\u2026",
    "ride.status.findingHome": "Je thuisbasis wordt gezocht\u2026",
    "ride.holdSteer": "houd hier vast om te rijden \u2014 schuif om te sturen, trek terug om te remmen",
    "ride.holdPoint": "houd hier vast en wijs waar je heen wilt",
    // --- Helppaneel -----------------------------------------------------------
    "help.keyboard": "Toetsenbord",
    "help.rideSection": "Rijden",
    "help.answerSection": "Antwoorden",
    "help.viewSection": "Beeld",
    "help.arrows": "Sturen en versnellen / remmen",
    "help.space": "Handrem",
    "help.pause": "Pauze",
    "help.routeSetup": "Route instellen",
    "help.settings": "Instellingen",
    "help.sound": "Geluid",
    "help.multipleChoice": "Meerkeuzeantwoord",
    "help.noIdeaTellMe": "Geen idee \u2014 vertel me",
    "help.wikipediaLandmark": "Wikipedia voor het landmark op het scherm",
    "help.fullArticle": "Volledig artikel over het landmark",
    "help.minimap": "Minikaart",
    "help.routeLine": "Routelijn",
    "help.destinationArrow": "Pijl naar de bestemming",
    "help.northUpToggle": "Noord boven / koers boven",
    "help.zoom": "Zoom (of knijp)",
    "help.panCamera": "Camera verschuiven",
    "help.recenter": "Opnieuw centreren",
    "help.tilt3d": "3D-kanteling (volgcamera)",
    "help.spin3d": "3D-camera om het voertuig draaien",
    "help.spinTrackpad": "3D-camera draaien (trackpad-twist in Safari)",
    "help.developerKeys": "Ontwikkelaarstoetsen",
    "help.roadNames": "Straatnaamlabels",
    "help.buildingLook": "Gebouwenstijl",
    "help.panCameraKeys": "Camera verschuiven",
    "help.debugOverlay": "Debugoverlay",
    "help.close": "Sluiten",
    "prompt.label.street": "Straat",
    "prompt.label.waterway": "Waterweg",
    "prompt.label.water": "Water",
    "prompt.label.bridge": "Brug",
    "prompt.label.line": "Lijn",
    "prompt.label.stop": "Halte",
    "prompt.placeholder.street": "Straatnaam",
    "prompt.placeholder.waterway": "Naam van de waterweg",
    "prompt.placeholder.water": "Naam van gracht of rivier",
    "prompt.placeholder.bridge": "Naam van de brug",
    "prompt.placeholder.line": "Naam van de lijn",
    "prompt.placeholder.stop": "Naam van de halte",
    "prompt.waterway": "Waterweg",
    "prompt.turn": "Je sloeg af",
    "prompt.submit": "Antwoord insturen",
    "prompt.noIdea": "Geen idee \u2014 vertel het me",
    "prompt.ridingOn": "Je rijdt verder",
    "utility.settings": "Instellingen",
    "utility.help": "Hoe speel je",
    "landmark.readArticle": "Lees het volledige artikel op Wikipedia",
    "help.title": "Hoe speel je",
    "help.replayIntro": "Toon de intro in 3 stappen",
    "help.rideTitle": "Rijden",
    "help.rideTouch": "Houd de ring onderaan het scherm vast en schuif. Zijwaarts stuurt, omhoog gaat sneller, terug remt. In kompasmodus wijs je waar je heen wilt.",
    "help.ridePointer": "Pijltjestoetsen of WASD sturen. In kompasmodus wijzen ze de richting aan: \u2192 rijdt oostwaarts op een noord-boven-kaart.",
    "help.nameTitle": "Benoem het",
    "help.nameBody": "Sla je een nieuwe gracht of straat in, dan stopt de rit om de naam te vragen. Kies hem, typ hem, of kies Geen idee \u2014 hoe dan ook zie je het antwoord, en de juiste naam licht op de kaart op. Niets op het scherm verklapt de naam voor je antwoordt.",
    "help.rememberTitle": "Onthoud het",
    "help.rememberBody": "Namen die je goed hebt, komen later terug, net voordat je ze zou vergeten (gespreide herhaling). Kennis op het startscherm laat zien wat er te doen is. \u201C% nieuw\u201D op de bestemmingskaart is hoeveel van de route je nog niet eerder reed.",
    // --- Opdrachtregel --------------------------------------------------------
    "mission.destination": "je bestemming",
    "mission.city": "de stad",
    "mission.home": "huis",
    "mission.boat.1": "Zoek je weg naar {destination} over het water",
    "mission.boat.2": "Grachtenhoppen naar {destination}",
    "mission.boat.3": "Drijf richting {destination} \u2014 benoem wat je vaart",
    "mission.bike.1": "Fiets richting {destination}",
    "mission.bike.2": "Trap naar {destination} \u2014 leer de bochten",
    "mission.bike.3": "Leer de weg naar {destination}",
    "mission.transit.1": "Rijd met de lijn richting {destination}",
    "mission.transit.2": "E\xE9n overstap naar {destination} \u2014 ken de corridor",
    "mission.transit.3": "Overstapklaar: kom bij {destination}",
    "mission.home.1": "Leer de straten binnen ~{km} km van huis",
    "mission.home.2": "Ritten vanaf huis reiken verder naarmate je leert",
    "mission.home.3": "Boodschappenmodus: vertrek en weet de weg terug",
    "mission.here.1": "Vanaf hier richting {destination}",
    "mission.here.2": "Start waar je nu bent",
    "mission.here.3": "Start waar je nu bent \u2014 geen opgeslagen adres",
    "mission.reviewOne": "Herhaalrit: 1 naam te laat onderweg",
    "mission.reviewMany": "Herhaalrit: {count} namen te laat onderweg",
    "mission.reviewFirstMinute": "In de eerste minuut wacht een herhaling",
    "mission.warmUp": "Warm op met \xE9\xE9n naam die te laat is",
    "mission.arrive": "Kom aan met meer kennis van {city}",
    // --- Map Quest-quiz ------------------------------------------------------
    "quiz.pinpoint": "Aanwijzen",
    "quiz.pinpointHint": "Zet de genoemde plek op de kaart",
    "quiz.guessName": "Naam raden",
    "quiz.guessNameHint": "Benoem de plek die op de kaart oplicht",
    "quiz.highlighted": "Licht op de kaart op",
    "quiz.which": "Welke {kind} is dit?",
    "quiz.inContext": "In {context}",
    "quiz.noIdeaReveal": "Geen idee \u2014 toon het antwoord",
    "quiz.skipped": "Overgeslagen",
    "quiz.correct": "Goed",
    "quiz.notQuite": "Bijna",
    "quiz.answerWas": "Het is {name}",
    "quiz.pts": "PNT",
    "quiz.points": "pnt",
    "quiz.seeScore": "Bekijk score",
    "quiz.next": "Volgende",
    "quiz.nextNearby": "Volgende \xB7 dichtbij",
    "quiz.hint": "Hint",
    "quiz.hintWithCeiling": "Hint \xB7 tot {points}",
    "quiz.hideHint": "Hint verbergen",
    "quiz.showHint": "Hint tonen",
    "quiz.pinPlaced": "Speld geplaatst",
    "quiz.tapToPlace": "Tik op de kaart om een speld te zetten",
    "quiz.tapToMove": "Tik nog eens om hem te verplaatsen",
    "quiz.anywhere": "Waar je denkt dat het is",
    "quiz.confirmPin": "Speld bevestigen",
    "quiz.placeFirst": "Zet eerst een speld op de kaart",
    "quiz.confirm": "Bevestigen",
    "quiz.placePinFirst": "Zet eerst een speld",
    "quiz.distanceLine": "De stippellijn toont de afstand op de kaart",
    "quiz.sessionComplete": "Sessie klaar",
    "quiz.accuracy": "Nauwkeurigheid",
    "quiz.finalScore": "Eindscore",
    "quiz.missed": "Gemist",
    "quiz.overall": "Totaal",
    "quiz.playAgain": "Nog een keer",
    "quiz.reviewOnMap": "Bekijk op de kaart",
    "quiz.showResults": "Toon resultaten",
    "quiz.mapReview": "Kaartoverzicht: bekijk je spelden en de juiste straatlijnen",
    "quiz.greetingsFrom": "Groeten uit",
    "quiz.nameLabel": "Naam:",
    "quiz.nothingDue": "Niets te doen \xB7 nog 0 bekend \u2014 begin met grachten",
    "quiz.dailyFive": "Dagelijkse vijf",
    "quiz.twoPlaces": "Twee plekken",
    "quiz.bothHighlighted": "Beide lichten op",
    "quiz.bonus": "Bonus",
    "quiz.skip": "Overslaan",
    "quiz.tapMap": "Tik op de kaart",
    "quiz.loadingOsm": "OpenStreetMap-gegevens",
    "quiz.cancelAnytime": "Je kunt altijd annuleren",
    "quiz.cancelLoading": "Laden annuleren",
    "quiz.startWith": "Begin met",
    "quiz.also": "Ook",
    "quiz.mode": "Modus",
    "quiz.startNearHome": "Start bij huis",
    "quiz.started": "Quiz gestart",
    "quiz.couldNotLoad": "Kaartonderdelen konden niet laden",
    "quiz.loadingLocation": "Locatie zoeken\u2026",
    "quiz.loadingBoundaries": "Grenzen in de buurt zoeken\u2026",
    "quiz.geolocation": "Locatie van het apparaat opvragen...",
    "quiz.geolocationCoords": "Co\xF6rdinaten bepalen...",
    "quiz.reverseGeocode": "Plaatsnaam opzoeken...",
    "quiz.couldNotLoadFeatures": "Kon de OpenStreetMap-onderdelen niet laden.",
    "quiz.couldNotLoadLocation": "Deze locatie kon niet laden",
    "quiz.couldNotFindLocation": "Die locatie is niet gevonden",
    "quiz.seenBefore": "Eerder gezien",
    "quiz.currentLocation": "Huidige locatie: {city}",
    "quiz.adjustRadius": "Pas de zoekradius of gebiedsgrens aan",
    "quiz.cycleScope": "Wissel het gebiedsniveau",
    "quiz.radiusKm": "{km} km radius",
    "quiz.hood": "Buurt",
    "quiz.region": "Regio",
    "quiz.city": "Stad",
    "quiz.featureFilter": "Filter op type: {label}",
    "quiz.encyclopedia": "Encyclopedie",
    "quiz.encyclopediaOnlyTitle": "Alleen quizplekken met een encyclopediepagina",
    "quiz.roundOf": "Ronde {round} van {total}",
    "quiz.blindMapOn": "Blindekaartmodus actief (labels verborgen). Klik om te wisselen.",
    "quiz.noLabels": "Geen labels",
    "quiz.menu": "Menu en instellingen openen",
    "quiz.searchArea": "Zoekgebied",
    "quiz.searchPlaceholder": "Stad, adres of postcode",
    "quiz.searchLocation": "Locatie zoeken",
    "quiz.findThisLocation": "Zoek deze locatie met de gekozen radius",
    "quiz.customRadius": "Eigen radiuscirkel",
    "quiz.showBoundary": "Toon grens op de kaart",
    "quiz.optionsTitle": "Map Quest-opties",
    "quiz.guestProgress": "Voortgang als gast",
    "quiz.syncActive": "Voortgang wordt gesynchroniseerd",
    "quiz.savedHere": "Herhalingen worden op dit apparaat bewaard",
    "quiz.myProgress": "Mijn voortgang",
    "quiz.signOut": "Uitloggen",
    "quiz.signInToSync": "Log in om te synchroniseren",
    "quiz.cloudNotConfigured": "Cloudsynchronisatie niet ingesteld",
    "quiz.signInToSyncTitle": "Log in om je voortgang te synchroniseren",
    "quiz.addFirebase": "Voeg Firebase-omgevingsvariabelen toe om cloudsynchronisatie aan te zetten",
    "quiz.questionPool": "Vragenpool",
    "quiz.featureCount": "{count} plekken",
    "quiz.encyclopediaOnlyHint": "Alleen quizplekken met een encyclopediepagina",
    "quiz.gameMode": "Spelmodus",
    "quiz.modeExplainer": "Aanwijzen zet een genoemde plek op de kaart. Naam raden benoemt wat de kaart oplicht. Buurt wijst gebiedsgrenzen aan.",
    "quiz.locateOnMap": "Op de kaart zetten",
    "quiz.nameTheHighlight": "Benoem de highlight",
    "quiz.cityLocation": "Stad / locatie",
    "quiz.useMyLocation": "Gebruik mijn locatie",
    "quiz.locating": "Locatie zoeken...",
    "quiz.blankBaseMap": "Kaart zonder labels",
    "quiz.blankBaseMapHint": "Verbergt tekstlabels op de kaarttegels (standaard: aan)",
    "quiz.mapStyle": "Kaartstijl",
    "quiz.units": "Eenheden",
    "quiz.quizAndMapSettings": "Quiz- en kaartinstellingen",
    "quiz.on": "Aan",
    "quiz.off": "Uit",
    "quiz.kind.water": "Gracht / waterweg",
    "quiz.kind.bridge": "Brug",
    "quiz.kind.square": "Plein",
    "quiz.kind.park": "Park",
    "quiz.kind.landmark": "Landmark",
    "quiz.kind.neighborhood": "Buurt",
    "quiz.kind.street": "Straat",
    "quiz.known": "Bekend",
    "quiz.knownHint": "nog eens goed beantwoord",
    "quiz.shaky": "Nog wankel",
    "quiz.shakyHint": "komt snel terug",
    "quiz.mixed": "Gemengd",
    "quiz.rankFirst": "Een goede eerste ronde",
    "quiz.rankKnowMap": "Je kent deze kaart",
    "quiz.rankStrong": "Sterk ruimtelijk gevoel",
    "quiz.rankBearings": "Je begint de weg te vinden",
    "quiz.avgError": "Gem. fout",
    "quiz.averageDistance": "Gemiddelde afstand",
    "quiz.guessMode": "Raadmodus",
    "quiz.tryOther": "Probeer {mode}",
    "quiz.moreAbout": "Meer over {name}",
    "quiz.nothingDueShort": "Niets te doen",
    "quiz.currentLocationLabel": "Huidige locatie",
    "quiz.bonusWhere": "waar is {place}?",
    "quiz.bonusTapWhere": "waar {place} is",
    "quiz.new": "Nieuw",
    "quiz.newHint": "meteen goed",
    "quiz.roundWord": "Ronde {round}",
    "quiz.postcardOpen": "Groeten uit {name}: open de postkaart",
    "quiz.dueTodayLabel": "Vandaag te doen",
    "account.guest": "Je speelt als gast",
    "account.guestNote": "Log in om je voortgang op al je apparaten te bewaren",
    "account.signIn": "Inloggen",
    "account.signOut": "Uitloggen",
    "account.signingIn": "Bezig met inloggen\u2026",
    "account.syncNote": "Voortgang synchroniseert naar al je apparaten",
    "account.signInTitle": "Log in met Google om je voortgang op al je apparaten te bewaren",
    "account.unavailable": "Inloggen is niet ingesteld in deze build",
    "account.fallback": "Account",
    "account.masteredSynced": "{count} gesynchroniseerd",
    "onb.close": "Sluit de intro",
    "onb.skip": "Overslaan",
    "onb.back": "Terug",
    "onb.gotIt": "Begrepen",
    "onb.next": "Volgende",
    "onb.step": "Stap {current} van {total}",
    "onb.rideTitle": "Rijd door de echte stad",
    "onb.rideBody": "Kies Boot of Fiets en druk op Start route. Rijd naar de bestemming rechtsboven; de oranje pijl wijst de weg.",
    "onb.ringCaption": "Houd de ring onderaan vast en schuif: zijwaarts stuurt, omhoog gaat sneller, terug remt.",
    "onb.keysCaption": "Pijltjestoetsen of WASD sturen. Spatie remt.",
    "onb.nameTitle": "Benoem het",
    "onb.nameBody": "Sla je een nieuwe gracht of straat in, dan stopt de rit en vraagt de naam. De kaart linksboven toont ? ? ? tot je antwoordt. Twijfel je? Kies Geen idee. Je ziet hoe dan ook het antwoord.",
    "onb.tapCaption": "Tik een naam aan om te antwoorden. Op Moeilijk typ je hem.",
    "onb.pressCaption": "Druk 1\u20134 om een naam te kiezen, 0 voor Geen idee. Op Moeilijk typ je hem.",
    "onb.scoreTitle": "Punten en geleerde namen",
    "onb.scoreBody": "Een goed antwoord levert punten op: meer op moeilijker instellingen, in een reeks, en voor een naam die nieuw voor je is. Namen die je goed hebt, komen later terug om te herhalen, zodat ze blijven hangen.",
    "onb.tally": "3/4 benoemd \xB7 290 pnt",
    "onb.scoreCaption": "3 van de 4 gevraagde namen benoemd. Kennis, op het startscherm, toont elke naam die je hebt geleerd.",
    "site.home": "Start",
    "site.ride": "Rijden",
    "site.quiz": "Quiz",
    "site.progress": "Voortgang",
    "site.buildings": "Gebouwen",
    "site.label": "Ride Amsterdam",
    "settings.quizTitle": "Quiz- en kaartinstellingen",
    "settings.locationScope": "Gebied voor de quiz",
    "settings.neighborhoodScope": "Buurt (~2,2 km)",
    "settings.neighborhoodScopeBody": "Een beloopbare set straten, grachten en landmarks om je heen.",
    "settings.regionScope": "Regio (~15 km)",
    "settings.regionScopeBody": "Gebruikt de provincie of regio die bij je positie hoort.",
    "settings.cityScope": "Hele stad (~4,5 km)",
    "settings.cityScopeBody": "Omvat de grote grachten, bruggen, pleinen en landmarks van de stad.",
    "settings.boundary": "Bestuurlijke grens",
    "settings.boundaryBody": "Gebruik een exacte OpenStreetMap-grens, of ga terug naar de eigen radius.",
    "settings.boundaryAdminLevel": "{name} \u2014 bestuursniveau {level}",
    "settings.radius": "Zoekradius",
    "settings.radiusBody": "Het gebiedsniveau kiest de plaatsnaam; de radius bepaalt los daarvan de cirkelvormige OSM-zoekopdracht.",
    "settings.importantWaters": "Belangrijke grachten en wateren eerst",
    "settings.blankMap": "Kaart zonder labels (standaard)",
    "settings.blankMapBody": "Verbergt tekstlabels op de kaarttegels; de quiz gaat over namen, niet over ze van de kaart lezen.",
    "settings.mapTheme": "Kaartstijl",
    "settings.units": "Afstandseenheden",
    "settings.unitsBody": "Metrisch (m / km) of imperiaal (ft / mi)",
    "settings.difficulty": "Moeilijkheid",
    "settings.difficultyBody": "Moeilijk verbergt de hints over landmarks en winkels in een buurt",
    "settings.rounds": "Rondes per quiz",
    "settings.roundsBody": "Aantal straatonderdelen per sessie",
    "settings.cache": "Offline cache",
    "settings.cacheBody": "Bewaart opgevraagde buurten, straatgeometrie en hints lokaal, zodat alles direct laadt en er minder netwerkverkeer nodig is.",
    "settings.cacheCount": "{features} plekken in cache over {entries} zoekopdrachten",
    "settings.clearCache": "Cache wissen",
    "settings.clearCacheConfirm": "Alle gecachte kaartonderdelen wissen? Ze worden zo nodig opnieuw opgehaald.",
    "settings.apply": "Toepassen en verder",
    "auth.createAccount": "Account aanmaken",
    "auth.signIn": "Inloggen",
    "auth.email": "E-mail",
    "auth.password": "Wachtwoord",
    "auth.pleaseWait": "Even geduld\u2026",
    "auth.haveAccount": "Heb je al een account? Log in",
    "auth.newHere": "Nieuw hier? Maak een account aan",
    "auth.couldNotSignIn": "Inloggen is niet gelukt.",
    "postcard.saving": "Opslaan\u2026",
    "postcard.saveError": "Opslaan mislukte, probeer opnieuw",
    "postcard.save": "Postkaart opslaan",
    "feedback.reportProblem": "Meld een probleem",
    "ride.hint.keys": "Pijltjes / WASD - Rijden    SPATIE - Driften    TAB - Kaart    -/+ Zoom",
    "ride.hint.touch": "Links: Sturen    Rechts: Gas/Rem    Dubbeltik: Driften",
    "ride.introStreets": "Rijd door het echte stratennetwerk en benoem elke straat na de bocht",
    "ride.introCanals": "Rijd door het echte grachtennetwerk en benoem elke waterweg na de bocht",
    "ride.introTransit": "Rijd echte tramcorridors en benoem de lijnen en haltes",
    "ride.nextRoute": "Volgende route",
    "ride.nextStop": "Volgende stop",
    "ride.routeSetup": "Route instellen",
    "ride.shareRoute": "Deel deze route",
    "ride.linkCopied": "Link gekopieerd",
    "ride.startExploring": "Begin met verkennen",
    "ride.noCycling": "Geen fietsen in het echt",
    "ride.wikipediaLink": "Wikipedia \u2197",
    "ride.researchSource": "Bron \u2197",
    "ride.rules.title": "HOE SPEEL JE",
    "ride.rules.bike1": "1. Stuur de fiets met WASD of de pijltjestoetsen",
    "ride.rules.bike2": "2. Blijf op gemapte straten; de wegbeveiliging houdt je op het netwerk",
    "ride.rules.bike3": "3. Sla je een anders genoemde straat in, benoem die dan",
    "ride.rules.boat1": "1. Stuur de boot met WASD of de pijltjestoetsen",
    "ride.rules.boat2": "2. De boot vertraagt sterk zodra hij gemapt water verlaat",
    "ride.rules.boat3": "3. Vaar je een anders genoemde waterweg in, benoem die dan",
    "ride.rules.transit1": "1. Volg de gemapte corridor richting de bestemming",
    "ride.rules.transit2": "2. Haltes en lijnnamen zijn hier de vragen",
    "ride.rules.transit3": "3. Stap je over op een anders genoemde lijn, benoem die dan",
    "ride.rules.labels": "4. Kaartlabels zijn verborgen: navigeer op de vorm van de stad",
    "ride.rules.map": "5. TAB wisselt de overzichtskaart; -/+ verandert de zoom",
    "ride.rules.prototype": "6. Dit is een vroeg prototype \u2014 feedback is het doel",
    "finish.destination": "je bestemming",
    "finish.newNames.one": "{count} nieuwe naam",
    "finish.newNames.other": "{count} nieuwe namen",
    "finish.newNeighborhoods.one": "{count} nieuwe buurt",
    "finish.newNeighborhoods.other": "{count} nieuwe buurten",
    "finish.newLandmarks.one": "{count} landmark",
    "finish.newLandmarks.other": "{count} landmarks",
    "finish.arrivedWith": "Je bent bij {destination} \xB7 {bits}",
    "finish.arrived": "Aangekomen bij {destination}",
    "finish.sticks": "Die kennis blijft hangen op je kaart van {city}.",
    "finish.cleanRide": "Een schone rit \u2014 herhaal de volgende keer iets dat te laat is.",
    "finish.passport": "Paspoort: {stamps}",
    "finish.youKnow": "Je kent {name}",
    "finish.streakFirst": "Eerste nieuwe plek vandaag",
    "finish.streakDays": "{count} dagen op rij nieuwe plekken"
  };

  // src/i18n/language.ts
  var LANGUAGE_STORAGE_KEY = "canalRecall.language.v1";
  function isLanguage(value) {
    return value === "en" || value === "nl";
  }
  function languageFromTags(tags) {
    for (const tag of tags || []) {
      if (typeof tag !== "string") continue;
      const base = tag.trim().toLowerCase().split(/[-_]/)[0];
      if (base === "nl") return "nl";
      if (base === "en") return "en";
    }
    return "en";
  }
  function browserLanguage() {
    if (typeof navigator === "undefined") return "en";
    const tags = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language];
    return languageFromTags(tags);
  }
  function readLanguage(store) {
    try {
      const raw = store?.getItem(LANGUAGE_STORAGE_KEY);
      return isLanguage(raw) ? raw : browserLanguage();
    } catch {
      return browserLanguage();
    }
  }

  // src/i18n/index.ts
  var CATALOGS = { en, nl };
  var LANGUAGE_NAMES = {
    en: en["language.en"],
    nl: en["language.nl"]
  };
  var current = null;
  function storage() {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      return null;
    }
  }
  function language() {
    if (!current) current = readLanguage(storage());
    return current;
  }
  var PLACEHOLDER = /\{(\w+)\}/g;
  function fill(template, params) {
    if (!params) return template;
    return template.replace(PLACEHOLDER, (match, name) => {
      const value = params[name];
      return value === void 0 || value === null ? match : String(value);
    });
  }
  function t(key, params) {
    const catalog = CATALOGS[language()];
    const template = catalog[key] ?? en[key];
    if (template === void 0) {
      if (typeof console !== "undefined") console.warn(`[i18n] missing message: ${key}`);
      return String(key);
    }
    return fill(template, params);
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
  var FACT_KIND_LABELS_NL = {
    naming: "Naam",
    history: "Geschiedenis",
    people: "Mensen",
    design: "Ontwerp",
    culture: "Cultuur",
    surprise: "Weetje"
  };
  function factKindLabel(kind) {
    return language() === "nl" ? FACT_KIND_LABELS_NL[kind] : FACT_KIND_LABELS[kind];
  }
  function factText(fact) {
    return language() === "nl" && fact.textNl ? fact.textNl : fact.text;
  }

  // src/canalRecall/facts/factStore.ts
  function buildFactIndex(file) {
    const index = /* @__PURE__ */ new Map();
    for (const feature of file?.features || []) {
      if (feature?.id && feature.facts?.length) {
        index.set(feature.id, {
          facts: feature.facts,
          opening: feature.opening?.trim() || void 0,
          openingNl: feature.openingNl?.trim() || void 0
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
      if (/^\p{Lu}\p{L}*sz$/u.test(word)) return false;
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
  function composeFactWithOpening(factText2, opening) {
    const lead = openingSentence(opening);
    if (!lead) return { detail: factText2 };
    if (similarity(lead, factText2) >= 0.55) return { detail: factText2 };
    const leadStem = lead.replace(/[.!?…]+$/, "").toLowerCase();
    if (leadStem.length >= 24 && factText2.toLowerCase().includes(leadStem.slice(0, Math.min(48, leadStem.length)))) {
      return { detail: factText2 };
    }
    return { detail: `${lead} ${factText2}`, opening: lead };
  }
  var ROTATION_STORAGE_KEY = "canalRecall.factRotation.v1";
  function loadRotationState(storage2) {
    try {
      const raw = storage2?.getItem(ROTATION_STORAGE_KEY);
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
  function saveRotationState(storage2, state) {
    try {
      storage2?.setItem(ROTATION_STORAGE_KEY, JSON.stringify(pruneHistory(state)));
    } catch {
    }
  }
  function factCardText(featureId, index, state, fallbackOpening) {
    const entry = index.get(featureId);
    if (!entry?.facts?.length) return null;
    const choice = chooseFact(featureId, entry.facts, state);
    if (!choice) return null;
    const dutch = language() === "nl";
    const dutchFact = dutch && !!choice.fact.textNl;
    const factBody = dutchFact ? choice.fact.textNl : choice.fact.text;
    const composed = composeFactWithOpening(
      factBody,
      dutchFact ? entry.openingNl : entry.opening || fallbackOpening
    );
    const others = expandedFacts(entry.facts, choice.fact.text);
    const all = composed.opening ? [composed.opening, factBody, ...others.map((fact) => factText(fact))] : [factBody, ...others.map((fact) => factText(fact))];
    return {
      choice,
      text: {
        detail: composed.detail,
        longDetail: all.join(" "),
        factTexts: all,
        factKind: factKindLabel(choice.fact.kind)
      }
    };
  }
  function commitShownFact(storage2, state, choice) {
    const next = recordShown(state, choice);
    saveRotationState(storage2, next);
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

  // src/canalRecall/bridgeLedeRepair.ts
  var NOT_A_SENTENCE_END = /(?:^|[\s(])(?:[A-Z][a-z]?|[A-Z]\.[A-Z]|Mr|Dr|Ir|St|Prof|ca|nr|no|[A-Z][a-z]*s?z)\.$/;
  function ledeSentences(text) {
    const pieces = text.trim().split(/(?<=[.!?])\s+(?=[A-Z"'“‘(0-9])/u).filter(Boolean);
    const sentences2 = [];
    for (const piece of pieces) {
      const previous = sentences2[sentences2.length - 1];
      if (previous !== void 0 && NOT_A_SENTENCE_END.test(previous)) sentences2[sentences2.length - 1] = `${previous} ${piece}`;
      else sentences2.push(piece);
    }
    return sentences2;
  }

  // src/canalRecall/game/routeKnowledge.ts
  var eligible = (entry) => entry.wikipediaUrl || entry.wikipediaExtract || entry.nameOrigin || entry.nameOriginNl;
  function buildRouteKnowledgeIndex(legacy, streets, waters, normalise, origins = [], bridgeRegister = {}, bridges = []) {
    const index = /* @__PURE__ */ new Map();
    const add = (entry, type) => {
      index.set(`${type}:${normalise(entry.name)}`, { ...entry, type });
    };
    for (const entry of legacy) add(entry, entry.type === "water" ? "water" : "street");
    for (const entry of streets) if (eligible(entry)) add(entry, "street");
    for (const entry of waters) if (eligible(entry)) add(entry, "water");
    for (const bridge of bridges) {
      if (!bridge.name || !bridge.wikipediaExtract) continue;
      if (bridge.wikipediaExtractLang && bridge.wikipediaExtractLang !== "en") continue;
      index.set(`bridge:${normalise(bridge.name)}`, {
        id: bridge.id,
        name: bridge.name,
        type: "bridge",
        wikipediaExtract: bridge.wikipediaExtract,
        ...bridge.wikipediaUrl ? { wikipediaUrl: bridge.wikipediaUrl } : {},
        ...bridge.wikipediaImageUrl ? { wikipediaImageUrl: bridge.wikipediaImageUrl } : {}
      });
    }
    for (const origin of origins) {
      if (!origin.en) continue;
      const type = origin.kind;
      const key = `${type}:${normalise(origin.name)}`;
      const existing = index.get(key);
      const dutch = origin.nl ? { nameOriginNl: origin.nl } : {};
      index.set(key, existing ? { ...existing, nameOrigin: origin.en, ...dutch } : { name: origin.name, type, nameOrigin: origin.en, ...dutch });
    }
    for (const [name, fact] of Object.entries(bridgeRegister)) {
      const structureFact = describeRegisteredBridge(fact);
      if (!structureFact) continue;
      const key = `bridge:${normalise(name)}`;
      const existing = index.get(key);
      index.set(key, existing ? { ...existing, structureFact } : { name, type: "bridge", structureFact });
    }
    for (const bridge of bridges) {
      if (!bridge.name || !bridge.displayName) continue;
      const key = `bridge:${normalise(bridge.name)}`;
      const existing = index.get(key);
      if (existing) index.set(key, { ...existing, name: bridge.displayName });
    }
    return index;
  }
  var sentencesOf = (text) => ledeSentences(text).map((part) => part.trim()).filter(Boolean);
  var STREET_CARD_DETAIL_CHARS = 150;
  var STREET_CARD_LONG_CHARS = 280;
  var originOf = (entry) => language() === "nl" && entry.nameOriginNl ? entry.nameOriginNl : entry.nameOrigin;
  function streetCardText(entry) {
    const fact = (entry.structureFact || "").trim();
    const text = structureLessCardText(entry);
    if (!fact) return text;
    if (!text.detail) return { detail: fact, longDetail: fact };
    const room = STREET_CARD_LONG_CHARS - fact.length - 1;
    const lead = sentencesUpTo(sentencesOf(`${originOf(entry) || ""} ${entry.wikipediaExtract || ""}`), room);
    return { detail: text.detail, longDetail: lead ? `${lead} ${fact}` : fact };
  }
  function streetCardWithRotatedFact(entry, rotated) {
    const origin = (originOf(entry) || "").trim();
    const fact = (entry.structureFact || "").trim();
    if (!origin && !fact) return rotated;
    const text = streetCardText({ ...entry, wikipediaExtract: rotated.longDetail });
    return {
      detail: origin ? text.detail : rotated.detail,
      longDetail: text.longDetail,
      factTexts: [origin, ...rotated.factTexts, fact].filter(Boolean),
      factKind: rotated.factKind
    };
  }
  function structureLessCardText(entry) {
    const origin = sentencesOf(originOf(entry) || "");
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
  function canShowPostcard(_viewportMode, input) {
    return canShowTeachingCard(input);
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
      this.loads.clear();
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
    /** The tile under a point, for a click outside the prefetched 3×3 or before
     *  it has arrived. Resolves when that tile's rows are in (or known absent). */
    ensureAt(lng, lat) {
      const { x, y } = factTileOf(lng, lat);
      return this.load(x, y);
    }
    loads = /* @__PURE__ */ new Map();
    load(x, y) {
      const key = `${x}/${y}`;
      let pending = this.loads.get(key);
      if (!pending) this.loads.set(key, pending = this.fetchTile(key));
      return pending;
    }
    async fetchTile(key) {
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

  // src/canalRecall/landmarks/manualModelsShared.ts
  var shared = globalThis.CanalRecallSignatureLandmarks;
  if (!shared?.MANUAL_LANDMARKS || !shared.MANUAL_ORDINARY_BUILDINGS || !shared.ALL_MANUAL_LANDMARKS) {
    throw new Error("signature-placement.bundle.js must load before this bundle: it carries the manual-model catalogue.");
  }
  var ALL_MANUAL_LANDMARKS = shared.ALL_MANUAL_LANDMARKS;
  var MANUAL_LANDMARKS = shared.MANUAL_LANDMARKS;
  var MANUAL_ORDINARY_BUILDINGS = shared.MANUAL_ORDINARY_BUILDINGS;

  // src/canalRecall/buildingCategory.ts
  var countsAsLandmark = (spec) => (spec.buildingCategory ?? "landmark") === "landmark";

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
  var SIGNATURE_MODELS = [...surveyedLandmarks_default.filter((entry) => !MANUAL_LANDMARKS.some((model) => model.id === entry.id)).map(specFromCatalogue), ...MANUAL_LANDMARKS.filter(countsAsLandmark)];

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
    },
    {
      modelId: "brouwerij-het-ij",
      name: "Brouwerij \u2019t IJ",
      center: [
        52.3666977,
        4.9263471
      ],
      description: "Brouwerij \u2019t IJ began in 1985 when musician Kaspar Peterson turned the former Funen municipal bathhouse into a brewery. The bathhouse opened in 1911, providing showers for homes without bathrooms. The brewery and its tasting room occupy the separate brick bathhouse beside De Gooyer windmill; the mill itself remains a distinct historic building.",
      sourceUrl: "https://www.brouwerijhetij.nl/de-brouwerij",
      preferDescription: true
    },
    {
      modelId: "vinoly",
      name: "Vi\xF1oly",
      description: "Vi\xF1oly is Rafael Vi\xF1oly Architects\u2019 2005 Mahler4 office tower in Zuidas. An exterior stair spirals through notches cut into its glass and aluminium facade, tying the offset podium, middle volume and tower into one composition. The planned public rooftop stair access was closed for safety before opening. Its podium contains independently serviced ground-floor retail and a glass-covered two-story patio.",
      sourceUrl: "https://vinoly.com/works/mahler-4-office-tower/",
      routeDestination: {
        center: [
          52.33768,
          4.87262
        ]
      }
    },
    {
      modelId: "el-tawheed",
      landmarkId: "extract_landmarks_1862244163",
      name: "El Tawheed",
      description: "El Tawheed occupies a former clothing factory on Jan Hanzenstraat. The building later housed an etui and box maker and then the Amex metal workshop before becoming a mosque and cultural centre in 1997. Its factory facade retains six tall window bays and a projecting cornice; the former name panel is now whitewashed.",
      sourceUrl: "https://amsterdamopdekaart.nl/1850-1940/Jan_Hanzenstraat/114",
      preferDescription: true,
      destinationOverride: {
        center: [
          52.36763342532987,
          4.8640231890577725
        ]
      },
      routeDestination: {
        center: [
          52.36763342532987,
          4.8640231890577725
        ]
      }
    },
    {
      modelId: "haparandaweg-2-4",
      name: "Het 4e Gymnasium",
      center: [
        52.3941814,
        4.8730885
      ],
      description: "Paul de Ruiter Architects designed this school as an early anchor for the Houthaven redevelopment. Coloured enamel glass and projecting wooden sun frames distinguish the classroom facades; two sports halls and a roof terrace occupy the upper level.",
      funFact: "The school atrium doubles as a lunch and theatre space. Its upper sports halls have a separate entrance for clubs and neighbours, while a south entrance serves the bicycle store. The architect dates completion to 2016; BAG records construction year 2015.",
      sourceUrl: "https://paulderuiter.nl/projects/het-4th-vierde-gymnasium",
      website: "https://www.het4egymnasium.nl/",
      destinationOverride: {
        center: [
          52.394106,
          4.872795
        ]
      },
      routeDestination: {
        center: [
          52.394106,
          4.872795
        ]
      }
    },
    {
      modelId: "afrikahuis",
      name: "Afrikahuis",
      description: "Architect Joop van Stigt designed Afrikahuis as five linked octagonal units, combining a church with neighborhood spaces. Its concrete base, limestone walls and glazed staircase bays express Amsterdam structuralism.",
      sourceUrl: "https://amsterdamopdekaart.nl/1966-1990/Van_Ostadestraat/Afrikahuis",
      additionalSources: [
        "https://erfgoedregister.amsterdam.nl/monument/34d28c9d-f6c7-44bc-affa-d3d2c055b7a9/"
      ]
    },
    {
      modelId: "cafe-kobalt",
      name: "Caf\xE9 Kobalt",
      center: [
        52.3795667,
        4.8943639
      ],
      description: "Caf\xE9 Kobalt occupies a protected double corner house built between 1606 and 1611. Its high stepped gable, wooden frontage and wheelbarrow fa\xE7ade stone recall the former warehouse.",
      funFact: "Kobalt\u2019s seventeenth-century corner house retains a broad stepped gable, wooden frontage and a wheelbarrow fa\xE7ade stone. The caf\xE9 describes the building as a former warehouse.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/5249",
      preferDescription: true
    },
    {
      modelId: "podium-mozaiek",
      name: "Podium Moza\xEFek",
      description: "The theatre occupies B. T. Boeyinga\u2019s 1954 Pni\xEBlkerk. Its geometric glass-block facade gave the church the nickname \u201Cthe tealight\u201D; the former worship space became a multicultural performance venue in 2005.",
      sourceUrl: "https://podiummozaiek.nl/over-ons/overzicht",
      preferDescription: true,
      website: "https://podiummozaiek.nl/",
      funFact: "The theatre occupies B. T. Boeyinga\u2019s 1954 Pni\xEBlkerk. Its geometric glass-block facade gave the church the nickname \u201Cthe tealight\u201D; the former worship space became a multicultural performance venue in 2005.",
      additionalSources: [
        "https://data.amsterdam.nl/monumenten/f3d3ac3d-299c-4e46-9fdc-06abe8606e48",
        "https://www.o-drie.nl/en/podium-mozaiek"
      ]
    },
    {
      modelId: "dorus-theus-brug",
      name: "Dorus Theus Brug",
      description: "This small water garden in Erasmusgracht is a rainwater filter. Runoff first enters a settling basin, then passes through two planted reed beds before cleaner water returns to the canal. A narrow wooden walk connects the stone-edged filter islands with the surrounding banks.",
      sourceUrl: "https://weerproof.nl/project/helofytenfilter-erasmusgracht/",
      preferDescription: true,
      center: [
        52.3766581,
        4.8564044
      ],
      destinationOverride: {
        center: [
          52.3766581,
          4.8564044
        ]
      },
      routeDestination: {
        center: [
          52.3766581,
          4.8564044
        ]
      }
    },
    {
      modelId: "collectie-six",
      name: "Collectie Six",
      description: "Collectie Six occupies the protected double house at Amstel 218. Built in 1662\u20131668, it retains an eighteenth-century cornice, two roof dormers and a carved double stoop with eight bottle-shaped balusters.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/230",
      additionalSources: [
        "https://www.collectiesix.nl/home"
      ],
      preferDescription: true
    },
    {
      modelId: "oosterparkkerk",
      name: "Oosterparkkerk",
      description: "Abraham Salm designed this church for Amsterdam\u2019s Mennonite congregation in1904. Its restrained Art Nouveau front combines sandstone detailing, stained glass and a wrought-iron entrance canopy. A small roof turret replaces a full bell tower; the adjacent caretaker\u2019s house belongs to the same building.",
      sourceUrl: "https://www.oosterparkkerk.nl/het-gebouw-en-geschiedenis",
      destinations: [
        {
          landmarkId: "extract_landmarks_1606629595",
          name: "Oosterparkkerk",
          center: [
            52.36005012574633,
            4.915873654538593
          ],
          destinationOverride: {
            center: [
              52.36005012574633,
              4.915873654538593
            ]
          }
        }
      ]
    },
    {
      modelId: "mediamatic",
      name: "Mediamatic Biotoop Dijkspark",
      center: [
        52.376368,
        4.913118
      ],
      description: "This waterfront biotope hosts laboratories, workshops and gardens. The operator describes its Hydroponics Greenhouse as growing herbs and edible flowers for restaurant TestTafel, a partnership with De Sering.",
      funFact: "Mediamatic transformed former municipal bridge-maintenance buildings at Dijksgracht into a bio-art laboratory and added 360 m\xB2 of greenhouse space around them. Its experiments bring artists, designers and living organisms together.",
      sourceUrl: "https://www.mediamatic.net/nl/page/73377/mediamatic-has-moved-to-dijkspark-in-2014",
      preferDescription: true
    },
    {
      modelId: "oba-oosterdok",
      name: "Amsterdam Public Library Oosterdok",
      description: "Jo Coenen designed OBA Oosterdok, which opened on 7 July 2007. Its monumental pale stone frame encloses heavy wooden window frames; seven floors combine books and study spaces with cultural activities.",
      sourceUrl: "https://arcam.nl/architectuur-gids/openbare-bibliotheek-amsterdam/",
      preferDescription: true
    },
    {
      modelId: "fire-station-hendrik",
      name: "Brandweerkazerne Hendrik",
      center: [
        52.37250179,
        4.87559942
      ],
      description: "Hendrik has occupied the curved station at the Rozengracht\u2013Marnixstraat corner since 1985. Its name retains the H of the Huiszittenhuis, the former station on Prinsengracht. The building reopened on 6 November 2025 after renovation and energy upgrades.",
      sourceUrl: "https://www.koninklijkewoudenberg.nl/nieuws/feestelijke-opening-van-de-gerenoveerde-brandweerkazerne-hendrik/"
    },
    {
      modelId: "fire-station-dirk",
      name: "Kazerne Dirk",
      center: [
        52.357901091,
        4.885977871
      ],
      description: "Designed by Hendrik Leguyt, Dirk opened in 1897 beside the Museumplein. Three arched vehicle entrances, stepped brick gables and Amsterdam\u2019s arms distinguish the working fire station. Its 2021\u20132023 renovation restored decorated masonry and made the monument gas-free. The name preserves D for Duivelseiland from the earlier station.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/1994",
      routeDestination: {
        center: [
          52.35788662,
          4.885995529
        ],
        sourceUrl: "https://data.amsterdam.nl/",
        note: "Two metres outside surveyed central Honthorststraat vehicle arch, checked against archived 2025 municipal panorama; camera location is separate."
      }
    },
    {
      modelId: "fire-station-nico",
      name: "Brandweerkazerne Nico",
      description: "Nico retains the N of Nieuwmarkt: the station once operated from De Waag, then De Ruijterkade, before moving beside the IJtunnel in 1973. OPL renovated the station and its offices in 2017\u20132018. A 2025 roof renovation stripped the roof to its concrete structure and added 140 mm PIR insulation around the many aerials and installations.",
      sourceUrl: "https://www.brandweer.nl/kazerne/amsterdam-nico/",
      center: [
        52.3702813,
        4.9095912
      ],
      routeDestination: {
        center: [
          52.370273,
          4.909458
        ],
        note: "Approximate northwest public apron frontage checked against exact native BAG edge and current photos"
      }
    },
    {
      modelId: "fire-station-osdorp",
      name: "Kazerne Osdorp",
      description: "Opened in 2005, Osdorp\u2019s station was designed by dietzsch + van der sanden around the rapid movement of crews and vehicles. Its transparent vehicle hall has a rolling sedum roof; a glazed corridor joins it to a quieter brick block containing the crew\u2019s living spaces. The station is also known as the Fanny Blankers-Koen kazerne.",
      sourceUrl: "https://arcam.nl/architectuur-gids/brandweerkazerne-osdorp/",
      center: [
        52.3664870928522,
        4.802462823962739
      ],
      routeDestination: {
        center: [
          52.3664713021276,
          4.802471307901373
        ],
        note: "Main external pedestrian entrance under source-visible balcony, mapped on exact native southern facade, route pin1.85m outward into open forecourt. Station interiors not publicly accessible; preserve destination on route failure."
      }
    },
    {
      modelId: "fire-station-teunis",
      name: "Kazerne Teunis",
      description: "Teunis began as the first professional fire station in Amsterdam-West, temporarily housed in the GVB garage on Jan Tooropstraat from 1959 to 1965. After several moves, the fire service records its arrival at Vredenhofweg in 2011; the present building has a BAG construction year of 2013. Its three vehicle bays sit beneath a red canopy and an open upper terrace.",
      sourceUrl: "https://www.brandweer.nl/kazerne/amsterdam-teunis/",
      center: [
        52.3846258,
        4.863427
      ],
      routeDestination: {
        center: [
          52.384554,
          4.863296
        ],
        note: "Source-visible pedestrian entrance immediately south of three vehicle bays; destination2m outside native west wall on Vredenhofweg pavement. Building interior is operational fire-service space."
      }
    },
    {
      modelId: "fire-station-victor",
      name: "Brandweerkazerne Victor",
      description: "Victor was Amsterdam\u2019s first fire station without horse stables: its early electrically powered fire engines had a large charging station here. The V name dates from its former Pieter Vlamingstraat station. The original building combined fire station and living quarters; the whole building now serves the fire brigade.",
      sourceUrl: "https://www.brandweer.nl/kazerne/amsterdam-victor/",
      center: [
        52.360452,
        4.929157
      ],
      routeDestination: {
        center: [
          52.360452,
          4.929157
        ],
        note: "Current Dapperstraat public pavement at twin apparatus portals; source footprint and photographs."
      }
    },
    {
      modelId: "fire-station-willem",
      name: "Kazerne Willem",
      description: "Willem preserves the W of Weesper: the station began at Weesperplein in 1873, moved to Nieuwe Achtergracht in 1909, and has operated from Ringdijk since 1984. The renovated panels above the fire-engine doors use charred Marugame wood selected by ENZO architects for its durability.",
      sourceUrl: "https://www.brandweer.nl/kazerne/amsterdam-willem/",
      center: [
        52.348947095579625,
        4.914877307883409
      ]
    },
    {
      modelId: "fire-station-ijsbrand",
      name: "Brandweerkazerne IJsbrand",
      description: "Built in 2001 on Displaystraat, IJsbrand is one of Amsterdam-Noord\u2019s two professional fire stations. It houses the crews of a fire engine and an aerial ladder: eight firefighters in total. The IJsbrand name reaches back to a 1916 fire post in a wooden emergency village near Grasweg. The current station, named for Cornelia Frida Katz, replaced both the Berberisstraat and Molenwijk stations in 2001.",
      sourceUrl: "https://www.brandweer.nl/kazerne/amsterdam-ijsbrand/",
      center: [
        52.406279,
        4.889718
      ]
    },
    {
      modelId: "fire-station-pieter",
      name: "Kazerne Pieter",
      description: "A beige concrete-and-brick fire station on Poeldijkstraat, with five red glazed fire-engine doors, a projecting glazed watchroom and a setback upper room. It opened on 10 May 1972 to replace the fire stations in Sloten and Oud Osdorp. Pieter gets its name from the code letter P for Poeldijkstraat. The station formerly housed a hose workshop, shoemaker and clothing depot; its current specialist role is responding to incidents involving hazardous substances.",
      sourceUrl: "https://www.brandweer.nl/kazerne/amsterdam-pieter/",
      center: [
        52.348825,
        4.84376
      ]
    },
    {
      modelId: "fire-station-zebra",
      name: "Kazerne Zebra",
      description: "Kazerne Zebra opened on IJdoornlaan in 1973 as Amsterdam-Noord grew. Its brick station has three red vehicle doors, ribbon windows and a separate tall hose tower. The Z came from the old fire post on Zamenhofstraat. The service chose Zebra from the English telephone alphabet because Zaandam could cause confusion in Amsterdam-Noord and Zulu was also unsuitable. The former Zamenhofstraat post now houses Noordje\u2019s art and language projects for young people.",
      sourceUrl: "https://www.brandweer.nl/kazerne/amsterdam-zebra/",
      center: [
        52.39614497764802,
        4.954761362465582
      ]
    },
    {
      modelId: "fire-station-weesp",
      name: "Kazerne Weesp",
      description: "Weesp\u2019s volunteer fire station moved from the Achtergracht to the Aetsveldselaan in 2011. Its history began in 1888 in a former telegraph and post office with five hand pumps. The present station combines a curved four-bay appliance hall with a timber-faced upper volume and distinctive trapezoidal glazing. ",
      sourceUrl: "https://www.brandweer.nl/kazerne/weesp/",
      center: [
        52.3025707,
        5.0449773
      ],
      routeDestination: {
        center: [
          52.302535,
          5.044978
        ],
        note: "Source-supported public pedestrian entrance approach on southern frontage."
      }
    },
    {
      modelId: "fire-station-driemond",
      name: "Kazerne Driemond",
      description: "Driemond\u2019s fire station is also known as Kazerne Maxima. Its two red glazed apparatus doors stand beside a taller brick and glass office wing at Lentestraat 30. The station hosts local safety days with the emergency services. ",
      sourceUrl: "https://www.brandweer.nl/kazerne/driemond/",
      center: [
        52.307008,
        5.01935
      ]
    },
    {
      modelId: "fire-station-anton",
      name: "Kazerne Anton",
      description: "ME-2 architects designed this 2016 station as an elbow around a private rear yard. Four gray brick shades echo the layers of stone and surrounding traffic. Three response vehicles leave from the raised ground floor; sports rooms occupy the lower level and recreation space sits above. A deliberate clean/dirty route keeps soot from equipment out of the living rooms.",
      sourceUrl: "https://www.brandweer.nl/kazerne/amsterdam-anton/",
      center: [
        52.307150805532515,
        4.973277542354208
      ],
      routeDestination: {
        center: [
          52.306919,
          4.97352
        ],
        note: "Public Langbroekdreef approach beside the station driveway,27.6m from the former isolated apron point. Current mapped road coordinates cross-checked against sourced station plot; actual chosen destination remains Anton."
      }
    },
    {
      modelId: "this-is-holland",
      name: "This is Holland",
      description: "Opened in2017, This is Holland uses moving seats and a panoramic screen for a simulated flight over Dutch landscapes. Its circular pavilion stands between Eye and A\u2019DAM Toren.",
      funFact: "The pavilion recalls the oil drums that once stood on Shell\u2019s Overhoeks site. Its raised silver drum houses the flight experience above a six-metre-high sawtooth glass foyer, supported by mushroom-shaped columns rising from the underground garage.",
      sourceUrl: "https://www.damastarchitects.nl/this-is-holland-amsterdam",
      center: [
        52.3842002,
        4.902329
      ],
      routeDestination: {
        center: [
          52.3841332,
          4.9024943
        ],
        note: "OSM node 11182027586 public entrance on the southeast foyer; pin stays on the existing genuine extract."
      }
    },
    {
      modelId: "luther-museum",
      name: "Luther Museum Amsterdam",
      description: "The museum occupies the historic regents\u2019 rooms of Wittenberg, the former Lutheran Diaconiehuis. The building\u2019s paired entrances once separated the elderly residents from the orphans; its two courtyards remain open within the large brick block.",
      funFact: "Wittenberg\u2019s two grand canal-side entrances originally led to separate departments: one for elderly residents and one for orphaned children.",
      sourceUrl: "https://luthermuseum.nl/nl/over-het-museum",
      center: [
        52.3655242,
        4.9088495
      ],
      routeDestination: {
        center: [
          52.365537,
          4.908862
        ],
        note: "Current municipal2024panorama00113 and2025panorama02683 show museum banner and panel by west/photographic-right historic door; coordinate reconstructed on that surveyed frontage, exact address point preserved until route accessibility review."
      }
    },
    {
      modelId: "huize-frankendael",
      name: "Huize Frankendael",
      description: "Frankendael is the last surviving country estate in the Watergraafsmeer, where wealthy Amsterdammers once built many summer retreats. Izaak Balde gave the house its present central pavilion and lower coach-house wings around 1733. Restaurant Merkelbach occupies a former coach house, named for city architect Ben Merkelbach, who moved into the house in 1957.",
      sourceUrl: "https://huizefrankendael.nl/nl/over/geschiedenis-huize-frankendael/",
      center: [
        52.351122,
        4.933403
      ],
      routeDestination: {
        center: [
          52.351191,
          4.933559
        ],
        note: "Existing center falls on rear bay; sourced public main entrance is northeast. Root should only relocate pin if routing requires or improves actual entrance."
      }
    },
    {
      modelId: "uilenburger-synagoge",
      landmarkId: "extract_landmarks_452804039",
      name: "Uilenburger Synagoge",
      description: "Built in 1766 for Amsterdam\u2019s Ashkenazi Jewish community, the Uilenburgersjoel has a three-aisled synagogue hall above a lower room originally used for ritual slaughter. Its broad bell-shaped front gable faces a forecourt behind a street wall. The restored building now hosts Jewish cultural and social gatherings, concerts and other events.",
      sourceUrl: "https://www.uilenburgersjoel.nl/the-uilenburger-synagogue/",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/5798",
        "https://www.uilenburgersjoel.nl/wp-content/uploads/2024/03/01.Uilenburgersjoel-informatie-en-catering.pdf"
      ]
    },
    {
      modelId: "nieuwendammerkerk",
      landmarkId: "extract_landmarks_767085118",
      name: "Nieuwendammerkerk",
      description: "Hidden behind the Nieuwendammerdijk, this village church stands on Brede Kerkepad with its surrounding graveyard. The present hall church opened in 1849; its tower preserves a bell cast in Kampen in 1644 for the earlier church.",
      funFact: "A water-level stone inside recalls the 1916 flood. The timber roof uses a hammerbeam-like structure, while the tower bell is two centuries older than the present church.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/508536",
      additionalSources: [
        "https://nieuwendammerkerk.nl/gebouwen-nieuwendammerkerk/"
      ]
    },
    {
      modelId: "meerpadkerk",
      landmarkId: "extract_landmarks_1566771183",
      name: "Meerpadkerk",
      description: "This small white timber Mennonite meeting house in Nieuwendam was built by local carpenter Pieter Kater Gzn and opened on 9 July 1843. Its towerless hall, arched fanlight windows and classical doorway survive beside the Meerpad. It belongs to the United Mennonite Congregation of Amsterdam and is protected as Rijksmonument 6695.",
      sourceUrl: "https://www.doopsgezindamsterdam.nl/historie/meerpadkerk/",
      additionalSources: [
        "https://kennis.cultureelerfgoed.nl/index.php/Monumenten/6695"
      ]
    },
    {
      modelId: "hannekes-boom",
      name: "Hannekes Boom",
      center: [
        52.3762934,
        4.9116163
      ],
      description: "Hannekes Boom is a waterside cafe and cultural meeting place at the head of the Dijksgracht. Its name recalls the guarded harbour openings that once used floating timber barriers. The present venue reopened in 2011 after its foundation won a municipal competition to revive the site.",
      funFact: "Its name refers to the historic guarded harbour openings: floating tree trunks on chains closed these passages each evening, with bells announcing the opening and closing.",
      sourceUrl: "https://hannekesboom.nl/en/history/",
      preferDescription: true
    },
    {
      modelId: "posthoornkerk",
      name: "Posthoornkerk",
      center: [
        52.381461,
        4.890663
      ],
      description: "Pierre Cuypers designed this early Gothic revival basilica in 1860. Its narrow site led to two galleries above each side aisle; the twin-tower street front was added in 1887\u20131889. The former church now hosts cultural events and offices.",
      funFact: "The name came from an earlier concealed Catholic church behind Prinsengracht 7, at a former Haarlem post-coach premises. Residents organized to save the Posthoornkerk from demolition; restoration preserved its great central space for public activities.",
      sourceUrl: "https://stadsherstel.nl/monumenten/de-posthoornkerk/",
      preferDescription: true,
      routeDestination: {
        center: [
          52.3810493226956,
          4.890236419908126
        ],
        note: "Public forecourt gate on Haarlemmerstraat; derived from current BAG frontage and inspected 2025 municipal panorama, approximate within 2m. Preserve original destination unless routing requires public-entrance correction."
      }
    },
    {
      modelId: "keizersgrachtkerk",
      landmarkId: "extract_landmarks_2099326007",
      name: "Keizersgrachtkerk",
      description: "Built in 1887\u20131888 for the Amsterdam Doleantie congregation, the Keizersgrachtkerk was designed by father and son G.B. and A. Salm. Its neo-Venetian facade places seven linked pointed windows below a large rose window, flanked by low towers. Inside, two galleries on cast-iron columns allowed a church planned for 1,600 worshippers to occupy a narrow canal-side plot. The organ of 1890 was D.G. Steenkuyl\u2019s last mechanical organ.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/518347",
      additionalSources: [
        "https://www.keizersgrachtkerk.nl/geschiedenis-van-de-keizersgrachtkerk/"
      ],
      preferDescription: true,
      routeDestination: {
        center: [
          52.3646801235429,
          4.8881806276757915
        ],
        note: "Photo-supported public main porch, 1.8m outward from actual Keizersgracht frontage midpoint; candidate must pass live network reachability. Preserve chosen destination on route failure."
      }
    },
    {
      modelId: "gerard-dou-synagogue",
      landmarkId: "extract_landmarks_25099441",
      name: "Gerard Dou Synagogue",
      description: "The congregation Tesjoengat Israel (Hulpe Isra\xEBls) commissioned E.M. Rood to build this synagogue in 1891\u20131892. Its narrow street front conceals a prayer hall with galleries on three sides, originally seating 250 men and 70 women. The paired round-arched windows, David-star oculus and ceremonial doorway belong to its eclectic neo-Renaissance architecture.",
      funFact: "The congregation remained active in this concealed street building during the occupation, and the preserved synagogue hosted early services after liberation.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/527843",
      additionalSources: [
        "https://www.nihs.nl/synagoges/gerard-dou/"
      ],
      preferDescription: true,
      routeDestination: {
        center: [
          52.35709575612273,
          4.897850161190556
        ],
        note: "Centre of the hall street frontage matched to the ceremonial door in the 2005 elevation and 2025 municipal panorama."
      }
    },
    {
      modelId: "lekstraat-synagoge",
      landmarkId: "extract_landmarks_665340356",
      name: "Lekstraatsynagoge",
      description: "Abraham Elzas designed this restrained modernist synagogue complex, completed in 1937, with a stone-faced main hall and a lower yellow-brick synagogue and residence wing. The small synagogue remains in use; the main hall later housed the Resistance Museum and an auction house.",
      funFact: "The Hebrew inscription on the otherwise largely blank front quotes 1 Kings 6:13. Elzas had worked with Le Corbusier; this modernist building stands among the Amsterdam School architecture of Plan Zuid.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/526707",
      additionalSources: [
        "https://www.nihs.nl/synagoges/lekstraat/",
        "https://lekstraatsynagoge.nl/about-us/"
      ],
      preferDescription: true,
      routeDestination: {
        center: [
          52.34428997517323,
          4.902942362182297
        ],
        note: "Lekstraat 61 approach derived from current BAG frontage and municipal panorama."
      }
    },
    {
      modelId: "petrus-en-paulus-kerk",
      landmarkId: "extract_landmarks_1828911806",
      name: "Sint-Petrus-en-Pauluskerk",
      description: "This Old Catholic church on Ruysdaelstraat was delivered in 1914 and, with its parsonage and schoolroom, forms one complex designed by Johan W.F. Hartkamp jr., a pupil of H.P. Berlage. It continues the hidden church De Ooievaar from the Barndesteeg.",
      funFact: "The church keeps a Dordrecht Rotating Tabernacle from 1789, a gift to the Amsterdam parish that reached it through De Ooievaar; one of its makers was Jacob van Strij.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Sint-Petrus-en-Pauluskerk_%28Amsterdam%29",
      preferDescription: true
    },
    {
      modelId: "maarten-lutherkerk",
      landmarkId: "extract_landmarks_404188843",
      name: "Maarten Lutherkerk",
      description: "The Maarten Luther Kerk is an Evangelical-Lutheran church in the Rivierenbuurt of Amsterdam-Zuid, designed by the architect F. Jantzen in the Amsterdam School style. Tall narrow windows climb the brick walls of the hall above a low band of small lights, and a slim green spire rises from the roof.",
      funFact: "The church's brick hall dates from 1937 according to the national building register (BAG), and it forms part of the Rivierenbuurt's Amsterdam School streetscape.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Maarten_Luther_Kerk_%28Amsterdam%29",
      preferDescription: true
    },
    {
      modelId: "museum-amsterdam-noord",
      landmarkId: "extract_landmarks_2034905768",
      name: "Museum Amsterdam Noord",
      description: "Museum Amsterdam Noord is a cultural-history museum on the corner of Zamenhofstraat and Meeuwenlaan in Amsterdam-Noord. Since April 2009 it has occupied the municipal bath house that was built in 1919 for the garden village of Vogeldorp, whose houses had no bathrooms. It holds a modest historical collection and a space for exhibitions, lectures and film evenings.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Museum_Amsterdam_Noord",
      additionalSources: []
    },
    {
      modelId: "levend-paardenmuseum",
      landmarkId: "extract_landmarks_82936853",
      name: "Levend Paardenmuseum",
      description: "The Living Horse Museum (Levend Paardenmuseum) is housed in the Hollandsche Manege, the oldest riding school in the Netherlands. The school dates back to 1744; the present building, inspired by the Spanish Riding School in Vienna, was built in 1882. Its richly decorated interior has an iron roof frame, and the building has been a national monument since 1974.",
      sourceUrl: "https://en.wikipedia.org/wiki/Hollandsche_Manege",
      additionalSources: [
        "https://nl.wikipedia.org/wiki/Hollandsche_Manege"
      ]
    },
    {
      modelId: "oudemanhuispoort",
      landmarkId: "extract_landmarks_1122909064",
      name: "Oudemanhuispoort",
      description: "The Oudemanhuispoort is a 17th-century complex between the Oudezijds Achterburgwal and the Kloveniersburgwal, built in a square plan as the Old Men's and Women's Hospital. It is now a main site of the University of Amsterdam's humanities faculty and a national monument. A covered passage through one wing links the two canals.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Oudemanhuispoort",
      additionalSources: []
    },
    {
      modelId: "torture-museum",
      landmarkId: "extract_landmarks_417591223",
      name: "Torture Museum",
      description: "The Torture Museum stands on the Singel near the Bloemenmarkt, in a narrow brick canal house with a dark glass shopfront. It exhibits historical instruments of torture, though like many such museums it also shows devices that were seldom or never used in real history, such as the iron maiden, a literary invention of the 19th century.",
      funFact: "The Daily Telegraph called it one of the world's most unusual museums. It is not connected with the separate Museum of Medieval Torture Instruments elsewhere in Amsterdam.",
      sourceUrl: "https://en.wikipedia.org/wiki/Torture_Museum,_Amsterdam"
    },
    {
      modelId: "theo-thijssen-museum",
      landmarkId: "extract_landmarks_1824871810",
      name: "Theo Thijssen Museum",
      description: "The Theo Thijssen Museum is devoted to the writer, teacher and politician Theo Thijssen. It is run by the Stichting Theo Thijssen and occupies the ground floor of Thijssen's birthplace at Eerste Leliedwarsstraat 16, a brick corner house with a bowed shop window.",
      funFact: "A plaque on the facade records that Theo Thijssen, author of Kees de Jongen, was born in this house.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Theo_Thijssen_Museum"
    },
    {
      modelId: "pathe-de-munt",
      landmarkId: "extract_landmarks_257271103",
      name: "Path\xE9 de Munt",
      description: "Path\xE9 de Munt is a large cinema in the centre of Amsterdam on the Vijzelstraat, close to Path\xE9 Tuschinski; the two cinemas border each other behind the shops on the Reguliersbreestraat. It has 13 screens on three floors with 1,829 seats in total, the largest room seating 318.",
      funFact: "When Path\xE9 de Munt opened in November 2000 it was the first multiplex cinema in Amsterdam's inner city.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Path%C3%A9_de_Munt"
    },
    {
      modelId: "houseboat-museum",
      landmarkId: "extract_landmarks_941219842",
      name: "Houseboat Museum",
      description: "The Woonbootmuseum, or Houseboat Museum, is dedicated to the history and culture of living on the water. It lies on the Prinsengracht, on the edge of the Jordaan, aboard the Hendrika Maria, a historic inland vessel from 1914.",
      funFact: "It is the only museum in the world specifically focused on houseboat living.",
      sourceUrl: "https://en.wikipedia.org/wiki/Woonbootmuseum"
    },
    {
      modelId: "sint-olofskapel",
      landmarkId: "extract_landmarks_35124042",
      name: "Sint Olofskapel",
      description: "The Sint Olofskapel, also called the Oudezijds Kapel, is a Gothic-inspired brick chapel between the Zeedijk and the Nieuwebrugsteeg. The first chapel was built around 1440-1450 against a city gate; the present three-aisled building with its asymmetrical plan results from an expansion in 1644. Tall pointed windows light the gables, and the stone portal from 1644 on the Zeedijk carries the motto Spes altera vitae.",
      funFact: "The chapel's old wooden bell tower, which received a clockwork in 1543, was lost to a fire in 1820; today the chapel serves as a congress centre of the Barbizon hotel.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Sint-Olofskapel",
      preferDescription: true
    },
    {
      modelId: "koningskerk",
      landmarkId: "extract_landmarks_879972030",
      name: "Koningskerk",
      description: "The Koningskerk on the Van 't Hofflaan in Watergraafsmeer was designed by Wouter van de Kuilen and Cornelis Trappenburg and built between 1954 and 1956. A box-like hall with a striking freestanding tower, it is known for the early glass-in-concrete walls by Berend Hendriks, which to some observers give the facade the look of a crossword puzzle.",
      funFact: "The church was dedicated on 21 March 1956 as a Reformed church; since 1994 it has been used by the Evangelische Broedergemeente (Moravian Church).",
      sourceUrl: "https://nl.wikipedia.org/wiki/Koningskerk_(Amsterdam)",
      preferDescription: true
    },
    {
      modelId: "nassaukerk",
      landmarkId: "extract_landmarks_1101340298",
      name: "Nassaukerk",
      description: "The Nassaukerk at De Wittenkade 111 in the Staatsliedenbuurt is an Amsterdam School church by H.G. Krijgsman of Zeist, who won the 1924 design competition. Built in 1925-1926 for the Gereformeerde Kerk, it has a floor plan in the shape of a Greek cross, large red-brick surfaces and parabolic window and interior forms, under steep roofs around a green clock tower.",
      funFact: "The church needed more than 450 foundation piles and was designed to seat 924 worshippers; it opened on 18 June 1926.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Nassaukerk_(Amsterdam)",
      preferDescription: true
    },
    {
      modelId: "club-panama",
      landmarkId: "n30170536",
      name: "Club Panama",
      description: "Club Panama occupies the former hydraulic harbour power station on Oostelijke Handelskade, built in 1885 in an eclectic neo-Gothic style. Its red brick walls are banded with natural stone and decorated with round-arch friezes, and the hall inside keeps an open roof of iron Polonceau trusses. Since 2001 it has been a nightclub, restaurant and theatre.",
      funFact: "The building first powered the cranes on the Handelskade; in 1899 its hydraulic system gave way to a direct-current plant and a new wing was added on the south side in the same style.",
      sourceUrl: "https://arcam.nl/architectuur-gids/panama/",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/523311",
        "https://panama.nl/contact-us-2/"
      ],
      preferDescription: true
    },
    {
      modelId: "compagnietheater",
      landmarkId: "extract_landmarks_1455669716",
      name: "Compagnietheater",
      description: "The Compagnietheater at Kloveniersburgwal 50 was built in 1792-1793 as a church for the Restored Evangelical Lutheran congregation, designed by Abraham van der Hart on the site of a former madhouse (dolhuis). A Hollands-Classicist building with a sculptural group by Anthonie Ziesenis on its facade, it was converted to a theatre in 1995-1996 by Francine Houben of Mecanoo and is a national monument.",
      funFact: "After the Lutheran congregations merged in 1952 the building briefly served as a bank archive before becoming a theatre.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Compagnietheater"
    },
    {
      modelId: "west-india-house",
      landmarkId: "extract_landmarks_1399359542",
      name: "West India House",
      description: "The West India House on Herenmarkt was the Amsterdam headquarters of the Dutch West India Company. Built in 1617 as a meat market and militia waiting room, it was rented by the company from 1623 and extended with two wings around a courtyard, tripling its size by 1647. A fire in 1975 was followed by restoration in 1978-1981; it now holds offices, the John Adams Institute and a municipal wedding hall.",
      funFact: "It was here in 1625 that the company directors ordered the building of a fort on Manhattan, the beginning of New Amsterdam and later New York. A bronze statue of Peter Stuyvesant stands in the courtyard.",
      sourceUrl: "https://en.wikipedia.org/wiki/West-Indisch_Huis"
    },
    {
      modelId: "thomaskerk",
      landmarkId: "extract_landmarks_741771335",
      name: "Thomaskerk",
      description: "De Thomas, the Thomaskerk on Prinses Irenestraat in Amsterdam-Zuid, is a Protestant church designed by Karel Sijmons and built in 1966 for the Dutch Reformed congregation of the new Nieuw-Zuid district. Its low buff-brick volumes, ribbon windows and a bell frame of white concrete projecting from the facade are sober and entirely arranged around Word, Baptism and Communion. Sijmons took inspiration from Le Corbusier's chapel at Ronchamp, and the undulating roof inside recalls the sea the Israelites crossed. It is a municipal monument.",
      funFact: "Sijmons paid for the 1967 stained-glass crucifixion window by the Spanish artist Antonio Saura himself because he insisted it belonged in the church.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Thomaskerk_(Amsterdam)",
      preferDescription: true
    },
    {
      modelId: "willem-de-zwijgerkerk",
      landmarkId: "extract_landmarks_1347119904",
      name: "Willem de Zwijgerkerk",
      description: "The Willem de Zwijgerkerk at Olympiaweg 14 in the Stadionbuurt is a brick Amsterdam School church designed by Cornelis Kruyswijk and built in 1931 for the Dutch Reformed Church. A steep tiled nave roof with tall gables is flanked by lower pent-roofed aisles with clerestory windows, and a slender clock tower with a green copper top rises beside the entrance. Today it is a neighbourhood church of the Protestant Church in Amsterdam and a municipal monument.",
      funFact: "The church was built in 1930-31 together with the Moria parish hall and an old people's home (now student housing) in the same city block; its stained-glass windows by Kees Kuiler show Christmas, Easter and Pentecost.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Willem_de_Zwijgerkerk_(Amsterdam)",
      preferDescription: true
    },
    {
      modelId: "vrijburg",
      landmarkId: "extract_landmarks_563908011",
      name: "Vrijburg",
      description: "Vrijburg, Diepenbrockstraat 46, is the Remonstrant church of Amsterdam-Zuid. It was built in 1931-1933 on a plot at the point of the Zuider Amstelkanaal, Boerenwetering and Verlengde Diepenbrockstraat, when the area was still empty building land. A tall red-brick gable with a round-arched entrance faces the street, and the side facade runs along Herman Gorterstraat.",
      funFact: "The Remonstrants already had their hidden church on the Keizersgracht, but built this second church for the new southern expansion of the city; it was tendered in the winter of 1931-32 for 105,500 guilders and opened on 18 June 1933.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Diepenbrockstraat_46",
      preferDescription: true
    },
    {
      modelId: "van-gendt-hallen",
      landmarkId: "extract_landmarks_1351046417",
      name: "Van Gendt Hallen",
      description: "The Van Gendt Hallen, also called the Hallen van Stork or Werkspoorhallen, are five interlinked workshop halls of the former Werkspoor factory on Oostenburg. Designed by A.L. van Gendt and his brothers in functional brick with neo-Renaissance touches in the gables, they have stepped corbel friezes under shallow-arched gable tops, tall arched factory windows and long glazed roof lanterns. They have been a rijksmonument since 2001.",
      funFact: "The halls were built from 1898 to 1910 to satisfy an order for 40 locomotives and 400 wagons for South Africa; in 1903 one of them built the first cast-iron diesel ship engine, and halls 4 and 5 were partly burned in 1922 and rebuilt exactly to the original design.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Hallen_van_Stork",
      preferDescription: true
    },
    {
      modelId: "zuiderkerk",
      landmarkId: "extract_landmarks_684653190",
      name: "Zuiderkerk",
      description: "The Zuiderkerk (Southern Church) on Zuiderkerkhof was the first church built in Amsterdam specifically for the Protestant community. Hendrick de Keyser designed it and it was built between 1603 and 1611 as a Renaissance hall church of brick with sandstone dressings. Its tower, roughly 70 metres tall, rises in square and octagonal stages with clock faces, corner columns and a lead-covered lantern; the clock bears the date 1614. The church closed for worship in 1929 and now houses an information centre for urban development and a venue.",
      funFact: "Rembrandt and Saskia's son Titus was baptised here in 1641, and Claude Monet painted the tower with the church behind it around 1874.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Zuiderkerk_(Amsterdam)",
      preferDescription: true
    },
    {
      modelId: "muiderkerk",
      landmarkId: "extract_landmarks_1055638541",
      name: "Muiderkerk",
      description: "The Muiderkerk is a Protestant church on the Linnaeusstraat at the edge of the Oosterpark in Amsterdam-Oost. The original church of 1892 burned down in 1989, but its brick tower survived, and the present church was built against that old tower as part of a 1997 housing and office complex designed by architect Van Hoogevest. The tower, with its stone porch, rose windows and arched belfry, is what makes the building recognisable.",
      funFact: "Although the church burned in 1989, the tower stayed standing; it was restored in the early 2010s to repair neglected maintenance and the remaining fire damage. In 2008 a small square with an art object, the Wensplein voor vrede (Wish Square for Peace), opened to its south.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Muiderkerk",
      preferDescription: true
    },
    {
      modelId: "aron-schuster-synagoge",
      landmarkId: "extract_landmarks_86609524",
      name: "Raw Aron Schuster Synagoge",
      description: "The Raw Aron Schuster Synagogue, also called the Obrechtsjoel, stands on the corner of Jacob Obrechtplein and Heinzestraat in Amsterdam-Zuid and is the largest Ashkenazi synagogue still in use in the city. Harry Elte, a pupil of H.P. Berlage, designed it, and it was inaugurated on 18 May 1928. Its stern brick blocks, tower, covered entrance and far-projecting roof slabs show the influence of Willem Dudok and Frank Lloyd Wright. It became a national monument in 1995 and was restored by 1997.",
      funFact: "The building was named after Chief Rabbi Aron Schuster (1907-1994) only in 1973, when he retired and left Amsterdam for Jerusalem; he had served here since 1942. The first service after the war was held on Rosh Hashanah 1945.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Raw_Aron_Schuster_Synagoge",
      preferDescription: true
    },
    {
      modelId: "zevenlandenhuizen",
      landmarkId: "requested-zevenlandenhuizen",
      name: "Zevenlandenhuizen",
      description: "The Zevenlandenhuizen (Seven Countries Houses) are a row of seven houses at Roemer Visscherstraat 20-30a in the Vondelpark neighbourhood, designed by Tjeerd Kuipers in 1894 for the Amsterdam businessman Sam van Eeghen. Each house borrows the architecture of a different country: Germany (no. 20, pointed-arch Romantic windows), France (22, a Loire chateau), Spain (24, a Moorish villa in the manner of Granada), Italy (26, a palazzo), Russia (28, a church tower with an onion dome), the Netherlands (30, a Renaissance gabled house) and England (30a, a half-timbered cottage). The row is a national monument and a showpiece of the 19th-century taste for exotic styles.",
      funFact: "Every house carries its country's name carved into the facade, and the Russian house even has a little onion-domed tower rising over a Dutch street.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Zevenlandenhuizen",
      additionalSources: [
        "https://commons.wikimedia.org/wiki/Category:Zevenlandenhuizen"
      ],
      preferDescription: true
    },
    {
      modelId: "klimhal",
      landmarkId: "requested-klimhal-amsterdam",
      name: "Klimhal Amsterdam",
      description: "Klimhal Amsterdam is a climbing hall on Naritaweg beside Sloterdijk station, built in 1996. Its steel frame is clad in dark brown standing-seam panels that lean in from both flanks to a ridge about 21 m up, so the whole hall reads as a curved, pointed sail. The glazed ends carry a white climbing wall standing proud of the glass; the interior offers several thousand square metres of climbing surface, among the largest in the Benelux.",
      funFact: "The hall is about 21 m tall, so its climbing routes are as high as a seven-storey building.",
      sourceUrl: "https://www.fijnuit.nl/3680/klimhal-amsterdam",
      preferDescription: true,
      center: [
        52.38817,
        4.82791
      ],
      additionalSources: [
        {
          title: "Klimhal Amsterdam (Fijn Uit)",
          url: "https://www.fijnuit.nl/3680/klimhal-amsterdam"
        },
        {
          title: "BAG pand 0363100012150166 (built 1996, sports use)",
          url: "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?identificatie=0363100012150166&f=json"
        }
      ]
    },
    {
      modelId: "symphony",
      landmarkId: "requested-symphony",
      name: "Symphony",
      description: "Symphony is a block on the south side of Gustav Mahlerplein in the Zuidas business district: a 29-storey, 105 m residential tower and a wider 97 m office tower, standing on a shared low-rise base with shops, a hotel and an art centre. Pi de Bruijn of De Architekten Cie designed the towers with INBO architecten, and AWG architecten designed the base. Both towers are clad in banded orange-red brick, so the pair reads as one composition.",
      funFact: "The towers are nicknamed the orange giants of the Zuidas, because their brick bands glow orange in low sun.",
      sourceUrl: "https://zuidas.nl/en/threesixty_info/amsterdam-symphony-2/",
      preferDescription: true,
      center: [
        52.33618,
        4.87385
      ],
      additionalSources: [
        {
          title: "Zuidas: Amsterdam Symphony",
          url: "https://zuidas.nl/en/threesixty_info/amsterdam-symphony-2/"
        },
        {
          title: "De Architekten Cie: Amsterdam Symphony",
          url: "https://www.cie.nl/Amsterdam-Symphony?lang=nl"
        },
        {
          title: "BAG pand 0363100012128931 (built 2010)",
          url: "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?identificatie=0363100012128931&f=json"
        }
      ]
    },
    {
      modelId: "ij-toren",
      landmarkId: "extract_landmarks_1963830588",
      name: "IJ-toren",
      description: "The IJ-toren on Piet Heinkade is a glass office tower rising from the same podium as Amsterdam's Passenger Terminal, beside the IJ. It was finished in 2002, first meant for Bank Labouchere as the Labouchere tower, then briefly the Dexia tower, before being named after the waterway. Since a 2013 refit it trades as the UP Office Building. Stepped glass volumes with green-tinted horizontal bands make it one of the tallest buildings of the eastern docklands.",
      funFact: "Architecture critic Hans Ibelings called it extraordinarily flat in 2003, one of the two low points of the Eastern Docklands; it is the second Amsterdam tower called IJ-toren, after a 1998 apartment tower on the Veemkade.",
      sourceUrl: "https://nl.wikipedia.org/wiki/IJ-toren_(Piet_Heinkade)",
      preferDescription: true,
      additionalSources: [
        {
          title: "Wikipedia: IJ-toren (Piet Heinkade)",
          url: "https://nl.wikipedia.org/wiki/IJ-toren_(Piet_Heinkade)"
        },
        {
          title: "BAG pand 0363100012090447 (built 2002)",
          url: "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?identificatie=0363100012090447&f=json"
        }
      ]
    },
    {
      modelId: "sea-palace",
      landmarkId: "n13404202880",
      name: "Sea Palace",
      description: "Sea Palace is a three-storey Chinese restaurant afloat on a pontoon beside Oosterdokskade, a short walk from Centraal Station. Its three stacked green-glazed-tile roofs, each with a red rim and corners swept sharply upward, and its red columns and gold-medallion balustrades follow the Cantonese pavilion style. Guests dine on the lower floors, and the top floor opens onto a roof terrace.",
      funFact: "Sea Palace has floated beside Oosterdokskade since 1984 and is known for handmade dim sum. It is a vessel rather than a building, so the Dutch BAG register holds no pand for it.",
      sourceUrl: "https://seapalace.nl/en/about-us/",
      additionalSources: [
        "https://seapalace.nl/en/",
        "https://seapalace.nl/en/directions/"
      ],
      preferDescription: true
    },
    {
      modelId: "de-school",
      landmarkId: "n2811980599",
      name: "De School (Tilla Tec)",
      description: "This long concrete slab with ribbons of red-framed windows is a former technical school from the late 1960s, on Dr. Jan van Breemenstraat. A low saw-tooth workshop wing runs off its north side, and the entrance sits under a flat canopy beside a green-framed concrete pavilion. From 2016 it housed De School, a club, restaurant, gallery and gym, and the Tilla Tec venue now uses the same building.",
      funFact: "The club De School ran its 24-hour dance floor in the school's old bicycle store in the basement, and closed in January 2024 when its municipal permits expired.",
      sourceUrl: "https://en.wikipedia.org/wiki/De_School",
      additionalSources: [
        "https://djmag.com/top100clubs/2019/57/De-School",
        "https://www.tillatec.com/"
      ],
      preferDescription: true
    },
    {
      modelId: "west-indisch-pakhuis",
      landmarkId: "extract_landmarks_76787173",
      name: "West Indian Warehouse",
      description: "The West India Company's warehouse of 1641-1642 at 's-Gravenhekje 1A is a four-storey red-brick block banded with cream natural stone. Its long front carries two trapezium gables with oeils-de-boeuf and date stones reading ANNO and 1642, split by a triangular pediment with the company's monogram, and the lower tier still has the barred windows and tall loading doors of a working warehouse. Upper floors keep their blue shutters.",
      funFact: "The two gables each carry a plaque, one reading ANNO and the other 1642, so the building spells out its own date across the roofline.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/1222",
      additionalSources: [
        "https://commons.wikimedia.org/wiki/Category:West-Indisch_Pakhuis"
      ],
      preferDescription: true
    },
    {
      modelId: "christ-church-groenburgwal",
      landmarkId: "extract_landmarks_369277545",
      name: "Church of England (Christ Church)",
      description: "Christ Church, the Anglican church at Groenburgwal 42, hides a much older building: a cloth hall of 1626 from the Staalhof, which the Episcopal congregation took over in 1771. Its pointed-arch brick front of 1829, with a tall four-lancet window in the central gable, two-lancet and three-lancet side windows, stone-capped piers and copper pinnacles, is among the first neo-Gothic facades in the Netherlands.",
      funFact: "Rembrandt's 'Staalmeesters' was painted for the Staalhof, the cloth-sampling hall this building was once part of; the Anglican congregation later used the room where the sampling officials met.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Christ_Church_(Amsterdam)",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/1269"
      ],
      preferDescription: true
    },
    {
      modelId: "ljg-synagoge",
      landmarkId: "extract_landmarks_1186428295",
      name: "LJG Synagogue",
      description: "The Liberal Jewish Congregation of Amsterdam (LJG) moved into this synagogue and cultural centre on the Zuidelijke Wandelweg in August 2010, after its 1966 building on Graafschapstraat was sold and demolished. A free-standing four-storey grey block on its own islet beside the Rivierenbuurt, it is skinned in a scatter of white perforation dots that thicken into clouds near the parapet, with a star-shaped glazed opening cut into the long walls.",
      funFact: "The north end wall carries three lines of Hebrew text written in the same white dots as the perforation pattern; since 2014 the islet it stands on has been called Jacob Soetendorpeiland, after the congregation's postwar rabbi.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Liberaal_Joodse_Gemeente_Amsterdam",
      additionalSources: [
        "https://commons.wikimedia.org/wiki/File:Kop_Zuidas_41.jpg"
      ],
      preferDescription: true
    },
    {
      modelId: "trippenhuis",
      landmarkId: "trippenhuis",
      name: "Trippenhuis",
      description: "The Trippenhuis (Kloveniersburgwal 29) was built in 1660-1662 by Justus Vingboons for the arms-trading brothers Louys and Hendrick Trip. It is two full houses behind one palace-like sandstone front, seven windows wide, with eight giant fluted Corinthian pilasters, a triangular pediment on four of them and chimneys shaped like mortars as a nod to the family's guns and munitions. The Royal Netherlands Academy of Arts and Sciences has owned it since 1887.",
      funFact: "The pilasters come in an even number, because classical rules forbade one in the axis of a house, so the dividing wall between the two homes sits behind the middle row of windows, which were originally blind. From 1817 to 1885 the building also housed the national museum, where Rembrandt's Night Watch hung before it moved to the Rijksmuseum.",
      sourceUrl: "https://en.wikipedia.org/wiki/Trippenhuis",
      additionalSources: [
        "https://nl.wikipedia.org/wiki/Trippenhuis"
      ],
      preferDescription: true
    },
    {
      modelId: "american-hotel",
      landmarkId: "american-hotel",
      name: "American Hotel",
      description: "The American Hotel on Leidseplein (Leidseplein 28) was built in 1900-1902 to designs by Willem Kromhout and H.G. Jansen, replacing a first American Hotel of 1882 by Cornelis Steinigeweg. Its brick-and-stone corner block with a turreted tower is a landmark of Dutch Jugendstil (Art Nouveau) in the Berlage manner and is a national monument, as is the 1927-1928 extension. Its Cafe Americain, with the Jugendstil interior, is still the hotel's public living room.",
      funFact: "The cafe holds what is described as the oldest reading table in Amsterdam, a long table where guests browse the newspapers and magazines. Dancer Mata Hari is said to have spent her wedding night in the hotel in July 1895, and a Mata Hari suite is still let there.",
      sourceUrl: "https://en.wikipedia.org/wiki/American_Hotel,_Amsterdam",
      additionalSources: [
        "https://nl.wikipedia.org/wiki/American_Hotel"
      ],
      preferDescription: true
    },
    {
      modelId: "hotel-de-l-europe",
      landmarkId: "hotel-de-l-europe",
      name: "Hotel de l'Europe",
      description: "Hotel de l'Europe (now De L'Europe Amsterdam, Nieuwe Doelenstraat 2-14) opened in 1896, designed in neo-Renaissance style by Willem Hamer Jr. It stands on the site of the Rondeel, a round tower of the 1480s city wall that guarded the Amstel, and the curved river front still echoes that tower. Red brick banded with white stone, turreted corners and a mansard roof with stone-framed dormers overlook the Munt, where the Amstel flows into the Rokin. It has been a national monument since 2001.",
      funFact: "Alfred Hitchcock used the hotel as a location for Foreign Correspondent (1940), just before the Second World War, and Freddy's Bar is named after the brewer Freddy Heineken. The hotel took its name from an older Hotel de l'Europe on the Prins Hendrikkade, which belonged to the same company.",
      sourceUrl: "https://en.wikipedia.org/wiki/De_L%27Europe_Amsterdam",
      additionalSources: [
        "https://nl.wikipedia.org/wiki/De_L%27Europe_Amsterdam"
      ],
      preferDescription: true
    },
    {
      modelId: "vondelkerk",
      landmarkId: "requested-vondelkerk",
      name: "Vondelkerk",
      description: "The Vondelkerk at Vondelstraat 120 is the neo-Gothic brick church that Pierre Cuypers designed for the Vondelpark quarter. Built in 1872-1880 as the Roman Catholic Church of the Sacred Heart, it is a cross-shaped basilica with two round stair towers flanking its gabled entrance and an octagonal crossing tower, originally about 50 m high, that was meant to be seen and heard from afar. Cuypers set it on an oval island so that Vondelstraat splits to pass on both sides; it was the first free-standing church built in Amsterdam since the Middle Ages. The model shows it as it stood before the New Year's Eve fire of 2026, which brought down the main tower and roof but left the walls standing.",
      funFact: "After the church lost its wooden tower and roof in a fire on 8 November 1904, Cuypers' son Joseph rebuilt the tower slightly lower; the church was deconsecrated in 1977 and has been used as a concert hall, wedding venue and office space.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Vondelkerk",
      additionalSources: [
        "https://commons.wikimedia.org/wiki/Category:Vondelkerk"
      ],
      preferDescription: true
    },
    {
      modelId: "lloyd-hotel",
      landmarkId: "n331837646",
      name: "Lloyd Hotel",
      description: "The Lloyd Hotel on Oostelijke Handelskade is a large brick complex that Evert Breman designed for the Koninklijke Hollandsche Lloyd shipping line. Built between 1918 and 1921, it was meant as a hostel for emigrants waiting to sail to South America and doubled as advertising for the line. Its steep tiled roof, the stepped Dutch gables lettered LLOYD:HOTEL and the slender entrance tower with a clock, lantern and dome make it one of the best-known buildings on the Eastern Docklands. It later served as a refugee shelter, a prison and artists' studios before reopening as a hotel in 2004, and it has been a national monument since 2001.",
      funFact: "The building ended up costing eight times its original estimate, which helped bankrupt the shipping line in 1936; the city bought it, and over the following decades it held Jewish refugees, wartime detainees and, from 1963, a youth detention centre.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Lloyd_Hotel_(hotel)",
      additionalSources: [
        "https://en.wikipedia.org/wiki/Lloyd_Hotel",
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/523289"
      ],
      preferDescription: true
    },
    {
      modelId: "ronde-lutherse-kerk",
      landmarkId: "requested-ronde-lutherse-kerk",
      name: "Ronde Lutherse Kerk",
      description: "The Ronde Lutherse Kerk, also called the Koepelkerk, stands where the Singel meets the Kattengat. Adriaan Dortsman built it in 1668-1671 for the growing Lutheran congregation as a round church under a copper dome, with a small lantern on top where the Lutheran swan is shown. Lutherans were not allowed a church tower, so the dome took its place on the skyline. Fire destroyed it in 1822 and again damaged the dome in 1993; the rebuilt dome is copper-coloured rather than green. The church later became a concert and congress hall linked to the hotel across the street.",
      funFact: "After the 1822 fire only the walls were left; the church was rebuilt in 1823-1826 with a higher dome and Roman-style coffers, and it is still counted as the most Baroque building of the seventeenth century in the Netherlands.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Ronde_Lutherse_Kerk",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/2207"
      ],
      preferDescription: true
    },
    {
      modelId: "hotel-okura",
      landmarkId: "n2817713466",
      name: "Hotel Okura Amsterdam",
      description: "Hotel Okura Amsterdam stands on Ferdinand Bolstraat beside the Amstelkanaal and was the first European hotel of the Japanese Okura chain. The Dutch architects Bernard Bijvoet and Gerard Holt designed it with the Japanese architects Yoshiro Taniguchi and Yozo Shibata, and Prince Claus opened it in September 1971. Its 23 storeys rise 78 metres from a wide low podium, and the slab tower ends in a broad overhanging flat canopy that gives the skyline of De Pijp a Japanese roof silhouette. When it opened it was the second-tallest building in Amsterdam, after Toren Overhoeks. The rooftop restaurant Ciel Bleu on the 23rd floor has held two Michelin stars.",
      funFact: "The lit canopy at about 75 metres works as a weather barometer for the neighbourhood: its lighting shows blue for sunny weather tomorrow, green for bad weather and white for changeable conditions. There is also no 13th floor.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Hotel_Okura_Amsterdam",
      additionalSources: [
        "https://en.wikipedia.org/wiki/Hotel_Okura_Amsterdam"
      ],
      preferDescription: true
    },
    {
      modelId: "coymanshuis",
      landmarkId: "requested-coymanshuis",
      name: "Coymanshuis",
      description: "The Coymanshuis at Keizersgracht 177 is the first known architectural design by Jacob van Campen, drawn in 1625 for the trader-banker Balthasar Coymans and his brother Johannes. Its eight-bay brick front is organised by pilasters, Ionic on the bel-etage and Composite on the floor above, a classical vocabulary that was new to Amsterdam's canal houses. The cross windows were replaced by sashes around 1780, and in 1876 the attic became a full storey when the house turned into a secondary school. Since 2003 it has been the Dutch head office of Amnesty International.",
      funFact: "In 1631 the architects Cornelis Danckerts and Salomon de Bray published the front and plan in Architectura Moderna and claimed that every visitor to the city who values architecture should come and see it; Van Campen went on to design Amsterdam's Town Hall, now the Royal Palace on the Dam.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Coymanshuis",
      additionalSources: [
        "https://en.wikipedia.org/wiki/Coymanshuis",
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/2271"
      ],
      preferDescription: true
    },
    {
      modelId: "artis-aquarium",
      landmarkId: "requested-artis-aquarium",
      name: "Artis Aquarium",
      description: "The Aquarium building of Artis, at Plantage Middenlaan 53, was designed by Gerlof Bartholomeus Salm and his son Abraham and opened in 1882. It is a neoclassical hall with a tetrastyle Corinthian portico, a double flight of stairs, a pediment with a painted fish mural and the motto Natura Artis Magistra on the frieze. Behind the street front the aquaria face the garden, and a dome at the east end once held a lecture hall. In the twentieth century it housed the University of Amsterdam's Zoological Museum; after a restoration from 2021 to 2025 the aquarium reopened to the public in June 2026.",
      funFact: "The weight of the tanks and their glass panes required 1,740 wooden piles, and the cellars hold huge reservoirs of gravel and coarse sand that purified the water; the first fresh- and salt-water basins were filled in 1882 with North Sea fish and Dutch freshwater species.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Aquariumgebouw",
      additionalSources: [
        "https://nl.wikipedia.org/wiki/Artis"
      ],
      preferDescription: true
    },
    {
      modelId: "krasnapolsky",
      landmarkId: "n251150450",
      name: "Grand Hotel Krasnapolsky",
      description: "The Grand Hotel Krasnapolsky, now the Anantara Grand Hotel Krasnapolsky, fills a long block on the east side of the Dam. It began in 1865 when Adolph Wilhelm Krasnapolsky bought the failing Nieuwe Poolse Koffiehuis on the Warmoesstraat and turned it into a popular restaurant with a billiard room. He bought the neighbouring houses, added hotel rooms around 1879, and built a glass-and-iron Winter Garden with a domed roof in the back garden to a design by G.B. Salm. After the Second World War the hotel grew south to the Pijlsteeg and north to the Sint Jansstraat, and its address changed from Warmoesstraat 187-205 to Dam 9-15.",
      funFact: "The Winter Garden, with its electric lighting, was so novel that it is said to have inspired Gerard Philips to start a light-bulb factory; by the end of the 19th century the hotel was the only one in Amsterdam with hot water and a telephone in every room.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Grand_Hotel_Krasnapolsky",
      additionalSources: [
        "https://en.wikipedia.org/wiki/Grand_Hotel_Krasnapolsky"
      ],
      preferDescription: true
    },
    {
      modelId: "fatih-moskee",
      landmarkId: "extract_landmarks_1997051448",
      name: "Fatih Mosque",
      description: "The Fatih Mosque on the Rozengracht occupies the former Sint-Ignatiuskerk, a Jesuit church designed by H.W. Valk and opened in 1929 with a double-tower front 40 metres high and room for 600 worshippers. Its brick front keeps three pointed door arches under a gable with a star-patterned rose window, flanked by the two towers. Since 1981 it has been a mosque of the Islamic Foundation of the Netherlands, named after the Ottoman sultan Mehmed II.",
      funFact: "The congregation now prays towards the old main entrance, where the mihrab stands, so people enter through a small side door, and shops fill the three pointed doorways on the Rozengracht; the most visible change outside is that crescents replaced the crosses on the towers.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Fatih-moskee_(Amsterdam)",
      additionalSources: [
        "https://www.wikidata.org/wiki/Q674125"
      ],
      preferDescription: true
    },
    {
      modelId: "chassekerk",
      landmarkId: "requested-chassekerk",
      name: "Chass\xE9kerk",
      description: "The Chass\xE9kerk, Karel Petrus Tholens's former Roman Catholic Church of Our Lady of Perpetual Help, was built in 1924-26 on Chass\xE9straat in a style influenced by the Amsterdam School: large plain brick surfaces, a broad column-free nave with narrow aisles under one great roof, and two slender towers flanking a porch of round arches. Closed in 1998 and nearly demolished, it was saved by neighbourhood opposition and now houses Chass\xE9 Dance Studios, a ballet school and a hotel in the old rectory.",
      funFact: "Squatters occupied the church in 2004, and after the housing corporation's demolition plans were dropped, its crypt was dug out in the 2010s to make one of the largest cellars in an existing Amsterdam building.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Chass%C3%A9kerk",
      additionalSources: [
        "https://www.wikidata.org/wiki/Q2189632"
      ],
      preferDescription: true
    },
    {
      modelId: "pakhuis-de-zwijger",
      landmarkId: "n6933045932",
      name: "Pakhuis de Zwijger",
      description: "Pakhuis de Zwijger on Piet Heinkade was built in 1933-34 as a cold store for perishable goods, in the Nieuwe Bouwen style, to a design by J. de Bie Leuveling Tjeenk and K. Bakker. Its brick box of small square windows overhangs the quay on cantilevered concrete columns, and tall stair towers with projecting caps run up the front. It stood empty and was threatened with demolition before it was made a national monument in 2001 and restored by Stadsherstel Amsterdam. Since 2006 it has housed cultural organisations and the public programme that carries its name.",
      funFact: "A bridge over the IJhaven was planned straight through the warehouse; in the end the Jan Schaeferbrug (opened 2001) was built with the monument kept, and its roadway still runs through the building.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Pakhuis_de_Zwijger",
      additionalSources: [
        "https://dezwijger.nl/"
      ],
      preferDescription: true
    },
    {
      modelId: "victoria-hotel",
      landmarkId: "n237912528",
      name: "Park Plaza Victoria Amsterdam",
      description: "The Victoria Hotel stands on the corner of Damrak and Prins Hendrikkade, opposite Centraal Station. It opened on 19 August 1890 to a design by the German-born architect Johann Friedrich Henkenhaf, who also ran the company, and it was the first hotel in the Netherlands with electric light in every guest room and double windows against street noise. Its neo-Renaissance natural-stone front, mansard roof and domed corner tower made it a landmark of the new station district, and it has been a protected monument since 2001. Today it is the Park Plaza Victoria.",
      funFact: "Henkenhaf could not buy two small old houses on Prins Hendrikkade, so he simply built the hotel around them; their two little gables are still enclosed by the hotel's front.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Victoria_Hotel",
      preferDescription: true
    },
    {
      modelId: "woongebouw-wladiwostok",
      landmarkId: "woongebouw-wladiwostok",
      name: "Woongebouw Wladiwostok",
      description: "Wladiwostok closes the west side of Azartplein on Java-eiland with a nine-storey wall of anthracite brick whose facade is bent into an arc that follows the tram turning loop in front of it. Jo Crepain designed it for the housing association Het Oosten and its future residents, who formed their own association; it was built around 1994 with 72 rental flats and maisonnettes and 13 business units. A facade-wide flight of steps leads up to the business units, and a stack of planted balconies marks the centre of the front. It won the Pyramide Wonen prize in 1998, and since about 2014 its roof has been covered with solar panels.",
      funFact: "The name is the Dutch spelling of Vladivostok, the Russian port whose name means 'rule the East' - a pun on the corporation Het Oosten. In May 2026 residents put a vane on the roof mast in the shape of the theatre ship Azart, the square's namesake.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Woongebouw_Wladiwostok",
      preferDescription: true
    },
    {
      modelId: "de-nederlandsche-bank",
      landmarkId: "de-nederlandsche-bank",
      name: "De Nederlandsche Bank",
      description: "The head office of the Dutch central bank stands on the Frederiksplein, where the Westeinde meets the Singelgracht. Marius Duintjer won the commission in a competition and built it between 1961 and 1968: a low, square block of about 110 by 120 metres raised on columns, with a slender office tower of roughly 70 metres beside it. Its concrete walls are clad in red-brown stoneware tiles meant to echo the brickwork of Amsterdam, and the tower's window strips get shorter as it rises. Mecanoo restored the building and reopened it to the public in 2025, and the round glass tower added to the courtyard in 1990 has been demolished.",
      funFact: "Some residents said the red-brown facade tiles looked like bathroom tiles, but the architect chose them to match Amsterdam brick, and the renovation kept the colour. The tower was also deliberately aligned with the long view down the Utrechtsestraat.",
      sourceUrl: "https://arcam.nl/architectuur-gids/de-nederlandsche-bank-2/",
      additionalSources: [
        "https://www.amsterdamsebinnenstad.nl/binnenstad/297/nederlandsche-bank.php",
        "https://www.architectuur.org/bouwwerk/658/De_Nederlandsche_Bank.html",
        "https://www.archdaily.com/1039156/de-nederlandsche-bank-mecanoo"
      ],
      preferDescription: true
    },
    {
      modelId: "hotel-jakarta",
      landmarkId: "hotel-jakarta",
      name: "Hotel Jakarta",
      description: "Hotel Jakarta fills the western tip of Java-eiland with an eight-storey V-shaped block, designed by the architecture firm SeARCH and opened in summer 2018. Its upper floors are dark panels pierced by a grid of timber-lined loggias, one for each room, and its two-storey glass plinth faces the water. The glazed point of the V shelters a subtropical garden, partly open to the public and planted with the Hortus Botanicus. Behind a timber structure of columns and walls, the rooms were prefabricated off site and hoisted into place, and the building is energy neutral.",
      funFact: "The Javakade name recalls the harbour's old trade with the Dutch East Indies, and so does the hotel: a perforated aluminium panel on the east facade shows the silhouette of a VOC ship. The building won the public prize at the Amsterdam Architecture Prize in 2019.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Hotel_Jakarta",
      preferDescription: true
    },
    {
      modelId: "odessa",
      landmarkId: "n4594648817",
      name: "Odessa",
      description: "Odessa is a former Ukrainian cargo ship moored on the Veemkade quay in the former Eastern Docklands, converted into a restaurant and party boat. Its black tarred-plank hull carries tall woven-bamboo screens round the bow and stern decks, hung with barrels of climbing plants, and a glass geodesic dome on the bow block. A low glass lounge with a row of scalloped roof segments sits amidships, and the sun deck above offers a view over the IJ and the skyline.",
      funFact: "The ship cannot sail any more: it is permanently berthed at Veemkade 259, and because it is a vessel the Dutch BAG register holds no building for it, only a berth object. Today the operator, Odessa Journey, runs ecstatic dance nights on board.",
      sourceUrl: "https://www.inyourpocket.com/netherlands/amsterdam/venues/Odessa",
      additionalSources: [
        "https://www.odessa.amsterdam/",
        "https://www.timeout.com/amsterdam/restaurants-and-cafes/odessa"
      ],
      preferDescription: true
    },
    {
      modelId: "hilton-amsterdam",
      landmarkId: "hilton-amsterdam",
      name: "Hilton Amsterdam",
      description: "The Hilton on Apollolaan is a gently kinked, nine-storey slab of hotel rooms, designed by Huig Maaskant with the firm De Vlaming en Salm and opened in May 1962 as the first Dutch hotel of an international chain. Its concrete floor slabs show as white bands over ribbons of windows between dark piers, a windowless grey-brick lift and stair house breaks the front, and the entrance sits under a far-projecting flat canopy. A low podium of lobby, restaurant and ballroom stretches towards the Noorder Amstelkanaal. The hotel is a national monument (rijksmonument 532205) from the post-war reconstruction programme.",
      funFact: "John Lennon and Yoko Ono held their 1969 Bed-In for Peace here: after their wedding on 20 March they stayed in the presidential suite from 25 to 31 March, receiving the world's press in bed. The suite was room 902 then and was renumbered 702 during a later renovation.",
      sourceUrl: "https://en.wikipedia.org/wiki/Hilton_Amsterdam",
      additionalSources: [
        "https://kennis.cultureelerfgoed.nl/index.php/Monumenten/532205",
        "https://nl.wikipedia.org/wiki/Hilton_Amsterdam_Hotel"
      ],
      preferDescription: true
    },
    {
      modelId: "booking-hq",
      landmarkId: "booking-hq",
      name: "Booking.com headquarters",
      description: "The head office of Booking.com on Oosterdokskade 163 fills the eastern tip of Oosterdokseiland, a quarter-circle plot between Ton de Leeuwstraat, Oosterdoksstraat and the quay. Ben van Berkel's UNStudio designed it as a glass campus meant to mirror the water of the Oosterdok, its glazing broken by recesses, ramps, terraces and walkways, with a rectangular residential tower of 41 apartments (and the Club 11 venue on top) at one end. Construction ran from July 2018 until the building was delivered in December 2022, and about 5,000 staff work on 63,500 m2 of office space. It replaced the 1968 Post CS building of Merkelbach and Elling.",
      funFact: "The whole complex hangs from a steel structure of about 6,000 tonnes, the same amount as the Erasmus Bridge, and designed like a tree: slim at the base and branching further up. Club 11 on top of the tower is a nod to the old Post CS building that stood on almost the same spot.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Hoofdkantoor_van_Booking.com",
      additionalSources: [
        "https://nl.wikipedia.org/wiki/Oosterdokseiland",
        "https://api.data.amsterdam.nl/v1/bag/panden/0363100012250152/"
      ],
      preferDescription: true
    },
    {
      modelId: "shell-technology-centre",
      landmarkId: "shell-technology-centre",
      name: "Shell Technology Centre Amsterdam",
      description: "This dark-brick research campus on the Grasweg in Amsterdam-Noord was built between 2005 and 2009 by Arcadis Architecten and Van Mourik as the new home of Shell's Amsterdam laboratory, with about 80,000 m2 of offices, laboratories, test halls and workshops. Crown Prince Willem-Alexander opened it in September 2009. The lab itself goes back to 1914, when the Bataafsche Petroleum Maatschappij started it with nine people on a 27-hectare site; since 2021 the complex is open to start-ups, universities and companies as the Energy Transition Campus Amsterdam, with around a thousand people working here.",
      funFact: "In 1954 the Shell laboratory in Amsterdam became the first Dutch company to put an electronic computer into service, the second computer in the whole country after the ARRA I. Today its engineers design and build most of the roughly 1,300 test rigs on the campus themselves.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Energy_Transition_Campus_Amsterdam",
      additionalSources: [
        "https://nl.wikipedia.org/wiki/Overhoeks_(Amsterdam)",
        "https://api.data.amsterdam.nl/v1/bag/panden/0363100012202175/"
      ],
      preferDescription: true
    },
    {
      modelId: "kohnstammhuis",
      landmarkId: "kohnstammhuis",
      name: "Kohnstammhuis",
      description: "The Kohnstammhuis closes the head of Wibautstraat, a ten-storey block of yellow brick and exposed concrete designed by the state architect Gijsbert Friedhoff with M. Bolten and built in 1954-1958 as the Amsterdam tax office on the site of the old Weesperpoort railway station. Its symmetrical street front has a double-height entrance hall behind a colonnade of round concrete pilasters and tall windows, brick end pavilions with stairs and coats of arms, a patterned frieze under a pent roof, and a plain slab of small windows above. A seven-storey cross wing was added in 1970 (Bolten and Jo Vegter). The tax authority left in 1994; the Hogeschool van Amsterdam took the building over and named it after the educationalist Philip Kohnstamm. It has been a national monument (rijksmonument 530868) since 2009.",
      funFact: 'When it opened in 1958 it was the tallest office building in Amsterdam, about 48 m, and insiders nicknamed the grey tax office "het grijze monument van de richtige heffing" (the grey monument of the proper levy); the ninth-floor canteen still has stained glass by H. Telkamp, Frans Nols and K. Wenckebach.',
      sourceUrl: "https://nl.wikipedia.org/wiki/Kohnstammhuis",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/530868"
      ],
      preferDescription: true
    },
    {
      modelId: "vriesseveem-9",
      landmarkId: "vriesseveem-9",
      name: "Piet Hein Buildings",
      description: "The Piet Hein Buildings are an office complex of four linked units on Piet Heinkade, next to the Passenger Terminal Amsterdam on the southern bank of the IJ. Designed by Hans van Heeswijk Architects, construction began in 2008 and the complex was finished in 2013-2014. A long four-storey block with harbour views sits above a ground-level garage for touring coaches, while nine-storey blocks with views over the city and the railway tracks face the Piet Heinkade; a transparent public hall connects the entrance lobbies, and the whole complex shares one underground car park. The site was once lined with warehouses and cranes, and the new row of buildings replaces that harbour character with an urban street front of grey cladding and vertical window strips.",
      funFact: "The outer walls of the coach garage are built of glass blocks that glow at night, which is why the building's east end reads as a lantern beside the cruise terminal.",
      sourceUrl: "https://www.heeswijk.nl/piet-hein-buildings&lang=en",
      additionalSources: [
        "https://archilovers.com/projects/159968/piet-hein-buildings.html"
      ],
      preferDescription: true
    },
    {
      modelId: "scheepvaartmuseum",
      landmarkId: "extract_landmarks_961954901",
      name: "Het Scheepvaartmuseum",
      description: "\u2019s Lands Zeemagazijn was built in 1656 by Daniel Stalpaert on the new island of Kattenburg as the naval arsenal of the Amsterdam Admiralty: a square, four-winged block of pale stone round a courtyard, where rigging, sails, cannon and provisions for the fleet were stored, with a pedimented pavilion in the middle of each side. Since 1973 it has housed the national maritime museum, and in 2011 the courtyard got a glass roof. A full-size replica of the VOC ship Amsterdam lies at the quay outside.",
      funFact: "The pediment on the water side shows Neptune and the Admiralty arms; the doors and tall arched openings once let cannon and masts in from the quay, which is why the ground floor is raised and arched while the upper floors have plain sash windows.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Het_Scheepvaartmuseum",
      additionalSources: [
        "https://nl.wikipedia.org/wiki/%27s_Lands_Zeemagazijn",
        "https://www.wikidata.org/wiki/Q1616123"
      ],
      preferDescription: true
    },
    {
      modelId: "waag",
      landmarkId: "extract_landmarks_1875747488",
      name: "De Waag",
      description: "De Waag on the Nieuwmarkt began in 1488 as the Sint-Antoniespoort, a gate in Amsterdam's medieval city wall, with a round tower at each end of its long sides. When the city grew past the wall it became a weigh house in 1617, where cheese, metals and other goods were weighed, and its upper rooms housed the guilds of surgeons, smiths, painters and masons. Today it is a restaurant.",
      funFact: `The surgeons' guild held its public dissections under the dome of the Theatrum Anatomicum on the top floor; in 1632 Rembrandt painted "The Anatomy Lesson of Dr. Nicolaes Tulp" for that guild.`,
      sourceUrl: "https://nl.wikipedia.org/wiki/Waag_(Amsterdam)",
      additionalSources: [
        "https://www.wikidata.org/wiki/Q2466999",
        "https://en.wikipedia.org/wiki/De_Waag"
      ],
      preferDescription: true
    },
    {
      modelId: "hoofdbureau-elandsgracht",
      landmarkId: "n11117002807",
      name: "Hoofdbureau van Politie",
      description: "The Amsterdam police headquarters at Elandsgracht 117, on the corner of Marnixstraat in the Jordaan, is not one building but a Z-shaped chain of five- and six-storey wings built round courtyards, first raised in 1941 and extended since. Walk round it and the facades change: dark brick with long white window ribbons on the Marnixstraat side, brick with heavy white stone window hoods on the south-east fronts, and a pink stone wing with yellow window frames on the Singelgracht.",
      funFact: "The complex measures about 164 by 83 metres; the municipal 3D survey counts 237 separate wall surfaces around its courtyards.",
      sourceUrl: "https://api.data.amsterdam.nl/v1/bag/panden/0363100012169550/?_format=json",
      additionalSources: [
        "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012169550",
        "https://nl.wikipedia.org/wiki/Elandsgracht"
      ],
      preferDescription: true
    },
    {
      modelId: "max-euwe-centrum",
      name: "Max Euwe Centrum",
      description: "The Max Euwe Centrum preserves the memory and work of the Netherlands\u2019 only world chess champion, Max Euwe, who won the title in 1935. Its museum and chess library have occupied the Max Euweplein since December 1991, inside the retained cross-shaped former prison building.",
      sourceUrl: "https://maxeuwe.nl/geschiedenis/",
      destinations: [
        {
          landmarkId: "extract_landmarks_1145162580",
          name: "Max Euwe Centrum",
          center: [
            52.3628148,
            4.883196
          ],
          destinationOverride: {
            center: [
              52.3628148,
              4.883196
            ]
          },
          description: "The Max Euwe Centrum preserves the memory and work of the Netherlands\u2019 only world chess champion, Max Euwe, who won the title in 1935. Its museum and chess library have occupied the Max Euweplein since December 1991, inside the retained cross-shaped former prison building.",
          funFact: "The centre occupies the first floor of the former prison\u2019s retained cross-shaped building. Its public entrance is under the covered passage linking Leidseplein with Max Euweplein.",
          sourceUrl: "https://maxeuwe.nl/route-parkeren/"
        }
      ]
    },
    {
      modelId: "holocaust-namenmonument",
      name: "Nationaal Holocaust Namenmonument",
      description: "Opened on 19 September 2021, Daniel Libeskind\u2019s memorial commemorates Holocaust victims who have no known grave. Four mirror-steel volumes form the Hebrew word \u05DC\u05D6\u05DB\u05E8, meaning \u201CIn memory of\u201D, above a labyrinth of brick walls bearing individual names.",
      sourceUrl: "https://libeskind.com/work/names-monument/"
    },
    {
      modelId: "voormalige-schouwburgpoort",
      name: "Voormalige Schouwburgpoort",
      description: "This sandstone gateway is the surviving entrance to Jacob van Campen\u2019s theatre, opened in1638. Its three arches echo a Roman triumphal arch. The theatre burned in1772; the separate1773 Armenkantoor stands beyond the open forecourt. The gateway still bears Vondel\u2019s verse comparing the world to a stage.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/2587"
    },
    {
      modelId: "academie-theater-dans",
      name: "Academie voor Theater en Dans",
      description: "The Academy for Theatre and Dance brings its bachelor programmes together at Jodenbreestraat 3. Students make around 400 dance and theatre productions a year, using professional studios, a black-box theatre, dance theatre and costume and scenery workshops. Its 1996 building was designed by Teun Koolhaas/TKA on the site of the demolished Maupoleum.",
      sourceUrl: "https://www.atd.ahk.nl/de-atd/voorzieningen/",
      destinations: [
        {
          landmarkId: "extract_landmarks_968719411",
          name: "Academie voor Theater en Dans",
          description: "The Academy for Theatre and Dance brings its bachelor programmes together at Jodenbreestraat 3. Students make around 400 dance and theatre productions a year, using professional studios, a black-box theatre, dance theatre and costume and scenery workshops. Its 1996 building was designed by Teun Koolhaas/TKA on the site of the demolished Maupoleum.",
          sourceUrl: "https://www.atd.ahk.nl/de-atd/voorzieningen/",
          preferDescription: true
        },
        {
          landmarkId: "extract_landmarks_1383482004",
          name: "Amsterdamse Hogeschool voor de Kunsten",
          description: "Amsterdam University of the Arts teaches through specialist arts academies across the city. Its central student administration, executive board and Servicebureau share Jodenbreestraat 3 with the Academy for Theatre and Dance; this destination identifies the university administration within that genuine shared building. The academy studios and theatres occupy the same compact 1996 complex.",
          sourceUrl: "https://www.ahk.nl/contact/",
          preferDescription: true
        }
      ]
    },
    {
      modelId: "mercatorplein-noordtoren",
      name: "Mercatorplein north tower",
      description: "Berlage designed the walls of the Mercatorplein in 1925-27 as one closed square, with two brick towers standing on gatehouses over the streets that enter it. This is the north tower, over the underpass to the Mercatorstraat: a tall square shaft with clock faces on three sides, curved balconies tucked into its corners and an arcade of shops running along the square in front of it.",
      funFact: "The original north tower was pulled down in 1961; the one standing now was rebuilt to Berlage's design in the 1990s, when the square was restored.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Mercatorplein_(Amsterdam)",
      additionalSources: [
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/527136",
        "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012107349"
      ],
      preferDescription: true
    },
    {
      modelId: "mercatorplein-zuidtoren",
      name: "Mercatorplein south tower",
      description: "The south tower of the Mercatorplein stands on the gatehouse over the Van Spilbergenstraat, part of H.P. Berlage's 1925-27 design for the square. Eight storeys of brick under a flat roof, it has small windows low down, four large square windows stacked above them, and a narrower shaft at the back that rises higher still, with small balconies in its corners.",
      funFact: "Unlike its northern twin, this tower is original: the register of national monuments describes it as a 'poortgebouw met hoge toren', a gatehouse with a high tower.",
      sourceUrl: "https://monumentenregister.cultureelerfgoed.nl/monumenten/527135",
      additionalSources: [
        "https://nl.wikipedia.org/wiki/Mercatorplein_(Amsterdam)",
        "https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012073289"
      ],
      preferDescription: true
    },
    {
      modelId: "lieverdje",
      landmarkId: "osm_node_3975877474",
      name: "Het Lieverdje (Spui)",
      funFact: "Carel Kneulman's little street urchin was unveiled in 1960, paid for by a cigarette maker. Robert Jasper Grootveld's anti-smoking happenings here in the 1960s gave rise to the Provo movement.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Het_Lieverdje"
    },
    {
      modelId: "spinoza-standbeeld",
      landmarkId: "osm_way_175846077",
      name: "Spinoza statue (Zwanenburgwal)",
      funFact: "Nicolas Dings's Spinoza (2008) stands near where the philosopher was born. Parakeets and sparrows on his cloak stand for newcomers and locals; the granite icosahedron recalls his trade as a lens grinder.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Spinozamonument"
    },
    {
      modelId: "joods-verzetsmonument",
      landmarkId: "osm_memorial_jewish_ww2_resistance",
      name: "Joods Verzetsmonument (Amstel 1)",
      funFact: "Unveiled in 1988, this black granite column carved with the stone tablets honours the Jewish resistance fighters killed in the Second World War. Since 1992 it has been the centre of the yearly Kristallnacht commemoration.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Joods_Verzetsmonument"
    },
    {
      modelId: "figure-decoupee",
      landmarkId: "osm_artwork_538934266",
      name: "Figure decoupee (Picasso, Vondelpark)",
      funFact: "Picasso asked no fee for this seven-metre concrete bird, made by Carl Nesjar from his sketch for the park's centenary in 1965. His one condition: it must always stay on public display.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Figure_d\xE9coup\xE9e"
    },
    {
      modelId: "teun-de-jager",
      landmarkId: "osm_artwork_5653694042",
      name: "Teun de Jager (Vondelpark)",
      funFact: "Jan Bronner's almost abstract hunter, placed here around 1958, is Teun de Jager from Hildebrand's Camera Obscura. It was cast from plasters of his Haarlem Hildebrand monument, commissioned in 1914 and finished only in 1947.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Teun_de_Jager"
    },
    {
      modelId: "johnny-jordaan-groep",
      landmarkId: "osm_artwork_1704741755",
      name: "Johnny Jordaanplein groep (Johnny Jordaan, Tante Leen, Johnny Meijer)",
      funFact: "Kees Verkade's Johnny Jordaan came first, in 1991, two years after the singer died; Tante Leen followed in 1994. By 2010 five statues of Jordaan musicians stood here, and the square was named after him.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Johnny_Jordaanplein"
    },
    {
      modelId: "theo-thijssen-standbeeld",
      landmarkId: "osm_artwork_250624675",
      name: "Theo Thijssen monument (Lindengracht)",
      funFact: "Theo Thijssen (1879\u20131943) taught in Amsterdam schools for over twenty years. His best-known book, Kees de jongen (1923), about an imaginative boy called Kees, is set in the Jordaan.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Theo_Thijssen"
    },
    {
      modelId: "carmiggelt-borstbeeld",
      landmarkId: "osm_artwork_440673918",
      name: "Simon Carmiggelt bust (Weteringplantsoen)",
      funFact: "Kees Verkade's bust of the writer Simon Carmiggelt was unveiled in 1988, a year after his death. Its hollow plinth holds the 4,000 transfer slips sent in by the people who paid for it.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Buste_Simon_Carmiggelt"
    },
    {
      modelId: "kinderbrug-meisje-eekhoorns",
      landmarkId: "osm_artwork_4370460330",
      name: "Kinderbrug: Girl with squirrels (Hildo Krop)",
      funFact: "Hildo Krop carved this girl with squirrels into a capstone of Piet Kramer's bridge. Her twin is a boy with rabbits; on a ten-metre pylon above, a child stands under a rearing horse.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Kindertjesbrug"
    },
    {
      modelId: "kinderbrug-jongen-konijnen",
      landmarkId: "osm_artwork_4370459609",
      name: "Kinderbrug: Boy with rabbits (Hildo Krop)",
      funFact: "Hildo Krop carved this boy with rabbits into a capstone of Piet Kramer's bridge. The child under the rearing horse on its ten-metre pylon was Hedda van Gennep, later a documentary maker.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Kindertjesbrug"
    },
    {
      modelId: "krijtberg",
      landmarkId: "krijtberg",
      name: "De Krijtberg",
      funFact: "The Jesuits have served this spot since 1654, first in a hidden church in a house called Crijtberg. Alfred Tepe's neo-Gothic church of 1881-83 squeezes between canal houses, with a 31-metre vault and two stair towers.",
      sourceUrl: "https://nl.wikipedia.org/wiki/De_Krijtberg"
    },
    {
      modelId: "westermoskee",
      landmarkId: "lm-extract_landmarks_1632187034",
      name: "Westermoskee",
      funFact: "Milli G\xF6r\xFC\u015F bought the derelict site in 1994; years of fierce dispute followed before a 2000 deal set a 43-metre minaret. Building began in 2013 and the mosque opened on 1 April 2016.",
      sourceUrl: "https://nl.wikipedia.org/wiki/Westermoskee"
    },
    {
      modelId: "de-bloem",
      landmarkId: "n418044454",
      osmId: "n418044454",
      name: "De Bloem",
      coordinates: [
        4.8601724,
        52.3847078
      ],
      description: "De Bloem is a corn mill from 1768 that first stood on the Rijkeroort bastion on the Singelgracht, the bastion that also gave the Bloemgracht its name. The mill was in the way of the new Marnixstraat, so it was taken down in 1877 and rebuilt here on the Haarlemmerweg in 1878, on a four-metre brick base. It ground grain until 1960. Locals also call it the 400 Roe, after its distance from the Haarlemmerpoort.",
      sourceUrl: "https://nl.wikipedia.org/wiki/De_Bloem_(Amsterdam)",
      additionalSources: [
        "https://www.molendatabase.nl/molens/ten-bruggencate-nr-00802",
        "https://www.wikidata.org/wiki/Q1822494"
      ],
      center: [
        52.3847078,
        4.8601724
      ]
    },
    {
      modelId: "de-otter",
      landmarkId: "w276340032",
      osmId: "w276340032",
      name: "De Otter",
      coordinates: [
        4.8709425,
        52.376173
      ],
      description: "De Otter is a paltrok, a wind-powered sawmill whose whole body turns on its base to face the wind. It was built in 1631 for the Amsterdam sawmill company and is the oldest paltrok still standing, the last of the many sawmills that once lined the Kostverlorenvaart. It lost its sails in 1925 and was restored to working order in the 1990s.",
      sourceUrl: "https://en.wikipedia.org/wiki/De_Otter,_Amsterdam",
      additionalSources: [
        "https://nl.wikipedia.org/wiki/De_Otter_(Amsterdam)",
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/1198"
      ],
      center: [
        52.376173,
        4.8709425
      ]
    },
    {
      modelId: "d-admiraal",
      landmarkId: "n31101329",
      osmId: "n31101329",
      name: "D'Admiraal",
      coordinates: [
        4.9235048,
        52.4025624
      ],
      description: "D'Admiraal is the last surviving chalk and tras mill of its kind, built in 1792 by Symon Krol for Elizabeth Admiraal beside the Noordhollandsch Kanaal. It first ground Eifel tuff into tras for mortar, and around 1900 switched to grinding chalk for the paint industry. Its thatched octagon stands on top of a timber shed. The board under the sails reads 1792, and the one on the back reads d'Admiraal.",
      sourceUrl: "https://nl.wikipedia.org/wiki/D%27Admiraal",
      additionalSources: [
        "https://www.molendatabase.nl/molens/ten-bruggencate-nr-00238",
        "https://monumentenregister.cultureelerfgoed.nl/monumenten/6609"
      ],
      center: [
        52.4025624,
        4.9235048
      ]
    }
  ];

  // src/canalRecall/game/native-kit-pois.json
  var native_kit_pois_default = [
    {
      buildingId: "NL.IMBAG.Pand.0363100012167944",
      landmarkId: "extract_landmarks_1997051448",
      name: "Fatih",
      sourceUrl: "https://nl.wikipedia.org/wiki/Fatih-moskee"
    }
  ];

  // src/canalRecall/game/manualPoiCatalog.ts
  var supplemental = new Map(manual_poi_data_default.map((fact) => [fact.modelId, fact]));
  var additiveHostsByPoi = /* @__PURE__ */ new Map();
  for (const model of SIGNATURE_MODELS) {
    const hosts = new Set(model.hostWallOpenings?.map((opening) => opening.hostIdentity).filter((id) => !model.suppressOsmIds.includes(id)));
    if (!hosts.size) continue;
    for (const id of [model.landmarkId, ...model.relatedLandmarkIds ?? [], ...model.destinationLandmarkIds ?? []]) {
      if (id) additiveHostsByPoi.set(id, hosts);
    }
  }
  function manualPoiBuildingIds(landmarkId, ids) {
    const hosts = additiveHostsByPoi.get(landmarkId);
    return [...new Set(ids)].filter((id) => !hosts?.has(id));
  }
  function mergeManualPoiFeatures(features, cityId = "amsterdam") {
    if (cityId !== "amsterdam") return [...features];
    const kitIds = new Set(native_kit_pois_default.map((poi) => poi.landmarkId));
    const merged = new Map(features.map((feature) => [feature.id, {
      ...feature,
      ...kitIds.has(feature.id) ? { nativeKitPoi: true } : {}
    }]));
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
          buildingIds: manualPoiBuildingIds(id, [...existing?.buildingIds ?? [], ...model.suppressOsmIds ?? []]),
          // Hand-modelled assets get a tie-break bump over their extract score,
          // not the old hard 220 floor that let any modelled building outrank a
          // genuinely famous one. Routing now weighs real notability; this field
          // only orders ties and keeps the map-label admission via `manualPoi`.
          prominenceScore: (existing?.prominenceScore ?? 0) + 1
        });
      }
      if (model.id !== "muziekgebouw-bimhuis") {
        for (const alias of ids.slice(1)) if (!destinations.includes(alias)) merged.delete(alias);
      }
    }
    return [...merged.values()];
  }

  // src/canalRecall/game/teachingPacer.ts
  var PREEMPT_AFTER_SECONDS = 6;
  var CLICK_PREEMPT_AFTER_SECONDS = 20;
  var DRIVE_BY_MIN_GAP_SECONDS = 15;
  var POSTCARD_FIRST_VISITS = 3;
  var POSTCARD_QUIET_SECONDS = 45;
  var POSTCARD_MIN_GAP_SECONDS = 120;
  var POSTCARD_LULL_SECONDS = 90;
  var POSTCARD_LULL_GAP_SECONDS = 180;
  var CARD_COLLAPSE_AFTER_SECONDS = 8;
  function sinceEvent(now, at) {
    return at == null || at > now ? Infinity : now - at;
  }
  function postcardOnEntry(input) {
    if (input.priorEntries < POSTCARD_FIRST_VISITS) return true;
    return sinceEvent(input.now, input.lastTriviaAt) >= POSTCARD_QUIET_SECONDS && sinceEvent(input.now, input.lastPostcardAt) >= POSTCARD_MIN_GAP_SECONDS;
  }
  function postcardForLull(input) {
    const trivia = input.lastTriviaAt != null && input.lastTriviaAt <= input.now ? input.lastTriviaAt : -Infinity;
    return sinceEvent(input.now, Math.max(input.enteredAt, trivia)) >= POSTCARD_LULL_SECONDS && sinceEvent(input.now, input.lastPostcardAt) >= POSTCARD_LULL_GAP_SECONDS;
  }
  function cardCollapsed(source, elapsed) {
    if (source !== "street" && source !== "drive-by") return false;
    return elapsed >= CARD_COLLAPSE_AFTER_SECONDS;
  }
  var FOLDED_BODY_LINES = 2;
  function foldedCardLine(notice) {
    const detail = (notice.detail || "").trim();
    const fact = notice.factTexts?.find((text2) => text2 && detail.endsWith(text2.trim()));
    if (fact) return fact.trim();
    const text = detail || (notice.longDetail || "").trim();
    return firstSentence(text);
  }
  var ABBREVIATIONS = /\b(St|Sts|Dr|Mr|Mrs|Ms|Prof|Jr|Sr|ca|c|no|nr|vol|Ste|Mt)\.$/i;
  function firstSentence(text) {
    const end = /[.!?](?=\s+[A-Z0-9"'‘“(])/g;
    for (let m = end.exec(text); m; m = end.exec(text)) {
      const head = text.slice(0, m.index + 1);
      if (!ABBREVIATIONS.test(head)) return head.trim();
    }
    return text.trim();
  }

  // src/canalRecall/game/postcardPacing.ts
  var storageKey = (cityId) => `canalRecall.neighborhoodEntries.${cityId}`;
  function loadEntryCounts(storage2, cityId) {
    try {
      const raw = storage2?.getItem(storageKey(cityId));
      const parsed = raw ? JSON.parse(raw) : {};
      return new Map(Object.entries(parsed).filter((e) => typeof e[1] === "number"));
    } catch {
      return /* @__PURE__ */ new Map();
    }
  }
  function recordEntry(storage2, cityId, counts, name) {
    const prior = counts.get(name) ?? 0;
    counts.set(name, prior + 1);
    try {
      storage2?.setItem(storageKey(cityId), JSON.stringify(Object.fromEntries(counts)));
    } catch {
    }
    return prior;
  }

  // src/canalRecall/game/poiNotability.ts
  var A_LIST = [
    { name: "Rijksmuseum", wikidata: ["Q190804"] },
    { name: "Van Gogh Museum", wikidata: ["Q224124"] },
    { name: "Stedelijk Museum", aliases: ["Stedelijk Museum Amsterdam"], wikidata: ["Q924335", "Q42175133"] },
    { name: "Anne Frank Huis", aliases: ["Anne Frank House"], wikidata: ["Q165366"] },
    { name: "Westerkerk", wikidata: ["Q1130722"] },
    { name: "Koninklijk Paleis", aliases: ["Royal Palace", "Paleis op de Dam", "Royal Palace of Amsterdam"], wikidata: ["Q1056152"] },
    { name: "Nieuwe Kerk", aliases: ["Nieuwe Kerk Amsterdam"], wikidata: ["Q1419675"] },
    { name: "Oude Kerk", aliases: ["Oude Kerk Amsterdam"], wikidata: ["Q623558"] },
    { name: "Concertgebouw", aliases: ["Royal Concertgebouw", "Koninklijk Concertgebouw"], wikidata: ["Q849957"] },
    { name: "Amsterdam Centraal", aliases: ["Central Station", "Amsterdam Centraal Station"], wikidata: ["Q50719"] },
    { name: "Magere Brug", aliases: ["Skinny Bridge", "Skinny bridge"], wikidata: ["Q1344400"] },
    { name: "Munttoren", aliases: ["Mint Tower", "Munt Tower"], wikidata: ["Q1429748"] },
    { name: "De Waag", aliases: ["Waag", "Weigh House"], wikidata: ["Q2466999"] },
    { name: "Begijnhof", wikidata: ["Q1629214"] },
    { name: "Homomonument", wikidata: ["Q51411"] },
    { name: "Rembrandthuis", aliases: ["Rembrandt House", "Museum Het Rembrandthuis", "Rembrandt House Museum"], wikidata: ["Q277316"] },
    { name: "Portugese Synagoge", aliases: ["Portuguese Synagogue"], wikidata: ["Q1853707"] },
    { name: "Joods Museum", aliases: ["Jewish Museum", "Jewish Historical Museum", "Joods Historisch Museum"], wikidata: ["Q702726"] },
    { name: "Het Scheepvaartmuseum", aliases: ["National Maritime Museum", "Scheepvaartmuseum", "Nederlands Scheepvaartmuseum"], wikidata: ["Q1616123"] },
    { name: "NEMO", aliases: ["NEMO Science Museum", "Nemo"], wikidata: ["Q1422000"] },
    { name: "EYE Filmmuseum", aliases: ["Eye Filmmuseum", "EYE Film Institute"], wikidata: ["Q1538389"] },
    { name: "A'DAM Toren", aliases: ["A'DAM Tower", "Adam Tower", "ADAM Tower"], wikidata: ["Q21185268"] },
    { name: "Artis", aliases: ["Natura Artis Magistra", "Artis Zoo"], wikidata: ["Q713124"] },
    { name: "Hortus Botanicus", aliases: ["Hortus Botanicus Amsterdam", "Botanical Garden Amsterdam"], wikidata: ["Q2475752"] },
    { name: "Koninklijk Theater Carr\xE9", aliases: ["Royal Theater Carr\xE9", "Theater Carr\xE9", "Carr\xE9"], wikidata: ["Q1106490"] },
    { name: "Tuschinski", aliases: ["Path\xE9 Tuschinski", "Tuschinski Theater", "Path\xE9 Tuschinski Cinema"], wikidata: ["Q599272"] },
    { name: "Bloemenmarkt", aliases: ["Flower Market"], wikidata: ["Q643079"] },
    { name: "Schreierstoren", aliases: ["Schreierstoren"], wikidata: ["Q610402"] },
    { name: "Montelbaanstoren", wikidata: ["Q1946061"] },
    { name: "Westergasfabriek", wikidata: ["Q4848627"] },
    { name: "Albert Cuypmarkt", aliases: ["Albert Cuyp Market"], wikidata: ["Q1322408"] },
    { name: "Heineken Experience", aliases: ["Heineken Experience Amsterdam"], wikidata: ["Q2087161"] },
    { name: "Hermitage", aliases: ["H'ART Museum", "Hermitage Amsterdam", "H ART Museum"], wikidata: ["Q2509774"] },
    { name: "Amstel Hotel", wikidata: ["Q1780741"] },
    { name: "Stopera", aliases: ["Muziektheater"], wikidata: ["Q1587736"] },
    { name: "Sint-Nicolaasbasiliek", aliases: ["Basilica of Saint Nicholas", "Basiliek van de Heilige Nicolaas", "Co-kathedrale Basiliek van Sint Nicolaas"], wikidata: ["Q1350750"] },
    { name: "De Krijtberg", aliases: ["Krijtberg", "Sint-Franciscus Xaveriuskerk"], wikidata: ["Q1180056"] },
    { name: "Zuiderkerk", wikidata: ["Q228629"] },
    { name: "Noorderkerk", wikidata: ["Q613854"] },
    { name: "Vondelpark", wikidata: ["Q2279698"] },
    { name: "Nationaal Monument", aliases: ["National Monument", "National Monument on Dam Square", "Dam Square", "Nationaal Monument op de Dam"], wikidata: ["Q473851"] },
    { name: "Leidseplein", wikidata: ["Q501445"] },
    { name: "Rembrandtplein", wikidata: ["Q613678"] },
    { name: "Museumplein", wikidata: ["Q2172631"] },
    { name: "Stadsschouwburg", aliases: ["Stadsschouwburg Amsterdam", "Internationaal Theater Amsterdam"], wikidata: ["Q1817103"] },
    { name: "Bijbels Museum", aliases: ["Biblical Museum"], wikidata: ["Q2111026"] },
    { name: "Hollandsche Schouwburg", wikidata: ["Q2206529"] },
    { name: "Nationaal Holocaust Namenmonument", aliases: ["Holocaust Namenmonument", "National Holocaust Names Monument"], wikidata: ["Q66023853"] },
    { name: "De Dokwerker", aliases: ["Dokwerker"], wikidata: ["Q1179838"] },
    { name: "Ons' Lieve Heer op Solder", aliases: ["Our Lord in the Attic", "Museum Ons' Lieve Heer op Solder"], wikidata: ["Q493160"] },
    { name: "Amsterdam Museum", wikidata: ["Q1820897"] },
    { name: "Moco", aliases: ["Moco Museum"], wikidata: ["Q26832671"] },
    { name: "FOAM", aliases: ["Foam", "Fotografiemuseum Amsterdam"], wikidata: ["Q5422840"] },
    { name: "Huis Bartolotti", aliases: ["Bartolotti House"], wikidata: ["Q2205055"] },
    { name: "Scheepvaarthuis", aliases: ["Shipping House"], wikidata: ["Q2078885"] },
    { name: "Beurs van Berlage", aliases: ["Berlage's Stock Market", "Berlage Beurs"], wikidata: ["Q851200"] },
    { name: "Centrale Bibliotheek", aliases: ["OBA", "Amsterdam Public Library Oosterdok", "Openbare Bibliotheek Amsterdam", "Centrale Bibliotheek OBA"], wikidata: ["Q50413436"] }
  ];
  var A_LIST_BY_NAME = /* @__PURE__ */ new Map();
  var A_LIST_BY_WIKIDATA = /* @__PURE__ */ new Map();
  for (const entry of A_LIST) {
    for (const name of [entry.name, ...entry.aliases ?? []]) {
      A_LIST_BY_NAME.set(normaliseAnswer(name), entry);
    }
    for (const qid of entry.wikidata ?? []) A_LIST_BY_WIKIDATA.set(qid, entry);
  }

  // src/canalRecall/game/routeSelection.ts
  function nearestRouteIndex(route, player) {
    if (route.length === 1) return { index: 0, distance: Math.hypot(route[0].x - player.x, route[0].y - player.y) };
    let index = 0, distance = Infinity;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t2 = Math.max(0, Math.min(1, ((player.x - a.x) * dx + (player.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(a.x + dx * t2 - player.x, a.y + dy * t2 - player.y);
      if (d < distance) {
        distance = d;
        index = i;
      }
    }
    return { index, distance };
  }
  var START_HEADING_SNAP_RAD = Math.PI / 6;

  // src/canalRecall/game/driveByTrigger.ts
  var DRIVE_BY_RADIUS = 135;
  var DRIVE_BY_LOOKAHEAD_SECONDS = 3;
  var DRIVE_BY_MIN_LOOKAHEAD = DRIVE_BY_RADIUS;
  var DRIVE_BY_ROUTE_TOLERANCE = 140;
  var DRIVE_BY_PASSED_BEHIND = 90;
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
            const t2 = left / step;
            path.push({ x: from.x + (route[i].x - from.x) * t2, y: from.y + (route[i].y - from.y) * t2 });
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
      const t2 = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (length * length))) : 0;
      const distance = Math.hypot(a.x + dx * t2 - point.x, a.y + dy * t2 - point.y);
      if (!best || distance < best.distance) best = { distance, along: travelled + length * t2 };
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
    if (source === "arrival") return false;
    return elapsed >= (source === "click" ? CLICK_PREEMPT_AFTER_SECONDS : PREEMPT_AFTER_SECONDS);
  }
  function driveByGapElapsed(lastShownAt, now) {
    return sinceEvent(now, lastShownAt) >= DRIVE_BY_MIN_GAP_SECONDS;
  }

  // src/canalRecall/transit/corridorStreets.ts
  function pointToSegDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 <= 1e-9) return Math.hypot(px - ax, py - ay);
    let t2 = ((px - ax) * dx + (py - ay) * dy) / len2;
    t2 = Math.max(0, Math.min(1, t2));
    return Math.hypot(px - (ax + t2 * dx), py - (ay + t2 * dy));
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
      const owner = building && building.id != null ? this.landmarks.find((landmark) => manualPoiBuildingIds(landmark.id, landmark.buildingIds ?? []).includes(String(building.id))) : void 0;
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
    _showLandmarkNotice(notice, hold, source = "click", streetEntry) {
      if (this._landmarkNotice) this.vectorMap?.setActiveLandmark(null);
      this._landmarkNotice = this._withRotatedFact(notice, streetEntry);
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
    _withRotatedFact(notice, streetEntry) {
      if (!this._facts || !this._facts.size) return notice;
      const chosen = factCardText(
        notice.id,
        this._facts,
        this._factRotation,
        notice.detail || notice.longDetail
      );
      if (!chosen) return notice;
      this._commitFact(chosen.choice);
      const text = streetEntry ? streetCardWithRotatedFact(streetEntry, chosen.text) : chosen.text;
      return { ...notice, ...text };
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
      const matched = this.landmarks.find((landmark) => landmark.id === String(building.id) || manualPoiBuildingIds(landmark.id, landmark.buildingIds ?? []).includes(String(building.id)));
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
      const safeName = buildingName && spoils?.call(this.vectorMap, buildingName) ? "" : buildingName;
      const facts = describeBuilding(row, building.height, safeName);
      if (!row) this._requestBuildingFacts(building);
      return {
        id: `clicked-${building.id || building.lngLat.join("-")}`,
        name: facts.name,
        type: "building",
        detail: facts.detail,
        lngLat: building.lngLat,
        featureTarget: building.featureTarget
      };
    }
    /** The card opens at once with what is known; when the clicked building's
     *  fact tile was not resident yet, its year and type fill in on arrival. */
    _requestBuildingFacts(building) {
      const store = this._buildingFacts;
      if (!store || !building.lngLat) return;
      const cardId = `clicked-${building.id || building.lngLat.join("-")}`;
      void store.ensureAt(building.lngLat[0], building.lngLat[1]).then(() => {
        if (this._landmarkNotice?.id !== cardId || !store.lookup(building.id)) return;
        const card = this._cardForClickedBuilding(building);
        if (card && this._landmarkNotice?.id === cardId) this._landmarkNotice = { ...this._landmarkNotice, name: card.name, detail: card.detail };
      });
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
      }, { kind: "sticky" }, "street", entry);
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
        const knowledge = buildRouteKnowledgeIndex(streetKnowledge, streetFeatures, waterFeatures, normalise, [], {}, bridgeFeatures);
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
              bridgeRegister?.bridges ?? {},
              bridgeFeatures
            );
          }
          if (brandedPois) this.vectorMap.setBrandedPois(brandedPois);
          if (landmarkBuildings?.buildings && this.landmarks === landmarks) {
            for (const landmark of landmarks) landmark.buildingIds = manualPoiBuildingIds(landmark.id, [
              ...landmark.buildingIds ?? [],
              ...landmarkBuildings.buildings[landmark.id] ?? []
            ]);
          }
        });
        const transitStops = this.osmLoader?.transitLoad?.stops || [];
        this.vectorMap.setSpoilerNames([
          ...streetFeatures,
          ...waterFeatures,
          ...bridgeFeatures,
          ...transitStops,
          // A bridge's official spelling is an answer too.
          ...bridgeFeatures.map((bridge) => ({ name: bridge.displayName }))
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
        this.bridges = buildBridges(bridgeFeatures, crossingIndex, toWorld, waterFeatures);
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
      if (this._postcardPending && this._postcardPending === this.currentNeighborhood && this.viewport?.mode !== "compact" && canShowPostcard(this.viewport?.mode, this._teachingGate()) && this.raceTime > NEIGHBORHOOD_NOTICE_GRACE) {
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
      if (this.freeRide) return;
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
      const collapsed = cardCollapsed(this._landmarkNoticeSource, this._landmarkNoticeState.elapsed);
      const img = collapsed ? null : this._landmarkImages && this._landmarkImages.get(lm.id);
      const hasImage = !!(img && img.complete && img.naturalWidth > 0);
      const cards = window.CanalRecallCards;
      const measure = (text, font) => {
        ctx.font = font;
        return ctx.measureText(text).width;
      };
      const card = cards.measureLandmarkCard({
        name: lm.name,
        body: collapsed ? foldedCardLine(lm) : lm.longDetail || lm.detail || cards.placeOnlyDetail(
          lm.type,
          this.currentNeighborhood,
          this._cityDisplayName()
        ),
        category: lm.type ? lm.type.toUpperCase() : "",
        factKind: lm.factKind,
        extractLang: lm.extractLang,
        hasArticle: !!(lm.wikipediaUrl || lm.sourceUrl),
        articleLabel: lm.wikipediaUrl ? "W  WIKIPEDIA" : "W  SOURCE",
        hasImage,
        ...collapsed ? { maxBodyLines: FOLDED_BODY_LINES, hasMore: (lm.longDetail || lm.detail || "").trim() !== foldedCardLine(lm) } : {}
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
        link.textContent = lm.wikipediaUrl ? t("ride.wikipediaLink") : t("ride.researchSource");
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
      research.textContent = t("ride.researchSource");
      panel.querySelector("#landmark-panel-scroll").scrollTop = 0;
      this._toggleUtilityPanel(panel);
      return true;
    }
    _renderNeighborhoodNotice() {
      const hood = this._neighborhoodNotice;
      if (!hood || this._neighborhoodNoticeTimer <= 0) return;
      if (!canShowPostcard(this.viewport?.mode, this._teachingGate())) return;
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
