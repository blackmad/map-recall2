import fs from 'node:fs';
import {buildScheepvaartmuseum} from './scheepvaartmuseum-builder';
import {buildWaag} from './waag-builder';

/** Attachment-check cases for the backlog landmark lane 2026-10-11 (merged into scripts/check-landmark-attachment.ts). */
type Case = {build: (w: number, d: number, b: never) => void; ring: () => number[][]; top: () => number; topSlack: number};
const load = (id: string) => JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const tops = (id: string) => Math.max(...load(id).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1])));
export const backlogCases: Record<string, Case> = {
  // pediment plates, dormers and the glass courtyard roof stay under the 3DBAG roof maximum except the gilt-free pediment apex
  scheepvaartmuseum: {build: buildScheepvaartmuseum, ring: () => load('scheepvaartmuseum').nativeRing, top: () => tops('scheepvaartmuseum'), topSlack: 0.5},
  // turret cones and finials stand above the 3DBAG cap
  waag: {build: buildWaag, ring: () => load('waag').nativeRing, top: () => tops('waag'), topSlack: 1.5},
};
