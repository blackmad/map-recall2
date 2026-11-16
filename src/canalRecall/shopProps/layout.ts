// Shop props layout (lane shop-goods-20261116): which props a template puts on the pavement (`outside`, 0-1.2 m from the
// wall) and behind its glass (`inside`, 0.3-2.5 m deep), as data; and the deterministic placement per run and per bay,
// seeded by the pand and the bay index, so no two windows repeat and the world compile stays stable.
import { hash01, posed, type PropTri } from './kit.js';
import { bakfiets, barberStation, bikeHex, bikeRack, BLOOMS, bucketTier, counter, crate, omafiets, OMAFIETS_SIZE, plant, PRODUCE, rail, shelfUnit, washBasin, type Produce } from './props.js';

export type PropKind = 'bike' | 'windowBike' | 'bakfiets' | 'crate' | 'bucketTier' | 'plant' | 'barberStation' | 'washBasin' | 'counter' | 'shelfUnit';

/** A pavement row: props chosen by weight, laid along each run at about `pitchM`, `y` out from the wall (alternating by
 *  `yAlt`), turned up to `yawJitter`; `tilt` tips them towards the street; `stand` draws under or behind the row. */
export type OutsideRow = {
  props: ReadonlyArray<{ prop: PropKind; weight: number }>; pitchM: number; y: number; yAlt?: number; z?: number;
  yawJitter?: number; tilt?: number; stand?: 'skirt' | 'rail' | 'hoops'; max?: number; /** Share of props turned end for end. */ mirror?: number;
  /** Lane shop-bikes: spread the props evenly over each whole run, about `pitchM` apart (a single prop centred), at most
   *  `max` over the front (the pitch then widens); one kind only. */
  even?: boolean;
};
/** Props behind the glass per bay: how many (at most what fits), how deep, turned how far. */
export type InsideItem = { prop: PropKind; count: readonly [number, number]; depth: readonly [number, number]; yaw?: number; yawJitter?: number; z?: number; k?: number; widthM?: number; mirror?: number };
export type ShopPropsSpec = { outside?: readonly OutsideRow[]; inside?: readonly InsideItem[] };

/** The templates' props (only those that draw any). */
export const SHOP_PROPS: Readonly<Record<string, ShopPropsSpec>> = {
  // Lane shop-bikes (David 2026-11-16): the baked omafiets, side-on, evenly along the whole frontage either side of the
  // door at about 0.65 m (two staggered lines, wheels overlapping as parked), a few turned the other way, before hoop
  // racks; behind each window one standing on the riser and, where it fits, one hung above.
  bike: {
    outside: [{ props: [{ prop: 'bike', weight: 1 }], pitchM: 0.65, y: 0.41, yAlt: 0.12, yawJitter: 0.07, stand: 'hoops', max: 8, mirror: 0.3, even: true }],
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
  hairdresser: {
    inside: [{ prop: 'barberStation', count: [2, 3], depth: [1.4, 1.6], yawJitter: 0.25 }, { prop: 'washBasin', count: [0, 1], depth: [2.0, 2.2], yaw: 0.6 }, { prop: 'counter', count: [0, 1], depth: [0.6, 0.8], widthM: 1.1 }],
  },
};

/** What a prop takes along the wall (m). */
const WIDTH: Record<PropKind, number> = { bike: OMAFIETS_SIZE.lengthM, windowBike: OMAFIETS_SIZE.lengthM, bakfiets: 2.3, crate: 0.5, bucketTier: 1.2, plant: 0.4, barberStation: 0.8, washBasin: 0.6, counter: 1.1, shelfUnit: 1.4 };
const PRODUCE_ORDER = Object.keys(PRODUCE) as Produce[];
const HAIR = ['#1d1d1b', '#7a1f2b', '#2b2b2b', '#3a2a22'] as const, PALETTE = ['#d8452f', '#f2b92e', '#3f8f4a', '#ee7f2c', '#7cb342', '#c0392b'] as const;

/** One prop instance's triangles: kinds that vary (colour, produce, blooms) draw from `r`. */
function build(kind: PropKind, r: (k: string) => number, seed: string, i: number, widthM?: number): PropTri[] {
  switch (kind) {
    // Keys vary in the middle, not the last character: FNV-1a's top bits barely move on a last-character change.
    case 'bike': return omafiets(bikeHex(r(`${i}:hue`)));
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
    case 'counter': return counter(widthM ?? WIDTH.counter, r(`h${i}`) < 0.5 ? '#e8e4dc' : '#2b2724');
    case 'shelfUnit': return shelfUnit(widthM ?? WIDTH.shelfUnit, PALETTE, `${seed}:s${i}`);
  }
}

/** Props on the pavement over the runs (wall metres either side of the door), in the slot frame (x along the wall,
 *  y out, z up from the pavement), seeded by the pand. */
export function outsideProps(spec: ShopPropsSpec, runs: ReadonlyArray<readonly [number, number]>, seed: string): PropTri[] {
  const out: PropTri[] = [];
  (spec.outside ?? []).forEach((row, ri) => {
    const r = (k: string) => hash01(`${seed}:out${ri}:${k}`), total = row.props.reduce((t, p) => t + p.weight, 0);
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
