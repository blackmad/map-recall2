/**
 * The post-1965 housing kit (`?postwarKit=1`, lane postwar-housing-kit-20261120), round 2: colour from measurement, no draws.
 *
 * Round 1 (a cluster x neighbourhood lottery for walls and features) lost its blind 4-5 with two regressions. Its useful
 * finding was the source: the T0 per-pand modern walls (buurtProfiles/modern-pand-walls.json) average windows, frames and
 * loggia shadow into the wall. Round 2 fixes the source and draws nothing:
 *   1. a pand this lane read by eye (measured-fronts.json, 59 fronts) draws its read: wall family (the brick-only
 *      measurement's colour when it agrees with the read's family, else the family swatch), bay preset, and its balconies,
 *      arcade and erkers;
 *   2. any other dated 1965+ housing pand with an accepted brick-only measurement (corrected-walls.json, written by
 *      scripts/postwar-kit/measure-walls.ts from panorama patches of the upper-storey wall, wallPatch.ts) draws that colour,
 *      in today's window preset (its brick or smooth twin when the material changes), and nothing else;
 *   3. every other pand: null, today's draw unchanged.
 *
 * Deterministic per pand id. Off (the default), nothing calls this and every building is byte-identical; on, only the
 * pands in (1) and (2) change.
 */
import { unitDraw } from '../buurtProfiles/profiles.js';
import { rgbToLab } from '../look/brickTone.js';
import CORRECTED from './corrected-walls.json';
import FEATURES from './feature-reads.json';
import SIBLINGS from './sibling-features.json';
import {
  CLUSTER_DISTRIBUTION, clusterFor, distributionOf, measuredFront,
  type BalconyKind, type Cluster, type ErkerKind, type FrameTone, type GroundKind, type WallFamily, type WindowKind,
} from './facts.js';

export { postwarKitEnabled } from './flag.js';

/** Photo-look swatches per family for a read whose measurement is missing or disagrees; brick kept to L* <= 72. */
export const FAMILY_SWATCHES: Readonly<Record<WallFamily, readonly string[]>> = {
  'brick-red': ['#94503e', '#9a5240', '#8a4a3a', '#a35c46'],
  'brick-brown': ['#7e5a48', '#86624f', '#74533f', '#8c6a56'],
  'brick-dark': ['#5c4038', '#523a33', '#634539', '#4c3732'],
  'brick-buff': ['#a08a70', '#9a846a', '#a8916f', '#94806a'],
  'brick-grey': ['#7a736d', '#6d6864', '#88807a', '#5f5c5a'],
  'render-white': ['#e6e2d8', '#ece8de', '#dedad0'],
  'render-colour': ['#cfae84', '#c9aaa0', '#d4b892'],
  cladding: ['#a3a4a2', '#6a6e72', '#b9b3a7'],
};
export const PAINTED_FAMILIES: ReadonlySet<WallFamily> = new Set(['render-white', 'render-colour', 'cladding']);
/** Balcony slab and balustrade colours: white concrete, glass (a pale grey-blue sheet), dark steel, a coloured rail. */
export const BALCONY_HEX: Readonly<Record<'white' | 'glass' | 'dark' | 'colour', string>> = { white: '#e9e7e1', glass: '#9fb0b8', dark: '#2f3235', colour: '#4f7f7a' };
export const ERKER_GLASS_HEX = '#2c3236';
export const ERKER_FRAME_HEX = '#1c1f22';
/** Balconies, arcades and erkers need a block of three storeys or more. */
export const FEATURE_MIN_HEIGHT_M = 9;

/** The bay preset the walls draw (bayLook.ts maps it to BAY_STYLES.modern); null: keep today's preset (its material twin). */
export type PostwarStyle = 'brick' | 'brickDark' | 'smooth' | 'smoothDark' | 'ribbon' | 'tall';
export type StairKind = 'glazed-strip' | 'glazed-tower';
export type ErkerPlan = 'box' | 'canted' | 'round';
export type PostwarKit = {
  cluster: Cluster;
  /** 'read': this lane's eye read; 'measured': an accepted brick-only measurement of an unread pand; 'features' (round 2):
   *  no wall evidence, only features (its own feature read or a read sibling's balconies): the wall stays today's draw. */
  wallSource: 'read' | 'measured' | 'features';
  /** null with wallSource 'features': today's wall, preset and material. */
  family: WallFamily | null; wall: string | null; painted: boolean | null;
  style: PostwarStyle | null;
  /** Geometry the extras draw (components.ts), read pands only; 'loggia' and 'french' are said by the bay cells. */
  balcony: BalconyKind; balconyHex: string; arcade: boolean; erker: ErkerKind; ground: GroundKind;
  window?: WindowKind; frames?: FrameTone;
  /** Round 2: a glazed stair strip or tower over the entrances (feature-reads.json), at most stairCount a wall. */
  stair?: StairKind; stairCount?: number;
  /** Round 2: the read's erker plan and count (feature-reads.json); absent: round 1's placement. */
  erkerPlan?: ErkerPlan; erkerCount?: number;
  /** Round 2: where the balconies came from when not the pand's own read: a read sibling of the same complex. */
  balconyFrom?: string;
};

/** Round 2 feature reads (scripts/postwar-kit/feature-reads.ts): usable, high-confidence reads of sampled members. */
export type FeatureRead = { balcony?: 'projecting' | 'round' | 'band'; balconyTone?: string; stair?: StairKind; stairCount?: number; erker?: Exclude<ErkerKind, 'none'>; erkerPlan?: ErkerPlan; erkerCount?: number };
export type SiblingRead = { balcony: 'projecting' | 'round' | 'band'; balconyTone: string; from: string };
const ID16 = /^\d{16}$/;
export function validateFeatures(set: { schemaVersion: number; features: Record<string, FeatureRead> }): Record<string, FeatureRead> {
  if (set?.schemaVersion !== 1) throw new Error('postwar feature reads: bad schema');
  for (const [id, f] of Object.entries(set.features)) {
    if (!ID16.test(id) || (f.balcony && !['projecting', 'round', 'band'].includes(f.balcony)) || (f.stair && !['glazed-strip', 'glazed-tower'].includes(f.stair))
      || (f.erker && !['dark-glass', 'white-glass', 'brick'].includes(f.erker)) || (f.erkerPlan && !['box', 'canted', 'round'].includes(f.erkerPlan))) throw new Error(`postwar feature reads: bad row ${id}`);
  }
  return set.features;
}
export function validateSiblings(set: { schemaVersion: number; siblings: Record<string, SiblingRead> }): Record<string, SiblingRead> {
  if (set?.schemaVersion !== 1) throw new Error('postwar siblings: bad schema');
  for (const [id, f] of Object.entries(set.siblings)) if (!ID16.test(id) || !ID16.test(f.from) || !['projecting', 'round', 'band'].includes(f.balcony)) throw new Error(`postwar siblings: bad row ${id}`);
  return set.siblings;
}
const FEATURE_READS = validateFeatures(FEATURES as never);
const SIBLING_READS = validateSiblings(SIBLINGS as never);
export const FEATURE_READ_COUNT = Object.keys(FEATURE_READS).length, SIBLING_COUNT = Object.keys(SIBLING_READS).length;
const toneHex = (tone: string | null | undefined) => tone === 'glass' ? BALCONY_HEX.glass : tone === 'dark' ? BALCONY_HEX.dark : tone === 'colour' ? BALCONY_HEX.colour : BALCONY_HEX.white;

type WallSet = { schemaVersion: 1; revision: string; walls: Record<string, string> };
const CODE = /^[bp][0-9a-f]{6}$/;
export function validateWalls(set: WallSet): WallSet {
  if (set?.schemaVersion !== 1 || typeof set.walls !== 'object') throw new Error('postwar corrected walls: bad schema');
  for (const [id, code] of Object.entries(set.walls)) if (!/^\d{16}$/.test(id) || !CODE.test(code)) throw new Error(`postwar corrected walls: bad row ${id} ${code}`);
  return set;
}
const WALLS = validateWalls(CORRECTED as unknown as WallSet).walls;
const shortId = (id: string) => id.startsWith('NL.IMBAG.Pand.') ? id.slice(14) : id;
/** A pand's brick-only measured wall, or null. */
export function correctedWall(id: string): { hex: string; painted: boolean } | null {
  const code = WALLS[shortId(id)];
  return code ? { hex: `#${code.slice(1)}`, painted: code[0] === 'p' } : null;
}
export const CORRECTED_WALL_COUNT = Object.keys(WALLS).length;

const lab = (hex: string) => rgbToLab([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
/** The family a measured swatch belongs to. */
export function familyOfHex(hex: string, painted: boolean): WallFamily {
  const [L, a, b] = lab(hex);
  if (painted) return Math.hypot(a, b) > 12 ? 'render-colour' : 'render-white';
  // Buff: light and yellow, or (round 3) a yellow hue at mid lightness: the buff calibration's grey-buff (wallPatch.ts BUFF).
  // Red and brown brick calibrate to hue <= 56 deg, so they never reach the hue test.
  const hue = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  if ((L >= 58 && b >= 15) || (L >= 40 && hue >= 70 && hue <= 110 && Math.hypot(a, b) >= 6)) return 'brick-buff';
  if (Math.hypot(a, b) < 8) return 'brick-grey';
  if (L < 36) return 'brick-dark';
  return a >= 16 ? 'brick-red' : 'brick-brown';
}
/** Warm brick | buff | grey | paint: the level at which a measurement must agree with a read to replace its swatch. */
export const coarseFamily = (f: WallFamily) => f === 'brick-red' || f === 'brick-brown' || f === 'brick-dark' ? 'warm' : f === 'brick-buff' ? 'buff' : f === 'brick-grey' ? 'grey' : 'paint';

/** Bay preset for a wall material, window shape and frame tone. */
export function styleFor(painted: boolean, window: WindowKind, frames: FrameTone): PostwarStyle {
  if (window === 'strip') return 'ribbon';
  if (!painted && window === 'tall') return 'tall';
  if (painted) return frames === 'dark' ? 'smoothDark' : 'smooth';
  return frames === 'dark' ? 'brickDark' : 'brick';
}

export type PostwarFacts = { id: string; year: number | null; heightM: number; use: string };

/** The kit's read of a dated 1965+ housing pand with evidence, or null (no evidence, no year, before 1965, not housing). */
export function postwarKitFor(f: PostwarFacts): PostwarKit | null {
  if (f.year === null || !Number.isFinite(f.year) || f.use !== 'housing') return null;
  const cluster = clusterFor(f.year, f.heightM);
  if (!cluster) return null;
  const read = measuredFront(f.id), measured = correctedWall(f.id);
  const short = shortId(f.id), feat = FEATURE_READS[short], sib = SIBLING_READS[short];
  const tall = f.heightM >= FEATURE_MIN_HEIGHT_M;
  // Round 2 extras from the feature read: stairs and erkers (a read's own erker wins), only on blocks of three storeys.
  const extras = (erker: ErkerKind): Partial<PostwarKit> => ({
    ...(feat?.stair && tall ? { stair: feat.stair, stairCount: feat.stairCount ?? 1 } : {}),
    ...(erker === 'none' && feat?.erker && tall ? { erker: feat.erker, erkerPlan: feat.erkerPlan ?? 'box', erkerCount: feat.erkerCount ?? 1 } : {}),
  });
  if (!read) {
    // Balconies: the pand's own feature read, else a read sibling in the same complex (siblings.ts).
    const own = feat?.balcony ? { balcony: feat.balcony, tone: feat.balconyTone } : sib ? { balcony: sib.balcony, tone: sib.balconyTone, from: sib.from } : null;
    const bal: Partial<PostwarKit> = own && tall ? { balcony: own.balcony, balconyHex: toneHex(own.tone), ...('from' in own && own.from ? { balconyFrom: own.from } : {}) } : {};
    const more = extras('none');
    const hasFeatures = !!bal.balcony || !!more.stair || !!more.erker;
    if (!measured && !hasFeatures) return null;
    const wall = measured ? { family: familyOfHex(measured.hex, measured.painted), wall: measured.hex, painted: measured.painted, wallSource: 'measured' as const }
      : { family: null, wall: null, painted: null, wallSource: 'features' as const };
    return { cluster, ...wall, style: null, balcony: 'none', balconyHex: BALCONY_HEX.white, arcade: false, erker: 'none', ground: 'plain', ...bal, ...more };
  }
  const agrees = measured && coarseFamily(familyOfHex(measured.hex, measured.painted)) === coarseFamily(read.wall);
  const sw = FAMILY_SWATCHES[read.wall];
  const wall = agrees ? measured!.hex : sw[Math.floor(unitDraw(f.id, 'postwar-swatch') * sw.length)];
  const painted = PAINTED_FAMILIES.has(read.wall);
  const balcony: BalconyKind = tall || read.balcony === 'french' ? read.balcony : 'none';
  const balconyHex = toneHex(read.balconyTone ?? 'white');
  return { cluster, wallSource: 'read', family: read.wall, wall, painted, window: read.window, frames: read.frames,
    style: styleFor(painted, balcony === 'french' && !painted ? 'tall' : read.window, read.frames),
    balcony, balconyHex, arcade: tall && read.ground === 'arcade', erker: tall ? read.erker : 'none', ground: read.ground, ...extras(tall ? read.erker : 'none') };
}

/** The extras ids the kit forces for a read (components.ts). */
export function postwarExtraIds(k: PostwarKit): string[] {
  const ids: string[] = [];
  if (k.balcony === 'band') ids.push('postwar-balcony-band');
  if (k.balcony === 'round') ids.push('postwar-round-balconies');
  if (k.balcony === 'projecting') ids.push('postwar-projecting-balconies');
  if (k.arcade) ids.push('postwar-arcade');
  if (k.erker === 'dark-glass') ids.push('postwar-dark-erkers');
  if (k.erker === 'white-glass') ids.push('postwar-white-erkers');
  if (k.erker === 'brick') ids.push('postwar-brick-erkers');
  if (k.stair) ids.push('postwar-stair-glazing');
  return ids;
}

/** Per-cluster counts (reports, tests). */
export const clusterDistribution = (c: Cluster) => CLUSTER_DISTRIBUTION[c];
export { distributionOf };
