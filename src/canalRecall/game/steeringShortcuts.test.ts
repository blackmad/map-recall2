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

/** Keys a one-letter label names, read as `KeyX` codes. */
const letterCodes = (labels: string[]) => labels.filter(label => /^[A-Z]$/.test(label)).map(label => `Key${label}`);

test('the desktop hints bar names only keys that do what it says (#24, G7)', () => {
  const runtime = readFileSync(new URL('./presentationRuntime.ts', import.meta.url), 'utf8');
  const line = runtime.match(/const text = '(\?  help[^']*)'/);
  assert.ok(line, 'hints bar text');
  const pairs = line[1].split('·').map(part => part.trim().split(/\s+/));
  const labels = Object.fromEntries(pairs.map(([key, ...words]) => [key, words.join(' ')]));
  assert.equal(labels.T, 'labels', 'T toggles road-name labels');
  const steering = steeringCodes(read('player.js'));
  const game = read('game.js');
  for (const code of letterCodes(Object.keys(labels))) {
    assert.ok(!steering.has(code), `${code} in the hints bar steers`);
    assert.match(game, new RegExp(`wasPressed\\('${code}'\\)`), `${code} in the hints bar is bound in game.js`);
  }
});

test('the Help key tables list no unbound one-letter key (no Sound: the game has no audio)', () => {
  const html = readFileSync(new URL('../index.html', root), 'utf8');
  const help = html.slice(html.indexOf('class="help-pointer help-keys"'));
  const keys = [...help.slice(0, help.indexOf('</details>')).matchAll(/<tr><td>([A-Z])<\/td>/g)].map(m => m[1]);
  assert.ok(keys.length >= 4, 'help key table found');
  const game = read('game.js');
  for (const code of letterCodes(keys)) assert.match(game, new RegExp(`wasPressed\\('${code}'\\)`), `${code} in Help is bound`);
  assert.doesNotMatch(help, /help\.sound/);
});
