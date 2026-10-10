/**
 * Stone ornament of historic (17th/18th-c.) canal-house gables as flat facade ornaments (the library's
 * `CanalhouseOrnament`: a profile extruded a few centimetres in front of the wall). Shapes are derived from the fitted
 * crown profile, so they follow the measured gable: wing pieces (vleugelstukken) along the shoulders with a volute at
 * the foot, ears where the neck meets the cap, a cartouche on the cap, a finial (crab, vase, ball) on the top, and a
 * crest/gablet standing on a cornice front. All shapes are simple polygons in viewer-left facade metres.
 */
import type {CanalhouseOrnament, CanalhousePoint} from '../canalhouseRecipes.ts';
import type {GableOrnamentIntent} from './intent.ts';

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const pt = (x: number, y: number): CanalhousePoint => [r4(x), r4(y)];

/** Neck/bell crown landmarks read off a fitted profile (viewer-left metres): the left shoulder curve, neck sides, cap base and top. */
export interface CrownLandmarks { shoulder: CanalhousePoint[]; neckLeft: number; neckRight: number; shoulderY: number; capBaseY: number; topY: number; mid: number }

/** First vertical rise of the profile = the left side of the neck; null when the profile has no neck (point, step, cornice crowns). */
export function crownLandmarks(profile: CanalhousePoint[]): CrownLandmarks | null {
  const i = profile.findIndex((p, k) => k > 0 && Math.abs(p[0] - profile[k - 1][0]) < 1e-6 && p[1] > profile[k - 1][1] + 0.05);
  if (i < 1) return null;
  const neckLeft = profile[i][0], width = profile.at(-1)![0] - profile[0][0], neckRight = profile[0][0] + width - (neckLeft - profile[0][0]);
  const topY = Math.max(...profile.map(p => p[1]));
  return {shoulder: profile.slice(0, i), neckLeft, neckRight, shoulderY: profile[i - 1][1], capBaseY: profile[i][1], topY, mid: (neckLeft + neckRight) / 2};
}

/** An Archimedean spiral band (a volute) centred at (cx, cy): outer radius r, 1.25 turns, as one simple polygon. */
export function volute(cx: number, cy: number, r: number, turn: 1 | -1 = 1): CanalhousePoint[] {
  const n = 14, a0 = -Math.PI / 2, sweep = 2.5 * Math.PI, band = r * 0.32;
  const outer: CanalhousePoint[] = [], inner: CanalhousePoint[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = a0 + turn * sweep * t, ro = r * (1 - 0.62 * t), ri = Math.max(r * 0.08, ro - band * (1 - 0.5 * t));
    outer.push(pt(cx + ro * Math.cos(a), cy + ro * Math.sin(a)));
    inner.push(pt(cx + ri * Math.cos(a), cy + ri * Math.sin(a)));
  }
  return [...outer, ...inner.reverse()];
}

const oval = (cx: number, cy: number, w: number, h: number, n = 12): CanalhousePoint[] => Array.from({length: n}, (_, k) => { const a = 2 * Math.PI * k / n; return pt(cx + w / 2 * Math.cos(a), cy + h / 2 * Math.sin(a)); });

/** Crowning piece standing on (cx, baseY): a leafy crab, a vase/urn or a ball on a stem; about `size` tall. */
export function finial(kind: NonNullable<GableOrnamentIntent['finial']>, cx: number, baseY: number, size: number): CanalhousePoint[] {
  const w = size * 0.7, h = size;
  if (kind === 'ball') {
    // A stem (a quarter of the width) carrying a ball; the ball's arc starts and ends on the stem sides.
    const r = w * 0.38, cy = baseY + h - r, s = w * 0.12, start = -Math.acos(s / r), end = Math.PI + Math.acos(s / r);
    const arc = Array.from({length: 11}, (_, k) => { const a = start + (end - start) * k / 10; return pt(cx + r * Math.cos(a), cy + r * Math.sin(a)); });
    return [pt(cx - s, baseY), pt(cx + s, baseY), ...arc];
  }
  if (kind === 'vase') return [[0, 0], [.32, 0], [.22, .1], [.46, .32], [.5, .5], [.36, .7], [.24, .76], [.3, .88], [.12, 1], [-.12, 1], [-.3, .88], [-.24, .76], [-.36, .7], [-.5, .5], [-.46, .32], [-.22, .1], [-.32, 0]]
    .map(([x, y]) => pt(cx + x * w, baseY + y * h));
  // Crab ("krab"): a flame of curled leaves, wider at the base, a curl on each side and a pointed top.
  return [[-.5, 0], [.5, 0], [.42, .18], [.56, .34], [.36, .38], [.3, .55], [.44, .66], [.18, .7], [.12, .86], [0, 1], [-.12, .86], [-.18, .7], [-.44, .66], [-.3, .55], [-.36, .38], [-.56, .34], [-.42, .18]]
    .map(([x, y]) => pt(cx + x * w, baseY + y * h));
}

export interface GableOrnamentInput { ornament: GableOrnamentIntent; profile: CanalhousePoint[]; eavesM: number; widthM: number; idPrefix: string; corniceDepthM?: number }

/**
 * Ornaments for one crown (module/crown-local viewer-left metres; the caller offsets and mirrors). Wing pieces need a
 * neck in the profile; a gablet needs a flat (cornice) crown. Returns [] when the profile cannot carry the piece.
 */
export function gableOrnaments({ornament: o, profile, eavesM, widthM, idPrefix}: GableOrnamentInput): {ornaments: CanalhouseOrnament[]; warnings: string[]} {
  const out: CanalhouseOrnament[] = [], warnings: string[] = [];
  const lm = crownLandmarks(profile), x0 = profile[0][0], x1 = profile.at(-1)![0];
  const mirror = (poly: CanalhousePoint[]) => poly.map(([x, y]) => pt(x0 + x1 - x, y)).reverse();
  const add = (id: string, poly: CanalhousePoint[], depthM: number, fill: CanalhouseOrnament['fill'] = 'stone') => {
    const clean = poly.filter((p, k) => k === 0 || Math.hypot(p[0] - poly[k - 1][0], p[1] - poly[k - 1][1]) > 1e-4).map(([x, y]) => pt(Math.min(widthM, Math.max(0, x)), Math.max(0, y)));
    out.push({id: `${idPrefix}${id}`, profile: clean, depthM, fill});
  };
  if ((o.wings || o.ears || o.cartouche) && !lm) warnings.push(`${idPrefix}gableOrnament: the crown has no neck; wings/ears/cartouche skipped`);
  if (lm) {
    const rise = lm.shoulderY - eavesM, neckW = lm.neckLeft - x0;
    if (o.wings && neckW > 0.3 && rise > 0.3) {
      // Band under the shoulder silhouette, a little proud of it, ending at the neck; a volute curls at the outer foot.
      const thick = Math.min(0.42, Math.max(0.18, rise * 0.3)), lift = 0.04;
      const top = lm.shoulder.map(([x, y]) => pt(x, y + lift));
      const bottom = lm.shoulder.map(([x, y], k) => pt(Math.min(lm.neckLeft, x + (k === 0 ? 0.0 : 0)), Math.max(eavesM, y - thick))).reverse();
      const left = [...top, pt(lm.neckLeft, lm.shoulderY + lift), pt(lm.neckLeft, Math.max(eavesM, lm.shoulderY - thick)), ...bottom.slice(1)];
      add('wing-l', left, 0.06);
      add('wing-r', mirror(left), 0.06);
      const r = Math.min(0.32, Math.max(0.16, neckW * 0.18, rise * 0.2));
      if (o.wings === 'volutes') {
        add('volute-l', volute(x0 + r + 0.02, eavesM + r + 0.02, r, -1), 0.1);
        add('volute-r', volute(x1 - r - 0.02, eavesM + r + 0.02, r, 1), 0.1);
      } else {
        // Scrolls: a flat upturned tip at the foot.
        const tip: CanalhousePoint[] = [pt(x0, eavesM), pt(x0 + 2.2 * r, eavesM), pt(x0 + 2.2 * r, eavesM + 0.5 * r), pt(x0 + 0.6 * r, eavesM + 0.7 * r), pt(x0 + 0.15 * r, eavesM + 1.4 * r), pt(x0, eavesM + 1.1 * r)];
        add('scroll-l', tip, 0.1); add('scroll-r', mirror(tip), 0.1);
      }
    }
    if (o.ears) {
      const r = Math.min(0.2, Math.max(0.1, (lm.capBaseY - lm.shoulderY) * 0.08));
      add('ear-l', volute(lm.neckLeft - r * 0.7, lm.capBaseY - r * 1.1, r, -1), 0.08);
      add('ear-r', volute(lm.neckRight + r * 0.7, lm.capBaseY - r * 1.1, r, 1), 0.08);
    }
    const capRise = lm.topY - lm.capBaseY;
    if (o.cartouche) {
      // On the cap when it is tall enough, else just under it on the neck.
      const h = Math.min(0.62, Math.max(0.3, capRise * 0.7)), w = Math.min(h * 1.5, (lm.neckRight - lm.neckLeft) * 0.42);
      const cy = capRise >= 0.4 ? lm.capBaseY + Math.min(capRise * 0.42, h / 2) : lm.capBaseY - h / 2 - 0.05;
      add('cartouche', oval(lm.mid, cy, w, h), 0.07);
    }
  }
  if (o.finial) {
    // Stands on the crown's highest point (the cap of a neck/bell, the apex of a point or step gable).
    const topY = Math.max(...profile.map(p => p[1])), tops = profile.filter(p => p[1] >= topY - 1e-6), cx = (tops[0][0] + tops.at(-1)![0]) / 2;
    const size = Math.min(0.75, Math.max(0.4, (lm ? lm.neckRight - lm.neckLeft : widthM) * 0.22));
    add('finial', finial(o.finial, cx, topY - 0.03, size), 0.12);
  }
  if (o.gablet) {
    // A crowning piece on the cornice line, centred: a carved crest (cartouche on a plinth) or a small pointed gablet.
    const cx = (x0 + x1) / 2, w = Math.min(1.6, widthM * 0.28), base = eavesM - 0.02;
    if (o.gablet === 'pediment') add('gablet', [pt(cx - w / 2, base), pt(cx + w / 2, base), pt(cx + w / 2, base + 0.22), pt(cx, base + 0.22 + w * 0.42), pt(cx - w / 2, base + 0.22)], 0.14);
    else {
      const h = w * 0.62, arch = Array.from({length: 9}, (_, k) => { const a = Math.PI * k / 8; return pt(cx + w * 0.36 * Math.cos(a), base + h * 0.55 + h * 0.45 * Math.sin(a)); });
      add('gablet', [pt(cx - w / 2, base), pt(cx + w / 2, base), pt(cx + w / 2, base + h * 0.22), pt(cx + w * 0.36, base + h * 0.36), ...arch, pt(cx - w * 0.36, base + h * 0.36), pt(cx - w / 2, base + h * 0.22)], 0.14);
      add('gablet-volute-l', volute(cx - w * 0.5 + w * 0.08, base + h * 0.36, w * 0.09, -1), 0.16);
      add('gablet-volute-r', volute(cx + w * 0.5 - w * 0.08, base + h * 0.36, w * 0.09, 1), 0.16);
    }
  }
  return {ornaments: out, warnings};
}
