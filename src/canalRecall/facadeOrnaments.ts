// Facade ornaments: the architectural dressing of an Amsterdam facade, in 3D.
//
// facadeExtras.ts holds the street furniture of a facade (hoist beams, stoops, bikes, balconies);
// this file holds its architecture, the parts a painter would pick out in white:
//   - canal houses (17th-18th c.): the crowning kroonlijst on consoles, white sills, lintels with
//     keystones and proud window frames, a door surround with its fanlight bars, floor cornices,
//     pilasters, warehouse loading doors, vases on the cornice;
//   - 19th century: stucco window hoods, string courses, a rusticated plinth, a console cornice;
//   - Amsterdam School (1910-1935): brick fins on the piers, corbelled and stepped rooflines,
//     rounded oriels, a stone plinth band, corner sculpture, ribbon bands, small-paned frames in
//     white or orange, a brick door arch, a corner tower;
//   - postwar and modern: a white roof fascia.
// Everything lines up with the painted openings (facadeOpenings.ts) and the wall's bay grid,
// is drawn as flat-coloured boxes and strips, and is atomic (all of a cornice or none of it).

import { BOX_TRIS, type ExtraContext, type ExtraSink, type WallComponent } from './facadeExtraCore.js';
import { bayLookOpenings, proceduralOpenings, type OpeningRow, type Openings } from './facadeOpenings.js';
import type { FacadeStyle } from './genericFacades.js';

// --- Palette ---------------------------------------------------------------------
export const WHITE = '#efece4', CREAM = '#e4d9bf', STONE = '#cfc6b4', SANDSTONE = '#cdbb98', BLUESTONE = '#5b6066';
const GLAZED_TILE = ['#3d5a4c', '#2f3f52', '#6b3f2e'], SCHOOL_FRAMES = [WHITE, WHITE, '#d9772e', '#e8e0c8'];
const IRON = '#1f2124';
const LUIKEN = ['#2c4f33', '#7a1f2b', '#1f2a2a', '#2c4f33'];
const pickOf = <T>(list: readonly T[], r: number) => list[Math.floor(r * list.length) % list.length];

/** A colour scaled towards black (k < 1) or white (k > 1). */
export function shadeHex(hex: string, k: number): string {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const out = v.map(c => Math.max(0, Math.min(255, Math.round(k <= 1 ? c * k : c + (255 - c) * (k - 1)))));
  return `#${out.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

// --- Geometry helpers --------------------------------------------------------------
const BAY_LOOK_STYLES: readonly FacadeStyle[] = ['canal', 'school', 'modern'];
/** The openings this building's walls show: given by the mesh, else the bay look's (the default look). */
export const openingsOf = (c: ExtraContext): Openings => c.openings ?? (BAY_LOOK_STYLES.includes(c.style) ? bayLookOpenings(c.id, c.style) : proceduralOpenings(c.style));
export const isStreetWall = (c: ExtraContext) => c.streetSide ?? c.layout.doorBays.length > 0;
export const storeyZ = (c: ExtraContext, s: number) => c.base + c.layout.groundM + s * c.layout.storeyM;

export type Span = { x: number; hw: number; z0: number; z1: number };
/** The window openings of one row across the wall: upper storey `s`, or the ground floor (s = -1). */
export function windowSpans(c: ExtraContext, s: number): Span[] {
  const o = openingsOf(c), l = c.layout, bw = l.bayWidthM, out: Span[] = [];
  const doors = new Set(l.doorBays);
  for (let i = 0; i < l.bays; i++) {
    const row: OpeningRow | null = s >= 0 ? o.upper : doors.has(i) ? o.doorWindow : c.shopfront ? null : o.ground;
    if (!row) continue;
    const z = s >= 0 ? storeyZ(c, s) : c.base, h = s >= 0 ? l.storeyM : l.groundM;
    for (const axis of row.axes) out.push({ x: (i + axis) * bw, hw: (row.width * bw) / 2, z0: z + row.sill * h, z1: z + row.head * h });
  }
  return out;
}
/** The front door of this wall, if it has one. */
export function doorSpan(c: ExtraContext): Span | null {
  if (!c.layout.doorBays.length || !c.groundLevel) return null;
  const d = openingsOf(c).door, bw = c.layout.bayWidthM, g = c.layout.groundM;
  return { x: (c.layout.doorBays[0] + d.axis) * bw, hw: (d.width * bw) / 2, z0: c.base + d.bottom * g, z1: c.base + d.top * g };
}
/** Piers: the wall between window columns (and near each end), where consoles and fins stand. */
export function pierXs(c: ExtraContext): number[] {
  const xs = windowSpans(c, 0).map(w => w.x).sort((a, b) => a - b), out = [Math.min(0.2, c.f.len / 4)];
  for (let i = 1; i < xs.length; i++) out.push((xs[i - 1] + xs[i]) / 2);
  out.push(c.f.len - Math.min(0.2, c.f.len / 4));
  return out;
}
/** [a0, a1] with the door (plus a margin) cut out. */
function aroundDoor(c: ExtraContext, a0: number, a1: number, margin = 0.12): Array<[number, number]> {
  const d = doorSpan(c);
  if (!d) return [[a0, a1]];
  const out: Array<[number, number]> = [], l = d.x - d.hw - margin, r = d.x + d.hw + margin;
  if (l > a0 + 0.05) out.push([a0, Math.min(a1, l)]);
  if (r < a1 - 0.05) out.push([Math.max(a0, r), a1]);
  return out;
}
/** How many upper storeys of per-window dressing fit `room` triangles at `perWindow` each (at least 1, at most `max`). */
function storeysThatFit(c: ExtraContext, s: ExtraSink, perWindow: number, max: number): number {
  const per = Math.max(1, windowSpans(c, 0).length) * perWindow;
  return Math.max(1, Math.min(max, c.layout.storeys, Math.floor(s.room() / per)));
}

// --- Components ------------------------------------------------------------------------
const CANAL: readonly FacadeStyle[] = ['canal', 'c19'];

export const ORNAMENT_COMPONENTS: readonly WallComponent[] = [
  // --- Crowns: one per wall, the strongest line on a facade --------------------------------
  { id: 'kroonlijst', styles: CANAL, p: { canal: 0.6, c19: 0.15 }, wide: true, street: true, group: 'crown', build: (c, s, r) => {
    // Deep moulded cornice in white: a bed moulding, the corona and a drip, on consoles at the piers.
    // Not under a stepped or neck gable: that front ends in its gable (roofMesh.ts).
    if (c.roofKind === 'gable') return;
    const t = c.top, hex = r < 0.75 ? WHITE : CREAM;
    s.box(c.f, 0, c.f.len, 0, 0.3, t - 0.5, t - 0.34, hex, true);
    s.box(c.f, 0, c.f.len, 0, 0.55, t - 0.34, t - 0.12, hex, true);
    s.box(c.f, 0, c.f.len, 0, 0.68, t - 0.12, t, hex, true);
    for (const x of pierXs(c).slice(0, 6)) s.box(c.f, Math.max(0, x - 0.11), Math.min(c.f.len, x + 0.11), 0.05, 0.4, t - 0.88, t - 0.5, hex);
  } },
  { id: 'console-cornice', styles: ['c19', 'canal'], p: { c19: 0.4, canal: 0.12 }, wide: true, street: true, group: 'crown', build: (c, s) => {
    // Late 19th century: a cream cornice on paired consoles, with a plain frieze strip.
    if (c.roofKind === 'gable') return;
    const t = c.top;
    s.strip(c.f, 0, c.f.len, 0.04, t - 0.62, t - 0.32, CREAM);
    s.box(c.f, 0, c.f.len, 0, 0.55, t - 0.32, t - 0.12, CREAM, true);
    s.box(c.f, 0, c.f.len, 0, 0.66, t - 0.12, t, WHITE, true);
    const piers = pierXs(c), ends = piers.length > 2 ? [piers[0], piers[Math.floor(piers.length / 2)], piers[piers.length - 1]] : piers;
    for (const x of ends) for (const dx of [-0.16, 0.08]) s.box(c.f, Math.max(0, x + dx), Math.min(c.f.len, x + dx + 0.08), 0.04, 0.45, t - 0.62, t - 0.32, CREAM);
  } },
  { id: 'corbel-roofline', styles: ['school'], p: 0.45, wide: true, street: true, group: 'crown', build: (c, s) => {
    // Amsterdam School: brick courses corbelled out step by step under a cream coping.
    const t = c.top, brick = shadeHex(c.wallHex, 0.82);
    s.box(c.f, 0, c.f.len, 0, 0.08, t - 0.62, t - 0.46, brick, true);
    s.box(c.f, 0, c.f.len, 0, 0.17, t - 0.46, t - 0.3, brick, true);
    s.box(c.f, 0, c.f.len, 0, 0.27, t - 0.3, t - 0.06, brick, true);
    s.box(c.f, 0, c.f.len, 0, 0.33, t - 0.06, t + 0.06, CREAM, true);
  } },
  { id: 'stepped-parapet', styles: ['school'], p: 0.2, wide: true, street: true, group: 'crown', rise: 1.25, build: (c, s) => {
    // A stepped brick parapet rising to the middle of the front, each step capped in stone.
    if (c.f.len < 6) return;
    const t = c.top, L = c.f.len, brick = shadeHex(c.wallHex, 0.9);
    const steps: Array<[number, number, number]> = [[0, L, 0.35], [L * 0.22, L * 0.78, 0.75], [L * 0.38, L * 0.62, 1.1]];
    let z = t;
    for (const [a0, a1, h] of steps) { s.box(c.f, a0, a1, 0, 0.3, z, t + h, brick, false, true); s.box(c.f, a0 - 0.04, a1 + 0.04, -0.02, 0.36, t + h, t + h + 0.08, CREAM, true, true); z = t + h; }
  } },
  { id: 'white-fascia', styles: ['postwar', 'modern', 'tower'], p: { postwar: 0.5, modern: 0.35, tower: 0.25 }, wide: true, group: 'crown', build: (c, s) => {
    s.box(c.f, 0, c.f.len, 0, 0.22, c.top - 0.42, c.top, WHITE, true);
  } },
  // --- Doors ------------------------------------------------------------------------------------
  { id: 'door-surround', styles: CANAL, p: { canal: 0.5, c19: 0.4 }, street: true, group: 'door-frame', build: (c, s, r) => {
    // White jambs, an entablature over the door and the fanlight's radiating bars.
    const d = doorSpan(c); if (!d) return;
    const l = d.x - d.hw, rr = d.x + d.hw, top = d.z1 + 0.04;
    s.box(c.f, l - 0.2, l, 0, 0.1, d.z0, top, WHITE);
    s.box(c.f, rr, rr + 0.2, 0, 0.1, d.z0, top, WHITE);
    s.box(c.f, l - 0.3, rr + 0.3, 0, 0.2, top, top + 0.22, WHITE, true);
    if (r < 0.5) s.box(c.f, l - 0.36, rr + 0.36, 0, 0.26, top + 0.22, top + 0.3, WHITE, true);
    if (openingsOf(c).door.fanlight) {
      const fz0 = d.z1 - (d.z1 - d.z0) * 0.28;
      s.strip(c.f, l, rr, 0.05, fz0 - 0.04, fz0, WHITE);
      for (const k of [-0.5, 0, 0.5]) s.strip(c.f, d.x + k * d.hw * 0.7 - 0.02, d.x + k * d.hw * 0.7 + 0.02, 0.05, fz0, d.z1 - 0.04, WHITE);
    }
  } },
  { id: 'portiek', styles: CANAL, p: { c19: 0.35, canal: 0.06 }, street: true, group: 'door-frame', build: (c, s) => {
    // A recessed, round-headed entrance between the shops with a steep stone stair up to the
    // upper-floor door: a dark recess, a stone arch surround and the stair climbing out of it.
    const d = doorSpan(c); if (!d || !c.groundLevel) return;
    const l = d.x - d.hw - 0.05, rr = d.x + d.hw + 0.05, top = c.base + c.layout.groundM - 0.15;
    s.strip(c.f, l, rr, 0.02, c.base, top - 0.25, '#2a2522');
    s.box(c.f, l - 0.22, l, 0, 0.14, c.base, top, STONE);
    s.box(c.f, rr, rr + 0.22, 0, 0.14, c.base, top, STONE);
    s.box(c.f, l - 0.26, rr + 0.26, 0, 0.18, top - 0.3, top + 0.12, STONE, true);
    s.box(c.f, d.x - 0.12, d.x + 0.12, 0, 0.22, top - 0.32, top + 0.16, WHITE, true);
    for (let k = 0; k < 4; k++) s.box(c.f, l + 0.02, rr - 0.02, 0, 0.75 - k * 0.18, c.base + k * 0.2, c.base + (k + 1) * 0.2, STONE);
  } },
  { id: 'brick-door-arch', styles: ['school'], p: 0.4, street: true, group: 'door-frame', build: (c, s) => {
    // A deep brick surround stepped out twice round the door, a stone block over it.
    const d = doorSpan(c); if (!d) return;
    const l = d.x - d.hw, rr = d.x + d.hw, brick = shadeHex(c.wallHex, 0.78), top = d.z1 + 0.05;
    for (const [w, o, up] of [[0.16, 0.14, 0.18], [0.32, 0.07, 0.4]] as const) {
      s.box(c.f, l - w, l - w + 0.16, 0, o, d.z0, top + up, brick);
      s.box(c.f, rr + w - 0.16, rr + w, 0, o, d.z0, top + up, brick);
      s.box(c.f, l - w, rr + w, 0, o, top + up - 0.18, top + up, brick, true);
    }
    s.box(c.f, d.x - 0.22, d.x + 0.22, 0, 0.18, top + 0.2, top + 0.5, SANDSTONE, true);
  } },
  { id: 'iron-balconies', styles: CANAL, p: { c19: 0.6, canal: 0.12 }, wide: true, street: true, group: 'balcony', build: (c, s, r) => {
    // Oud-West / Pijp (Kinkerstraat 321): Juliet balconies stacked up one window axis, a stone
    // slab on two corbels with a black iron railing of bars between two rails. A grander front
    // has one on every window of the first floor.
    if (c.layout.storeys < 1) return;
    const per = openingsOf(c).upper.axes.length, all = r < 0.25, pick = per === 3 ? 1 : Math.floor(r * 7) % per;
    const spans = (k: number) => windowSpans(c, k).filter((_, i) => all || i % per === pick);
    const n = all ? 1 : Math.max(1, Math.min(3, c.layout.storeys, Math.floor(s.room() / Math.max(1, spans(0).length * 44))));
    for (let k = 0; k < n; k++) for (const w of spans(k)) {
      const a0 = w.x - w.hw - 0.12, a1 = w.x + w.hw + 0.12, z = w.z0 - 0.02;
      s.box(c.f, a0, a1, 0, 0.42, z - 0.1, z, STONE, true);
      for (const x of [a0 + 0.14, a1 - 0.14]) s.strip(c.f, x - 0.07, x + 0.07, 0.3, z - 0.32, z - 0.1, STONE);
      s.strip(c.f, a0, a1, 0.4, z + 0.86, z + 0.92, IRON);
      s.strip(c.f, a0, a1, 0.4, z + 0.1, z + 0.14, IRON);
      for (let i = 0; i < 4; i++) { const x = a0 + 0.1 + ((a1 - a0 - 0.2) * i) / 3; s.strip(c.f, x - 0.02, x + 0.02, 0.4, z, z + 0.9, IRON); }
    }
  } },
  // --- Windows ---------------------------------------------------------------------------------
  { id: 'window-sills', styles: ['canal', 'c19', 'school'], p: { canal: 0.6, c19: 0.5, school: 0.35 }, wide: true, build: (c, s, r) => {
    // A proud sill under every window, white on a canal house, stone on the School's brick.
    const hex = c.style === 'school' || r < 0.25 ? STONE : WHITE, n = storeysThatFit(c, s, 4, 6);
    for (let k = -1; k < n; k++) for (const w of windowSpans(c, k)) s.strip(c.f, w.x - w.hw - 0.07, w.x + w.hw + 0.07, 0.11, w.z0 - 0.08, w.z0, hex);
  } },
  { id: 'white-lintels', styles: CANAL, p: { canal: 0.4, c19: 0.12 }, wide: true, group: 'window-head', build: (c, s, r) => {
    // A white flat arch over each window, with a keystone on the grander houses.
    const o = openingsOf(c); if (o.ribbon) return;
    const key = r < 0.55, n = storeysThatFit(c, s, key ? 8 : 4, 5);
    for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
      if (o.upper.arch) { s.strip(c.f, w.x - 0.1, w.x + 0.1, 0.07, w.z1 + 0.02, w.z1 + 0.26, WHITE); continue; }
      s.strip(c.f, w.x - w.hw - 0.1, w.x + w.hw + 0.1, 0.05, w.z1 + 0.03, w.z1 + 0.2, WHITE);
      if (key) s.strip(c.f, w.x - 0.09, w.x + 0.09, 0.09, w.z1 + 0.01, w.z1 + 0.27, WHITE);
    }
  } },
  { id: 'stucco-hoods', styles: CANAL, p: { c19: 0.5, canal: 0.12 }, wide: true, group: 'window-head', build: (c, s, r) => {
    // 19th-century stucco hood mouldings: a cornice over each window with a sloped top.
    if (openingsOf(c).ribbon) return;
    const hex = r < 0.6 ? WHITE : CREAM, n = storeysThatFit(c, s, 6, 5);
    for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
      const a0 = w.x - w.hw - 0.14, a1 = w.x + w.hw + 0.14;
      s.strip(c.f, a0, a1, 0.14, w.z1 + 0.06, w.z1 + 0.2, hex);
      s.slope(c.f, a0, a1, 0, 0.14, w.z1 + 0.3, w.z1 + 0.2, hex);
    }
  } },
  { id: 'white-window-frames', styles: CANAL, p: { canal: 0.3, c19: 0.35 }, wide: true, build: (c, s) => {
    // Painted frames standing proud of the brick: jambs and head round every window.
    if (openingsOf(c).ribbon) return;
    const n = storeysThatFit(c, s, 12, 5);
    for (let k = -1; k < n; k++) for (const w of windowSpans(c, k)) {
      s.strip(c.f, w.x - w.hw - 0.07, w.x - w.hw + 0.01, 0.05, w.z0, w.z1 + 0.04, WHITE);
      s.strip(c.f, w.x + w.hw - 0.01, w.x + w.hw + 0.07, 0.05, w.z0, w.z1 + 0.04, WHITE);
      s.strip(c.f, w.x - w.hw - 0.07, w.x + w.hw + 0.07, 0.05, w.z1 - 0.02, w.z1 + 0.05, WHITE);
    }
  } },
  { id: 'school-window-bars', styles: ['school'], p: 0.4, wide: true, build: (c, s, r) => {
    // Small-paned windows: a transom and glazing bars in white or the School's orange.
    const hex = pickOf(SCHOOL_FRAMES, r), n = storeysThatFit(c, s, 12, 4);
    for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
      const zt = w.z1 - (w.z1 - w.z0) * 0.3;
      s.strip(c.f, w.x - w.hw, w.x + w.hw, 0.04, zt - 0.03, zt + 0.03, hex);
      for (const f of [-1 / 3, 1 / 3]) s.strip(c.f, w.x + f * w.hw * 2 - 0.025, w.x + f * w.hw * 2 + 0.025, 0.04, w.z0, w.z1, hex);
    }
  } },
  // --- Bands and courses ---------------------------------------------------------------------
  { id: 'floor-cornices', styles: CANAL, p: { canal: 0.3, c19: 0.2 }, wide: true, build: (c, s, r) => {
    // A white band course at every floor line.
    const hex = r < 0.7 ? WHITE : STONE;
    for (let k = 0; k < Math.min(6, c.layout.storeys); k++) { const z = storeyZ(c, k); s.strip(c.f, 0, c.f.len, 0.08, z - 0.03, z + 0.04, hex); }
  } },
  { id: 'string-courses', styles: CANAL, p: { c19: 0.45, canal: 0.1 }, wide: true, build: (c, s) => {
    // 19th century: a thin proud stone ledge running through the sills of each storey (the bay
    // drawing paints the flat band; this only adds its drip edge).
    const o = openingsOf(c);
    for (let k = 0; k < Math.min(6, c.layout.storeys); k++) { const z = storeyZ(c, k) + o.upper.sill * c.layout.storeyM; s.strip(c.f, 0, c.f.len, 0.06, z - 0.1, z - 0.04, CREAM); }
  } },
  { id: 'ribbon-bands', styles: ['school'], p: 0.35, wide: true, build: (c, s, r) => {
    // The School's horizontal emphasis: pale bands above and below every window row.
    const hex = r < 0.6 ? CREAM : WHITE;
    for (let k = 0; k < Math.min(5, c.layout.storeys); k++) {
      const w = windowSpans(c, k)[0]; if (!w) continue;
      s.strip(c.f, 0, c.f.len, 0.06, w.z0 - 0.14, w.z0 - 0.02, hex);
      s.strip(c.f, 0, c.f.len, 0.06, w.z1 + 0.04, w.z1 + 0.14, hex);
    }
  } },
  { id: 'floor-slab-edges', styles: ['postwar', 'modern', 'tower'], p: { postwar: 0.4, modern: 0.25, tower: 0.3 }, wide: true, build: (c, s) => {
    // Strokenbouw and later: the white concrete floor-slab edges read as bands across the front.
    for (let k = 0; k < Math.min(10, c.layout.storeys); k++) { const z = storeyZ(c, k); s.strip(c.f, 0, c.f.len, 0.1, z - 0.12, z + 0.1, WHITE); }
  } },
  // --- Piers, pilasters, fins ------------------------------------------------------------------
  { id: 'corner-pilasters', styles: CANAL, p: { canal: 0.22, c19: 0.3 }, wide: true, street: true, build: (c, s, r) => {
    // Pilasters at both ends of the front, with a capital; on a wide patrician house, on every pier.
    if (c.layout.storeys < 1) return;
    const hex = r < 0.6 ? WHITE : STONE, z0 = storeyZ(c, 0) - 0.15, z1 = c.top - 0.45;
    const xs = c.f.len >= 9 && r < 0.3 ? pierXs(c) : [0, c.f.len];
    for (const x of xs.slice(0, 6)) {
      const a0 = Math.max(0, Math.min(c.f.len - 0.42, x - 0.21)), a1 = a0 + 0.42;
      s.box(c.f, a0, a1, 0, 0.1, z0, z1, hex, true);
      s.box(c.f, a0 - 0.05, a1 + 0.05, 0, 0.16, z1, z1 + 0.18, hex, true);
    }
  } },
  { id: 'brick-fins', styles: ['school'], p: 0.35, wide: true, street: true, build: (c, s) => {
    // Vertical brick fins on the piers, running from the first floor to the roof.
    if (c.layout.storeys < 1) return;
    const brick = shadeHex(c.wallHex, 0.8), z0 = storeyZ(c, 0) - 0.3;
    for (const x of pierXs(c).slice(1, -1).slice(0, 8)) s.box(c.f, x - 0.11, x + 0.11, 0, 0.32, z0, c.top - 0.05, brick, true);
  } },
  // --- Projections --------------------------------------------------------------------------
  { id: 'oriel', styles: ['school', 'c19'], p: { school: 0.25, c19: 0.08 }, street: true, group: 'oriel', build: (c, s, r) => {
    // A rounded oriel over one or two storeys: three stepped boxes read as a curve, with glass
    // bands, a stone corbel under it and a cap.
    if (c.layout.storeys < 2 || c.f.len < 5.5) return;
    const x = c.f.len * (r < 0.5 ? 0.5 : 0.3), z0 = storeyZ(c, 0) + 0.1, z1 = storeyZ(c, Math.min(2, c.layout.storeys - 1)) - 0.1;
    const glassZ0 = z0 + 0.7, glassZ1 = z1 - 0.35, frame = c.style === 'school' ? pickOf(SCHOOL_FRAMES, r) : WHITE;
    s.box(c.f, x - 0.75, x + 0.75, 0, 0.6, z0 - 0.45, z0, SANDSTONE, true);
    const body = shadeHex(c.wallHex, 0.88);
    for (const [hw, o] of [[1.3, 0.35], [1.05, 0.65], [0.7, 0.85]] as const) s.box(c.f, x - hw, x + hw, 0, o, z0, z1, body, true);
    // Glass on each step's face, where the step stands out past the next one.
    for (const [a0, a1, o] of [[x - 1.22, x - 1.1, 0.35], [x - 0.95, x - 0.8, 0.65], [x - 0.62, x + 0.62, 0.85], [x + 0.8, x + 0.95, 0.65], [x + 1.1, x + 1.22, 0.35]] as const) s.strip(c.f, a0, a1, o + 0.01, glassZ0, glassZ1, '#4d5f6b');
    s.strip(c.f, x - 0.6, x + 0.6, 0.88, glassZ0 + (glassZ1 - glassZ0) * 0.68, glassZ0 + (glassZ1 - glassZ0) * 0.72, frame);
    s.box(c.f, x - 1.38, x + 1.38, 0, 0.95, z1, z1 + 0.14, c.style === 'school' ? '#4f7a6a' : STONE, true);
  } },
  // --- Ground floor -------------------------------------------------------------------------
  { id: 'rusticated-plinth', styles: CANAL, p: { c19: 0.4, canal: 0.12 }, wide: true, street: true, group: 'plinth', build: (c, s) => {
    // Banded stucco on the ground floor up to the window sills: courses with deep joints.
    if (!c.groundLevel || c.shopfront) return;
    const top = Math.min(c.base + 1.15, (windowSpans(c, -1)[0]?.z0 ?? c.base + 1.2) - 0.05);
    for (let z = c.base; z < top - 0.12; z += 0.27) for (const [a0, a1] of aroundDoor(c, 0, c.f.len)) s.strip(c.f, a0, a1, 0.05, z, Math.min(top, z + 0.22), CREAM);
    for (const [a0, a1] of aroundDoor(c, 0, c.f.len, 0.05)) s.strip(c.f, a0, a1, 0.08, top, top + 0.08, WHITE);
  } },
  { id: 'stone-plinth-band', styles: ['school'], p: 0.45, wide: true, group: 'plinth', build: (c, s, r) => {
    // A band of natural stone or glazed tile along the foot, under a pale course.
    if (!c.groundLevel) return;
    const hex = r < 0.5 ? BLUESTONE : pickOf(GLAZED_TILE, r * 2);
    for (const [a0, a1] of aroundDoor(c, 0, c.f.len, 0.02)) { s.strip(c.f, a0, a1, 0.05, c.base, c.base + 0.85, hex); s.strip(c.f, a0, a1, 0.08, c.base + 0.85, c.base + 0.95, CREAM); }
  } },
  // --- Canal-house specials -----------------------------------------------------------------
  { id: 'warehouse-shutters', styles: ['canal'], p: 0.1, wide: true, street: true, group: 'axis', build: (c, s, r) => {
    // A pakhuis front: the loading doors stacked up the middle axis, shutters in a white frame.
    if (c.layout.storeys < 2 || c.f.len < 4.5) return;
    const x = c.f.len / 2, hex = pickOf(LUIKEN, r), hw = Math.min(0.62, c.layout.bayWidthM * 0.13);
    for (let k = 0; k < Math.min(4, c.layout.storeys); k++) {
      const z0 = storeyZ(c, k) + 0.25, z1 = storeyZ(c, k) + c.layout.storeyM * 0.82;
      s.strip(c.f, x - hw - 0.08, x + hw + 0.08, 0.03, z0 - 0.08, z1 + 0.08, WHITE);
      s.box(c.f, x - hw, x + hw, 0, 0.08, z0, z1, hex);
    }
  } },
  { id: 'cornice-vases', styles: CANAL, p: { canal: 0.25, c19: 0.1 }, wide: true, street: true, atomic: true, rise: 1.0, build: (c, s) => {
    // Stone vases (acroteria) on the cornice: one at each end, one in the middle of a wide front.
    if (c.roofKind === 'gable' || c.roofKind === 'mansard') return;
    const xs = c.f.len >= 7 ? [0.3, c.f.len / 2, c.f.len - 0.3] : [0.3, c.f.len - 0.3];
    for (const x of xs) {
      s.box(c.f, x - 0.17, x + 0.17, 0.12, 0.46, c.top, c.top + 0.22, WHITE);
      s.box(c.f, x - 0.12, x + 0.12, 0.17, 0.41, c.top + 0.22, c.top + 0.62, STONE);
      s.box(c.f, x - 0.05, x + 0.05, 0.24, 0.34, c.top + 0.62, c.top + 0.78, STONE);
    }
  } },
  // --- Amsterdam School specials ------------------------------------------------------------
  { id: 'corner-sculpture', styles: ['school'], p: 0.2, street: true, build: (c, s, r) => {
    // A sculpted stone piece at a corner over the ground floor: blocks stepping out, then a head.
    if (c.layout.storeys < 1) return;
    const right = r < 0.5, z = storeyZ(c, 0) - 0.2, L = c.f.len;
    const at = (a0: number, a1: number) => (right ? [L - a1, L - a0] : [a0, a1]) as [number, number];
    for (const [a0, a1, o, z0, z1] of [[0, 0.7, 0.3, z - 0.35, z], [0, 0.55, 0.48, z, z + 0.45], [0, 0.4, 0.58, z + 0.45, z + 0.95], [0.08, 0.32, 0.5, z + 0.95, z + 1.2]] as const) {
      const [p, q] = at(a0, a1); s.box(c.f, p, q, 0, o, z0, z1, SANDSTONE, true);
    }
  } },
  { id: 'school-tower', styles: ['school'], p: 0.1, wide: true, street: true, rise: 2.3, build: (c, s, r) => {
    // A corner tower: one end of the block carried two metres above the roof, a tall slit window in it.
    if (c.f.len < 8 || c.layout.storeys < 2) return;
    const L = c.f.len, w = 1.6, a0 = r < 0.5 ? 0 : L - w, brick = shadeHex(c.wallHex, 0.86);
    s.box(c.f, a0, a0 + w, 0, 0.4, storeyZ(c, 0), c.top + 2.0, brick, true, true);
    s.box(c.f, a0 - 0.05, a0 + w + 0.05, -0.05, 0.48, c.top + 2.0, c.top + 2.15, CREAM, true, true);
    s.strip(c.f, a0 + w / 2 - 0.2, a0 + w / 2 + 0.2, 0.42, storeyZ(c, 1), c.top + 1.6, '#4d5f6b');
  } },
];

export const ornamentBoxTris = BOX_TRIS;
