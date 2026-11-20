/**
 * The post-1965 housing kit (`?postwarKit=1`, lane postwar-housing-kit-20261120): what the generic path draws for a dated
 * 1965+ housing block, by era (the backlog's clusters) and by neighbourhood, from the fronts read in facts.ts.
 *
 * Order of evidence, best first:
 *   1. this lane's own read of the pand (measured-fronts.json): family, balcony, ground, window, frames, erker;
 *   2. the pand's own T0 panorama wall (buurtProfiles/modernPandWalls.ts) when it reads as a plausible wall: a paint swatch
 *      at L* >= 80, or a brick swatch at 30 <= L* <= 70 with a* >= 8. The T0 sampler averaged windows and loggias into the
 *      wall: on the 60 read fronts its dark grey or white "own" walls sat on red-brown brick (Bloemgracht 210-286 #7a7c7e
 *      paint, Wibautstraat 31-55 #372622). Implausible ones fall through to (3);
 *   3. today's wall (the #117 vocabulary's buurt draw or the contemporary family's) when it is a plausible warm brick by
 *      the same band and not pink: those draws come from measured local walls, and the first blind frames showed the kit's
 *      own draw replacing a right red-brown with a wrong buff;
 *   4. a draw by the cluster's measured frequencies, blended with the read fronts within LOCAL_M (a same-cluster
 *      neighbour counts LOCAL_SAME, another post-1965 one LOCAL_OTHER): David's ruling (2026-11-14) is a plausible family by
 *      judgement and neighbours, never a hold on colour. It replaces grey, near-black, white-on-brick and pink draws.
 *
 * Balconies, arcades and erkers on an unread pand come only from its neighbours: the weighted share of read fronts within
 * LOCAL_M that show one, against FEATURE_PRIOR of none (no read neighbour: none). A city-wide draw put balcony bands on fronts without them.
 *
 * Deterministic per pand id. Off (the default), nothing calls this and every building is byte-identical.
 */
import { unitDraw } from '../buurtProfiles/profiles.js';
import { rgbToLab } from '../look/brickTone.js';
import type { OwnWall } from '../buurtProfiles/modernPandWalls.js';
import {
  CLUSTER_DISTRIBUTION, MEASURED_FRONTS, clusterFor, distributionOf, measuredFront,
  type BalconyKind, type Cluster, type Counts, type ErkerKind, type FrameTone, type GroundKind, type ReadFront, type WallFamily, type WindowKind,
} from './facts.js';

export { postwarKitEnabled } from './flag.js';

/** Photo-look swatches per family, judged against the read fronts in diffuse light; brick kept to L* <= 72. */
export const FAMILY_SWATCHES: Readonly<Record<WallFamily, readonly string[]>> = {
  'brick-red': ['#94503e', '#9a5240', '#8a4a3a', '#a35c46'],
  'brick-brown': ['#7e5a48', '#86624f', '#74533f', '#8c6a56'],
  'brick-dark': ['#5c4038', '#523a33', '#634539', '#4c3732'],
  // Buff darkened after the first blind frames: '#b39274'-'#c2a888' drew peach at OKLab L 0.78 beside photos at 0.5.
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

/** Neighbourhood reach and weights (see the header). */
export const LOCAL_M = 500;
export const LOCAL_SAME = 3;
export const LOCAL_OTHER = 1;
/** Balconies, arcades and erkers need a block of three storeys or more. */
export const FEATURE_MIN_HEIGHT_M = 9;
/** Pseudo-weight of 'none' in an unread pand's neighbourhood feature draw (cost.ts: without it, 268 erkers in six tiles). */
export const FEATURE_PRIOR = 9;

/** The bay preset the walls draw (bayLook.ts maps it to BAY_STYLES.modern). */
export type PostwarStyle = 'brick' | 'brickDark' | 'smooth' | 'smoothDark' | 'ribbon' | 'tall';
export type PostwarKit = {
  cluster: Cluster;
  /** 'measured': this lane's read; 'own': the T0 own wall passed the plausibility band; 'today': today's draw is a plausible
   *  warm brick and stays; 'drawn': cluster x neighbourhood. */
  wallSource: 'measured' | 'own' | 'today' | 'drawn';
  family: WallFamily; wall: string; painted: boolean;
  window: WindowKind; frames: FrameTone; style: PostwarStyle;
  /** Geometry the extras draw (components.ts); 'loggia' and 'french' are said by the bay cells, not geometry. */
  balcony: BalconyKind; balconyHex: string; arcade: boolean; erker: ErkerKind;
  /** The ground storey the photos show; only 'arcade' is drawn. */
  ground: GroundKind;
};

const lab = (hex: string) => rgbToLab([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
/** Whether a T0 own wall reads as a wall rather than a window-and-loggia average. */
export function plausibleOwnWall(own: OwnWall): boolean {
  const [L, a] = lab(own.hex);
  return own.painted ? L >= 80 : L >= 30 && L <= 70 && a >= 8;
}
/** Whether today's draw is a warm brick the kit keeps: the own-wall brick band, and not pink (L* > 60 with a* > 20). */
export function plausibleTodayWall(today: OwnWall): boolean {
  const [L, a] = lab(today.hex);
  return !today.painted && L >= 30 && L <= 70 && a >= 8 && !(L > 60 && a > 20);
}
/** The family an accepted own swatch belongs to (for the bay preset and the counts). */
export function familyOfHex(hex: string, painted: boolean): WallFamily {
  const [L, a, b] = lab(hex);
  if (painted) return Math.hypot(a, b) > 12 ? 'render-colour' : 'render-white';
  if (L >= 58 && b >= 15) return 'brick-buff';
  if (Math.hypot(a, b) < 8) return 'brick-grey';
  if (L < 36) return 'brick-dark';
  return a >= 16 ? 'brick-red' : 'brick-brown';
}

const metres = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot((a[0] - b[0]) * 67_900, (a[1] - b[1]) * 111_200);
/** The read fronts near a point (excluding `id`), with their weight. */
export function neighbours(id: string, at: readonly [number, number] | undefined, cluster: Cluster): Array<{ r: ReadFront; w: number }> {
  if (!at) return [];
  const self = id.startsWith('NL.IMBAG.Pand.') ? id.slice(14) : id;
  return MEASURED_FRONTS.filter(r => r.id !== self && metres(r.at, at) <= LOCAL_M).map(r => ({ r, w: r.cluster === cluster ? LOCAL_SAME : LOCAL_OTHER }));
}
/** The cluster's counts plus the weighted neighbours' for one field. */
export function blended<K extends string>(base: Counts<K>, near: ReadonlyArray<{ r: ReadFront; w: number }>, key: (r: ReadFront) => K): Array<[K, number]> {
  const out = new Map<K, number>(Object.entries(base) as Array<[K, number]>);
  for (const { r, w } of near) out.set(key(r), (out.get(key(r)) ?? 0) + w);
  return [...out.entries()].filter(([, w]) => w > 0).sort((p, q) => p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0);
}
export function pickOf<K extends string>(options: ReadonlyArray<[K, number]>, unit: number): K {
  const total = options.reduce((s, [, w]) => s + w, 0);
  let x = unit * total;
  for (const [k, w] of options) { if (x < w) return k; x -= w; }
  return options[options.length - 1][0];
}

/** Bay preset for a wall material, window shape and frame tone. */
export function styleFor(painted: boolean, window: WindowKind, frames: FrameTone): PostwarStyle {
  if (window === 'strip') return 'ribbon';
  if (!painted && window === 'tall') return 'tall';
  if (painted) return frames === 'dark' ? 'smoothDark' : 'smooth';
  return frames === 'dark' ? 'brickDark' : 'brick';
}

export type PostwarFacts = { id: string; year: number | null; heightM: number; use: string; at?: readonly [number, number]; own?: OwnWall | null; /** Today's wall without the kit (bayLook's vocabulary or contemporary draw). */ today?: OwnWall | null };

/** The kit's read of a dated 1965+ housing pand, or null (no year, before 1965, not housing). */
export function postwarKitFor(f: PostwarFacts): PostwarKit | null {
  if (f.year === null || !Number.isFinite(f.year) || f.use !== 'housing') return null;
  const cluster = clusterFor(f.year, f.heightM);
  if (!cluster) return null;
  const read = measuredFront(f.id);
  const near = read ? [] : neighbours(f.id, f.at, cluster);
  const base = CLUSTER_DISTRIBUTION[cluster];
  const draw = <K extends string>(field: keyof typeof base & string, key: (r: ReadFront) => K) => pickOf(blended(base[field] as Counts<K>, near, key), unitDraw(f.id, `postwar-${field}`));
  let family: WallFamily, wall: string, wallSource: PostwarKit['wallSource'];
  if (read) {
    family = read.wall; wallSource = 'measured';
    const sw = FAMILY_SWATCHES[family]; wall = sw[Math.floor(unitDraw(f.id, 'postwar-swatch') * sw.length)];
  } else if (f.own && plausibleOwnWall(f.own)) {
    family = familyOfHex(f.own.hex, f.own.painted); wall = f.own.hex; wallSource = 'own';
  } else if (f.today && plausibleTodayWall(f.today)) {
    family = familyOfHex(f.today.hex, false); wall = f.today.hex; wallSource = 'today';
  } else {
    family = draw('wall', r => r.wall); wallSource = 'drawn';
    const sw = FAMILY_SWATCHES[family]; wall = sw[Math.floor(unitDraw(f.id, 'postwar-swatch') * sw.length)];
  }
  const painted = PAINTED_FAMILIES.has(family);
  const window: WindowKind = read ? read.window : draw('window', r => r.window);
  const frames: FrameTone = read ? read.frames : draw('frames', r => r.frames);
  const tall = f.heightM >= FEATURE_MIN_HEIGHT_M;
  // Features of an unread pand: its neighbours' weighted shares only (localDraw), none without read neighbours.
  const localDraw = <K extends string>(key: (r: ReadFront) => K, none: K, salt: string): K => {
    if (!near.length) return none;
    // FEATURE_PRIOR of 'none' first: one read neighbour with an erker (weight 3) gives a 25 % draw, not 100 %.
    const out = new Map<K, number>([[none, FEATURE_PRIOR]]);
    for (const { r, w } of near) out.set(key(r), (out.get(key(r)) ?? 0) + w);
    return pickOf([...out.entries()].sort((p, q) => p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0), unitDraw(f.id, salt));
  };
  let balcony: BalconyKind = read ? read.balcony : localDraw(r => r.balcony, 'none', 'postwar-balcony');
  const ground: GroundKind = read ? read.ground : localDraw(r => r.ground, 'plain', 'postwar-ground');
  let erker: ErkerKind = read ? read.erker : localDraw(r => r.erker, 'none', 'postwar-erker');
  if (!tall) { balcony = balcony === 'french' ? 'french' : 'none'; erker = 'none'; }
  const tone = read?.balconyTone ?? (balcony === 'band' ? (unitDraw(f.id, 'postwar-band-tone') < 0.5 ? 'glass' : 'white') : balcony === 'projecting' && unitDraw(f.id, 'postwar-rail') < 0.3 ? 'dark' : 'white');
  const balconyHex = tone === 'glass' ? BALCONY_HEX.glass : tone === 'dark' ? BALCONY_HEX.dark : tone === 'colour' ? BALCONY_HEX.colour : BALCONY_HEX.white;
  const style = styleFor(painted, balcony === 'french' && !painted ? 'tall' : window, frames);
  return { cluster, wallSource, family, wall, painted, window, frames, style, balcony, balconyHex, arcade: tall && ground === 'arcade', erker, ground };
}

/** The extras ids the kit forces for a read (components.ts). */
export function postwarExtraIds(k: PostwarKit): string[] {
  const ids: string[] = [];
  if (k.balcony === 'band') ids.push('postwar-balcony-band');
  if (k.balcony === 'round') ids.push('postwar-round-balconies');
  if (k.balcony === 'projecting') ids.push('postwar-projecting-balconies');
  if (k.arcade) ids.push('postwar-arcade');
  if (k.erker === 'dark-glass') ids.push('postwar-dark-erkers');
  return ids;
}

/** Per-cluster counts (reports, tests). */
export const clusterDistribution = (c: Cluster) => CLUSTER_DISTRIBUTION[c];
export { distributionOf };
