/**
 * Carved claw pieces (klauwstukken) on a belt neck gable, as scrolls (belt kit roofs lane, 2026-11-21). The kit drew a
 * carved claw as a flat stone band along the shoulder with a quarter round against the neck: "flat grey slabs" on
 * Herengracht 16, 28, 44, 46, 64 and 84's neighbours. The photos (Herengracht 16, 28, 64 crops) show each claw as one
 * carved sandstone piece standing on the gable's foot beside the neck:
 *   - a low band along the foot from the neck out to the front's edge (a quarter of its height), ending in a large curl;
 *   - from that band a concave sweep rising in to the neck (the C of the scroll), the sky showing outside it;
 *   - an upright part against the neck (its waist) up to the claw's top, and an ear curling out at the top.
 * Its height is the read's claw-top landmark (plotRead.ts `shoulder`), its reach the neck-to-edge span, its face proud of
 * the brick.
 *
 * Pure: the pieces as outlines in the crown's plane (x across, the neck side at |x| = neck; y over the crown's foot) with
 * how proud each stands and its shade; crownProfile.ts draws them as stone. Absent (`RowCrown.claw` unset): nothing here
 * runs and the stock carved claw is drawn, byte for byte.
 */
import type { V2 } from '../roofSink.js';

export interface ClawScroll {
  /** The claw's top over the shoulders' foot at the neck (m), as measured (the read's claw-top landmark). */
  heightM: number;
  /** How far it reaches out from the neck (m); absent: to the crown's foot (the front's edge). */
  reachM?: number;
  /** The upright part's width against the neck, as a share of the reach (0.08-0.45). */
  waist?: number;
  /** The low band's height at the outer end, as a share of the height (0.12-0.4). */
  band?: number;
  /** How far the piece's face stands proud of the brick (m). */
  proudM?: number;
}

/** The scroll's stock proportions, from the Herengracht 16, 28 and 64 crops (each claw's waist 0.1-0.28 of its reach at
 *  0.6 of its height, the foot band 0.22-0.28 of its height, the curls about half the band). */
export const CLAW_SCROLL = { waist: 0.2, band: 0.25, proudM: 0.14, minH: 0.6, maxH: 4.5, curl: 0.5, ear: 0.55, seg: 14,
  /** The sweep's superellipse exponent: 3 fits Herengracht 16's claw (0.43 and 0.3 of its height at 0.39 and 0.67 of its
   *  reach, measured 0.39 and 0.29; a quarter ellipse gives 0.57 and 0.36). */
  hollow: 3 } as const;

export type ClawPiece =
  | { kind: 'block'; pts: V2[]; proud: number; shade: number }
  | { kind: 'volute'; cx: number; cy: number; r: number; proud: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The claw's silhouette top over the foot at a share `u` of its reach out from the neck (0 at the neck, 1 at its end):
 *  the upright part to the waist, then a concave quarter superellipse (CLAW_SCROLL.hollow) down to the band. */
export function clawTop(u: number, h: number, waist: number, band: number): number {
  if (u <= waist) return h;
  const p = CLAW_SCROLL.hollow, s = clamp((u - waist) / (1 - waist), 0, 1);
  // Centred at (1, h): from (waist, h) down to (1, band * h), hugging the corner at (waist, band * h).
  return h - (h - band * h) * (1 - (1 - s) ** p) ** (1 / p);
}

/**
 * The pieces of one claw on side `sg` (-1 left, +1 right as the profile runs) of a neck `neck` half-wide, the crown's
 * foot `foot` half-wide, standing on `base` (the shoulders' foot: the foot, or an elevated neck's rise). `under(x)` is the
 * outline's height at x (the brick shoulder), which the piece always covers.
 */
export function clawScrollPieces(cs: ClawScroll, sg: -1 | 1, neck: number, foot: number, base: number, under: (x: number) => number): ClawPiece[] {
  const h = clamp(cs.heightM, CLAW_SCROLL.minH, CLAW_SCROLL.maxH), reach = clamp(cs.reachM ?? foot - neck, 0.3, Math.max(0.3, foot - neck));
  const waist = clamp(cs.waist ?? CLAW_SCROLL.waist, 0.08, 0.45), band = clamp(cs.band ?? CLAW_SCROLL.band, 0.12, 0.4), proud = clamp(cs.proudM ?? CLAW_SCROLL.proudM, 0.04, 0.4);
  const n = CLAW_SCROLL.seg, out: ClawPiece[] = [];
  const X = (u: number) => sg * (neck + u * reach);
  // The body: vertical strips from the foot to the silhouette (each a convex quad), never under the brick shoulder.
  const us = [0, ...Array.from({ length: n }, (_, i) => waist + (1 - waist) * (i / (n - 1)) ** 0.8)];
  const top = (u: number) => Math.max(base + clawTop(u, h, waist, band), under(X(u)) + 0.08);
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i], b = us[i + 1];
    if (b - a < 1e-6) continue;
    const xa = X(a), xb = X(b);
    out.push({ kind: 'block', pts: sg > 0 ? [[xa, base], [xb, base], [xb, top(b)], [xa, top(a)]] : [[xb, base], [xa, base], [xa, top(a)], [xb, top(b)]], proud, shade: 1 });
  }
  // The carving: a darker channel just inside the sweep (the scroll's moulded edge), so the C reads in relief.
  const ch = Math.min(0.12, reach * 0.08);
  for (let i = 1; i < n - 2; i++) {
    const a = waist + (1 - waist) * ((i / (n - 1)) ** 0.8), b = waist + (1 - waist) * (((i + 1) / (n - 1)) ** 0.8);
    const ya = base + clawTop(a, h, waist, band), yb = base + clawTop(b, h, waist, band);
    if (ya - base < 2.2 * ch || yb - base < 2.2 * ch) continue;
    const xa = X(a) - sg * ch, xb = X(b) - sg * ch;
    const q: V2[] = [[xa, ya - ch], [xb, yb - ch], [xb, yb - 2 * ch], [xa, ya - 2 * ch]];
    out.push({ kind: 'block', pts: sg > 0 ? q : [q[1], q[0], q[3], q[2]], proud: proud + 0.012, shade: 0.8 });
  }
  // The upright's moulded edge up the neck side.
  const ew = Math.min(0.08, waist * reach * 0.35), yw = base + h * 0.45;
  if (waist * reach > 0.2) out.push({ kind: 'block', pts: sg > 0 ? [[X(waist) - ew, yw], [X(waist) - 0.01, yw], [X(waist) - 0.01, base + h - 0.15], [X(waist) - ew, base + h - 0.15]]
    : [[X(waist) + 0.01, yw], [X(waist) + ew, yw], [X(waist) + ew, base + h - 0.15], [X(waist) + 0.01, base + h - 0.15]], proud: proud + 0.012, shade: 0.82 });
  // The curl at the band's outer end, standing on the band; the ear at the top, curling out from the waist.
  const rc = clamp(band * h * CLAW_SCROLL.curl, 0.14, 0.42);
  out.push({ kind: 'volute', cx: X(1) - sg * rc * 1.05, cy: base + band * h, r: rc, proud: proud + 0.03 });
  const re = clamp(waist * reach * CLAW_SCROLL.ear + 0.05, 0.1, 0.26);
  out.push({ kind: 'volute', cx: X(waist) + sg * re * 0.6, cy: base + h - re * 0.7, r: re, proud: proud + 0.03 });
  // Leaves down the sweep: three lit lobes, smaller toward the band.
  for (let k = 0; k < 3; k++) {
    const u = waist + (1 - waist) * (0.18 + k * 0.22), y = base + clawTop(u, h, waist, band) * (0.55 - k * 0.08), r = clamp(reach * (0.09 - k * 0.015), 0.07, 0.16);
    if (y - r > base + 0.05) out.push({ kind: 'block', pts: Array.from({ length: 8 }, (_, i): V2 => [X(u) - sg * r * 0.6 + r * Math.cos(Math.PI * i / 4), y + r * 0.8 * Math.sin(Math.PI * i / 4)]), proud: proud + 0.02, shade: 0.9 });
  }
  return out;
}
