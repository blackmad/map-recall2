// What a "which street are you on?" question may answer on a bridge.
//
// OSM often names a bridge way after the bridge itself rather than the street
// it carries: the Raadhuisstraat's deck over the Keizersgracht is mapped as
// "Niek Engelschmanbrug", the Herenstraat's as "Noordsche Compagniebrug". The
// route question settled on the way's name, so a rider on the Raadhuisstraat
// was asked which street they were on and "Niek Engelschmanbrug" was the
// accepted answer (user report 2026-10-16). A bridge's name is not a street.
//
// The rule, for a way whose name is a bridge's:
//   - the deliberate bridge question ("Which bridge are you on?", a bridge in
//     `bridges.json` that `bridgeNameAskable` allows) is kept untouched;
//   - otherwise, when the street continues straight across (the same name
//     leaves both ends of the deck in line with it), the deck *is* that
//     street, and the question answers with it;
//   - otherwise (a deck between two differently named streets, or a dead
//     end), the deck has no street of its own: it is transparent, nothing is
//     nominated on it, and the street beyond is asked a few metres after the
//     rider leaves the deck.
//
// Bridge names are still taught, by the crossing question (`_updateBridgeQuiz`).

import { contactsAt, roadsNear, type RoadPoint, type RoadSpatialIndex } from '../routing/roadSurface';

/** Dutch (and English) bridge names: "…brug", "…sluis", "Brug 117". Locks
 *  in the canal belt are road bridges ("Torensluis", "Hoge Sluis"). */
const BRIDGE_SUFFIX = /(?:brug|brugje|bruggetje|sluis|sluisje|duiker|viaduct|aquaduct|bridge)$/i;
const NUMBERED_BRIDGE = /^brug\s+\d+/i;

export function isBridgeWayName(name: string | null | undefined): boolean {
  const trimmed = (name || '').trim();
  if (!trimmed) return false;
  return BRIDGE_SUFFIX.test(trimmed) || NUMBERED_BRIDGE.test(trimmed);
}

/** One way touching a point: its index and the line angle of its span there. */
export interface TouchingWay {
  segIdx: number;
  angle: number;
}

/** The little the rule needs to know about the network. */
export interface BridgeWayNetwork {
  nameOf(segIdx: number): string;
  pointsOf(segIdx: number): readonly RoadPoint[];
  /** Ways whose centreline passes within `radius` of `point`. */
  touching(point: RoadPoint, radius: number): TouchingWay[];
}

export interface CarriedStreetOptions {
  /** World units: how close another way must come to a deck end to meet it. */
  touchRadius: number;
  /** Radians: how far off the deck's line a street may leave and still be its
   *  continuation. A quay along the canal meets the deck at ~90°. */
  maxTurn?: number;
  /** How many same-name deck pieces to follow from one end. */
  maxPieces?: number;
}

const DEFAULT_MAX_TURN = Math.PI / 4;
const DEFAULT_MAX_PIECES = 4;

function near(a: RoadPoint, b: RoadPoint, radius: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= radius;
}

/** Undirected: a line angle and its reverse are the same line. */
function inLine(angle: number, outward: number, maxTurn: number): boolean {
  return Math.abs(Math.cos(angle - outward)) >= Math.cos(maxTurn);
}

/**
 * Named streets that continue the deck in line beyond `end`. Same-name deck
 * pieces (a deck split mid-span) are followed to their far end.
 */
function streetsBeyond(
  network: BridgeWayNetwork,
  bridgeName: string,
  end: RoadPoint,
  outward: number,
  visited: Set<number>,
  options: Required<CarriedStreetOptions>,
  depth: number,
): Set<string> {
  const names = new Set<string>();
  for (const way of network.touching(end, options.touchRadius)) {
    if (visited.has(way.segIdx)) continue;
    const name = network.nameOf(way.segIdx);
    if (!name) continue;
    if (name === bridgeName) {
      if (depth >= options.maxPieces) continue;
      const points = network.pointsOf(way.segIdx);
      if (points.length < 2) continue;
      const first = points[0], last = points[points.length - 1];
      let far: RoadPoint, before: RoadPoint;
      if (near(first, end, options.touchRadius)) { far = last; before = points[points.length - 2]; }
      else if (near(last, end, options.touchRadius)) { far = first; before = points[1]; }
      else continue; // a parallel piece passing by, not a continuation
      visited.add(way.segIdx);
      const onward = Math.atan2(far.y - before.y, far.x - before.x);
      for (const beyond of streetsBeyond(network, bridgeName, far, onward, visited, options, depth + 1)) {
        names.add(beyond);
      }
      continue;
    }
    if (isBridgeWayName(name)) continue;
    if (inLine(way.angle, outward, options.maxTurn)) names.add(name);
  }
  return names;
}

/**
 * The street a bridge way carries: the one name that continues the deck in
 * line at both of its ends. '' when the way is not a bridge-named way, when
 * the two ends lead onto different streets, or when an end leads nowhere.
 */
export function carriedStreetName(
  network: BridgeWayNetwork,
  segIdx: number,
  options: CarriedStreetOptions,
): string {
  const bridgeName = network.nameOf(segIdx);
  if (!isBridgeWayName(bridgeName)) return '';
  const points = network.pointsOf(segIdx);
  if (points.length < 2) return '';
  const resolved: Required<CarriedStreetOptions> = {
    touchRadius: options.touchRadius,
    maxTurn: options.maxTurn ?? DEFAULT_MAX_TURN,
    maxPieces: options.maxPieces ?? DEFAULT_MAX_PIECES,
  };
  const first = points[0], second = points[1];
  const last = points[points.length - 1], penultimate = points[points.length - 2];
  const startSide = streetsBeyond(network, bridgeName, first,
    Math.atan2(first.y - second.y, first.x - second.x), new Set([segIdx]), resolved, 0);
  if (startSide.size === 0) return '';
  const endSide = streetsBeyond(network, bridgeName, last,
    Math.atan2(last.y - penultimate.y, last.x - penultimate.x), new Set([segIdx]), resolved, 0);
  const common = [...startSide].filter(name => endSide.has(name));
  return common.length === 1 ? common[0] : '';
}

export interface RouteQuestionNameInput {
  /** The way's own name under the rider. */
  rawName: string;
  /** The way is a `bridges.json` bridge that may be asked as a bridge here. */
  deliberateBridge: boolean;
  /** `carriedStreetName` for the way under the rider (lazily). */
  carriedStreet: () => string;
}

/**
 * The name the route question settles on. A street question must never
 * answer with a bridge's name: the deck takes the street it carries, or no
 * name at all (see the file comment).
 */
export function routeQuestionRoadName(input: RouteQuestionNameInput): string {
  if (!isBridgeWayName(input.rawName)) return input.rawName;
  if (input.deliberateBridge) return input.rawName;
  return input.carriedStreet();
}

interface IndexedSegment { points: readonly RoadPoint[]; name?: string }

/** A `BridgeWayNetwork` over the game's segments and its road spatial index. */
export function bridgeWayNetwork(
  segments: readonly IndexedSegment[],
  index: RoadSpatialIndex,
): BridgeWayNetwork {
  return {
    nameOf: segIdx => segments[segIdx]?.name || '',
    pointsOf: segIdx => segments[segIdx]?.points || [],
    touching(point, radius) {
      const ring = Math.max(1, Math.ceil(radius / index.cellSize));
      const best = new Map<number, { dist: number; angle: number }>();
      for (const contact of contactsAt(roadsNear(index, point.x, point.y, ring), point.x, point.y)) {
        if (contact.dist > radius || contact.ptIdx < 0) continue;
        const seen = best.get(contact.segIdx);
        if (!seen || contact.dist < seen.dist) best.set(contact.segIdx, { dist: contact.dist, angle: contact.angle });
      }
      return [...best].map(([segIdx, { angle }]) => ({ segIdx, angle }));
    },
  };
}
