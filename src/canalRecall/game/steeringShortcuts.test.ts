import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Issue #24: W steers (public/canal-drive/js/player.js maps WASD onto the
// arrows) and also opened the on-screen landmark's Wikipedia page; D steered
// right and toggled road-name labels. A one-shot shortcut must never share a
// key with steering.
const root = new URL('../../../public/canal-drive/js/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');

/** Key codes player.js reads as steering, from its `keyboard` block. */
function steeringCodes(player: string): Set<string> {
  const block = player.match(/const keyboard = \{([\s\S]*?)\};/);
  assert.ok(block, 'player.js keyboard block');
  return new Set([...block[1].matchAll(/isDown\('([A-Za-z]+)'\)/g)].map(m => m[1]));
}

test('player.js steers with the arrows and WASD', () => {
  const codes = steeringCodes(read('player.js'));
  for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    assert.ok(codes.has(code), `${code} steers`);
  }
});

test('no game.js shortcut fires on a steering key', () => {
  const codes = steeringCodes(read('player.js'));
  const game = read('game.js');
  const clashes = [...game.matchAll(/wasPressed\('([A-Za-z]+)'\)/g)].map(m => m[1]).filter(code => codes.has(code));
  assert.deepEqual(clashes, [], `shortcuts on steering keys: ${clashes.join(', ')}`);
});

test('the landmark article and road labels have their own keys', () => {
  const game = read('game.js');
  assert.match(game, /wasPressed\('KeyE'\)\) this\._openLandmarkArticle\(\)/);
  assert.match(game, /wasPressed\('KeyT'\)\) this\.vectorMap\.toggleLabels\(\)/);
});
