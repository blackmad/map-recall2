/**
 * The post-1965 housing kit's wall components (`?postwarKit=1`, kit.ts). Never dice (p 0): a pand's kit read forces
 * them through `registerForce` (threeBuildingFeatures.ts), on street walls only. In the registry only with the flag on
 * (facadeExtras.ts), so the component list, and every wall, is byte-identical without it.
 *
 *   - postwar-balcony-band: a slab and a balustrade the length of the wall on every upper storey (Zeeburgerdijk 275-375,
 *     Th. K. van Lohuizenlaan, Amstelboulevard, Geuzenkade): 14 triangles a storey.
 *   - postwar-round-balconies: stacked rounded balconies, two stepped boxes in plan, on one or two axes (Pentagon,
 *     Sint Antoniesbreestraat 39-67, Marcantilaan, Eerste Weteringplantsoen): 20 triangles a balcony.
 *   - postwar-projecting-balconies: slab-and-rail balconies on alternate window axes (Molukkenstraat, Mary van der
 *     Sluisstraat): 14 triangles each, at most two a storey.
 *   - postwar-arcade: the ground storey drawn as a dark recess behind piers under a beam (Pentagon, Haarlemmer
 *     Houttuinen, Sint Antoniesbreestraat, Amstelboulevard).
 *   - postwar-dark-erkers: full-height dark-glass bays with dark storey frames (Marnixstraat 125-127, Weteringschans 81-89).
 */
import type { ExtraContext, ExtraSink, WallComponent } from '../facadeExtraCore.js';
import { storeyZ, windowSpans } from '../facadeOrnaments.js';
import { ERKER_FRAME_HEX, ERKER_GLASS_HEX } from './kit.js';

const STYLES = ['postwar', 'modern', 'tower'] as const;
export const BAND = { depth: 1.3, slab: 0.18, rail: 1.0, inset: 0.3, maxStoreys: 8 } as const;
export const ROUND = { steps: [[1.55, 0.75], [0.95, 1.25]] as const, slab: 0.16, rail: 1.0, maxStoreys: 6 } as const;
export const PROJECT = { halfW: 1.2, depth: 1.1, slab: 0.16, rail: 1.0, perStorey: 2, maxStoreys: 6 } as const;
export const ARCADE = { beam: 0.45, pier: 0.45, pitch: 3.6, recess: '#2b2a28', maxPiers: 14 } as const;
export const ERKER = { halfW: 1.2, depth: 0.6, frame: 0.12, maxStoreys: 6 } as const;

const upperStoreys = (c: ExtraContext, cap: number) => Math.max(0, Math.min(cap, c.layout.storeys));
/** Window axes of the first upper storey, nearest the wall's centre first. */
const axes = (c: ExtraContext) => windowSpans(c, 0).map(w => w.x).sort((a, b) => Math.abs(a - c.f.len / 2) - Math.abs(b - c.f.len / 2) || a - b);

export function balconyBand(c: ExtraContext, s: ExtraSink): void {
  const hex = c.postwarKit?.balconyHex;
  if (!hex || c.f.len < 3) return;
  const a0 = BAND.inset, a1 = c.f.len - BAND.inset;
  for (let k = 0; k < upperStoreys(c, BAND.maxStoreys); k++) {
    const z = storeyZ(c, k);
    if (z + BAND.rail > c.top - 0.2) break;
    s.box(c.f, a0, a1, 0, BAND.depth, z - BAND.slab, z, '#d8d5ce', true);
    s.strip(c.f, a0, a1, BAND.depth, z, z + BAND.rail, hex, 0.06);
  }
}

export function roundBalconies(c: ExtraContext, s: ExtraSink): void {
  const hex = c.postwarKit?.balconyHex;
  if (!hex || c.f.len < 4) return;
  const xs = axes(c).filter(x => x - ROUND.steps[0][0] > 0.1 && x + ROUND.steps[0][0] < c.f.len - 0.1);
  if (!xs.length) return;
  // One stack on a short wall, two on a long one, spread apart.
  const picks = c.f.len < 14 ? [xs[0]] : [xs.reduce((a, b) => b < a ? b : a), xs.reduce((a, b) => b > a ? b : a)];
  for (let k = 0; k < upperStoreys(c, ROUND.maxStoreys); k++) {
    const z = storeyZ(c, k);
    if (z + ROUND.rail > c.top - 0.2) break;
    for (const x of picks) for (const [hw, d] of ROUND.steps) s.box(c.f, x - hw, x + hw, 0, d, z - ROUND.slab, z + ROUND.rail, hex, true);
  }
}

export function projectingBalconies(c: ExtraContext, s: ExtraSink): void {
  const hex = c.postwarKit?.balconyHex;
  if (!hex) return;
  const xs = axes(c).filter(x => x - PROJECT.halfW > 0.05 && x + PROJECT.halfW < c.f.len - 0.05).sort((a, b) => a - b);
  const every = xs.filter((_, i) => i % 2 === 0).slice(0, PROJECT.perStorey);
  for (let k = 0; k < upperStoreys(c, PROJECT.maxStoreys); k++) {
    const z = storeyZ(c, k);
    if (z + PROJECT.rail > c.top - 0.2) break;
    for (const x of every) {
      s.box(c.f, x - PROJECT.halfW, x + PROJECT.halfW, 0, PROJECT.depth, z - PROJECT.slab, z, '#d8d5ce', true);
      s.strip(c.f, x - PROJECT.halfW, x + PROJECT.halfW, PROJECT.depth, z, z + PROJECT.rail, hex, 0.06);
    }
  }
}

export function arcade(c: ExtraContext, s: ExtraSink): void {
  const pier = c.postwarKit?.pierHex;
  if (!pier || !c.groundLevel || c.f.len < 5) return;
  const z0 = c.base, z1 = c.base + c.layout.groundM, zb = z1 - ARCADE.beam;
  // The recess: a dark plate over the ground cell, the piers and the beam proud of it.
  s.strip(c.f, 0.05, c.f.len - 0.05, 0.03, z0, zb, ARCADE.recess);
  const n = Math.min(ARCADE.maxPiers, Math.max(2, Math.round(c.f.len / ARCADE.pitch) + 1));
  for (let i = 0; i < n; i++) {
    const x = ARCADE.pier / 2 + (c.f.len - ARCADE.pier) * i / (n - 1);
    s.box(c.f, x - ARCADE.pier / 2, x + ARCADE.pier / 2, 0, 0.12, z0, zb, pier);
  }
  s.box(c.f, 0, c.f.len, 0, 0.14, zb, z1, pier, true);
}

export function darkErkers(c: ExtraContext, s: ExtraSink): void {
  const xs = axes(c).filter(x => x - ERKER.halfW > 0.3 && x + ERKER.halfW < c.f.len - 0.3);
  if (!xs.length || c.layout.storeys < 2) return;
  const picks = c.f.len < 16 ? [xs[0]] : [xs.reduce((a, b) => b < a ? b : a), xs.reduce((a, b) => b > a ? b : a)];
  const n = upperStoreys(c, ERKER.maxStoreys), z0 = storeyZ(c, 0) - 0.1, z1 = Math.min(c.top - 0.3, storeyZ(c, n));
  if (z1 - z0 < 2) return;
  for (const x of picks) {
    s.box(c.f, x - ERKER.halfW, x + ERKER.halfW, 0, ERKER.depth, z0, z1, ERKER_GLASS_HEX, true);
    for (let k = 0; k <= n; k++) {
      const z = Math.min(z1 - ERKER.frame, storeyZ(c, k) - 0.1);
      s.strip(c.f, x - ERKER.halfW, x + ERKER.halfW, ERKER.depth + 0.01, z, z + ERKER.frame, ERKER_FRAME_HEX);
    }
  }
}

export const POSTWAR_COMPONENTS: readonly WallComponent[] = [
  { id: 'postwar-balcony-band', styles: STYLES, p: 0, wide: true, street: true, group: 'balcony', build: (c, s) => balconyBand(c, s) },
  { id: 'postwar-round-balconies', styles: STYLES, p: 0, wide: true, street: true, group: 'balcony', build: (c, s) => roundBalconies(c, s) },
  { id: 'postwar-projecting-balconies', styles: STYLES, p: 0, wide: true, street: true, group: 'balcony', build: (c, s) => projectingBalconies(c, s) },
  { id: 'postwar-arcade', styles: STYLES, p: 0, wide: true, street: true, group: 'postwar-ground', build: (c, s) => arcade(c, s) },
  { id: 'postwar-dark-erkers', styles: STYLES, p: 0, wide: true, street: true, group: 'oriel', build: (c, s) => darkErkers(c, s) },
];
export const POSTWAR_COMPONENT_IDS: ReadonlySet<string> = new Set(POSTWAR_COMPONENTS.map(c => c.id));
