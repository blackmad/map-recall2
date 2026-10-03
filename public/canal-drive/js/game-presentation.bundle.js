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
    const zoom = Math.max(INTRO_MIN_ZOOM, Math.min(fit, playZoom * INTRO_MAX_ZOOM_FRACTION));
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

  // src/canalRecall/game/routeSelection.ts
  var REVIEW_STOP_LABEL = "the mystery street";
  function isReviewStop(poi) {
    return !!poi && typeof poi.reviewStop === "string";
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
      this.canvas.addEventListener("wheel", (event) => {
        if (this.state === GameState.MENU) return;
        event.preventDefault();
        if (event.ctrlKey) {
          this.camera.zoom = Math.min(this.camera.maxZoom, Math.max(this.camera.minZoom, this.camera.zoom * Math.exp(-event.deltaY * 2e-3)));
          this._zoomTouchedByPlayer = true;
        } else this.camera.pan(event.deltaX, event.deltaY);
        syncZoom();
      }, { passive: false });
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
      this.vectorMap.setPlayerBike(player, this.osmLoader, pitched && showBike);
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
      ctx.fillText(text, plate.x + plate.width / 2, plate.y + 15);
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
