"use strict";
var CanalRecallRoadProjection = (() => {
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

  // src/canalRecall/osm/roadProjection.ts
  var roadProjection_exports = {};
  __export(roadProjection_exports, {
    ENDPOINT_SAMPLE_LIMIT: () => ENDPOINT_SAMPLE_LIMIT,
    METRES_PER_DEGREE_LAT: () => METRES_PER_DEGREE_LAT,
    PIXELS_PER_METER: () => PIXELS_PER_METER,
    RoadSnapIndex: () => RoadSnapIndex,
    WORLD_ORIGIN: () => WORLD_ORIGIN,
    buildRoadSegments: () => buildRoadSegments,
    centringOffset: () => centringOffset,
    closestPointOnSegment: () => closestPointOnSegment,
    findStartFinish: () => findStartFinish,
    haversineMetres: () => haversineMetres,
    isMotorOnlyHighway: () => isMotorOnlyHighway,
    latToTileY: () => latToTileY,
    lngToTileX: () => lngToTileX,
    metresPerDegreeLng: () => metresPerDegreeLng,
    motorOnlyNames: () => motorOnlyNames,
    projectToWorld: () => projectToWorld,
    segmentBounds: () => segmentBounds,
    simplifyPath: () => simplifyPath,
    snapToRoad: () => snapToRoad,
    tileXToLng: () => tileXToLng,
    tileYToLat: () => tileYToLat
  });

  // src/canalRecall/osm/roadSnapIndex.ts
  var distanceTo = (point, node) => Math.hypot(
    Math.max(node.minX - point.x, 0, point.x - node.maxX),
    Math.max(node.minY - point.y, 0, point.y - node.maxY)
  );
  var RoadSnapIndex = class {
    root;
    constructor(segments) {
      const spans = [];
      for (const segment of segments) for (let i = 1; i < segment.points.length; i++)
        spans.push({ a: segment.points[i - 1], b: segment.points[i], order: spans.length });
      const build = (items) => {
        const node = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        for (const { a, b } of items) {
          node.minX = Math.min(node.minX, a.x, b.x);
          node.minY = Math.min(node.minY, a.y, b.y);
          node.maxX = Math.max(node.maxX, a.x, b.x);
          node.maxY = Math.max(node.maxY, a.y, b.y);
        }
        if (items.length <= 8) node.spans = items;
        else {
          const axis = node.maxX - node.minX >= node.maxY - node.minY ? "x" : "y";
          items.sort((a, b) => a.a[axis] + a.b[axis] - (b.a[axis] + b.b[axis]));
          const middle = Math.floor(items.length / 2);
          node.left = build(items.slice(0, middle));
          node.right = build(items.slice(middle));
        }
        return node;
      };
      if (spans.length) this.root = build(spans);
    }
    nearest(point) {
      let best = null, order = Infinity;
      const visit = (node) => {
        if (best && distanceTo(point, node) > best.distance + 1e-8) return;
        if (node.spans) {
          for (const span of node.spans) {
            const candidate = closestPointOnSegment(point, span.a, span.b);
            if (!best || candidate.distance < best.distance || candidate.distance === best.distance && span.order < order) {
              best = candidate;
              order = span.order;
            }
          }
        } else {
          const a = node.left, b = node.right;
          if (distanceTo(point, a) <= distanceTo(point, b)) {
            visit(a);
            visit(b);
          } else {
            visit(b);
            visit(a);
          }
        }
      };
      if (this.root) visit(this.root);
      return best;
    }
  };

  // src/canalRecall/routing/cycleTrack.ts
  var TRACK = /^(track|separate)$/;
  function hasSeparatedCycleTrack(tags) {
    if (TRACK.test(tags.cycleway || "")) return true;
    if (TRACK.test(tags["cycleway:both"] || "")) return true;
    if (TRACK.test(tags["cycleway:left"] || "")) return true;
    if (TRACK.test(tags["cycleway:right"] || "")) return true;
    if (tags["cycleway:both:segregated"] === "yes") return true;
    if (tags["cycleway:left:segregated"] === "yes") return true;
    if (tags["cycleway:right:segregated"] === "yes") return true;
    return false;
  }

  // src/canalRecall/routing/bikeAccess.ts
  var MOTOR_ONLY_HIGHWAYS = /* @__PURE__ */ new Set(["motorway", "motorway_link", "trunk", "trunk_link"]);
  function isMotorOnlyHighway(highway) {
    return MOTOR_ONLY_HIGHWAYS.has(highway || "");
  }
  var BICYCLE_DENIED = /* @__PURE__ */ new Set(["no", "dismount", "private", "customers"]);
  function isBicycleRestricted(tags) {
    return BICYCLE_DENIED.has(tags.bicycle || "") || tags.bicycleRestricted === "yes";
  }
  function motorOnlyNames(features, share = 0.5) {
    const motor = /* @__PURE__ */ new Map(), total = /* @__PURE__ */ new Map();
    for (const feature of features) {
      if (!feature.name) continue;
      let length = 0;
      for (const path of feature.paths ?? (feature.path ? [feature.path] : [])) {
        for (let i = 1; i < path.length; i++) {
          const dLat = path[i][0] - path[i - 1][0];
          const dLon = (path[i][1] - path[i - 1][1]) * Math.cos(path[i][0] * Math.PI / 180);
          length += Math.hypot(dLat, dLon);
        }
      }
      total.set(feature.name, (total.get(feature.name) ?? 0) + length);
      if (isMotorOnlyHighway(feature.highway)) motor.set(feature.name, (motor.get(feature.name) ?? 0) + length);
    }
    const names = /* @__PURE__ */ new Set();
    for (const [name, length] of motor) if (length > share * (total.get(name) ?? 0)) names.add(name);
    return names;
  }

  // src/canalRecall/osm/roadProjection.ts
  var PIXELS_PER_METER = 3;
  var METRES_PER_DEGREE_LAT = 111320;
  var WORLD_ORIGIN = { x: 1300, y: 1e3 };
  function metresPerDegreeLng(latitude) {
    return METRES_PER_DEGREE_LAT * Math.cos(latitude * Math.PI / 180);
  }
  function projectToWorld(point, centre) {
    return {
      x: (point.lon - centre.lon) * metresPerDegreeLng(centre.lat) * PIXELS_PER_METER,
      y: -(point.lat - centre.lat) * METRES_PER_DEGREE_LAT * PIXELS_PER_METER
    };
  }
  function closestPointOnSegment(point, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSquared = abx * abx + aby * aby;
    if (lengthSquared === 0) {
      return { x: a.x, y: a.y, distance: Math.hypot(point.x - a.x, point.y - a.y) };
    }
    const t = Math.max(0, Math.min(
      1,
      ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared
    ));
    const x = a.x + abx * t;
    const y = a.y + aby * t;
    return { x, y, distance: Math.hypot(point.x - x, point.y - y) };
  }
  function simplifyPath(points, tolerance) {
    if (points.length <= 2) return points.slice();
    const keep = new Array(points.length).fill(false);
    keep[0] = true;
    keep[points.length - 1] = true;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [first, last] = stack.pop();
      let furthest = 0;
      let furthestIndex = -1;
      for (let i = first + 1; i < last; i++) {
        const distance = closestPointOnSegment(points[i], points[first], points[last]).distance;
        if (distance > furthest) {
          furthest = distance;
          furthestIndex = i;
        }
      }
      if (furthestIndex !== -1 && furthest > tolerance) {
        keep[furthestIndex] = true;
        stack.push([first, furthestIndex], [furthestIndex, last]);
      }
    }
    return points.filter((_, index) => keep[index]);
  }
  function segmentBounds(segments) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let seen = false;
    for (const segment of segments) {
      for (const point of segment.points) {
        seen = true;
        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
      }
    }
    return seen ? { minX, minY, maxX, maxY } : null;
  }
  function centringOffset(segments) {
    const bounds = segmentBounds(segments);
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: WORLD_ORIGIN.x - (bounds.minX + bounds.maxX) / 2,
      y: WORLD_ORIGIN.y - (bounds.minY + bounds.maxY) / 2
    };
  }
  function buildRoadSegments(ways, centre, options) {
    const tolerance = options.simplificationToleranceDegrees * METRES_PER_DEGREE_LAT * PIXELS_PER_METER;
    const segments = [];
    for (const way of ways) {
      const points = way.nodes.map((node) => projectToWorld(node, centre));
      if (points.length < 2) continue;
      const simplified = simplifyPath(points, tolerance);
      if (simplified.length < 2) continue;
      segments.push({
        points: simplified,
        width: options.roadWidths[way.highway] ?? options.defaultRoadWidth,
        type: way.highway,
        oneway: way.tags.oneway === "yes",
        name: way.tags.name || "",
        separatedCycleTrack: hasSeparatedCycleTrack(way.tags),
        bicycleRestricted: way.tags.bicycleRestricted === "yes" || isBicycleRestricted(way.tags),
        bicycle: isBicycleRestricted(way.tags) || way.tags.bicycleRestricted === "yes" ? way.tags.bicycle || "no" : void 0
      });
    }
    const offset = centringOffset(segments);
    for (const segment of segments) {
      for (const point of segment.points) {
        point.x += offset.x;
        point.y += offset.y;
      }
    }
    return { segments, offset };
  }
  function snapToRoad(point, centre, offset, segments, maxSnapDistance, index) {
    const projected = projectToWorld(point, centre);
    const target = { x: projected.x + offset.x, y: projected.y + offset.y };
    let best = index?.nearest(target) ?? null;
    if (!index) for (const segment of segments) {
      for (let i = 0; i < segment.points.length - 1; i++) {
        const candidate = closestPointOnSegment(target, segment.points[i], segment.points[i + 1]);
        if (!best || candidate.distance < best.distance) best = candidate;
      }
    }
    if (!best) return null;
    if (Number.isFinite(maxSnapDistance) && best.distance > maxSnapDistance) return null;
    return { x: best.x, y: best.y, snapDistance: best.distance };
  }
  var ENDPOINT_SAMPLE_LIMIT = 200;
  function findStartFinish(segments) {
    const endpoints = [];
    for (const segment of segments) {
      if (!segment.points.length) continue;
      endpoints.push(segment.points[0]);
      endpoints.push(segment.points[segment.points.length - 1]);
    }
    if (!endpoints.length) return null;
    let start = endpoints[0];
    let nearest = Infinity;
    for (const point of endpoints) {
      const d = (point.x - WORLD_ORIGIN.x) ** 2 + (point.y - WORLD_ORIGIN.y) ** 2;
      if (d < nearest) {
        nearest = d;
        start = point;
      }
    }
    const sampled = endpoints.length > ENDPOINT_SAMPLE_LIMIT ? endpoints.filter((_, i) => i % Math.ceil(endpoints.length / ENDPOINT_SAMPLE_LIMIT) === 0) : endpoints;
    let finish = start;
    let furthest = 0;
    for (const point of sampled) {
      const d = (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
      if (d > furthest) {
        furthest = d;
        finish = point;
      }
    }
    return { start, finish, distance: Math.sqrt(furthest) };
  }
  function haversineMetres(a, b) {
    const earthRadius = 6371e3;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  function lngToTileX(lng, zoom) {
    return (lng + 180) / 360 * 2 ** zoom;
  }
  function latToTileY(lat, zoom) {
    const radians = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * 2 ** zoom;
  }
  function tileXToLng(x, zoom) {
    return x / 2 ** zoom * 360 - 180;
  }
  function tileYToLat(y, zoom) {
    const n = Math.PI - 2 * Math.PI * y / 2 ** zoom;
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }
  return __toCommonJS(roadProjection_exports);
})();
