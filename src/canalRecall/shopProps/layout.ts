// Shop props layout (lane shop-goods-20261116): which props a template puts on the pavement (`outside`, 0-1.2 m from the
// wall) and behind its glass (`inside`, 0.3-2.5 m deep), as data; and the deterministic placement per run and per bay,
// seeded by the pand and the bay index, so no two windows repeat and the world compile stays stable.
import { hash01, posed, type PropTri } from './kit.js';
import { bakfiets, barberStation, bikeHex, bikeRack, BLOOMS, bucketTier, counter, crate, omafiets, OMAFIETS_SIZE, plant, postcardSpinner, PRODUCE, rail, shelfUnit, washBasin, type Produce } from './props.js';

export type PropKind = 'bike' | 'perpBike' | 'windowBike' | 'bakfiets' | 'crate' | 'bucketTier' | 'plant' | 'barberStation' | 'washBasin' | 'counter' | 'shelfUnit' | 'postcardSpinner';

/** A pavement row: props chosen by weight, laid along each run at about `pitchM`, `y` out from the wall (alternating by
 *  `yAlt`), turned up to `yawJitter`; `tilt` tips them towards the street; `stand` draws under or behind the row. */
export type OutsideRow = {
  props: ReadonlyArray<{ prop: PropKind; weight: number }>; pitchM: number; y: number; yAlt?: number; z?: number;
  yawJitter?: number; tilt?: number; stand?: 'skirt' | 'rail' | 'hoops'; max?: number; /** Share of props turned end for end. */ mirror?: number;
  /** Lane shop-bikes: spread the props evenly over each whole run, about `pitchM` apart (a single prop centred), at most
   *  `max` over the front (the pitch then widens); one kind only. */
  even?: boolean;
  /** Lane shop-bikes-perp: the row draws only where the pavement (wall to kerb, `depthM` of outsideProps) is at least
   *  `minDepthM` and under `maxDepthM`; unknown depth counts as wide. */
  minDepthM?: number; maxDepthM?: number;
  /** Lane shop-bikes-perp: bikes parked perpendicular to the wall, front wheel `wallGapM` from it (a `backedIn` share
   *  rear wheel to the wall), in a cluster about `pitchM` apart per run, kept `clearM` beyond each run's end (with the
   *  run's own 0.12 m, 0.3 m from the door), at most one bike per `perRunM` of run and `max` over the front. */
  /** Lane postcard-spinner: one prop in each run's door-side end (a front with no door: its two ends), a run too short for
   *  it skipped, the second sometimes left out; at most `max`; the prop `y` out from the wall. */
  beside?: boolean;
  perp?: { wallGapM: number; backedIn: number; clearM: number; perRunM: number };
};
/** Props behind the glass per bay: how many (at most what fits), how deep, turned how far. */
export type InsideItem = { prop: PropKind; count: readonly [number, number]; depth: readonly [number, number]; yaw?: number; yawJitter?: number; z?: number; k?: number; widthM?: number; mirror?: number };
export type ShopPropsSpec = { outside?: readonly OutsideRow[]; inside?: readonly InsideItem[] };

/** The templates' props (only those that draw any). */
export const SHOP_PROPS: Readonly<Record<string, ShopPropsSpec>> = {
  // Lane shop-bikes-perp (David 2026-11-16: "bikes should face perpendicular to the storefront"): the baked omafiets
  // parked nose to the wall at about 0.6 m, ~15 % backed in, yaw within 8 degrees, hoops across the pavement between
  // pairs, either side of the door; it needs 2.5 m of pavement (the bike's 2.06 m, the 0.15 m gap and 0.3 m to the
  // kerb). On a narrower pavement (1-2.5 m) the a8fffae34 row: side-on, evenly along each run at about 0.65 m in two
  // staggered lines; under 1 m none. Behind each window one standing on the riser and, where it fits, one hung above
  // (side-on, as shops display them).
  bike: {
    outside: [
      { props: [{ prop: 'perpBike', weight: 1 }], pitchM: 0.6, y: 0, yawJitter: 0.14, stand: 'hoops', max: 6, minDepthM: 2.5, perp: { wallGapM: 0.15, backedIn: 0.15, clearM: 0.18, perRunM: 1.3 } },
      { props: [{ prop: 'bike', weight: 1 }], pitchM: 0.65, y: 0.41, yAlt: 0.12, yawJitter: 0.07, stand: 'hoops', max: 8, mirror: 0.3, even: true, minDepthM: 1, maxDepthM: 2.5 },
    ],
    inside: [
      { prop: 'windowBike', count: [1, 1], depth: [0.5, 1.4], yawJitter: 0.2, z: 0.25, mirror: 0.5 },
      { prop: 'windowBike', count: [0, 1], depth: [0.3, 0.6], yawJitter: 0.1, z: 1.05, k: 0.9, mirror: 0.5 },
    ],
  },
  greengrocer: {
    outside: [
      { props: [{ prop: 'crate', weight: 1 }], pitchM: 0.54, y: 0.42, z: 0.78, tilt: -0.42, max: 7 },
      { props: [{ prop: 'crate', weight: 1 }], pitchM: 0.54, y: 0.82, z: 0.5, tilt: -0.42, stand: 'skirt', max: 7 },
    ],
    inside: [{ prop: 'shelfUnit', count: [1, 1], depth: [2.2, 2.4], widthM: 1.4 }, { prop: 'crate', count: [1, 3], depth: [0.4, 0.9], z: 0.55 }],
  },
  florist: {
    outside: [{ props: [{ prop: 'bucketTier', weight: 1 }], pitchM: 1.35, y: 0.55, max: 2 }],
    inside: [{ prop: 'plant', count: [3, 7], depth: [0.3, 2.2], k: 1.5, z: 0.5 }],
  },
  // Lane postcard-spinner (David 2026-11-16: the flat postcard grid "looks bad"): a 3D postcard spinner or two beside the
  // door, 0.5 m from the wall, on a pavement of at least 1.1 m. Souvenir shops and Bestseller.
  souvenir: { outside: [{ props: [{ prop: 'postcardSpinner', weight: 1 }], pitchM: 1, y: 0.5, max: 2, beside: true, minDepthM: 1.1 }] },
  bestseller: { outside: [{ props: [{ prop: 'postcardSpinner', weight: 1 }], pitchM: 1, y: 0.5, max: 2, beside: true, minDepthM: 1.1 }] },
  hairdresser: {
    inside: [{ prop: 'barberStation', count: [2, 3], depth: [1.4, 1.6], yawJitter: 0.25 }, { prop: 'washBasin', count: [0, 1], depth: [2.0, 2.2], yaw: 0.6 }, { prop: 'counter', count: [0, 1], depth: [0.6, 0.8], widthM: 1.1 }],
  },
};

/** What a prop takes along the wall (m). */
const WIDTH: Record<PropKind, number> = { postcardSpinner: 0.62, bike: OMAFIETS_SIZE.lengthM, perpBike: OMAFIETS_SIZE.widthM, windowBike: OMAFIETS_SIZE.lengthM, bakfiets: 2.3, crate: 0.5, bucketTier: 1.2, plant: 0.4, barberStation: 0.8, washBasin: 0.6, counter: 1.1, shelfUnit: 1.4 };
const PRODUCE_ORDER = Object.keys(PRODUCE) as Produce[];
const HAIR = ['#1d1d1b', '#7a1f2b', '#2b2b2b', '#3a2a22'] as const, PALETTE = ['#d8452f', '#f2b92e', '#3f8f4a', '#ee7f2c', '#7cb342', '#c0392b'] as const;

/** One prop instance's triangles: kinds that vary (colour, produce, blooms) draw from `r`. */
function build(kind: PropKind, r: (k: string) => number, seed: string, i: number, widthM?: number): PropTri[] {
  switch (kind) {
    // Keys vary in the middle, not the last character: FNV-1a's top bits barely move on a last-character change.
    case 'bike': return omafiets(bikeHex(r(`${i}:hue`)));
    case 'perpBike': return omafiets(bikeHex(r(`${i}:hue`)), 'perp');
    case 'windowBike': return omafiets(bikeHex(r(`${i}:hue`)), 'window');
    case 'bakfiets': return bakfiets(r(`h${i}`) < 0.6 ? '#8a6a44' : '#2f4a36');
    case 'crate': {
      // Neighbours differ: a seeded start, then every third produce of the eight, so a row runs through all of them.
      const p = PRODUCE_ORDER[(Math.floor(r('o') * PRODUCE_ORDER.length) + i * 3) % PRODUCE_ORDER.length];
      return crate(p, r(`c${i}`) < 0.6);
    }
    case 'bucketTier': return bucketTier(widthM ?? WIDTH.bucketTier, `${seed}:t${i}`);
    case 'plant': return r(`b${i}`) < 0.45 ? plant(BLOOMS[Math.floor(r(`c${i}`) * BLOOMS.length)]) : plant(['#3d6b35', '#4f7a3a', '#2f5a30', '#5f8a3a'][Math.floor(r(`l${i}`) * 4)], r(`p${i}`) < 0.5 ? '#a0522d' : '#d9d4c8', r(`t${i}`) < 0.4);
    case 'barberStation': return barberStation(HAIR[Math.floor(r(`h${i}`) * HAIR.length)]);
    case 'washBasin': return washBasin();
    case 'postcardSpinner': return postcardSpinner(r, (r('turn') - 0.5) * 1.0);
    case 'counter': return counter(widthM ?? WIDTH.counter, r(`h${i}`) < 0.5 ? '#e8e4dc' : '#2b2724');
    case 'shelfUnit': return shelfUnit(widthM ?? WIDTH.shelfUnit, PALETTE, `${seed}:s${i}`);
  }
}

/** Props on the pavement over the runs (wall metres either side of the door), in the slot frame (x along the wall,
 *  y out, z up from the pavement), seeded by the pand. */
export function outsideProps(spec: ShopPropsSpec, runs: ReadonlyArray<readonly [number, number]>, seed: string, depthM = Infinity): PropTri[] {
  const out: PropTri[] = [];
  (spec.outside ?? []).forEach((row, ri) => {
    if (depthM < (row.minDepthM ?? 0) || (row.maxDepthM !== undefined && depthM >= row.maxDepthM)) return;
    const r = (k: string) => hash01(`${seed}:out${ri}:${k}`), total = row.props.reduce((t, p) => t + p.weight, 0);
    if (row.perp) { out.push(...perpRow(row, row.perp, runs, seed, r)); return; }
    if (row.beside) { out.push(...besideRow(row, runs, seed, r)); return; }
    if (row.even) { out.push(...evenRow(row, runs, seed, r)); return; }
    let n = 0;
    for (const [r0, r1] of runs) {
      let x = r0 + 0.05;
      const placed: Array<{ kind: PropKind; x: number }> = [];
      while (n < (row.max ?? 99)) {
        let pick = r(`k${n}`) * total, kind = row.props[0].prop;
        for (const p of row.props) { if ((pick -= p.weight) < 0) { kind = p.prop; break; } }
        // A prop that does not fit the rest of the run gives way to the row's first kind, else the run is full.
        if (x + WIDTH[kind] > r1 + 1e-6 && kind !== 'bucketTier') kind = row.props[0].prop;
        const w = kind === 'bucketTier' ? Math.min(WIDTH.bucketTier, r1 - x - 0.05) : WIDTH[kind];
        if (w < 0.5 || x + w > r1 + 1e-6) break;
        const step = Math.max(row.pitchM, kind === 'bike' || kind === 'bakfiets' ? 0 : w + 0.04);
        const yaw = (r(`y${n}`) - 0.5) * 2 * (row.yawJitter ?? 0), y = row.y + (n % 2 ? row.yAlt ?? 0 : 0);
        out.push(...posed(build(kind, r, seed, n, w), { x: x + w / 2, y, z: row.z ?? 0, yaw, tilt: row.tilt, mirror: r(`m${n}`) < (row.mirror ?? 0) }));
        placed.push({ kind, x: x + w / 2 });
        // A bike row packs bikes side by side with their wheels overlapping (as parked); every other prop sits its width apart.
        x += kind === 'bike' || kind === 'bakfiets' ? step + (r(`g${n}`) - 0.3) * 0.12 + (kind === 'bakfiets' ? 0.6 : 0) : step;
        n++;
      }
      if (placed.length && row.stand === 'rail') { const a = placed[0].x - 0.6, b = Math.min(r1, placed[placed.length - 1].x + 0.6); if (b - a > 0.4) out.push(...posed(rail(b - a), { x: (a + b) / 2, y: 0.18, z: 0 })); }
      if (placed.length && row.stand === 'skirt') {
        const a = placed[0].x - 0.27, b = placed[placed.length - 1].x + 0.27, z = (row.z ?? 0) - 0.02, y = row.y + 0.2;
        out.push(...posed([
          { p: [[a, y, 0], [b, y, 0], [b, y, z]], n: [0, 1, 0], hex: '#3d6b35' }, { p: [[a, y, 0], [b, y, z], [a, y, z]], n: [0, 1, 0], hex: '#3d6b35' },
        ], { x: 0, y: 0, z: 0 }));
      }
    }
  });
  return out;
}

/** Bikes parked perpendicular to the wall (lane shop-bikes-perp): per run a cluster about `pitchM` apart, centred with
 *  a seeded shift, every run that fits one getting at least one; hoops across the pavement between pairs. */
function perpRow(row: OutsideRow, perp: NonNullable<OutsideRow['perp']>, runs: ReadonlyArray<readonly [number, number]>, seed: string, r: (k: string) => number): PropTri[] {
  const out: PropTri[] = [], kind = row.props[0].prop, L = OMAFIETS_SIZE.lengthM, jitter = row.yawJitter ?? 0;
  // A bike's half-extent along the wall: half its bars, plus half its length swung by the largest yaw jitter.
  const half = OMAFIETS_SIZE.widthM / 2 + (L / 2) * Math.sin(jitter);
  const usable = runs.map(([r0, r1]) => [r0 + perp.clearM + half, r1 - perp.clearM - half] as const);
  const fits = usable.map(([a, b]) => (b >= a ? Math.floor((b - a) / row.pitchM + 1e-9) + 1 : 0));
  const allowed = Math.min(row.max ?? 99, Math.max(1, Math.floor(runs.reduce((t, [r0, r1]) => t + r1 - r0, 0) / perp.perRunM)));
  // One for each run that fits one, then the rest one at a time to the run with the most room per bike.
  const want = fits.map((f): number => (f > 0 ? 1 : 0));
  while (want.reduce((t, k) => t + k, 0) > allowed) want[want.lastIndexOf(1)] = 0;
  for (;;) {
    if (want.reduce((t, k) => t + k, 0) >= allowed) break;
    let best = -1;
    for (let i = 0; i < want.length; i++) if (want[i] < fits[i] && (best < 0 || fits[i] / (want[i] + 1) > fits[best] / (want[best] + 1))) best = i;
    if (best < 0) break;
    want[best]++;
  }
  let n = 0;
  usable.forEach(([a, b], ri) => {
    const k = want[ri];
    if (!k) return;
    const span = (k - 1) * row.pitchM, slack = Math.max(0, b - a - span), x0 = a + slack * (0.5 + (r(`${ri}:shift`) - 0.5) * 0.6), xs: number[] = [];
    for (let j = 0; j < k; j++, n++) {
      const x = x0 + j * row.pitchM + (k > 1 ? (r(`${n}:slack`) - 0.5) * 0.06 : 0), back = r(`${n}:back`) < perp.backedIn;
      // Front wheel (-x in the bike's frame) to the wall: yaw +90 degrees; backed in: -90, the rear wheel to it.
      const yaw = (back ? -1 : 1) * Math.PI / 2 + (r(`${n}:yaw`) - 0.5) * 2 * jitter;
      out.push(...posed(build(kind, r, seed, n), { x, y: perp.wallGapM + L / 2, z: row.z ?? 0, yaw }));
      xs.push(x);
    }
    if (row.stand === 'hoops') for (let h = 0; h + 1 < xs.length; h += 2) {
      // A hoop across the pavement between each pair, its middle where the bikes lean (0.75 m out).
      out.push(...posed(bikeRack(undefined, true), { x: (xs[h] + xs[h + 1]) / 2, y: 0.75, z: 0, yaw: Math.PI / 2 }));
    }
  });
  return out;
}

/** Props beside the door (lane postcard-spinner): per run one at its door-side end (a lone run, no door: both ends if it
 *  is long enough), the longest run always, the others with a seeded chance, at most `max`. */
function besideRow(row: OutsideRow, runs: ReadonlyArray<readonly [number, number]>, seed: string, r: (k: string) => number): PropTri[] {
  const out: PropTri[] = [], kind = row.props[0].prop, w = WIDTH[kind], gap = 0.1;
  const spots: Array<{ x: number; len: number }> = [];
  runs.forEach(([r0, r1], ri) => {
    if (r1 - r0 < w + 2 * gap) return;
    if (runs.length === 1) { spots.push({ x: r0 + gap + w / 2, len: r1 - r0 }); if (r1 - r0 > 2 * w + 1.2) spots.push({ x: r1 - gap - w / 2, len: r1 - r0 }); }
    else spots.push({ x: ri < runs.length / 2 ? r1 - gap - w / 2 : r0 + gap + w / 2, len: r1 - r0 });
  });
  const longest = Math.max(0, ...spots.map(s => s.len));
  let n = 0;
  for (const s of spots) {
    if (n >= (row.max ?? 99)) break;
    if (s.len < longest && r(`b${n}`) > 0.6) continue;
    out.push(...posed(build(kind, r, seed, n), { x: s.x, y: row.y + (r(`y${n}`) - 0.5) * 0.2, z: row.z ?? 0 }));
    n++;
  }
  return out;
}

/** A row spread evenly over each whole run (lane shop-bikes): as many props as fit about `pitchM` apart, first and
 *  last at the run's ends, at most `max` over the front shared out by run length; hoops behind, one per two props. */
function evenRow(row: OutsideRow, runs: ReadonlyArray<readonly [number, number]>, seed: string, r: (k: string) => number): PropTri[] {
  const out: PropTri[] = [], kind = row.props[0].prop, w = WIDTH[kind];
  const fits = runs.map(([r0, r1]) => (r1 - r0 >= w ? Math.floor((r1 - r0 - w) / row.pitchM + 1e-9) + 1 : 0));
  // Over the cap, trim the run with the most props first, so the bikes stay spread over the whole front.
  const want = fits.slice();
  while (want.reduce((t, k) => t + k, 0) > (row.max ?? 99)) { const i = want.indexOf(Math.max(...want)); want[i]--; }
  let n = 0;
  runs.forEach(([r0, r1], ri) => {
    const k = want[ri];
    if (!k) return;
    const step = k > 1 ? (r1 - r0 - w) / (k - 1) : 0, xs: number[] = [];
    for (let j = 0; j < k; j++, n++) {
      // Seeded: a few centimetres of slack along, the line (front or back), a little turn, and now and then end for end.
      const slack = Math.min(0.08, Math.max(0, step - 0.5) / 2), x = k > 1 ? r0 + w / 2 + j * step + (r(`${n}:slack`) - 0.5) * 2 * slack * (j > 0 && j < k - 1 ? 1 : 0) : (r0 + r1) / 2;
      const y = row.y + (j % 2 ? row.yAlt ?? 0 : 0), yaw = (r(`${n}:yaw`) - 0.5) * 2 * (row.yawJitter ?? 0);
      out.push(...posed(build(kind, r, seed, n), { x, y, z: row.z ?? 0, yaw, tilt: row.tilt, mirror: r(`${n}:mirror`) < (row.mirror ?? 0) }));
      xs.push(x);
    }
    if (row.stand === 'hoops') {
      // Hoops (the street-furniture rack) behind the line, one per two bikes, evenly between the first and the last.
      const hoops = Math.max(1, Math.ceil(k / 2)), a = xs[0], b = xs[xs.length - 1];
      for (let h = 0; h < hoops; h++) out.push(...posed(bikeRack(), { x: hoops > 1 ? a + (b - a) * h / (hoops - 1) : (a + b) / 2, y: 0.12, z: 0 }));
    }
  });
  return out;
}

/** Props behind the glass of one bay [c0, c1] (wall metres), in the slot frame with y = -depth (into the shop), seeded
 *  by pand and bay: each bay draws its own count, order, spacing and colours. `maxH` caps a prop's scale. */
export function insideProps(spec: ShopPropsSpec, c0: number, c1: number, seed: string, bay: number): Array<{ tris: PropTri[]; depth: number }> {
  const out: Array<{ tris: PropTri[]; depth: number }> = [], r = (k: string) => hash01(`${seed}:bay${bay}:${k}`);
  let room = c1 - c0 - 0.1, n = 0;
  for (const [ii, item] of (spec.inside ?? []).entries()) {
    const w = item.widthM ?? WIDTH[item.prop];
    const want = item.count[0] + Math.floor(r(`n${ii}`) * (item.count[1] - item.count[0] + 1));
    const fit = Math.max(0, Math.min(want, Math.floor(room / (w * 0.75))));
    for (let j = 0; j < fit; j++, n++) {
      const depth = item.depth[0] + r(`d${ii}:${j}`) * (item.depth[1] - item.depth[0]);
      // Spread along the bay, each slot jittered: the shift that keeps two windows of one shop from matching.
      const slot = (c1 - c0) / fit, x = c0 + slot * (j + 0.5) + (r(`x${ii}:${j}`) - 0.5) * Math.max(0, slot - w) * 0.9;
      const yaw = (item.yaw ?? 0) * (r(`s${ii}:${j}`) < 0.5 ? -1 : 1) + (r(`y${ii}:${j}`) - 0.5) * 2 * (item.yawJitter ?? 0);
      out.push({ tris: posed(build(item.prop, r, `${seed}:bay${bay}`, n, item.widthM), { x, y: 0, z: item.z ?? 0, yaw, k: item.k ?? 1, mirror: r(`m${ii}:${j}`) < (item.mirror ?? 0) }), depth });
    }
    room -= fit * w * 0.75;
  }
  return out;
}
