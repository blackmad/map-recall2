import { connectedTerminals, type FerryLink, type Point, type Segment, type Terminal } from './network';

/**
 * Boarding, sailing and docking for the cycling IJ ferries. Cycling stays the
 * selected trip mode; only the vehicle changes at a pier. The legacy game loop
 * reaches this through the small `CanalRecallFerryTravel` adapter.
 *
 * Distances are game pixels (3 px per metre).
 */

/** The rider must reach the end of the terminal access (its half-width), not merely the ramp. */
export const BOARD_RADIUS = 9;
/**
 * GTFS ferry stops sit on the quay edge as often as over the rendered water,
 * and the access towards the nearest street can run along the quay (Centraal
 * F3 on 2026-10-09: water 5 m to the side, none within 50 m straight along
 * the access). Boarding therefore finds the nearest open water within this
 * radius of the pier and launches the vessel there.
 */
export const BOARD_WATER_RADIUS = 90;
/**
 * The rider must be heading this close to the shoreline normal (the direction
 * of that nearest water). A rider passing a quay-edge pier parallel to the
 * water (90 degrees off) keeps cycling; turning towards the water boards.
 */
export const BOARD_HEADING_TOLERANCE = (60 * Math.PI) / 180;
/** The vessel has left its own pier once it is this far from it. */
export const DEPART_RADIUS = 90;
/** Within this radius of an allowed pier the quay is passable for the vessel. */
export const PIER_APPROACH_RADIUS = 48;
/** Docking happens within this radius of the pier, or on touching its quay within the approach radius. */
export const DOCK_RADIUS = 18;
/** Half-width of the passable corridor along a terminal access. */
export const ACCESS_CORRIDOR = 20;
export const FERRY_MAX_SPEED = 135;
/** About 33 m long and 9 m wide, like the IJveer 60 model. */
export const FERRY_SIZE = { length: 96, width: 27 } as const;

export interface FerryPlayer extends Point {
  angle: number;
  speed: number;
  vx: number;
  vy: number;
  maxSpeed: number;
  length: number;
  width: number;
  isBoat?: boolean;
  ferryOrigin?: Terminal | null;
  ferryDeparted?: boolean;
  ferryDestinations?: string;
  _bikeMaxSpeed?: number;
  _bikeSize?: { length: number; width: number };
}

export interface FerryTrack {
  segments: readonly Segment[];
  getNearestRoad(x: number, y: number, angle: number | null): { segIdx: number } | null;
  getSurface?(x: number, y: number): string;
  _ferryLinks?: FerryLink[];
}

export interface FerryGame {
  travelMode: string;
  player: FerryPlayer;
  track: FerryTrack;
}

export type WaterTest = (x: number, y: number) => boolean;

export function ferryLinksOf(track: FerryTrack): FerryLink[] {
  return (track._ferryLinks ||= track.segments.flatMap(s => (s.ferryLink ? [s.ferryLink] : [])));
}

export type Shore = Point & { angle: number | null; distance: number };

const angleBetween = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/**
 * The nearest open water to `point` within `radius`, on rings of increasing
 * radius with 32 directions each. On the first ring that touches water the
 * direction is the circular mean of its wet directions, so it approximates
 * the shoreline normal rather than whichever direction was tried first.
 * `angle` is null when `point` itself is water.
 */
export function nearestWater(point: Point, isWater: WaterTest, radius = BOARD_WATER_RADIUS): Shore | null {
  if (isWater(point.x, point.y)) return { x: point.x, y: point.y, angle: null, distance: 0 };
  for (let r = 3; r <= radius; r += 3) {
    let sx = 0, sy = 0, first: Shore | null = null;
    for (let k = 0; k < 32; k++) {
      const a = (k * Math.PI) / 16 - Math.PI;
      const x = point.x + Math.cos(a) * r, y = point.y + Math.sin(a) * r;
      if (!isWater(x, y)) continue;
      sx += Math.cos(a); sy += Math.sin(a);
      first ||= { x, y, angle: a, distance: r };
    }
    if (!first) continue;
    const mean = Math.atan2(sy, sx);
    const x = point.x + Math.cos(mean) * r, y = point.y + Math.sin(mean) * r;
    return isWater(x, y) ? { x, y, angle: mean, distance: r } : first;
  }
  return null;
}

/**
 * The water geometry is static but the mask is rendered, so it only exists
 * around the camera. Remember a found shore per pier; retry a miss only every
 * SHORE_RETRY_FRAMES so a rider waiting at a dry pier costs no hitch.
 */
const SHORE_RETRY_FRAMES = 30;
const shores = new WeakMap<Terminal, { water: Shore | null; wait: number }>();
export function pierShore(terminal: Terminal, isWater: WaterTest): Shore | null {
  const cached = shores.get(terminal);
  if (cached?.water) return cached.water;
  if (cached && cached.wait-- > 0) return null;
  const water = nearestWater(terminal, isWater);
  shores.set(terminal, { water, wait: SHORE_RETRY_FRAMES });
  return water;
}

export type Boarding = { terminal: Terminal; berth: Point & { angle: number } };

/** The terminal this rider boards at this frame, and where the vessel is launched. */
export function boardingTerminal(player: FerryPlayer, access: Segment | undefined, isWater: WaterTest): Boarding | null {
  const terminal = access?.type === 'ferry-access' ? access.ferryTerminal : undefined;
  if (!terminal || player.speed < 1) return null;
  if (Math.hypot(player.x - terminal.x, player.y - terminal.y) > BOARD_RADIUS) return null;
  // Not when riding back off the pier towards the street.
  const dx = terminal.x - terminal.land.x, dy = terminal.y - terminal.land.y;
  const along = Math.hypot(dx, dy);
  if (along > BOARD_RADIUS && dx * Math.cos(player.angle) + dy * Math.sin(player.angle) < 0) return null;
  const water = pierShore(terminal, isWater);
  if (!water) return null;
  if (water.angle !== null && angleBetween(player.angle, water.angle) > BOARD_HEADING_TOLERANCE) return null;
  // Launch with the stern ramp at the quay rather than half the hull ashore:
  // move out along the heading by up to half a hull length while still afloat.
  let berth = { x: water.x, y: water.y, angle: player.angle };
  for (let d = 6; d <= FERRY_SIZE.length / 2; d += 6) {
    const x = water.x + Math.cos(player.angle) * d, y = water.y + Math.sin(player.angle) * d;
    if (!isWater(x, y)) break;
    berth = { x, y, angle: player.angle };
  }
  return { terminal, berth };
}

export function board(player: FerryPlayer, boarding: Boarding, links: readonly FerryLink[]): void {
  const { terminal, berth } = boarding;
  player.ferryOrigin = terminal;
  player.ferryDeparted = false;
  player.isBoat = true;
  player._bikeMaxSpeed = player.maxSpeed;
  player.maxSpeed = Math.min(player.maxSpeed, FERRY_MAX_SPEED);
  player._bikeSize = { length: player.length, width: player.width };
  player.length = FERRY_SIZE.length;
  player.width = FERRY_SIZE.width;
  player.x = berth.x;
  player.y = berth.y;
  player.angle = berth.angle;
  player.vx = Math.cos(berth.angle) * player.speed;
  player.vy = Math.sin(berth.angle) * player.speed;
  player.ferryDestinations = connectedTerminals(terminal.id, links).map(t => t.name).join(' or ');
}

/** Back on the bike at the pier's land access (GTFS stops can be offshore). */
export function disembark(player: FerryPlayer, pier: Terminal): void {
  player.ferryOrigin = null;
  player.ferryDeparted = false;
  player.isBoat = false;
  if (player._bikeMaxSpeed !== undefined) player.maxSpeed = player._bikeMaxSpeed;
  if (player._bikeSize) Object.assign(player, player._bikeSize);
  player.ferryDestinations = '';
  const dx = pier.land.x - pier.x, dy = pier.land.y - pier.y;
  player.x = pier.land.x;
  player.y = pier.land.y;
  player.angle = Math.atan2(dy, dx);
  player.speed = 0; player.vx = 0; player.vy = 0;
}

/** Called before the vehicle moves. Returns true while the rider is aboard. */
export function beginFerryFrame(game: FerryGame, isWater: WaterTest): boolean {
  const player = game.player;
  if (game.travelMode !== 'car') return false;
  if (player.ferryOrigin) return true;
  const links = ferryLinksOf(game.track);
  if (!links.length) return false;
  const road = game.track.getNearestRoad(player.x, player.y, player.angle);
  const boarding = road ? boardingTerminal(player, game.track.segments[road.segIdx], isWater) : null;
  if (!boarding) return false;
  board(player, boarding, links);
  return true;
}

/** Free steering on water: no street-heading assistance towards the nearest bank. */
export function ferryMotionTrack<T extends FerryTrack>(track: T): T {
  const water = Object.create(track) as T;
  water.getSurface = () => 'asphalt';
  water.getNearestRoad = () => null;
  return water;
}

function nearAccess(point: Point, t: Terminal): boolean {
  const dx = t.x - t.land.x, dy = t.y - t.land.y;
  const u = Math.max(0, Math.min(1, ((point.x - t.land.x) * dx + (point.y - t.land.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point.x - t.land.x - u * dx, point.y - t.land.y - u * dy) <= ACCESS_CORRIDOR;
}

export type FerryMoveResult = 'sailing' | 'blocked' | 'docked' | 'ashore';

/** Called after the vehicle moved: dock, or keep the vessel on water/pier access. */
export function afterFerryMove(game: FerryGame, previous: Point, isWater: WaterTest): FerryMoveResult {
  const p = game.player, origin = p.ferryOrigin;
  if (!origin) return 'ashore';
  const links = ferryLinksOf(game.track);
  if (Math.hypot(p.x - origin.x, p.y - origin.y) > DEPART_RADIUS) p.ferryDeparted = true;
  const allowed = [origin, ...connectedTerminals(origin.id, links)];
  const onWater = isWater(p.x, p.y);
  if (p.ferryDeparted) {
    // Dock on reaching the pier, or on touching the quay beside it.
    const pier = allowed.find(t => {
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      return d <= DOCK_RADIUS || (!onWater && d < PIER_APPROACH_RADIUS);
    });
    if (pier) {
      const mx = p.x - previous.x, my = p.y - previous.y;
      const towards = mx * (pier.x - previous.x) + my * (pier.y - previous.y)
        + mx * (pier.land.x - previous.x) + my * (pier.land.y - previous.y);
      if (towards > 0) {
        disembark(p, pier);
        return 'docked';
      }
    }
  }
  const pierAccess = allowed.some(t => Math.hypot(p.x - t.x, p.y - t.y) < PIER_APPROACH_RADIUS || nearAccess(p, t));
  if (!pierAccess && !onWater) {
    p.x = previous.x; p.y = previous.y;
    p.speed = 0; p.vx = 0; p.vy = 0;
    return 'blocked';
  }
  return 'sailing';
}
