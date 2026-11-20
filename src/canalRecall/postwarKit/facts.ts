/**
 * Post-1965 housing fronts read from street panoramas (lane postwar-housing-kit-20261120).
 *
 * The ordinary backlog (docs/reports/ordinary-backlog-20261120.md) found the generic post-1965 housing blocks near the
 * centre drawn in the wrong wall family and without the balconies, arcades and erkers the photos show. This lane read
 * 60 cluster members' fronts by eye from aimed Gemeente Amsterdam panorama thumbnails (scripts/postwar-kit/
 * sample-photos.ts; CC BY 4.0) into `measured-fronts.json`. 15 more members were held out for the blind test.
 *
 * Families:
 *   - brick-red: orange-red to red-brown; brick-brown: mid brown; brick-dark: purple-brown to near-black brown;
 *     brick-buff: yellow, tan, salmon or cream brick; brick-grey: grey or anthracite brick;
 *   - render-white: white or pale render, concrete or stone; render-colour: ochre, pink or other coloured render;
 *   - cladding: metal, glass or dark panel fronts.
 */
import DATA from './measured-fronts.json';

export const WALL_FAMILIES = ['brick-red', 'brick-brown', 'brick-dark', 'brick-buff', 'brick-grey', 'render-white', 'render-colour', 'cladding'] as const;
export type WallFamily = (typeof WALL_FAMILIES)[number];
export const BALCONY_KINDS = ['none', 'projecting', 'round', 'band', 'loggia', 'french'] as const;
export type BalconyKind = (typeof BALCONY_KINDS)[number];
export type BalconyTone = 'white' | 'dark' | 'glass' | 'wall' | 'colour';
export const GROUND_KINDS = ['plain', 'shop', 'glazed', 'recessed', 'arcade'] as const;
export type GroundKind = (typeof GROUND_KINDS)[number];
export const WINDOW_KINDS = ['punched', 'wide', 'tall', 'strip', 'arched', 'grid'] as const;
export type WindowKind = (typeof WINDOW_KINDS)[number];
export type FrameTone = 'white' | 'dark' | 'colour';
export const ERKER_KINDS = ['none', 'dark-glass', 'white-glass', 'brick'] as const;
export type ErkerKind = (typeof ERKER_KINDS)[number];

/** The backlog clusters: C4 1965-1984 blocks, C1 1985-2004 blocks, C5 1985-2004 towers (>= 24 m), C2 2005+ blocks. */
export type Cluster = 'C1' | 'C2' | 'C4' | 'C5';
export const TOWER_MIN_M = 24;
export function clusterFor(year: number, heightM: number): Cluster | null {
  if (!Number.isFinite(year) || year < 1965) return null;
  if (year < 1985) return 'C4';
  if (year < 2005) return heightM >= TOWER_MIN_M ? 'C5' : 'C1';
  return 'C2';
}

export type MeasuredFront = {
  id: string; cluster: Cluster; address: string; at: [number, number]; year: number; heightM: number; panoId: string; panoDate: string; obliquityDeg: number;
  usable?: false;
  wall?: WallFamily; balcony?: BalconyKind; balconyTone?: BalconyTone | null; ground?: GroundKind; window?: WindowKind; frames?: FrameTone; erker?: ErkerKind;
  confidence?: 'high' | 'low'; note?: string;
};
export type ReadFront = Required<Pick<MeasuredFront, 'wall' | 'balcony' | 'ground' | 'window' | 'frames' | 'erker'>> & MeasuredFront;

const ROWS = (DATA as unknown as { fronts: MeasuredFront[] }).fronts;
export function validateFronts(rows: readonly MeasuredFront[]): ReadFront[] {
  const out: ReadFront[] = [];
  for (const r of rows) {
    if (!/^\d{16}$/.test(r.id)) throw new Error(`postwar fronts: bad id ${r.id}`);
    if (r.usable === false) continue;
    if (!(WALL_FAMILIES as readonly string[]).includes(r.wall!) || !(BALCONY_KINDS as readonly string[]).includes(r.balcony!) || !(GROUND_KINDS as readonly string[]).includes(r.ground!)
      || !(WINDOW_KINDS as readonly string[]).includes(r.window!) || !(ERKER_KINDS as readonly string[]).includes(r.erker!) || !['white', 'dark', 'colour'].includes(r.frames!)) throw new Error(`postwar fronts: bad row ${r.id}`);
    out.push(r as ReadFront);
  }
  return out;
}
export const MEASURED_FRONTS: readonly ReadFront[] = validateFronts(ROWS);
const BY_ID = new Map(MEASURED_FRONTS.map(r => [r.id, r]));
const shortId = (id: string) => id.startsWith('NL.IMBAG.Pand.') ? id.slice(14) : id;
/** This lane's read of a pand's front, or null. */
export const measuredFront = (id: string): ReadFront | null => BY_ID.get(shortId(id)) ?? null;

export type Counts<K extends string> = Partial<Record<K, number>>;
export type Distribution = { n: number; wall: Counts<WallFamily>; balcony: Counts<BalconyKind>; ground: Counts<GroundKind>; window: Counts<WindowKind>; frames: Counts<FrameTone>; erker: Counts<ErkerKind> };
const tally = <K extends string>(rows: readonly ReadFront[], key: (r: ReadFront) => K): Counts<K> => {
  const out: Counts<K> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
};
/** Counts per field over `rows` (a cluster's fronts, or a neighbourhood's). */
export function distributionOf(rows: readonly ReadFront[]): Distribution {
  return { n: rows.length, wall: tally(rows, r => r.wall), balcony: tally(rows, r => r.balcony), ground: tally(rows, r => r.ground), window: tally(rows, r => r.window), frames: tally(rows, r => r.frames), erker: tally(rows, r => r.erker) };
}
export const CLUSTER_DISTRIBUTION: Readonly<Record<Cluster, Distribution>> = Object.fromEntries((['C1', 'C2', 'C4', 'C5'] as const).map(c => [c, distributionOf(MEASURED_FRONTS.filter(r => r.cluster === c))])) as Record<Cluster, Distribution>;
