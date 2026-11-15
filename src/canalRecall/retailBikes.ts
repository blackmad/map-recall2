// Bike shops (lane retail-look round 6, `?retailGround=1`, the `bike` template): what stands outside and what is in the
// window, guessed from the shop's OSM tags (David, 2026-11-15: "used bikes parked outside and fancy bikes in the
// window", not every shop has both). Pure: build-templates.ts classifies and stages the class per pand; retailFront.ts
// draws the bikes.
//
// The rule (BIKE_RULE, in order; the first that matches):
//   1. rental: a rental fleet's front (amenity=bicycle_rental, rental=*, a known fleet: MacBike, Yellow Bike, Black
//      Bikes, Swapfiets...), or a rental name or service:bicycle:rental=yes with neither second-hand nor repair (a
//      repair shop, by tag or name, that also rents is a fietsenmaker first: spot check 2026-11-15, SAM Tweewielen Service & Bike
//      Rental, Karel Klinkenbergstraat 10, shows no rental row): identical bikes in the fleet's colour outside, racked
//      the same inside;
//   2. used: second_hand=yes|only or service:bicycle:second_hand=yes|only: a short muted row outside, racked bikes
//      inside;
//   3. premium (never a workshop: service:bicycle:repair=yes or a service / reparatie / fietsenmaker / tweewielen name,
//      spot check: Gregario Cycling Services): a brand or e-bike dealer (VanMoof, Veloretti, Cortina, Gazelle, Babboe, Urban Arrow, a racefiets or
//      wielersport shop, e-bike in the name, service:bicycle:ebike=yes), or service:bicycle:retail=yes with no
//      second-hand tag: two to four bright clean bikes side-on in the window and a neat row of two to five clean bikes
//      outside (spot check: Maats Cycling Culture, Van Woustraat 165, and Veloretti, Van Woustraat 72, both stand a
//      tidy row out front);
//   4. used: a workshop (service:bicycle:repair=yes, or its name says so), a fietsenmaker / fietshandel / tweewielers / rijwiel /
//      tweedehands / fietsenplan name, or any other unbranded local shop (the Amsterdam default).

export type BikeClass = 'used' | 'premium' | 'rental';

/** Rental and subscription fleets and their bikes' colour (the frame as seen from the street). */
export const RENTAL_FLEETS: ReadonlyArray<{ re: RegExp; hex: string; name: string }> = [
  { re: /mac ?bike/i, hex: '#c8262d', name: 'MacBike (red)' },
  { re: /yellow ?bike/i, hex: '#f2c21b', name: 'Yellow Bike (yellow)' },
  { re: /black ?bikes?/i, hex: '#1d1d1d', name: 'Black Bikes (black)' },
  { re: /swapfiets/i, hex: '#2a2a2a', name: 'Swapfiets (black, blue front tyre)' },
  { re: /green ?budget/i, hex: '#3f7d3a', name: 'Green Budget Bikes (green)' },
  { re: /star ?bikes/i, hex: '#2b2b2b', name: 'Starbikes (black)' },
  { re: /ov-?fiets/i, hex: '#1f4fa0', name: 'OV-fiets (blue)' },
];
const RENTAL_NAME = /rent|verhuur|tours?\b|bike ?city|bikes? (&|and) boats|bike in town|mac ?bike|yellow ?bike|black ?bikes?|swapfiets|green ?budget|star ?bikes|ov-?fiets/i;
const PREMIUM_NAME = /van ?moof|veloretti|cortina|gazelle|babboe|urban ?arrow|ampler|cowboy|stromer|riese|specialized|trek|giant|canyon|cannondale|brompton|e-?bike|racefiets|wielersport|cycling|velo\b|bike ?fit/i;
const USED_NAME = /fietsenmak|fietshandel|tweewiel|rijwiel|tweedehands|2e ?hands|fietsenplan|occasion/i;
/** A workshop's name (spot check: SAM Tweewielen Service & Bike Rental and Gregario Cycling Services, neither tagged
 *  service:bicycle:repair, both a repair front with mixed parked bikes). */
const REPAIR_NAME = /service|reparatie|repair|werkplaats|fietsenmak|tweewiel/i;
const yes = (v: string | undefined) => v === 'yes' || v === 'only';

/** The class of a bike shop from its OSM tags, and which rule step decided it. */
export function bikeShopClass(tags: Record<string, string>): { cls: BikeClass; step: number; why: string; fleetHex?: string } {
  const name = `${tags.name ?? ''} ${tags.brand ?? ''} ${tags.operator ?? ''}`;
  const second = yes(tags.second_hand) || yes(tags['service:bicycle:second_hand']);
  const repair = yes(tags['service:bicycle:repair']) || REPAIR_NAME.test(name);
  const fleet = RENTAL_FLEETS.find(f => f.re.test(name));
  if (tags.amenity === 'bicycle_rental' || (tags.rental && tags.rental !== 'no') || fleet || ((RENTAL_NAME.test(name) || yes(tags['service:bicycle:rental'])) && !second && !repair)) {
    return { cls: 'rental', step: 1, why: fleet ? fleet.name : tags.amenity === 'bicycle_rental' ? 'amenity=bicycle_rental' : 'rental', ...(fleet ? { fleetHex: fleet.hex } : {}) };
  }
  if (second) return { cls: 'used', step: 2, why: 'second-hand tag' };
  if (!repair && (PREMIUM_NAME.test(name) || yes(tags['service:bicycle:ebike']) || yes(tags['service:bicycle:retail']))) return { cls: 'premium', step: 3, why: PREMIUM_NAME.test(name) ? 'brand or dealer name' : yes(tags['service:bicycle:ebike']) ? 'e-bike service' : 'retail, no second-hand or repair' };
  if (repair) return { cls: 'used', step: 4, why: yes(tags['service:bicycle:repair']) ? 'repair shop' : 'workshop name' };
  if (USED_NAME.test(name)) return { cls: 'used', step: 4, why: 'fietsenmaker-type name' };
  return { cls: 'used', step: 4, why: 'unbranded local shop (default)' };
}

/** Muted used-bike frame colours (the photos' parked rows: black, grey, faded navy, oxblood, olive, cream). */
export const USED_HEXES = ['#1e1e1e', '#3a3d40', '#2c3a4e', '#5a2a2a', '#4a4f3a', '#bdb6a4', '#262626', '#6a6e70'] as const;
/** Bright showroom frame colours (a premium window: clean bikes in glossy paint). */
export const SHOW_HEXES = ['#d8dcdf', '#1f6fb5', '#c83a2e', '#2f9e74', '#f0c419', '#111111', '#e9e3d4'] as const;

/** One quad of a bike, in the bike's frame: x along it (rear axle 0, front axle WHEELBASE), z up from the ground. */
export type BikeQuad = { x0: number; z0: number; x1: number; z1: number; w: number; part: 'wheel' | 'frame' | 'bar' };
export const BIKE = { wheelR: 0.33, wheelbase: 1.08, tube: 0.035, tyre: 0.04, segments: 10 } as const;

/**
 * A bike seen side-on as thin strips (each one quad of width `w` between two points): two wheels as `segments`-gon
 * rings, the diamond frame (seat tube, top tube, down tube, chain and seat stays), the fork, saddle and handlebar.
 * 10 + 10 + 9 = 29 quads, 58 triangles single-sided.
 */
export function bikeQuads(): BikeQuad[] {
  const { wheelR: R, wheelbase: L, tube: t, tyre, segments: n } = BIKE, out: BikeQuad[] = [];
  for (const cx of [0, L]) for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    out.push({ x0: cx + R * Math.cos(a0), z0: R + R * Math.sin(a0), x1: cx + R * Math.cos(a1), z1: R + R * Math.sin(a1), w: tyre, part: 'wheel' });
  }
  const bb = [0.42, 0.3] as const, seat = [0.3, 0.88] as const, head = [0.92, 0.86] as const, headLow = [0.95, 0.7] as const;
  const seg = (a: readonly [number, number], b: readonly [number, number], part: BikeQuad['part'] = 'frame', w: number = t) => out.push({ x0: a[0], z0: a[1], x1: b[0], z1: b[1], w, part });
  seg(bb, seat); seg(seat, head); seg(bb, headLow); seg([0, R], bb); seg([0, R], seat);
  seg(headLow, [L, R]); seg(head, headLow);
  seg([seat[0] - 0.1, seat[1] + 0.07], [seat[0] + 0.12, seat[1] + 0.07], 'bar', 0.05);
  seg([head[0] - 0.06, head[1] + 0.12], [head[0] + 0.12, head[1] + 0.12], 'bar', 0.03);
  return out;
}

/** Bikes outside: how many, where along the front (metres from its start), which colours; seeded per pand. */
export function outsideBikes(cls: BikeClass, lenM: number, rnd: (k: string) => number, fleetHex?: string): Array<{ a: number; hex: string; lean: number }> {
  const step = cls === 'rental' ? 0.55 : cls === 'premium' ? 0.75 : 0.6, max = cls === 'premium' ? 5 : 8, min = cls === 'premium' ? 2 : 3;
  const room = Math.floor((lenM - 0.2 - BIKE.wheelbase - 2 * BIKE.wheelR) / step) + 1;
  const n = Math.max(0, Math.min(max, room, min + Math.floor(rnd('n') * (max - min + 1))));
  const out: Array<{ a: number; hex: string; lean: number }> = [];
  for (let k = 0; k < n; k++) {
    const jitter = cls === 'used' ? (rnd(`j${k}`) - 0.5) * 0.18 : 0;
    const hex = cls === 'rental' ? fleetHex ?? '#2a2a2a' : cls === 'premium' ? SHOW_HEXES[Math.floor(rnd(`h${k}`) * SHOW_HEXES.length)] : USED_HEXES[Math.floor(rnd(`h${k}`) * USED_HEXES.length)];
    out.push({ a: 0.1 + BIKE.wheelR + k * step + jitter, hex, lean: cls === 'used' ? (rnd(`l${k}`) - 0.5) * 0.06 : 0 });
  }
  return out;
}

/** The class as staged in the template extract: `u`, `p`, `r`, or `r#rrggbb` for a fleet's colour. */
export function bikeCode(c: { cls: BikeClass; fleetHex?: string }): string { return c.cls[0] + (c.fleetHex ?? ''); }
/** The staged code back to a class and fleet colour; anything else is null. */
export function bikeFromCode(code: unknown): { cls: BikeClass; fleetHex?: string } | null {
  if (typeof code !== 'string') return null;
  const cls = ({ u: 'used', p: 'premium', r: 'rental' } as const)[code[0] as 'u' | 'p' | 'r'];
  if (!cls) return null;
  const hex = code.slice(1);
  return /^#[0-9a-f]{6}$/i.test(hex) ? { cls, fleetHex: hex } : { cls };
}
