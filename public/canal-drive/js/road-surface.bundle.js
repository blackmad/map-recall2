"use strict";
var CanalRecallRoadSurface = (() => {
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

  // src/canalRecall/routing/roadSurface.ts
  var roadSurface_exports = {};
  __export(roadSurface_exports, {
    ALIGNMENT_DISTANCE_SLACK: () => ALIGNMENT_DISTANCE_SLACK,
    ALIGNMENT_WIDTH_SLACK: () => ALIGNMENT_WIDTH_SLACK,
    CURB_INNER_MARGIN: () => CURB_INNER_MARGIN,
    CURB_OUTER_MARGIN: () => CURB_OUTER_MARGIN,
    NAME_MERGE_SIZE: () => NAME_MERGE_SIZE,
    NAME_WIDTH_SLACK: () => NAME_WIDTH_SLACK,
    ROAD_GRID_CELL: () => ROAD_GRID_CELL,
    buildRoadSpatialIndex: () => buildRoadSpatialIndex,
    classifySurface: () => classifySurface,
    connectedNamedSegments: () => connectedNamedSegments,
    contactsAt: () => contactsAt,
    headingDifference: () => headingDifference,
    pickRoadContact: () => pickRoadContact,
    roadNameAt: () => roadNameAt,
    roadsNear: () => roadsNear
  });
  var ROAD_GRID_CELL = 100;
  var CURB_INNER_MARGIN = 6;
  var CURB_OUTER_MARGIN = 2;
  var NAME_MERGE_SIZE = 18;
  var cellKey = (gx, gy) => `${gx},${gy}`;
  function closestPointOnSpan(px, py, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSquared = abx * abx + aby * aby;
    if (lengthSquared === 0) return { x: a.x, y: a.y, dist: Math.hypot(px - a.x, py - a.y) };
    const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / lengthSquared));
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy) };
  }
  function buildRoadSpatialIndex(segments, cellSize = ROAD_GRID_CELL) {
    const cells = /* @__PURE__ */ new Map();
    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const segment = segments[segIdx];
      const width = segment.width;
      for (let ptIdx = 0; ptIdx < segment.points.length - 1; ptIdx++) {
        const a = segment.points[ptIdx];
        const b = segment.points[ptIdx + 1];
        const pad = width + 10;
        const gx0 = Math.floor((Math.min(a.x, b.x) - pad) / cellSize);
        const gx1 = Math.floor((Math.max(a.x, b.x) + pad) / cellSize);
        const gy0 = Math.floor((Math.min(a.y, b.y) - pad) / cellSize);
        const gy1 = Math.floor((Math.max(a.y, b.y) + pad) / cellSize);
        const span = { a, b, segIdx, ptIdx, width };
        for (let gx = gx0; gx <= gx1; gx++) {
          for (let gy = gy0; gy <= gy1; gy++) {
            const key = cellKey(gx, gy);
            const bucket = cells.get(key);
            if (bucket) bucket.push(span);
            else cells.set(key, [span]);
          }
        }
      }
    }
    return { cellSize, cells };
  }
  function roadsNear(index, x, y, ring = 1) {
    const gx = Math.floor(x / index.cellSize);
    const gy = Math.floor(y / index.cellSize);
    const found = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        const bucket = index.cells.get(cellKey(gx + dx, gy + dy));
        if (bucket) found.push(...bucket);
      }
    }
    return found;
  }
  function classifySurface(distance, width) {
    if (!Number.isFinite(distance)) return "grass";
    if (distance < width - CURB_INNER_MARGIN) return "asphalt";
    if (distance < width + CURB_OUTER_MARGIN) return "curb";
    return "grass";
  }
  function contactsAt(spans, x, y) {
    const contacts = [];
    for (const span of spans) {
      const hit = closestPointOnSpan(x, y, span.a, span.b);
      const rdx = span.b.x - span.a.x;
      const rdy = span.b.y - span.a.y;
      const length = Math.hypot(rdx, rdy) || 1;
      contacts.push({
        x: hit.x,
        y: hit.y,
        dist: hit.dist,
        angle: Math.atan2(rdy, rdx),
        width: span.width,
        segIdx: span.segIdx,
        ptIdx: span.ptIdx,
        nx: -rdy / length,
        ny: rdx / length
      });
    }
    return contacts;
  }
  var ALIGNMENT_DISTANCE_SLACK = 10;
  var ALIGNMENT_WIDTH_SLACK = 12;
  function headingDifference(angle, preferred) {
    const delta = Math.abs(Math.atan2(Math.sin(angle - preferred), Math.cos(angle - preferred)));
    return Math.min(delta, Math.PI - delta);
  }
  function pickRoadContact(contacts, preferredAngle = null) {
    let nearest = null;
    for (const contact of contacts) {
      if (!nearest || contact.dist < nearest.dist) nearest = contact;
    }
    if (preferredAngle == null || !nearest) return nearest;
    const plausible = contacts.filter((contact) => contact.dist <= nearest.dist + ALIGNMENT_DISTANCE_SLACK && contact.dist <= contact.width + ALIGNMENT_WIDTH_SLACK);
    let aligned = null;
    for (const contact of plausible) {
      if (!aligned) {
        aligned = contact;
        continue;
      }
      const delta = headingDifference(contact.angle, preferredAngle) - headingDifference(aligned.angle, preferredAngle);
      if (delta < 0 || delta === 0 && contact.dist < aligned.dist) aligned = contact;
    }
    return aligned ?? nearest;
  }
  var NAME_WIDTH_SLACK = 20;
  function roadNameAt(segments, contact) {
    if (!contact || contact.dist > contact.width + NAME_WIDTH_SLACK) return "";
    return segments[contact.segIdx]?.name || "";
  }
  function connectedNamedSegments(segments, seedIndex, mergeSize = NAME_MERGE_SIZE) {
    const seed = segments[seedIndex];
    if (!seed || !seed.name) return [];
    const endpointCells = (segment) => {
      const points = segment.points || [];
      if (!points.length) return [];
      const key = (point) => `${Math.round(point.x / mergeSize)},${Math.round(point.y / mergeSize)}`;
      return [key(points[0]), key(points[points.length - 1])];
    };
    const buckets = /* @__PURE__ */ new Map();
    for (let index = 0; index < segments.length; index++) {
      if (segments[index].name !== seed.name) continue;
      for (const key of endpointCells(segments[index])) {
        const bucket = buckets.get(key);
        if (bucket) bucket.push(index);
        else buckets.set(key, [index]);
      }
    }
    const connected = [];
    const seen = /* @__PURE__ */ new Set([seedIndex]);
    const queue = [seedIndex];
    while (queue.length) {
      const index = queue.shift();
      connected.push(segments[index]);
      for (const key of endpointCells(segments[index])) {
        const [cx, cy] = key.split(",").map(Number);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (const neighbour of buckets.get(`${cx + dx},${cy + dy}`) || []) {
              if (seen.has(neighbour)) continue;
              seen.add(neighbour);
              queue.push(neighbour);
            }
          }
        }
      }
    }
    return connected;
  }
  return __toCommonJS(roadSurface_exports);
})();
