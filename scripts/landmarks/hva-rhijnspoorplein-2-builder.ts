import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import source from './hva-rhijnspoorplein-2-footprints.json';

export function buildHvaRhijnspoorplein2(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'concrete'});
  b.mark?.('shell');
}
