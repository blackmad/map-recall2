/**
 * F3 (#381): a measureFacade whose categorical reading survives a quarter-pixel nudge.
 *
 * measureFacade decides on cell masks (0.1 m cells cut at whole pixels), autocorrelation peaks, a 0.7 / 1.4 window-aspect cut and a
 * wall-cluster pick. Each is a knife edge for some fronts: the H12 agreement run (docs/house-line.md section 8) saw a quarter-pixel
 * camera move flip the column count (38 <-> 8, 22 <-> 60), the window shape (square <-> wide) and the wall cluster on a third of
 * the fixtures. The fix is not another threshold: the front is measured on a small ensemble of sub-pixel shifts of the same image
 * and the reading most of the ensemble agrees with is returned (a vote medoid, so every field of the result belongs to one real
 * measurement). A nudged image's ensemble overlaps the unmoved one's, so the two vote alike unless the knife edge sits exactly on
 * the neighbourhood's centre. Deterministic; `measureFacade` itself is unchanged and stays the default.
 */
import {measureFacade, rgbToLab, type FacadeImage, type FacadeMeasurement, type MeasureInput, type Rgb} from './measureFacade.ts';

/** Shifts (pixels) of the ensemble: the 3 x 3 grid at half-pixel spacing. */
export const STABLE_SHIFTS: readonly (readonly [number, number])[] = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]];

/** The image sampled at (x + dx, y + dy), bilinear, edge-clamped. */
export function shiftImage(im: FacadeImage, dx: number, dy: number): FacadeImage {
  if (!dx && !dy) return im;
  const {width: W, height: H} = im, rgb = new Uint8Array(im.rgb.length);
  const x0 = Math.floor(dx), fx = dx - x0, y0 = Math.floor(dy), fy = dy - y0;
  for (let y = 0; y < H; y++) {
    const ya = Math.min(H - 1, Math.max(0, y + y0)), yb = Math.min(H - 1, Math.max(0, y + y0 + 1));
    for (let x = 0; x < W; x++) {
      const xa = Math.min(W - 1, Math.max(0, x + x0)), xb = Math.min(W - 1, Math.max(0, x + x0 + 1));
      for (let c = 0; c < 3; c++) {
        const a = im.rgb[(ya * W + xa) * 3 + c], b = im.rgb[(ya * W + xb) * 3 + c], d = im.rgb[(yb * W + xa) * 3 + c], e = im.rgb[(yb * W + xb) * 3 + c];
        rgb[(y * W + x) * 3 + c] = Math.round((a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy);
      }
    }
  }
  return {...im, rgb};
}

const lab = (hex: string): Rgb => rgbToLab([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
const dE = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Fields the vote is over: what the verdicts and the specs read. */
function agree(a: FacadeMeasurement, b: FacadeMeasurement, la: Rgb, lb: Rgb): number {
  return Number((a.windowColumns ?? a.columns) === (b.windowColumns ?? b.columns)) + Number((a.window?.shape ?? null) === (b.window?.shape ?? null)) + Number(a.frontClass === b.frontClass) + Number(dE(la, lb) < 6);
}

export type StableInfo = {members: number; agreement: number; chosen: number};
export function measureFacadeStable(input: MeasureInput, shifts: readonly (readonly [number, number])[] = STABLE_SHIFTS): FacadeMeasurement & {stable: StableInfo} {
  const ms = shifts.map(([dx, dy]) => measureFacade({...input, image: shiftImage(input.image, dx, dy)}));
  const labs = ms.map(m => lab(m.wall.hex));
  let best = 0, bestScore = -1;
  ms.forEach((m, i) => {
    let s = 0; for (let j = 0; j < ms.length; j++) if (j !== i) s += agree(m, ms[j], labs[i], labs[j]);
    if (s > bestScore) { bestScore = s; best = i; } // ties keep the earlier shift: [0, 0] first
  });
  const denom = Math.max(1, (ms.length - 1) * 4);
  // The window aspect is continuous and the 0.7 / 1.4 cuts are not: class the ensemble's median aspect, so a front whose members straddle a cut reads the same from every neighbouring frame.
  const chosen = ms[best], aspects = ms.filter(m => m.window && m.window.aspect > 0).map(m => m.window!.aspect).sort((a, b) => a - b);
  if (chosen.window && aspects.length >= 3) {
    const med = aspects[aspects.length >> 1];
    chosen.window = {...chosen.window, aspect: med, shape: med > 1.4 ? 'tall' : med < 0.7 ? 'wide' : 'square'};
  }
  return {...chosen, stable: {members: ms.length, agreement: +(bestScore / denom).toFixed(3), chosen: best}};
}
