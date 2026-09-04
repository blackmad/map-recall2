import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

// A typed subsystem ships as source plus a generated bundle, so the page can
// now disagree with the code under review. Rebuilding each one and comparing
// bytes is what keeps "it typechecks" and "it is what the browser runs" the
// same statement.
//
// The build command is read out of package.json rather than repeated here:
// each bundle has its own flags (global name, minification), and a second copy
// of them would drift and then silently compare the wrong thing.
const generatedBundles = [
  'js/game-landmarks.bundle.js',
  'js/game-recall.bundle.js',
  'js/route-selection.bundle.js',
  'js/game-presentation.bundle.js',
  'js/preferences.bundle.js',
  'js/overlay.bundle.js',
];

const packageScripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts;

function esbuildArgsFor(bundle) {
  const marker = `--outfile=public/canal-drive/${bundle}`;
  const script = Object.values(packageScripts).find(
    value => value.startsWith('esbuild ') && value.includes(marker));
  assert(script, `no npm script builds ${bundle}; add one so it cannot be built by hand`);
  return script.slice('esbuild '.length).split(/\s+/);
}

function assertBundleIsCurrent(bundle) {
  const args = esbuildArgsFor(bundle);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'canal-decomp-'));
  const rebuilt = path.join(scratch, path.basename(bundle));
  try {
    execFileSync('npx', ['esbuild', ...args].map(arg =>
      arg.startsWith('--outfile=') ? `--outfile=${rebuilt}` : arg), { stdio: 'pipe' });
    assert.equal(
      fs.readFileSync(path.join(root, bundle), 'utf8'),
      fs.readFileSync(rebuilt, 'utf8'),
      `${bundle} is stale; rebuild it in the same change as its source`,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

const root = path.resolve('public/canal-drive');
// Subsystems migrate from hand-written JavaScript to a typed module plus its
// generated bundle one at a time, so both spellings appear here during the
// migration. A `.bundle.js` entry is generated from `src/canalRecall/game/`
// and must be rebuilt in the same change as its source.
const runtimeFiles = [
  'js/game-landmarks.bundle.js',
  'js/game-recall.bundle.js',
  'js/game-route.js',
  'js/game-presentation.bundle.js',
];
const gameFile = 'js/game.js';
// Typed leaves the subsystems call through. They are loaded into the sandbox
// first so that installing a subsystem exercises the same globals the page has.
const dependencyBundles = ['js/route-selection.bundle.js', 'js/preferences.bundle.js'];
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let previousIndex = -1;
for (const file of [
  'js/preferences.bundle.js',
  'js/overlay.bundle.js',
  ...runtimeFiles,
  gameFile,
]) {
  // Match the path, not the whole attribute: several tags carry a
  // cache-busting `?v=` suffix, and an exact match silently returns -1, which
  // reads as "loaded before everything" rather than as a missing script.
  const scriptIndex = index.search(new RegExp(`src="${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?[^"]*)?"`));
  assert(scriptIndex >= 0, `${file} is not loaded by index.html`);
  assert(scriptIndex > previousIndex, `${file} must load after its dependencies`);
  previousIndex = scriptIndex;
}

const gameLines = fs.readFileSync(path.join(root, gameFile), 'utf8').split('\n').length;
assert(gameLines < 800, `game.js grew back to ${gameLines} lines; keep subsystems separate`);

for (const bundle of generatedBundles) assertBundleIsCurrent(bundle);

const loadCallbacks = [];
const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  window: {
    addEventListener(type, callback) {
      if (type === 'load') loadCallbacks.push(callback);
    },
  },
});
context.window.window = context.window;

for (const file of [...dependencyBundles, ...runtimeFiles]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

// An esbuild `--global-name` IIFE declares a top-level `var`, which in a vm
// context lands on the sandbox global directly — the same way the page sees it.
assert(context.CanalRecallRoute, 'route-selection bundle did not publish its global');
assert(context.CanalRecallPreferences, 'preferences bundle did not publish its global');
// Classic scripts put `var` globals on `window`; the vm keeps them on the
// sandbox global instead, so mirror the page before evaluating game.js.
context.window.CanalRecallPreferences = context.CanalRecallPreferences;
context.window.CanalRecallRoute = context.CanalRecallRoute;

const modules = context.window.CanalRecallGameModules;
assert.equal(modules.length, runtimeFiles.length, 'every runtime file must register one module');
const owners = new Map();
const staticOwners = new Map();
for (const RuntimeModule of modules) {
  for (const name of Object.getOwnPropertyNames(RuntimeModule.prototype)) {
    if (name === 'constructor') continue;
    assert(!owners.has(name), `${name} is owned by both ${owners.get(name)} and ${RuntimeModule.name}`);
    owners.set(name, RuntimeModule.name);
  }
  for (const name of Object.getOwnPropertyNames(RuntimeModule)) {
    if (['length', 'name', 'prototype'].includes(name)) continue;
    assert(!staticOwners.has(name), `${name} is owned by both ${staticOwners.get(name)} and ${RuntimeModule.name}`);
    staticOwners.set(name, RuntimeModule.name);
  }
}

vm.runInContext(fs.readFileSync(path.join(root, gameFile), 'utf8'), context, { filename: gameFile });
const gameMethods = vm.runInContext('Object.getOwnPropertyNames(Game.prototype)', context);
for (const [name, owner] of owners) {
  assert(gameMethods.includes(name), `${owner}.${name} was not installed on Game`);
}
const gameStatics = vm.runInContext('Object.getOwnPropertyNames(Game)', context);
for (const [name, owner] of staticOwners) {
  assert(gameStatics.includes(name), `${owner}.${name} was not installed on Game`);
}
assert.equal(vm.runInContext('Game._kmBetween({ lat: 52, lng: 4 }, { lat: 52, lng: 4 })', context), 0,
  'route distance helper must be callable through Game');
assert.equal(vm.runInContext(`(() => {
  const game = Object.create(Game.prototype);
  game.routeFrom = { id: 'origin' };
  game.routePois = [{ id: 'nearby', lat: 52.001, lng: 4.001 }];
  return game._pickDestinationNear({ id: 'start', lat: 52, lng: 4 })?.id;
})()`, context), 'nearby', 'route destination selection must retain its static dependencies');
assert.equal(loadCallbacks.length, 1, 'game.js should register exactly one startup callback');

console.log(`Game decomposition OK: ${gameLines} core lines, ${owners.size} instance and ${staticOwners.size} static subsystem methods.`);
