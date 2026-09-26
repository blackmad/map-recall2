"use strict";
var CanalRecallRegistration = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/canalRecall/facade/registrationGold.ts
  var registrationGold_exports = {};
  __export(registrationGold_exports, {
    canonicalJson: () => canonicalJson,
    dependencyHash: () => dependencyHash,
    mergeRegistrationDraft: () => mergeRegistrationDraft,
    registrationFixtureIsAgreed: () => registrationFixtureIsAgreed,
    registrationFixtureIsReviewed: () => registrationFixtureIsReviewed,
    registrationObservationHash: () => registrationObservationHash,
    validReviewTime: () => validReviewTime
  });

  // src/canalRecall/facade/elevations.ts
  var distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  var quantiseMillimetres = (value) => Math.round(value * 1e3);
  var signedRingArea = (ring) => {
    let twiceArea = 0;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      twiceArea += ring[previous].x * ring[index].y - ring[index].x * ring[previous].y;
    }
    return twiceArea / 2;
  };
  var ringIsCounterClockwise = (ring) => signedRingArea(ring) > 0;
  var rotate = (items, start) => [...items.slice(start), ...items.slice(0, start)];
  function normaliseFootprintRing(footprint, duplicateToleranceM = 1e-3) {
    const ring = [];
    footprint.forEach((point, sourceIndex) => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      const previous = ring.at(-1);
      if (!previous || distance(previous, point) > duplicateToleranceM) ring.push({ ...point, sourceIndex });
    });
    if (ring.length > 1 && distance(ring[0], ring.at(-1)) <= duplicateToleranceM) ring.pop();
    if (ring.length < 3 || Math.abs(signedRingArea(ring)) < 1e-6) return [];
    const oriented = ringIsCounterClockwise(ring) ? ring : [...ring].reverse();
    let canonicalStart = 0;
    for (let index = 1; index < oriented.length; index++) {
      const candidate = [quantiseMillimetres(oriented[index].x), quantiseMillimetres(oriented[index].y), oriented[index].sourceIndex];
      const current = [quantiseMillimetres(oriented[canonicalStart].x), quantiseMillimetres(oriented[canonicalStart].y), oriented[canonicalStart].sourceIndex];
      if (candidate[0] < current[0] || candidate[0] === current[0] && (candidate[1] < current[1] || candidate[1] === current[1] && candidate[2] < current[2])) canonicalStart = index;
    }
    return rotate(oriented, canonicalStart);
  }
  var bearing = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  var angleDifference = (left, right) => {
    let difference = Math.abs(left - right) % (Math.PI * 2);
    if (difference > Math.PI) difference = Math.PI * 2 - difference;
    return difference;
  };
  var stableHash = (input) => {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index++) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).padStart(7, "0");
  };
  function buildElevations(footprint, { pandId = "unkeyed", collinearToleranceDeg = 0.75, minLengthM = 0 } = {}) {
    const ring = normaliseFootprintRing(footprint);
    if (ring.length < 3) return [];
    const tolerance = collinearToleranceDeg * Math.PI / 180;
    const edgeBearing = (index) => bearing(ring[index], ring[(index + 1) % ring.length]);
    const runs = [];
    for (let index = 0; index < ring.length; index++) {
      const last = runs.at(-1);
      if (last && angleDifference(edgeBearing(last.at(-1)), edgeBearing(index)) <= tolerance) last.push(index);
      else runs.push([index]);
    }
    if (runs.length > 1 && angleDifference(edgeBearing(runs.at(-1).at(-1)), edgeBearing(runs[0][0])) <= tolerance) {
      runs[0] = [...runs.pop(), ...runs[0]];
    }
    const elevations = [];
    for (const run of runs) {
      const start = ring[run[0]];
      const end = ring[(run.at(-1) + 1) % ring.length];
      const lengthM = distance(start, end);
      if (lengthM < Math.max(minLengthM, 1e-6)) continue;
      const dx = (end.x - start.x) / lengthM;
      const dy = (end.y - start.y) / lengthM;
      const normal = { x: dy, y: -dx };
      const endpointKey = `${quantiseMillimetres(start.x)},${quantiseMillimetres(start.y)}:${quantiseMillimetres(end.x)},${quantiseMillimetres(end.y)}`;
      elevations.push({
        elevationId: `${pandId}:e:${stableHash(endpointKey)}`,
        index: elevations.length,
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
        midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
        normal,
        lengthM,
        facingDeg: (Math.atan2(normal.x, normal.y) * 180 / Math.PI + 360) % 360,
        sourceVertexRange: { vertexIndices: [...run.map((index) => ring[index].sourceIndex), end.sourceIndex], edgeIndices: run.map((index) => ring[index].sourceIndex) }
      });
    }
    return elevations;
  }

  // src/canalRecall/facade/registrationGold.ts
  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== void 0).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
    return JSON.stringify(value) ?? "null";
  }
  async function dependencyHash(value) {
    const bytes = new TextEncoder().encode(canonicalJson(value));
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  var validReviewTime = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  function registrationObservationHash(fixture) {
    const {
      fixtureId,
      pandId,
      label,
      addresses,
      identityVersion,
      footprintRd,
      elevations,
      selectedElevationId,
      panorama,
      sourceVersion,
      cameraModelVersion,
      sourceQuad,
      anchors
    } = fixture;
    return dependencyHash({
      schema: "facade-observation/v2",
      fixtureId,
      pandId,
      label,
      addresses,
      identityVersion,
      footprintRd,
      elevations,
      selectedElevationId,
      panorama: panorama ? { ...panorama, localImageUrl: void 0 } : null,
      sourceVersion,
      cameraModelVersion,
      sourceQuad,
      anchors
    });
  }
  async function registrationFixtureIsReviewed(fixture) {
    const source = fixture.sourceVersion;
    const panorama = fixture.panorama;
    if (fixture.status === "rejected" || fixture.status === "stale" || !/^\d{16}$/.test(fixture.pandId) || !fixture.identityVersion?.trim() || !fixture.selectedElevationId || fixture.elevations?.filter((wall2) => wall2.elevationId === fixture.selectedElevationId).length !== 1 || !panorama?.panoramaId?.trim() || !panorama.imageUrl?.trim() || !validReviewTime(panorama.capturedAt) || !source || !/^[a-f0-9]{64}$/.test(source.sha256) || !source.schema?.trim() || !Number.isInteger(source.width) || source.width <= 0 || !Number.isInteger(source.height) || source.height <= 0 || !fixture.reviewPasses?.length) return false;
    const wall = fixture.elevations.find((item) => item.elevationId === fixture.selectedElevationId);
    const rebuilt = buildElevations(fixture.footprintRd, { pandId: fixture.pandId }).find((item) => item.elevationId === fixture.selectedElevationId);
    if (!rebuilt || canonicalJson(wall) !== canonicalJson(rebuilt)) return false;
    if (fixture.reviewPasses.some((pass) => !pass.reviewer?.trim() || !pass.passId?.trim() || !validReviewTime(pass.reviewedAt))) return false;
    const latestTime = Math.max(...fixture.reviewPasses.map((pass) => Date.parse(pass.reviewedAt)));
    const latest = fixture.reviewPasses.filter((pass) => Date.parse(pass.reviewedAt) === latestTime);
    const hash = await registrationObservationHash(fixture);
    return latest.every((pass) => pass.identityVerdict === "accepted" && pass.elevationVerdict === "accepted" && pass.observationHash === hash);
  }
  function mergeRegistrationDraft(current, draft) {
    if (draft.fixtureId !== current.fixtureId || draft.pandId !== current.pandId) return current;
    const metadata = (fixture) => fixture.panorama ? { ...fixture.panorama, localImageUrl: void 0 } : null;
    const sameSource = canonicalJson({
      identity: current.identityVersion,
      source: current.sourceVersion,
      panorama: metadata(current),
      footprint: current.footprintRd,
      walls: current.elevations,
      camera: current.cameraModelVersion
    }) === canonicalJson({
      identity: draft.identityVersion,
      source: draft.sourceVersion,
      panorama: metadata(draft),
      footprint: draft.footprintRd,
      walls: draft.elevations,
      camera: draft.cameraModelVersion
    });
    const history = [...current.reviewPasses, ...draft.reviewPasses ?? []];
    return {
      ...current,
      reviewPasses: history.filter((pass, index) => history.findIndex((other) => canonicalJson(other) === canonicalJson(pass)) === index),
      ...sameSource ? {
        selectedElevationId: draft.selectedElevationId,
        anchors: draft.anchors,
        status: draft.status,
        elevationSelectionBasis: draft.elevationSelectionBasis
      } : { status: "stale" }
    };
  }
  var registrationFixtureIsAgreed = registrationFixtureIsReviewed;
  return __toCommonJS(registrationGold_exports);
})();
