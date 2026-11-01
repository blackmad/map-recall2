import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { BESPOKE_BRIDGES, bespokeBridge } from './bespokeBridges';
import { registerHint } from './bridgeKit';

const catalogue = JSON.parse(readFileSync('src/canalRecall/landmarks/manualCatalogue.json', 'utf8')) as { id: string; status?: string; modelUrl: string }[];

test('every bespoke bridge is a placed, exported catalogue model', () => {
  for (const [bridge, model] of Object.entries(BESPOKE_BRIDGES)) {
    const spec = catalogue.find(s => s.id === model);
    assert.ok(spec, `${bridge}: catalogue entry ${model}`);
    assert.notEqual(spec!.status, 'held', `${bridge}: ${model} is held, so the kit must draw the bridge`);
    assert.ok(existsSync(`public/canal-drive/models/${model}.glb`), `${bridge}: public/canal-drive/models/${model}.glb exported`);
    assert.ok(registerHint(bridge) || /^BRU\d{4}$/.test(bridge), `${bridge}: a register bridge id`);
  }
});

test('lookups', () => {
  assert.equal(bespokeBridge('BRU0236'), 'blauwbrug');
  assert.equal(bespokeBridge('BRU0009'), null);
  assert.equal(bespokeBridge(undefined), null);
  assert.equal(bespokeBridge('toString'), null);
});
