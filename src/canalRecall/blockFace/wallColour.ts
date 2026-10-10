/**
 * Wall-colour check for the strip review: does the rendered wall read like the photographed wall?
 *
 * The recipe look lifts photo-sampled brick colours (recipeLook.cityWallTint) and multiplies them into a neutral
 * brick texture, so an intent colour that is a little too saturated renders orange-red against a brown-grey photo
 * (Marnixstraat 2026-10-10: intent #6e4638, strip wall (108,88,79), render (122,78,62)). This compares the median
 * model wall colour with the median photo colour on the SAME pixels (model wall = pixels near the model's dominant
 * wall colour in the storeys above the ground floor), so windows, bands and cornices drop out.
 */
export type Rgb = [number, number, number];

const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
export const toHex = (c: Rgb) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

export function rgbToHsl([r, g, b]: Rgb): Rgb {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

export interface WallColourReport {
  photo: Rgb; model: Rgb; pixels: number;
  /** HSL differences model - photo: hue in degrees, saturation and lightness absolute. */
  dHue: number; dSat: number; dLight: number;
  pass: boolean; note: string;
}

export interface WallColourInput {
  /** Raw RGB (3 channels) of the photo strip and of the orthographic model render, both W x H. */
  photo: Uint8Array; model: Uint8Array; width: number; height: number;
  /** Pixel box of one pand's wall area (x0..x1 columns, y0..y1 rows from the top). */
  box: {x0: number; x1: number; y0: number; y1: number};
  /** Render background colour, excluded from the wall. */
  background?: Rgb;
}

/** Tolerances: the look's lift is meant to be calibrated, so these are generous but catch an orange-for-brown cast. */
export const WALL_TOLERANCE = {hueDeg: 12, sat: 0.09, light: 0.1} as const;

export function measureWallColour(input: WallColourInput): WallColourReport | null {
  const {photo, model, width, box} = input, bg = input.background ?? [159, 184, 207];
  const idx: number[] = [];
  const near = (a: Rgb, b: Rgb, tol: number) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= tol;
  const px = (arr: Uint8Array, i: number): Rgb => [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];
  const all: number[] = [];
  for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) { const i = y * width + x; if (!near(px(model, i), bg, 40)) all.push(i); }
  if (all.length < 200) return null;
  const mid: Rgb = [median(all.map(i => model[i * 3])), median(all.map(i => model[i * 3 + 1])), median(all.map(i => model[i * 3 + 2]))];
  // Brick is never blue-dominant: drop photo pixels showing sky or windows where the render has wall.
  for (const i of all) if (near(px(model, i), mid, 45) && photo[i * 3 + 2] <= photo[i * 3] + 6) idx.push(i);
  if (idx.length < 200) return null;
  const med = (arr: Uint8Array): Rgb => [0, 1, 2].map(c => median(idx.map(i => arr[i * 3 + c]))) as Rgb;
  const p = med(photo), m = med(model), hp = rgbToHsl(p), hm = rgbToHsl(m);
  let dHue = hm[0] - hp[0]; if (dHue > 180) dHue -= 360; if (dHue < -180) dHue += 360;
  const dSat = hm[1] - hp[1], dLight = hm[2] - hp[2];
  const problems: string[] = [];
  // Hue is meaningless on near-neutral walls.
  if (Math.min(hp[1], hm[1]) > 0.08 && Math.abs(dHue) > WALL_TOLERANCE.hueDeg) problems.push(`hue ${dHue > 0 ? '+' : ''}${dHue.toFixed(0)} deg`);
  if (Math.abs(dSat) > WALL_TOLERANCE.sat) problems.push(`${dSat > 0 ? 'too saturated' : 'too grey'} (${dSat > 0 ? '+' : ''}${dSat.toFixed(2)})`);
  if (Math.abs(dLight) > WALL_TOLERANCE.light) problems.push(`${dLight > 0 ? 'too light' : 'too dark'} (${dLight > 0 ? '+' : ''}${dLight.toFixed(2)})`);
  return {photo: p, model: m, pixels: idx.length, dHue: +dHue.toFixed(1), dSat: +dSat.toFixed(3), dLight: +dLight.toFixed(3), pass: problems.length === 0,
    note: problems.length ? problems.join(', ') : 'wall colour matches the photo'};
}
