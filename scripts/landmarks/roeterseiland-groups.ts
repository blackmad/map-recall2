/**
 * Wall-group generator for UvA Roeterseiland REC-A (BAG 0363100012185420): 672 LoD2.2 wall surfaces in 583 panels, grouped by
 * architectural part (roeterseiland-parts.ts) and storey count into the large-tier intent the bespoke builder compiles.
 * `buildIntent()` is what the builder imports; `--write` also writes scripts/building-recipes/houses/roeterseiland-rec-a/intent.json
 * (so large.ts / walls.ts tooling sees the same intent) and prints the table.
 *
 *   node --import tsx scripts/landmarks/roeterseiland-groups.ts [--write]
 *
 * Rules, each read from the panoramas (roeterseiland-rec-a-inventory.json, roeterseiland-footprints.json):
 *  - a panel is windowed only when it stands on the ground (base <= 3.5 m) or belongs to an elevated part (tower, bridge block, tall
 *    block), is at least 2 m wide, is not a party wall and is not enclosed (a roof >= 6 m high within 8 m straight out: courtyards,
 *    gaps between wings). Everything else is blank wall. The triangle budget (40k) cannot afford windows nobody sees;
 *  - bay pitch per part is measured on the rectified crops (tower 1.15 m ribbon units, bridge block 1.83 m, podium glass fins 2.4 m ...);
 *  - storeys under the eaves per part: tower 4.36 m, bridge block 3.76 m (12 storeys to 45.1 m, the 15.2 m soffit is storey 4).
 */
import fs from 'node:fs';
import {roofHeightAt} from '../../src/canalRecall/buildingRecipe/facts';
import type {LargeBuildingIntent} from '../../src/canalRecall/buildingRecipe/intent';
import {loadFacts, panelRows, type PanelRow, type PartId} from './roeterseiland-parts';

export interface PartStyle {
  /** wall system, storey height (m), bay pitch (m) */
  system: 'brick-bay-grid' | 'ribbon-windows' | 'curtain-wall' | 'blank'; storeyM: number; pitchM: number;
  windows?: 'plain' | 'two-light' | 'cross' | 'transom' | 'low' | 'narrow' | 'wide'; ground?: 'system' | 'glazed' | 'blank' | 'plinth-shopfronts';
  /** only panels on the ground get windows (else elevated parts: tower, bridge) */
  elevated: boolean; frames?: boolean; sills?: boolean;
  /** windows drawn as flush glass-and-frame sheets by the builder (4-12 triangles each) instead of recessed kit openings; the system is then `blank` */
  flush?: {w: number; h: number; sill: number; mull?: number; transom?: number; frameW: number};
  /** group palette (hex) */
  palette: {brick: string; frame: string; stone?: string};
}
export const STYLES: Partial<Record<PartId, PartStyle>> = {
  tower: {system: 'blank', storeyM: 4.36, pitchM: 1.15, elevated: true, palette: {brick: '#3a4350', frame: '#1f242b'}},
  podium: {system: 'curtain-wall', storeyM: 4.07, pitchM: 1.8, ground: 'glazed', elevated: false, palette: {brick: '#6f8089', frame: '#aab6b3'}},
  bridge: {system: 'brick-bay-grid', storeyM: 3.76, pitchM: 1.83, flush: {w: 0.5, h: 0.56, sill: 1.0, frameW: 0.07}, elevated: true, palette: {brick: '#3d3b3a', frame: '#7b6a4c'}},
  'se-tall-block': {system: 'brick-bay-grid', storeyM: 3.76, pitchM: 1.83, flush: {w: 0.5, h: 0.56, sill: 1.0, frameW: 0.07}, elevated: true, palette: {brick: '#3d3b3a', frame: '#7b6a4c'}},
  'se-brick-wing': {system: 'brick-bay-grid', storeyM: 4.2, pitchM: 3.1, windows: 'narrow', elevated: false, frames: false, sills: false, palette: {brick: '#6a3b34', frame: '#2c2f33'}},
  'west-beige': {system: 'brick-bay-grid', storeyM: 3.8, pitchM: 3.6, flush: {w: 0.68, h: 0.56, sill: 0.9, mull: 2, transom: 0.7, frameW: 0.05}, elevated: false, palette: {brick: '#c9ab7c', frame: '#3b3f44', stone: '#d9c9a4'}},
  'north-grey': {system: 'brick-bay-grid', storeyM: 3.55, pitchM: 3.0, flush: {w: 0.7, h: 0.5, sill: 0.95, mull: 1, frameW: 0.06}, elevated: false, palette: {brick: '#b8bdbd', frame: '#2f8f8c'}},
  'north-mid': {system: 'brick-bay-grid', storeyM: 3.7, pitchM: 3.0, flush: {w: 0.6, h: 0.5, sill: 0.95, mull: 1, frameW: 0.06}, elevated: false, palette: {brick: '#b3b8b8', frame: '#2f8f8c'}},
};
/** The Law School entrance panel (N front of the podium, panorama w04-343): its own group, so the entrance and canopy attach to it. */
export const ENTRANCE_SURFACE_PANEL = 107;
/** City-room band of the bridge block: storeys (0 = ground, 3.76 m each) glazed over the canal soffit (w02, w06). */
export const CITY_ROOM_STOREYS = [4, 5];

export interface BuiltGroups {intent: LargeBuildingIntent; groupParts: PartId[]; rows: PanelRow[]; blank: PanelRow[]}
/** Podium panels left as plain 3DBAG wall: the curtain grid there reads as an overhanging frame to the opening audit (its mullions share no assembly with glass). 49 is the east cantilever corner, 176 the south end. */
const NO_SYSTEM_PANELS = new Set([49, 176]);

export function buildIntent(): BuiltGroups {
  const facts = loadFacts(), {rows, panels, anchorRD} = panelRows(facts);
  const enclosed = (p: typeof panels[number]) => {
    const um = (p.uMin + p.uMax) / 2;
    for (const du of [-0.3, 0, 0.3]) for (let d = 1; d <= 8; d += 1) {
      const u = um + du * (p.uMax - p.uMin), x = p.o[0] + p.r[0] * u + p.n[0] * d, z = p.o[2] + p.r[2] * u + p.n[2] * d;
      const h = roofHeightAt(facts.roofsRD, [anchorRD[0] + x, anchorRD[1] - z], facts.heights.groundNAP);
      if (h !== null && h > 6 && h > p.vMin + 4) return true;
    }
    return false;
  };
  const byKey = new Map<string, {part: PartId; storeys: number; rows: PanelRow[]; entrance: boolean}>();
  const blank: PanelRow[] = [];
  for (const r of rows) {
    const style = STYLES[r.part];
    const p = panels[r.index];
    const skip = !style || NO_SYSTEM_PANELS.has(r.index) || r.width < 2 || r.eaves < 3 || r.partyH >= r.top - 0.8 || r.top - r.ground < 5 || enclosed(p);
    if (skip && process.env.RS_DEBUG && r.width >= 8) console.log('blank', r.index, r.part, `w${r.width.toFixed(0)} e${r.eaves.toFixed(1)} g${r.ground.toFixed(1)} t${r.top.toFixed(1)}`, !style ? 'nostyle' : r.partyH >= r.top - 0.8 ? 'party' : enclosed(p) ? 'enclosed' : 'short');
    if (skip) { blank.push(r); continue; }
    const entrance = r.index === ENTRANCE_SURFACE_PANEL;
    const key = `${r.part}${entrance ? '-entrance' : ''}`;
    const e = byKey.get(key) ?? byKey.set(key, {part: r.part, storeys: 1, rows: [], entrance}).get(key)!;
    e.rows.push(r);
  }
  // Storeys from the group's main panel (the widest that reaches the ground, else the widest), as fitLarge picks it: unit ~ storeyM.
  for (const g of byKey.values()) {
    const main = [...g.rows].sort((a, b) => Number(b.ground < 0.6) - Number(a.ground < 0.6) || b.width - a.width || a.index - b.index)[0];
    g.storeys = Math.max(1, Math.round((main.eaves - 0.5) / STYLES[g.part]!.storeyM));
  }
  // Group order: tower first (others align with it), then parts by decreasing storeys.
  const order = [...byKey.values()].sort((a, b) => (a.part === 'tower' ? -1 : 0) - (b.part === 'tower' ? -1 : 0) || b.storeys - a.storeys || a.part.localeCompare(b.part));
  const walls: LargeBuildingIntent['walls'] = [];
  const groupParts: PartId[] = [];
  let towerRef = -1;
  for (const g of order) {
    const s = STYLES[g.part]!, widest = Math.max(...g.rows.map(r => r.width));
    const bays = Math.max(1, Math.min(80, Math.round(widest / s.pitchM)));
    const wall: LargeBuildingIntent['walls'][number] = {
      wallSurfaces: g.rows.flatMap(r => r.surfaces).sort((a, b) => a - b), system: s.flush ? 'blank' : s.system, ...(g.part === 'tower' && towerRef >= 0 ? {alignWith: towerRef} : {storeys: g.storeys}),
      baysPerStorey: bays, ...(s.windows ? {windows: s.windows} : {}), ground: s.ground ?? 'system', frames: s.frames ?? false, ...(s.sills === false ? {sills: false} : {}),
      palette: s.palette,
    } as never;
    if (g.part === 'bridge' || g.part === 'se-tall-block') (wall as {blankStoreys?: number[]}).blankStoreys = [...CITY_ROOM_STOREYS];
    if (g.entrance) (wall as {entrance?: unknown}).entrance = {bay: Math.round(bays * 0.62), storeys: 1, canopy: true};
    if (g.part === 'tower' && towerRef < 0) towerRef = walls.length;
    walls.push(wall); groupParts.push(g.part);
  }
  const intent: LargeBuildingIntent = {
    schemaVersion: 1, kind: 'large', id: 'roeterseiland-rec-a', pandId: '0363100012185420', address: 'UvA Roeterseilandcampus REC-A, Nieuwe Achtergracht 166 / Roetersstraat 11, Amsterdam (BAG 0363100012185420)',
    sources: [
      {id: 'pano-2021-01-22-n', kind: 'street-panorama', capturedAt: '2021-01-22', url: 'https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001975_pano_0000_000894/', license: 'Gemeente Amsterdam panorama, CC BY 4.0'},
      {id: 'pano-2017-07-06-w', kind: 'street-panorama', capturedAt: '2017-07-06', url: 'https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000354_pano_0002_000218/', license: 'Gemeente Amsterdam panorama, CC BY 4.0'},
    ] as never,
    walls, otherWalls: 'blank', roof: {material: 'bitumen'}, palette: {brick: '#6a3b34', frame: '#3b3f44', door: '#23282c', stone: '#cfc7b5'}, closedBands: true, layeredKit: true, roofPlant: false,
    notes: ['Generated by scripts/landmarks/roeterseiland-groups.ts from the survey in roeterseiland-footprints.json; see roeterseiland-rec-a-inventory.json for the evidence per wall.'],
  } as never;
  return {intent, groupParts, rows, blank};
}

if (process.argv[1]?.endsWith('roeterseiland-groups.ts')) {
  const {intent, groupParts, rows, blank} = buildIntent();
  console.log(`panels ${rows.length}, windowed ${rows.length - blank.length}, blank ${blank.length}, groups ${intent.walls.length}`);
  intent.walls.forEach((w, i) => console.log(i, groupParts[i], w.system, 'storeys', (w as {storeys?: number}).storeys ?? `align ${(w as {alignWith?: number}).alignWith}`, 'bays', w.baysPerStorey, 'surfaces', w.wallSurfaces.length));
  if (process.argv.includes('--write')) fs.writeFileSync('scripts/building-recipes/houses/roeterseiland-rec-a/intent.json', JSON.stringify(intent, null, 1) + '\n');
}
