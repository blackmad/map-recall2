/**
 * The CPU twin of the record shader (F1 S5, #380; docs/plans/facade-f1-design-20261112.md §3.4): `facadePixel` is
 * look/facadeShader.ts `facadeRecordColour` line for line, on an unpacked record, so the Node preview (`house:preview
 * --shader-facades`), the pixel-effect gate and the tests see what the GPU draws. Keep the two in step: the GLSL-vs-twin
 * check (tests/e2e/facade-twin.spec.ts) renders the fixture records through the real program and compares.
 */
import { FACADE_WINDOW_PITCH_M, type FacadeRecord } from './facadeRecord.js';
import { FACADE_STYLES } from '../genericFacades.js';
import { GLASS_STOPS } from './windowSdf.js';

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
const GLASS = GLASS_STOPS.map(hexRgb);
const rgb = (c: readonly number[]): [number, number, number] => [c[0] / 255, c[1] / 255, c[2] / 255];
const mix3 = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function frPitch(style: number): number {
  for (let i = 0; i < FACADE_STYLES.length; i++) if (style < i + 0.5) return FACADE_WINDOW_PITCH_M[FACADE_STYLES[i]];
  return 2.0;
}
export const frCover = (x: number, a: number, b: number, fw: number) => clamp((Math.min(b, x + 0.5 * fw) - Math.max(a, x - 0.5 * fw)) / fw, 0, 1);
export function frOpening(p: [number, number], fw: [number, number], x0: number, x1: number, y0: number, y1: number, head: number, rise: number): number {
  const cx = frCover(p[0], x0, x1, fw[0]);
  if (head > 1.5 && head < 2.5) {
    const r = 0.5 * (x1 - x0), cy = y1 - r;
    const below = frCover(p[1], y0, cy, fw[1]);
    const d = Math.hypot(p[0] - (x0 + r), p[1] - cy) - r, fwr = Math.max(0.5 * (fw[0] + fw[1]), 1e-4);
    const above = p[1] > cy ? clamp(0.5 - d / fwr, 0, 1) : 0;
    return Math.max(cx * below, above * frCover(p[1], cy, y1, fw[1]));
  }
  let top = y1;
  if (head > 0.5 && head < 1.5) { const s = clamp((p[0] - x0) / Math.max(x1 - x0, 1e-4), 0, 1); top = y1 - rise + 4 * rise * s * (1 - s); }
  return cx * frCover(p[1], y0, top, fw[1]);
}
export const frGlass = (g: number) => (g < 0.55 ? mix3(GLASS[0], GLASS[1], g / 0.55) : mix3(GLASS[1], GLASS[2], (g - 0.55) / 0.45));

/** One fragment: `wall` = (u, v, run length) in metres, `kind` the wall kind (bit 8 mirrored), `fw` the pixel's metres. */
export function facadePixel(r: FacadeRecord, wall: readonly [number, number, number], kindIn: number, fw: readonly [number, number]): { rgb: [number, number, number]; m: [number, number] } {
  const wallC = rgb(r.wall);
  const kind = kindIn - 8 * (kindIn >= 7.5 ? 1 : 0);
  if (kind > 6.5) return { rgb: rgb(r.roof), m: [0, 0] };
  if ((kind > 2.5 && kind < 5.5) || kind > 5.5) return { rgb: wallC, m: [1, 0] };
  const w: [number, number] = [wall[0], wall[1]];
  const f: [number, number] = [Math.max(fw[0], 1e-4), Math.max(fw[1], 1e-4)];
  const plinth = r.plinthDm * 0.1, groundH = Math.max(r.groundDm * 0.1, 0.5), upperH = Math.max(r.upperDm * 0.1, 0.5);
  const atticH = r.atticDm * 0.1, storeys = Math.max(r.storeys, 1);
  const v = w[1] - plinth;
  if (v < 0 || w[1] > r.wallHcm * 0.01) return { rgb: wallC, m: [1, 0] };
  let storey: number, sv: number, sh: number;
  if (v < groundH) { storey = 0; sh = groundH; sv = v; }
  else {
    const u = (v - groundH) / upperH; storey = 1 + Math.floor(u); sh = upperH; sv = (u - Math.floor(u)) * upperH;
    if (atticH > 0 && storey >= storeys - 1) { storey = storeys - 1; sh = atticH; sv = v - groundH - (storeys - 2) * upperH; }
  }
  if (storey > storeys - 0.5) return { rgb: wallC, m: [1, 0] };
  const front = kind < 0.5;
  const len = Math.max(wall[2], 1e-3), pitch = frPitch(r.style);
  let bays = front ? (storey < 0.5 ? r.baysGround : (storey > storeys - 1.5 && r.baysAttic > 0 ? r.baysAttic : r.baysUpper)) : 0;
  if (bays < 0.5) bays = Math.max(1, Math.floor(len / pitch + 0.5));
  const bw = len / bays, bay = Math.floor(w[0] / bw), bx = w[0] - bay * bw;
  const doorBay = r.doorBay, door = doorBay > 253.5 && doorBay < 254.5 ? Math.floor((bays - 1) * 0.5) : doorBay;
  const p: [number, number] = [bx, sv];
  const share = r.windowShare / 255, winH = r.windowHeightQ / 255;
  const frame = rgb(r.frame);
  if (front && storey < 0.5 && Math.abs(bay - door) < 0.5 && doorBay < 254.5) {
    const dw = Math.min(1.2, bw * 0.7), x0 = 0.5 * (bw - dw), dh = Math.min(sh * 0.85, 2.6);
    const o = frOpening(p, f, x0, x0 + dw, 0, dh, 0, 0), leaf = frOpening(p, f, x0 + 0.06, x0 + dw - 0.06, 0, dh - 0.06, 0, 0);
    return { rgb: mix3(mix3(wallC, frame, o), rgb(r.door), leaf), m: [1 - o, 0] };
  }
  const ww = clamp(share, 0.15, 0.9) * bw, wh = clamp(winH, 0.2, 0.92) * sh;
  const x0 = 0.5 * (bw - ww), y0 = Math.max(0.25, (sh - wh) * 0.55);
  let y1 = Math.min(sh - 0.1, y0 + wh);
  const head = r.windowHead, rise = head > 0.5 && head < 1.5 ? Math.min(0.18 * ww, 0.35) : 0;
  if (head > 1.5 && head < 2.5) y1 = Math.max(y1, y0 + 0.5 * ww + 0.2);
  const hd = head > 2.5 ? 0 : head;
  const outer = frOpening(p, f, x0, x0 + ww, y0, y1, hd, rise);
  if (outer <= 0) return { rgb: wallC, m: [1, 0] };
  const fr = Math.min(0.07, 0.12 * ww);
  const pane = frOpening(p, f, x0 + fr, x0 + ww - fr, y0 + fr, y1 - fr, hd, rise);
  const g = clamp((y1 - p[1]) / Math.max(y1 - y0, 1e-3), 0, 1);
  return { rgb: mix3(mix3(wallC, frame, outer), frGlass(g), pane), m: [1 - outer, 0] };
}
