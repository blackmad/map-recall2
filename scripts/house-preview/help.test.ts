import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HELP, parseArgs, resolveRoute } from './preview.ts';
import { REPO_ROOT } from './nodeDom.ts';

test('docs/house-line.md §2 carries the HELP text and documents every flag', () => {
  const doc = fs.readFileSync(path.join(REPO_ROOT, 'docs/house-line.md'), 'utf8');
  assert.ok(doc.includes(HELP), 'docs/house-line.md must contain the HELP text of scripts/house-preview/preview.ts verbatim');
  for (const flag of HELP.match(/^ {2}--[a-z-]+/gm)!.map(f => f.trim())) assert.doesNotThrow(() => parseArgs(['0363100012164843', flag, ...(flag === '--route' ? ['generic'] : ['--spec', '--intent', '--look', '--ppm', '--out'].includes(flag) ? ['x'] : [])]), flag);
});

test('parseArgs: a .json target is a spec; --recipe takes an optional house id', () => {
  assert.equal(parseArgs(['a/spec.json']).spec, 'a/spec.json');
  assert.equal(parseArgs(['0363100012175702', '--recipe']).recipe, true);
  assert.equal(parseArgs(['--recipe', 'cw-heren-175702', '0363100012175702']).recipe, 'cw-heren-175702');
  assert.equal(parseArgs(['--recipe=cw-heren-175702']).recipe, 'cw-heren-175702');
  assert.throws(() => parseArgs(['--nope']), /unknown flag/);
});

test('routes: the route the game draws by default, --route forces one, a landmark falls back to generic', () => {
  const chunk = { key: 'chunk-face-clercq-236681', kind: 'chunk' as const }, landmark = { key: 'westerkerk', kind: 'landmark' as const };
  assert.equal(resolveRoute(undefined, false, null).route, 'generic');
  assert.equal(resolveRoute(undefined, false, chunk).route, 'installed');
  assert.equal(resolveRoute(undefined, true, chunk).route, 'spec');
  assert.equal(resolveRoute('generic', false, chunk).route, 'generic');
  assert.match(resolveRoute(undefined, false, landmark).why, /landmark westerkerk/);
  assert.equal(resolveRoute(undefined, false, landmark).route, 'generic');
  assert.throws(() => resolveRoute('installed', false, null), /covers no model/);
  assert.throws(() => resolveRoute('installed', false, landmark), /landmark/);
  assert.throws(() => resolveRoute('spec', false, null), /--spec or --intent/);
  assert.equal(parseArgs(['0363100012164843', '--route', 'installed', '--unlit']).route, 'installed');
  assert.equal(parseArgs(['0363100012164843', '--unlit']).unlit, true);
  assert.throws(() => parseArgs(['0363100012164843', '--route', 'landmark']), /generic, spec or installed/);
});
