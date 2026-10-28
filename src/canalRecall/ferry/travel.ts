import { BERTH_RADIUS, connectedTerminals, type FerryLink, type Point, type Segment, type Terminal } from './network';
import { meanAngle, nearCluster, nearestBerth, onPierEdge, PIER_EDGE_WATER_AHEAD, pierClusters, pierEdge } from './pierEdge';

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
export const DEPART_RADIUS = BERTH_RADIUS;
/** Within this radius of a pier the vessel has not yet left, the quay is passable (launching, turning out). */
export const PIER_APPROACH_RADIUS = 48;
/**
 * Docking on water: within this radius of any armed pier, moving towards it.
 * Was 6 m (18 px). Buiksloterweg (feedback 50ea10bf, 2026-10-25): the vessel
 * lay against the pontoon 15 m from the GTFS stop and never docked. The OSM
 * pontoon (way 294911777) spans 11-23 m from that stop.
 */
export const DOCK_RADIUS = 60; // 20 m
/**
 * Docking on touching land (the hull's centre or bow) within this radius of
 * any armed pier. The OSM pier outlines reach 23 m (Buiksloterweg), 37 m
 * (NDSM, way 588710849) and 48-51 m (Centraal, way 26726075, two stops) from
 * their stops; a touch anywhere along a pier's own pontoon or quay docks.
 * NDSM-werf (feedback 1d632c41): the vessel stood on the quay 24.7 m from the
 * stop, past the old 20.5 m quay radius. Was 16 m + half a hull.
 */
export const QUAY_DOCK_RADIUS = 111; // 37 m
/**
 * Hysteresis: a pier the vessel was within this radius of when boarding (its
 * own pier, and Centraal's other stop 40 m along the same quay) can only be
 * docked at after the vessel has been farther than this from it. It is larger
 * than both dock radii, so a launch never docks straight back.
 */
export const REARM_RADIUS = 150; // 50 m
/** Half-width of the passable corridor along a terminal access. */
export const ACCESS_CORRIDOR = 20;
/** 2026-10-25 (user): "ferry should go a little faster": 135 -> 180 (bike top speed is 260). */
export const FERRY_MAX_SPEED = 180;
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
  /** Piers not yet dockable on this crossing (REARM_RADIUS hysteresis). Absent: all are. */
  ferryUnarmed?: string[];
  /** The nearest dockable pier and its distance in px, for the aboard notice. */
  ferryNearest?: { name: string; distance: number } | null;
  ferryDestinations?: string;
  _bikeMaxSpeed?: number;
  _bikeSize?: { length: number; width: number };
}

export interface FerryTrack {
  segments: readonly Segment[];
  getNearestRoad(x: number, y: number, angle: number | null): { segIdx: number } | null;
  getSurface?(x: number, y: number): string;
  _ferryLinks?: FerryLink[];
  _ferryAccesses?: Segment[];
  _ferryPiers?: Terminal[][];
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

/** The terminal accesses (a dozen at most), cached on the track like its links. */
export function ferryAccessesOf(track: FerryTrack): Segment[] {
  return (track._ferryAccesses ||= track.segments.filter(s => s.type === 'ferry-access' && s.ferryTerminal));
}

/** The terminals grouped by the quay they share, cached on the track. */
export function ferryPiersOf(track: FerryTrack): Terminal[][] {
  return (track._ferryPiers ||= pierClusters(ferryAccessesOf(track).map(s => s.ferryTerminal!)));
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
  return { terminal, berth: launchBerth(water, player.angle, isWater) };
}

/**
 * Launch with the stern ramp at the quay rather than half the hull ashore:
 * move out along the heading by up to half a hull length while still afloat.
 */
function launchBerth(water: Point, angle: number, isWater: WaterTest): Point & { angle: number } {
  let berth = { x: water.x, y: water.y, angle };
  for (let d = 6; d <= FERRY_SIZE.length / 2; d += 6) {
    const x = water.x + Math.cos(angle) * d, y = water.y + Math.sin(angle) * d;
    if (!isWater(x, y)) break;
    berth = { x, y, angle };
  }
  return berth;
}

/**
 * Boarding anywhere along a ferry pier's edge (pierEdge.ts), not only at its
 * stops: the rider stands on the quay line through the pier's stops, heads
 * towards the water, and open water lies just ahead. The vessel belongs to the
 * nearest stop along the quay. Geometry is checked before any water probe.
 */
export function edgeBoarding(player: FerryPlayer, track: FerryTrack, isWater: WaterTest): Boarding | null {
  if (player.speed < 1) return null;
  for (const pier of ferryPiersOf(track)) {
    if (!nearCluster(pier, player)) continue;
    const edge = pierEdge(pier, meanAngle(pier.map(t => pierShore(t, isWater)?.angle)));
    if (!edge || !onPierEdge(edge, player)) continue;
    if (angleBetween(player.angle, Math.atan2(edge.normal.y, edge.normal.x)) > BOARD_HEADING_TOLERANCE) continue;
    let water: Point | null = null;
    for (let d = 0; d <= PIER_EDGE_WATER_AHEAD && !water; d += 3) {
      const x = player.x + Math.cos(player.angle) * d, y = player.y + Math.sin(player.angle) * d;
      if (isWater(x, y)) water = { x, y };
    }
    if (!water) continue;
    return { terminal: nearestBerth(edge, player), berth: launchBerth(water, player.angle, isWater) };
  }
  return null;
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
  player.ferryUnarmed = ferryTerminalsOf(links)
    .filter(t => t.id === terminal.id || Math.hypot(berth.x - t.x, berth.y - t.y) <= REARM_RADIUS).map(t => t.id);
  player.ferryNearest = null;
}

/** Every pier on the ferry network, once each. */
export function ferryTerminalsOf(links: readonly FerryLink[]): Terminal[] {
  const found = new Map<string, Terminal>();
  for (const link of links) { found.set(link.from.id, link.from); found.set(link.to.id, link.to); }
  return [...found.values()];
}

/** Back on the bike at the pier's land access (GTFS stops can be offshore). */
export function disembark(player: FerryPlayer, pier: Terminal): void {
  player.ferryOrigin = null;
  player.ferryDeparted = false;
  player.ferryUnarmed = undefined;
  player.ferryNearest = null;
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
  // Every pier in reach, not only the nearest road's: at Centraal F3 a quay
  // cycleway passes 1.6 m from the stop, and the heading-aware nearest-road
  // lookup chose it over the 3 m access, so a rider 0.9 m from the stop and
  // facing the water stayed on the bike (feedback 05a7d02a, 2026-10-23).
  for (const access of ferryAccessesOf(game.track)) {
    const boarding = boardingTerminal(player, access, isWater);
    if (!boarding) continue;
    board(player, boarding, links);
    return true;
  }
  const boarding = edgeBoarding(player, game.track, isWater);
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

/**
 * The hull's leading edge in the direction it just moved: the bow centre and
 * its two corners (inset a little, the IJveer bow is rounded), or the stern
 * when reversing. Null when the vessel did not move.
 */
export function leadingEdge(p: FerryPlayer, previous: Point): Point[] | null {
  const mx = p.x - previous.x, my = p.y - previous.y;
  if (Math.abs(mx) + Math.abs(my) < 1e-6) return null;
  const hx = Math.cos(p.angle), hy = Math.sin(p.angle);
  const ahead = (mx * hx + my * hy >= 0 ? 1 : -1) * (p.length || FERRY_SIZE.length) / 2;
  const side = 0.8 * (p.width || FERRY_SIZE.width) / 2;
  const bx = p.x + hx * ahead, by = p.y + hy * ahead;
  return [{ x: bx, y: by }, { x: bx - hy * side, y: by + hx * side }, { x: bx + hy * side, y: by - hx * side }];
}

/** Degrees the heading eases away from the shore when one bow corner grazes it. */
const GRAZE_TURN = (4 * Math.PI) / 180;

/**
 * Called after the vehicle moved: dock, or keep the hull on water.
 *
 * The vessel docks at any ferry pier, not only its line's destinations
 * (feedback 50ea10bf, 2026-10-25: "we should be more lenient with the
 * ferry"): within DOCK_RADIUS on water while heading in, or on touching land
 * within QUAY_DOCK_RADIUS. Piers close to the boarding point re-arm only past
 * REARM_RADIUS. Elsewhere the hull's centre and leading edge must stay on
 * water (feedback f80d47da, "boat tears through the ground"); a single bow
 * corner on land glances off instead of stopping dead.
 */
export function afterFerryMove(game: FerryGame, previous: Point, isWater: WaterTest): FerryMoveResult {
  const p = game.player, origin = p.ferryOrigin;
  if (!origin) return 'ashore';
  const links = ferryLinksOf(game.track);
  if (Math.hypot(p.x - origin.x, p.y - origin.y) > DEPART_RADIUS) p.ferryDeparted = true;
  const terminals = ferryTerminalsOf(links);
  if (!terminals.some(t => t.id === origin.id)) terminals.push(origin);
  const distance = (t: Terminal) => Math.hypot(p.x - t.x, p.y - t.y);
  if (p.ferryUnarmed?.length) p.ferryUnarmed = p.ferryUnarmed.filter(id => {
    const t = terminals.find(u => u.id === id);
    return !!t && distance(t) <= REARM_RADIUS;
  });
  const unarmed = new Set(p.ferryUnarmed || []);
  // Legacy callers (and the e2e) mark only ferryDeparted.
  if (p.ferryDeparted && p.ferryUnarmed === undefined) unarmed.delete(origin.id);
  else if (!p.ferryDeparted && p.ferryUnarmed === undefined) unarmed.add(origin.id);
  const armed = terminals.filter(t => !unarmed.has(t.id));
  const nearest = armed.reduce<Terminal | null>((best, t) => (!best || distance(t) < distance(best) ? t : best), null);
  p.ferryNearest = nearest ? { name: nearest.name, distance: distance(nearest) } : null;

  const centreWet = isWater(p.x, p.y);
  const edge = leadingEdge(p, previous);
  const edgeWet = edge ? edge.map(q => isWater(q.x, q.y)) : [true, true, true];
  const touching = !centreWet || edgeWet.some(w => !w);
  if (nearest) {
    const d = distance(nearest);
    const mx = p.x - previous.x, my = p.y - previous.y;
    const towards = mx * (nearest.x - previous.x) + my * (nearest.y - previous.y)
      + mx * (nearest.land.x - previous.x) + my * (nearest.land.y - previous.y);
    if ((touching && d <= QUAY_DOCK_RADIUS) || (d <= DOCK_RADIUS && towards > 0)) {
      disembark(p, nearest);
      return 'docked';
    }
  }
  // Leaving a pier not yet re-armed (launching, turning out): the old corridor rule, centre only.
  const leaving = terminals.some(t => unarmed.has(t.id) && (distance(t) < PIER_APPROACH_RADIUS || nearAccess(p, t)));
  if (leaving || !touching) return 'sailing';
  const grazed = centreWet && edgeWet[0] && edgeWet[1] !== edgeWet[2];
  const forward = (p.x - previous.x) * Math.cos(p.angle) + (p.y - previous.y) * Math.sin(p.angle) >= 0 ? 1 : -1;
  p.x = previous.x; p.y = previous.y;
  if (grazed) {
    // Screen space has y down, so corner 1 is to starboard and a growing
    // angle turns the bow to starboard (and swings the stern to port).
    // Turn the leading end away from whichever corner touched.
    p.angle += (edgeWet[1] ? 1 : -1) * forward * GRAZE_TURN;
    p.speed *= 0.6;
    p.vx = Math.cos(p.angle) * p.speed; p.vy = Math.sin(p.angle) * p.speed;
    return 'blocked';
  }
  p.speed = 0; p.vx = 0; p.vy = 0;
  return 'blocked';
}
