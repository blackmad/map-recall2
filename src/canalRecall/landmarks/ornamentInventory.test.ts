import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {INVENTORY_REQUIRED_AFTER, inventoryRequired, inventoryRows, matchWall, missScore, validateInventory, type LandmarkInventory} from './ornamentInventory';

const ROOT = path.resolve(import.meta.dirname, '../../..');

function inv(over: Partial<LandmarkInventory> = {}): LandmarkInventory {
  return {
    schemaVersion: 1, id: 'x', signature: ['arms'],
    walls: [{tag: 'w01-337', bearing: 337, lengthM: 13.9, centre: [4.8778, 52.3686], evidence: 'photo', panoId: 'p1', checked: true, items: [
      {id: 'arms', kind: 'relief', where: 'upper centre', approxSizeM: [11, 5], plan: 'modelled', how: 'hand', seenIn: 'p1'},
      {id: 'verse', kind: 'lettering', where: 'banner', approxSizeM: [6, 0.5], plan: 'skipped', skip: {reason: 'too-small', note: 'unreadable 10 m up'}, seenIn: 'p1'},
    ]}],
    ...over,
  };
}
const kinds = (issues: ReturnType<typeof validateInventory>) => issues.map(i => `${i.severity} ${i.path}`);

test('a resolved inventory passes the export gate', () => {
  assert.deepEqual(validateInventory(inv(), {gate: true, id: 'x'}), []);
});

test('the Hoofdbureau miss: the arms relief left open or skipped as "cannot express" is refused', () => {
  const open = inv();
  open.walls[0].items[0].plan = 'open';
  assert.ok(kinds(validateInventory(open, {gate: true})).includes('gate walls[0](w01-337).items[0](arms).plan'));
  assert.ok(kinds(validateInventory(open, {gate: true})).includes('gate signature(arms)'), 'a signature item must be modelled or simplified');
  const excuse = inv();
  excuse.walls[0].items[1].skip = {reason: 'too-small', note: 'the facade systems cannot express it'};
  assert.ok(validateInventory(excuse).some(i => i.severity === 'error' && /not a reason/.test(i.message)));
  const noComponent = inv();
  noComponent.walls[0].items[1].skip = {reason: 'not-visible', note: 'no component for reliefs'};
  assert.ok(validateInventory(noComponent).some(i => /not a reason/.test(i.message)));
});

test('gate rules bind only with gate: true; schema errors always', () => {
  const x = inv({signature: []});
  x.walls[0].checked = false;
  x.walls[0].items[1].skip = {reason: 'needs-modeller', note: 'figure group'};
  assert.deepEqual(validateInventory(x).filter(i => i.severity === 'error'), []);
  const gated = kinds(validateInventory(x, {gate: true}));
  for (const p of ['gate walls[0](w01-337).checked', 'gate signature', 'gate walls[0](w01-337).items[1](verse).skip.reason']) assert.ok(gated.includes(p), p);
  const bad = inv();
  (bad.walls[0].items[0] as {kind: string}).kind = 'gargoyle';
  bad.walls[0].items[1].id = 'arms';
  bad.walls[0].items[0].plan = 'simplified';
  delete bad.walls[0].items[0].how;
  const errs = kinds(validateInventory(bad));
  assert.ok(errs.includes('error walls[0](w01-337).items[0](arms).kind'));
  assert.ok(errs.includes('error walls[0](w01-337).items[1](arms).id'));
  assert.ok(errs.includes('error walls[0](w01-337).items[0](arms).how'));
});

test('which landmarks the gate binds', () => {
  assert.equal(inventoryRequired('new-landmark', undefined), true, 'never exported = new');
  assert.equal(inventoryRequired('later', '2026-10-20T10:00:00+02:00'), true);
  assert.equal(inventoryRequired('old', '2026-10-13T15:31:43+02:00'), false);
  assert.equal(Date.parse(INVENTORY_REQUIRED_AFTER), Date.parse('2026-10-14T00:00:00+02:00'));
});

test('rows, miss score and wall matching', () => {
  const rows = inventoryRows(inv());
  assert.equal(rows.length, 2);
  assert.equal(rows[0].signature, true);
  assert.match(rows[1].detail, /too-small/);
  const it = inv().walls[0].items[0];
  assert.ok(missScore(it, true) > missScore(it, false));
  const walls = [{...inv().walls[0]}, {...inv().walls[0], tag: 'w02-337', centre: [4.8770, 52.3684] as [number, number]}];
  assert.equal(matchWall(walls, 340, [4.87701, 52.36841])?.tag, 'w02-337');
  assert.equal(matchWall(walls, 160, [4.87701, 52.36841]), undefined);
  assert.equal(matchWall(walls, 337, [4.89, 52.37]), undefined, 'same bearing, another block');
});

test('committed inventories validate (schema)', () => {
  const dir = path.join(ROOT, 'scripts/landmarks');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('-inventory.json') && f !== 'ornament-inventory.json')) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!('signature' in raw)) continue; // other lanes' *-inventory.json files
    assert.deepEqual(validateInventory(raw, {id: f.replace(/-inventory\.json$/, '')}).filter(i => i.severity === 'error'), [], f);
  }
  const survey = path.join(dir, 'ornament-inventory.json');
  if (fs.existsSync(survey)) for (const [id, l] of Object.entries(JSON.parse(fs.readFileSync(survey, 'utf8')).landmarks as Record<string, LandmarkInventory>)) {
    assert.deepEqual(validateInventory(l, {id}).filter(i => i.severity === 'error'), [], id);
  }
});

test('Hoofdbureau worked example: the end-wall relief is inventoried, modelled and a signature item', () => {
  const h = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/landmarks/hoofdbureau-elandsgracht-inventory.json'), 'utf8')) as LandmarkInventory;
  const end = h.walls.find(w => w.items.some(i => i.id === 'n-arms-relief'))!;
  assert.ok(end.lengthM < 14, 'the 13.9 m wall the stock --min-len=14 dropped');
  assert.equal(end.items.find(i => i.id === 'n-arms-relief')!.plan, 'modelled');
  assert.ok(h.signature.includes('n-arms-relief'));
});
