import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import source from './symphony-footprints.json';

export function buildSymphony(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'concrete', roof: 'slate'});
  b.mark?.('shell');
}
