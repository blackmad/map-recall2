import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { HELP, WRITERS, jevImage, parseArgs } from './describe.ts';
import { agrees, tabulate, valueOf } from './agreement.ts';
import { emptySpec, setSpecField } from '../../src/canalRecall/houseSpec/spec.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

test('docs/house-line.md §4b carries the HELP text of describe.ts, and every flag it lists parses', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs/house-line.md'), 'utf8');
  assert.ok(doc.includes(HELP), 'docs/house-line.md must contain the HELP text of scripts/house-specs/describe.ts verbatim');
  for (const flag of HELP.match(/^ {2}--[a-z-]+/gm)!.map(f => f.trim())) assert.ok(HELP.includes(flag));
  for (const w of WRITERS) assert.ok(HELP.includes(`  ${w} `), w);
});

test('parseArgs: a pand id or a buurt, writers, budgets and the defaults', () => {
  const d = parseArgs(['--buurt', 'AB07']);
  assert.equal(d.buurt, 'AB07'); assert.equal(d.pand, null); assert.deepEqual(d.writers, ['register', 'bag', 'pixel', 'jev']);
  assert.equal(d.jevBudget, 2); assert.equal(d.jevBuurtBudget, 3); assert.equal(d.goodThreshold, 0.5); assert.equal(d.dryRun, false);
  const p = parseArgs(['NL.IMBAG.Pand.0363100012164995', '--writers', 'register,bag', '--jev-budget-usd', '0.5', '--dry-run', '--stage']);
  assert.equal(p.pand, '0363100012164995'); assert.deepEqual(p.writers, ['register', 'bag']); assert.equal(p.jevBudget, 0.5); assert.ok(p.dryRun && p.stage);
  assert.throws(() => parseArgs(['--buurt', 'AB07', '--writers', 'oracle']), /unknown writer/);
});

test('jevImage: a normal crop is scaled into Jev\'s 300-1400 px band, a narrow one is padded, a sliver is refused', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-image-'));
  const make = async (w: number, h: number) => { const f = path.join(dir, `${w}x${h}.jpg`); await sharp({ create: { width: w, height: h, channels: 3, background: '#a06040' } }).jpeg().toFile(f); return f; };
  const ok = (await jevImage(await make(820, 956)))!, meta = await sharp(ok.jpg).metadata();
  assert.equal(ok.padded, false); assert.ok(Math.min(meta.width!, meta.height!) >= 300 && Math.max(meta.width!, meta.height!) <= 1400, `${meta.width}x${meta.height}`);
  const narrow = (await jevImage(await make(150, 900)))!, nm = await sharp(narrow.jpg).metadata();
  assert.equal(narrow.padded, true); assert.ok(Math.min(nm.width!, nm.height!) >= 280, `${nm.width}x${nm.height}`);
  assert.equal(await jevImage(await make(20, 900)), null, 'a 20 px sliver cannot be sent');
  fs.rmSync(dir, { recursive: true });
});

test('agreement: values compare per field, a wall colour within HSL lightness 0.12 agrees, hand-less fields are not counted', () => {
  const hand = emptySpec('0363100012164995'); setSpecField(hand, 'fronts/0/bays', 3); setSpecField(hand, 'fronts/0/gable', 'neck'); setSpecField(hand, 'palette/brick', 'red-brown');
  const w = emptySpec('0363100012164995'); setSpecField(w, 'fronts/0/bays', 3); setSpecField(w, 'fronts/0/gable', 'bell'); setSpecField(w, 'palette/brick', '#7a4030');
  assert.equal(valueOf(hand, 'bays'), 3);
  assert.ok(agrees('wall', 'red-brown', '#7a4030'), 'a swatch name resolves to its hex');
  assert.ok(!agrees('wall', '#222222', '#aaaaaa'));
  const t = tabulate([{ hand, writers: { jev: w, register: null, bag: null, pixel: null }, merged: w }]);
  assert.deepEqual([t.jev.bays.hand, t.jev.bays.written, t.jev.bays.agree], [1, 1, 1]);
  assert.deepEqual([t.jev.gable.written, t.jev.gable.agree, t.jev.gable.precision], [1, 0, 0]);
  assert.equal(t.jev.finish.hand, 0); assert.equal(t.jev.finish.precision, null);
  assert.equal(t.register.bays.written, 0);
});
