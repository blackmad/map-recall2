// Facade extras: the small 3D parts that make an Amsterdam street read as Amsterdam.
//
// The textured cells give every house windows and doors; what they cannot give is depth:
// the hoist beam under a canal gable, the stoop up to a raised front door, flower boxes,
// Juliet balconies, a postwar block's balcony slabs, bikes against the wall, a roof
// terrace. Each extra is a named component with the facade styles it belongs to, a
// probability and a builder that places a few flat-coloured boxes on one wall (or one
// roof), aligned to that wall's own bay layout. Choices hash the building id and the wall,
// so a house keeps its extras between sessions; a per-wall and per-building box budget
// keeps the triangle count bounded (see `EXTRA_BUDGET`).

import type { FacadeStyle } from './genericFacades.js';
import type { WallLayout } from './facadeLayout.js';
import { ExtraSink, chanceFor, hash01, type ExtraContext, type RoofComponent, type RoofContext, type WallComponent } from './facadeExtraCore.js';
import { ORNAMENT_COMPONENTS, isStreetWall, openingsOf, windowSpans } from './facadeOrnaments.js';

export { ExtraSink, hash01, chanceFor } from './facadeExtraCore.js';
export type { V3, FlatTri, WallFrame, ExtraContext, RoofContext, WallComponent, RoofComponent, Chance } from './facadeExtraCore.js';
export { ORNAMENT_COMPONENTS } from './facadeOrnaments.js';

// --- Palettes -------------------------------------------------------------------
const STONE = '#cfc6b4', IRON = '#26282b', WOOD = '#5a4030', WHITE = '#efece4', GREEN = '#3f7a3a', DARKGREEN = '#2c4f33', CONCRETE = '#b9b5ac', GLASS = '#5d6f7c';
const FLOWERS = ['#e84a7f', '#f2b92e', '#ffffff', '#c04fd0', '#ff7a45', '#e8573d'];
const SHUTTERS = ['#2c4f33', '#1f3550', '#7a1f2b', '#2a2a2a', '#3f6f5a'];
const pickOf = <T>(list: readonly T[], r: number) => list[Math.floor(r * list.length) % list.length];

// --- Wall helpers -----------------------------------------------------------------
const bayCentre = (l: WallLayout, i: number) => (i + 0.5) * l.bayWidthM;
/** Window centres across the bays: the painted windows of this building's first upper storey. */
function windowXs(c: ExtraContext): number[] {
  const xs = windowSpans(c, 0).map(w => w.x);
  return xs.length ? xs : Array.from({ length: c.layout.bays }, (_, i) => bayCentre(c.layout, i));
}
/** The painted door's axis (facadeOpenings.ts), so stoops and lanterns stand on it. */
const doorX = (c: ExtraContext) => (c.layout.doorBays.length ? (c.layout.doorBays[0] + openingsOf(c).door.axis) * c.layout.bayWidthM : null);
const storeyZ = (c: ExtraContext, s: number) => c.base + c.layout.groundM + s * c.layout.storeyM;


const ALL: readonly FacadeStyle[] = ['canal', 'c19', 'school', 'postwar', 'modern', 'tower'];
const OLD: readonly FacadeStyle[] = ['canal', 'c19'];

/** Roof-plane box in a rectangle frame (u along, v across, both centred). */
function roofBox(c: RoofContext, s: ExtraSink, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, hex: string) {
  const { cx, cy, ux, uy } = c.rect, vx = -uy, vy = ux;
  return s.box({ x0: cx + vx * v0, y0: cy + vy * v0, ux, uy, nx: vx, ny: vy, len: 0 }, u0, u1, 0, v1 - v0, z0, z1, hex, false);
}

const STREET_FURNITURE: readonly WallComponent[] = [
  // --- Canal houses --------------------------------------------------------------
  { id: 'hoist-beam', group: 'hoist', street: true, styles: ['canal'], p: 0.55, build: (c, s) => {
    const x = c.f.len / 2; s.box(c.f, x - 0.1, x + 0.1, 0, 0.95, c.top - 0.55, c.top - 0.35, WOOD, true);
    s.box(c.f, x - 0.02, x + 0.02, 0.85, 0.9, c.top - 0.9, c.top - 0.55, IRON); } },
  { id: 'hoist-hood', group: 'hoist', street: true, styles: ['canal'], p: 0.2, build: (c, s) => {
    const x = c.f.len / 2; s.box(c.f, x - 0.1, x + 0.1, 0, 1.0, c.top - 0.6, c.top - 0.42, WOOD, true);
    s.slope(c.f, x - 0.35, x + 0.35, 0, 1.1, c.top - 0.05, c.top - 0.4, WOOD); } },
  { id: 'stoop', group: 'stoop', styles: ['canal'], p: 0.5, build: (c, s) => {
    const x = doorX(c); if (x == null || !c.groundLevel) return;
    for (let k = 0; k < 3; k++) s.box(c.f, x - 0.75, x + 0.75, 0, 1.2 - k * 0.35, c.base + k * 0.18, c.base + (k + 1) * 0.18, STONE);
    // Railings belong to the stoop: as their own component they stood on the pavement with no steps
    // under them and read as stray pickets (user 2026-10-03: "bunch of weird artifacts here too").
    if (hash01(`${c.id}:rail`) < 0.6) for (const dx of [-0.75, 0.72]) { s.box(c.f, x + dx, x + dx + 0.03, 0.1, 1.2, c.base + 0.75, c.base + 0.79, IRON); s.box(c.f, x + dx, x + dx + 0.03, 1.12, 1.16, c.base, c.base + 0.79, IRON); } } },
  { id: 'double-stoop', group: 'stoop', styles: ['canal'], p: 0.08, build: (c, s) => {
    const x = doorX(c); if (x == null || !c.groundLevel) return;
    s.box(c.f, x - 0.7, x + 0.7, 0, 1.0, c.base, c.base + 0.75, STONE);
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) s.box(c.f, x + side * (0.7 + k * 0.3) - (side > 0 ? 0 : 0.3), x + side * (0.7 + k * 0.3) + (side > 0 ? 0.3 : 0), 0.1, 0.95, c.base, c.base + 0.75 - k * 0.25, STONE); } },
  { id: 'basement-well', styles: ['canal', 'c19'], p: 0.25, build: (c, s) => {
    if (!c.groundLevel || c.shopfront) return; const xs = windowXs(c); const x = xs[xs.length - 1];
    // An openwork railing round the light well (top rail and bars); a solid iron plate read as a black slab (user 2026-10-03).
    s.strip(c.f, x - 0.6, x + 0.6, 0.62, c.base + 0.72, c.base + 0.76, IRON, 0.03);
    for (const dx of [-0.6, -0.3, 0, 0.3, 0.6]) s.strip(c.f, x + dx - 0.015, x + dx + 0.015, 0.62, c.base, c.base + 0.74, IRON, 0.03); } },
  { id: 'wall-anchors', styles: ['canal'], p: 0.5, build: (c, s) => {
    for (let k = 0; k < Math.min(3, c.layout.storeys); k++) for (const x of [0.5, c.f.len - 0.5]) {
      const z = storeyZ(c, k) - 0.1; s.box(c.f, x - 0.25, x + 0.25, 0, 0.05, z - 0.03, z + 0.03, IRON); s.box(c.f, x - 0.03, x + 0.03, 0, 0.05, z - 0.25, z + 0.25, IRON); } } },
  { id: 'gable-stone', styles: ['canal'], p: 0.15, build: (c, s) => {
    const x = doorX(c); if (x == null) return; const z = c.base + c.layout.groundM + 0.25;
    s.box(c.f, x - 0.35, x + 0.35, 0, 0.06, z, z + 0.5, STONE); s.box(c.f, x - 0.25, x + 0.25, 0.06, 0.08, z + 0.08, z + 0.42, pickOf(['#3f6f8a', '#a8442c', '#c9a227'], hash01(c.id))); } },
  { id: 'door-pediment', group: 'door-frame', styles: ['canal'], p: 0.3, build: (c, s) => {
    const x = doorX(c); if (x == null) return; const z = c.base + Math.min(2.7, c.layout.groundM - 0.2);
    s.box(c.f, x - 0.65, x + 0.65, 0, 0.18, z, z + 0.14, STONE, true); s.slope(c.f, x - 0.6, x + 0.6, 0, 0.16, z + 0.45, z + 0.14, STONE); } },
  { id: 'shutters-3d', styles: ['canal'], p: 0.3, build: (c, s, r) => {
    const hex = pickOf(SHUTTERS, r), z0 = c.base + 0.9, z1 = z0 + 1.5;
    for (const x of windowXs(c).slice(0, 3)) for (const side of [-1, 1]) s.box(c.f, x + side * 0.62 - 0.22, x + side * 0.62 + 0.22, 0, 0.06, z0, z1, hex); } },
  // --- Flowers and green --------------------------------------------------------
  { id: 'flower-boxes', styles: ALL, p: 0.25, build: (c, s, r) => {
    const z = c.base + c.layout.groundM + 0.85; if (!c.layout.storeys) return;
    for (const [i, x] of windowXs(c).slice(0, 4).entries()) { s.box(c.f, x - 0.5, x + 0.5, 0, 0.3, z - 0.25, z, WOOD, true); s.box(c.f, x - 0.48, x + 0.48, 0.05, 0.32, z, z + 0.2, pickOf(FLOWERS, r + i * 0.17)); } } },
  { id: 'ground-flower-boxes', styles: ['canal', 'c19'], p: 0.2, build: (c, s, r) => {
    const z = c.base + 0.95; for (const [i, x] of windowXs(c).slice(0, 3).entries()) { if (doorX(c) != null && Math.abs(x - (doorX(c) as number)) < 0.8) continue; s.box(c.f, x - 0.5, x + 0.5, 0, 0.28, z - 0.22, z, '#3a3f45', true); s.box(c.f, x - 0.48, x + 0.48, 0.04, 0.3, z, z + 0.22, pickOf(FLOWERS, r * 3 + i * 0.29)); } } },
  { id: 'geveltuin', styles: ['canal', 'c19', 'school'], p: 0.3, build: (c, s, r) => {
    // Low leafy clumps hugging the wall, never in front of a shop window. Tall thin stalks read as
    // green posts (user 2026-10-03: "random artifacts in front of buildings").
    if (!c.groundLevel || c.shopfront) return; const d = doorX(c);
    for (let x = 0.45; x < Math.min(c.f.len - 0.45, 6); x += 0.9) { if (d != null && Math.abs(x - d) < 0.9) continue; const h = 0.4 + hash01(`${c.id}:${x}`) * 0.6;
      s.box(c.f, x - 0.32, x + 0.32, 0.02, 0.28, c.base, c.base + h, hash01(`${c.id}:g${x}`) < 0.5 ? GREEN : DARKGREEN); if (hash01(`${c.id}:f${x}`) < 0.4) s.box(c.f, x - 0.2, x + 0.2, 0.05, 0.3, c.base + h, c.base + h + 0.12, pickOf(['#e84a7f', '#f2b92e', '#c04fd0', '#ffffff'], r + x)); } } },
  // Ivy as a thin climber hugging the wall to the first floor, in a few ragged fingers: a 2.2 m
  // dark slab up to 10 m read as a black-green box (user 2026-10-03: "awful imposing extrusions on our canal house grammar").
  { id: 'climbing-ivy', styles: ['school', 'postwar', 'modern'], p: 0.05, build: (c, s) => {
    const x0 = hash01(c.wallKey) * Math.max(0, c.f.len - 2), top = Math.min(c.top - c.base, c.layout.groundM + 1.5);
    for (let k = 0; k < 4; k++) { const x = x0 + 0.15 + k * 0.4, h = top * (0.55 + 0.45 * hash01(`${c.wallKey}:iv${k}`));
      s.box(c.f, x, x + 0.32, 0, 0.04, c.base, c.base + h, k % 2 ? GREEN : '#4f7a45'); } } },
  // --- 19th century -----------------------------------------------------------------
  { id: 'juliet-balcony', group: 'balcony', styles: ['c19', 'school'], p: 0.3, build: (c, s) => {
    if (c.layout.storeys < 2) return; const z = storeyZ(c, 1) + 0.05;
    // An openwork railing (top rail, foot rail, bars) rather than a solid plate, which read as a black box.
    for (const x of windowXs(c).slice(0, 4)) {
      s.box(c.f, x - 0.6, x + 0.6, 0, 0.35, z, z + 0.06, STONE, true);
      s.strip(c.f, x - 0.6, x + 0.6, 0.34, z + 0.88, z + 0.94, IRON, 0.04); s.strip(c.f, x - 0.6, x + 0.6, 0.34, z + 0.14, z + 0.18, IRON, 0.03);
      for (const dx of [-0.5, -0.17, 0.17, 0.5]) s.strip(c.f, x + dx - 0.02, x + dx + 0.02, 0.34, z + 0.06, z + 0.9, IRON, 0.03);
    } } },
  { id: 'bay-window', group: 'oriel', styles: ['c19', 'school'], p: 0.2, build: (c, s) => {
    if (c.layout.storeys < 1 || c.f.len < 5) return; const x = c.f.len / 2, z0 = storeyZ(c, 0), z1 = z0 + c.layout.storeyM * Math.min(2, c.layout.storeys) - 0.2;
    // A shallow oriel with light framed panes, one storey: 0.8 m deep over two storeys with a
    // single dark glass sheet read as a grey box bolted on (user 2026-10-03: "awful imposing extrusions on our canal house grammar").
    const zz1 = z0 + c.layout.storeyM - 0.25; void z1;
    s.box(c.f, x - 1.1, x + 1.1, 0, 0.45, z0 + 0.15, zz1, c.wallHex, true);
    for (const [a, b] of [[-0.95, -0.35], [-0.3, 0.3], [0.35, 0.95]]) s.box(c.f, x + a, x + b, 0.45, 0.47, z0 + 0.6, zz1 - 0.35, '#9fb6c4');
    s.box(c.f, x - 1.18, x + 1.18, 0, 0.52, zz1, zz1 + 0.12, WHITE, true); } },
  { id: 'cornice-brackets', group: 'crown', styles: ['c19', 'canal'], p: 0.35, build: (c, s) => {
    const z = c.top - 0.15; s.box(c.f, 0, c.f.len, 0, 0.3, z - 0.1, z + 0.1, STONE, true);
    for (let x = 0.4; x < c.f.len - 0.2; x += 1.1) s.box(c.f, x - 0.06, x + 0.06, 0, 0.24, z - 0.42, z - 0.1, STONE); } },
  { id: 'door-canopy', group: 'door-frame', styles: ['c19', 'school', 'postwar'], p: 0.25, build: (c, s) => {
    const x = doorX(c); if (x == null) return; const z = c.base + Math.min(2.6, c.layout.groundM - 0.25);
    // A slim canopy over the door only (user 2026-10-03: "awful imposing extrusions on our canal house grammar"): 0.5 m out, not a 0.9 m black slab.
    s.box(c.f, x - 0.65, x + 0.65, 0, 0.5, z, z + 0.06, c.style === 'c19' ? '#3a3f45' : CONCRETE, true); } },
  { id: 'downpipe', styles: ALL, p: 0.4, build: (c, s) => {
    const x = hash01(`${c.wallKey}:dp`) < 0.5 ? 0.15 : c.f.len - 0.15; s.box(c.f, x - 0.05, x + 0.05, 0, 0.1, c.base, c.top - 0.2, '#4a4d50'); s.box(c.f, x - 0.15, x + 0.15, 0, 0.2, c.top - 0.45, c.top - 0.2, '#4a4d50'); } },
  { id: 'gutter', group: 'crown', styles: ['canal', 'c19', 'school'], p: 0.3, build: (c, s) => { s.box(c.f, 0, c.f.len, 0, 0.16, c.top - 0.12, c.top, '#3a3d40', true); } },
  // --- Amsterdam School ------------------------------------------------------------
  { id: 'brick-balcony', styles: ['school'], p: 0.3, build: (c, s) => {
    for (let k = 1; k < Math.min(3, c.layout.storeys + 1); k++) { const x = c.f.len / 2, z = storeyZ(c, k - 1) + 0.05;
      // Shallow brick balconies (user 2026-10-03: "awful imposing extrusions on our canal house grammar"): 0.5 m out with a low parapet, not 1 m stacked boxes.
      s.box(c.f, x - 1.2, x + 1.2, 0, 0.5, z, z + 0.12, c.wallHex, true); s.box(c.f, x - 1.2, x + 1.2, 0.4, 0.5, z + 0.12, z + 0.8, c.wallHex); } } },
  { id: 'brick-bands', styles: ['school'], p: 0.35, build: (c, s) => {
    for (let k = 0; k < c.layout.storeys; k++) s.box(c.f, 0, c.f.len, 0, 0.05, storeyZ(c, k) - 0.15, storeyZ(c, k), '#6b3a2c'); } },
  { id: 'stair-glass', styles: ['school', 'postwar', 'modern'], p: 0.3, build: (c, s) => {
    const x = doorX(c) ?? c.f.len / 2; s.box(c.f, x - 0.5, x + 0.5, 0, 0.06, c.base + c.layout.groundM + 0.3, c.top - 0.6, GLASS); } },
  { id: 'window-grilles', styles: ['school', 'c19'], p: 0.15, build: (c, s) => {
    const d = doorX(c); for (const x of windowXs(c).slice(0, 4)) { if (d != null && Math.abs(x - d) < 0.8) continue; for (let k = -2; k <= 2; k++) s.box(c.f, x + k * 0.22 - 0.02, x + k * 0.22 + 0.02, 0.04, 0.08, c.base + 0.8, c.base + 2.4, IRON); } } },
  // --- Postwar / modern ------------------------------------------------------------------
  { id: 'balcony-slabs', styles: ['postwar'], p: 0.5, build: (c, s) => {
    for (let k = 0; k < Math.min(6, c.layout.storeys); k++) for (let i = 0; i < c.layout.bays; i += 2) { const x = bayCentre(c.layout, i), z = storeyZ(c, k) + 0.02;
      s.box(c.f, x - 1.4, x + 1.4, 0, 1.2, z, z + 0.15, CONCRETE, true); s.box(c.f, x - 1.4, x + 1.4, 1.15, 1.2, z + 0.15, z + 1.0, k % 2 ? '#d9d4c7' : '#c84b3c'); } } },
  { id: 'gallery-walkway', styles: ['postwar'], p: 0.18, build: (c, s) => {
    for (let k = 0; k < Math.min(8, c.layout.storeys); k++) { const z = storeyZ(c, k) + 0.02; s.box(c.f, 0, c.f.len, 0, 1.5, z, z + 0.18, CONCRETE, true); s.box(c.f, 0, c.f.len, 1.45, 1.5, z + 0.18, z + 1.05, '#e6e2d8'); } } },
  { id: 'satellite-dishes', styles: ['postwar'], p: 0.3, build: (c, s) => {
    for (let k = 0; k < 3; k++) { const x = hash01(`${c.wallKey}:sd${k}`) * c.f.len, z = storeyZ(c, Math.floor(hash01(`${c.wallKey}:sz${k}`) * Math.max(1, c.layout.storeys))) + 1.3;
      s.box(c.f, x - 0.3, x + 0.3, 0.9, 0.95, z - 0.3, z + 0.3, '#e9e7e2'); } } },
  { id: 'entrance-slab', styles: ['postwar', 'modern', 'tower'], p: 0.4, build: (c, s) => {
    const x = doorX(c); if (x == null) return; s.box(c.f, x - 1.3, x + 1.3, 0, 1.0, c.base + 2.6, c.base + 2.75, CONCRETE, true); } },
  { id: 'glass-balconies', styles: ['modern', 'tower'], p: 0.45, build: (c, s) => {
    for (let k = 0; k < Math.min(8, c.layout.storeys); k++) { const z = storeyZ(c, k) + 0.02, x = c.f.len * (0.25 + 0.5 * (k % 2));
      s.box(c.f, x - 1.5, x + 1.5, 0, 0.9, z, z + 0.08, CONCRETE, true); s.box(c.f, x - 1.5, x + 1.5, 0.87, 0.9, z + 0.08, z + 1.0, '#c3d6de'); } } },
  { id: 'vertical-fins', styles: ['modern', 'tower'], p: 0.25, build: (c, s) => {
    for (let x = 0.6; x < c.f.len - 0.3; x += 1.5) s.box(c.f, x - 0.05, x + 0.05, 0, 0.22, c.base + c.layout.groundM, c.top - 0.3, '#d6d2c8'); } },
  { id: 'garage-door', styles: ['postwar'], p: 0.12, build: (c, s) => { if (!c.groundLevel || c.f.len < 4) return; const x = c.f.len - 2; s.box(c.f, x - 1.25, x + 1.25, 0, 0.04, c.base, c.base + 2.3, '#9aa0a6'); } },
  { id: 'plinth', group: 'plinth', styles: ['canal', 'c19', 'school'], p: 0.35, build: (c, s) => { if (c.groundLevel) s.box(c.f, 0, c.f.len, 0, 0.06, c.base, c.base + 0.5, '#3a3530'); } },
  // --- Street life ------------------------------------------------------------------
  // Parked bikes and racks were removed 2026-10-03: drawn per facade they stood out from the
  // wall as dark pickets on the pavement (user: "bunch of weird artifacts here too").
  { id: 'bench', styles: ['canal', 'c19'], p: 0.1, build: (c, s) => { if (!c.groundLevel || c.shopfront) return; const x = c.f.len * 0.3; s.box(c.f, x - 0.8, x + 0.8, 0.1, 0.5, c.base, c.base + 0.45, WOOD); s.box(c.f, x - 0.8, x + 0.8, 0.05, 0.12, c.base + 0.45, c.base + 0.9, WOOD); } },
  { id: 'door-lantern', styles: ['canal', 'c19'], p: 0.3, build: (c, s) => {
    // A small black lantern on its bracket with a warm pane; a 20 cm yellow block read as a box (user 2026-10-03).
    const x = doorX(c); if (x == null) return; const z = c.base + 2.3; s.box(c.f, x + 0.6, x + 0.63, 0, 0.22, z + 0.26, z + 0.29, IRON);
    s.box(c.f, x + 0.56, x + 0.67, 0.14, 0.25, z, z + 0.24, IRON); s.box(c.f, x + 0.575, x + 0.655, 0.13, 0.26, z + 0.04, z + 0.2, '#e8c878'); } },
  { id: 'house-flag', styles: ['canal', 'c19'], p: 0.06, build: (c, s, r) => {
    const z = storeyZ(c, 0) + 0.5; s.box(c.f, 0.5, 0.54, 0, 1.6, z, z + 0.04, '#d9d4c7');
    const colours = r < 0.4 ? ['#ae1c28', '#ffffff', '#21468b'] : r < 0.7 ? ['#ec0000', '#000000', '#ec0000'] : ['#e40303', '#ff8c00', '#008026'];
    colours.forEach((hex, i) => s.box(c.f, 0.52, 0.55, 0.6, 1.55, z - 0.15 - i * 0.2, z - i * 0.2, hex)); } },
  { id: 'scaffolding', styles: ALL, p: 0.025, build: (c, s) => {
    const h = c.top - c.base, L = Math.min(c.f.len, 10);
    for (let x = 0; x <= L; x += 2.5) s.box(c.f, x - 0.03, x + 0.03, 0.9, 0.96, c.base, c.base + h, '#9aa0a6');
    for (let z = 2; z < h; z += 2) s.box(c.f, 0, L, 0.3, 1.0, c.base + z, c.base + z + 0.05, '#c9a76a', true); } },
];

export const ROOF_COMPONENTS: readonly RoofComponent[] = [
  { id: 'roof-terrace', styles: ['canal', 'c19', 'school', 'postwar'], p: 0.18, build: (c, s, r) => {
    const { len, wid } = c.rect, u = len * 0.25, v = wid * 0.25;
    for (const [a, b, p, q] of [[-u, u, -v, -v + 0.04], [-u, u, v - 0.04, v], [-u, -u + 0.04, -v, v], [u - 0.04, u, -v, v]] as const) roofBox(c, s, a, b, p, q, c.z, c.z + 1.0, '#9a9fa3');
    roofBox(c, s, -0.03, 0.03, -0.03, 0.03, c.z, c.z + 2.0, '#e9e6de'); roofBox(c, s, -1.0, 1.0, -1.0, 1.0, c.z + 2.0, c.z + 2.1, pickOf(['#e85a3c', '#f2b92e', '#ffffff', '#2a9d8f'], r)); } },
  { id: 'roof-extension', styles: ['c19', 'school', 'postwar'], p: 0.15, build: (c, s) => {
    const { len, wid } = c.rect; if (len < 8 || wid < 6) return; roofBox(c, s, -len * 0.3, len * 0.3, -wid * 0.1, wid * 0.35, c.z, c.z + 2.6, '#5d6064'); roofBox(c, s, -len * 0.3, len * 0.3, -wid * 0.12, -wid * 0.1, c.z + 0.3, c.z + 2.2, GLASS); } },
  { id: 'ac-units', styles: ['postwar', 'modern', 'tower', 'school'], p: 0.35, build: (c, s) => {
    for (let k = 0; k < 3; k++) { const u = (hash01(`${c.id}:ac${k}`) - 0.5) * c.rect.len * 0.7, v = (hash01(`${c.id}:av${k}`) - 0.5) * c.rect.wid * 0.7; roofBox(c, s, u - 0.5, u + 0.5, v - 0.4, v + 0.4, c.z, c.z + 0.9, '#c9cbcd'); } } },
  { id: 'skylights', styles: ALL, p: 0.3, build: (c, s) => {
    for (let k = 0; k < 2; k++) { const u = (hash01(`${c.id}:sk${k}`) - 0.5) * c.rect.len * 0.6; roofBox(c, s, u - 0.6, u + 0.6, -0.5, 0.5, c.z, c.z + 0.35, GLASS); } } },
  { id: 'solar-panels', styles: ['c19', 'school', 'postwar', 'modern'], p: 0.25, build: (c, s) => {
    const { len, wid } = c.rect; for (let k = 0; k < Math.min(5, Math.floor(len / 2.2)); k++) { const u = -len * 0.35 + k * 2.2; roofBox(c, s, u, u + 1.7, -wid * 0.3, -wid * 0.3 + 1.0, c.z + 0.2, c.z + 0.45, '#2b3a55'); } } },
  { id: 'antenna', styles: ['canal', 'c19', 'school', 'postwar'], p: 0.15, build: (c, s) => { roofBox(c, s, -0.03, 0.03, 0.3, 0.36, c.z, c.z + 3.2, '#8a8f94'); roofBox(c, s, -0.6, 0.6, 0.31, 0.35, c.z + 2.8, c.z + 2.84, '#8a8f94'); } },
  { id: 'roof-garden', styles: ['postwar', 'modern', 'school'], p: 0.15, build: (c, s) => { const { len, wid } = c.rect; roofBox(c, s, -len * 0.35, len * 0.35, -wid * 0.35, wid * 0.35, c.z, c.z + 0.08, '#5f8a4a'); roofBox(c, s, -0.6, 0.6, -0.6, 0.6, c.z + 0.08, c.z + 1.4, GREEN); } },
  { id: 'lift-housing', styles: ['postwar', 'modern', 'tower'], p: 0.4, build: (c, s) => { const u = c.rect.len * 0.2; roofBox(c, s, u - 1.2, u + 1.2, -1.2, 1.2, c.z, c.z + 2.4, '#a7a49c'); } },
  { id: 'vent-stacks', styles: ['canal', 'c19', 'school', 'postwar'], p: 0.3, build: (c, s) => { for (let k = 0; k < 3; k++) { const u = (hash01(`${c.id}:vs${k}`) - 0.5) * c.rect.len * 0.7; roofBox(c, s, u - 0.1, u + 0.1, -0.1 + k * 0.4, 0.1 + k * 0.4, c.z, c.z + 0.9, '#6a6d70'); } } },
  { id: 'water-tank', styles: ['school', 'postwar'], p: 0.06, build: (c, s) => { roofBox(c, s, -1.2, 1.2, -1.2, 1.2, c.z + 1.6, c.z + 3.6, '#7c6a58'); for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) roofBox(c, s, u - 0.06, u + 0.06, v - 0.06, v + 0.06, c.z, c.z + 1.6, IRON); } },
];

/**
 * Triangle budgets. A street wall may spend `wall`, any other wall `sideWall`; the building (walls
 * and flat roof together) `building`, of which `streetReserve` is held back for its street wall
 * until that wall has been dressed (walls arrive in ring order, often back walls first).
 * Measured on the 40-house sample of scripts/check-facade-extras.ts; see HISTORY.md for the cost.
 */
export const EXTRA_BUDGET = { wall: 180, sideWall: 30, building: 230, streetReserve: 160 } as const;

/** Everything a wall can get: the architecture first (it is what reads from down the street), then the furniture. */
// The budget runs out in this order, so the parts that read from down the street come first:
// the crown, the front door and its stoop, the hoist beam, the sills and balconies.
const FIRST = ['kroonlijst', 'console-cornice', 'corbel-roofline', 'stepped-parapet', 'white-fascia', 'door-surround', 'portiek', 'brick-door-arch',
  'stoop', 'double-stoop', 'hoist-beam', 'hoist-hood', 'window-sills', 'iron-balconies', 'brick-fins'];
const ALL_WALL = [...ORNAMENT_COMPONENTS, ...STREET_FURNITURE];
export const WALL_COMPONENTS: readonly WallComponent[] = [...FIRST.map(id => ALL_WALL.find(c => c.id === id)!), ...ALL_WALL.filter(c => !FIRST.includes(c.id))];
const ATOMIC = new Set(ORNAMENT_COMPONENTS.map(c => c.id));
// Building-wide choices of the original set (shutters, balcony slabs) use the building's roll so all its walls agree.
const WIDE = new Set(['shutters-3d', 'balcony-slabs', 'gallery-walkway', 'glass-balconies', 'brick-bands', 'cornice-brackets', 'gutter', 'plinth', 'flower-boxes']);
const streetDressed = new WeakSet<ExtraSink>();
/** Tuning hook (scripts only): sees every wall's context and the components it got. */
export const extraUsage: { record: null | ((c: ExtraContext, used: readonly string[]) => void) } = { record: null };

/** Every wall extra this wall gets, in registry order, within the budget. */
export function wallExtras(c: ExtraContext, sink: ExtraSink): string[] {
  const used: string[] = [], groups = new Set<string>();
  const street = isStreetWall(c), period = c.period ?? c.style, outer = sink.budget;
  const reserve = street || streetDressed.has(sink) ? 0 : EXTRA_BUDGET.streetReserve;
  sink.budget = Math.max(sink.tris.length, Math.min(outer - reserve, sink.tris.length + (street ? EXTRA_BUDGET.wall : EXTRA_BUDGET.sideWall)));
  for (const comp of WALL_COMPONENTS) {
    // Ornaments follow the building's period; street furniture (a stoop, a hoist beam) also its
    // layout style, so a 19th-century house laid out as a canal house keeps its stoop.
    const as = comp.styles.includes(period) ? period : !ATOMIC.has(comp.id) && comp.styles.includes(c.style) ? c.style : null;
    if (!as || (comp.street && !street) || (comp.group && groups.has(comp.group))) continue;
    const roll = comp.wide || WIDE.has(comp.id) ? hash01(`${c.id}:${comp.id}`) : hash01(`${c.id}:${c.wallKey}:${comp.id}`);
    if (roll >= chanceFor(comp.p, as)) continue;
    const before = sink.tris.length, atomic = comp.atomic ?? ATOMIC.has(comp.id);
    if (atomic) sink.begin();
    comp.build(c, sink, hash01(`${c.id}:${comp.id}:v`));
    if (atomic && !sink.commit()) continue;
    if (sink.tris.length > before) { used.push(comp.id); if (comp.group) groups.add(comp.group); }
  }
  sink.budget = outer;
  if (street) streetDressed.add(sink);
  extraUsage.record?.(c, used);
  return used;
}

export function roofExtras(c: RoofContext, sink: ExtraSink): string[] {
  const used: string[] = [];
  for (const comp of ROOF_COMPONENTS) {
    if (!comp.styles.includes(c.style) || hash01(`${c.id}:${comp.id}`) >= comp.p) continue;
    const before = sink.boxes;
    comp.build(c, sink, hash01(`${c.id}:${comp.id}:v`));
    if (sink.boxes > before) used.push(comp.id);
  }
  return used;
}

export const COMPONENT_COUNT = WALL_COMPONENTS.length + ROOF_COMPONENTS.length;
