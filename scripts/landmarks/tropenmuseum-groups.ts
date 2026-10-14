/**
 * Wall-group generator for the Tropenmuseum (BAG 0363100012237251): 1,221 LoD2.2 wall surfaces in 908 panels are too many to list by
 * hand, so the groups are derived from the panels' own measures. Writes scripts/landmarks/tropenmuseum-intent.json (the large-tier
 * intent the builder compiles) and prints the table. Rerun after changing the rules below; the output is committed.
 *
 *   node --import tsx scripts/landmarks/tropenmuseum-groups.ts [--write]
 *
 * Rules (each from the register description / panoramas, see tropenmuseum-research.json):
 *  - only walls standing on the ground (lowest edge <= 3.5 m) get windows; the upper stages of the inner light court and the roof
 *    terraces are blank (nothing sees them), as is any panel narrower than 2 m or a party wall (a neighbouring 3DBAG volume as
 *    tall as the panel);
 *  - an enclosed panel (courtyard, light court, gap between wings: a roof >= 6 m high within 12 m straight out) is blank too;
 *  - storeys under the eaves = round((eaves - 0.15) / 4.4), one group per (style, storey count);
 *  - cross windows are two-light on the 7-storey pavilion towers and single lights below (GLB byte budget, see STACKED_TWO_LIGHT_ABOVE);
 *  - style `long`: the museum's two long wings (register: "negen traveeen breed, getoogde negenruits vensters") get round-arched
 *    windows; everything else the cross windows with stone mullions the register describes for the Instituut.
 */
import fs from 'node:fs';
import {largeSurfaceSet, panelEaves, bearingOfNormal} from '../../src/canalRecall/buildingRecipe/fitLarge';
import {buildHost} from '../../src/canalRecall/blockBuilding/panels';
import {MeshBuilder} from '../../src/canalRecall/blockBuilding/mesh';
import {roofHeightAt, type BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';

const facts: BuildingFacts = JSON.parse(fs.readFileSync('scripts/landmarks/tropenmuseum-facts.json', 'utf8'));
const {set, anchorRD} = largeSurfaceSet(facts);
const {panels} = buildHost(set, new MeshBuilder(), 'roof', 'wall', {deferWalls: true});

/** Cross windows keep their stone mullion (two-light) only on wings of 7 storeys (the pavilion towers); below that a single light reads the same at gallery size and saves ~1.6k triangles. */
const STACKED_TWO_LIGHT_ABOVE = 6;
export interface PanelRow {index: number; bearing: number; width: number; eaves: number; ground: number; top: number; partyH: number; surfaces: number[]; storeys: number; blank: boolean; style: 'long' | 'cross'; tier: 'street' | 'rear'; at: [number, number]}
/** Enclosed: another roof stands at least 6 m high within 12 m straight out from the panel (courtyards, the light court, gaps between wings). */
const enclosed = (p: ReturnType<typeof buildHost>['panels'][number]) => {
  const um = (p.uMin + p.uMax) / 2;
  for (const du of [-0.3, 0, 0.3]) for (let d = 1; d <= 12; d += 1) {
    const u = um + du * (p.uMax - p.uMin), x = p.o[0] + p.r[0] * u + p.n[0] * d, z = p.o[2] + p.r[2] * u + p.n[2] * d;
    const h = roofHeightAt(facts.roofsRD, [anchorRD[0] + x, anchorRD[1] - z], facts.heights.groundNAP);
    if (h !== null && h > 6 && h > p.vMin + 4) return true;
  }
  return false;
};
/** Panels left blank on purpose (surface id -> reason): the kit could only draw their windows flush, coplanar with the wall (audit zfight). */
const NO_WINDOWS: Record<number, string> = {138: 'Oosterpark-side stair bay, skewed 3DBAG members: windows fall back to flush sheets that z-fight the wall'};
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
export const rows: PanelRow[] = panels.map(p => {
  const width = p.uMax - p.uMin, eaves = panelEaves(p), um = (p.uMin + p.uMax) / 2;
  const at: [number, number] = [p.o[0] + p.r[0] * um, p.o[2] + p.r[2] * um], bearing = Math.round(bearingOfNormal(p.n));
  const surfaces = p.walls.map(w => set.walls[w].surface!);
  const blank = width < 2 || eaves < 3 || p.vMin > 3.5 || p.partyH >= p.vMax - 0.8 || enclosed(p) || surfaces.some(x => x in NO_WINDOWS);
  const long = at[0] > 29 && width >= 14 && (angDiff(bearing, 331) < 12 || angDiff(bearing, 151) < 12);
  const street = angDiff(bearing, 331) < 25 || angDiff(bearing, 61) < 25;
  return {index: p.index, bearing, width: +width.toFixed(1), eaves: +eaves.toFixed(1), ground: +p.vMin.toFixed(1), top: +p.vMax.toFixed(1), partyH: +p.partyH.toFixed(1), surfaces,
    storeys: Math.max(1, Math.round((eaves - 0.15) / 4.4)), blank, style: long ? 'long' : 'cross', tier: street ? 'street' : 'rear', at};
});
if (process.argv[1]?.endsWith('tropenmuseum-groups.ts')) {
  const byKey = new Map<string, PanelRow[]>();
  for (const r of rows) if (!r.blank) byKey.set(`${r.style}-${r.tier}-${r.storeys}`, [...(byKey.get(`${r.style}-${r.tier}-${r.storeys}`) ?? []), r]);
  const walls = [...byKey].sort((a, b) => b[1][0].storeys - a[1][0].storeys || a[0].localeCompare(b[0])).map(([key, list]) => ({
    wallSurfaces: list.flatMap(r => r.surfaces).sort((a, b) => a - b), system: 'brick-bay-grid', storeys: list[0].storeys, windows: 'two-light', ground: 'system',
    ...(list[0].style === 'long' ? {arches: {windows: 'round', ground: 'round', band: 'none'}, windows: 'plain'} : {}),
    frames: false, sills: false, ...(list[0].tier === 'rear' || list[0].storeys <= STACKED_TWO_LIGHT_ABOVE ? {windows: 'plain'} : {}),
  }));
  console.log(`panels ${rows.length}, windowed ${rows.filter(r => !r.blank).length}, blank ${rows.filter(r => r.blank).length}`);
  for (const [k, l] of byKey) console.log(k, l.length, 'panels');
  const intent = JSON.parse(fs.existsSync('scripts/landmarks/tropenmuseum-intent.json') ? fs.readFileSync('scripts/landmarks/tropenmuseum-intent.json', 'utf8') : '{}');
  const out = {
    schemaVersion: 1, kind: 'large', id: 'tropenmuseum', pandId: '0363100012237251', address: 'Koninklijk Instituut voor de Tropen / Tropenmuseum, Linnaeusstraat 2, Amsterdam',
    sources: intent.sources ?? [{id: 'pano-2020-04-24', kind: 'street-panorama', capturedAt: '2020-04-24', url: 'https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-001674_pano_0000_003613/', license: 'Gemeente Amsterdam panorama, CC BY 4.0'}],
    walls, otherWalls: 'blank', roof: {material: 'slate'}, palette: {brick: '#8a5a47', frame: '#e8e4d8', door: '#2f3b33', stone: '#d9cfb8'}, closedBands: true,
    notes: intent.notes ?? [],
  };
  if (process.argv.includes('--write')) fs.writeFileSync('scripts/landmarks/tropenmuseum-intent.json', JSON.stringify(out, null, 1) + '\n');
}
