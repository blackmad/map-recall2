/**
 * Lane 1 step d (option c): today's window unit is a crop of an existing atlas cell. This adapter turns an upper bay
 * layer into a `WindowUnit` (its first window's rect from look/windowTable.ts plus frame and sill margins) and places it
 * on a record's boxes (houseLine/boxPlacement.ts). A later window-unit library replaces only `cellUnit`.
 */
import { BAY_ENTRIES, BAY_LAYER_COUNT, bayVariant } from '../bayLook.js';
import { BAY_PX } from '../bayTextures.js';
import { canvasWindows } from '../look/windowTable.js';
import { placeOnBoxes, type Placement, type WindowBox, type WindowUnit } from './boxPlacement.js';

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
      unit = { aspect: w.w / w.h, margin: { l: (w.x - x0) / w.w, r: (x1 - w.x - w.w) / w.w, t: (w.y - yTop) / w.h, b: (yBot - w.y - w.h) / w.h },
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
  const unit = boxPlacementOn() ? cellUnit(upperLayer) : null;
  if (!unit) return null;
  const boxesM = boxes.map(b => ({ ...b, a0: b.a0 * lengthM, a1: b.a1 * lengthM, sillM: b.sillM + base, headM: b.headM + base }));
  return placeOnBoxes(boxesM, unit, { lengthM, z0, z1 });
}
