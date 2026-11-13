// F1 finish hint (#380): Jev's render hint for the record's wall material (look/finishHint.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFinishHintFile, finishHintEnabled, finishHintFromJev, parseFinishHints, FinishHintTable, FINISH_HINT_DEFAULT } from './finishHint.ts';
import { recordWallMaterial } from '../threeBuildingMesh.ts';

test('F1 finish hint: only plaster at confidence >= 0.7 is a hint; painted brick and brick are ignored', () => {
  assert.deepEqual(finishHintFromJev({ choice: 'plaster', confidence: 0.7 }), { value: 'render', source: 'jev', conf: 0.7 });
  assert.equal(finishHintFromJev({ choice: 'plaster', confidence: 0.69 }), null);
  assert.equal(finishHintFromJev({ choice: 'painted brick', confidence: 0.99 }), null);
  assert.equal(finishHintFromJev({ choice: 'brick', confidence: 0.99 }), null);
  assert.equal(finishHintFromJev({ choice: 'stone', confidence: 0.9 }), null);
  assert.equal(finishHintFromJev(null), null);
});
test('F1 finish hint: the flag defaults off; ?finishHint=1 turns it on', () => {
  assert.equal(FINISH_HINT_DEFAULT, false);
  assert.equal(finishHintEnabled('', {}), false);
  assert.equal(finishHintEnabled('?shaderFacades=1&finishHint=1', {}), true);
  assert.equal(finishHintEnabled('?finishHint=0', { __canalRecallFinishHint: true }), false);
});
test('F1 finish hint: the file keeps only in-scope pands above the bar, keyed by full BAG id, and round-trips', () => {
  const answers = { '0363100012174333': { choice: 'plaster', confidence: 0.98 }, '0363100012168644': { choice: 'plaster', confidence: 0.5 }, '0363100012000001': { choice: 'plaster', confidence: 0.9 }, '0363100012000002': { choice: 'painted brick', confidence: 0.9 } };
  const file = buildFinishHintFile(answers, id => id !== 'NL.IMBAG.Pand.0363100012000001');
  assert.deepEqual(Object.keys(file.hints), ['NL.IMBAG.Pand.0363100012174333']);
  const t = parseFinishHints(JSON.parse(JSON.stringify(file)));
  assert.deepEqual(t.get('NL.IMBAG.Pand.0363100012174333'), { value: 'render', source: 'jev', conf: 0.98 });
  assert.equal(parseFinishHints({ version: 2, hints: {} }).size, 0);
  assert.equal(parseFinishHints({ version: 1, source: 'jev', hints: { a: { value: 'render', conf: 0.4 } } }).size, 0);
});
test('F1 finish hint: the hint ranks below the register finish, and absent changes nothing', () => {
  const hint = { value: 'render', source: 'jev', conf: 0.9 } as const;
  assert.deepEqual(recordWallMaterial({}), {});
  assert.deepEqual(recordWallMaterial({}, undefined), {});
  assert.deepEqual(recordWallMaterial({}, hint), { wallMaterial: 'stucco', wallMaterialSrc: 1 });
  assert.deepEqual(recordWallMaterial({ registerFinish: 'brick' }, hint), { wallMaterial: 'brick', wallMaterialSrc: 1 });
  assert.deepEqual(recordWallMaterial({ registerFinish: 'light' }, hint), { wallMaterial: 'stucco', wallMaterialSrc: 1 });
});
test('F1 finish hint: the worker table fetches once and a failed read is empty', async () => {
  let n = 0;
  const ok = new FinishHintTable('x', (async () => { n++; return new Response(JSON.stringify({ version: 1, source: 'jev', question: 'finish', minConf: 0.7, hints: { 'NL.IMBAG.Pand.1': { value: 'render', conf: 0.8 } } })); }) as typeof fetch);
  assert.equal((await ok.hintFor())('1')?.conf, 0.8);
  await ok.hintFor(); assert.equal(n, 1);
  const bad = new FinishHintTable('x', (async () => { throw Error('net'); }) as typeof fetch);
  assert.equal((await bad.hintFor())('1'), undefined);
});
