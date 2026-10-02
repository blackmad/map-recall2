// Storefronts from specs: the notable-business pipeline.
//
// Hand-modelling every business like Café Hoppe does not scale to hundreds, so a business's
// storefront is a spec read off its panorama crop (scripts/storefronts/): a row of bays (shop
// windows, doors, carriage doors, pilasters), the sign with its real lettering, awning, and the
// details people know a place by (a logo roundel, lanterns, a striped fascia). `compileStorefront`
// turns a spec into a `Front` (storefront mode: ground floor only, the building keeps its own
// height and colour), drawn by the same landmark-kit mesh as the hand-made fronts.

import { arch, stripedAwning, type Front, type FrontBox, type FrontExtrusion, type FrontFace } from './landmarkFronts.js';
import { textRects } from './pixelFont.js';

/** Where a business's wall is: from its panorama reference (storefrontWalls.generated.ts). */
export type StorefrontWall = {
  pand: string; start: [number, number]; end: [number, number]; lengthM: number; alongM: number;
  /** How far the building's footprint stands proud of this wall line (a recessed or mis-registered wall); the shop is pushed out by it. */
  outM?: number;
};

export type StorefrontSpec = {
  /** Display name; also the sign's text unless `text` is set. */
  name: string;
  /** Frame colour: window and door joinery. */
  frame: string;
  /** Span along the wall in metres, as measured on the reference photo; default: up to 7 m of frontage centred on the pin. */
  span?: [number, number];
  /**
   * Registration: where the photo's metres sit on the footprint wall (wall = photo + shift). A
   * panorama's pose is off by up to a metre or so, which shows as the building's own edge (a
   * downpipe, a neighbour's pilaster) inside the crop; Bojo's left edge is 1.0 m into its photo,
   * so its shift is -1.0. Applies to `span`, `textAt` and `signs`.
   */
  shift?: number;
  /**
   * Bays left to right, space separated: W shop window, D shop door, C carriage (double) door,
   * d plain house door, P pilaster, B blank wall; `W:1.4` fixes a bay's width in metres.
   * Default from `door`: left 'D W', right 'W D', centre 'W D W', none 'W'.
   */
  bays?: string;
  /** Ground-floor wall around the openings (stucco, tiles, painted brick); default the frame colour. */
  wall?: string;
  /** Low wall under the shop windows; default the frame colour. */
  plinth?: string;
  /** Fascia board colour (`false`: no board, letters straight on the wall); default the frame colour. */
  fascia?: string | false;
  /** Fascia height, metres (default 0.7; a thin band ~0.25). */
  fasciaH?: number;
  /** The sign's text (default `name`; '' for no lettering); `text2` a smaller second line under it. */
  text?: string;
  /** Where along the wall the sign text sits [from, to] (default the whole fascia). */
  textAt?: [number, number];
  text2?: string;
  /** Lettering colour; default light on dark boards, dark on light ones. */
  letters?: string;
  /** Extra signs anywhere on the front: lettering over [x0, x1] x [z0, z1], on a board, or one letter per tile. */
  signs?: { text: string; x: [number, number]; z: [number, number]; letters: string; board?: string; tiles?: string }[];
  /** A band under the fascia with its own text (Bojo's yellow strip). */
  banner?: { hex: string; text?: string; letters?: string };
  /** Pattern over the fascia and plinth: zebra stripes (Abyssinia), checker tiles. */
  pattern?: StorefrontPattern | StorefrontPattern[];
  /** 'dutch' a curved quarter-round blind; 'tiled' a pan-tile hood. */
  awning?: 'none' | 'flat' | 'striped' | 'scalloped' | 'canopy' | 'tiled' | 'dutch' | 'box';
  awningHex?: string;
  /** Lettering on the awning's front drop (flat and dutch awnings). */
  awningText?: { text: string; letters: string };
  /** Second stripe colour for a striped awning (default white). */
  awningHex2?: string;
  /** Awning over these bay indices only (default the whole span). */
  awningOver?: [number, number];
  /** Separate awnings along the front, each over [from, to] photo metres with its own lettering (Bullewijck's red boxes). */
  awningSegments?: { x: [number, number]; text?: string }[];
  /**
   * The whole facade, not just the ground floor (Buiten's teal steel shed): the front's silhouette
   * [along, up] across the wall, its colour (the game paints the whole building in it), vertical
   * cladding ribs, and window grids. With `bays: 'none'` there is no shop row at all.
   */
  facade?: {
    outline: [number, number][]; hex: string; ribs?: string; windows?: { xs: number[]; rows: [number, number][]; w: number; frameHex?: string }[];
    /** Cap the building's body here (Kerkzicht is one storey under a tile roof, not the three the footprint height implies). */
    topM?: number;
    /** More silhouettes in front of or behind the wall plane: a tile roof seen over the eaves, a gable dormer. */
    slabs?: { outline: [number, number][]; hex: string; out0: number; out1: number }[];
  };
  /** Graffiti over closed roll-down shutters, in these colours (Amsterdam's shutters are rarely clean). */
  graffiti?: string[];
  /** 'big' one sheet, 'split' mullioned bays, 'panes' small-paned (old café), 'arched' arched heads. */
  windows?: 'big' | 'split' | 'panes' | 'arched';
  /** Explicit pane grid [columns, rows] per shop window (overrides `windows`' mullions). */
  grid?: [number, number];
  door?: 'left' | 'right' | 'centre' | 'none';
  /** Door leaf colour (default the frame). */
  doorHex?: string;
  /** A projecting sign: round, square, or a lantern bracket. */
  sign?: 'none' | 'round' | 'square' | 'lamp';
  signHex?: string;
  /** Which end the projecting sign hangs at (default the end away from the door). */
  signAt?: 'left' | 'right';
  /** A round logo on the fascia at its left or right end. */
  logo?: { hex: string; ring?: string; at?: 'left' | 'right' };
  /** Wall lanterns either side of the first door. */
  lanterns?: boolean;
  /** An arched sign board over the first door or carriage door, with this text. */
  archSign?: { text: string; hex: string; letters?: string };
  /** A row of small transom panes over the windows (classic Amsterdam shopfront). */
  transom?: boolean;
  /** Café terrace: small tables and chairs on the pavement. */
  terrace?: boolean;
  /** Planters or flower boxes along the front. */
  plants?: boolean;
  /** Hinged shutters beside each run of glass, in this colour. */
  shutters?: string;
  /** Roll-down shutters drawn over the glazing (closed snack bars, traiteurs); a string sets their colour. */
  rollers?: boolean | string;
  /** Glass colour: a lit warm interior ('#5a4a38') reads very differently from a dark reflection. */
  glass?: string;
  /** Storefront height, metres (default 3.6). */
  heightM?: number;
};

export type StorefrontPattern = { kind: 'zebra' | 'tiles'; a: string; b: string; on?: 'fascia' | 'plinth' | 'both' };

/** Blend two #rrggbb colours: t = 0 is a, 1 is b. */
export const mixHex = (a: string, b: string, t: number) => '#' + [0, 2, 4].map(i => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * (1 - t) + parseInt(b.slice(1 + i, 3 + i), 16) * t).toString(16).padStart(2, '0')).join('');

const luma = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); };
const DARK_GLASS = '#3c4854', DOOR = '#15171a', WHITE = '#f2f0ea', INK = '#1d1d1f', CHAIR = '#6b5444', LAMP = '#f3d58a';
const contrast = (hex: string) => (luma(hex) < 120 ? WHITE : INK);

type Bay = { kind: 'W' | 'D' | 'C' | 'd' | 'P' | 'B'; x0: number; x1: number };
const BAY_W: Record<string, number> = { D: 1.05, C: 1.8, d: 1.0, P: 0.35 };

/** Lay bays across [x0, x1]: doors and pilasters keep their widths, windows and blanks share the rest. */
export function layoutBays(tokens: string[], x0: number, x1: number): Bay[] {
  const parsed = tokens.map(t => { const [k, w] = t.split(':'); return { k, w: w ? Number(w) : BAY_W[k] }; });
  const fixed = parsed.reduce((s, t) => s + (t.w ?? 0), 0), flex = parsed.filter(t => t.w == null).length;
  // Fixed widths shrink to fit, and with nothing flexible they also stretch to fill: the span is the truth.
  const scale = fixed > x1 - x0 - 0.4 * flex || (!flex && fixed > 0) ? (x1 - x0 - 0.4 * flex) / fixed : 1, share = flex ? (x1 - x0 - fixed * scale) / flex : 0;
  let x = x0;
  return parsed.map(t => { const w = t.w != null ? t.w * scale : share, b = { kind: t.k as Bay['kind'], x0: x, x1: x + w }; x += w; return b; });
}

const disc = (cx: number, cz: number, r: number, out: number, hex: string, n = 14): FrontFace => ({ points: Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cz + r * Math.sin((2 * Math.PI * i) / n)] as [number, number]), out, hex });

export function compileStorefront(_slug: string, spec: StorefrontSpec, wall: StorefrontWall): Front {
  const GLASS = spec.glass ?? DARK_GLASS;
  const L = wall.lengthM, h = spec.heightM ?? 3.6;
  const half = Math.min(3.5, L / 2);
  // Photo metres to wall metres, then clamp to the wall and snap ends that registration error left
  // just short of a corner (a 0.4 m sliver of plain building beside a shop is always wrong).
  const sh = spec.shift ?? 0, SNAP = 0.6;
  const [px0, px1] = spec.span ? [spec.span[0] + sh, spec.span[1] + sh] : [Math.max(0, Math.min(L - 2 * half, wall.alongM - half)), Math.min(L, Math.max(2 * half, wall.alongM + half))];
  const x0 = Math.max(0, px0) < SNAP ? 0 : Math.max(0, px0), x1 = L - Math.min(L, px1) < SNAP ? L : Math.min(L, px1);
  const frame = spec.frame, wallHex = spec.wall ?? frame, plinth = spec.plinth ?? frame;
  const boxes: FrontBox[] = [], extrusions: FrontExtrusion[] = [], faces: FrontFace[] = [];
  const text = (s: string, a: number, b: number, z0: number, z1: number, out: number, hex: string, align?: 'left' | 'centre' | 'right') =>
    boxes.push(...textRects(s, a, b, z0, z1, align).map(r => ({ ...r, out0: out, out1: out + 0.015, hex, face: true })));

  // The shop's ground-floor wall, proud of the building so it reads as a shopfront.
  const WALL = 0.06, OUT = 0.12;
  boxes.push({ x0, x1, z0: 0, z1: h, out1: WALL, hex: wallHex });

  // Fascia (and banner) across the top.
  const fasciaH = spec.fasciaH ?? (spec.text2 ? 0.85 : 0.7), fz0 = h - fasciaH - 0.05;
  const fascia = spec.fascia === false ? null : (spec.fascia ?? frame);
  const signText = spec.text ?? spec.name, letters = spec.letters ?? contrast(fascia ?? wallHex);
  const pad = 0.15;
  if (fascia) boxes.push({ x0: x0 + 0.05, x1: x1 - 0.05, z0: fz0, z1: h - 0.05, out0: WALL, out1: OUT + 0.06, hex: fascia });
  const signOut = fascia ? OUT + 0.06 : WALL;
  const logoR = spec.logo ? fasciaH * 0.48 : 0, logoAt = spec.logo?.at ?? 'left';
  const [tx0, tx1] = spec.textAt ? [Math.max(x0, spec.textAt[0] + sh), Math.min(x1, spec.textAt[1] + sh)] : [x0, x1];
  // Keep the lettering clear of a logo roundel and of a blade sign hanging at either end.
  const bladeAt = spec.sign && spec.sign !== 'none' ? (spec.signAt ?? ((spec.door ?? 'left') === 'right' ? 'left' : 'right')) : null;
  const ta = tx0 + pad + (spec.logo && logoAt === 'left' ? 2 * logoR + 0.15 : 0) + (bladeAt === 'left' && tx0 <= x0 + 0.4 ? 0.35 : 0);
  const tb = tx1 - pad - (spec.logo && logoAt === 'right' ? 2 * logoR + 0.15 : 0) - (bladeAt === 'right' && tx1 >= x1 - 0.4 ? 0.35 : 0);
  // Margins scale with the board: a 0.35 m fascia still gets legible letters.
  const m = Math.min(0.15, (h - 0.05 - fz0) * 0.18);
  if (!signText) { /* no lettering */ } else if (spec.text2) {
    text(signText, ta, tb, fz0 + 0.38, h - 0.13, signOut, letters);
    text(spec.text2, ta, tb, fz0 + 0.1, fz0 + 0.3, signOut, letters);
  } else text(signText, ta, tb, fz0 + m, h - 0.05 - m, signOut, letters);
  if (spec.logo) {
    const cx = logoAt === 'left' ? tx0 + pad + logoR : tx1 - pad - logoR, cz = (fz0 + h - 0.05) / 2;
    faces.push(disc(cx, cz, logoR, signOut + 0.01, spec.logo.ring ?? WHITE), disc(cx, cz, logoR * 0.78, signOut + 0.02, spec.logo.hex));
  }
  let openTop = fz0 - 0.08;
  if (spec.banner) {
    const bz0 = fz0 - 0.32;
    boxes.push({ x0: x0 + 0.05, x1: x1 - 0.05, z0: bz0, z1: fz0, out0: WALL, out1: OUT + 0.03, hex: spec.banner.hex });
    if (spec.banner.text) text(spec.banner.text, x0 + pad, x1 - pad, bz0 + 0.06, fz0 - 0.06, OUT + 0.03, spec.banner.letters ?? contrast(spec.banner.hex));
    openTop = bz0 - 0.06;
  }

  // Bays.
  const door = spec.door ?? 'left';
  const tokens = (spec.bays === 'none' ? '' : spec.bays ?? (door === 'left' ? 'D W' : door === 'right' ? 'W D' : door === 'centre' ? 'W D W' : 'W')).trim().split(/\s+/).filter(Boolean);
  const bays = layoutBays(tokens, x0 + 0.1, x1 - 0.1);
  const style = spec.windows ?? 'big', gBot = 0.5, doorTop = Math.min(2.45, openTop - 0.1);
  const glassTop = spec.transom ? openTop - 0.5 : openTop;
  const doorHex = spec.doorHex ?? frame;
  const glazed: [number, number][] = [];
  // Glass sits recessed behind its frame and carries a pale diagonal reflection, so it reads as
  // glass rather than a painted panel even in flat light.
  const REC = OUT - 0.045, SHEEN = mixHex(GLASS, '#c8d4de', 0.3);
  const glassPane = (g0: number, g1: number, z0: number, z1: number, out: number) => {
    boxes.push({ x0: g0, x1: g1, z0, z1, out0: WALL, out1: out, hex: GLASS });
    const w = g1 - g0, hh = z1 - z0;
    if (w > 0.4 && hh > 0.6) faces.push({ points: [[g0 + 0.55 * w, z1 - 0.04], [g0 + 0.8 * w, z1 - 0.04], [g0 + 0.38 * w, z0 + 0.3 * hh], [g0 + 0.13 * w, z0 + 0.3 * hh]], out: out + 0.002, hex: SHEEN });
  };
  const paneGrid = (a: number, b: number, z0: number, z1: number, cols: number, rows: number, out: number) => {
    for (let i = 1; i < cols; i++) { const x = a + ((b - a) * i) / cols; boxes.push({ x0: x - 0.035, x1: x + 0.035, z0, z1, out0: out, out1: out + 0.03, hex: frame }); }
    for (let j = 1; j < rows; j++) { const z = z0 + ((z1 - z0) * j) / rows; boxes.push({ x0: a, x1: b, z0: z - 0.035, z1: z + 0.035, out0: out, out1: out + 0.03, hex: frame }); }
  };
  for (const bay of bays) {
    const { x0: a, x1: b } = bay, w = b - a;
    switch (bay.kind) {
      case 'P': boxes.push({ x0: a, x1: b, z0: 0, z1: openTop, out0: WALL, out1: OUT + 0.08, hex: frame }); break;
      case 'W': {
        // Frame stiles and rails proud of recessed glass, a panelled stall riser, mullions, transom lights.
        const g0 = a + 0.1, g1 = b - 0.1;
        boxes.push({ x0: a, x1: g0, z0: 0, z1: openTop, out0: WALL, out1: OUT, hex: frame }, { x0: g1, x1: b, z0: 0, z1: openTop, out0: WALL, out1: OUT, hex: frame });
        boxes.push({ x0: g0, x1: g1, z0: 0, z1: gBot, out0: WALL, out1: OUT, hex: frame }, { x0: g0, x1: g1, z0: glassTop, z1: Math.min(openTop, glassTop + 0.08), out0: WALL, out1: OUT, hex: frame });
        if (openTop - glassTop > 0.1) boxes.push({ x0: g0, x1: g1, z0: openTop - 0.08, z1: openTop, out0: WALL, out1: OUT, hex: frame });
        boxes.push({ x0: a + 0.08, x1: b - 0.08, z0: 0.06, z1: gBot - 0.06, out0: OUT, out1: OUT + 0.03, hex: plinth });
        if (style === 'arched') {
          glassPane(g0, g1, gBot, glassTop - 0.35, REC);
          boxes.push({ x0: g0, x1: g1, z0: glassTop - 0.35, z1: glassTop, out0: WALL, out1: OUT, hex: frame });
          faces.push({ points: [[g0, glassTop - 0.35], ...arch(g1, g0, glassTop - 0.35, 0.3, 6).map(([x, z]) => [x, z] as [number, number])], out: OUT + 0.005, hex: GLASS });
        } else glassPane(g0, g1, gBot, glassTop, REC);
        const [cols, rows] = spec.grid ?? (style === 'big' || style === 'arched' ? [1, 1] : style === 'split' ? [Math.max(1, Math.round(w / 1.4)), 1] : [Math.max(2, Math.round(w / 0.7)), 2]);
        paneGrid(g0, g1, gBot, style === 'arched' ? glassTop - 0.35 : glassTop, cols, rows, REC);
        if (spec.transom) {
          const n = Math.max(2, Math.round(w / 0.55)), pw = (g1 - g0) / n;
          for (let i = 0; i < n; i++) boxes.push({ x0: g0 + i * pw + 0.04, x1: g0 + (i + 1) * pw - 0.04, z0: glassTop + 0.08, z1: openTop - 0.08, out0: WALL, out1: REC, hex: GLASS });
          for (let i = 1; i < n; i++) boxes.push({ x0: g0 + i * pw - 0.04, x1: g0 + i * pw + 0.04, z0: glassTop + 0.08, z1: openTop - 0.08, out0: WALL, out1: OUT, hex: frame });
        }
        glazed.push([g0, g1]);
        break;
      }
      case 'D': case 'd': {
        const shop = bay.kind === 'D', top = shop ? doorTop : Math.min(doorTop, 2.3);
        if (shop) boxes.push({ x0: a, x1: b, z0: 0, z1: openTop, out0: WALL, out1: OUT, hex: frame });
        boxes.push({ x0: a + 0.08, x1: b - 0.08, z0: 0, z1: top, out0: shop ? OUT - 0.04 : WALL - 0.02, out1: shop ? OUT + 0.01 : WALL + 0.03, hex: shop ? doorHex : (spec.doorHex ?? INK) });
        if (shop) glassPane(a + 0.22, b - 0.22, 1.0, top - 0.18, OUT + 0.02);
        // Fanlight over the door.
        if (top < openTop - 0.3) boxes.push({ x0: a + 0.12, x1: b - 0.12, z0: top + 0.08, z1: (shop ? openTop : top + 0.5) - 0.08, out0: shop ? OUT : WALL, out1: (shop ? OUT : WALL) + 0.01, hex: GLASS });
        break;
      }
      case 'C': {
        // Two glazed leaves in small panes under a fanlight.
        const top = Math.min(2.6, openTop - 0.1), mid = (a + b) / 2;
        boxes.push({ x0: a, x1: b, z0: 0, z1: openTop, out0: WALL, out1: OUT, hex: doorHex });
        for (const [l0, l1] of [[a + 0.1, mid - 0.04], [mid + 0.04, b - 0.1]] as const) {
          boxes.push({ x0: l0 + 0.1, x1: l1 - 0.1, z0: 0.9, z1: top - 0.12, out0: OUT, out1: OUT + 0.01, hex: GLASS });
          paneGrid(l0 + 0.1, l1 - 0.1, 0.9, top - 0.12, 2, 4, OUT + 0.01);
          boxes.push({ x0: l0 + 0.1, x1: l1 - 0.1, z0: 0.15, z1: 0.75, out0: OUT, out1: OUT + 0.03, hex: doorHex });
        }
        boxes.push({ x0: a + 0.12, x1: b - 0.12, z0: top + 0.06, z1: openTop - 0.06, out0: OUT, out1: OUT + 0.01, hex: GLASS });
        break;
      }
    }
  }
  const firstDoor = bays.find(b => b.kind === 'C' || b.kind === 'D');
  if (spec.archSign && firstDoor) {
    const { x0: a, x1: b } = firstDoor, z = openTop + 0.02;
    faces.push({ points: [[a - 0.05, z], ...arch(b + 0.05, a - 0.05, z, 0.45, 8)], out: OUT + 0.05, hex: spec.archSign.hex });
    text(spec.archSign.text, a + 0.15, b - 0.15, z + 0.05, z + 0.3, OUT + 0.06, spec.archSign.letters ?? contrast(spec.archSign.hex));
  }
  if (spec.lanterns && firstDoor) for (const x of [firstDoor.x0 - 0.2, firstDoor.x1 + 0.2]) {
    boxes.push({ x0: x - 0.03, x1: x + 0.03, z0: 2.1, z1: 2.16, out0: OUT, out1: 0.4, hex: INK }, { x0: x - 0.11, x1: x + 0.11, z0: 1.75, z1: 2.1, out0: 0.25, out1: 0.47, hex: LAMP }, { x0: x - 0.13, x1: x + 0.13, z0: 2.1, z1: 2.18, out0: 0.23, out1: 0.49, hex: INK });
  }

  for (const sg of spec.signs ?? []) {
    const [a, b] = [sg.x[0] + sh, sg.x[1] + sh], [z0, z1] = sg.z;
    // Signs stand in front of everything flat: the fascia board ends at OUT + 0.06.
    const so = OUT + 0.1;
    if (sg.board) boxes.push({ x0: a, x1: b, z0, z1, out0: WALL, out1: so, hex: sg.board });
    if (sg.tiles) {
      // One tile per letter, like Troost's: letters each on their own white square.
      const chars = [...sg.text], step = (b - a) / chars.length, side = Math.min(step * 0.9, z1 - z0);
      chars.forEach((c, i) => {
        if (c === ' ') return;
        const cx = a + step * (i + 0.5), cz = (z0 + z1) / 2;
        boxes.push({ x0: cx - side / 2, x1: cx + side / 2, z0: cz - side / 2, z1: cz + side / 2, out0: WALL, out1: so, hex: sg.tiles! });
        text(c, cx - side * 0.38, cx + side * 0.38, cz - side * 0.38, cz + side * 0.38, so, sg.letters);
      });
    } else text(sg.text, a + 0.05, b - 0.05, z0 + 0.04, z1 - 0.04, so, sg.letters);
  }
  // Patterns: zebra stripes of uneven width, or checker tiles.
  for (const pattern of [spec.pattern ?? []].flat()) {
    const { kind, a: pa, b: pb, on = 'both' } = pattern;
    const bands: [number, number, number][] = [];
    if (fascia && on !== 'plinth') bands.push([fz0, h - 0.05, OUT + 0.061]);
    if (on !== 'fascia') bands.push([0.06, gBot - 0.06, OUT + 0.031]);
    for (const [z0, z1, out] of bands) {
      boxes.push({ x0: x0 + 0.05, x1: x1 - 0.05, z0, z1, out0: out - 0.001, out1: out, hex: pa, face: true });
      if (kind === 'zebra') for (let x = x0 + 0.1, i = 0; x < x1 - 0.2; i++) {
        const w = 0.12 + ((i * 37) % 5) * 0.04, tilt = ((i * 53) % 7 - 3) * 0.04;
        faces.push({ points: [[x, z0], [x + w, z0], [x + w + tilt, z1], [x + tilt, z1]], out: out + 0.002, hex: pb });
        x += w * 2.2;
      } else for (let x = x0 + 0.05, i = 0; x < x1 - 0.05; x += 0.2, i++) for (let z = z0, j = 0; z < z1 - 0.01; z += 0.2, j++) if ((i + j) % 2) boxes.push({ x0: x, x1: Math.min(x1 - 0.05, x + 0.2), z0: z, z1: Math.min(z1, z + 0.2), out0: out, out1: out + 0.002, hex: pb, face: true });
    }
  }
  // Shutters and roll-down shutters over the glass.
  if (spec.shutters) for (const [a, b] of glazed) for (const sx of [a - 0.34, b + 0.02]) boxes.push({ x0: sx, x1: sx + 0.32, z0: gBot, z1: glassTop, out0: OUT + 0.03, out1: OUT + 0.07, hex: spec.shutters });
  if (spec.rollers) for (const [a, b] of glazed) {
    const rHex = typeof spec.rollers === 'string' ? spec.rollers : '#5a6270';
    boxes.push({ x0: a - 0.05, x1: b + 0.05, z0: glassTop - 0.3, z1: glassTop, out0: OUT, out1: OUT + 0.22, hex: '#8a8c8e' }, { x0: a, x1: b, z0: gBot, z1: glassTop - 0.3, out0: OUT + 0.1, out1: OUT + 0.12, hex: rHex });
    for (let z = gBot + 0.25; z < glassTop - 0.35; z += 0.25) boxes.push({ x0: a, x1: b, z0: z, z1: z + 0.04, out0: OUT + 0.12, out1: OUT + 0.14, hex: '#3a3f48' });
    // Tags and throw-ups: overlapping slanted blobs, placed by a hash of the shop so they stay put.
    if (spec.graffiti?.length) {
      let seed = 0; for (const c of spec.name) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
      const top = glassTop - 0.35, n = Math.max(4, Math.round((b - a) * 1.6));
      for (let i = 0; i < n; i++) {
        const cx = a + 0.2 + rnd() * (b - a - 0.4), cz = gBot + 0.2 + rnd() * (top - gBot - 0.4), rx = 0.25 + rnd() * 0.6, rz = 0.15 + rnd() * 0.4, k = rnd() * 0.3;
        const pts: [number, number][] = [[cx - rx, cz - rz * 0.6], [cx + rx * 0.7, cz - rz], [cx + rx, cz + rz * 0.5], [cx - rx * 0.6 + k, cz + rz]];
        faces.push({ points: pts.map(([x, z]) => [Math.min(b, Math.max(a, x)), Math.min(top, Math.max(gBot, z))] as [number, number]), out: OUT + 0.141 + i * 0.001, hex: spec.graffiti[i % spec.graffiti.length] });
      }
    }
  }

  // Awnings: over the whole span, the bays named, or in separate lettered segments.
  const aHex = spec.awningHex ?? frame, aZ = openTop + 0.05, aLetters = spec.awningText?.letters ?? contrast(aHex);
  const awningAt = (ax0: number, ax1: number, label?: string) => { switch (spec.awning ?? 'none') {
    case 'flat':
      extrusions.push({ x0: ax0, x1: ax1, profile: [[OUT, aZ], [1.5, aZ - 0.5], [1.5, aZ - 0.75]], hex: aHex });
      if (label) boxes.push(...textRects(label, ax0 + 0.2, ax1 - 0.2, aZ - 0.72, aZ - 0.53).map(r => ({ ...r, out0: 1.5, out1: 1.515, hex: aLetters, face: true })));
      break;
    case 'box':
      // A shallow box with a lettered front face, level with the wall line above the glass.
      extrusions.push({ x0: ax0, x1: ax1, profile: [[OUT, aZ + 0.3], [1.0, aZ + 0.3], [1.0, aZ - 0.05], [OUT, aZ - 0.05]], hex: aHex });
      if (label) boxes.push(...textRects(label, ax0 + 0.25, ax1 - 0.25, aZ + 0.02, aZ + 0.23).map(r => ({ ...r, out0: 1.0, out1: 1.015, hex: aLetters, face: true })));
      break;
    case 'striped': boxes.push(...stripedAwning(ax0, ax1, aZ, 1.4, aHex, spec.awningHex2 ?? WHITE).map(b => ({ ...b, out0: OUT }))); break;
    case 'scalloped': {
      extrusions.push({ x0: ax0, x1: ax1, profile: [[OUT, aZ], [1.3, aZ - 0.35]], hex: aHex });
      for (let x = ax0; x < ax1 - 0.35; x += 0.5) faces.push({ points: [[x + 0.02, aZ - 0.35], [x + 0.48, aZ - 0.35], [x + 0.25, aZ - 0.6]], out: 1.3, hex: aHex });
      break;
    }
    case 'canopy': extrusions.push({ x0: ax0 - 0.2, x1: ax1 + 0.2, profile: [[OUT, aZ], [2.2, aZ - 0.05], [2.2, aZ - 0.2], [OUT, aZ - 0.15]], hex: aHex }); break;
    case 'dutch': {
      // A quarter-round blind: out and down from the wall, closed by the curve itself.
      const R = 1.0, prof: [number, number][] = [];
      for (let i = 0; i <= 6; i++) { const t = (Math.PI / 2) * (i / 6); prof.push([OUT + R * Math.sin(t), aZ + 0.35 - R * (1 - Math.cos(t))]); }
      extrusions.push({ x0: ax0, x1: ax1, profile: prof, hex: aHex });
      break;
    }
    case 'tiled': {
      for (let k = 0; k < 3; k++) boxes.push({ x0: ax0 - 0.15, x1: ax1 + 0.15, z0: aZ - 0.2 - k * 0.18, z1: aZ - k * 0.18, out0: OUT + k * 0.35, out1: OUT + (k + 1) * 0.35, hex: aHex });
      boxes.push({ x0: ax0 - 0.25, x1: ax1 + 0.25, z0: aZ - 0.72, z1: aZ - 0.6, out0: 1.1, out1: 1.2, hex: '#9a1f22' });
      break;
    }
  } };
  if (spec.awningSegments) for (const seg of spec.awningSegments) awningAt(Math.max(x0, seg.x[0] + sh), Math.min(x1, seg.x[1] + sh), seg.text);
  else awningAt(...(spec.awningOver ? [bays[spec.awningOver[0]].x0 - 0.05, bays[spec.awningOver[1]].x1 + 0.05] as const : [x0 + 0.1, x1 - 0.1] as const), spec.awningText?.text);
  // Projecting sign at the end away from the door.
  const sAt = (spec.signAt ?? (door === 'right' ? 'left' : 'right')) === 'left' ? x0 + 0.25 : x1 - 0.25, sHex = spec.signHex ?? (fascia ?? frame);
  switch (spec.sign ?? 'none') {
    case 'round': boxes.push({ x0: sAt - 0.03, x1: sAt + 0.03, z0: h - 0.15, z1: h - 0.1, out0: OUT, out1: 0.8, hex: INK }, { x0: sAt - 0.06, x1: sAt + 0.06, z0: h - 0.75, z1: h - 0.15, out0: 0.2, out1: 0.8, hex: sHex }); break;
    case 'square': boxes.push({ x0: sAt - 0.03, x1: sAt + 0.03, z0: h + 0.35, z1: h + 0.4, out0: OUT, out1: 0.95, hex: INK }, { x0: sAt - 0.06, x1: sAt + 0.06, z0: h - 0.45, z1: h + 0.35, out0: 0.2, out1: 0.95, hex: sHex }); break;
    case 'lamp': boxes.push({ x0: sAt - 0.03, x1: sAt + 0.03, z0: h + 0.2, z1: h + 0.25, out0: OUT, out1: 0.7, hex: INK }, { x0: sAt - 0.12, x1: sAt + 0.12, z0: h - 0.25, z1: h + 0.2, out0: 0.5, out1: 0.74, hex: LAMP }); break;
  }
  // Pavement life.
  if (spec.terrace) for (let x = x0 + 0.8; x < x1 - 0.5; x += 1.6) {
    boxes.push({ x0: x - 0.03, x1: x + 0.03, z0: 0, z1: 0.72, out0: 1.55, out1: 1.61, hex: INK }, { x0: x - 0.3, x1: x + 0.3, z0: 0.72, z1: 0.76, out0: 1.28, out1: 1.88, hex: aHex });
    for (const dx of [-0.5, 0.5]) boxes.push({ x0: x + dx - 0.16, x1: x + dx + 0.16, z0: 0.4, z1: 0.45, out0: 1.42, out1: 1.74, hex: CHAIR }, { x0: x + dx - 0.14, x1: x + dx - 0.1, z0: 0, z1: 0.4, out0: 1.5, out1: 1.66, hex: CHAIR }, { x0: x + dx + 0.1, x1: x + dx + 0.14, z0: 0, z1: 0.4, out0: 1.5, out1: 1.66, hex: CHAIR }, { x0: x + dx - 0.16, x1: x + dx + 0.16, z0: 0.45, z1: 0.8, out0: 1.7, out1: 1.74, hex: CHAIR });
  }
  if (spec.plants) for (let x = x0 + 0.3; x < x1 - 0.6; x += 2.2) boxes.push({ x0: x, x1: x + 0.5, z0: 0, z1: 0.5, out0: 0.25, out1: 0.75, hex: '#4a3b30' }, { x0: x - 0.05, x1: x + 0.55, z0: 0.5, z1: 1.05, out0: 0.2, out1: 0.8, hex: '#3f7a3a' });
  // Drop parts squeezed to nothing (a fanlight over a door in a low storefront).
  const kept = boxes.filter(b => b.z1 - b.z0 > 0.02 && b.x1 - b.x0 > 0.02);
  const base = { name: spec.name, roofline: 'unmeasured' as const, ids: [wall.pand], start: wall.start, end: wall.end, depthM: 0.05 + (wall.outM ?? 0), extrusions, faces };
  if (spec.facade) {
    // A whole facade: the silhouette slab in the facade colour, cladding ribs, window grids, then the shop row (if any) on it.
    const f = spec.facade, outline = f.outline.map(([x, z]) => [Math.min(L, Math.max(0, x + sh)), z] as [number, number]);
    const ribs: FrontBox[] = [];
    if (f.ribs) for (let x = outline[0][0] + 0.15; x < outline[outline.length - 1][0] - 0.1; x += 0.35) {
      let top = 0; for (let i = 1; i < outline.length; i++) { const [xa, za] = outline[i - 1], [xb, zb] = outline[i]; if (x >= xa && x <= xb && xb > xa) top = za + ((zb - za) * (x - xa)) / (xb - xa); }
      if (top > 0.3) ribs.push({ x0: x, x1: x + 0.06, z0: 0.05, z1: top - 0.05, out0: 0, out1: 0.04, hex: f.ribs });
    }
    const reg = (o: [number, number][]) => o.map(([x, z]) => [Math.min(L, Math.max(0, x + sh)), z] as [number, number]);
    return { ...base, hex: f.hex, outline, bodyTopM: f.topM, slabs: (f.slabs ?? []).map(sl => ({ ...sl, outline: reg(sl.outline) })), boxes: [...ribs, ...(spec.bays === 'none' ? kept.slice(1) : kept)], windows: (f.windows ?? []).map(w => ({ ...w, xs: w.xs.map(x => x + sh), hex: GLASS })) };
  }
  return { ...base, storefront: true, hex: wallHex, outline: [[x0, 0.01], [x1, 0.01]], boxes: kept, windows: [] };
}
