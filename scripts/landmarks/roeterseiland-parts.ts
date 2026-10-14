/**
 * Architectural parts of UvA Roeterseiland REC-A (BAG 0363100012185420), derived from the 3DBAG LoD2.2 wall panels' own measures
 * (position in the large tier's frame: x east, z south from the anchor; base height `g`, wall top `top`) and read against the panoramas
 * (staging/pand-reference-walls, artifacts/landmark-briefs/roeterseiland-rec-a). Shared by the survey, the groups generator and the builder.
 *
 * The campus is one BAG pand: the Amsterdam Law School tower on its glazed podium (south), the "De Brug" bridge block that spans the
 * Nieuwe Achtergracht on a 15.2 m soffit (centre), the low brick wing (south-east), a beige 1950s block with a round corner (west) and
 * grey-clad office wings (north). Rule order matters: the first matching part wins.
 */
import fs from 'node:fs';
import {largeSurfaceSet, panelEaves, bearingOfNormal} from '../../src/canalRecall/buildingRecipe/fitLarge';
import {buildHost, type Panel} from '../../src/canalRecall/blockBuilding/panels';
import {MeshBuilder} from '../../src/canalRecall/blockBuilding/mesh';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';
import {openPassage} from './roeterseiland-void';

export const PART_IDS = ['tower', 'podium', 'bridge', 'bridge-city-room', 'se-brick-wing', 'se-tall-block', 'west-beige', 'north-grey', 'north-mid', 'canal-low', 'other'] as const;
export type PartId = typeof PART_IDS[number];

export interface PanelRow {index: number; bearing: number; width: number; eaves: number; ground: number; top: number; partyH: number; at: [number, number]; surfaces: number[]; part: PartId}

/** Which part a wall panel belongs to (position in the local frame, base and top heights, bearing). */
export function partOf(x: number, z: number, g: number, top: number, eaves: number): PartId {
  if (z >= 55 && x < 55 && g >= 12 && top >= 40) return 'tower';
  if (z >= 52 && x < 50 && top <= 14) return 'podium';
  if (x >= 45 && z >= 40 && top <= 9.5) return 'se-brick-wing';
  if (x >= 48 && z >= 40 && top >= 40) return 'se-tall-block';
  if (x > 5 && x < 60 && z > -35 && z < 90 && top >= 39 && g >= 7.5 && g <= 10) return 'bridge';
  if (x > 5 && x < 60 && z > -35 && z < 90 && top >= 39) return 'bridge';
  if (x < 8 && z > -40 && z < 35 && top >= 14 && top <= 19) return 'west-beige';
  if (x < 8 && z > -40 && z < 35 && top <= 9) return 'canal-low';
  if (z < -48) return 'north-grey';
  if (z < -5 && top >= 14) return 'north-mid';
  if (z < -5 && top < 14) return 'canal-low';
  return 'other';
}

/** 3DBAG facts of the pand with the canal passage opened under the bridge block (roeterseiland-void.ts). */
export function loadFacts(): BuildingFacts { return loadOpened().facts; }
let opened: ReturnType<typeof openPassage> | undefined;
export function loadOpened() {
  if (!opened) {
    const raw: BuildingFacts = JSON.parse(fs.readFileSync('scripts/building-recipes/houses/roeterseiland-rec-a/facts.json', 'utf8'));
    opened = openPassage(raw, largeSurfaceSet(raw).anchorRD as [number, number]);
  }
  return opened;
}

export function panelRows(facts: BuildingFacts): {rows: PanelRow[]; panels: Panel[]; anchorRD: [number, number]; surfaceOf: (wall: number) => number} {
  const {set, anchorRD} = largeSurfaceSet(facts);
  const {panels} = buildHost(set, new MeshBuilder(), 'roof', 'wall', {deferWalls: true});
  const rows = panels.map(p => {
    const um = (p.uMin + p.uMax) / 2, at: [number, number] = [p.o[0] + p.r[0] * um, p.o[2] + p.r[2] * um], eaves = panelEaves(p);
    return {index: p.index, bearing: Math.round(bearingOfNormal(p.n)), width: p.uMax - p.uMin, eaves, ground: p.vMin, top: p.vMax, partyH: p.partyH, at,
      surfaces: p.walls.map(w => set.walls[w].surface!), part: partOf(at[0], at[1], p.vMin, p.vMax, eaves)};
  });
  return {rows, panels, anchorRD: anchorRD as [number, number], surfaceOf: w => set.walls[w].surface!};
}
