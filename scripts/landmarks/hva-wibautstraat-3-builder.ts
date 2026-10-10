import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import source from './hva-wibautstraat-3-footprints.json';

export function buildHvaWibautstraat3(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'concrete'});
  b.mark?.('shell');
}
