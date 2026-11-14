/**
 * Lane 1 step d (option c): today's window unit is a crop of an existing atlas cell. This adapter turns an upper bay
 * layer into a `WindowUnit` (its first window's rect from look/windowTable.ts plus frame and sill margins) and places it
 * on a record's boxes (houseLine/boxPlacement.ts). A later window-unit library replaces only `cellUnit`.
 */
import { BAY_ENTRIES, BAY_LAYER_COUNT, bayVariant } from '../bayLook.js';
import { BAY_PX, GROUND_PX, SHOP_KINDS } from '../bayTextures.js';
import type { Openings } from '../facadeOpenings.js';
import { canvasWindows } from '../look/windowTable.js';
import { placeOnBoxes, STRETCH_CAP, stretchOf, type Placement, type WindowBox, type WindowUnit } from './boxPlacement.js';

/** Canvas px around the window that belong to the unit: frame (sides, head) and the sill under it. */
export const CELL_UNIT_MARGIN_PX = { side: 16, top: 14, bottom: 26 } as const;

/** `ROW_FRONT_BOXES=0` (Node A/B: front-cost.ts) keeps the grid on a record's front. */
export function boxPlacementOn(): boolean {
  return !(typeof process !== 'undefined' && process.env?.ROW_FRONT_BOXES === '0');
}

const units = new Map<number, WindowUnit | null>();

/** The window unit an upper bay layer paints, or null (not an upper bay cell, or no analytic window). */
export function cellUnit(layer: number): WindowUnit | null {
  if (units.has(layer)) return units.get(layer)!;
  let unit: WindowUnit | null = null;
  const entry = layer < BAY_LAYER_COUNT ? BAY_ENTRIES[layer] : undefined;
  if (entry?.kind === 'upper') {
    const { cellH, windows } = canvasWindows(bayVariant(entry));
    const w = windows[0];
    if (w && w.w > 0 && w.h > 0) {
      const m = CELL_UNIT_MARGIN_PX;
      // Canvas y runs down; texture v runs up (flipY): v = 1 - y / cellH. Crops stay inside the cell (fract-safe).
      const x0 = Math.max(1, w.x - m.side), x1 = Math.min(BAY_PX - 1, w.x + w.w + m.side), yTop = Math.max(1, w.y - m.top), yBot = Math.min(cellH - 1, w.y + w.h + m.bottom);
      unit = { layer, aspect: w.w / w.h, margin: { l: (w.x - x0) / w.w, r: (x1 - w.x - w.w) / w.w, t: (w.y - yTop) / w.h, b: (yBot - w.y - w.h) / w.h },
        uv: { u0: x0 / BAY_PX, u1: x1 / BAY_PX, v0: 1 - yBot / cellH, v1: 1 - yTop / cellH } };
    }
  }
  units.set(layer, unit);
  return unit;
}

/**
 * Boxes (a0/a1 fractions of the front, sill/head above the pand's ground) placed on a run of `lengthM`, between the
 * ground storey's top and the facade top (z in the mesh frame: `base` is the pand's ground). Null keeps the grid.
 */
export function boxPlacementFor(boxes: readonly WindowBox[], upperLayer: number, lengthM: number, base: number, z0: number, z1: number): Placement | null {
  const own = boxPlacementOn() ? cellUnit(upperLayer) : null;
  if (!own) return null;
  const boxesM = boxes.map(b => ({ ...b, a0: b.a0 * lengthM, a1: b.a1 * lengthM, sillM: b.sillM + base, headM: b.headM + base }));
  return placeOnBoxes(boxesM, box => unitForBox(box, own), { lengthM, z0, z1 });
}

const within = (box: WindowBox, u: WindowUnit) => { const s = stretchOf(box, u); return s <= STRETCH_CAP && s >= 1 / STRETCH_CAP; };
const siblings = new Map<number, WindowUnit[]>();
/** The upper cells of the same archetype as `layer` (any style), as units: the shapes a front of that kind can borrow. */
export function siblingUnits(layer: number): WindowUnit[] {
  if (siblings.has(layer)) return siblings.get(layer)!;
  const arch = BAY_ENTRIES[layer]?.archetype;
  const out = arch === undefined ? [] : BAY_ENTRIES.flatMap((e, i) => e.kind === 'upper' && e.archetype === arch && i !== layer ? [cellUnit(i)].filter((u): u is WindowUnit => !!u) : []);
  siblings.set(layer, out);
  return out;
}

/**
 * The unit a box takes: the house's own upper cell while its window fits the box within the stretch cap; otherwise the
 * sibling cell (same archetype) whose window's shape is nearest the box's (a wide two-light or an oriel on a narrow-sash
 * house). Null when none fits: the front keeps its grid.
 */
export function unitForBox(box: WindowBox, own: WindowUnit): WindowUnit | null {
  if (within(box, own)) return own;
  let best: WindowUnit | null = null, err = Infinity;
  for (const u of siblingUnits(own.layer ?? -1)) { const e = Math.abs(Math.log(stretchOf(box, u))); if (e < err && within(box, u)) { best = u; err = e; } }
  return best;
}

/** The glass of a shop cell (bayTextures shopAt / quietShopAt: x 31-48 px in from each side, y 86-321 of GROUND_PX). */
export const SHOP_GLASS_UV = { u0: 0.08, u1: 0.92, v0: 1 - 321 / GROUND_PX, v1: 1 - 86 / GROUND_PX } as const;

/**
 * The opening a ground-storey cell paints (uv, v up), for a traced door, shop window or ground window: a door cell's
 * door (the building's openings), a shop cell's glass, a ground cell's first window. Null: draw the cell as is.
 */
export function groundOpeningRect(layer: number, kind: 'door' | 'shop' | 'window', openings?: Pick<Openings, 'door'>): { u0: number; u1: number; v0: number; v1: number } | null {
  if (kind === 'door') {
    const d = openings?.door;
    return d && d.width > 0.05 && d.top > d.bottom ? { u0: d.axis - d.width / 2, u1: d.axis + d.width / 2, v0: d.bottom, v1: d.top } : null;
  }
  const entry = layer < BAY_LAYER_COUNT ? BAY_ENTRIES[layer] : undefined;
  if (!entry) return null;
  if ((SHOP_KINDS as readonly string[]).includes(entry.kind)) return { ...SHOP_GLASS_UV };
  if (entry.kind !== 'ground') return null;
  const { cellH, windows } = canvasWindows(bayVariant(entry)), w = windows[0];
  return w && w.w > 0 && w.h > 0 ? { u0: w.x / BAY_PX, u1: (w.x + w.w) / BAY_PX, v0: 1 - (w.y + w.h) / cellH, v1: 1 - w.y / cellH } : null;
}
