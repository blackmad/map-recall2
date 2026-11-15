/**
 * Lane retail-look round 4: classifying a shop's pui paint from a rectified street-panorama band (scripts/retail-ground/
 * measure-pui.ts reads the band; build-templates.ts stages the result into the template extract's `paint` map), and the
 * paint drawn for a reading. Pure; no I/O.
 */
export const PUI_BAND = { z0: 1.2, z1: 3.3, inset: 0.08, ppm: 20 } as const;
export const PUI_GATE = { valid: 0.85, leaf: 0.08, share: 0.12, pale: { L: 0.66, C: 0.06 }, colour: { C: 0.07, L0: 0.22, L1: 0.85 }, dark: 0.42 } as const;

export type Lab = [number, number, number];
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const unlin = (c: number) => Math.round(255 * Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
export function oklab(r: number, g: number, b: number): Lab {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function labHex([L, a, b]: Lab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map(v => unlin(v).toString(16).padStart(2, '0')).join('');
}

export type Cluster = { lab: Lab; share: number; C: number };
/** k-means in OKLab, seeded at the lightness quantiles (deterministic). */
export function clusters(px: Lab[], k = 4): Cluster[] {
  if (!px.length) return [];
  const sorted = [...px].sort((p, q) => p[0] - q[0]);
  let c: Lab[] = Array.from({ length: k }, (_, i) => [...sorted[Math.floor((i + 0.5) / k * sorted.length)]] as Lab);
  let assign = new Int32Array(px.length);
  for (let it = 0; it < 12; it++) {
    const sum = c.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < px.length; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) { const d = (px[i][0] - c[j][0]) ** 2 + (px[i][1] - c[j][1]) ** 2 + (px[i][2] - c[j][2]) ** 2; if (d < bd) { bd = d; best = j; } }
      assign[i] = best; const s = sum[best]; s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3]++;
    }
    c = c.map((old, j) => sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] as Lab : old);
  }
  const n = new Array(k).fill(0); for (const a of assign) n[a]++;
  return c.map((lab, j) => ({ lab, share: n[j] / px.length, C: Math.hypot(lab[1], lab[2]) })).filter(x => x.share > 0);
}
export type Verdict = { cls: 'pale' | 'colour' | 'dark'; hex: string; share: number } | null;
/** The paint the band's clusters state, or null when they state nothing clear. */
export function paintOf(cs: Cluster[]): Verdict {
  const G = PUI_GATE;
  const pale = cs.filter(c => c.lab[0] >= G.pale.L && c.C <= G.pale.C && c.share >= G.share).sort((p, q) => q.share - p.share)[0];
  if (pale) return { cls: 'pale', hex: labHex(pale.lab), share: +pale.share.toFixed(3) };
  const colour = cs.filter(c => c.C >= G.colour.C && c.lab[0] >= G.colour.L0 && c.lab[0] <= G.colour.L1 && c.share >= G.share).sort((p, q) => q.share - p.share)[0];
  if (colour) return { cls: 'colour', hex: labHex(colour.lab), share: +colour.share.toFixed(3) };
  const big = [...cs].sort((p, q) => q.share - p.share).slice(0, 2);
  if (big.length && big.every(c => c.lab[0] < G.dark)) {
    const d = big[0];
    return { cls: 'dark', hex: labHex(d.lab), share: +big.reduce((s, c) => s + c.share, 0).toFixed(3) };
  }
  return null;
}

/**
 * The paint drawn for a reading. The panoramas expose a shop street dim (mean ground L 0.37), so a pale reading is a
 * white or cream paint seen in shade: its hue kept, its chroma capped at 0.025, lit to L 0.92. A coloured reading is
 * lifted by a tenth; a dark one is drawn as read.
 */
export function drawnPaint(cls: 'pale' | 'colour' | 'dark', hex: string): string {
  const m = /^#(..)(..)(..)$/.exec(hex)!, [L, a, b] = oklab(parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)), C = Math.hypot(a, b);
  if (cls === 'pale') { const k = C > 0.025 ? 0.025 / C : 1; return labHex([0.92, a * k, b * k]); }
  if (cls === 'colour') return labHex([Math.min(0.85, L * 1.1), a, b]);
  return hex;
}

