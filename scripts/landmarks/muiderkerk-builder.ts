import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import source from './muiderkerk-footprints.json';

const cx = (s: Surface) => s.rings[0].reduce((a, p) => a + p[0], 0) / s.rings[0].length;
const top = (s: Surface) => Math.max(...s.rings[0].map(p => p[1]));
const isTower = (s: Surface) => top(s) > 23 && cx(s) < -6.3;

export function buildMuiderkerk(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'ochre', roof: 'slate', skip: s => isTower(s)});
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: s => !isTower(s)});
}
