/**
 * Seeded blotches on the solid parts of a front: small irregular patches of a second tone, each made of a core rectangle and
 * up to two lobes that abut it (never overlap), scattered over host rectangles (the front faces of piers and ledges) until a
 * share of their area is covered.
 *
 * Why (2026-11-22, landmarks round 11): the 2009 tower and block of Pakhuis Afrika (Oostelijke Handelskade) are a pale grey
 * precast skin with red-brown blotches 0.2-0.8 m across, about a fifth of the solid surface (Gemeente Amsterdam panoramas
 * TMX7316010203-001195_pano_0000_003229 2019 overcast, TMX7316010203-001667_pano_0000_001352 2020 sunlit). rasterFront's
 * `mottle` tones whole pier and ledge runs of 0.5-1.4 m, which read as salmon blocks; the blotches of the photo are smaller
 * than a pier and sit inside it. This draws them as patches on the face instead.
 *
 * Pure geometry, no three.js. Same (t, y) frame as rasterFront.ts: t along the wall from the viewer's left, y up. The caller
 * draws each patch a few cm in front of its host face (geometryAudit's near band, not the z-fight band).
 */
import {seeded} from './rasterFront';

export type SpotRect = {t0: number; t1: number; y0: number; y1: number};
export type MottleSpotsSpec = {
  /** Host faces the patches may cover (pier and ledge fronts). */
  hosts: SpotRect[];
  seed: number;
  /** Target share of the host area covered, 0-1. */
  coverage: number;
  /** Core patch side range (m). Lobes are 35-70 % of the core side they sit on. */
  size: [number, number];
  /** Clear margin kept to the host edges and between patches (m, default 0.04). */
  gap?: number;
  /** Attempts per host per patch before giving up (default 12). */
  tries?: number;
};
/** One blotch: its rectangles (core first), all inside one host, abutting and never overlapping. */
export type Spot = {host: number; rects: SpotRect[]};

const EPS = 1e-9;
const area = (r: SpotRect) => (r.t1 - r.t0) * (r.y1 - r.y0);
const overlaps = (a: SpotRect, b: SpotRect, g: number) => a.t0 < b.t1 + g && b.t0 < a.t1 + g && a.y0 < b.y1 + g && b.y0 < a.y1 + g;
const inside = (r: SpotRect, h: SpotRect, g: number) => r.t0 >= h.t0 + g - EPS && r.t1 <= h.t1 - g + EPS && r.y0 >= h.y0 + g - EPS && r.y1 <= h.y1 - g + EPS;

/** Deterministic blotches per seed. Hosts narrower than the smallest patch plus margins get none. */
export function mottleSpots(spec: MottleSpotsSpec): Spot[] {
  const {hosts, coverage, size: [smin, smax]} = spec;
  if (!(coverage >= 0 && coverage < 1)) throw new Error('mottleSpots: coverage must be in [0, 1)');
  if (!(smin > 0 && smax >= smin)) throw new Error('mottleSpots: size must be positive and ordered');
  const g = spec.gap ?? 0.04, tries = spec.tries ?? 12;
  const rnd = seeded(spec.seed);
  const out: Spot[] = [];
  hosts.forEach((h, hi) => {
    const hw = h.t1 - h.t0 - 2 * g, hh = h.y1 - h.y0 - 2 * g;
    if (hw < smin || hh < smin) return;
    const want = coverage * area(h);
    const placed: SpotRect[] = [];
    let covered = 0, fails = 0;
    while (covered < want && fails < tries) {
      const w = Math.min(hw, smin + rnd() * (smax - smin)), ht = Math.min(hh, smin + rnd() * (smax - smin));
      const t0 = h.t0 + g + rnd() * (hw - w), y0 = h.y0 + g + rnd() * (hh - ht);
      const core: SpotRect = {t0, t1: t0 + w, y0, y1: y0 + ht};
      const rects = [core];
      // up to two lobes on different sides, each abutting the core and offset along it
      const order = [0, 1, 2, 3];
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const sides = order.slice(0, Math.floor(rnd() * 3));
      for (const s of sides) {
        const horiz = s < 2, side = horiz ? w : ht, len = side * (0.35 + rnd() * 0.35), reach = side * (0.25 + rnd() * 0.3);
        const off = rnd() * (side - len);
        const lobe: SpotRect = horiz
          ? {t0: core.t0 + off, t1: core.t0 + off + len, ...(s === 0 ? {y0: core.y1, y1: core.y1 + reach} : {y0: core.y0 - reach, y1: core.y0})}
          : {y0: core.y0 + off, y1: core.y0 + off + len, ...(s === 2 ? {t0: core.t1, t1: core.t1 + reach} : {t0: core.t0 - reach, t1: core.t0})};
        if (inside(lobe, h, g)) rects.push(lobe);
      }
      if (rects.some(r => placed.some(p => overlaps(r, p, g)))) { fails++; continue; }
      placed.push(...rects);
      covered += rects.reduce((s, r) => s + area(r), 0);
      out.push({host: hi, rects});
      fails = 0;
    }
  });
  return out;
}
