import fs from 'node:fs';
import {buildFatihMoskee} from './fatih-moskee-builder';

/** Attachment-check cases for the discovery-f landmark lane (merged into scripts/check-landmark-attachment.ts). */
type Case = {build: (w: number, d: number, b: never) => void; ring: () => number[][]; top: () => number; topSlack: number};
const load = (id: string) => JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const tops = (id: string) => Math.max(...load(id).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1])));
export const discoveryFCases: Record<string, Case> = {
  // the gilt finials stand 1.8 m above the 3DBAG cap apexes
  'fatih-moskee': {build: buildFatihMoskee, ring: () => load('fatih-moskee').nativeRing, top: () => tops('fatih-moskee'), topSlack: 2.2},
};
