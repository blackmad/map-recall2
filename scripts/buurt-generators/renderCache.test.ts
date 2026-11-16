// The sheet's render cache key (centrum-looks round 3): a regenerated staged row-front must give a new key, so a sheet
// never shows the previous run's renders (round 2's first re-judge sheets showed round-1 walls).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderCacheKey } from './renderCache.ts';

test('the key follows the input bytes and the options, and nothing else', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-cache-')), f = path.join(dir, 'row-front.json');
  try {
    fs.writeFileSync(f, '{"records":[1]}');
    const k1 = renderCacheKey([f], ['40']);
    assert.equal(renderCacheKey([f], ['40']), k1, 'same bytes, same options: same key');
    assert.notEqual(renderCacheKey([f], ['41']), k1, 'another ppm: another key');
    fs.writeFileSync(f, '{"records":[2]}');
    assert.notEqual(renderCacheKey([f], ['40']), k1, 'regenerated row-front: another key');
    fs.rmSync(f);
    assert.match(renderCacheKey([f]), /^[0-9a-f]{12}$/, 'a missing input still keys');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
