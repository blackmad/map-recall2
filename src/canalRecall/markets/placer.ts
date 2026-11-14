/**
 * Market placer (lane markets-20261114): measured market lines → stall and van instances. Pure, deterministic.
 *
 * Input is scripts/data/markets/market-lines.json (scripts/markets/build-lines.ts): per market and per side a KERB
 * line (the edge of the strip the stalls stand on, on the side of the aisle: Albert Cuypstraat's carriageway edge from
 * BGT, Ten Katestraat's measured clear centre aisle), the usable strip depth, and RUNS: stretches of that line, in
 * metres along it, where the strip is unbroken (crossings, side streets, entrances and trees are already cut out).
 *
 * Every stall's front posts stand FRONT_SETBACK_M behind the kerb, so the roof's overhang (STALL.overhang) still ends
 * ROOF_CLEAR_M short of it: the carriageway, bike lane and aisle stay clear and the rider passes.
 */
import { GOODS_KINDS, STALL, VAN, goodsPart, type GoodsKind, type MarketPartId } from './stallKit.js';

export type LngLat = [number, number];
export type Weekday = 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa' | 'Su';
export const WEEKDAYS: readonly Weekday[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export type MarketSide = {
  /** Which side of the street (compass word for captions and reports). */
  side: string;
  /** The aisle-side edge of the stall strip, ordered along the street (lng, lat). */
  kerb: LngLat[];
  /** +1: the aisle lies to the LEFT of the kerb line's direction (stalls stand to its right); -1 the reverse. */
  aisle: 1 | -1;
  /** Usable strip depth behind the kerb (m), the narrowest of the measured stations in the runs. */
  depthM: number;
  /** Unbroken stretches [s0, s1] in metres along `kerb`. */
  runs: [number, number][];
  /** Vans / food trucks at the start of the first run and/or the end of the last. */
  vans?: ('start' | 'end')[];
};

export type MarketLine = {
  id: string;
  name: string;
  /** Opening hours per weekday from the Gemeente Amsterdam markets register ([open, close] hours, local); absent: closed. */
  hours: Partial<Record<Weekday, [number, number]>>;
  palette: MarketPaletteId;
  sides: MarketSide[];
};

export type MarketLinesFile = { version: 1; generated?: string; sources: string[]; markets: MarketLine[] };

export type MarketInstance = { part: MarketPartId; lng: number; lat: number; yaw: number; colour: string | null; stall: string };
export type PlacedStall = { id: string; market: string; side: string; s: number; goods: GoodsKind | 'van'; roof: 'plain' | 'striped' | null; colour: string };

/** Clearance between the roof's front edge and the kerb line (m). */
export const ROOF_CLEAR_M = 0.3;
export const FRONT_SETBACK_M = STALL.overhang + ROOF_CLEAR_M;
/** Gap between neighbouring frames (they nearly touch in the panoramas), and a walk-through every PASSAGE_EVERY stalls. */
export const STALL_GAP_M = 0.3, PASSAGE_M = 1.6, PASSAGE_EVERY = 6;
/** The strip must hold the whole frame behind the setback. */
export const MIN_DEPTH_M = FRONT_SETBACK_M + STALL.depth;

export type RoofSwatch = { hex: string; striped: boolean; weight: number };
export type MarketPaletteId = 'cuyp' | 'tenkate';
/**
 * Canvas tones and goods mix per market. Cuyp (2020-01-06, 2021-04-23, 2022-03-21 captures): mostly white and off-white
 * canvas, some red and red-and-white, the odd blue, yellow (the "kleinvakman" stall) or green-striped awning. Ten Kate
 * (2024-12-11, 2025-07-31): lime-green and dark-green canopies among white ones, produce-heavy.
 */
export const MARKET_PALETTES: Readonly<Record<MarketPaletteId, { roofs: readonly RoofSwatch[]; goods: Readonly<Record<GoodsKind, number>>; vans: readonly string[] }>> = {
  cuyp: {
    roofs: [
      { hex: '#ebe8df', striped: false, weight: 42 }, { hex: '#d8d2c2', striped: false, weight: 16 }, { hex: '#b9bcbc', striped: false, weight: 8 },
      { hex: '#c0392f', striped: true, weight: 10 }, { hex: '#b8322a', striped: false, weight: 6 }, { hex: '#2f5e9e', striped: true, weight: 5 },
      { hex: '#e0bf2a', striped: false, weight: 5 }, { hex: '#3d7a45', striped: true, weight: 4 }, { hex: '#3d6b9e', striped: false, weight: 4 },
    ],
    goods: { produce: 28, fabric: 24, general: 26, fish: 5, cheese: 10, flowers: 7 },
    vans: ['#e8e8e4', '#e8e8e4', '#7a5636', '#b8322a'],
  },
  tenkate: {
    roofs: [
      { hex: '#ebe8df', striped: false, weight: 42 }, { hex: '#8cb43a', striped: false, weight: 24 }, { hex: '#2f6b3a', striped: false, weight: 14 },
      { hex: '#3f8a45', striped: true, weight: 12 }, { hex: '#c0392f', striped: true, weight: 8 },
    ],
    goods: { produce: 45, fish: 10, flowers: 12, fabric: 13, general: 15, cheese: 5 },
    vans: ['#e8e8e4', '#e2c22e'],
  },
};

export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function weighted<T>(items: readonly T[], weight: (t: T) => number, u: number): T {
  const total = items.reduce((a, t) => a + weight(t), 0);
  let x = u * total;
  for (const t of items) { x -= weight(t); if (x < 0) return t; }
  return items[items.length - 1];
}

const RAD = Math.PI / 180;
const KX = (lat: number): number => 111320 * Math.cos(lat * RAD), KY = 110540;

/** A polyline in local metres (east, north) about its first point, with cumulative lengths. */
export function localLine(line: readonly LngLat[]): { pts: [number, number][]; cum: number[]; lng0: number; lat0: number } {
  const [lng0, lat0] = line[0], kx = KX(lat0);
  const pts = line.map(([x, y]) => [(x - lng0) * kx, (y - lat0) * KY] as [number, number]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, lng0, lat0 };
}

/** Point and unit tangent at arc length s (clamped). */
export function pointAt(l: ReturnType<typeof localLine>, s: number): { x: number; y: number; tx: number; ty: number } {
  const { pts, cum } = l;
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, t = Math.min(1, Math.max(0, (s - cum[i - 1]) / seg));
  const tx = (b[0] - a[0]) / seg, ty = (b[1] - a[1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx, ty };
}

/** Stall centres (s along the run) for a run [s0, s1]: frames STALL_GAP_M apart with a passage every PASSAGE_EVERY. */
export function stallSlots(s0: number, s1: number, reserveStart = 0, reserveEnd = 0): number[] {
  const a = s0 + reserveStart, b = s1 - reserveEnd, len = b - a, pitch = STALL.length + STALL_GAP_M;
  if (len < STALL.length) return [];
  // Count the stalls that fit with the passages, then centre the slack.
  let n = 0, used: number = STALL.length;
  while (true) {
    const next = used + pitch + ((n + 1) % PASSAGE_EVERY === 0 ? PASSAGE_M : 0);
    if (next > len) break;
    used = next; n++;
  }
  const out: number[] = [];
  let s = a + (len - used) / 2 + STALL.length / 2;
  for (let k = 0; k <= n; k++) {
    out.push(s);
    s += pitch + ((k + 1) % PASSAGE_EVERY === 0 ? PASSAGE_M : 0);
  }
  return out;
}

/** Room a van takes at a run end (its length plus a gap to the first stall). */
export const VAN_SLOT_M = VAN.length + 0.8;

/**
 * Lay out one market: per side and run, stalls along the kerb, each facing the aisle; vans at the requested run ends.
 * Returns the draw instances (frame + roof + goods per stall, one per van) and a record per stall for reports.
 */
export function placeMarket(m: MarketLine): { instances: MarketInstance[]; stalls: PlacedStall[] } {
  const P = MARKET_PALETTES[m.palette], instances: MarketInstance[] = [], stalls: PlacedStall[] = [];
  for (const side of m.sides) {
    if (side.depthM < MIN_DEPTH_M || side.kerb.length < 2) continue;
    const line = localLine(side.kerb), kx = KX(line.lat0);
    const toLngLat = (x: number, y: number): LngLat => [line.lng0 + x / kx, line.lat0 + y / KY];
    /** Local frame at s: origin `off` metres behind the kerb (away from the aisle); yaw turns the model's +y to the aisle. */
    const frameAt = (s: number, off: number) => {
      const p = pointAt(line, s), nx = -p.ty * side.aisle, ny = p.tx * side.aisle; // unit normal toward the aisle
      const [lng, lat] = toLngLat(p.x - nx * off, p.y - ny * off);
      const bearing = Math.atan2(nx, ny); // compass bearing (rad) of the aisle direction
      return { lng, lat, yaw: -bearing };
    };
    let prev: { roof: RoofSwatch; goods: GoodsKind } | null = null;
    side.runs.forEach(([s0, s1], ri) => {
      const vanStart = ri === 0 && side.vans?.includes('start'), vanEnd = ri === side.runs.length - 1 && side.vans?.includes('end');
      for (const [want, at] of [[vanStart, s0 + VAN.length / 2], [vanEnd, s1 - VAN.length / 2]] as const) {
        if (!want || s1 - s0 < VAN_SLOT_M) continue;
        const id = `${m.id}/${side.side}/van@${at.toFixed(1)}`, f = frameAt(at, FRONT_SETBACK_M + VAN.width / 2);
        const colour = P.vans[Math.floor(hash01(id) * P.vans.length)];
        // The van's +y side carries the serving hatch: it faces the aisle like the stalls.
        instances.push({ part: 'van', lng: f.lng, lat: f.lat, yaw: f.yaw, colour, stall: id });
        stalls.push({ id, market: m.id, side: side.side, s: at, goods: 'van', roof: null, colour });
      }
      const slots = stallSlots(s0, s1, vanStart && s1 - s0 >= VAN_SLOT_M ? VAN_SLOT_M : 0, vanEnd && s1 - s0 >= VAN_SLOT_M ? VAN_SLOT_M : 0);
      for (const s of slots) {
        const id = `${m.id}/${side.side}/${s.toFixed(1)}`, u = hash01(id);
        // One trader often runs two frames side by side: a quarter of stalls repeat their neighbour's canvas and goods.
        const pick = prev && hash01(`${id}:pair`) < 0.25 ? prev : {
          roof: weighted(P.roofs, r => r.weight, u),
          goods: weighted(GOODS_KINDS, g => P.goods[g], hash01(`${id}:goods`)),
        };
        prev = pick;
        const f = frameAt(s, FRONT_SETBACK_M);
        instances.push({ part: 'stall-frame', lng: f.lng, lat: f.lat, yaw: f.yaw, colour: null, stall: id });
        instances.push({ part: pick.roof.striped ? 'roof-striped' : 'roof-plain', lng: f.lng, lat: f.lat, yaw: f.yaw, colour: pick.roof.hex, stall: id });
        const goodsTone = pick.goods === 'general' ? ['#c9a227', '#2f5e9e', '#b8322a', '#6a4a7c', '#3d6b5a'][Math.floor(hash01(`${id}:tone`) * 5)] : null;
        instances.push({ part: goodsPart(pick.goods), lng: f.lng, lat: f.lat, yaw: f.yaw, colour: goodsTone, stall: id });
        stalls.push({ id, market: m.id, side: side.side, s, goods: pick.goods, roof: pick.roof.striped ? 'striped' : 'plain', colour: pick.roof.hex });
      }
    });
  }
  return { instances, stalls };
}

/** Footprint corners (lng/lat) of a stall instance, front roof edge included: for clearance checks. */
export function stallFootprint(i: Pick<MarketInstance, 'lng' | 'lat' | 'yaw'>): LngLat[] {
  const kx = KX(i.lat), c = Math.cos(i.yaw), s = Math.sin(i.yaw), L = STALL.length / 2;
  const local: [number, number][] = [[-L, STALL.overhang], [L, STALL.overhang], [L, -STALL.depth], [-L, -STALL.depth]];
  return local.map(([x, y]) => [i.lng + (x * c - y * s) / kx, i.lat + (x * s + y * c) / KY]);
}

/** Weekday and hour in Amsterdam for a date (the game has no clock or weekday of its own). */
export function amsterdamClock(date: Date): { day: Weekday; hour: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const day = ({ Sun: 'Su', Mon: 'Mo', Tue: 'Tu', Wed: 'We', Thu: 'Th', Fri: 'Fr', Sat: 'Sa' } as Record<string, Weekday>)[get('weekday')] ?? 'Mo';
  return { day, hour: Number(get('hour')) + Number(get('minute')) / 60 };
}

/** Whether the register says the market trades at `date` (Amsterdam time). Not used by default: see marketLayer.ts. */
export function marketOpenAt(m: Pick<MarketLine, 'hours'>, date: Date): boolean {
  const { day, hour } = amsterdamClock(date), h = m.hours[day];
  return !!h && hour >= h[0] && hour < h[1];
}

export const placeAll = (file: MarketLinesFile): { instances: MarketInstance[]; stalls: PlacedStall[] } => {
  const instances: MarketInstance[] = [], stalls: PlacedStall[] = [];
  for (const m of file.markets) { const r = placeMarket(m); instances.push(...r.instances); stalls.push(...r.stalls); }
  return { instances, stalls };
};
