// Storefronts from one-line specs: the notable-business pipeline.
//
// Hand-modelling every business like Café Hoppe does not scale to hundreds, so a business's
// storefront is a short spec read off its panorama crop (scripts/storefronts/): frame and
// fascia colours, awning, window style, door side, sign. `compileStorefront` turns a spec
// into a `Front` (storefront mode: ground floor only, the building keeps its own height and
// colour), drawn by the same landmark-kit mesh as the hand-made fronts.

import { lettering, stripedAwning, type Front, type FrontBox } from './landmarkFronts.js';

/** Where a business's wall is: from its panorama reference (storefrontWalls.generated.ts). */
export type StorefrontWall = { pand: string; start: [number, number]; end: [number, number]; lengthM: number; alongM: number };

export type StorefrontSpec = {
  /** Display name, also sets the number of letter blocks on the fascia. */
  name: string;
  /** Frame and fascia colour. */
  frame: string;
  /** Span along the wall in metres; default: up to 7 m of frontage centred on the pin. */
  span?: [number, number];
  /** Fascia: a coloured sign board above the window (`false` for none); default the frame colour. */
  fascia?: string | false;
  /** Lettering colour; default light on dark frames, dark on light ones. */
  letters?: string;
  awning?: 'none' | 'flat' | 'striped' | 'scalloped' | 'canopy';
  awningHex?: string;
  /** Second stripe colour for a striped awning (default white). */
  awningHex2?: string;
  /** 'big' one sheet, 'split' mullioned bays, 'panes' small-paned (old café), 'arched' arched heads. */
  windows?: 'big' | 'split' | 'panes' | 'arched';
  door?: 'left' | 'right' | 'centre' | 'none';
  /** A projecting sign: round, square, or a lantern bracket. */
  sign?: 'none' | 'round' | 'square' | 'lamp';
  signHex?: string;
  /** A row of small transom panes over the window (classic Amsterdam shopfront). */
  transom?: boolean;
  /** Café terrace: small tables and chairs on the pavement. */
  terrace?: boolean;
  /** Planters or flower boxes along the front. */
  plants?: boolean;
  /** Storefront height, metres (default 3.6). */
  heightM?: number;
};

const luma = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); };
const GLASS = '#3a4048', DOOR = '#15171a', WHITE = '#f2f0ea', INK = '#1d1d1f';

export function compileStorefront(slug: string, spec: StorefrontSpec, wall: StorefrontWall): Front {
  const L = wall.lengthM, h = spec.heightM ?? 3.6;
  const half = Math.min(3.5, L / 2);
  const [x0, x1] = spec.span ?? [Math.max(0, Math.min(L - 2 * half, wall.alongM - half)), Math.min(L, Math.max(2 * half, wall.alongM + half))];
  const w = x1 - x0, frame = spec.frame, fascia = spec.fascia === false ? null : (spec.fascia ?? frame);
  const letters = spec.letters ?? (luma(fascia ?? frame) < 120 ? WHITE : INK);
  const boxes: FrontBox[] = [{ x0, x1, z0: 0, z1: h, out1: 0.12, hex: frame }];
  const out = 0.12;
  // Fascia board with the name as letter blocks.
  const fz0 = h - 0.75;
  if (fascia) {
    boxes.push({ x0: x0 + 0.05, x1: x1 - 0.05, z0: fz0, z1: h - 0.1, out0: out, out1: out + 0.06, hex: fascia });
    const n = Math.max(3, Math.min(16, spec.name.replace(/[^A-Za-z0-9]/g, '').length));
    boxes.push(...lettering(x0 + w * 0.15, x1 - w * 0.15, fz0 + 0.2, h - 0.3, out + 0.06, letters, n));
  }
  // Door and glazing.
  const door = spec.door ?? 'left', dw = 0.95;
  const dx0 = door === 'left' ? x0 + 0.2 : door === 'right' ? x1 - 0.2 - dw : x0 + w / 2 - dw / 2;
  const glassSpans: [number, number][] = door === 'none' ? [[x0 + 0.2, x1 - 0.2]]
    : door === 'centre' ? [[x0 + 0.2, dx0 - 0.15], [dx0 + dw + 0.15, x1 - 0.2]]
    : door === 'left' ? [[dx0 + dw + 0.15, x1 - 0.2]] : [[x0 + 0.2, dx0 - 0.15]];
  if (door !== 'none') boxes.push({ x0: dx0, x1: dx0 + dw, z0: 0, z1: Math.min(2.5, fz0 - 0.2), out0: out - 0.02, out1: out + 0.01, hex: DOOR });
  const gTop = spec.transom ? fz0 - 0.55 : fz0 - 0.15, gBot = 0.45;
  for (const [a, b] of glassSpans) {
    if (b - a < 0.4) continue;
    if (spec.transom) {
      const n = Math.max(2, Math.round((b - a) / 0.55)), pw = (b - a) / n;
      for (let i = 0; i < n; i++) boxes.push({ x0: a + i * pw + 0.05, x1: a + (i + 1) * pw - 0.05, z0: gTop + 0.1, z1: fz0 - 0.1, out0: out, out1: out + 0.02, hex: GLASS });
    }
    const style = spec.windows ?? 'big';
    const bays = style === 'big' ? 1 : Math.max(2, Math.round((b - a) / (style === 'panes' ? 0.9 : 1.6)));
    const bw = (b - a) / bays;
    for (let i = 0; i < bays; i++) {
      const g0 = a + i * bw + (bays > 1 ? 0.06 : 0), g1 = a + (i + 1) * bw - (bays > 1 ? 0.06 : 0);
      boxes.push({ x0: g0, x1: g1, z0: gBot, z1: style === 'arched' ? gTop - 0.35 : gTop, out0: out, out1: out + 0.02, hex: GLASS });
      if (style === 'arched') boxes.push({ x0: g0 + bw * 0.15, x1: g1 - bw * 0.15, z0: gTop - 0.35, z1: gTop, out0: out, out1: out + 0.02, hex: GLASS });
      if (style === 'panes') boxes.push({ x0: g0, x1: g1, z0: (gBot + gTop) / 2 - 0.03, z1: (gBot + gTop) / 2 + 0.03, out0: out + 0.02, out1: out + 0.04, hex: frame });
    }
  }
  // Stall riser under the glass.
  boxes.push({ x0, x1, z0: 0, z1: gBot, out0: out, out1: out + 0.05, hex: frame });
  // Awnings.
  const aHex = spec.awningHex ?? frame, aZ = fz0 - 0.02;
  switch (spec.awning ?? 'none') {
    case 'flat': boxes.push({ x0: x0 + 0.1, x1: x1 - 0.1, z0: aZ - 0.4, z1: aZ, out0: out, out1: 1.4, hex: aHex }); break;
    case 'striped': boxes.push(...stripedAwning(x0 + 0.1, x1 - 0.1, aZ, 1.4, aHex, spec.awningHex2 ?? WHITE).map(b => ({ ...b, out0: out }))); break;
    case 'scalloped': {
      boxes.push({ x0: x0 + 0.1, x1: x1 - 0.1, z0: aZ - 0.3, z1: aZ, out0: out, out1: 1.3, hex: aHex });
      for (let x = x0 + 0.1; x < x1 - 0.35; x += 0.5) boxes.push({ x0: x + 0.05, x1: x + 0.4, z0: aZ - 0.5, z1: aZ - 0.3, out0: 1.25, out1: 1.3, hex: aHex });
      break;
    }
    case 'canopy': boxes.push({ x0: x0 - 0.2, x1: x1 + 0.2, z0: aZ - 0.15, z1: aZ, out0: out, out1: 2.2, hex: aHex }); break;
  }
  // Projecting sign at the end away from the door.
  const sAt = door === 'right' ? x0 + 0.25 : x1 - 0.25, sHex = spec.signHex ?? (fascia ?? frame);
  switch (spec.sign ?? 'none') {
    case 'round': boxes.push({ x0: sAt - 0.03, x1: sAt + 0.03, z0: h - 0.15, z1: h - 0.1, out0: out, out1: 0.8, hex: INK }, { x0: sAt - 0.06, x1: sAt + 0.06, z0: h - 0.75, z1: h - 0.15, out0: 0.2, out1: 0.8, hex: sHex }); break;
    case 'square': boxes.push({ x0: sAt - 0.03, x1: sAt + 0.03, z0: h + 0.35, z1: h + 0.4, out0: out, out1: 0.95, hex: INK }, { x0: sAt - 0.06, x1: sAt + 0.06, z0: h - 0.45, z1: h + 0.35, out0: 0.2, out1: 0.95, hex: sHex }); break;
    case 'lamp': boxes.push({ x0: sAt - 0.03, x1: sAt + 0.03, z0: h + 0.2, z1: h + 0.25, out0: out, out1: 0.7, hex: INK }, { x0: sAt - 0.12, x1: sAt + 0.12, z0: h - 0.25, z1: h + 0.2, out0: 0.5, out1: 0.74, hex: '#f3d58a' }); break;
  }
  // Pavement life.
  if (spec.terrace) for (let x = x0 + 0.8; x < x1 - 0.5; x += 1.6) {
    boxes.push({ x0: x - 0.03, x1: x + 0.03, z0: 0, z1: 0.72, out0: 1.55, out1: 1.61, hex: INK }, { x0: x - 0.3, x1: x + 0.3, z0: 0.72, z1: 0.76, out0: 1.28, out1: 1.88, hex: aHex });
    for (const dx of [-0.5, 0.5]) boxes.push({ x0: x + dx - 0.18, x1: x + dx + 0.18, z0: 0, z1: 0.45, out0: 1.42, out1: 1.74, hex: INK }, { x0: x + dx - 0.18, x1: x + dx + 0.18, z0: 0.45, z1: 0.85, out0: 1.68, out1: 1.74, hex: INK });
  }
  if (spec.plants) for (let x = x0 + 0.3; x < x1 - 0.6; x += 2.2) boxes.push({ x0: x, x1: x + 0.5, z0: 0, z1: 0.5, out0: 0.25, out1: 0.75, hex: '#4a3b30' }, { x0: x - 0.05, x1: x + 0.55, z0: 0.5, z1: 1.05, out0: 0.2, out1: 0.8, hex: '#3f7a3a' });
  return {
    name: spec.name, storefront: true, roofline: 'unmeasured', ids: [wall.pand],
    start: wall.start, end: wall.end, depthM: 0.05, hex: frame, outline: [[x0, 0.01], [x1, 0.01]], boxes, windows: [],
  };
}
