import fs from 'node:fs';
import {buildCoymanshuis} from './coymanshuis-builder';

/** Attachment-check cases for the discovery-c landmark lane (merged into scripts/check-landmark-attachment.ts). */
type Case = {build: (w: number, d: number, b: never) => void; ring: () => number[][]; top: () => number; topSlack: number};
const load = (id: string) => JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const tops = (id: string) => Math.max(...load(id).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1])));
export const discoveryCCases: Record<string, Case> = {
  coymanshuis: {build: buildCoymanshuis, ring: () => load('coymanshuis').nativeRing, top: () => tops('coymanshuis'), topSlack: 2.0},
};
