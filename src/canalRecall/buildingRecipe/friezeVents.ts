/**
 * Frieze vents (`friezeVents`, Helmersbuurt 1893-1901 rows: Eerste Helmersstraat 209-229 and 124-128): the plain brick
 * frieze between the top storey's window heads and the wooden cornice carries one white cast panel (an attic vent,
 * "zoldervenster" grille) over each window axis. Facade frame (x along the front, y up, z outward), after the library
 * has built the openings and the cornice; a front without `friezeVents` is untouched.
 *
 * Each panel is `span` x `rise` metres, centred on its axis (the top storey's window centres), its top `drop` metres
 * under the cornice's foot, 4.2 cm proud, in the stone colour (painted: `palette.stoneMaterial`), with a slot 2 cm deep in
 * the dark of the door colour across its middle third when `slot` is set (the open grille of 211-213). Not 3 cm proud:
 * that sits in the audit's tight z-fight band over the wall (geometryAudit zTightTol; 0.9 m2 on Eerste 217-229).
 * Measured on the 2024-11-29 strip of Eerste Helmersstraat 209-253 at 40 px/m: 223-229 panels 0.85 x 0.16 m, their tops
 * 0.42 m under the cornice foot.
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {CanalHouseIntent, FrontIntent} from './intent.ts';
import type {FitReport} from './fit.ts';
import {frontEnds} from './historicPasses.ts';

export const FRIEZE_VENTS = {proudM: 0.042, slotDepthM: 0.02, minWidthM: 0.2, maxWidthM: 2.5, minHeightM: 0.06, maxHeightM: 0.8, maxDropM: 1.5} as const;

type V3 = [number, number, number];

/** An axis-aligned box in the facade frame (front, top, bottom and side faces; the back is against the wall). */
function box(values: number[], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const q = (a: V3, b: V3, c: V3, d: V3) => values.push(...a, ...b, ...c, ...a, ...c, ...d);
  q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  q([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
  q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  q([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
}

/** Window axes of the top window storey: the centres (facade x) of its windows, left to right. */
export function topStoreyAxes(openings: {id: string; kind: string; leftM: number; widthM: number}[]): number[] {
  const storeyOf = (id: string) => Number(/(?:^|-)s(\d+)-b\d+[ab]?$/.exec(id)?.[1] ?? NaN);
  const wins = openings.filter(o => o.kind === 'window' && Number.isFinite(storeyOf(o.id)));
  if (!wins.length) return [];
  const top = Math.max(...wins.map(o => storeyOf(o.id)));
  return wins.filter(o => storeyOf(o.id) === top).map(o => o.leftM + o.widthM / 2).sort((a, b) => a - b);
}

export function friezeVentProblems(f: FrontIntent, at: string): string[] {
  const v = f.friezeVents as Record<string, unknown> | undefined, p: string[] = [];
  if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['span', 'rise', 'drop', 'slot', 'axes'].includes(k))) return [`${at}.friezeVents: {span, rise, drop, slot?, axes?}`];
  const num = (k: string, lo: number, hi: number) => { if (!(typeof v[k] === 'number' && (v[k] as number) >= lo && (v[k] as number) <= hi)) p.push(`${at}.friezeVents.${k}: ${lo}..${hi} m`); };
  num('span', FRIEZE_VENTS.minWidthM, FRIEZE_VENTS.maxWidthM);
  num('rise', FRIEZE_VENTS.minHeightM, FRIEZE_VENTS.maxHeightM);
  num('drop', 0, FRIEZE_VENTS.maxDropM);
  if (v.slot !== undefined && v.slot !== true) p.push(`${at}.friezeVents.slot: true (or leave it out)`);
  if (v.axes !== undefined && (!Array.isArray(v.axes) || !v.axes.length || v.axes.some(a => !Number.isInteger(a) || a < 0 || a > 15))) p.push(`${at}.friezeVents.axes: window axis indices`);
  if (f.cornice === 'none' || f.cornice === undefined) p.push(`${at}.friezeVents: needs a cornice (the panels hang under its foot)`);
  return p;
}

export function addFriezeVents(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  const palette = recipe.palette.value;
  for (const front of intent.fronts) {
    const fv = front.friezeVents;
    if (!fv) continue;
    const elevation = recipe.elevations.find(e => e.id === front.id), f = fit.fronts.find(x => x.id === front.id);
    const cornice = elevation?.cornice?.value;
    if (!elevation || !f || !cornice) continue;
    const {facade} = frontEnds(group, recipe, f);
    const axes = topStoreyAxes(elevation.openings.value), panels: number[] = [], slots: number[] = [];
    const top = cornice.bottomM - fv.drop, bottom = top - fv.rise;
    for (const [i, x] of axes.entries()) {
      if (fv.axes && !fv.axes.includes(i)) continue;
      box(panels, x - fv.span / 2, x + fv.span / 2, bottom, top, -0.005, FRIEZE_VENTS.proudM);
      if (fv.slot) box(slots, x - fv.span / 3, x + fv.span / 3, bottom + fv.rise / 3, top - fv.rise / 3, FRIEZE_VENTS.proudM - FRIEZE_VENTS.slotDepthM, FRIEZE_VENTS.proudM + 0.003);
      added++;
    }
    if (!panels.length) continue;
    const mesh = (values: number[], colour: string, name: string, surface: string) => {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
      const m = new T.Mesh(g, new T.MeshStandardMaterial({color: colour, roughness: 1}));
      m.name = name; m.userData = {component: 'frieze-vents', surface, pandId: intent.pandId};
      facade.add(m);
    };
    mesh(panels, palette.stone ?? palette.trim, `frieze-vents/${front.id}/panels`, 'stone');
    if (slots.length) mesh(slots, palette.door, `frieze-vents/${front.id}/slots`, 'door');
  }
  return added;
}
