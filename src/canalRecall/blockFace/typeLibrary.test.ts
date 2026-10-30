/**
 * Shared house-type library (blockFace/typeLibrary.ts): ids in a face's `types` resolve through a loader, inline and
 * library types may not share an id, and the library entries De Clercqstraat uses resolve to what it once inlined.
 *   node --import tsx --test src/canalRecall/blockFace/typeLibrary.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {houseIntents, resolveFaceTypes, validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {fileTypeLoader, mapTypeLoader, resolveTypeList, TYPE_LIBRARY_DIR} from './typeLibrary.ts';
import type {HouseTypeIntent} from './houseType.ts';

const face = (id: string): BlockFaceIntent => JSON.parse(fs.readFileSync(path.join('scripts/block-face/faces', id, 'intent.json'), 'utf8'));
const members = (id: string): string[] => JSON.parse(fs.readFileSync(path.join('scripts/block-face/faces', id, 'discovery.json'), 'utf8')).members;
const stub = (id: string): HouseTypeIntent => ({schemaVersion: 1, kind: 'house-type', id} as HouseTypeIntent);

test('De Clercqstraat references its three types by id; the file loader resolves them with district and evidence', () => {
  const f = face('clercq-236681');
  assert.deepEqual(f.types, ['clercq-e-corbel-brick', 'clercq-f-stucco-mansard', 'clercq-nassaukade-corner']);
  const types = resolveFaceTypes(f, fileTypeLoader());
  assert.deepEqual(types.map(t => t.id), f.types);
  for (const t of types) { assert.equal((t as any).district, 'oud-west'); assert.ok(t.evidence.length); }
  validateBlockFace(f, members('clercq-236681'));
  assert.equal(houseIntents(f).length, f.houses.length);
});

test('the default loader is the filesystem library; an unknown id is a validation problem, not a crash', () => {
  assert.ok(fs.existsSync(path.join(TYPE_LIBRARY_DIR, 'oud-west', 'clercq-e-corbel-brick.json')));
  const f = {...face('clercq-236681'), types: ['clercq-e-corbel-brick', 'no-such-type']};
  assert.throws(() => validateBlockFace(f, members('clercq-236681')), /library type "no-such-type" not found/);
});

test('duplicate ids across inline and library types are an error, however they are mixed', () => {
  const lib = mapTypeLoader([stub('a')]);
  assert.deepEqual(resolveTypeList(['a'], lib).problems, []);
  assert.match(resolveTypeList(['a', 'a'], lib).problems[0], /duplicate type id a/);
  assert.match(resolveTypeList([stub('a'), 'a'], lib).problems[0], /duplicate type id a/);
  assert.match(resolveTypeList(['a', stub('a')], lib).problems[0], /duplicate type id a/);
  assert.match(resolveTypeList([stub('b'), stub('b')], lib).problems[0], /duplicate type id b/);
  // through validateBlockFace: the inline copy of a library type
  const f = face('clercq-236681');
  const inline = resolveFaceTypes(f)[0];
  assert.throws(() => validateBlockFace({...f, types: [inline, ...f.types!]}, members('clercq-236681')), /duplicate type id clercq-e-corbel-brick/);
});

test('fileTypeLoader checks the file against its path and finds nothing for malformed ids', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'types-'));
  fs.mkdirSync(path.join(dir, 'd1')); fs.mkdirSync(path.join(dir, 'd2'));
  fs.writeFileSync(path.join(dir, 'd1', 'x.json'), JSON.stringify({...stub('x'), district: 'd1'}));
  fs.writeFileSync(path.join(dir, 'd1', 'wrong-id.json'), JSON.stringify({...stub('other'), district: 'd1'}));
  fs.writeFileSync(path.join(dir, 'd1', 'wrong-district.json'), JSON.stringify({...stub('wrong-district'), district: 'd2'}));
  fs.writeFileSync(path.join(dir, 'd1', 'twice.json'), JSON.stringify({...stub('twice'), district: 'd1'}));
  fs.writeFileSync(path.join(dir, 'd2', 'twice.json'), JSON.stringify({...stub('twice'), district: 'd2'}));
  const load = fileTypeLoader(dir);
  assert.equal(load('x')?.id, 'x');
  assert.equal(load('missing'), undefined);
  assert.equal(load('../x'), undefined);
  assert.throws(() => load('wrong-id'), /has id "other"/);
  assert.throws(() => load('wrong-district'), /must equal its folder "d1"/);
  assert.throws(() => load('twice'), /several districts/);
  assert.match(resolveTypeList(['twice'], load).problems[0], /several districts/);
});

test('every library type names a kit roof material (jordaan types had "tile", which failed every Bloemgrachtbuurt run at compile)', async () => {
  const {ROOF_MATERIALS} = await import('../buildingRecipe/intent.ts');
  const bad: string[] = [];
  for (const district of fs.readdirSync(TYPE_LIBRARY_DIR)) {
    const dir = path.join(TYPE_LIBRARY_DIR, district);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
      const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).roof?.material;
      if (m !== undefined && !(ROOF_MATERIALS as readonly string[]).includes(m)) bad.push(`${district}/${f}: ${m}`);
    }
  }
  assert.deepEqual(bad, []);
});
