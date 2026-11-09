// Asserted bundle-size caps. Until 2026-11-09 the landing bundle's 80 KiB cap
// was a note on TODO.md; #301 took it to 80,506 B and nobody would have noticed
// the day it crossed. A cap here fails the gate instead. Raise a cap only with
// a HISTORY entry saying what grew and why.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';

const KIB = 1024;
const CAPS = {
  // The landing page is the first thing a returning player downloads.
  'public/canal-drive/js/landing.bundle.js': 80 * KIB,
};

for (const [file, cap] of Object.entries(CAPS)) {
  test(`${file} stays under ${cap / KIB} KiB`, () => {
    const size = statSync(file).size;
    assert.ok(size <= cap, `${file} is ${size} B (${(size / KIB).toFixed(1)} KiB), cap ${cap} B`);
  });
}
