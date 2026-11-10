import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HELP, parseArgs } from './preview.ts';
import { REPO_ROOT } from './nodeDom.ts';

test('docs/house-line.md §2 carries the HELP text and documents every flag', () => {
  const doc = fs.readFileSync(path.join(REPO_ROOT, 'docs/house-line.md'), 'utf8');
  assert.ok(doc.includes(HELP), 'docs/house-line.md must contain the HELP text of scripts/house-preview/preview.ts verbatim');
  for (const flag of HELP.match(/^ {2}--[a-z-]+/gm)!.map(f => f.trim())) assert.doesNotThrow(() => parseArgs(['0363100012164843', flag, ...(['--spec', '--intent', '--look', '--ppm', '--out'].includes(flag) ? ['x'] : [])]), flag);
});

test('parseArgs: a .json target is a spec; --recipe takes an optional house id', () => {
  assert.equal(parseArgs(['a/spec.json']).spec, 'a/spec.json');
  assert.equal(parseArgs(['0363100012175702', '--recipe']).recipe, true);
  assert.equal(parseArgs(['--recipe', 'cw-heren-175702', '0363100012175702']).recipe, 'cw-heren-175702');
  assert.equal(parseArgs(['--recipe=cw-heren-175702']).recipe, 'cw-heren-175702');
  assert.throws(() => parseArgs(['--nope']), /unknown flag/);
});
