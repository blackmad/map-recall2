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
import {ENTABLATURE} from './entablature.ts';

/**
 * Attic lights (`sill` + `light`, the canal belt's 18th-c. cornice fronts: Herengracht 92 and 94, 2021-01-25 strip at
 * 40 px/m): a 1.1 x 0.45 m dark light in each axis of the 2.0 m white frieze, its foot 0.65 m over the frieze foot. The
 * light is a frame of four 0.06 m bars 7 cm proud of the frieze face (an entablature `trim` frieze is 4 cm proud of the
 * wall) round a dark pane 3.5 cm proud of it, 1 cm inside the bars: no two faces within the GLB audit's 3 cm z-fight bands
 * (a pane 3 mm over a solid panel failed `zfight` on Herengracht 92-96, 2.9 m2).
 */
export const FRIEZE_VENTS = {proudM: 0.042, slotDepthM: 0.02, minWidthM: 0.2, maxWidthM: 2.5, minHeightM: 0.06, maxHeightM: 0.8, maxDropM: 1.5, lightFrameM: 0.06, lightFrameProudM: 0.07, paneProudM: 0.035, paneGapM: 0.01} as const;

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
  if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['span', 'rise', 'drop', 'sill', 'light', 'slot', 'axes'].includes(k))) return [`${at}.friezeVents: {span, rise, drop | sill, light?, slot?, axes?}`];
  const num = (k: string, lo: number, hi: number) => { if (!(typeof v[k] === 'number' && (v[k] as number) >= lo && (v[k] as number) <= hi)) p.push(`${at}.friezeVents.${k}: ${lo}..${hi} m`); };
  num('span', FRIEZE_VENTS.minWidthM, FRIEZE_VENTS.maxWidthM);
  num('rise', FRIEZE_VENTS.minHeightM, FRIEZE_VENTS.maxHeightM);
  if ((v.drop === undefined) === (v.sill === undefined)) p.push(`${at}.friezeVents: one of drop (under the cornice foot) or sill (over the entablature foot)`);
  if (v.drop !== undefined) num('drop', 0, FRIEZE_VENTS.maxDropM);
  if (v.sill !== undefined) {
    const e = f.entablature;
    if (!e) p.push(`${at}.friezeVents.sill: needs an entablature (the lights stand in its frieze)`);
    else num('sill', e.architrave ?? 0, Math.max(0, e.rise - e.cap - (v.rise as number)));
  }
  if (v.light !== undefined && v.light !== true) p.push(`${at}.friezeVents.light: true (or leave it out)`);
  if (v.light && v.slot) p.push(`${at}.friezeVents: light or slot, not both`);
  if (v.light && typeof v.span === 'number' && typeof v.rise === 'number' && (v.span <= 3 * FRIEZE_VENTS.lightFrameM || v.rise <= 3 * FRIEZE_VENTS.lightFrameM)) p.push(`${at}.friezeVents.light: span and rise over ${3 * FRIEZE_VENTS.lightFrameM} m (a frame each side)`);
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
    // `sill`: the panel stands in the entablature's frieze, whose face is ENTABLATURE.friezeDepthM proud of the wall.
    const base = fv.sill !== undefined ? ENTABLATURE.friezeDepthM : 0;
    const top = fv.sill !== undefined ? cornice.bottomM + fv.sill + fv.rise : cornice.bottomM - fv.drop!, bottom = top - fv.rise;
    for (const [i, x] of axes.entries()) {
      if (fv.axes && !fv.axes.includes(i)) continue;
      const k = FRIEZE_VENTS.lightFrameM, x0 = x - fv.span / 2, x1 = x + fv.span / 2;
      if (fv.light) {
        // A frame of four bars `lightFrameM` wide standing `lightFrameProudM` off the frieze, the dark pane between them
        // `paneProudM` off it: every face 3.5 cm or more from its neighbour (geometryAudit's 2-3 cm z-fight bands).
        const zf = base + FRIEZE_VENTS.lightFrameProudM;
        box(panels, x0, x1, bottom, bottom + k, base - 0.005, zf);
        box(panels, x0, x1, top - k, top, base - 0.005, zf);
        box(panels, x0, x0 + k, bottom + k, top - k, base - 0.005, zf);
        box(panels, x1 - k, x1, bottom + k, top - k, base - 0.005, zf);
        box(slots, x0 + k + FRIEZE_VENTS.paneGapM, x1 - k - FRIEZE_VENTS.paneGapM, bottom + k + FRIEZE_VENTS.paneGapM, top - k - FRIEZE_VENTS.paneGapM, base - 0.005, base + FRIEZE_VENTS.paneProudM);
      } else box(panels, x0, x1, bottom, top, base - 0.005, base + FRIEZE_VENTS.proudM);
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
    if (slots.length) mesh(slots, palette.door, `frieze-vents/${front.id}/${fv.light ? 'lights' : 'slots'}`, 'door');
  }
  return added;
}
