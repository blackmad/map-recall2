/**
 * Transvaalbuurt round 5a pipeline fixes (#157): installed runs survive a buurt re-run, street furniture is no business,
 * the batch measures walls from tree-free columns, the likeness reads the facade foot off the strip.
 *   node --import tsx --test src/canalRecall/blockFace/pipelineRound5.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assignRunIds, frozenRuns, installedRunIds, type ExistingRun} from './autoPlace.ts';

const json = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const FACES = 'scripts/block-face/faces';
const members = (face: string): string[] => json(`${FACES}/${face}/discovery.json`).members;

test('fix 2: installed runs of pretorius-71-95 are read from chunks.json', () => {
  const chunks = json('public/canal-drive/ordinary-buildings-data/chunks.json').chunks.map((c: {id: string}) => c.id);
  assert.deepEqual(installedRunIds('pretorius-71-95', chunks).sort(), ['pretorius-71-95-r1', 'pretorius-71-95-r2']);
  // a longer face id sharing the prefix is not this face's run
  assert.deepEqual(installedRunIds('pretorius-71-9', chunks), []);
});

test('fix 2: a re-run keeps an installed run and numbers a new placement on the same face after it', () => {
  const face = members('pretorius-71-95'), r1 = members('pretorius-71-95-r1');
  // fixture: r1 installed, r2 an earlier uninstalled run on other pands
  const existing: ExistingRun[] = [{id: 'pretorius-71-95-r1', pands: r1, installed: true}, {id: 'pretorius-71-95-r2', pands: face.slice(9, 11), installed: false}];
  const none = new Set<string>();
  assert.deepEqual(frozenRuns(existing, none).map(r => r.id), ['pretorius-71-95-r1']);
  // the new placement: the three pands before r1 and three after it (r1's pands are held at stage `installed`)
  const runs = [face.slice(1, 4), face.slice(6, 9)];
  assert.deepEqual(assignRunIds('pretorius-71-95', face.length, runs, existing, none), ['pretorius-71-95-r2', 'pretorius-71-95-r3']);
  // the old numbering would have given r1 to the first new run and overwritten the installed intent
  assert.deepEqual(assignRunIds('pretorius-71-95', face.length, runs, [], none), ['pretorius-71-95-r1', 'pretorius-71-95-r2']);
  // one run of the whole face never takes the face id while a run is installed
  assert.deepEqual(assignRunIds('pretorius-71-95', face.length, [face.filter(p => !r1.includes(p))], existing, none), ['pretorius-71-95-r2']);
});

test('fix 2: --replace re-places an installed run under its own id', () => {
  const face = members('pretorius-71-95'), r1 = members('pretorius-71-95-r1'), r2 = members('pretorius-71-95-r2');
  const existing: ExistingRun[] = [{id: 'pretorius-71-95-r1', pands: r1, installed: true}, {id: 'pretorius-71-95-r2', pands: r2, installed: true}];
  const replace = new Set(['pretorius-71-95-r2']);
  assert.deepEqual(frozenRuns(existing, replace).map(r => r.id), ['pretorius-71-95-r1']);
  const i = face.indexOf(r2[0]);
  assert.deepEqual(assignRunIds('pretorius-71-95', face.length, [face.slice(1, 4), face.slice(i - 1, i + 3)], existing, replace), ['pretorius-71-95-r3', 'pretorius-71-95-r2']);
});
