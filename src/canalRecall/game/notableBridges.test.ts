import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOTABLE_BRIDGES, bridgeNameAskable, isNotableBridge } from './notableBridges.ts';

test('medium asks only the famous bridges; hard asks every bridge', () => {
  assert.equal(bridgeNameAskable('medium', 'Magere Brug'), true);
  assert.equal(bridgeNameAskable('easy', 'Brug 117'), false);
  assert.equal(bridgeNameAskable('medium', 'Bantammerbrug'), false);
  assert.equal(bridgeNameAskable('hard', 'Brug 117'), true);
  assert.equal(bridgeNameAskable('expert', 'Bantammerbrug'), true);
  assert.equal(bridgeNameAskable('custom', 'Brug 117', 'multiple'), false);
  assert.equal(bridgeNameAskable('custom', 'Brug 117', 'typing'), true);
  assert.equal(isNotableBridge('magere  brug '), true);
});

test('every notable bridge exists in the Amsterdam bridge data', () => {
  const raw = JSON.parse(readFileSync(new URL('../../../public/data/extracts/amsterdam/bridges.json', import.meta.url), 'utf8'));
  const bridges: Array<{ name: string }> = Array.isArray(raw) ? raw : raw.bridges;
  const names = new Set(bridges.map(bridge => bridge.name));
  for (const name of NOTABLE_BRIDGES) assert.ok(names.has(name), `${name} is not a bridge in bridges.json`);
});
