// Where a building's painted windows and front door sit inside one bay, so 3D dressing (sills,
// hoods, frames, door surrounds) lands on the openings the texture already shows.
//
// Two sources draw the walls: the bay looks (photo, storybook, cartoon; bayTextures.ts, one
// 520 x 310 px storey and 520 x 340 px ground floor per bay) and the procedural cells
// (facadeCells.ts, painted in metres). The numbers below are read off those painters; keep
// them in step when a painter moves a window (scripts/check-facade-extras.ts pins a few).
// Everything is a fraction: across a bay for axes and widths, up a storey (or the ground
// floor) for sills and heads, measured from the bottom.

import { BAY_STYLES, bayLookFor, bayStyleForRecipe } from './bayLook.js';
import { bayDoorGeometry, bayDoorWindowGeometry, bayWindowGeometry, type BayVariant, type Look } from './bayTextures.js';
import type { ArchitecturalRecipe } from './streetAppearance.js';
import type { FacadeStyle } from './genericFacades.js';

export type OpeningRow = { axes: number[]; width: number; widths?: number[]; sill: number; head: number; arch?: boolean };
export type DoorOpening = { axis: number; width: number; bottom: number; top: number; fanlight: boolean };
export type Openings = {
  upper: OpeningRow;
  /** Ground-floor windows on a plain bay; null for a ribbon or a shopfront. */
  ground: OpeningRow | null;
  /** The window beside the door in a door bay. */
  doorWindow: OpeningRow | null;
  door: DoorOpening;
  /** Ribbon windows (one band across the bay): no per-window dressing. */
  ribbon?: boolean;
};

// --- Bay looks (bayTextures.ts) --------------------------------------------------------
const BAY_W = 520, STOREY_H = 310, GROUND_H = 340;
const rowPx = (n: number, y: number, h: number, H: number, widthPx: number): OpeningRow => ({
  axes: Array.from({ length: n }, (_, i) => (i + 0.5) / n), width: widthPx / BAY_W, sill: (H - y - h) / H, head: (H - y) / H,
});
/** `doorAt`: 118 px wide from 0.14 of the bay, 226 px tall standing 24 px above the foot. */
const BAY_DOOR: DoorOpening = { axis: (0.14 * BAY_W + 59) / BAY_W, width: 118 / BAY_W, bottom: 24 / GROUND_H, top: (24 + 226) / GROUND_H, fanlight: true };

/** Opening placement comes from the same bounded variant used to paint the cell. */
export function bayVariantOpenings(v: BayVariant, look: Look = 'photo'): Openings {
  if (v.family === 'ribbon' || v.family === 'curtain') {
    const curtain = v.family === 'curtain';
    return { upper: { axes: [0.5], width: 0.9, sill: curtain ? 16 / STOREY_H : 100 / STOREY_H, head: curtain ? 302 / STOREY_H : 240 / STOREY_H },
      ground: rowPx(1, 80, 140, GROUND_H, 140), doorWindow: null,
      door: { ...BAY_DOOR, axis: (0.62 * BAY_W + 59) / BAY_W }, ribbon: true };
  }
  const row = (n: 1 | 2 | 3, y: number, h: number, H: number) => {
    const g = bayWindowGeometry({ ...v, windows: n }, y, h, look);
    return { ...rowPx(n, g.y, g.height, H, g.width), arch: v.shape === 'arch' };
  };
  const upper = v.archetype === 'school' && !v.proportions
    ? { axes: [0.3, 0.7], width: 76 / BAY_W, sill: (STOREY_H - 248) / STOREY_H, head: (STOREY_H - 68) / STOREY_H }
    : row(v.windows, 62, 188, STOREY_H);
  const dw = bayDoorWindowGeometry(v, look), dg = bayDoorGeometry(v);
  const doorWindow = { ...rowPx(1, dw.y, dw.height, GROUND_H, dw.width), axes: [dw.axis] };
  const door = { axis: (dg.x + dg.width / 2) / BAY_W, width: dg.width / BAY_W, bottom: dg.bottom / GROUND_H, top: (dg.bottom + dg.height) / GROUND_H, fanlight: dg.fanlight };
  if(v.entranceAssembly==='raised-plain'){
    const ground={axes:[.20,.47,.80],width:dw.width/BAY_W,sill:(GROUND_H-dw.y-dw.height)/GROUND_H,head:(GROUND_H-dw.y)/GROUND_H};
    return {upper:{...upper,axes:[.20,.47,.80]},ground,doorWindow:{...ground,axes:[.20,.47]},door};
  }
  if(v.entranceAssembly==='raised-pilaster'){
    const ground={axes:[.53,.80],width:dw.width/BAY_W,sill:(GROUND_H-dw.y-dw.height)/GROUND_H,head:(GROUND_H-dw.y)/GROUND_H};
    return {upper:{...upper,axes:[.205,.53,.80]},ground:row(v.windows,70,150,GROUND_H),doorWindow:ground,door};
  }
  if(v.facadeAssembly==='stacked-open-balcony'){
    const group={axes:[.17,.5,.83],width:.145,widths:[.145,.28,.145]};
    const ground={...row(v.windows,70,240,GROUND_H),...group};
    return {upper:{...upper,...group},ground,doorWindow:{...ground,axes:[.17,.83],widths:[.145,.145]},door};
  }
  return { upper, ground: row(v.windows, 70, 150, GROUND_H), doorWindow, door };
}

export function bayLookOpenings(id: string, style: FacadeStyle, look: Look = 'photo'): Openings {
  const archetype = style === 'school' ? 'school' : style === 'c19' ? 'c19' : style === 'modern' || style === 'postwar' || style === 'tower' ? 'modern' : 'canal';
  const v = BAY_STYLES[archetype][bayStyleForRecipe(id, archetype)];
  return bayVariantOpenings({ archetype, kind: 'upper', ...v }, look);
}

export function recipeBayOpenings(id: string, recipe: ArchitecturalRecipe, look: Look = 'photo'): Openings {
  const chosen = bayLookFor(id, null, 12, look, 'quiet', recipe);
  return bayVariantOpenings({ ...chosen.variant, kind: 'upper' }, look);
}

// --- Procedural cells (facadeCells.ts, nominal STYLE_DIMS) --------------------------------
const PROCEDURAL: Record<FacadeStyle, Openings> = {
  canal: { upper: { axes: [0.3, 0.7], width: 1.1 / 5, sill: 0.42 / 3.1, head: 2.47 / 3.1 }, ground: { axes: [0.3, 0.7], width: 1.0 / 5, sill: 0.95 / 3.3, head: 2.85 / 3.3 },
    doorWindow: { axes: [0.7], width: 1.0 / 5, sill: 0.95 / 3.3, head: 2.85 / 3.3 }, door: { axis: 0.3, width: 1.12 / 5, bottom: 0, top: 2.35 / 3.3, fanlight: true } },
  c19: { upper: { axes: [0.5], width: 1.35 / 4.4, sill: 0.6 / 3, head: 2.45 / 3 }, ground: { axes: [0.5], width: 1.4 / 4.4, sill: 1.3 / 3.6, head: 3.15 / 3.6 },
    doorWindow: null, door: { axis: 0.5, width: 1.2 / 4.4, bottom: 0, top: 2.3 / 3.6, fanlight: false } },
  school: { upper: { axes: [0.5], width: 3.52 / 4.8, sill: 0.95 / 3, head: 2.3 / 3 }, ground: null, doorWindow: null,
    door: { axis: 0.5, width: 1.1 / 4.8, bottom: 0, top: 2.2 / 3, fanlight: false }, ribbon: true },
  postwar: { upper: { axes: [0.5], width: 3.0 / 3.6, sill: 0.95 / 2.85, head: 2.35 / 2.85 }, ground: null, doorWindow: null,
    door: { axis: 0.95 / 3.6, width: 1.1 / 3.6, bottom: 0, top: 2.2 / 2.9, fanlight: false }, ribbon: true },
  modern: { upper: { axes: [1.4 / 4.2], width: 2.0 / 4.2, sill: 0.5 / 3, head: 2.5 / 3 }, ground: null, doorWindow: null,
    door: { axis: 3.5 / 4.2, width: 1.0 / 4.2, bottom: 0, top: 2.3 / 3.8, fanlight: false }, ribbon: true },
  tower: { upper: { axes: [0.5], width: 2.4 / 3, sill: 0.6 / 3.2, head: 2.5 / 3.2 }, ground: null, doorWindow: null,
    door: { axis: 0.5, width: 1.1 / 3, bottom: 0, top: 2.3 / 3.2, fanlight: false }, ribbon: true },
};

export const proceduralOpenings = (style: FacadeStyle): Openings => PROCEDURAL[style];
