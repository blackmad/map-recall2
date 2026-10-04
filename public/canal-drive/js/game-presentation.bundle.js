"use strict";
(() => {
  // src/canalRecall/game/routeRibbon.ts
  var RIBBON_AID_COST = { line: 0.5, arrow: 0.25, minimap: 0.25 };
  var ROUTE_RIBBON_TIERS = [
    { id: "gold", label: "GOLD RIBBON", min: 0.85, minRecall: 0.8, color: "#7a5d0f", dim: "rgba(196,150,30,.16)" },
    { id: "silver", label: "SILVER RIBBON", min: 0.68, minRecall: 0.55, color: "#4f5864", dim: "rgba(79,88,100,.12)" },
    { id: "bronze", label: "BRONZE RIBBON", min: 0.5, minRecall: 0.25, color: "#8a4a18", dim: "rgba(180,104,44,.14)" },
    { id: "none", label: "ROUTE COMPLETE", min: -Infinity, minRecall: -Infinity, color: "#3a5a86", dim: "rgba(58,90,134,.1)" }
  ];
  var TYPING_SELF_RELIANCE_BONUS = 0.15;
  var EFFICIENCY_FULL = 0.9;
  var EFFICIENCY_NONE = 0.55;
  function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }
  function idealRouteLength(plannedPx, routePath) {
    if (plannedPx > 0) return plannedPx;
    if (!routePath || routePath.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < routePath.length; i++) {
      total += Math.hypot(routePath[i].x - routePath[i - 1].x, routePath[i].y - routePath[i - 1].y);
    }
    return total;
  }
  function computeRouteRibbon(input) {
    const axes = [];
    const recall = input.attempts > 0 ? input.correct / input.attempts : 0;
    axes.push({ id: "recall", label: "Recall", weight: 0.5, score: recall });
    let aidCost = 0;
    for (const [aid, cost] of Object.entries(RIBBON_AID_COST)) {
      if (input.aidsUsed[aid]) aidCost += cost;
    }
    const selfReliance = 1 - aidCost + (input.typedAnswers ? TYPING_SELF_RELIANCE_BONUS : 0);
    axes.push({ id: "aids", label: "Unaided", weight: 0.25, score: clamp01(selfReliance) });
    if (input.idealPx > 0 && input.actualPx > 0) {
      const ratio = Math.min(1, input.idealPx / input.actualPx);
      axes.push({
        id: "efficiency",
        label: "Efficiency",
        weight: 0.25,
        score: clamp01((ratio - EFFICIENCY_NONE) / (EFFICIENCY_FULL - EFFICIENCY_NONE))
      });
    }
    const totalWeight = axes.reduce((sum, axis) => sum + axis.weight, 0);
    const score = totalWeight > 0 ? axes.reduce((sum, axis) => sum + axis.weight * axis.score, 0) / totalWeight : 0;
    const tier = ROUTE_RIBBON_TIERS.find((entry) => score >= entry.min && recall >= entry.minRecall) ?? ROUTE_RIBBON_TIERS[ROUTE_RIBBON_TIERS.length - 1];
    return { ...tier, score, axes };
  }

  // src/canalRecall/game/progressStore.ts
  var LEADERBOARD_STORAGE_KEY = "satb_bestTimes";
  var EXPLORATION_STORAGE_KEY = "canalRecall.exploration.v1";
  var LEADERBOARD_MAX_ENTRIES = 50;
  function readJson(store, key, fallback) {
    try {
      const raw = store.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }
  function readBestTimes(store) {
    return readJson(store, LEADERBOARD_STORAGE_KEY, {});
  }
  function getBestTime(store, key) {
    if (!key) return null;
    return readBestTimes(store)[key] ?? null;
  }
  function recordBestTime(store, key, run, maxEntries = LEADERBOARD_MAX_ENTRIES) {
    if (!key) return false;
    const data = readBestTimes(store);
    const existing = data[key];
    if (existing && run.time >= existing.time) return false;
    data[key] = run;
    const keys = Object.keys(data);
    if (keys.length > maxEntries) {
      keys.sort((a, b) => (data[a].date || "").localeCompare(data[b].date || ""));
      while (Object.keys(data).length > maxEntries) {
        const oldest = keys.shift();
        if (oldest === void 0) break;
        delete data[oldest];
      }
    }
    store.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(data));
    return true;
  }
  function pixelsToMiles(distancePx, pixelsPerMeter) {
    const meters = distancePx / pixelsPerMeter;
    return parseFloat((meters / 1609.344).toFixed(2));
  }
  function emptyExploration() {
    return {
      learnedWaterways: [],
      learnedStreets: [],
      learnedTransitLines: [],
      learnedTransitStops: [],
      visitedNeighborhoods: [],
      seenLandmarks: [],
      totalRoutes: 0,
      totalCorrect: 0,
      totalAttempts: 0
    };
  }
  function readExploration(store) {
    const stored = readJson(store, EXPLORATION_STORAGE_KEY, {});
    const base = emptyExploration();
    return {
      learnedWaterways: stored.learnedWaterways ?? base.learnedWaterways,
      learnedStreets: stored.learnedStreets ?? base.learnedStreets,
      learnedTransitLines: stored.learnedTransitLines ?? base.learnedTransitLines,
      learnedTransitStops: stored.learnedTransitStops ?? base.learnedTransitStops,
      visitedNeighborhoods: stored.visitedNeighborhoods ?? base.visitedNeighborhoods,
      seenLandmarks: stored.seenLandmarks ?? base.seenLandmarks,
      totalRoutes: stored.totalRoutes ?? base.totalRoutes,
      totalCorrect: stored.totalCorrect ?? base.totalCorrect,
      totalAttempts: stored.totalAttempts ?? base.totalAttempts
    };
  }
  function addUnique(existing, items) {
    const set = new Set(existing);
    for (const item of items) set.add(item);
    return [...set];
  }
  function mergeExploration(current, contribution) {
    const kind = contribution.learnedKind;
    return {
      learnedWaterways: kind === "water" ? addUnique(current.learnedWaterways, contribution.learnedNames) : current.learnedWaterways,
      learnedStreets: kind === "street" ? addUnique(current.learnedStreets, contribution.learnedNames) : current.learnedStreets,
      learnedTransitLines: kind === "transit" ? addUnique(current.learnedTransitLines, contribution.learnedNames) : current.learnedTransitLines,
      learnedTransitStops: kind === "transit" ? addUnique(current.learnedTransitStops, contribution.learnedStopNames || []) : current.learnedTransitStops,
      visitedNeighborhoods: addUnique(current.visitedNeighborhoods, contribution.visitedNeighborhoods),
      seenLandmarks: addUnique(current.seenLandmarks, contribution.seenLandmarkNames),
      totalRoutes: current.totalRoutes + 1,
      totalCorrect: current.totalCorrect + contribution.correct,
      totalAttempts: current.totalAttempts + contribution.attempts
    };
  }
  function saveExploration(store, exploration) {
    store.setItem(EXPLORATION_STORAGE_KEY, JSON.stringify(exploration));
  }
  function explorationGain(before, after) {
    const beforeNames = before.learnedWaterways.length + before.learnedStreets.length + before.learnedTransitLines.length + before.learnedTransitStops.length;
    const afterNames = after.learnedWaterways.length + after.learnedStreets.length + after.learnedTransitLines.length + after.learnedTransitStops.length;
    return {
      newNames: afterNames - beforeNames,
      newNeighborhoods: after.visitedNeighborhoods.length - before.visitedNeighborhoods.length,
      newLandmarks: after.seenLandmarks.length - before.seenLandmarks.length
    };
  }

  // src/canalRecall/game/placeStreak.ts
  var PLACE_STREAK_STORAGE_KEY = "canalRecall.placeStreak.v1";
  function emptyPlaceStreak() {
    return { days: [], current: 0, best: 0 };
  }
  function utcDayKey(now = Date.now()) {
    return new Date(now).toISOString().slice(0, 10);
  }
  function dayOffset(key, delta) {
    const date = /* @__PURE__ */ new Date(`${key}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
  }
  function recompute(days) {
    const unique = [...new Set(days)].sort();
    if (unique.length === 0) return emptyPlaceStreak();
    const today = utcDayKey();
    const yesterday = dayOffset(today, -1);
    let current = 0;
    let cursor = unique.includes(today) ? today : unique.includes(yesterday) ? yesterday : "";
    while (cursor && unique.includes(cursor)) {
      current += 1;
      cursor = dayOffset(cursor, -1);
    }
    let best = current;
    let run = 1;
    for (let i = 1; i < unique.length; i++) {
      if (unique[i] === dayOffset(unique[i - 1], 1)) run += 1;
      else run = 1;
      if (run > best) best = run;
    }
    return { days: unique.slice(-90), current, best: Math.max(best, current) };
  }
  function readPlaceStreak(store) {
    try {
      const raw = store.getItem(PLACE_STREAK_STORAGE_KEY);
      if (!raw) return emptyPlaceStreak();
      const parsed = JSON.parse(raw);
      return recompute(Array.isArray(parsed.days) ? parsed.days.map(String) : []);
    } catch {
      return emptyPlaceStreak();
    }
  }
  function notePlaceDay(store, now = Date.now()) {
    const day = utcDayKey(now);
    const prior = readPlaceStreak(store);
    if (prior.days.includes(day)) return prior;
    const next = recompute([...prior.days, day]);
    try {
      store.setItem(PLACE_STREAK_STORAGE_KEY, JSON.stringify(next));
    } catch {
    }
    return next;
  }
  function placeStreakLabel(streak) {
    if (streak.current <= 0) return null;
    if (streak.current === 1) return "First new place today";
    return `${streak.current}-day place streak`;
  }

  // src/canalRecall/game/neighborhoodPassport.ts
  var PASSPORT_STORAGE_KEY = "canalRecall.neighborhoodPassport.v1";
  var PASSPORT_MIN_NAMES = 8;
  function emptyPassport() {
    return { stamped: [] };
  }
  function readPassport(store) {
    try {
      const raw = store.getItem(PASSPORT_STORAGE_KEY);
      if (!raw) return emptyPassport();
      const parsed = JSON.parse(raw);
      return { stamped: Array.isArray(parsed.stamped) ? parsed.stamped.map(String) : [] };
    } catch {
      return emptyPassport();
    }
  }
  function savePassport(store, passport) {
    try {
      store.setItem(PASSPORT_STORAGE_KEY, JSON.stringify(passport));
    } catch {
    }
  }
  function stampNewNeighborhoods(exploration, visitedThisRoute, prior, minNames = PASSPORT_MIN_NAMES) {
    const known = exploration.learnedWaterways.length + exploration.learnedStreets.length + exploration.learnedTransitLines.length + exploration.learnedTransitStops.length;
    if (known < minNames) return { passport: prior, fresh: [] };
    const stamped = new Set(prior.stamped);
    const fresh = [];
    for (const hood of visitedThisRoute) {
      if (!hood || stamped.has(hood)) continue;
      if (!exploration.visitedNeighborhoods.includes(hood)) continue;
      stamped.add(hood);
      fresh.push(hood);
    }
    return { passport: { stamped: [...stamped].sort() }, fresh };
  }

  // src/canalRecall/game/finishStory.ts
  function finishStory(input) {
    const { gain, destinationName, cityName, newPassportStamps, placeStreak } = input;
    const dest = destinationName || "your destination";
    const bits = [];
    if (gain.newNames > 0) bits.push(`${gain.newNames} new name${gain.newNames === 1 ? "" : "s"}`);
    if (gain.newNeighborhoods > 0) {
      bits.push(`${gain.newNeighborhoods} new neighborhood${gain.newNeighborhoods === 1 ? "" : "s"}`);
    }
    if (gain.newLandmarks > 0) {
      bits.push(`${gain.newLandmarks} landmark${gain.newLandmarks === 1 ? "" : "s"}`);
    }
    let headline;
    if (bits.length) {
      headline = `You made it to ${dest} \xB7 ${bits.join(", ")}`;
    } else {
      headline = `Arrived at ${dest}`;
    }
    const detail = bits.length ? `That knowledge sticks on your ${cityName} map.` : "A clean ride \u2014 review something overdue next time.";
    const passport = newPassportStamps.length ? `Passport: ${newPassportStamps.slice(0, 3).join(", ")}${newPassportStamps.length > 3 ? "\u2026" : ""}` : null;
    const streak = placeStreakLabel(placeStreak);
    const guestTease = !input.signedIn && input.recallAvailable ? "Sign in to keep your progress on every device" : null;
    return { headline, detail, passport, streak, guestTease };
  }

  // src/canalRecall/game/missionBrief.ts
  var BOAT = [
    (d) => `Find your way to ${d} by water`,
    (d) => `Canal hop to ${d}`,
    (d) => `Drift toward ${d} \u2014 name what you ride`
  ];
  var BIKE = [
    (d) => `Ride toward ${d}`,
    (d) => `Pedal to ${d} \u2014 learn the turns`,
    // Neutral on purpose: destinations include memorials ("Make Dam Square
    // Victims 7 mei 1945 feel like home" was the review's example).
    (d) => `Learn the way to ${d}`
  ];
  var TRANSIT = [
    (d) => `Ride the line toward ${d}`,
    (d) => `One hop to ${d} \u2014 own the corridor`,
    (d) => `Transfer-ready: get to ${d}`
  ];
  var HOME = [
    (km) => km > 0 ? `Home ring \xB7 learn within ~${km.toFixed(1)} km` : "Home base \xB7 grow your learning ring",
    () => "Errand mode: leave knowing the way back"
  ];
  var HERE = [
    (d) => d && d !== "your destination" ? `From here toward ${d}` : "Start from where you are",
    (_d) => "Start from where you are \u2014 not a saved address"
  ];
  function pick(items, salt) {
    let h = 0;
    for (let i = 0; i < salt.length; i++) h = h * 31 + salt.charCodeAt(i) >>> 0;
    return items[h % items.length];
  }
  function missionBrief(input) {
    const brief = composeBrief(input);
    const due = input.reviewDueNearRoute ?? 0;
    if (due > 0) return { ...brief, tease: due === 1 ? "Review ride: 1 overdue name on the way" : `Review ride: ${due} overdue names on the way` };
    return brief;
  }
  function composeBrief(input) {
    const dest = (input.destinationName || "your destination").trim();
    const salt = `${input.cityName}|${dest}|${input.travelMode}|${input.routePattern}`;
    if (input.routePattern === "home") {
      const line2 = pick(HOME, salt)(input.homeLearningRadiusKm || 0);
      return {
        line: line2,
        tease: input.hasColdOpenReview ? "A review waits in the first minute" : void 0
      };
    }
    if (input.routePattern === "here") {
      const line2 = pick(HERE, salt)(dest);
      return {
        line: line2,
        tease: input.hasColdOpenReview ? "Warm up with one overdue name" : `Arrive knowing more of ${input.cityName}`
      };
    }
    const pool = input.travelMode === "boat" ? BOAT : input.travelMode === "transit" ? TRANSIT : BIKE;
    const line = pick(pool, salt)(dest);
    return {
      line,
      tease: input.hasColdOpenReview ? "Warm up with one overdue name" : `Arrive knowing more of ${input.cityName}`
    };
  }

  // src/canalRecall/game/introFlight.ts
  var INTRO_HOLD_S = 1.6;
  var INTRO_FLIGHT_S = 1.9;
  var INTRO_MAX_ZOOM_FRACTION = 0.2;
  var INTRO_CONTEXT = 0.7;
  var INTRO_MIN_ZOOM = 0.012;
  function introOverview(start, finish, box, playZoom, screenScale = 1) {
    const pad = 56;
    const usableW = Math.max(80, box.width - pad * 2);
    const usableH = Math.max(80, box.height - box.top - box.bottom - pad * 2);
    const spanX = Math.max(1, Math.abs(finish.x - start.x));
    const spanY = Math.max(1, Math.abs(finish.y - start.y));
    const fit = Math.min(usableW / spanX, usableH / spanY) * INTRO_CONTEXT / screenScale;
    const zoom = Math.min(fit, Math.max(INTRO_MIN_ZOOM, Math.min(fit, playZoom * INTRO_MAX_ZOOM_FRACTION)));
    const bandShift = (box.top - box.bottom) / 2 / (zoom * screenScale);
    return {
      x: (start.x + finish.x) / 2,
      y: (start.y + finish.y) / 2 - bandShift,
      zoom
    };
  }
  function introPlan(from, reducedMotion = false) {
    return { from, hold: reducedMotion ? INTRO_HOLD_S + 0.6 : INTRO_HOLD_S, flight: reducedMotion ? 0 : INTRO_FLIGHT_S };
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }
  function introFrame(plan, to, elapsed) {
    if (elapsed < plan.hold) return { ...plan.from, overview: 1, done: false };
    if (plan.flight <= 0 || elapsed >= plan.hold + plan.flight) return { ...to, overview: 0, done: true };
    const t = easeInOutCubic((elapsed - plan.hold) / plan.flight);
    const logFrom = Math.log(plan.from.zoom);
    const logTo = Math.log(to.zoom);
    const zoom = Math.exp(logFrom + (logTo - logFrom) * t);
    const scale = logTo === logFrom ? t : (Math.log(zoom) - logFrom) / (logTo - logFrom);
    return {
      x: plan.from.x + (to.x - plan.from.x) * scale,
      y: plan.from.y + (to.y - plan.from.y) * scale,
      zoom,
      overview: 1 - t,
      done: false
    };
  }

  // src/canalRecall/game/vehicleZoomScale.ts
  var VEHICLE_ZOOM_EXPONENT = 0.65;
  var VEHICLE_ZOOM_MIN_SCALE = 0.5;
  var VEHICLE_ZOOM_MAX_SCALE = 2.2;
  function vehicleZoomScale(zoom, defaultZoom) {
    if (!(zoom > 0) || !(defaultZoom > 0)) return 1;
    const scale = (defaultZoom / zoom) ** VEHICLE_ZOOM_EXPONENT;
    return Math.max(VEHICLE_ZOOM_MIN_SCALE, Math.min(VEHICLE_ZOOM_MAX_SCALE, scale));
  }

  // src/canalRecall/game/coldOpenReview.ts
  var COLD_OPEN_ENABLED = false;

  // src/canalRecall/game/modes.ts
  function isCar(mode) {
    return mode === "car";
  }
  function isTransit(mode) {
    return mode === "transit";
  }
  function isBoat(mode) {
    return mode === "boat";
  }

  // src/canalRecall/game/travelProfile.ts
  var PROFILES = {
    boat: {
      id: "boat",
      label: "Boat",
      extractFile: "water",
      quizRouteSubject: "waterway",
      quizRouteQuestion: "Which waterway are you on now?",
      learnedKind: "water",
      motion: "water",
      vehicle: "boat",
      networkNoun: "waterways",
      networkNounSingular: "waterway",
      recallNoun: "Canals",
      exploreNoun: "waterways",
      usesRoadConstraint: false,
      usesWaterTest: true
    },
    car: {
      id: "car",
      label: "Bike",
      extractFile: "streets-routing",
      quizRouteSubject: "street",
      quizRouteQuestion: "Which street are you on now?",
      learnedKind: "street",
      motion: "road",
      vehicle: "bike",
      networkNoun: "streets",
      networkNounSingular: "street",
      recallNoun: "Streets",
      exploreNoun: "streets",
      usesRoadConstraint: true,
      usesWaterTest: false
    },
    transit: {
      id: "transit",
      label: "Transit",
      extractFile: "transit-network",
      quizRouteSubject: "line",
      quizRouteQuestion: "Which line are you on now?",
      learnedKind: "transit",
      motion: "corridor",
      vehicle: "transit",
      networkNoun: "tram lines",
      networkNounSingular: "line",
      recallNoun: "Lines",
      exploreNoun: "lines and stops",
      usesRoadConstraint: true,
      usesWaterTest: false
    }
  };
  function travelProfile(mode) {
    return PROFILES[mode] ?? PROFILES.boat;
  }

  // src/canalRecall/game/recallRules.ts
  var MAX_HEADING_OFF_ROAD = Math.PI / 4;
  function hudWithholdsRouteName(input) {
    if (input.promptName) return true;
    if (input.candidateName && input.candidateName !== input.currentName) return true;
    if (!input.roadName || input.roadName === input.currentName) return false;
    return !input.revealed && !input.learned;
  }

  // src/canalRecall/game/teachingSurface.ts
  function canShowMiniMap(enabled, input) {
    return enabled && !input.utilityOpen;
  }
  function canShowPoiLabels(labelsWanted, input) {
    return labelsWanted && !input.quizOpen && !input.promptVisible;
  }

  // src/canalRecall/routing/bikeAccess.ts
  var BICYCLE_DENIED = /* @__PURE__ */ new Set(["no", "dismount", "private", "customers"]);
  function isBicycleRestricted(tags) {
    return BICYCLE_DENIED.has(tags.bicycle || "") || tags.bicycleRestricted === "yes";
  }
  function bicycleRestrictionNotice(tags) {
    if (!isBicycleRestricted(tags)) return null;
    const bicycle = tags.bicycle || "";
    if (bicycle === "dismount") return "Walk bikes in real life";
    if (bicycle === "private" || bicycle === "customers") return "Private \u2014 no public cycling";
    return "No cycling in real life";
  }

  // src/canalRecall/orientationPois.ts
  var SPOILER_MIN_LENGTH = 5;
  function normaliseSpoilerName(name) {
    return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function maskSpoiledName(label, names, fallback = "your destination") {
    if (!label) return label;
    const chars = [];
    const origin = [];
    for (let i = 0; i < label.length; i++) {
      const base = normaliseSpoilerName(label[i]);
      if (base) {
        chars.push(base);
        origin.push(i);
      } else if (chars.length && chars[chars.length - 1] !== " ") {
        chars.push(" ");
        origin.push(i);
      }
    }
    const text = chars.join("");
    const spans = [];
    for (const raw of new Set(names)) {
      const name = raw ? normaliseSpoilerName(raw) : "";
      if (name.length < SPOILER_MIN_LENGTH) continue;
      for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1)) {
        if (at > 0 && text[at - 1] !== " ") continue;
        spans.push([origin[at], origin[at + name.length - 1] + 1]);
      }
    }
    if (!spans.length) return label;
    spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    let out = "";
    let cursor = 0;
    for (const [start, end] of spans) {
      if (end <= cursor) continue;
      out += label.slice(cursor, Math.max(cursor, start)) + "\u2026";
      cursor = end;
    }
    out += label.slice(cursor);
    return /[\p{L}\p{N}]/u.test(out) ? out : fallback;
  }

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
    },
    {
      modelId: "concertgebouw",
      name: "Royal Concertgebouw",
      sourceUrl: "https://www.concertgebouw.nl/en/our-history/history",
      description: "The Royal Concertgebouw was designed by Adolf Leonard van Gendt and opened on 11 April 1888. Its famous classical facade is crowned by a golden lyre. Pi de Bruijn\u2019s 1985\u20131988 renovation added the glass promenade beside the historic halls."
    }
  ];

  // src/canalRecall/game/manualPoiCatalog.ts
  var supplemental = new Map(manual_poi_data_default.map((fact) => [fact.modelId, fact]));

  // src/canalRecall/game/routeSelection.ts
  var REVIEW_STOP_LABEL = "the mystery street";
  function isReviewStop(poi) {
    return !!poi && typeof poi.reviewStop === "string";
  }

  // src/canalRecall/game/trackpadTwist.ts
  var TWIST_DEADZONE_DEG = 6;
  var WHEEL_TWIST_DEG_PER_PX = 0.25;
  var WHEEL_PINCH_GRACE_MS = 250;
  function startTwist() {
    return { engaged: false, applied: 0 };
  }
  function twistStep(state, rotationDeg) {
    if (!Number.isFinite(rotationDeg)) return 0;
    if (!state.engaged) {
      if (Math.abs(rotationDeg) < TWIST_DEADZONE_DEG) return 0;
      state.engaged = true;
      state.applied = rotationDeg;
      return 0;
    }
    const delta = rotationDeg - state.applied;
    state.applied = rotationDeg;
    return delta;
  }
  function wheelTwistDegrees(event) {
    if (!event.altKey || event.ctrlKey) return null;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    return delta * scale * WHEEL_TWIST_DEG_PER_PX;
  }
  function bearingAfterTwist(bearingDeg, clockwiseDeg) {
    const next = bearingDeg - clockwiseDeg;
    return ((next + 180) % 360 + 360) % 360 - 180;
  }

  // src/canalRecall/game/presentationRuntime.ts
  var INK = "#1f1c17";
  var MUTED = "#5f584d";
  var BODY = "#2e2a23";
  var ACCENT = "#8a4a18";
  var GOOD = "#8a4a18";
  var COPPER = "#c9844a";
  var RULE = "rgba(31,28,23,0.16)";
  var UTILITY_REVEAL_MS = 3500;
  var GamePresentationRuntime = class {
    /** Return focus to the canvas after a card action so keyboard driving resumes. */
    _reclaimKeyboardFocus() {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== this.canvas) active.blur();
      try {
        this.canvas.focus({ preventScroll: true });
      } catch {
        this.canvas.focus();
      }
    }
    /** Logical canvas coordinates shared by mouse, pointer, and touch input. */
    _eventPoint(event) {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0, y: 0 };
      return { x: (event.clientX - rect.left) * CANVAS_W / rect.width, y: (event.clientY - rect.top) * CANVAS_H / rect.height };
    }
    // ---- Start-of-ride orientation flight ----
    /** Open the ride on an overview of start and destination, then fly down.
     *  Automated browsers skip it — dozens of specs inspect the driving camera
     *  straight after spawning — unless they set `__canalRecallForceIntro`. */
    _beginIntro() {
      const prepared = this._introPrepared;
      this._introPrepared = null;
      this._intro = null;
      const planned = prepared || this._planIntro();
      if (!planned) {
        this.camera.introOverview = 0;
        return;
      }
      this._intro = { plan: planned.plan, elapsed: 0, playZoom: planned.playZoom, overview: 1 };
      this.camera.resetPan();
      this.camera.rotation = 0;
      this.camera.introOverview = 1;
      this._applyIntroCamera(planned.plan.from.x, planned.plan.from.y, planned.plan.from.zoom);
    }
    /** The overview framing for this ride, or null when there is no flight. */
    _planIntro() {
      const player = this.player;
      const finish = this.track?.finishPoint;
      if (!player || !finish) return null;
      const forced = window.__canalRecallForceIntro;
      if (navigator.webdriver && !forced) return null;
      this._syncHudLayout();
      const layout = this._hudRects();
      const top = layout.destinationInRecall ? layout.recall.y + layout.recall.height : Math.max(layout.recall.y + layout.recall.height, layout.destination.y + layout.destination.height);
      const bottom = layout.dpad ? CANVAS_H - layout.dpad.bounds.y : 40;
      const playZoom = this.camera.zoom;
      const start = { x: player.x, y: player.y };
      const box = { width: CANVAS_W, height: CANVAS_H, top: top + 8, bottom: bottom + 8 };
      let from = introOverview(start, finish, box, playZoom);
      const previous = { introOverview: this.camera.introOverview, rotation: this.camera.rotation };
      this.camera.introOverview = 1;
      this.camera.rotation = 0;
      for (let round = 0; round < 2; round++) {
        this._applyIntroCamera(from.x, from.y, from.zoom);
        this.vectorMap.sync(this.camera, this.osmLoader, this.canvas);
        const a = this.camera.worldToScreen(start.x, start.y);
        const b = this.camera.worldToScreen(finish.x, finish.y);
        const worldSpan = Math.hypot(finish.x - start.x, finish.y - start.y) * from.zoom;
        const scale = Math.hypot(b.x - a.x, b.y - a.y) / worldSpan;
        if (!Number.isFinite(scale) || scale <= 0.05 || scale > 20) break;
        from = introOverview(start, finish, box, playZoom, scale);
      }
      this.camera.introOverview = previous.introOverview;
      this.camera.rotation = previous.rotation;
      return { plan: introPlan(from, this.camera.reducedMotion), playZoom };
    }
    /** Aim the map at the overview while the loading screen is still up, so
     *  the city-scale tiles load there instead of in the flight's first frame
     *  (a ~2 s hitch at 4× CPU throttle). True when the caller should wait for
     *  the map to settle before racing. */
    _prepareIntro() {
      const planned = this._planIntro();
      this._introPrepared = planned;
      if (!planned) return false;
      this.camera.resetPan();
      this.camera.rotation = 0;
      this.camera.introOverview = 1;
      this._applyIntroCamera(planned.plan.from.x, planned.plan.from.y, planned.plan.from.zoom);
      this.vectorMap.sync(this.camera, this.osmLoader, this.canvas);
      return true;
    }
    _applyIntroCamera(x, y, zoom) {
      this.camera.x = x;
      this.camera.y = y;
      this.camera.zoom = zoom;
    }
    /** Advance the flight. True while it still owns the frame. Any input skips
     *  it: the flight is orientation, never a gate in front of the controls. */
    _updateIntro(dt) {
      const intro = this._intro;
      const player = this.player;
      if (!intro || !player) return false;
      const to = { x: player.x, y: player.y, zoom: intro.playZoom };
      intro.elapsed += dt;
      const frame = this.input.anyInput ? { ...to, overview: 0, done: true } : introFrame(intro.plan, to, intro.elapsed);
      this._applyIntroCamera(frame.x, frame.y, frame.zoom);
      intro.overview = frame.overview;
      this.camera.introOverview = frame.overview;
      const cam = this.camera;
      const is3d = cam.viewMode === "chase" || cam.viewMode === "cockpit";
      const wanted = (cam.northUp || cam.holdHeading ? 0 : player.angle + Math.PI / 2) + (is3d ? cam.bearingOffset : 0);
      const delta = Math.atan2(Math.sin(wanted), Math.cos(wanted));
      cam.rotation = delta * (1 - frame.overview);
      if (frame.done) {
        cam.zoom = intro.playZoom;
        cam.introOverview = 0;
        this._intro = null;
        return false;
      }
      return true;
    }
    /** "You" and the way to the destination, while the overview is up. The
     *  destination pin itself is the renderer's; it is screen-sized, so it
     *  already reads at city scale. No street or canal names are drawn. */
    _renderIntroOverlay() {
      const intro = this._intro;
      const player = this.player;
      if (!intro || !player || intro.overview <= 0.02) return;
      const ctx = this.ctx;
      const surface = window.CanalRecallUi.hudSurface;
      const alpha = Math.min(1, intro.overview * 1.4);
      const here = this.camera.worldToScreen(player.x, player.y);
      const finish = this.camera.worldToScreen(this.track.finishPoint.x, this.track.finishPoint.y);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = surface.arrow;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 7]);
      ctx.beginPath();
      ctx.moveTo(here.x, here.y);
      ctx.lineTo(finish.x, finish.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const pulse = intro.elapsed % 1.2 / 1.2;
      ctx.strokeStyle = surface.arrow;
      ctx.lineWidth = 3;
      ctx.globalAlpha = alpha * (1 - pulse);
      ctx.beginPath();
      ctx.arc(here.x, here.y, 10 + pulse * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = surface.arrow;
      ctx.strokeStyle = "#fbf8f2";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(here.x, here.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const tag = "YOU";
      ctx.font = `800 12px ${surface.fontPlaque}`;
      const tagWidth = ctx.measureText(tag).width + 16;
      const tagRect = { x: Math.round(here.x - tagWidth / 2), y: Math.round(here.y - 38), width: tagWidth, height: 20 };
      this.hud.paperCard(ctx, tagRect, { solid: true, radius: 6 });
      ctx.fillStyle = surface.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tag, here.x, tagRect.y + 11);
      const layout = this._hudRects();
      const hintY = layout.dpad ? layout.dpad.cy : CANVAS_H - 28;
      const hint = layout.mode === "compact" ? "tap to start riding" : "press any key to start";
      ctx.font = `600 12px ${surface.fontUi}`;
      const hintWidth = ctx.measureText(hint).width + 24;
      this.hud.paperCard(ctx, { x: Math.round(CANVAS_W / 2 - hintWidth / 2), y: hintY - 12, width: hintWidth, height: 24 }, { radius: 9 });
      ctx.fillStyle = surface.inkMuted;
      ctx.fillText(hint, CANVAS_W / 2, hintY + 1);
      ctx.restore();
    }
    /** Canvas camera controls and card hit targets belong with the presentation layer. */
    _setupCameraGestures() {
      let dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0, pinchDistance = 0;
      let detachedBeforeDrag = false;
      const livePinch = /* @__PURE__ */ new Map();
      const syncZoom = () => {
        for (const id of ["camera-zoom", "live-zoom"]) {
          const input = document.getElementById(id);
          if (input) input.value = String(this.camera.zoom);
        }
      };
      const twistable = () => this.state !== GameState.MENU && (this.viewMode === "chase" || this.viewMode === "cockpit");
      let persistTwistTimer = 0;
      const twist = (clockwiseDeg) => {
        if (!clockwiseDeg) return;
        const cam = this.camera;
        const before = Number.isFinite(cam.bearingOffset) ? cam.bearingOffset * 180 / Math.PI : 0;
        const after = bearingAfterTwist(before, clockwiseDeg);
        cam.bearingOffset = after * Math.PI / 180;
        if (cam.detached) cam.rotation -= clockwiseDeg * Math.PI / 180;
        window.clearTimeout(persistTwistTimer);
        persistTwistTimer = window.setTimeout(() => this._nudgeCameraBearing?.(0), 300);
      };
      let lastCtrlWheel = -Infinity;
      this.canvas.addEventListener("wheel", (event) => {
        if (this.state === GameState.MENU) return;
        event.preventDefault();
        const twistDeg = wheelTwistDegrees(event);
        if (twistDeg !== null) {
          if (twistable()) twist(twistDeg);
          return;
        }
        if (event.ctrlKey) {
          lastCtrlWheel = performance.now();
          this.camera.zoom = Math.min(this.camera.maxZoom, Math.max(this.camera.minZoom, this.camera.zoom * Math.exp(-event.deltaY * 2e-3)));
          this._zoomTouchedByPlayer = true;
        } else this.camera.pan(event.deltaX, event.deltaY);
        syncZoom();
      }, { passive: false });
      let twistState = startTwist();
      let gestureScale = 1;
      this.canvas.addEventListener("gesturestart", (event) => {
        event.preventDefault();
        twistState = startTwist();
        gestureScale = 1;
      });
      this.canvas.addEventListener("gesturechange", (event) => {
        event.preventDefault();
        const gesture = event;
        if (twistable()) twist(twistStep(twistState, gesture.rotation));
        const scale = Number.isFinite(gesture.scale) && gesture.scale > 0 ? gesture.scale : 1;
        const wheelZooming = performance.now() - lastCtrlWheel < WHEEL_PINCH_GRACE_MS;
        if (this.state !== GameState.MENU && livePinch.size < 2 && !wheelZooming && scale !== gestureScale) {
          this.camera.zoom = Math.min(this.camera.maxZoom, Math.max(this.camera.minZoom, this.camera.zoom * scale / gestureScale));
          this._zoomTouchedByPlayer = true;
          syncZoom();
        }
        gestureScale = scale;
      });
      this.canvas.addEventListener("gestureend", (event) => {
        event.preventDefault();
      });
      this.canvas.addEventListener("touchstart", (event) => {
        for (const touch of event.changedTouches) {
          const point = this._eventPoint(touch);
          if (!window.CanalRecallUi.isInsideDpad(point, this.input.dpad)) livePinch.set(touch.identifier, point);
        }
        const points = [...livePinch.values()];
        if (points.length === 2) {
          pinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          if (dragging) {
            dragging = false;
            if (!detachedBeforeDrag) this.camera.resetPan();
          }
        }
      }, { passive: true });
      this.canvas.addEventListener("touchmove", (event) => {
        let changed = false;
        for (const touch of event.changedTouches) if (livePinch.has(touch.identifier)) {
          livePinch.set(touch.identifier, this._eventPoint(touch));
          changed = true;
        }
        const points = [...livePinch.values()];
        if (!changed || points.length !== 2) return;
        event.preventDefault();
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (pinchDistance > 0 && distance > 0) {
          this.camera.zoom = Math.min(this.camera.maxZoom, Math.max(this.camera.minZoom, this.camera.zoom * distance / pinchDistance));
          this._zoomTouchedByPlayer = true;
          syncZoom();
        }
        pinchDistance = distance;
      }, { passive: false });
      const endPinch = (event) => {
        for (const touch of event.changedTouches) livePinch.delete(touch.identifier);
        if (livePinch.size < 2) pinchDistance = 0;
      };
      this.canvas.addEventListener("touchend", endPinch, { passive: true });
      this.canvas.addEventListener("touchcancel", endPinch, { passive: true });
      const revealUtility = () => {
        this._utilityRevealUntil = performance.now() + UTILITY_REVEAL_MS;
      };
      this.canvas.addEventListener("pointerdown", (event) => {
        if (!window.CanalRecallUi.isInsideDpad(this._eventPoint(event), this.input.dpad)) revealUtility();
      });
      let lastMouse = { x: 0, y: 0 };
      this.canvas.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "mouse") return;
        if (Math.hypot(event.clientX - lastMouse.x, event.clientY - lastMouse.y) > 12) revealUtility();
        lastMouse = { x: event.clientX, y: event.clientY };
      });
      this.canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || this.state === GameState.MENU || livePinch.size >= 2 || window.CanalRecallUi.isInsideDpad(this._eventPoint(event), this.input.dpad)) return;
        if (this._debugMode && this._debugLinkBounds) {
          const point = this._eventPoint(event);
          if (this._debugLinkBounds.some((b) => point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h)) return;
        }
        dragging = true;
        moved = false;
        detachedBeforeDrag = !!this.camera.detached;
        downX = lastX = event.clientX;
        downY = lastY = event.clientY;
        this.canvas.setPointerCapture(event.pointerId);
      });
      this.canvas.addEventListener("pointermove", (event) => {
        if (!dragging || livePinch.size >= 2) return;
        if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) moved = true;
        if (!moved) return;
        this.camera.pan(lastX - event.clientX, lastY - event.clientY);
        lastX = event.clientX;
        lastY = event.clientY;
      });
      this.canvas.addEventListener("pointerup", (event) => {
        if (dragging && !moved) {
          const { x, y } = this._eventPoint(event);
          const hit = (bounds) => x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
          const finish = this.state === GameState.FINISHED && this._finishButtonBounds?.find(hit);
          const pause = this.state === GameState.PAUSED && this._pauseButtonBounds?.find(hit);
          if (finish) this._runFinishAction(finish.id);
          else if (pause && this._runPauseAction) this._runPauseAction(pause.id);
          else if (this._recenterBtnBounds && hit(this._recenterBtnBounds)) this.camera.resetPan();
          else if (this._landmarkCloseBounds && hit(this._landmarkCloseBounds)) this._clearLandmarkNotice();
          else if (this._landmarkCardBounds && hit(this._landmarkCardBounds)) this._expandLandmarkNotice();
          else this._inspectBuildingAt(event.clientX, event.clientY);
        }
        dragging = false;
      });
    }
    /** True while a DOM overlay owns the screen — quiz, utility, or article. */
    _overlayOpen() {
      if (this._utilityOpen) return true;
      if (this._prompt && this._prompt.style.display !== "none" && this._prompt.style.display !== "") {
        return true;
      }
      const panel = document.getElementById("landmark-panel");
      return !!panel && getComputedStyle(panel).display !== "none";
    }
    /** One teaching surface at a time — see `teachingSurface.ts`. */
    _teachingGate() {
      const promptVisible = !!(this._prompt && this._prompt.style.display !== "none" && this._prompt.style.display !== "");
      const panel = document.getElementById("landmark-panel");
      const landmarkPanelOpen = !!panel && getComputedStyle(panel).display !== "none";
      return {
        quizOpen: !!this.quizPromptName,
        feedbackVisible: !!this.quizFeedback,
        promptVisible,
        utilityOpen: !!this._utilityOpen || landmarkPanelOpen
      };
    }
    /** Active city catalog entry (extract path, centre, geocode bounds). */
    _activeCity() {
      const Prefs = window.CanalRecallPreferences;
      const id = this.cityId || Prefs && Prefs.DEFAULT_CITY_ID || "amsterdam";
      return Prefs && Prefs.cityById ? Prefs.cityById(id) : {
        id,
        name: id,
        extractPath: `../data/extracts/${id}`,
        center: { lat: 52.372851, lng: 4.8936 },
        geocodeSuffix: `, ${id}`,
        geocodeViewbox: [4.72, 52.43, 5.02, 52.27],
        provinceCaption: "",
        curatedPois: []
      };
    }
    _curatedRoutePois() {
      const curated = this._activeCity().curatedPois || [];
      return curated.map((poi) => ({ ...poi }));
    }
    _cityDisplayName() {
      return this._activeCity().name || "Amsterdam";
    }
    /** The destination as the ride may show it: with any street or water name
     *  from this track hidden, so "Keizersgrachtkerk" cannot answer the
     *  Keizersgracht question. The arrival card still shows the real name. */
    _destinationLabel() {
      if (isReviewStop(this.routeTo) && !this.routeTo.name) return REVIEW_STOP_LABEL;
      const name = this.routeTo?.name || "";
      const asking = this.quizPromptName || "";
      const key = `${name}|${asking}`;
      if (this._destinationLabelKey !== key) {
        this._destinationLabelKey = key;
        this._destinationLabelText = asking ? maskSpoiledName(name, [asking]) : name;
      }
      return this._destinationLabelText || name;
    }
    /** Re-layout when the window no longer matches the last layout. Phones can
     *  settle their width after load (980 → 390 in iPhone emulation) without a
     *  resize event reaching the game, which left the whole HUD drawn at ~47%
     *  scale with 5 px text (UI review 2026-09-26). One comparison per frame. */
    _syncViewportSize() {
      const key = `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio || 1}`;
      if (key === this._viewportKey) return;
      this._viewportKey = key;
      if (typeof this._resize === "function") this._resize();
    }
    // ---- The frame ----
    _render() {
      this._syncViewportSize();
      const ctx = this.ctx;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      const utility = document.getElementById("utility-buttons");
      if (utility) {
        utility.style.display = this.state === GameState.FINISHED || this.state === GameState.LOADING ? "none" : "";
        const riding = this.state === GameState.RACING && !this._utilityOpen;
        const revealed = !riding || performance.now() < (this._utilityRevealUntil || 0);
        utility.classList.toggle("tucked", !revealed);
      }
      if (this.state === GameState.MENU) {
        this._renderMenu();
        return;
      }
      if (this.state === GameState.MAP_SELECT) {
        ctx.fillStyle = "#f4efe5";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        return;
      }
      if (this.state === GameState.LOADING) {
        this.loadingScreen.draw(ctx, this.loadingMessage, this.loadingProgress);
        return;
      }
      if (!this.player) return;
      const player = this.player;
      this.hud.setTime(this.raceTime);
      if (this._intro) this._lastZoomShown = this.camera.zoom;
      if (this._lastZoomShown !== this.camera.zoom) {
        this._lastZoomShown = this.camera.zoom;
        this._zoomBadgeTimer = ZOOM_BADGE_DURATION;
      }
      this.vectorMap.sync(this.camera, this.osmLoader, this.canvas);
      const pitched = this.viewMode === "chase" || this.viewMode === "cockpit";
      const byBoat = isBoat(this.travelMode);
      const byTransit = isTransit(this.travelMode);
      const showBike = !byBoat && !byTransit;
      this.vectorMap.setPlayerBike(
        player,
        this.osmLoader,
        pitched && showBike,
        vehicleZoomScale(this.camera.zoom, this._defaultZoom ?? this.camera.zoom)
      );
      this.vectorMap.setPlayerBoat(player, this.osmLoader, pitched && byBoat);
      if (typeof this.vectorMap.setPlayerTransit === "function") {
        let underground = false;
        if (byTransit && this.track && typeof this.track.getNearestRoad === "function") {
          const contact = this.track.getNearestRoad(player.x, player.y, player.angle);
          const seg = contact && this.track.segments ? this.track.segments[contact.segIdx] : null;
          underground = !!(seg && seg.type === "metro");
        }
        this.vectorMap.setPlayerTransit(player, this.osmLoader, pitched && byTransit, underground);
      }
      this.vectorMap.setRoute(this._liveRoutePath || this.routePath, this.osmLoader, this.routeOptions.line);
      const reveal = this.quizPromptName ? null : this._answerReveal;
      const litName = this.quizPromptName || reveal?.name || "";
      const litSegment = this.quizPromptName ? this.quizPromptSegmentIndex : reveal?.segmentIndex ?? -1;
      const litPoint = this.quizPromptName ? this.quizPromptPointIndex : reveal?.pointIndex ?? 0;
      if (!byBoat) {
        this.vectorMap.setStreetHighlights(
          this.track,
          this.osmLoader,
          this.learnedNames,
          litName,
          litSegment,
          this.routeOptions.line ? this._liveRoutePath || this.routePath : null
        );
        const stamp = this._answerStamp && this.raceTime < this._answerStamp.until ? this._answerStamp : null;
        this.vectorMap.setAnsweredStreetName?.(this.track, this.osmLoader, stamp, player);
      }
      this.renderer.drawTrack(this.camera, this.track);
      if (byBoat) {
        this.renderer.drawQuestionFeature(
          this.camera,
          this.track,
          litName,
          litSegment,
          litPoint,
          this.raceTime
        );
      }
      this.renderer.drawSkidMarks(this.particles, this.camera);
      this._renderBridgeLabels();
      const meshReady = pitched && (byBoat ? this.vectorMap.isPlayerBoatReady() : byTransit ? typeof this.vectorMap.isPlayerTransitReady === "function" && this.vectorMap.isPlayerTransitReady() : this.vectorMap.isPlayerBikeReady());
      if (!meshReady) {
        if (byBoat) this.renderer.drawCar(player, this.camera);
        else this.renderer.drawPlayerCar(player, this.camera);
      }
      this.renderer.drawParticles(this.particles, this.camera);
      this.track.drawLabels(
        ctx,
        this.camera,
        (text, x, y) => this._mapLabelNames.has(text) || this._isPlaceKnown(text, x, y),
        this.quizPromptName || this.quizCandidateName,
        player
      );
      if (this.state === GameState.FINISHED) {
        this._renderFinish();
        return;
      }
      this._syncHudLayout();
      const teaching = this._teachingGate();
      const showMiniMap = canShowMiniMap(this.showMiniMap, teaching);
      const roadName = this.track.getRoadName(player.x, player.y, player.angle);
      let visibleRouteName = "";
      let routeAnswerHidden = false;
      if (isTransit(this.travelMode) && window.CanalRecallTransit?.transitPlaqueRouteName) {
        const plaque = window.CanalRecallTransit.transitPlaqueRouteName({
          activeLine: this._activeTransitLine || "",
          roadName: roadName || "",
          quizPromptName: this.quizPromptName || "",
          quizPromptSubject: this.quizPromptSubject || "",
          quizCandidateName: this.quizCandidateName || "",
          quizCurrentName: this.quizCurrentName || "",
          transitLegIndex: this._transitLegIndex || 0
        });
        visibleRouteName = plaque.routeName;
        routeAnswerHidden = plaque.answerHidden;
      } else {
        routeAnswerHidden = hudWithholdsRouteName({
          roadName: roadName || "",
          currentName: this.quizCurrentName || "",
          promptName: this.quizPromptName || "",
          candidateName: this.quizCandidateName || "",
          revealed: !!roadName && this.revealedNames.has(roadName),
          learned: !!roadName && this.learnedNames.has(roadName)
        });
        visibleRouteName = routeAnswerHidden ? "" : roadName || "";
      }
      const { feedback, restrictionNote } = this._plaqueNotes();
      const finishAngle = this.routeOptions.arrow ? this.hud.finishDirection(
        player.x,
        player.y,
        this.track.finishPoint.x,
        this.track.finishPoint.y,
        this.camera
      ) : null;
      const destinationLabel = this._destinationLabel();
      const distanceToFinish = this.track.getDistanceToFinish(player.x, player.y);
      const merged = this._hudRects().destinationInRecall;
      this.hud.drawPlaque(ctx, {
        routeName: visibleRouteName,
        neighborhood: this.currentNeighborhood,
        answerHidden: routeAnswerHidden,
        correct: this.quizCorrect,
        attempts: this.quizAttempts,
        points: this.quizPoints,
        streak: this.quizStreak,
        gamey: this.gameyFeatures,
        trip: this.hud.tripText(player.speed, this._playerDistancePx()),
        feedback,
        restrictionNote,
        destination: merged ? {
          // "to your destination" says nothing; only a real name earns room.
          name: destinationLabel && destinationLabel !== "your destination" ? destinationLabel : "",
          distancePx: distanceToFinish,
          arrowAngle: finishAngle
        } : null
      });
      if (!merged) {
        this.hud.drawDestination(
          ctx,
          destinationLabel,
          distanceToFinish,
          this._routeLearningPlan?.expectedNovelty ?? null,
          finishAngle
        );
      }
      this.hud.drawCompass(ctx, this.camera);
      if (showMiniMap) this.hud.drawCityOverview(ctx, this);
      this.vectorMap.setQuizQuietMap(!canShowPoiLabels(true, teaching));
      this._renderLandmarkNotice();
      this._renderNeighborhoodNotice();
      this._renderZoomBadge();
      this._renderRecenterButton();
      if (this._debugMode) this._renderDebug();
      this._renderControlsHint();
      this._renderIntroOverlay();
      if (this.state === GameState.RACING && !this._overlayOpen() && !this._intro) {
        this.hud.drawStick(ctx, this.input.stickView);
        if (this.input.showTouchHint) this.hud.drawTouchHint(ctx, this.controlMode);
      }
      if (this.state === GameState.PAUSED) this._renderPaused();
      if (this.state === GameState.FINISHED) this._renderFinish();
    }
    /** The plaque's optional lines: quiz feedback (or the home-ring note) and a
     *  real-world cycling ban on this corridor — which never names the street,
     *  since the headline may still be hidden under a quiz. */
    _plaqueNotes() {
      let restrictionNote = "";
      const player = this.player;
      if (isCar(this.travelMode) && player) {
        const road = this.track.getNearestRoad(player.x, player.y, player.angle);
        const segment = road && this.track.segments?.[road.segIdx];
        if (segment?.bicycleRestricted) {
          restrictionNote = bicycleRestrictionNotice({
            bicycleRestricted: "yes",
            bicycle: segment.bicycle || "no"
          }) || "No cycling in real life";
        }
      }
      const homeLearningNote = this.routePattern === "home" && Number.isFinite(this._homeLearningRadiusKm) && this._homeLearningRadiusKm > 0 ? `Learning near home \xB7 ~${this._homeLearningRadiusKm.toFixed(1)} km` : "";
      return { feedback: this.quizFeedback || homeLearningNote, restrictionNote };
    }
    /** Place the whole HUD for this frame. One call, so every card agrees about
     *  where the others are and the phone layout stays collision-free. */
    _syncHudLayout() {
      const ui = window.CanalRecallUi;
      const teaching = this._teachingGate();
      const minimapVisible = canShowMiniMap(this.showMiniMap, teaching);
      this._hudLayoutCache = ui.hudLayout({
        viewport: this.viewport,
        tripWidth: 180,
        landmarkHeight: 130,
        feedbackVisible: !!this.quizFeedback,
        plaqueExtraLines: (() => {
          const notes = this._plaqueNotes();
          return (notes.feedback ? 1 : 0) + (notes.restrictionNote ? 1 : 0);
        })(),
        neighborhoodVisible: !!this.currentNeighborhood,
        minimapVisible,
        zoomVisible: this._zoomBadgeTimer > 0,
        controlsVisible: !this.input.isMobile && this.raceTime < CONTROLS_HINT_DURATION
      });
      this.hud.setLayout(this._hudLayoutCache);
    }
    /** The frame's layout, computing it if a caller runs before _syncHudLayout. */
    _hudRects() {
      if (!this._hudLayoutCache) this._syncHudLayout();
      return this._hudLayoutCache;
    }
    /** The player's odometer, in world px. Not on the shared vehicle type
     *  because only the presentation layer reads it. */
    _playerDistancePx() {
      return this.player?.distancePx ?? 0;
    }
    /** Shown briefly after a change rather than permanently: a standing "35%"
     *  reads as a mystery statistic. */
    _renderZoomBadge() {
      if (this._zoomBadgeTimer <= 0) return;
      const ctx = this.ctx;
      const rect = this._hudRects().zoomBadge;
      const surface = window.CanalRecallUi.hudSurface;
      this.hud.paperCard(ctx, rect, { radius: 9 });
      ctx.fillStyle = surface.inkMuted;
      ctx.font = `700 12px ${surface.fontMono}`;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(this.camera.zoom * 100)}%`, rect.x + rect.width / 2, rect.y + 15);
    }
    _renderRecenterButton() {
      if (Math.hypot(this.camera.panX, this.camera.panY) <= 40) {
        this._recenterBtnBounds = null;
        return;
      }
      const ctx = this.ctx;
      const layout = this._hudRects();
      const compact = layout.mode === "compact";
      const width = compact ? 132 : 110, height = compact ? 44 : 28;
      const x = Math.round(CANVAS_W / 2 - width / 2);
      const y = Math.round(compact ? layout.destination.y + layout.destination.height + 10 : 70);
      const surface = window.CanalRecallUi.hudSurface;
      this.hud.paperCard(ctx, { x, y, width, height }, { solid: true, radius: compact ? 14 : 8 });
      ctx.fillStyle = surface.accent;
      ctx.font = `700 12px ${surface.fontPlaque}`;
      ctx.textAlign = "center";
      ctx.fillText(compact ? "RE-CENTER" : "RE-CENTER (R)", CANVAS_W / 2, y + height / 2 + 4);
      this._recenterBtnBounds = { x, y, w: width, h: height };
    }
    /** Only while the player is settling in. It used to sit permanently on top
     *  of the recall panel. */
    _renderControlsHint() {
      if (this.input.isMobile || this.raceTime >= CONTROLS_HINT_DURATION || this._intro) return;
      const ctx = this.ctx;
      const rect = this._hudRects().controlsHint;
      const surface = window.CanalRecallUi.hudSurface;
      const text = "?  help   \xB7   G  settings   \xB7   M  map   \xB7   O  north   \xB7   D  labels   \xB7   B  buildings   \xB7   P  pause";
      ctx.save();
      ctx.globalAlpha = Math.min(1, CONTROLS_HINT_DURATION - this.raceTime);
      ctx.font = `600 11px ${surface.fontMono}`;
      const width = Math.min(ctx.measureText(text).width + 24, CANVAS_W - 16);
      const plate = { x: Math.round(rect.x + rect.width / 2 - width / 2), y: rect.y - 6, width, height: 22 };
      this.hud.paperCard(ctx, plate, { radius: 9 });
      ctx.fillStyle = surface.inkMuted;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const ink = ctx.measureText(text);
      const ascent = ink.actualBoundingBoxAscent || 8;
      const descent = ink.actualBoundingBoxDescent || 2;
      ctx.fillText(text, plate.x + plate.width / 2, plate.y + plate.height / 2 + (ascent - descent) / 2);
      ctx.restore();
    }
    // ---- Menu ----
    _renderMenu() {
      const ctx = this.ctx;
      const setup = document.getElementById("route-setup");
      const setupOpen = !!setup && setup.style.display !== "none";
      if (setupOpen) {
        ctx.fillStyle = "#f4efe5";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        return;
      }
      const cx = CANVAS_W / 2;
      ctx.fillStyle = "#071430";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const t = Date.now() / 1e3;
      ctx.strokeStyle = "rgba(33,150,243,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_W; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_H);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_W, y);
        ctx.stroke();
      }
      const flash = Math.floor(t * 3) % 2;
      for (let i = 0; i < 6; i++) {
        const px = (i * 220 + t * 40) % (CANVAS_W + 200) - 100;
        const py = 180 + Math.sin(i * 1.7 + t * 0.5) * 120;
        ctx.beginPath();
        ctx.arc(px, py + 200, 50, 0, Math.PI * 2);
        ctx.fillStyle = (i + flash) % 2 === 0 ? "rgba(33,100,243,0.08)" : "rgba(244,67,54,0.06)";
        ctx.fill();
      }
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, "rgba(7,20,48,0.9)");
      grad.addColorStop(0.4, "rgba(7,20,48,0.7)");
      grad.addColorStop(0.7, "rgba(7,20,48,0.8)");
      grad.addColorStop(1, "rgba(7,20,48,0.95)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = 'bold 48px "Barlow Condensed", sans-serif';
      ctx.fillStyle = "#ffffff";
      ctx.fillText("AMSTERDAM CANAL RECALL", cx, 70);
      ctx.restore();
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "14px system-ui, sans-serif";
      const tagline = isTransit(this.travelMode) ? "Ride real tram corridors and name the lines and stops" : isCar(this.travelMode) ? "Navigate the real street network and name each street after you turn" : "Navigate the real canal network and name each waterway after you turn";
      ctx.fillText(tagline, cx, 100);
      ctx.fillStyle = "rgba(11,58,140,0.88)";
      roundRect(ctx, cx - 320, 120, 640, 160, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      roundRect(ctx, cx - 320, 120, 640, 160, 10);
      ctx.stroke();
      ctx.textAlign = "left";
      const rulesX = cx - 290;
      ctx.fillStyle = "#c4a35a";
      ctx.font = 'bold 13px "Barlow Condensed", sans-serif';
      ctx.fillText("HOW TO PLAY", rulesX, 145);
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "12px system-ui, sans-serif";
      const rules = isTransit(this.travelMode) ? [
        "1. Use WASD or the arrow keys to ride the tram corridor",
        "2. Stay on the mapped line \u2014 the guard keeps you on the shape",
        "3. Name the line while moving, and stops as you approach them",
        "4. Line colour and labels stay hidden until you answer",
        "5. TAB toggles the overview map; -/+ changes zoom",
        "6. Transit: tram + metro; change lines at hubs"
      ] : isCar(this.travelMode) ? [
        "1. Use WASD or the arrow keys to steer the bike",
        "2. Stay on mapped streets; the road guard keeps you on the network",
        "3. After entering a differently named street, type its name",
        "4. Map labels are hidden: navigate from the shape of the city",
        "5. TAB toggles the overview map; -/+ changes zoom",
        "6. This is an early prototype \u2014 feedback is the point"
      ] : [
        "1. Use WASD or the arrow keys to steer the boat",
        "2. The boat slows dramatically when it leaves mapped water",
        "3. After entering a differently named waterway, type its name",
        "4. Map labels are hidden: navigate from the shape of the city",
        "5. TAB toggles the overview map; -/+ changes zoom",
        "6. This is an early prototype \u2014 feedback is the point"
      ];
      rules.forEach((line, index) => ctx.fillText(line, rulesX, 165 + index * 18));
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.input.isMobile ? "Left side: Steer    Right side: Gas/Brake    Double-tap: Drift" : "Arrow Keys / WASD - Drive    SPACE - Drift    TAB - Map    -/+ Zoom", cx, 298);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = 'bold 22px "Barlow Condensed", sans-serif';
      ctx.fillText(this.input.isMobile ? "TAP TO START" : "PRESS ENTER TO START", cx, CANVAS_H / 2 + 55);
      if (!this._menuQuote) {
        this._menuQuote = BANDIT_QUOTES[Math.floor(Math.random() * BANDIT_QUOTES.length)];
      }
      ctx.fillStyle = "rgba(196,163,90,0.75)";
      ctx.font = "italic 13px system-ui, sans-serif";
      ctx.fillText(`"${this._menuQuote.text}"`, cx, CANVAS_H / 2 + 90);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(`\u2014 ${this._menuQuote.character}`, cx, CANVAS_H / 2 + 107);
      this._renderExplorationBadge(cx);
      this._renderMenuChase(t);
      this._renderMenuFooter(cx);
    }
    /** For a returning player: what they have collected so far. This used to be
     *  wrapped in a `try/catch` around an undefined `cx`, so it silently never
     *  drew at all. */
    _renderExplorationBadge(cx) {
      const exploration = this._loadExploration();
      if (exploration.totalRoutes <= 0) return;
      const ctx = this.ctx;
      const known = exploration.learnedWaterways.length + exploration.learnedStreets.length + exploration.learnedTransitLines.length + exploration.learnedTransitStops.length;
      const parts = [];
      if (known > 0) parts.push(`${known} names`);
      if (exploration.visitedNeighborhoods.length > 0) parts.push(`${exploration.visitedNeighborhoods.length} hoods`);
      if (exploration.seenLandmarks.length > 0) parts.push(`${exploration.seenLandmarks.length} landmarks`);
      ctx.fillStyle = "rgba(11,58,140,.55)";
      roundRect(ctx, cx - 200, CANVAS_H / 2 + 120, 400, 28, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
      ctx.textAlign = "center";
      ctx.fillText(
        `${this._cityDisplayName()}: ${parts.join(" \xB7 ")} \xB7 ${exploration.totalRoutes} routes`,
        cx,
        CANVAS_H / 2 + 138
      );
    }
    _renderMenuChase(t) {
      const ctx = this.ctx;
      const chaseY = CANVAS_H - 130;
      ctx.fillStyle = "rgba(60,60,60,0.5)";
      ctx.fillRect(0, chaseY - 15, CANVAS_W, 30);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      ctx.moveTo(0, chaseY);
      ctx.lineTo(CANVAS_W, chaseY);
      ctx.stroke();
      ctx.setLineDash([]);
      const carX = t * 80 % (CANVAS_W + 300) - 100;
      ctx.save();
      ctx.translate(carX, chaseY);
      ctx.fillStyle = "#FFD700";
      roundRect(ctx, -15, -8, 30, 16, 3);
      ctx.fill();
      ctx.restore();
      const copFlash = Math.floor(t * 8) % 2;
      ctx.save();
      ctx.translate(carX - 120, chaseY);
      ctx.fillStyle = "#1A1A2E";
      roundRect(ctx, -15, -8, 30, 16, 3);
      ctx.fill();
      ctx.fillStyle = copFlash === 0 ? "#2196F3" : "#F44336";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      const radarPulse = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.beginPath();
      ctx.arc(0, 0, 25 + radarPulse * 10, 0, Math.PI * 2);
      ctx.strokeStyle = copFlash === 0 ? "rgba(33,150,243,0.3)" : "rgba(244,67,54,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(carX - 260, chaseY);
      ctx.fillStyle = "#1A1A2E";
      roundRect(ctx, -15, -8, 30, 16, 3);
      ctx.fill();
      ctx.fillStyle = copFlash === 1 ? "#2196F3" : "#F44336";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
      ctx.textAlign = "center";
      ["RICHMOND", "CHICAGO", "NEW YORK", "LONDON", "PARIS"].forEach((name, index) => ctx.fillText(name, 130 + index * 230, CANVAS_H - 50));
    }
    _renderMenuFooter(cx) {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
      ctx.textAlign = "center";
      const creditText = "Vibe coded by Alan and Claude \u2014 ";
      const linkText = "alan.is";
      const creditWidth = ctx.measureText(creditText).width;
      const linkWidth = ctx.measureText(linkText).width;
      const startX = cx - (creditWidth + linkWidth) / 2;
      ctx.textAlign = "left";
      ctx.fillText(creditText, startX, CANVAS_H - 15);
      ctx.fillStyle = "rgba(100,180,255,0.6)";
      ctx.fillText(linkText, startX + creditWidth, CANVAS_H - 15);
      ctx.fillRect(startX + creditWidth, CANVAS_H - 13, linkWidth, 1);
      this._alanLinkBounds = { x: startX + creditWidth, y: CANVAS_H - 26, w: linkWidth, h: 16 };
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
      ctx.textAlign = "right";
      ctx.fillText(`v${GAME_VERSION}`, CANVAS_W - 10, 15);
      const ghText = "GitHub";
      ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
      const ghWidth = ctx.measureText(ghText).width;
      const ghX = cx - ghWidth / 2;
      ctx.fillStyle = "rgba(100,180,255,0.6)";
      ctx.textAlign = "left";
      ctx.fillText(ghText, ghX, CANVAS_H - 2);
      ctx.fillRect(ghX, CANVAS_H, ghWidth, 1);
      this._githubLinkBounds = { x: ghX, y: CANVAS_H - 13, w: ghWidth, h: 16 };
    }
    // ---- Pause ----
    _renderPaused() {
      const ctx = this.ctx;
      const cx = CANVAS_W / 2;
      const compact = this.viewport.mode === "compact";
      const cardW = Math.min(400, CANVAS_W - 24);
      const padX = compact ? 18 : 28;
      const cardX = cx - cardW / 2;
      ctx.fillStyle = "rgba(28,24,18,0.34)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const actions = [
        { id: "resume", key: "P / ESC", caption: "Resume" },
        { id: "route", key: "M", caption: "Route setup" }
      ];
      if (this._shareUrl) {
        actions.push({
          id: "copy",
          key: "C",
          caption: this._copiedTimer > 0 ? "Link copied" : "Share this route"
        });
      }
      const BUTTON_H = 44;
      const BUTTON_GAP = 8;
      const titleH = compact ? 56 : 64;
      const statsH = 28;
      const actionsH = compact ? actions.length * BUTTON_H + (actions.length - 1) * BUTTON_GAP : 28;
      const cardH = 20 + titleH + actionsH + statsH + 18;
      const cardY = (CANVAS_H - cardH) / 2;
      this.hud.paperCard(ctx, { x: cardX, y: cardY, width: cardW, height: cardH }, { solid: true, radius: 12 });
      ctx.fillStyle = INK;
      ctx.font = `800 ${compact ? 30 : 36}px ${window.CanalRecallUi.hudSurface.fontPlaque}`;
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", cx, cardY + (compact ? 40 : 46));
      const pauseButtons = [];
      this._pauseButtonBounds = pauseButtons;
      let y = cardY + titleH;
      if (compact) {
        for (const action of actions) {
          const primary = action.id === "resume";
          const bounds = { x: cardX + padX, y, w: cardW - padX * 2, h: BUTTON_H };
          ctx.fillStyle = primary ? COPPER : "rgba(31,28,23,.05)";
          roundRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, 12);
          ctx.fill();
          if (!primary) {
            ctx.strokeStyle = RULE;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.fillStyle = primary ? "#1f1c17" : action.caption === "Link copied" ? GOOD : INK;
          ctx.font = "700 14px system-ui, sans-serif";
          ctx.fillText(action.caption, bounds.x + bounds.w / 2, y + 28);
          pauseButtons.push({ ...bounds, id: action.id });
          y += BUTTON_H + BUTTON_GAP;
        }
      } else {
        ctx.textAlign = "left";
        let ax = cardX + padX;
        for (const action of actions) {
          ctx.font = `700 11px ${window.CanalRecallUi.hudSurface.fontMono}`;
          const keyW = ctx.measureText(action.key).width + 14;
          ctx.fillStyle = "rgba(31,28,23,.08)";
          roundRect(ctx, ax, y + 2, keyW, 20, 5);
          ctx.fill();
          ctx.fillStyle = INK;
          ctx.fillText(action.key, ax + 7, y + 16);
          const captionX = ax + keyW + 8;
          ctx.font = "12px system-ui, sans-serif";
          ctx.fillStyle = action.caption === "Link copied" ? GOOD : MUTED;
          ctx.fillText(action.caption, captionX, y + 16);
          const captionW = ctx.measureText(action.caption).width;
          pauseButtons.push({
            x: ax,
            y: y - 4,
            w: keyW + 8 + captionW + 8,
            h: 28,
            id: action.id
          });
          ax = captionX + captionW + 22;
        }
        y += 28;
      }
      ctx.textAlign = "center";
      ctx.font = `500 12px ${window.CanalRecallUi.hudSurface.fontUi}`;
      ctx.fillStyle = MUTED;
      const kilometres = this._playerDistancePx() / PIXELS_PER_METER / 1e3;
      ctx.fillText(
        `${this.hud.formatTime(this.raceTime)}  \xB7  ${kilometres.toFixed(2)} km  \xB7  ${this.quizCorrect} of ${this.quizAttempts} named`,
        cx,
        y + 18
      );
    }
    // ---- The arrival card ----
    /**
     * One surface, one type system, and a running list of blocks that report
     * their own height, so the card measures itself instead of keeping a stack
     * of hand-tuned offsets in step with the layout below.
     *
     * Time is a stat here, not the headline: the game does not reward speed, and
     * a 38 px stopwatch said it did.
     */
    _renderFinish() {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(28,24,18,.34)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const cx = CANVAS_W / 2;
      const compact = this.viewport.mode === "compact";
      const cardW = Math.min(600, CANVAS_W - 24);
      const padX = compact ? 18 : 30;
      const cardX = cx - cardW / 2;
      const innerW = cardW - padX * 2;
      const gamey = this.gameyFeatures;
      const exploration = this._explorationSnapshot && this._explorationSnapshot.totalRoutes > 0 ? this._explorationSnapshot : null;
      const ribbon = gamey ? this._ribbon : null;
      const landmark = this._finishLandmark();
      const image = landmark ? this._landmarkImages?.get(landmark.id) : void 0;
      const hasImage = !!image && image.complete && image.naturalWidth > 0;
      const rule = (y2) => {
        ctx.strokeStyle = RULE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cardX + padX, y2 + 0.5);
        ctx.lineTo(cardX + cardW - padX, y2 + 0.5);
        ctx.stroke();
      };
      let bestText = "";
      if (this._raceKey) {
        const stored = getBestTime(localStorage, this._raceKey);
        if (stored && this.raceTime <= stored.time) bestText = "\u2605  New personal best";
        else if (stored) bestText = `Personal best  ${this.hud.formatTime(stored.time)}`;
      }
      const buildBlocks = (level2) => {
        const blocks2 = [];
        blocks2.push({ height: 74, draw: (top) => {
          ctx.textAlign = "left";
          ctx.fillStyle = ACCENT;
          ctx.font = `700 11px ${window.CanalRecallUi.hudSurface.fontMono}`;
          ctx.fillText("ARRIVED", cardX + padX, top + 11);
          ctx.fillStyle = INK;
          ctx.font = "800 26px system-ui, sans-serif";
          ctx.fillText(wrapText(ctx, this.routeTo.name, innerW, 1)[0], cardX + padX, top + 42);
          ctx.fillStyle = MUTED;
          ctx.font = "13px system-ui, sans-serif";
          ctx.fillText(`${this.routeFrom.name}  \u2192  ${this.routeTo.name}`, cardX + padX, top + 64);
        } });
        if (landmark && level2 < 3) {
          const photo = hasImage ? level2 >= 2 ? 64 : 88 : 0;
          const textX = cardX + padX + (hasImage ? photo + 16 : 0);
          const textW = cardX + cardW - padX - textX;
          ctx.font = "12px system-ui, sans-serif";
          const blurb = wrapText(
            ctx,
            landmark.longDetail || landmark.detail || `A place to remember on your ${this._cityDisplayName()} map.`,
            textW,
            [hasImage ? 4 : 3, 3, 2][level2]
          );
          const height = Math.max(photo, 20 + blurb.length * 17) + 14;
          blocks2.push({ height, draw: (top) => {
            if (hasImage && image) {
              ctx.save();
              ctx.beginPath();
              roundRect(ctx, cardX + padX, top, photo, photo, 8);
              ctx.clip();
              const side = Math.min(image.naturalWidth, image.naturalHeight);
              ctx.drawImage(
                image,
                (image.naturalWidth - side) / 2,
                (image.naturalHeight - side) / 2,
                side,
                side,
                cardX + padX,
                top,
                photo,
                photo
              );
              ctx.restore();
            }
            ctx.textAlign = "left";
            ctx.fillStyle = MUTED;
            ctx.font = `700 11px ${window.CanalRecallUi.hudSurface.fontMono}`;
            const kind = String(landmark.type || "landmark").toUpperCase();
            ctx.fillText(landmark.wikipediaUrl ? `${kind}  \xB7  W  WIKIPEDIA` : kind, textX, top + 10);
            ctx.fillStyle = BODY;
            ctx.font = "12px system-ui, sans-serif";
            blurb.forEach((line, index) => ctx.fillText(line, textX, top + 30 + index * 17));
          } });
        }
        const profile = travelProfile(this.travelMode);
        const recallNoun = profile.recallNoun;
        const accuracy = this.quizAttempts > 0 ? Math.round(100 * this.quizCorrect / this.quizAttempts) : 0;
        const stats = this.quizAttempts > 0 ? [
          { label: recallNoun, value: `${this.quizCorrect}/${this.quizAttempts}` },
          { label: "Recall", value: `${accuracy}%` }
        ] : [];
        stats.push(
          { label: "Time", value: this.hud.formatTime(this.raceTime).slice(0, -2) },
          { label: "Distance", value: `${(this._playerDistancePx() / PIXELS_PER_METER / 1e3).toFixed(2)} km` }
        );
        if (gamey && this.quizAttempts > 0) stats.splice(2, 0, { label: "Points", value: String(this.quizPoints) });
        const footerBits = [
          this.routeDifficulty.charAt(0).toUpperCase() + this.routeDifficulty.slice(1),
          profile.label,
          this.viewMode.replace("-", " ").replace(/^./, (c) => c.toUpperCase())
        ];
        if (gamey && this.quizBestStreak >= 2) footerBits.push(`Best streak ${this.quizBestStreak}`);
        const bestInFooter = level2 >= 1 && !!bestText;
        if (bestInFooter) footerBits.unshift(bestText.replace("\u2605  ", "\u2605 "));
        const statsPerRow = compact ? Math.min(3, stats.length) : stats.length;
        const statRows = Math.ceil(stats.length / statsPerRow);
        const ROW_H = level2 >= 2 ? 42 : 48;
        blocks2.push({ height: 30 + statRows * ROW_H, rule: true, draw: (top) => {
          ctx.textAlign = "center";
          stats.forEach((stat, index) => {
            const row = Math.floor(index / statsPerRow);
            const inRow = Math.min(statsPerRow, stats.length - row * statsPerRow);
            const column = innerW / inRow;
            const sx = cardX + padX + column * (index % statsPerRow + 0.5);
            const sy = top + row * ROW_H;
            ctx.fillStyle = INK;
            ctx.font = `700 ${compact ? 19 : 21}px ${window.CanalRecallUi.hudSurface.fontMono}`;
            ctx.fillText(stat.value, sx, sy + 24);
            ctx.fillStyle = MUTED;
            ctx.font = "11px system-ui, sans-serif";
            ctx.fillText(stat.label, sx, sy + 42);
          });
          ctx.fillStyle = MUTED;
          ctx.font = "11px system-ui, sans-serif";
          ctx.fillText(wrapText(ctx, footerBits.join("  \xB7  "), innerW, 1)[0], cx, top + statRows * ROW_H + 18);
        } });
        if (ribbon) {
          blocks2.push({ height: 86, rule: true, draw: (top) => {
            this._renderRouteRibbon(ctx, cardX + padX, top + 6, innerW, 74);
          } });
        }
        if (exploration) {
          const known = exploration.learnedWaterways.length + exploration.learnedStreets.length + exploration.learnedTransitLines.length + exploration.learnedTransitStops.length;
          const totals = [];
          if (known > 0) totals.push(`${known} names`);
          if (exploration.visitedNeighborhoods.length > 0) totals.push(`${exploration.visitedNeighborhoods.length} neighborhoods`);
          if (exploration.seenLandmarks.length > 0) totals.push(`${exploration.seenLandmarks.length} landmarks`);
          const gain = this._explorationRouteGain;
          const story = finishStory({
            gain: gain || { newNames: 0, newNeighborhoods: 0, newLandmarks: 0 },
            destinationName: this.routeTo?.name || "",
            cityName: this._cityDisplayName(),
            newPassportStamps: this._finishPassportFresh || [],
            placeStreak: { days: [], current: 0, best: 0 },
            signedIn: !!(this.recall && this.recall.signedIn),
            recallAvailable: !!(this.recall && this.recall.available)
          });
          if (this._finishPlaceStreakLabel) story.streak = this._finishPlaceStreakLabel;
          const fresh = [];
          if (gain && gain.newNames > 0) fresh.push(`${gain.newNames} names`);
          if (gain && gain.newNeighborhoods > 0) fresh.push(`${gain.newNeighborhoods} neighborhoods`);
          if (gain && gain.newLandmarks > 0) fresh.push(`${gain.newLandmarks} landmarks`);
          const knowledgeStacked = compact;
          ctx.font = "12px system-ui, sans-serif";
          const lineBudget = [Infinity, 4, 2, 1][level2];
          const storyLines = [];
          for (const sentence of [story.headline, story.detail, story.passport, story.streak, story.guestTease]) {
            if (!sentence) continue;
            const room2 = lineBudget - storyLines.length;
            if (!storyLines.length && wrapText(ctx, sentence, innerW, 2).length > room2 && sentence.includes(" \xB7 ")) {
              storyLines.push(...wrapText(ctx, sentence.split(" \xB7 ")[0], innerW, room2));
              if (storyLines.length >= lineBudget) break;
              continue;
            }
            const wrapped = wrapText(ctx, sentence, innerW, Math.min(2, room2));
            if (!storyLines.length || wrapText(ctx, sentence, innerW, 2).length <= room2) storyLines.push(...wrapped);
            if (storyLines.length >= lineBudget) break;
          }
          const knowledgeH = (knowledgeStacked ? 34 : 18) + (fresh.length ? 18 : 0) + storyLines.length * 16 + 10;
          blocks2.push({ height: knowledgeH, rule: true, draw: (top) => {
            ctx.textAlign = "left";
            ctx.fillStyle = MUTED;
            ctx.font = `700 11px ${window.CanalRecallUi.hudSurface.fontMono}`;
            ctx.fillText("CITY KNOWLEDGE", cardX + padX, top + 12);
            ctx.fillStyle = BODY;
            ctx.font = "12px system-ui, sans-serif";
            if (knowledgeStacked) {
              ctx.fillText(totals.join("  \xB7  ") || "Start exploring", cardX + padX, top + 30);
            } else {
              ctx.textAlign = "right";
              ctx.fillText(totals.join("  \xB7  ") || "Start exploring", cardX + cardW - padX, top + 12);
            }
            let y2 = top + (knowledgeStacked ? 48 : 30);
            if (fresh.length) {
              ctx.textAlign = "left";
              ctx.fillStyle = ACCENT;
              ctx.font = "11px system-ui, sans-serif";
              ctx.fillText(`+${fresh.join(", +")} first-time`, cardX + padX, y2);
              y2 += 16;
            }
            ctx.textAlign = "left";
            ctx.fillStyle = BODY;
            ctx.font = "12px system-ui, sans-serif";
            for (const line of storyLines) {
              ctx.fillText(line, cardX + padX, y2);
              y2 += 16;
            }
          } });
        }
        if (bestText && !bestInFooter) {
          blocks2.push({ height: 26, draw: (top) => {
            ctx.textAlign = "left";
            ctx.fillStyle = bestText.startsWith("\u2605") ? GOOD : MUTED;
            ctx.font = "bold 13px system-ui, sans-serif";
            ctx.fillText(bestText, cardX + padX, top + 14);
          } });
        }
        const actions = [
          // Say what happens: 'again' deals another route with these settings,
          // 'route' goes back to setup. "Continue" / "Finish" said neither.
          { id: "again", key: "ENTER", caption: "Next route" }
        ];
        if (compact) actions.push({ id: "route", key: "", caption: "Route setup" });
        if (this._shareUrl) {
          actions.push({ id: "copy", key: "C", caption: this._copiedTimer > 0 ? "Link copied" : "Share this route" });
        }
        const BUTTON_H = 44, BUTTON_GAP = 8;
        const pairSecondary = compact && level2 >= 2 && actions.length === 3;
        const buttonRows = pairSecondary ? 2 : actions.length;
        const finishButtons = [];
        this._finishButtonBounds = finishButtons;
        blocks2.push({
          height: compact ? buttonRows * BUTTON_H + (buttonRows - 1) * BUTTON_GAP : 34,
          rule: true,
          draw: (top) => {
            if (compact) {
              let by = top;
              const fullW = cardW - padX * 2;
              actions.forEach((action, index) => {
                const primary = action.id === "again";
                const paired = pairSecondary && index > 0;
                const halfW = (fullW - BUTTON_GAP) / 2;
                const bounds = paired ? { x: cardX + padX + (index - 1) * (halfW + BUTTON_GAP), y: by, w: halfW, h: BUTTON_H } : { x: cardX + padX, y: by, w: fullW, h: BUTTON_H };
                ctx.fillStyle = primary ? COPPER : "rgba(31,28,23,.05)";
                roundRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, 12);
                ctx.fill();
                if (!primary) {
                  ctx.strokeStyle = RULE;
                  ctx.lineWidth = 1;
                  ctx.stroke();
                }
                ctx.textAlign = "center";
                ctx.fillStyle = primary ? "#1f1c17" : action.caption === "Link copied" ? GOOD : INK;
                ctx.font = "700 14px system-ui, sans-serif";
                ctx.fillText(action.caption, bounds.x + bounds.w / 2, by + 28);
                finishButtons.push({ ...bounds, id: action.id });
                if (!paired || index === actions.length - 1) by += BUTTON_H + BUTTON_GAP;
              });
              ctx.textAlign = "left";
              return;
            }
            ctx.textAlign = "left";
            let ax = cardX + padX;
            for (const action of actions) {
              ctx.font = `700 11px ${window.CanalRecallUi.hudSurface.fontMono}`;
              const keyW = ctx.measureText(action.key).width + 14;
              ctx.fillStyle = "rgba(31,28,23,.08)";
              roundRect(ctx, ax, top + 4, keyW, 20, 5);
              ctx.fill();
              ctx.fillStyle = INK;
              ctx.fillText(action.key, ax + 7, top + 18);
              ax += keyW + 8;
              ctx.fillStyle = action.caption === "Link copied" ? GOOD : MUTED;
              ctx.font = "12px system-ui, sans-serif";
              ctx.fillText(action.caption, ax, top + 18);
              ax += ctx.measureText(action.caption).width + 22;
            }
          }
        });
        return blocks2;
      };
      const MARGIN = 16;
      const bottomReserve = compact ? 76 : MARGIN;
      const room = CANVAS_H - MARGIN - bottomReserve;
      const spacing = (level2) => ({
        GAP: [16, 12, 10, 8][level2],
        PAD_TOP: [30, 24, 20, 18][level2],
        PAD_BOTTOM: [26, 20, 18, 16][level2]
      });
      let level = 0;
      let blocks = buildBlocks(0);
      const measureCard = (lv, list) => {
        const { GAP: GAP2, PAD_TOP: PAD_TOP2, PAD_BOTTOM } = spacing(lv);
        let height = PAD_TOP2 + PAD_BOTTOM;
        list.forEach((block, index) => {
          height += (index === 0 ? 0 : block.rule ? GAP2 * 2 : GAP2) + block.height;
        });
        return height;
      };
      let cardH = measureCard(0, blocks);
      while (cardH > room && level < 3) {
        level += 1;
        blocks = buildBlocks(level);
        cardH = measureCard(level, blocks);
      }
      const { GAP, PAD_TOP } = spacing(level);
      const leadFor = (block, index) => index === 0 ? 0 : block.rule ? GAP * 2 : GAP;
      const scale = Math.min(1, room / cardH);
      const cardY = scale < 1 ? MARGIN : Math.max(MARGIN, Math.min(
        Math.round((CANVAS_H - cardH) / 2),
        CANVAS_H - cardH - bottomReserve
      ));
      ctx.save();
      if (scale < 1) {
        ctx.translate(cx, cardY);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cardY);
      }
      this.hud.paperCard(
        ctx,
        { x: cardX, y: cardY, width: cardW, height: cardH },
        { solid: true, radius: 16 }
      );
      ctx.textBaseline = "alphabetic";
      let y = cardY + PAD_TOP;
      blocks.forEach((block, index) => {
        const lead = leadFor(block, index);
        if (block.rule && lead) rule(y + lead / 2);
        y += lead;
        block.draw(y);
        y += block.height;
      });
      ctx.restore();
      this._finishCardBounds = { x: cx - cardW / 2 * scale, y: cardY, w: cardW * scale, h: cardH * scale };
      if (scale < 1 && this._finishButtonBounds) {
        for (const bounds of this._finishButtonBounds) {
          bounds.x = cx + (bounds.x - cx) * scale;
          bounds.y = cardY + (bounds.y - cardY) * scale;
          bounds.w *= scale;
          bounds.h *= scale;
        }
      }
      ctx.textAlign = "center";
    }
    /** The landmark that stands for the destination: the one that shares its
     *  name, or failing that the nearest one to the finish point. */
    _finishLandmark() {
      if (!this.routeTo || this.routeTo.id === "home" || isReviewStop(this.routeTo) || !this.landmarks) return null;
      const exactId = this.routeTo.landmarkId || (this.routeTo.id.startsWith("lm-") ? this.routeTo.id.slice(3) : "");
      if (exactId) return this.landmarks.find((landmark) => landmark.id === exactId) ?? null;
      const wanted = this._normaliseCanalName(this.routeTo.name);
      const byName = this.landmarks.find(
        (landmark) => this._normaliseCanalName(landmark.name) === wanted
      );
      if (byName) return byName;
      if (!this.track) return null;
      let nearest = null;
      let nearestDistance = 220;
      for (const landmark of this.landmarks) {
        const distance = Math.hypot(
          landmark.x - this.track.finishPoint.x,
          landmark.y - this.track.finishPoint.y
        );
        if (distance < nearestDistance) {
          nearest = landmark;
          nearestDistance = distance;
        }
      }
      return nearest;
    }
    /** A medal, the tier, and the per-axis breakdown, so the grade explains
     *  itself rather than reading as a black box. */
    _renderRouteRibbon(ctx, boxX, boxY, boxW, boxH) {
      const ribbon = this._ribbon;
      if (!ribbon) return;
      ctx.fillStyle = ribbon.dim;
      roundRect(ctx, boxX, boxY, boxW, boxH, 10);
      ctx.fill();
      ctx.strokeStyle = ribbon.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.45;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const medalX = boxX + 42, medalY = boxY + 32, medalR = 20;
      ctx.fillStyle = ribbon.color;
      ctx.globalAlpha = 0.75;
      for (const tailDx of [-9, 9]) {
        ctx.beginPath();
        ctx.moveTo(medalX + tailDx - 6, medalY + 10);
        ctx.lineTo(medalX + tailDx + 6, medalY + 10);
        ctx.lineTo(medalX + tailDx + 3, medalY + 34);
        ctx.lineTo(medalX + tailDx, medalY + 27);
        ctx.lineTo(medalX + tailDx - 3, medalY + 34);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(medalX, medalY, medalR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(3,18,28,.9)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = ribbon.color;
      ctx.stroke();
      ctx.fillStyle = ribbon.color;
      ctx.font = `700 18px ${window.CanalRecallUi.hudSurface.fontMono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ribbon.id === "none" ? "\xB7" : ribbon.label[0], medalX, medalY + 1);
      ctx.textBaseline = "alphabetic";
      const textX = boxX + 76;
      ctx.textAlign = "left";
      ctx.fillStyle = ribbon.color;
      ctx.font = `700 19px ${window.CanalRecallUi.hudSurface.fontMono}`;
      ctx.fillText(ribbon.label, textX, boxY + 26);
      const labelWidth = ctx.measureText(ribbon.label).width;
      ctx.fillStyle = "#94A3B8";
      ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
      ctx.fillText(`${Math.round(ribbon.score * 100)}%`, textX + labelWidth + 12, boxY + 26);
      const axes = ribbon.axes;
      const trackW = (boxX + boxW - 18 - textX) / axes.length;
      axes.forEach((axis, index) => {
        const x = textX + index * trackW;
        const w = trackW - 14;
        ctx.fillStyle = "#94A3B8";
        ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
        let axisText = `${axis.label} ${Math.round(axis.score * 100)}%`;
        if (ctx.measureText(axisText).width > w) {
          ctx.font = `10px ${window.CanalRecallUi.hudSurface.fontMono}`;
          axisText = axis.label;
        }
        ctx.fillText(axisText, x, boxY + 45);
        ctx.fillStyle = "rgba(148,163,184,.25)";
        roundRect(ctx, x, boxY + 52, w, 7, 3.5);
        ctx.fill();
        if (axis.score > 0) {
          ctx.fillStyle = ribbon.color;
          const fillW = Math.max(4, w * axis.score);
          roundRect(ctx, x, boxY + 52, fillW, 7, Math.min(3.5, fillW / 2));
          ctx.fill();
        }
      });
      ctx.textAlign = "center";
    }
    // ---- Grading and persistence ----
    //
    // Thin adapters: the rules are in routeRibbon.ts and progressStore.ts.
    _idealRouteLength() {
      return idealRouteLength(this._plannedRouteLengthPx, this.routePath);
    }
    _computeRouteRibbon() {
      return computeRouteRibbon({
        correct: this.quizCorrect,
        attempts: this.quizAttempts,
        aidsUsed: this._assistUsage || {},
        typedAnswers: this.routeOptions.answerMode === "typing",
        idealPx: this._idealRouteLength(),
        actualPx: this._playerDistancePx()
      });
    }
    _getBestTime(key) {
      return getBestTime(localStorage, key);
    }
    _saveBestTime() {
      try {
        recordBestTime(localStorage, this._raceKey, {
          time: this.raceTime,
          date: (/* @__PURE__ */ new Date()).toISOString(),
          distance: pixelsToMiles(this._playerDistancePx(), PIXELS_PER_METER)
        });
      } catch (error) {
        console.warn("Could not save best time:", error);
      }
    }
    _loadExploration() {
      return readExploration(localStorage);
    }
    /**
     * Punchline for race open / briefing. Names the destination only — never the
     * start corridor under the wheels.
     */
    _composeMissionBrief() {
      const due = this.recall && typeof this.recall.dueReviews === "function" ? this.recall.dueReviews() : [];
      const hasCold = due.some((place) => place.cityId === (this.cityId || "amsterdam") && place.dueAt <= Date.now());
      return missionBrief({
        destinationName: this._destinationLabel(),
        travelMode: isBoat(this.travelMode) ? "boat" : isTransit(this.travelMode) ? "transit" : "car",
        routePattern: this.routePattern === "home" ? "home" : this.routePattern === "here" ? "here" : "surprise",
        cityName: this._cityDisplayName(),
        homeLearningRadiusKm: this._homeLearningRadiusKm || 0,
        hasColdOpenReview: COLD_OPEN_ENABLED && hasCold,
        // What the planned path rides, once planned; the straight-line corridor
        // count before that.
        reviewDueNearRoute: this._reviewRoute ? (this._reviewRoute.dueOnPath ?? this._reviewRoute.dueNear).length : 0
      });
    }
    /** Returns the merged collection so the finish card can show both the totals
     *  and what this route added. */
    _saveExploration() {
      try {
        const before = readExploration(localStorage);
        const after = mergeExploration(before, {
          learnedKind: travelProfile(this.travelMode).learnedKind,
          learnedNames: this.learnedNames,
          learnedStopNames: this.learnedStopNames || [],
          visitedNeighborhoods: this._visitedNeighborhoods,
          seenLandmarkNames: this._seenLandmarkNames,
          correct: this.quizCorrect,
          attempts: this.quizAttempts
        });
        saveExploration(localStorage, after);
        const gain = explorationGain(before, after);
        this._explorationRouteGain = gain;
        if (gain.newNames > 0) {
          const streak = notePlaceDay(localStorage);
          this._finishPlaceStreakLabel = placeStreakLabel(streak);
        } else {
          this._finishPlaceStreakLabel = placeStreakLabel(readPlaceStreak(localStorage));
        }
        const stamped = stampNewNeighborhoods(
          after,
          this._visitedNeighborhoods,
          readPassport(localStorage)
        );
        if (stamped.fresh.length) savePassport(localStorage, stamped.passport);
        this._finishPassportFresh = stamped.fresh;
        return after;
      } catch (error) {
        console.warn("Could not save exploration:", error);
        return null;
      }
    }
    /** What this route added, for the finish card. */
    _explorationGain(before, after) {
      return explorationGain(before, after);
    }
  };
  window.CanalRecallGameModules = window.CanalRecallGameModules || [];
  window.CanalRecallGameModules.push(GamePresentationRuntime);
})();
