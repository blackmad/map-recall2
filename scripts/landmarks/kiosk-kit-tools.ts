/**
 * Adapter from the typed kiosk kit (src/canalRecall/kiosks/kioskKit.ts) to the landmark exporter's BuildingTools: places
 * a kiosk spec on its surveyed footprint rectangle and adds every part under the palette colour its role maps to.
 * Each kiosk's catalogue entry gives the measured tint of those palette names in `materialOverrides`.
 */
import type {BuildingTools} from './cultural-builders';
import {placedKiosk, type KioskPart, type KioskRole, type KioskSpec, type Pt} from '../../src/canalRecall/kiosks/kioskKit';

export type Colour = Parameters<BuildingTools['add']>[1];
export type RoleColours = Record<KioskRole, Colour>;

/** Default role -> palette name; a kiosk overrides the roles it brands. */
export const DEFAULT_ROLE_COLOURS: RoleColours = {
  plinth: 'dark', frame: 'copper', glass: 'glass', solid: 'concrete', door: 'copper', board: 'green', void: 'dark',
  counter: 'copper', flap: 'green', strut: 'dark', awning: 'red', awningStripe: 'white', roof: 'slate', fascia: 'slate',
  sign: 'white', lettering: 'gold', chassis: 'dark', wheel: 'dark', hull: 'dark', deck: 'ochre', display: 'bronze',
  bloomA: 'red', bloomB: 'gold', bloomC: 'pink', bloomD: 'white', foliage: 'green', pole: 'dark',
};

export interface KioskFootprint { rect: {centre: Pt; widthM: number; depthM: number; frontBearing: number} }

export function addKiosk(b: BuildingTools, spec: KioskSpec, at: {centre: Pt; frontBearing: number}, colours: Partial<RoleColours> = {}): KioskPart[] {
  const parts = placedKiosk(spec, at.centre, at.frontBearing);
  const map = {...DEFAULT_ROLE_COLOURS, ...colours};
  for (const p of parts) {p.geometry.userData.role = p.role; b.add(p.geometry, map[p.role]);}
  return parts;
}
