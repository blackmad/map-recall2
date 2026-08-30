import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve('public/canal-drive');
const runtimeFiles = [
  'js/game-landmarks.js',
  'js/game-recall.js',
  'js/game-route.js',
  'js/game-presentation.js',
];
const gameFile = 'js/game.js';
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let previousIndex = -1;
for (const file of [...runtimeFiles, gameFile]) {
  const scriptIndex = index.indexOf(`src="${file}"`);
  assert(scriptIndex > previousIndex, `${file} must load after its dependencies`);
  previousIndex = scriptIndex;
}

const gameLines = fs.readFileSync(path.join(root, gameFile), 'utf8').split('\n').length;
assert(gameLines < 800, `game.js grew back to ${gameLines} lines; keep subsystems separate`);

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

for (const file of runtimeFiles) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

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
