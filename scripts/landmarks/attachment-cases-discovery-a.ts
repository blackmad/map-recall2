import fs from 'node:fs';
import {buildTrippenhuis} from './trippenhuis-builder';
import {buildAmericanHotel} from './american-hotel-builder';
import {buildHotelDeLEurope} from './hotel-de-l-europe-builder';

/** Attachment-check cases for the discovery-a landmark lane (merged into scripts/check-landmark-attachment.ts). */
type Case = {build: (w: number, d: number, b: never) => void; ring: () => number[][]; top: () => number; topSlack: number};
const load = (id: string) => JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const tops = (id: string) => Math.max(...load(id).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1])));
export const discoveryACases: Record<string, Case> = {
  trippenhuis: {build: buildTrippenhuis, ring: () => load('trippenhuis').nativeRing, top: () => tops('trippenhuis'), topSlack: 1.0},
  'american-hotel': {build: buildAmericanHotel, ring: () => load('american-hotel').nativeRing, top: () => tops('american-hotel'), topSlack: 1.0},
  'hotel-de-l-europe': {build: buildHotelDeLEurope, ring: () => load('hotel-de-l-europe').nativeRing, top: () => tops('hotel-de-l-europe'), topSlack: 1.0},
};
