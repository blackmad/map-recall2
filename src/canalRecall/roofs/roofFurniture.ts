/**
 * Measured roof furniture as geometry in the facade-extras chunk (threeBuildingMesh `mode: 'extras'`).
 *
 * One closed unit box per item (10 triangles, no bottom; ≤ 60 per kind as the lane asks), flat-coloured on the
 * atlas's flat layer, so it costs no new material, texture or draw call: the extras chunk is already
 * one mesh per tile and already only built for the near (detail) tiles, which is the LOD — present
 * near the camera, dropped with the extras chunk beyond. A roof terrace adds a railing just inside
 * the parapet and a timber deck.
 */
import { ExtraSink, type WallFrame } from '../facadeExtraCore.js';
import { ROOF_SLOT_TONES } from '../look/palette.js';
import type { FurnitureItem, FurnitureKind } from './roofSlots.js';

/** Height above the roof (m), colour and minimum footprint (m) per kind. */
export const FURNITURE_UNITS: Readonly<Record<FurnitureKind, { h: number; hex: string; min: number; max: number; lift?: number }>> = {
  chimney: { h: 1.1, hex: '#6b5d55', min: 0.5, max: 1.4 },
  vent: { h: 0.8, hex: '#6a6d70', min: 0.25, max: 0.6 },
  skylight: { h: 0.32, hex: ROOF_SLOT_TONES.glass.hex, min: 0.5, max: 6 },
  hvac: { h: 1.25, hex: '#c9cbcd', min: 0.8, max: 5 },
  overrun: { h: 2.6, hex: '#a7a49c', min: 2, max: 9 },
  solar: { h: 0.12, hex: ROOF_SLOT_TONES.solar.hex, min: 0.9, max: 30, lift: 0.25 },
  railing: { h: 1.0, hex: '#9a9fa3', min: 0.04, max: 60 },
};
/** A closed box without a bottom: five faces, two triangles each. */
export const UNIT_TRIANGLES = 10;
const DECK_HEX = ROOF_SLOT_TONES.terrace.hex;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A free-standing box centred at (cx, cy), long axis at `yawDeg` (east = 0, counter-clockwise). */
function unitBox(sink: ExtraSink, cx: number, cy: number, l: number, w: number, yawDeg: number, z0: number, z1: number, hex: string): boolean {
  const t = yawDeg * Math.PI / 180, ux = Math.cos(t), uy = Math.sin(t), nx = -uy, ny = ux;
  const f: WallFrame = { x0: cx - nx * w / 2, y0: cy - ny * w / 2, ux, uy, nx, ny, len: l };
  return sink.box(f, -l / 2, l / 2, 0, w, z0, z1, hex, false, true);
}

type Rect = { cx: number; cy: number; ux: number; uy: number; len: number; wid: number } | null;

/**
 * Place the measured items on a flat roof at height `z`. `anchor` is the outline's first vertex in the
 * chunk's local metres; `rect` the roof's fitted rectangle (for the terrace railing). The sink's budget is
 * widened for the measured set (it is bounded by the detector's 16 items per roof).
 */
export function measuredRoofFurniture(roof: { furniture: readonly FurnitureItem[]; terrace: boolean }, anchor: [number, number], z: number, rect: Rect, sink: ExtraSink): number {
  const before = sink.tris.length, budget = sink.budget;
  sink.budget = Math.max(budget, before + roof.furniture.length * UNIT_TRIANGLES + (roof.terrace ? 6 * UNIT_TRIANGLES : 0));
  for (const it of roof.furniture) {
    const unit = FURNITURE_UNITS[it.kind];
    if (!unit) continue;
    const l = clamp(Math.max(it.l, it.w), unit.min, unit.max), w = clamp(Math.min(it.l, it.w), unit.min, unit.max);
    const z0 = z + (unit.lift ?? 0);
    unitBox(sink, anchor[0] + it.e, anchor[1] + it.n, l, w, it.l >= it.w ? it.yawDeg : it.yawDeg + 90, z0, z0 + unit.h, unit.hex);
  }
  if (roof.terrace && rect && rect.len > 4 && rect.wid > 4) {
    const yaw = Math.atan2(rect.uy, rect.ux) * 180 / Math.PI, inset = 0.45, L = rect.len - 2 * inset, W = rect.wid - 2 * inset;
    const vx = -rect.uy, vy = rect.ux, rail = FURNITURE_UNITS.railing;
    unitBox(sink, rect.cx, rect.cy, L * 0.6, W * 0.6, yaw, z, z + 0.06, DECK_HEX);
    for (const s of [-1, 1]) {
      unitBox(sink, rect.cx + vx * s * W / 2, rect.cy + vy * s * W / 2, L, rail.min, yaw, z, z + rail.h, rail.hex);
      unitBox(sink, rect.cx + rect.ux * s * L / 2, rect.cy + rect.uy * s * L / 2, W, rail.min, yaw + 90, z, z + rail.h, rail.hex);
    }
  }
  sink.budget = budget;
  return (sink.tris.length - before) / UNIT_TRIANGLES;
}
