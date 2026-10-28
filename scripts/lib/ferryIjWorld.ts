/**
 * The western IJ as the ferry runtime sees it, for named regressions: the GVB
 * ferry terminals and links built by the real `ferrySegments` from the
 * transit extract, and a water test from OSM water polygons
 * (scripts/fixtures/ferry-water-ij.json, built by
 * scripts/fixtures/build-ferry-water-ij.mjs). World units are game pixels,
 * 3 per metre, about the game's fixed origin.
 */
import { readFileSync } from 'node:fs';
import { ferrySegments, type FerryLink, type Point, type Segment, type Terminal } from '../../src/canalRecall/ferry/network';
import type { TransitNetwork } from '../../src/canalRecall/transit/network';
import type { FerryGame, FerryMoveResult, FerryPlayer } from '../../src/canalRecall/ferry/travel';

export const PX_PER_M = 3;
/** The world origin the 2026-10-25 feedback positions decode to (camera vs mapCenter). */
const ORIGIN = { lat: 52.355861, lon: 4.8995 };
const KY = 111_320, KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180);

export const toWorld = (lat: number, lon: number): Point => ({ x: (lon - ORIGIN.lon) * KX * PX_PER_M, y: -(lat - ORIGIN.lat) * KY * PX_PER_M });
export const toLatLon = (p: Point): [number, number] => [ORIGIN.lat - p.y / (KY * PX_PER_M), ORIGIN.lon + p.x / (KX * PX_PER_M)];

type Ring = Array<[number, number]>;
type Fixture = { areas: Record<string, { polygons: Array<{ osm: string; rings: Ring[] }> }> };

function inRing(ring: Ring, lat: number, lon: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ay, ax] = ring[i], [by, bx] = ring[j];
    if ((ay > lat) !== (by > lat) && lon < (bx - ax) * (lat - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function ijWaterTest(fixturePath = 'scripts/fixtures/ferry-water-ij.json'): (x: number, y: number) => boolean {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Fixture;
  const polygons = Object.values(fixture.areas).flatMap(a => a.polygons).map(p => {
    const lats = p.rings[0].map(q => q[0]), lons = p.rings[0].map(q => q[1]);
    return { ...p, box: [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)] };
  });
  return (x, y) => {
    const [lat, lon] = toLatLon({ x, y });
    return polygons.some(p => lat >= p.box[0] && lat <= p.box[2] && lon >= p.box[1] && lon <= p.box[3]
      && inRing(p.rings[0], lat, lon) && !p.rings.slice(1).some(h => inRing(h, lat, lon)));
  };
}

type RoutingStreet = { highway?: string; path?: Array<[number, number]>; paths?: Array<Array<[number, number]>> };

/** Terminals and links exactly as the game builds them, land accesses snapped to routed streets. */
export function ijFerryWorld(): { segments: Segment[]; links: FerryLink[]; terminals: Map<string, Terminal> } {
  const network = JSON.parse(readFileSync('public/data/extracts/amsterdam/transit-network.json', 'utf8')) as TransitNetwork;
  const routing = JSON.parse(readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as RoutingStreet[];
  const land: Segment[] = [];
  for (const street of routing) for (const path of street.paths ?? (street.path ? [street.path] : [])) {
    if (path.length < 2 || !path.some(([lat, lon]) => lat > 52.374 && lat < 52.41 && lon > 4.87 && lon < 4.93)) continue;
    land.push({ points: path.map(([lat, lon]) => toWorld(lat, lon)), width: 18, type: street.highway || 'residential', name: '' });
  }
  const segments = ferrySegments(network, land, toWorld);
  const links = segments.flatMap(s => (s.ferryLink ? [s.ferryLink] : []));
  const terminals = new Map(links.flatMap(l => [l.from, l.to]).map(t => [t.id, t]));
  return { segments, links, terminals };
}

type FerryRuntime = {
  afterFerryMove(game: FerryGame, previous: Point, isWater: (x: number, y: number) => boolean): FerryMoveResult;
  leadingEdge?(p: FerryPlayer, previous: Point): Point[] | null;
};

export type Voyage = {
  result: 'docked' | 'stalled' | 'sailing';
  dockedAt: string | null;
  frames: number;
  blockedFrames: number;
  /** Frames on which the hull's centre or bow ended the frame on land while still aboard. */
  aground: number;
  /** Distance to the nearest terminal when the voyage ended, metres. */
  endMetres: number;
  end: Point;
};

/**
 * Sail aboard a vessel from `origin`, steering at each frame towards the next
 * of `waypoints` (the rider holding forward and pointing the bow), 180 px/s at
 * 60 fps, until it docks, stalls (2 s without progress), or runs out.
 */
export function sail(runtime: FerryRuntime, world: ReturnType<typeof ijFerryWorld>, isWater: (x: number, y: number) => boolean,
  origin: Terminal, start: Point & { ferryUnarmed?: string[] }, waypoints: Point[], options: { maxFrames?: number; speed?: number } = {}): Voyage {
  const speed = options.speed ?? 180, dt = 1 / 60;
  const player: FerryPlayer = {
    x: start.x, y: start.y, angle: Math.atan2(waypoints[0].y - start.y, waypoints[0].x - start.x), speed, vx: 0, vy: 0,
    maxSpeed: 180, length: 96, width: 27, isBoat: true, ferryOrigin: origin,
    // A vessel just boarded keeps its re-arm state; one placed mid-crossing has left its pier.
    ...(start.ferryUnarmed ? { ferryUnarmed: [...start.ferryUnarmed], ferryDeparted: false } : { ferryDeparted: true }),
  };
  const game: FerryGame = { travelMode: 'car', player, track: { segments: world.segments, getNearestRoad: () => null } };
  const bow = (p: FerryPlayer) => [{ x: p.x + Math.cos(p.angle) * 48, y: p.y + Math.sin(p.angle) * 48 }];
  let target = 0, blockedFrames = 0, aground = 0, still = 0, frames = 0;
  const maxFrames = options.maxFrames ?? 60 * 120;
  for (; frames < maxFrames; frames++) {
    while (target < waypoints.length - 1 && Math.hypot(waypoints[target].x - player.x, waypoints[target].y - player.y) < 15) target++;
    const w = waypoints[target];
    player.angle = Math.atan2(w.y - player.y, w.x - player.x);
    player.speed = Math.max(player.speed, Math.min(speed, player.speed + 6));
    if (player.speed < 20) player.speed = 20; // the rider keeps the throttle open
    const previous = { x: player.x, y: player.y };
    player.x += Math.cos(player.angle) * player.speed * dt;
    player.y += Math.sin(player.angle) * player.speed * dt;
    const result = runtime.afterFerryMove(game, previous, isWater);
    if (result === 'docked') {
      const t = [...world.terminals.values()].reduce((a, b) => (Math.hypot(a.land.x - player.x, a.land.y - player.y) < Math.hypot(b.land.x - player.x, b.land.y - player.y) ? a : b));
      return { result: 'docked', dockedAt: t.name, frames, blockedFrames, aground, endMetres: 0, end: { ...player } };
    }
    if (result === 'blocked') { blockedFrames++; still++; } else still = 0;
    const edge = runtime.leadingEdge ? runtime.leadingEdge(player, previous) ?? [] : bow(player);
    if (!isWater(player.x, player.y) || edge.some(q => !isWater(q.x, q.y))) aground++;
    if (still > 120) break;
    if (target === waypoints.length - 1 && Math.hypot(w.x - player.x, w.y - player.y) < 2) break;
  }
  const nearest = Math.min(...[...world.terminals.values()].map(t => Math.hypot(t.x - player.x, t.y - player.y))) / PX_PER_M;
  return { result: still > 120 ? 'stalled' : 'sailing', dockedAt: null, frames, blockedFrames, aground, endMetres: nearest, end: { ...player } };
}
