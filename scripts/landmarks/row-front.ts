import type {BuildingTools} from './cultural-builders';
import {slab, type Frame} from './nearbar-kit';

/**
 * Ordinary town-house fronts on the rest of a landmark's pand (2026-11-20, landmarks r8 lane: the Handelsbank's Herengracht
 * and Singel neighbours, the Max Euweplein houses beside Holland Casino). When a landmark model takes over a whole BAG pand,
 * the houses that share the pand with it lose their generic city look and must be drawn by the landmark builder. This
 * module lays out one such front on a wall frame: storeys of sash windows on a bay grid, an optional raised basement plinth,
 * a door with a stone stoop, a shopfront ground floor, stucco bands, balconies and a cornice. An optional `skin` paints the
 * house its own wall colour where one shell wall carries several houses.
 *
 * Full-width courses stop 10 cm short of each end, clear of the jog walls a row of houses turns at.
 * Layers stand off the wall (or the skin) in 5 cm steps so nothing shares a plane: skin 6 cm, frame 7 cm, glass 12 cm,
 * bars 17 cm, sill 20 cm (each plus the skin), the same stack as nearbar-kit sashWindows.
 *
 * Coordinates: the nearbar-kit wall frame (t along the wall from the viewer's left, y up, out from the wall).
 */
type Col = Parameters<BuildingTools['add']>[1];

export interface Box { y: number; h: number }

/** Bay centres: `bays` equal bays between t0 and t1 with `margin` of plain wall at each end. Pure. */
export function bayCentres(t0: number, t1: number, bays: number, margin = 0.6): number[] {
  if (bays <= 0) return [];
  const w = (t1 - t0 - 2 * margin) / bays;
  return Array.from({length: bays}, (_, i) => t0 + margin + w * (i + 0.5));
}

/**
 * Window boxes per storey under a wall top: the ground storey's window at `ground` + 0.8 m, then one every `floor` metres,
 * each `winH` tall (the upper storeys shrink by 8 % a floor, as canal houses do), as long as the window head stays `attic`
 * below the top. Pure.
 */
export function storeysUnder(top: number, o: {ground?: number; floor?: number; winH?: number; attic?: number} = {}): Box[] {
  const ground = o.ground ?? 1.0, floor = o.floor ?? 3.2, winH = o.winH ?? 2.1, attic = o.attic ?? 1.0;
  const out: Box[] = [];
  for (let k = 0; ; k++) {
    const y = ground + 0.8 + k * floor, h = winH * Math.pow(0.92, k);
    if (y + h > top - attic) break;
    out.push({y, h});
  }
  return out;
}

export interface FrontSpec {
  t0: number;
  t1: number;
  top: number;
  bays: number;
  storeys: Box[];
  margin?: number;
  winW?: number;
  /** Raised basement / plinth from the ground. */
  plinth?: {h: number; colour: Col};
  /** A door in place of the ground-storey window at bay `bay`, with a stone stoop `stoop` metres high. */
  doors?: {bay: number; stoop?: number}[];
  /** A shopfront over the whole ground storey (its windows are replaced). */
  shop?: {h: number; frame: Col};
  skin?: Col;
  bands?: Col;
  cornice?: Col;
  /** Storey indices with a balcony across the middle bay(s). */
  balconies?: number[];
  frame: Col;
  glass: Col;
  sill?: Col;
  door?: Col;
  stone?: Col;
  rail?: Col;
}

/** Draw one house front (see the module note for the layer stack). */
export function rowFront(b: BuildingTools, f: Frame, s: FrontSpec) {
  const s0 = s.skin ? 0.06 : 0;
  const w = s.t1 - s.t0, mid = (s.t0 + s.t1) / 2;
  const winW = s.winW ?? Math.min(1.3, ((w - 2 * (s.margin ?? 0.6)) / Math.max(1, s.bays)) * 0.58);
  const ts = bayCentres(s.t0, s.t1, s.bays, s.margin ?? 0.6);
  const stone = s.stone ?? s.plinth?.colour ?? s.frame;
  if (s.skin) slab(b, f, mid, 0, w - 0.04, s.top - 0.05, s0, s.skin);
  if (s.plinth) slab(b, f, mid, 0, w - 0.2, s.plinth.h, s0 + 0.1, s.plinth.colour);
  const doorBays = new Set((s.doors ?? []).map(d => d.bay));
  s.storeys.forEach((st, k) => {
    if (k === 0 && s.shop) return;
    if (s.bands && k > 0) slab(b, f, mid, st.y - 0.6, w - 0.2, 0.24, s0 + 0.05, s.bands);
    ts.forEach((t, i) => {
      if (k === 0 && doorBays.has(i)) return;
      slab(b, f, t, st.y - 0.06, winW + 0.2, st.h + 0.12, s0 + 0.07, s.frame);
      slab(b, f, t, st.y, winW - 0.06, st.h, s0 + 0.12, s.glass);
      slab(b, f, t, st.y, 0.05, st.h, s0 + 0.17, s.frame);
      slab(b, f, t, st.y + st.h * 0.55, winW - 0.06, 0.05, s0 + 0.17, s.frame);
      if (s.sill) slab(b, f, t, st.y - 0.2, winW + 0.4, 0.1, s0 + 0.2, s.sill);
    });
  });
  if (s.shop) {
    const sw = w - 0.5;
    slab(b, f, mid, s.plinth ? s.plinth.h : 0.3, sw, s.shop.h, s0 + 0.07, s.shop.frame);
    slab(b, f, mid, (s.plinth ? s.plinth.h : 0.3) + 0.12, sw - 0.24, s.shop.h - 0.3, s0 + 0.12, s.glass);
    for (const t of ts.slice(0, -1).map((t, i) => (t + ts[i + 1]) / 2)) slab(b, f, t, (s.plinth ? s.plinth.h : 0.3) + 0.12, 0.12, s.shop.h - 0.3, s0 + 0.17, s.shop.frame);
  }
  for (const d of s.doors ?? []) {
    const t = ts[d.bay];
    if (t === undefined) continue;
    const y0 = d.stoop ?? 0, dh = Math.min(3.1, (s.storeys[1]?.y ?? s.top) - y0 - 0.8);
    slab(b, f, t, y0, winW + 0.3, dh + 0.15, s0 + 0.07, s.frame);
    slab(b, f, t, y0, winW - 0.1, dh * 0.7, s0 + 0.12, s.door ?? s.frame);
    slab(b, f, t, y0 + dh * 0.7 + 0.08, winW - 0.1, dh * 0.3 - 0.1, s0 + 0.12, s.glass);
    if (y0 > 0.2) slab(b, f, t, 0, winW + 0.9, y0, 1.4, stone, s0); // the stoop
  }
  for (const k of s.balconies ?? []) {
    const st = s.storeys[k];
    if (!st) continue;
    const bw = Math.min(w - 1, winW * 2 + 1.2);
    slab(b, f, mid, st.y - 0.25, bw, 0.14, 0.75, stone, s0);
    slab(b, f, mid, st.y - 0.15, bw, 0.95, 0.04, s.rail ?? s.frame, s0 + 0.68);
  }
  if (s.cornice) slab(b, f, mid, s.top - 0.5, w - 0.2, 0.32, s0 + 0.3, s.cornice);
}
