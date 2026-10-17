/**
 * `kind: large` compile: fitLarge recipe → block-kit compose (windows cut into the exact 3DBAG walls, recessed
 * `LARGE_RECESS_M`) → wall-group components (entrances, canopies, garage doors, cornices, fascias, lettering, police
 * band and lamp) → roof plant → a Three group whose meshes carry the recipe material slot (`userData.materialSlot`)
 * and surface, so the GLB exporter writes `materialSlot` + `tint` on every material.
 */
import * as T from 'three';
import {compose, intervals, SHEET_PITCH, type Cell, type PanelCtx} from '../blockBuilding/compose.ts';
import {runGates, type GateReport} from '../blockBuilding/gates.ts';
import {cellSpan, drawBand, drawBlueLamp, drawCanopy, drawArcadeFacing, drawCurtainGrid, CURTAIN_GRID_OVER_SPANDRELS, drawSpandrels, drawEntrance, drawGlazedColumns, drawGlazedHall, drawGarageDoor, drawLantern, drawLettering, drawNameBand, drawPilasters, drawPoliceStripe, drawPortal, drawRoofBoxes, drawScreen, drawStAndrewsCross, drawStoneStorey, LETTER_STANDOFF, lowestHoleAbove, type PortalResult} from '../blockBuilding/components.ts';
import type {MeshBuilder} from '../blockBuilding/mesh.ts';
import {fitsPanel, pointInRing, rectPoly, type Panel} from '../blockBuilding/panels.ts';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent, RoofMaterial} from './intent.ts';
import {ROOF_COLOURS} from './fit.ts';
import {fitLarge, panelEaves, type LargeBuildingRecipe, type LargeFitReport, type LargeGroupFit, type LargeRoofFit} from './fitLarge.ts';

export interface LargeComponentCounts { arcades?: number; glazedHalls?: number; glassColumns?: number; curtainGrids?: number; spandrels?: number; plinths?: number; screens?: number; portals?: number; nameBands?: number; stoneStoreys?: number; pilasters?: number; lanterns?: number; nameBoards: number; entrances: number; halls: number; canopies: number; garageDoors: number; letters: number; cornices: number; fascias: number; policeStripes: number; lamps: number; roofPlant: number }
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
    // opaque (frosted or enamelled) spandrel glass of a curtain wall: a smooth stone-cell panel (a measured colour is drawn as authored, cityMeasuredStoneTint), not the glass pane texture; a coloured mesh plinth: a matte render
    case 'spandrel': return {materialSlot: 'stone', surface: 'wall'};
    case 'plinth': return {materialSlot: 'stucco', surface: 'wall'};
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

function decorate(c: PanelCtx, info: {levels: number[]; cells: Cell[]}, g: LargeGroupFit | undefined, counts: LargeComponentCounts, noBands = false) {
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
  // Recessed arcade: rendered lintel band over the chamfered openings and pier facings below it (the door slot: dark brick).
  if (g.ground === 'arcade' && g.arcade?.facing && levels.length > 1) { const k = drawArcadeFacing(c, Math.max(0, p.vMin), Math.min(groundTop, underCornice), {band: s.stone, pier: s.door}); if (k) counts.arcades = (counts.arcades ?? 0) + 1; }
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
    if (plinth && drawPlinthPanel(c, Math.max(0, p.vMin), groundTop, g.plinthSlot ?? s.door)) counts.plinths = (counts.plinths ?? 0) + 1;
    if (g.spandrels && cells.length && top - p.vMin > 2) {
      // Spandrel panels on the 9 cm layer, the grid in front of them (transoms 13.5 cm, mullions 18 cm) with rails at the panel edges.
      const sp = drawSpandrels(c, cells, levels, g.spandrels, top);
      if (sp.panels) counts.spandrels = (counts.spandrels ?? 0) + sp.panels;
      if (drawCurtainGrid(c, cells, sp.gridLevels, s.curtain, top, CURTAIN_GRID_OVER_SPANDRELS)) counts.curtainGrids = (counts.curtainGrids ?? 0) + 1;
    } else if (cells.length && top - p.vMin > 2 && drawCurtainGrid(c, cells, levels, s.curtain, top)) counts.curtainGrids = (counts.curtainGrids ?? 0) + 1;
  }
  // Glazed hall over its brick base; glass columns over their bays (after the openings, before the cornice).
  if (g.hall && info.cells.length && drawGlazedHall(c, info.cells, g.hall.baseM, panelEaves(p) - 0.05, g.hall.lights, g.hall.rows, {wall: s.wall, frame: s.frame, stone: s.stone})) counts.glazedHalls = (counts.glazedHalls ?? 0) + 1;
  if (g.columns && info.cells.length) {
    const col = g.columns, every = Math.max(1, g.bays, ...col.bays.map(b => b + 1));
    const k = drawGlazedColumns(c, info.cells, levels, bay => col.bays.includes(bay % every), col.from, col.share, col.slabs, panelEaves(p) - 0.2, {glass: col.glass ?? s.glass, frame: s.frame, stone: s.stone});
    if (k) counts.glassColumns = (counts.glassColumns ?? 0) + k;
  }
  if (g.cornice && !noBands) { const top = panelEaves(p); if (top - p.vMin > 3 && drawBand(c, s.stone, top - 0.45, top - 0.02, CORNICE_OUT)) counts.cornices++; }
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
 * standing two sheet layers (9 cm) off the glass skin, beyond the audit's 8 cm near band (at 4.5 cm the whole plinth
 * read as 259 m2 of near-coplanar face), and clear of the grid, which starts above it; it breaks round openings cut
 * into the ground storey (an entrance). Returns the number of panel pieces drawn.
 */
function drawPlinthPanel(c: PanelCtx, v0: number, v1: number, slot: string): number {
  if (v1 - v0 < 0.5) return 0;
  let n = 0;
  const holes = [...c.holes.values()].flat().filter(h => h[2] < v1 && h[3] > v0).map(h => [h[0] - 0.02, h[1] + 0.02] as [number, number]), part = c.part();
  for (const [a0, b0] of intervals(c.p, v0, v1, 0.25)) {
    let pieces: [number, number][] = [[a0, b0]];
    for (const [s0, s1] of holes) pieces = pieces.flatMap(([a, b]) => (s1 <= a || s0 >= b ? [[a, b]] : [[a, s0], [s1, b]].filter(([x, y]) => y - x > 0.2)) as [number, number][]);
    for (const [a, b] of pieces) if (b - a > 0.2) { c.box(slot, a, b, v0, v1, 0, 2 * SHEET_PITCH, part); n++; }
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

/**
 * Material of one roof triangle: the `roof.surfaces` region it was cut from (centroid inside the plane's plan rings and
 * within its height range, 5 cm slack), else `roof.flat` for the flat class, else the default material.
 */
export function roofMaterialOf(roof: LargeRoofFit, a: number[], b: number[], c: number[], cls: 'steep' | 'low' | 'flat'): RoofMaterial {
  return roofRegionOf(roof, a, b, c) ?? (cls === 'flat' && roof.flat ? roof.flat : roof.material);
}

/** The material of the `surfaces` region a roof triangle lies in, or null. */
function roofRegionOf(roof: LargeRoofFit, a: number[], b: number[], c: number[]): RoofMaterial | null {
  if (!roof.regions) return null;
  const x = (a[0] + b[0] + c[0]) / 3, y = (a[1] + b[1] + c[1]) / 3, z = (a[2] + b[2] + c[2]) / 3;
  for (const r of roof.regions) {
    if (y < r.yMin - 0.05 || y > r.yMax + 0.05) continue;
    if (pointInRing([x, z], r.rings[0]) && !r.rings.slice(1).some(h => pointInRing([x, z], h))) return r.material;
  }
  return null;
}

function slopeClass(a: number[], b: number[], c: number[]): 'steep' | 'low' | 'flat' {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(n[0], n[1], n[2]) || 1;
  const deg = Math.acos(Math.min(1, Math.abs(n[1]) / l)) * 180 / Math.PI;
  return deg > 30 ? 'steep' : deg > 8 ? 'low' : 'flat';
}

/**
 * Wall colour splits (intent `wallSplit`): the group's wall triangles on its main panel whose centroid lies right of the
 * split (`u > uM`, within 1.5 m of the wall plane) move to the split slot; triangles straddling the split are clipped
 * at it (a straight vertical colour change). Returns the number of triangles moved or clipped. No splits: nothing changes.
 */
export function applyWallSplits(mesh: MeshBuilder, groups: LargeGroupFit[], panels: Panel[]): number {
  let moved = 0;
  for (const g of groups) {
    if (!g.split) continue;
    const p = panels.find(q => q.index === g.split!.panel), src = mesh.slots.get(g.slots.wall);
    if (!p || !src) continue;
    const keep = {positions: [] as number[], parts: [] as number[]}, out = mesh.slots.get(g.split.slot) ?? {positions: [], parts: []};
    const uOf = (q: number[]) => (q[0] - p.o[0]) * p.r[0] + (q[1] - p.o[1]) * p.r[1] + (q[2] - p.o[2]) * p.r[2];
    const nOf = (q: number[]) => (q[0] - p.o[0]) * p.n[0] + (q[1] - p.o[1]) * p.n[1] + (q[2] - p.o[2]) * p.n[2];
    const emit = (dst: typeof keep, poly: number[][], part: number) => { for (let i = 1; i + 1 < poly.length; i++) { dst.positions.push(...poly[0], ...poly[i], ...poly[i + 1]); dst.parts.push(part); } };
    for (let t = 0; t < src.parts.length; t++) {
      const v = [0, 1, 2].map(i => src.positions.slice(t * 9 + i * 3, t * 9 + i * 3 + 3)), part = src.parts[t];
      const c = [0, 1, 2].map(i => (v[0][i] + v[1][i] + v[2][i]) / 3), us = v.map(uOf);
      const onPanel = Math.abs(nOf(c)) <= 1.5 && Math.min(...us) <= p.uMax + 0.05 && Math.max(...us) >= p.uMin - 0.05;
      if (!onPanel || Math.max(...us) <= g.split.uM + 1e-4) { emit(keep, v, part); continue; }
      if (Math.min(...us) >= g.split.uM - 1e-4) { emit(out, v, part); moved++; continue; }
      // straddles the split: clip into the left and right polygons so the colour change is a straight vertical line
      const left: number[][] = [], right: number[][] = [];
      for (let i = 0; i < 3; i++) {
        const a = v[i], b = v[(i + 1) % 3], ua = us[i], ub = us[(i + 1) % 3];
        (ua <= g.split.uM ? left : right).push(a);
        if ((ua - g.split.uM) * (ub - g.split.uM) < 0) { const k = (g.split.uM - ua) / (ub - ua), x = [0, 1, 2].map(j => a[j] + (b[j] - a[j]) * k); left.push(x); right.push(x); }
      }
      emit(keep, left, part); emit(out, right, part); moved++;
    }
    mesh.slots.set(g.slots.wall, keep);
    if (out.parts.length) mesh.slots.set(g.split.slot, out);
  }
  return moved;
}

/** MeshBuilder slots → Three meshes (one per slot; roofs one per slope class) tagged for the GLB exporter. */
export function largeMeshToGroup(mesh: MeshBuilder, recipe: LargeBuildingRecipe): T.Group {
  const group = new T.Group(); group.name = recipe.id;
  const measured = new Set(recipe.measuredSlots ?? []);
  const add = (name: string, positions: number[], colour: string, materialSlot: string, surface: string, slot?: string, measuredTint = false) => {
    if (!positions.length) return;
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geo.computeVertexNormals();
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({color: colour, roughness: 0.9, metalness: 0}));
    m.name = name; m.userData = {surface, materialSlot, component: name.split('/')[0], pandId: recipe.pandId};
    // measured wall colour (export-glb writes `tintSource: 'measured'`; the look then keeps it instead of clamping it)
    if (measuredTint || (slot && measured.has(slot))) m.material.userData = {tintSource: 'measured'};
    group.add(m);
  };
  for (const [slot, s] of [...mesh.slots].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (slot === 'roof') {
      // one mesh per (material, slope class); the default material first and named as before, so a roof without
      // `flat`/`regions` exports exactly as it always did
      // `flatHex` (measured from the orthophoto): the flat class outside the `surfaces` regions is one mesh in that colour,
      // named `roof/flat`, drawn as measured
      const by = new Map<RoofMaterial, Record<'steep' | 'low' | 'flat', number[]>>([[recipe.roof.material, {steep: [], low: [], flat: []}]]), v = s.positions;
      const measuredFlat: number[] = [], flatHex = recipe.roof.flatHex;
      for (let i = 0; i < v.length; i += 9) {
        const a = v.slice(i, i + 3), b = v.slice(i + 3, i + 6), c = v.slice(i + 6, i + 9), k = slopeClass(a, b, c);
        if (flatHex && k === 'flat' && !roofRegionOf(recipe.roof, a, b, c)) { measuredFlat.push(...a, ...b, ...c); continue; }
        const m = roofMaterialOf(recipe.roof, a, b, c, k);
        if (!by.has(m)) by.set(m, {steep: [], low: [], flat: []});
        by.get(m)![k].push(...a, ...b, ...c);
      }
      for (const [m, cls] of by) for (const k of ['steep', 'low', 'flat'] as const) {
        const roofSlot = ['slate', 'zinc', 'bitumen', 'copper'].includes(m) ? 'slate' : 'roofTile';
        add(m === recipe.roof.material ? `roof/${k}` : `roof/${k}/${m}`, cls[k], ROOF_COLOURS[m][k], k === 'flat' ? 'bitumen' : roofSlot, 'roof');
      }
      if (flatHex) add('roof/flat', measuredFlat, flatHex, 'bitumen', 'roof', undefined, true);
      continue;
    }
    const colour = recipe.spec.palette[slot];
    if (!colour) throw Error(`large tier: slot ${slot} has no palette colour`);
    const {materialSlot, surface} = largeMaterialSlot(slot, recipe);
    add(`${surface}/${slot}`, s.positions, colour, materialSlot, surface, slot);
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
  /** leave this panel's string courses and cornice out (a court face no camera sees; the Tropenmuseum's hidden panels) */
  skipBands?: (p: Panel) => boolean;
}

export function compileLargeBuilding(intent: LargeBuildingIntent, inputFacts: BuildingFacts, hooks: LargeCompileHooks = {}): CompiledLargeBuilding {
  // `facts` are the shell-repaired facts when the intent opts in (shellRepair.ts), so the gates see the shell that was built
  const {recipe, report, facts} = fitLarge(intent, inputFacts);
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
    // layered kit: a curtain wall's (and a glazed hall's) 3DBAG wall is its glass skin (the grid and the hall's brick base are drawn on it)
    wallSlotFor: p => { const g = groupOf(p.index); return !g ? 'wall' : g.system === 'curtain-wall' ? (intent.layeredKit !== false ? g.slots.glass : g.slots.curtain) : g.system === 'glazed-hall' && intent.layeredKit !== false ? g.slots.glass : g.slots.wall; },
    skipCell: (p, floor, bay, bays) => {
      const g = groupOf(p.index);
      if (hooks.skipCell?.(p, floor, bay, bays, g)) return true;
      if (!g) return false;
      if (g.entrance?.panel === p.index && bay === g.entrance.bay && floor < g.entrance.storeys) return true;
      return !!(g.garage?.panel === p.index && floor === 0 && g.garage.bays.includes(bay));
    },
    ...(hooks.skipBands ? {skipBands: hooks.skipBands} : {}),
    panelHook: (c, info) => { decorate(c, info, groupOf(c.p.index), counts, !!hooks.skipBands?.(c.p)); hooks.panelHook?.(c, info, groupOf(c.p.index)); },
  });
  drawRoofBoxes(res.mesh, recipe.roofPlant, 'plant');
  for (const l of recipe.lanterns ?? []) { drawLantern(res.mesh, l, {glass: 'glass', frame: 'frame', stone: 'stone'}); counts.lanterns = (counts.lanterns ?? 0) + 1; }
  applyWallSplits(res.mesh, recipe.groups, res.panels);
  hooks.afterCompose?.(res.mesh, recipe, res.panels);
  const blockGates = runGates(res.mesh, recipe.set, {budget: hooks.budget ?? 12000});
  return {kind: 'large', group: largeMeshToGroup(res.mesh, recipe), recipe, fit: report, anchorRD: recipe.anchorRD, facts, stats: res.stats, components: counts, blockGates, panels: res.panels};
}
