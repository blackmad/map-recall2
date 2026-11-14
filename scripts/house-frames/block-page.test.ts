/** house:block-page (lane 3): the row list from the faces, the number readers, the ground-band control. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { groundDiff, numbersFrom, rowsFromFaces, DEFAULT_FACES } from './block-page.ts';

test('rows: the default faces hold the five named pands, left to right, no repeats', () => {
  const rows = rowsFromFaces(DEFAULT_FACES);
  const all = rows.groups.flatMap(g => g.pands);
  for (const id of ['0363100012165073', '0363100012169539', '0363100012167816', '0363100012167818', '0363100012171144']) assert.ok(all.includes(id), id);
  assert.equal(new Set(all).size, all.length);
  assert.equal(rows.groups[0].pands[0], '0363100012177585');
});

test('numbers: nested game/photo records and flat keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'block-page-'));
  const a = path.join(dir, 'a.json'), b = path.join(dir, 'b.json');
  fs.writeFileSync(a, JSON.stringify({ fronts: [{ pandId: 'NL.IMBAG.Pand.0363100012165073', photo: { frontTopM: 12.1, storeys: 4, crown: 'spout' }, game: { frontTopM: 11.4, storeys: 3, crown: { family: 'cornice' } } }] }));
  fs.writeFileSync(b, JSON.stringify([{ pandId: '0363100012169539', gameStoreys: 5, photoStoreys: 4 }]));
  const n = numbersFrom([a, b, path.join(dir, 'missing.json')]);
  assert.deepEqual(n.get('0363100012165073')?.frontTopM, { game: 11.4, photo: 12.1, source: 'a.json' });
  assert.equal(n.get('0363100012165073')?.crown?.game, 'cornice');
  assert.deepEqual(n.get('0363100012169539')?.storeys, { game: 5, photo: 4, source: 'b.json' });
});

test('ground diff: identical frames are controlled, a changed ground band is not', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'block-page-'));
  const mk = async (f: string, ground: string) => sharp({ create: { width: 200, height: 100, channels: 3, background: '#88aadd' } })
    .composite([{ input: { create: { width: 200, height: 20, channels: 3, background: ground } }, top: 80, left: 0 }]).png().toFile(path.join(dir, f));
  await mk('a.png', '#777777'); await mk('b.png', '#777777'); await mk('c.png', '#bb5544');
  assert.equal((await groundDiff(path.join(dir, 'a.png'), path.join(dir, 'b.png'))).changedPct, 0);
  assert.ok((await groundDiff(path.join(dir, 'a.png'), path.join(dir, 'c.png'))).changedPct > 90);
});
