import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DRAFT_PALETTE, draftBudgetCap, draftLargeIntent, draftWallPrior, factoryMayWrite, factoryMeasureArgs, frontOfPanel, inheritedWall, isDraftIntent} from './draftLarge.ts';
import {PERIOD_PRIORS, UNKNOWN_WALL_HEX} from '../look/palette.ts';
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

test('draftLargeIntent: the wall starts at the era default, never the orange placeholder, and the intent is marked drafted', () => {
  const facts: BuildingFacts = read(path.join(HOUSES, 'politie-van-leijenberghlaan', 'facts.json'));
  const {intent} = draftLargeIntent(facts, {id: 'draft-test-3', pandId: facts.pandId});
  assert.equal(intent.draftedBy, 'factory');
  assert.notEqual(intent.palette.brick, DRAFT_PALETTE.brick);
  assert.equal(intent.palette.brick, draftWallPrior(facts));
  assert.equal(draftWallPrior({heights: {...facts.heights, builtYear: 1968}}), PERIOD_PRIORS.modern.wall.toLowerCase());
  assert.equal(draftWallPrior({heights: {...facts.heights, builtYear: 1925}}), PERIOD_PRIORS.school.wall.toLowerCase());
  assert.equal(draftWallPrior({heights: {...facts.heights, builtYear: null}}), UNKNOWN_WALL_HEX.toLowerCase());
});

test('inheritedWall: area-weighted median of the photographed walls, stucco only when most resolved area is not brick', () => {
  assert.equal(inheritedWall([]), null);
  // three grey walls outweigh one small orange one: the median by area is a grey, a measured colour (no mix)
  const greys = inheritedWall([{hex: '#757c82', family: 'paint', areaM2: 400}, {hex: '#666051', family: 'brick', areaM2: 100}, {hex: '#b05a40', family: 'brick', areaM2: 50}, {hex: '#8c9496', family: 'paint', areaM2: 300}]);
  assert.ok(greys && ['#757c82', '#8c9496'].includes(greys.brick), JSON.stringify(greys));
  assert.equal(greys!.wallMaterial, 'stucco');
  // dark unresolved walls (overcast brick or black paint) decide the colour but not the family
  const dark = inheritedWall([{hex: '#312b24', family: 'unresolved', areaM2: 500}, {hex: '#78726d', family: 'brick', areaM2: 100}]);
  assert.deepEqual(dark, {brick: '#312b24', wallMaterial: 'brick'});
});

test('draftBudgetCap: blanks unphotographed groups, costliest first and the entrance last, never a measured group', () => {
  const costs = [
    {group: 0, cost: 3000, measured: false, entrance: true}, {group: 1, cost: 9000, measured: true, entrance: false},
    {group: 2, cost: 4500, measured: false, entrance: false}, {group: 3, cost: 800, measured: false, entrance: false}, {group: 4, cost: 1200, measured: false, entrance: false},
  ];
  assert.deepEqual(draftBudgetCap(costs, 11000, 12000), {blank: [], over: 0});
  assert.deepEqual(draftBudgetCap(costs, 18000, 12000), {blank: [2, 4, 3], over: 0});
  assert.deepEqual(draftBudgetCap(costs, 19000, 12000), {blank: [2, 4, 3, 0], over: 0});
  assert.deepEqual(draftBudgetCap(costs, 30000, 12000), {blank: [2, 4, 3, 0], over: 8500});
});

test('factory write guard: hand-authored intents are read-only; drafts and new houses are the factory\'s', () => {
  for (const id of ['metis-montessori-080098', 'oostpoort-montessori-080630', 'politie-west-overtoomsesluis', 'amsterdams-lyceum', 'plantage-middenlaan-52-186093', 'politie-van-leijenberghlaan']) {
    const intent = read(path.join(HOUSES, id, 'intent.json'));
    assert.equal(isDraftIntent(intent), false, id);
    assert.equal(factoryMayWrite(intent), false, id);
    const args = factoryMeasureArgs(id, intent);
    assert.ok(!args.includes('--write'), `${id}: measure must not --write a hand-authored intent`);
    assert.ok(args.some(a => a === `--measured-out=artifacts/building-recipes/${id}/measured.json`), `${id}: measured.json goes to artifacts/`);
  }
  const facts: BuildingFacts = read(path.join(HOUSES, 'politie-van-leijenberghlaan', 'facts.json'));
  const {intent} = draftLargeIntent(facts, {id: 'draft-test-4', pandId: facts.pandId});
  assert.equal(factoryMayWrite(intent), true);
  assert.equal(factoryMayWrite(null), true);
  assert.deepEqual(factoryMeasureArgs('draft-test-4', intent), ['--house=draft-test-4', '--write']);
  // batch 1 drafts carry only the note
  assert.equal(isDraftIntent({notes: ['Drafted by draftLarge.ts from the 3DBAG panels: ...']}), true);
  // the marker is validated
  assert.throws(() => validateLargeIntent({...intent, draftedBy: 'someone'} as never), /draftedBy/);
});
