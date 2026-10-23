import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {draftLargeIntent, frontOfPanel} from './draftLarge.ts';
import {validateLargeIntent} from './largeIntent.ts';
import {compileBuilding} from './compile.ts';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';

const HOUSES = path.resolve(import.meta.dirname, '../../../scripts/building-recipes/houses');
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** The installed police station: the draft must find its photographed fronts without being told anything but the pand. */
test('draftLargeIntent: a valid intent whose street groups cover the installed intent\'s street-facing surfaces', () => {
  const id = 'politie-van-leijenberghlaan';
  const facts: BuildingFacts = read(path.join(HOUSES, id, 'facts.json'));
  const installed: LargeBuildingIntent = validateLargeIntent(read(path.join(HOUSES, id, 'intent.json')));
  const {intent, groups, skipped} = draftLargeIntent(facts, {id: 'draft-test', pandId: facts.pandId, crops: [{tag: 'w01-270', panoId: 'x', capturedAt: '2021-05-03'}]});
  assert.equal(intent.kind, 'large');
  assert.equal(intent.walls[0].entrance, true);
  assert.ok(intent.walls.every(w => w.system === 'brick-bay-grid'));
  assert.ok(intent.sources[0].id.startsWith('pano-2021-05-03'));
  // every street-facing group the author wrote shares a 3DBAG surface with some drafted group
  const drafted = new Set(intent.walls.flatMap(w => w.wallSurfaces));
  for (const w of installed.walls.filter(w => w.street && w.system !== 'blank')) {
    assert.ok(w.wallSurfaces.some(s => drafted.has(s)), `installed group on ${w.street} (surfaces ${w.wallSurfaces.join(',')}) has no drafted group`);
  }
  assert.ok(groups.some(g => g.street), 'at least one drafted group names a street');
  assert.ok(groups.length <= 8 && skipped.every(s => s.reason.length > 0));
  // it compiles through the kit as any authored intent does
  const built = compileBuilding(intent, facts);
  assert.ok(built.group);
});

test('draftLargeIntent: without crops the shell is the only source and the note says so', () => {
  const facts: BuildingFacts = read(path.join(HOUSES, 'politie-van-leijenberghlaan', 'facts.json'));
  const {intent} = draftLargeIntent(facts, {id: 'draft-test-2', pandId: facts.pandId});
  assert.equal(intent.sources.length, 1);
  assert.equal(intent.sources[0].kind, 'orthophoto');
  assert.ok(intent.notes!.some(n => n.includes('No archived panorama crop')));
});

test('frontOfPanel: a panel facing away from every front has no street', () => {
  const facts: BuildingFacts = read(path.join(HOUSES, 'politie-van-leijenberghlaan', 'facts.json'));
  const fake = {n: [0, 0, 1], r: [-1, 0, 0], o: [1e6, 0, 1e6], uMin: 0, uMax: 10, vMin: 0, vMax: 9, partyH: 0, index: 0, polys: [], onEdge: false, prev: -1, next: -1, area: 90, walls: []} as never;
  assert.equal(frontOfPanel(fake, facts.fronts, [0, 0]), null);
});
