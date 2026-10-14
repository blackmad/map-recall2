/**
 * `kind: large` compile: fitLarge recipe → block-kit compose (windows cut into the exact 3DBAG walls, recessed
 * `LARGE_RECESS_M`) → wall-group components (entrances, canopies, garage doors, cornices, fascias, lettering, police
 * band and lamp) → roof plant → a Three group whose meshes carry the recipe material slot (`userData.materialSlot`)
 * and surface, so the GLB exporter writes `materialSlot` + `tint` on every material.
 */
import * as T from 'three';
import {compose, intervals, SHEET_PITCH, type Cell, type PanelCtx} from '../blockBuilding/compose.ts';
import {runGates, type GateReport} from '../blockBuilding/gates.ts';
import {cellSpan, drawBand, drawBlueLamp, drawCanopy, drawCurtainGrid, drawEntrance, drawGarageDoor, drawLantern, drawLettering, drawNameBand, drawPilasters, drawPoliceStripe, drawPortal, drawRoofBoxes, drawScreen, drawStAndrewsCross, drawStoneStorey, LETTER_STANDOFF, lowestHoleAbove, type PortalResult} from '../blockBuilding/components.ts';
import type {MeshBuilder} from '../blockBuilding/mesh.ts';
import {fitsPanel, rectPoly, type Panel} from '../blockBuilding/panels.ts';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';
import {ROOF_COLOURS} from './fit.ts';
import {fitLarge, panelEaves, type LargeBuildingRecipe, type LargeFitReport, type LargeGroupFit} from './fitLarge.ts';

export interface LargeComponentCounts { curtainGrids?: number; plinths?: number; screens?: number; portals?: number; nameBands?: number; stoneStoreys?: number; pilasters?: number; lanterns?: number; nameBoards: number; entrances: number; halls: number; canopies: number; garageDoors: number; letters: number; cornices: number; fascias: number; policeStripes: number; lamps: number; roofPlant: number }
export interface CompiledLargeBuilding {
  kind: 'large'; group: T.Group; recipe: LargeBuildingRecipe; fit: LargeFitReport; anchorRD: [number, number]; facts: BuildingFacts;
  stats: Record<string, number>; components: LargeComponentCounts; blockGates: GateReport;
  /** block-kit wall panels (index = `recipe.panelGroup` index) */
  panels: Panel[];
}

/** Block-kit slot → recipe material slot (recipeLook RECIPE_SLOTS) and surface. Roofs are split by slope separately. */
export function largeMaterialSlot(slot: string, recipe: Pick<LargeBuildingRecipe, 'wallMaterial' | 'slotMaterial'>): {materialSlot: string; surface: string} {
  const base = slot.split('@')[0];
  switch (base) {
    case 'wall': case 'arch': return {materialSlot: recipe.slotMaterial?.[slot] ?? recipe.wallMaterial, surface: 'wall'};
    case 'curtain': return {materialSlot: 'frame', surface: 'wall'};
    case 'glass': return {materialSlot: 'glass', surface: 'glass'};
    case 'frame': case 'rail': return {materialSlot: 'frame', surface: 'joinery'};
    case 'door': return {materialSlot: 'door', surface: 'door'};
    case 'stone': case 'slab': case 'band': case 'crest': return {materialSlot: 'stone', surface: 'stone'};
    case 'police-white': case 'board': return {materialSlot: 'stucco', surface: 'sign'};
    case 'board-text': return {materialSlot: 'accent', surface: 'sign'};
    case 'cross': return {materialSlot: 'accent', surface: 'sign'};
    case 'police-blue': case 'sign': return {materialSlot: 'accent', surface: 'sign'};
    case 'plant': return {materialSlot: 'stone', surface: 'plant'};
    default: throw Error(`large tier: block-kit slot "${slot}" has no recipe material slot`);
  }
}

/** Cornice projection (m) over the wall top: a stone band 0.43 m tall. */
const CORNICE_OUT = 0.28;

function decorate(c: PanelCtx, info: {levels: number[]; cells: Cell[]}, g: LargeGroupFit | undefined, counts: LargeComponentCounts) {
  if (!g || !info.levels.length) return;
  const p = c.p, levels = info.levels, groundTop = levels[1] ?? p.vMax, s = g.slots;
  const skip: [number, number][] = [];
  let entrance: ReturnType<typeof drawEntrance> = null, canopy: ReturnType<typeof drawCanopy> = null, portal: PortalResult | null = null;
  if (g.entrance?.panel === p.index) {
    const e = g.entrance, cells = info.cells.filter(x => x.bay === e.bay && x.floor < e.storeys);
    if (cells.length) {
      entrance = drawEntrance(c, cellSpan(cells), levels, {frame: s.frame, glass: s.glass, door: s.door, stone: s.stone}, e.storeys > 1, g.deepBars ? 0.035 : undefined);
      if (entrance) {
        counts.entrances++; if (e.storeys > 1) counts.halls++;
        skip.push([entrance.u0 - 0.3, entrance.u1 + 0.3]);
        if (e.portal) { portal = drawPortal(c, entrance, s.stone, `crest@g${g.index}`); if (portal) { counts.portals = (counts.portals ?? 0) + 1; skip.push([portal.u0 - 0.1, portal.u1 + 0.1]); } }
        if (e.canopy) { canopy = drawCanopy(c, entrance.u0, entrance.u1, entrance.top + 0.2, s.stone, g.signage?.mount === 'canopy' ? 0.5 : 0.3); if (canopy) counts.canopies++; }
      }
    }
  }
  if (g.garage?.panel === p.index) for (const cell of info.cells) if (cell.floor === 0 && g.garage.bays.includes(cell.bay) && drawGarageDoor(c, cell, {door: s.door, frame: s.frame})) { counts.garageDoors++; skip.push([cell.u0, cell.u1]); }
  // Stone-faced storeys and banded end pilasters, round the openings already cut; under the cornice.
  const eaves = panelEaves(p), underCornice = eaves - (g.cornice ? 0.45 : 0.05);
  for (const st of g.stoneStoreys ?? []) {
    if (st >= levels.length - 1 && st > 0) continue;
    const v0 = Math.max(p.vMin, levels[st]), v1 = Math.min(underCornice, levels[st + 1] ?? underCornice);
    if (v1 - v0 > 0.5 && drawStoneStorey(c, v0, v1, s.stone)) counts.stoneStoreys = (counts.stoneStoreys ?? 0) + 1;
  }
  if (g.pilasters && underCornice - Math.max(0, p.vMin) > 3) counts.pilasters = (counts.pilasters ?? 0) + drawPilasters(c, Math.max(0, p.vMin), underCornice, s.stone, g.pilasters);
  if (g.signage?.mount === 'cornice' && g.mainPanel === p.index) {
    const n = drawNameBand(c, g.signage.text, underCornice, s.stone, s.sign, g.cornice && eaves - p.vMin > 3 ? {v0: eaves - 0.45, v1: eaves - 0.02, out: CORNICE_OUT} : undefined);
    if (n) { counts.letters += n; counts.nameBands = (counts.nameBands ?? 0) + 1; }
  }
  // Screen lattice after the openings (rails skip them), before the cornice.
  if (g.screen && info.cells.length) { const top = panelEaves(p) - 0.1; if (top - p.vMin > 3 && drawScreen(c, info.cells, levels, s.stone, top)) counts.screens = (counts.screens ?? 0) + 1; }
  // Layered curtain wall: the mullion/transom grid on the glass skin, round the entrance; over a mesh plinth the grid
  // starts above the ground storey and a closed dark panel covers it.
  if (c.layered && g.system === 'curtain-wall' && info.cells.length) {
    const plinth = g.ground === 'mesh-plinth', cells = plinth ? info.cells.filter(x => x.floor > 0) : info.cells, top = panelEaves(p) - 0.05;
    if (plinth && drawPlinthPanel(c, Math.max(0, p.vMin), groundTop, s.door)) counts.plinths = (counts.plinths ?? 0) + 1;
    if (cells.length && top - p.vMin > 2 && drawCurtainGrid(c, cells, levels, s.curtain, top)) counts.curtainGrids = (counts.curtainGrids ?? 0) + 1;
  }
  if (g.cornice) { const top = panelEaves(p); if (top - p.vMin > 3 && drawBand(c, s.stone, top - 0.45, top - 0.02, CORNICE_OUT)) counts.cornices++; }
  if (g.ground === 'plinth-shopfronts' && groundTop - p.vMin > 3 && drawBand(c, s.stone, groundTop - 0.62, groundTop - 0.12, 0.1, entrance && g.entrance!.storeys > 1 ? skip : [])) {
    counts.fascias++;
    // A group without an entrance letters its shop fascia, centred on the widest panel.
    if (g.signage && g.signage.mount !== 'cornice' && !g.entrance && g.mainPanel === p.index) counts.letters += drawLettering(c, g.signage.text, (p.uMin + p.uMax) / 2, groundTop - 0.37, 0.115, 0.34, Math.min((p.uMax - p.uMin) * 0.6, 6), s.sign);
  }
  if (entrance && g.signage) {
    const {text, mount} = g.signage, uc = (entrance.u0 + entrance.u1) / 2, w = entrance.u1 - entrance.u0;
    if (mount === 'glazing') counts.letters += drawLettering(c, text, uc, (Math.max(entrance.doorTop, levels[1] ?? entrance.doorTop) + entrance.top) / 2, entrance.glassDepth + 0.015 + (c.layered ? SHEET_PITCH : 0), 0.7, w * 0.85, s.sign, undefined, entrance.glassDepth);
    else if (mount === 'canopy' && canopy) counts.letters += drawLettering(c, text, uc, (canopy.v0 + canopy.v1) / 2, canopy.d + 0.012, (canopy.v1 - canopy.v0) * 0.62, w + 1.0, s.sign);
    else if (mount === 'wall') counts.letters += drawLettering(c, text, uc, groundTop + 0.45, 0.012, 0.6, Math.max(w * 1.6, 3), s.sign);
    else if (mount === 'cornice') { /* name band: drawn on the widest panel below */ }
    else if (portal) { const f = portal.frieze; counts.letters += drawLettering(c, text, uc, (f.v0 + f.v1) / 2, f.d + LETTER_STANDOFF, (f.v1 - f.v0) * 0.55, portal.u1 - portal.u0 - 0.3, s.sign); }
    else {
      const v0 = (canopy ? canopy.v1 : entrance.top) + 0.15, v1 = v0 + 0.55;
      if (v1 < (levels[1] ?? p.vMax) + 1.2) {
        c.box(g.police ? 'police-white' : s.stone, entrance.u0 - 0.2, entrance.u1 + 0.2, v0, v1, 0, 0.08, c.part());
        counts.letters += drawLettering(c, text, uc, (v0 + v1) / 2, 0.092, 0.38, w + 0.2, s.sign);
      }
    }
  }
  if (g.police?.stripe && g.entrance?.panel === p.index && entrance) {
    // Over the entrance (and canopy), but under the first-floor openings: 0.7 m, squeezed to >= 0.4 m, else dropped under the canopy line.
    let v0 = Math.max(entrance.top + (canopy ? 0.75 : 0.2), groundTop - 0.85);
    const room = lowestHoleAbove(c, v0 - 0.01) - 0.08 - v0;
    if (room < 0.4) v0 = Math.max(entrance.top + 0.2, Math.min(v0, lowestHoleAbove(c, entrance.top) - 0.78));
    const height = Math.max(0.4, Math.min(0.7, lowestHoleAbove(c, v0 - 0.01) - 0.08 - v0)), hall = g.entrance.storeys > 1;
    const plateAt = hall || g.signage ? Math.min(p.uMax - 2.6, entrance.u1 + 2.9) : (entrance.u0 + entrance.u1) / 2;
    drawPoliceStripe(c, v0, height, plateAt, {white: 'police-white', blue: 'police-blue'}, hall ? [[entrance.u0 - 0.3, entrance.u1 + 0.3]] : []);
    counts.policeStripes++;
  }
  // Wall lettering on a group without an entrance: centred on the widest panel, in the wall strip between the first
  // storey's window heads and the second storey's sills.
  if (!g.entrance && g.signage?.mount === 'wall' && g.mainPanel === p.index && levels.length > 2) {
    const holes = [...c.holes.values()].flat(), below = Math.max(levels[1], ...holes.filter(h => h[3] <= levels[2] + 0.01).map(h => h[3]));
    const above = Math.min(levels[2] + 1, lowestHoleAbove(c, levels[2])), hgt = Math.min(0.6, above - below - 0.2), v = (below + above) / 2, W = p.uMax - p.uMin;
    if (hgt >= 0.3 && fitsPanel(p, rectPoly(p.uMin + W * 0.2, p.uMax - W * 0.2, v - hgt / 2, v + hgt / 2))) counts.letters += drawLettering(c, g.signage.text, (p.uMin + p.uMax) / 2, v, 0.012, hgt, W * 0.6, s.sign, (u, vv, d) => c.onWallAt(u, vv, d));
  }
  if (g.crosses && g.mainPanel === p.index) {
    // St Andrew's crosses stacked from just under the eaves down one end of the widest panel, only where the wall is solid there.
    const {count, sizeM, side} = g.crosses, top = panelEaves(p) - 0.5, uc = side === 'left' ? p.uMin + sizeM * 0.9 : p.uMax - sizeM * 0.9;
    for (let i = 0; i < count; i++) {
      const vc = top - sizeM * (i + 0.5) - 0.35 * i;
      if (vc - sizeM / 2 > p.vMin + 1 && fitsPanel(p, rectPoly(uc - sizeM / 2, uc + sizeM / 2, vc - sizeM / 2, vc + sizeM / 2)))
        counts.letters += drawStAndrewsCross(c, uc, vc, sizeM, `cross@g${g.index}`);
    }
  }
  if (g.hoist && g.nameBoards?.length && g.mainPanel === p.index) counts.nameBoards += drawNameBoards(c, info.cells, g);
  if (g.police?.lamp && entrance && drawBlueLamp(c, Math.min(p.uMax - 0.4, entrance.u1 + 0.55), Math.min(entrance.doorTop + 0.9, groundTop - 0.2), {bracket: s.frame, lamp: 'police-blue', cap: 'police-white'})) counts.lamps++;
}

/**
 * Mesh plinth under a layered curtain wall (Stadsloket West's west fronts): a closed dark panel over the ground storey,
 * standing one sheet layer (4.5 cm) off the glass skin, so it shares no plane with the glass or with the grid above it
 * (transoms 9 cm, mullions 13.5 cm); it breaks round openings cut into the ground storey (an entrance). Returns the
 * number of panel pieces drawn.
 */
function drawPlinthPanel(c: PanelCtx, v0: number, v1: number, slot: string): number {
  if (v1 - v0 < 0.5) return 0;
  let n = 0;
  const holes = [...c.holes.values()].flat().filter(h => h[2] < v1 && h[3] > v0).map(h => [h[0] - 0.02, h[1] + 0.02] as [number, number]), part = c.part();
  for (const [a0, b0] of intervals(c.p, v0, v1, 0.25)) {
    let pieces: [number, number][] = [[a0, b0]];
    for (const [s0, s1] of holes) pieces = pieces.flatMap(([a, b]) => (s1 <= a || s0 >= b ? [[a, b]] : [[a, s0], [s1, b]].filter(([x, y]) => y - x > 0.2)) as [number, number][]);
    for (const [a, b] of pieces) if (b - a > 0.2) { c.box(slot, a, b, v0, v1, 0, SHEET_PITCH, part); n++; }
  }
  return n;
}

/**
 * Name boards (white plates with black lettering) over the ground portals of the hoist bays, left to right: the
 * warehouses' painted town names. Each sits over its portal's arch band and under the opening above it.
 */
function drawNameBoards(c: PanelCtx, cells: Cell[], g: LargeGroupFit): number {
  const h = g.hoist!, isHoist = (b: number) => ('bays' in h ? h.bays.includes(b) : b % h.every === h.first);
  const bays = cells.filter(x => x.floor === 0 && isHoist(x.bay)).sort((a, b) => a.u0 - b.u0);
  const holes = [...c.holes.values()].flat();
  let n = 0;
  bays.forEach((cell, k) => {
    const text = g.nameBoards![k];
    if (!text) return;
    const uc = (cell.u0 + cell.u1) / 2, portal = holes.find(h => h[0] < uc && h[1] > uc && h[2] < cell.v0 + 0.5);
    if (!portal) return;
    const bw = Math.min(cell.u1 - cell.u0 - 0.2, 0.3 + 0.13 * text.length), bh = 0.24, v0 = portal[3] + 0.26, v1 = v0 + bh;
    if (v1 > lowestHoleAbove(c, portal[3] + 0.05) - 0.12 || !fitsPanel(c.p, rectPoly(uc - bw / 2, uc + bw / 2, v0, v1))) return;
    c.box('board', uc - bw / 2, uc + bw / 2, v0, v1, 0, 0.03, c.part());
    drawLettering(c, text, uc, (v0 + v1) / 2, 0.042, 0.13, bw - 0.12, 'board-text');
    n++;
  });
  return n;
}

function slopeClass(a: number[], b: number[], c: number[]): 'steep' | 'low' | 'flat' {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(n[0], n[1], n[2]) || 1;
  const deg = Math.acos(Math.min(1, Math.abs(n[1]) / l)) * 180 / Math.PI;
  return deg > 30 ? 'steep' : deg > 8 ? 'low' : 'flat';
}

/** MeshBuilder slots → Three meshes (one per slot; roofs one per slope class) tagged for the GLB exporter. */
export function largeMeshToGroup(mesh: MeshBuilder, recipe: LargeBuildingRecipe): T.Group {
  const group = new T.Group(); group.name = recipe.id;
  const roofColours = ROOF_COLOURS[recipe.roof.material], roofSlot = ['slate', 'zinc', 'bitumen', 'copper'].includes(recipe.roof.material) ? 'slate' : 'roofTile';
  const add = (name: string, positions: number[], colour: string, materialSlot: string, surface: string) => {
    if (!positions.length) return;
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geo.computeVertexNormals();
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({color: colour, roughness: 0.9, metalness: 0}));
    m.name = name; m.userData = {surface, materialSlot, component: name.split('/')[0], pandId: recipe.pandId};
    group.add(m);
  };
  for (const [slot, s] of [...mesh.slots].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (slot === 'roof') {
      const by = {steep: [] as number[], low: [] as number[], flat: [] as number[]}, v = s.positions;
      for (let i = 0; i < v.length; i += 9) by[slopeClass(v.slice(i, i + 3), v.slice(i + 3, i + 6), v.slice(i + 6, i + 9))].push(...v.slice(i, i + 9));
      for (const k of ['steep', 'low', 'flat'] as const) add(`roof/${k}`, by[k], roofColours[k], k === 'flat' ? 'bitumen' : roofSlot, 'roof');
      continue;
    }
    const colour = recipe.spec.palette[slot];
    if (!colour) throw Error(`large tier: slot ${slot} has no palette colour`);
    const {materialSlot, surface} = largeMaterialSlot(slot, recipe);
    add(`${surface}/${slot}`, s.positions, colour, materialSlot, surface);
  }
  return group;
}

/**
 * Hooks for a bespoke builder that drives the large tier and adds hand-modelled parts of its own: `panelHook` runs after
 * the standard components on every panel (with the wall group fit, if any), `afterCompose` once on the finished mesh
 * (same slots, new parts must attach to the host like any block-kit part). Both default to nothing: output unchanged.
 */
export interface LargeCompileHooks {
  panelHook?: (c: PanelCtx, info: {levels: number[]; cells: Cell[]}, group: LargeGroupFit | undefined) => void;
  afterCompose?: (mesh: MeshBuilder, recipe: LargeBuildingRecipe, panels: Panel[]) => void;
  /** triangle budget for the block-kit gate (default 12000, the large-tier budget) */
  budget?: number;
  /** glazing bars and doors this far in front of the glass (`ComposeOptions.barOffsetM`; default 0.015, unchanged output) */
  barOffsetM?: number;
  /** glass setback behind the frame ring in recessed openings (compose `glassBackM`; default 0) */
  glassBackM?: number;
  /** leave a fitted cell empty (after the entrance/garage rule) so the bespoke builder can draw that part of the wall itself */
  skipCell?: (p: Panel, floor: number, bay: number, bays: number, group: LargeGroupFit | undefined) => boolean;
}

export function compileLargeBuilding(intent: LargeBuildingIntent, facts: BuildingFacts, hooks: LargeCompileHooks = {}): CompiledLargeBuilding {
  const {recipe, report} = fitLarge(intent, facts);
  const groupOf = (index: number) => recipe.groups[recipe.panelGroup[index]];
  const counts: LargeComponentCounts = {nameBoards: 0, entrances: 0, halls: 0, canopies: 0, garageDoors: 0, letters: 0, cornices: 0, fascias: 0, policeStripes: 0, lamps: 0, roofPlant: recipe.roofPlant.length};
  const res = compose(recipe.set, recipe.spec, {
    recessM: recipe.recessM,
    sealSlivers: true,
    closedBoxes: true,
    closedBands: !!intent.closedBands,
    ...(intent.layeredKit !== false ? {layered: true} : {}),
    ...(hooks.barOffsetM !== undefined ? {barOffsetM: hooks.barOffsetM} : {}),
    ...(hooks.glassBackM !== undefined ? {glassBackM: hooks.glassBackM} : {}),
    mergeKey: wi => recipe.wallGroup[wi],
    systemFor: p => recipe.panelSystem?.[p.index] ?? groupOf(p.index)?.specSystem ?? recipe.other.specSystem,
    // layered kit: a curtain wall's 3DBAG wall is its glass skin (the grid is drawn on it)
    wallSlotFor: p => { const g = groupOf(p.index); return !g ? 'wall' : g.system === 'curtain-wall' ? (intent.layeredKit !== false ? g.slots.glass : g.slots.curtain) : g.slots.wall; },
    skipCell: (p, floor, bay, bays) => {
      const g = groupOf(p.index);
      if (hooks.skipCell?.(p, floor, bay, bays, g)) return true;
      if (!g) return false;
      if (g.entrance?.panel === p.index && bay === g.entrance.bay && floor < g.entrance.storeys) return true;
      return !!(g.garage?.panel === p.index && floor === 0 && g.garage.bays.includes(bay));
    },
    panelHook: (c, info) => { decorate(c, info, groupOf(c.p.index), counts); hooks.panelHook?.(c, info, groupOf(c.p.index)); },
  });
  drawRoofBoxes(res.mesh, recipe.roofPlant, 'plant');
  for (const l of recipe.lanterns ?? []) { drawLantern(res.mesh, l, {glass: 'glass', frame: 'frame', stone: 'stone'}); counts.lanterns = (counts.lanterns ?? 0) + 1; }
  hooks.afterCompose?.(res.mesh, recipe, res.panels);
  const blockGates = runGates(res.mesh, recipe.set, {budget: hooks.budget ?? 12000});
  return {kind: 'large', group: largeMeshToGroup(res.mesh, recipe), recipe, fit: report, anchorRD: recipe.anchorRD, facts, stats: res.stats, components: counts, blockGates, panels: res.panels};
}
