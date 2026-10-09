import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import source from './vrijburg-footprints.json';

export function buildVrijburg(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
}
