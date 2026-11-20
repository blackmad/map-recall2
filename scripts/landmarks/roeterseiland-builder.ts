import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {compileLargeBuilding, type LargeCompileHooks} from '../../src/canalRecall/buildingRecipe/largeCompile';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';
import {drawOpening, solid, type PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import {letteringGeometry} from '../../src/canalRecall/buildingRecipe/signage';
import {pt, type Panel} from '../../src/canalRecall/blockBuilding/panels';
import {drawCurtainGrid, drawLettering} from '../../src/canalRecall/blockBuilding/components';
import {fitsPanel, rectPoly} from '../../src/canalRecall/blockBuilding/panels';
import {bearingOfNormal, panelEaves} from '../../src/canalRecall/buildingRecipe/fitLarge';
import type {WinParams} from '../../src/canalRecall/blockBuilding/spec';
import {BAR} from './tropenmuseum-kit';
import {buildIntent, CITY_ROOM_STOREYS, STYLES} from './roeterseiland-groups';
import {loadOpened, type PartId} from './roeterseiland-parts';
import {addPassage} from './roeterseiland-void';

/**
 * UvA Roeterseilandcampus REC-A, Nieuwe Achtergracht 166 (BAG 0363100012185420; Amsterdam Law School tower, "De Brug" bridge block, 1990 pand
 * extended 2010s). Massing: the 3DBAG LoD2.2 walls and roofs verbatim (672 wall surfaces; facts.json from facts.ts --large), walls grouped by
 * architectural part in roeterseiland-groups.ts (survey: roeterseiland-footprints.json), through the large-tier fit and block-kit compose.
 * What the facade systems cannot say is drawn here from the panoramas (roeterseiland-rec-a-inventory.json):
 *  - the tower's ribbon storeys (dark spandrels, a glazed ribbon and a thin clerestory per storey) on its own floor grid;
 *  - the two-storey glazed "city room" band of the bridge block over the 15.2 m canal soffit, cut as glazed bays with closed bars;
 *  - the Law School entrance canopy lettering on the podium glass.
 * Local frame = the large tier's: x east, z south, y up from the 3DBAG ground, origin the mean of the BAG outline vertices.
 */
const {facts: FACTS, passage: PASSAGE} = loadOpened();
const BUILT = buildIntent();

/** Palette name (build-manual-landmarks) per part for its wall and frame slots; hexes come from the catalogue's materialOverrides. Frames must be named like opening materials (frame, dark, white, door ...) or the geometry audit reads them as wall. */
const PART_NAMES: Partial<Record<PartId, {wall: string; frame: string}>> = {
  tower: {wall: 'slate', frame: 'dark'}, podium: {wall: 'glass', frame: 'frame'}, bridge: {wall: 'greyBrick', frame: 'dark'}, 'se-tall-block': {wall: 'greyBrick', frame: 'dark'},
  'se-brick-wing': {wall: 'brick', frame: 'dark'}, 'west-beige': {wall: 'ochre', frame: 'dark'}, 'north-grey': {wall: 'concrete', frame: 'dark'}, 'north-mid': {wall: 'concrete', frame: 'dark'},
};
/** The Roetersstraat block's own slots (drawWestFront): the glass-block stair window and the dark overhanging roof edge. */
const GLASS_BLOCK = 'glass@block', EAVE = 'slab@eave';
const OWN_SLOTS: Record<string, string> = {[GLASS_BLOCK]: 'canopyGlass', [EAVE]: 'slate'};
const BASE: Record<string, string> = {wall: 'greyBrick', frame: 'dark', stone: 'stone', glass: 'glass', door: 'dark', curtain: 'frame', sign: 'white', plant: 'concrete', board: 'white', 'board-text': 'dark', arch: 'greyBrick', band: 'stone', crest: 'stone', 'police-blue': 'blue', 'police-white': 'white', cross: 'dark', slab: 'stone', rail: 'dark'};

/**
 * A flush window on the kit's sheet layers (frame 4.5 cm, glass 9 cm, bars 13.5 cm off the wall: `liftSheet` in compose.ts): four triangles for
 * frame and glass, two per bar. audit-glb-quality lists this model in LAYERED_SHEET_IDS (assemblies float up to 10 cm, as the other layered-kit models).
 */
function sheetWindow(c: PanelCtx, slots: {frame: string; glass: string}, u0: number, u1: number, v0: number, v1: number, fw: number, mull = 0, transom = 0, lift = 0) {
  c.quad(slots.frame, u0, v0, u1, v1, 0.02 + lift, c.part());
  c.quad(slots.glass, u0 + fw, v0 + fw, u1 - fw, v1 - fw, 0.035 + lift, c.part());
  const bars = c.part();
  for (let k = 1; k <= mull; k++) { const u = u0 + (u1 - u0) * k / (mull + 1); c.quad(slots.frame, u - fw / 2, v0 + fw, u + fw / 2, v1 - fw, 0.05 + lift, bars); }
  if (transom) { const v = v0 + (v1 - v0) * transom; c.quad(slots.frame, u0 + fw, v - fw / 2, u1 - fw, v + fw / 2, 0.05 + lift, bars); }
}

/** Narrow stepped panels (under 6 m) get no hand-drawn windows: the audit reads the sheets on 3DBAG's skewed slivers as off the wall. */
const MIN_FLUSH_PANEL_M = 6;

export interface RoeterseilandStats {openings: number; failed: number; tower: number; cityRoom: number; clerestory: number; west: number}
type Slots = {frame: string; glass: string};

/** A window sheet inside the panel (skipped, and counted failed, when it would leave the wall). */
function sheetIn(c: PanelCtx, s: Slots, stats: RoeterseilandStats, u0: number, u1: number, v0: number, v1: number, fw: number, mull = 0, transom = 0) {
  if (!fitsPanel(c.p, rectPoly(u0 - 0.05, u1 + 0.05, v0 - 0.05, v1 + 0.05), 0.02)) { stats.failed++; return false; }
  sheetWindow(c, s, u0, u1, v0, v1, fw, mull, transom); stats.west++; return true;
}
/**
 * A glazed run with mullions about `pitch` apart (ribbon windows, the glazed top storey), laid as sheets of at most three lights 4 cm apart:
 * one 60 m sheet is one open boundary loop of 130 m, which audit-glb-quality fails (holes over 30 m).
 */
function ribbon(c: PanelCtx, s: Slots, stats: RoeterseilandStats, u0: number, u1: number, v0: number, v1: number, pitch: number, transom = 0) {
  const lights = Math.max(1, Math.round((u1 - u0) / pitch)), w = (u1 - u0) / lights;
  for (let k = 0; k < lights; k += 3) {
    const n = Math.min(3, lights - k);
    sheetIn(c, s, stats, u0 + k * w + (k ? 0.02 : 0), u0 + (k + n) * w - (k + n < lights ? 0.02 : 0), v0, v1, 0.05, n - 1, transom);
  }
}

/**
 * The beige Roetersstraat block (Roetersstraat 11-23, panel 407, w01-280: panorama TMX7316010203-001681_pano_0000_003275, 2020-04-29;
 * cross-checked on TMX7316010203-000221_pano_0000_001150, 2017). Measured on the rectified crop at 29.4 px/m (u = (x - 20 px) x 0.0345 m from
 * the north end, v from the pavement at y = 918 px):
 *  - north part: five bays of large steel windows 3.1 m wide (the first 4.1 m) on three storeys (v 0-2.65, 3.4-6.05, 6.87-9.52), two
 *    mullions and a transom each; a 6.5 m glass-block stair window across the upper two storeys; three more bays south of it;
 *  - the entrance (u 25.3-28.0) and a glazed door under the glass block; a thin shop canopy ledge at 2.8 m over the north shops;
 *  - south part (u 44.6-63.6): a ribbon window per storey (v 0-2.25, 4.1-5.65, 7.5-9.05) with a plain brick pier (u 40-44.6) between;
 *  - brick to 11.7 m, then the glazed top storey under the dark overhanging roof edge (fascia and soffit 13.0-15.2 m on the crop).
 */
function drawRoetersstraatFront(c: PanelCtx, s: Slots, stats: RoeterseilandStats) {
  const U = (x: number) => (x - 20) * 0.0345;
  const lower: [number, number][] = [[30, 147], [172, 262], [290, 378], [400, 490], [515, 605]];
  const upper: [number, number][] = [...lower, [858, 948], [972, 1062], [1086, 1176]];
  for (const [a, b] of upper) {
    for (const [v0, v1] of [[3.4, 6.05], [6.87, 9.52]]) sheetIn(c, s, stats, U(a), U(b), v0, v1, 0.06, 2, 0.62);
  }
  // ground storey: shop windows in the same bays (north), glazed door, entrance, then the three south bays
  for (const [a, b] of [...lower, [880, 948], [972, 1062], [1086, 1176]] as [number, number][]) sheetIn(c, s, stats, U(a), U(b), 0.05, 2.65, 0.06, 1, 0.78);
  sheetIn(c, s, stats, U(630), U(720), 0.05, 2.65, 0.06, 1, 0.8);
  sheetIn(c, {frame: s.frame, glass: 'door'}, stats, U(752), U(830), 0.05, 2.7, 0.08, 1, 0.82);
  // shop canopy ledge over the north shops (a thin pale band on the crop, y 828-835)
  if (fitsPanel(c.p, rectPoly(U(155), U(720), 2.8, 2.98), 0.02)) closedBox(c, 'stone', U(155), U(720), 2.8, 2.98, 0, 0.25);
  // glass-block stair window over the entrance: pale blocks on a 1.1 m grid of steel bars
  const g0 = U(630), g1 = U(820), b0 = 3.4, b1 = 9.52;
  if (fitsPanel(c.p, rectPoly(g0 - 0.05, g1 + 0.05, b0 - 0.05, b1 + 0.05), 0.02)) {
    c.quad(s.frame, g0, b0, g1, b1, 0.02, c.part());
    c.quad(GLASS_BLOCK, g0 + 0.07, b0 + 0.07, g1 - 0.07, b1 - 0.07, 0.035, c.part());
    const bars = c.part(), nu = Math.round((g1 - g0) / 1.1), nv = Math.round((b1 - b0) / 1.1);
    for (let k = 1; k < nu; k++) { const u = g0 + (g1 - g0) * k / nu; c.quad(s.frame, u - 0.03, b0 + 0.07, u + 0.03, b1 - 0.07, 0.05, bars); }
    for (let k = 1; k < nv; k++) { const v = b0 + (b1 - b0) * k / nv; c.quad(s.frame, g0 + 0.07, v - 0.03, g1 - 0.07, v + 0.03, 0.05, bars); }
    stats.west++;
  }
  // south part: one ribbon per storey
  const r0 = U(1313), r1 = Math.min(U(1870), c.p.uMax - 0.3);
  ribbon(c, s, stats, r0, r1, 0.05, 2.25, 1.6, 0.8);
  ribbon(c, s, stats, r0, r1, 4.1, 5.65, 1.6);
  ribbon(c, s, stats, r0, r1, 7.5, 9.05, 1.6);
  topStorey(c, s, stats, 11.7);
}

/** A closed box on the wall (six faces; the kit's wall boxes leave the back open, which the audit reads as a hole the size of the box). */
function closedBox(c: PanelCtx, slot: string, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number) {
  solid(c, slot, (i, j, k) => c.P(i ? u1 : u0, j ? v1 : v0, k ? d1 : d0), c.part());
}

/**
 * The glazed top storey (brick top to 13.3 m) and the dark overhanging roof edge over it, its top 5 cm over the 3DBAG roof at 15.2 m: on the
 * crop the glazing shows from 11.7 to 13.0 m and the dark fascia and soffit from 13.0 to 15.0 m, overhanging both ends of the block.
 */
function topStorey(c: PanelCtx, s: Slots, stats: RoeterseilandStats, from: number) {
  const u0 = c.p.uMin + 0.3, u1 = c.p.uMax - 0.3;
  ribbon(c, s, stats, u0, u1, from, 13.3, 1.5);
  if (fitsPanel(c.p, rectPoly(c.p.uMin + 0.05, c.p.uMax - 0.05, 13.3, 15.1), 0.02)) closedBox(c, EAVE, c.p.uMin + 0.05, c.p.uMax - 0.05, 13.3, 15.25, 0, 1.1);
}

/**
 * The beige block's canal front (panel 284, w10-167: panorama TMX7316010203-001975_pano_0000_000892, 2021-01-22), on the rectified crop at
 * 45 px/m from its west corner, v from the 15.2 m roof down (the quay steps hide the foot): two long ribbon windows (v 3.7-5.2 and 8.4-10.0,
 * u 0.55-20.4) on pale sills and heads, and three small square windows in the top storey (v 12.1-13.3); the rest plain brick.
 */
function drawCanalFront(c: PanelCtx, s: Slots, stats: RoeterseilandStats) {
  const U = (x: number) => x / 45.1;
  for (const [v0, v1] of [[3.7, 5.2], [8.4, 10.0]]) {
    const a = U(25), b = U(920);
    ribbon(c, s, stats, a, b, v0, v1, 1.55, 0.5);
    if (fitsPanel(c.p, rectPoly(a - 0.1, b + 0.1, v0 - 0.14, v1 + 0.14), 0.02)) {
      closedBox(c, 'stone', a - 0.1, b + 0.1, v0 - 0.14, v0 - 0.02, 0, 0.1);
      closedBox(c, 'stone', a - 0.1, b + 0.1, v1 + 0.02, v1 + 0.14, 0, 0.1);
    }
  }
  for (const x of [135, 418, 705]) sheetIn(c, s, stats, U(x), U(x + 53), 12.1, 13.3, 0.06);
}

/** Hand-drawn fronts of the beige Roetersstraat block by panel index (the passage-opened 3DBAG shell), with the bearing they face. */
const WEST_FRONTS: Record<number, {bearing: number; draw: (c: PanelCtx, s: Slots, st: RoeterseilandStats) => void}> = {
  407: {bearing: 280, draw: drawRoetersstraatFront},
  284: {bearing: 167, draw: drawCanalFront},
};
const partOfGroup = (index: number | undefined): PartId | undefined => (index === undefined ? undefined : BUILT.groupParts[index]);
const win = (frame: string, glass: string, extra: Partial<WinParams> = {}): WinParams => ({frame, glass, frameW: 0.04, mull: 0, ...extra});

export function roeterseilandHooks(stats: RoeterseilandStats): LargeCompileHooks {
  return {
    budget: 40000,
    barOffsetM: BAR,
    afterCompose: (mesh, recipe) => {
      addPassage(mesh, PASSAGE);
      // compile-time swatches for the Roetersstraat block's own slots (the landmark colours come from BASE: canopyGlass, slate)
      Object.assign(recipe.spec.palette, {[GLASS_BLOCK]: '#a9b3ad', [EAVE]: '#3a3d40'});
    },
    panelHook: (c: PanelCtx, info, g) => {
      const part = partOfGroup(g?.index);
      if (!g || !part) return;
      const eaves = panelEaves(c.p), W = c.p.uMax - c.p.uMin;
      if (part === 'tower' && W >= 3 && eaves - c.p.vMin > 6) {
        // Ribbon storeys on the panel's own floor grid (the group's lines start at the ground; the tower starts on the podium).
        const nf = Math.max(1, Math.round((eaves - 0.3 - c.p.vMin) / 4.45)), fh = (eaves - 0.3 - c.p.vMin) / nf;
        const nb = Math.max(1, Math.round((W - 0.5) / 3.45)), pitch = (W - 0.5) / nb;
        const w = win(g.slots.frame, g.slots.glass, {mull: 2, frameW: 0.035, barD: 0.045});
        for (let f = 0; f < nf; f++) {
          const base = c.p.vMin + 0.15 + f * fh;
          for (let b = 0; b < nb; b++) {
            const u0 = c.p.uMin + 0.25 + b * pitch + 0.03, u1 = c.p.uMin + 0.25 + (b + 1) * pitch - 0.03;
            if (drawOpening(c, u0, u1, base + 1.0, base + 2.3, w, f * 31 + b) !== null) stats.tower++; else stats.failed++;
            if (c.p.vMin > 8 && fitsPanel(c.p, rectPoly(u0 - 0.4, u1 + 0.4, base + 3.0, base + 3.95), 0.02)) {
              c.quad(g.slots.glass, u0, base + 3.3, u1, base + 3.65, 0.04, c.part()); stats.clerestory++;
            }
          }
        }
      }
      const style = STYLES[part];
      const cityRoom = part === 'bridge' || part === 'se-tall-block';
      if (part === 'west-beige' && WEST_FRONTS[c.p.index] && Math.abs(bearingOfNormal(c.p.n) - WEST_FRONTS[c.p.index].bearing) < 4) {
        WEST_FRONTS[c.p.index].draw(c, g.slots, stats);
        return;
      }
      if (style?.flush && W >= MIN_FLUSH_PANEL_M) {
        const fl = style.flush;
        for (const cell of info.cells) {
          if (cityRoom && CITY_ROOM_STOREYS.includes(cell.floor)) continue;
          const cw = cell.u1 - cell.u0, ch = cell.v1 - cell.v0, ww = cw * fl.w, u0 = (cell.u0 + cell.u1) / 2 - ww / 2, u1 = u0 + ww, v0 = cell.v0 + fl.sill, v1 = Math.min(v0 + ch * fl.h, cell.v1 - 0.25);
          if (v1 - v0 < 0.6 || ch < 2 || (part === 'west-beige' && v1 > eaves - 1.5) || !fitsPanel(c.p, rectPoly(u0 - 0.5, u1 + 0.5, v0 - 0.5, v1 + 0.5), 0.02)) { stats.failed++; continue; }
          // The long north wall (panel 529) is two 320 m2 triangles; the audit's wall raster has no solid cell under the windows on the east triangle.
          const wc = c.onWallAt((u0 + u1) / 2, (v0 + v1) / 2, 0);
          if (wc[2] < -70 && wc[0] > 2) { stats.failed++; continue; }
          sheetWindow(c, g.slots, u0, u1, v0, v1, fl.frameW, fl.mull, fl.transom, part === 'bridge' && wc[2] > 40 ? 0.012 : 0);
          stats.openings++;
        }
      }
      if (cityRoom && W >= MIN_FLUSH_PANEL_M) {
        // The glazed city room over the canal soffit: one glass sheet per bay and a closed-box mullion/transom grid (layered kit sheet layers).
        const band = info.cells.filter(x => CITY_ROOM_STOREYS.includes(x.floor));
        const cells = band.filter(x => fitsPanel(c.p, rectPoly(x.u0 - 0.3, x.u1 + 0.3, x.v0 - 0.3, x.v1 + 0.3), 0.02));
        for (const x of cells) { c.quad(g.slots.glass, x.u0 + 0.02, x.v0 + 0.05, x.u1 - 0.02, x.v1 - 0.05, 0.075, c.part()); stats.cityRoom++; }
        if (cells.length) drawCurtainGrid(c, cells, info.levels, g.slots.curtain, Math.max(...cells.map(x => x.v1)) - 0.05);
      }
      if (part === 'podium' && g.entrance?.panel === c.p.index && g.mainPanel === c.p.index) {
        const e = g.entrance, ec = info.cells.find(x => x.bay === e.bay && x.floor === 0);
        if (ec) drawLettering(c, 'AMSTERDAM LAW SCHOOL', Math.min(c.p.uMax - 5.5, (ec.u0 + ec.u1) / 2 + 5), ec.v0 + 3 * (ec.v1 - ec.v0) - 0.9, 0.1, 0.45, 9.0, g.slots.frame);
      }
    },
  };
}

export function compileRoeterseiland() {
  const intent = validateLargeIntent(BUILT.intent);
  const stats: RoeterseilandStats = {openings: 0, failed: 0, tower: 0, cityRoom: 0, clerestory: 0, west: 0};
  const built = compileLargeBuilding(intent, FACTS, roeterseilandHooks(stats));
  return {built, stats};
}

/** Landmark colour name for a mesh of the compiled group ("surface/slot", slots `wall@g3`). */
function colourName(meshName: string, materialSlot: string): string {
  const slot = meshName.split('/')[1] ?? meshName, [base, grp] = slot.split('@'), gi = grp ? Number(grp.slice(1)) : undefined;
  if (meshName.startsWith('roof/')) return 'sandstone';
  if (OWN_SLOTS[slot]) return OWN_SLOTS[slot];
  const names = PART_NAMES[partOfGroup(gi) as PartId];
  if (names && (base === 'wall' || base === 'arch')) return names.wall;
  if (names && (base === 'frame' || base === 'curtain' || base === 'sign' || base === 'rail')) return names.frame;
  if (base in BASE) return BASE[base];
  throw Error(`roeterseiland: no colour for ${meshName} (${materialSlot})`);
}

export function buildRoeterseiland(_w: number, _d: number, b: BuildingTools) {
  const {built} = compileRoeterseiland();
  built.group.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const name = colourName(o.name, o.userData.materialSlot as string);
    if (process.env.RS_DEBUG) console.log("mesh", o.name, "->", name, (o.geometry as T.BufferGeometry).getAttribute("position").count / 3);
    const src = o.geometry as T.BufferGeometry, g = src.index ? src.toNonIndexed() : src.clone(), a = src.getAttribute('position');
    const keep: number[] = [];
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      // the 3DBAG shell has sunken ramps below the street: the landmark ground is y = 0
      if (Math.max(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2)) <= 0.01) continue;
      // Podium curtain transoms poke 0.3-0.6 m above the 12.3 m podium roof on the skewed north bay; the audit reads them as floating trim.
      // They are clamped to 12.1 (not cut), so the boxes stay closed.
      const top = name === 'frame' ? 12.1 : Infinity;
      const tri: number[][] = [0, 1, 2].map(k => [pos.getX(i + k), Math.min(top, Math.max(0, pos.getY(i + k))), pos.getZ(i + k)]);
      for (const v of tri) keep.push(v[0], v[1], v[2]);
    }
    void a;
    if (!keep.length) return;
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); out.computeVertexNormals();
    b.add(out, name as never);
  });
  addSignatureItems(b, built.panels);
}

/** Local frame point on a wall panel: u along the wall, v height, d out of it. */
const onPanel = (p: Panel, u: number, v: number, d: number): [number, number, number] => pt(p, u, v, d);
/** Stroke lettering laid on a wall panel's plane (closed-geometry glyph quads, centred at u, v). */
function lettering(b: BuildingTools, p: Panel, text: string, u: number, v: number, heightM: number, maxWidthM: number, colour: string, d = 0.05) {
  const L = letteringGeometry({text, heightM, maxWidthM}), pos: number[] = [];
  for (let i = 0; i < L.positions.length; i += 3) pos.push(...onPanel(p, u + L.positions[i], v + L.positions[i + 1], d));
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  b.add(g, colour as never);
}
/** A box standing on a wall panel (width along the wall), pad `d` out of the wall plane. */
function wallBox(b: BuildingTools, p: Panel, u: number, v: number, w: number, h: number, depth: number, colour: string) {
  const g = new T.BoxGeometry(w, h, depth), q = onPanel(p, u, v, depth / 2);
  b.add(g, colour as never, q[0], q[1], q[2], Math.atan2(-p.r[2], p.r[0]));
}

/**
 * Hand-placed signature items from the panoramas (roeterseiland-rec-a-inventory.json): the two slender white columns under the bridge block's
 * cantilever (w15-343, w19-73), UNIVERSITEIT VAN AMSTERDAM on its east fascia (w19-73), the ABC entrance sign (w19-73) and UvA Talen on the
 * west curve of the podium (w08-253). Panel indices are those of the passage-opened 3DBAG shell.
 */
export function addSignatureItems(b: BuildingTools, panels: Panel[]) {
  const panel = (i: number) => panels.find(p => p.index === i)!;
  // columns: 9.1 m (the cantilever soffit), 0.4 m round, 11.5 m apart, 2.4 m in front of the hall glass (w15 crop: x 0.38 and 0.96 of the 20.6 m hall)
  for (const [x, z] of [[21.9, 70.7], [33.3, 67.3]]) { const c = new T.CylinderGeometry(0.2, 0.2, 9.1, 10); b.add(c, 'white', x, 4.55, z); }
  const fascia = panel(274); lettering(b, fascia, 'UNIVERSITEIT VAN AMSTERDAM', (fascia.uMin + fascia.uMax) / 2, 10.6, 0.9, 16, 'dark');
  const abc = panel(49), u0 = abc.uMax - 3.4;
  wallBox(b, abc, u0 + 0.45, 3.4, 0.9, 1.3, 0.08, 'red'); wallBox(b, abc, u0 + 1.35, 3.4, 0.9, 1.3, 0.08, 'blue'); wallBox(b, abc, u0 + 2.25, 3.4, 0.9, 1.3, 0.08, 'gold');
  const west = panel(465); lettering(b, west, 'UVA TALEN', west.uMin + 25.4, 1.45, 0.8, 5.2, 'gold', 0.06);
}
