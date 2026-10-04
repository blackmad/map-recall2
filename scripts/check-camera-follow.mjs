import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync('public/canal-drive/js/constants.js', 'utf8'), context);
vm.runInContext('function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }', context);
vm.runInContext(fs.readFileSync('public/canal-drive/js/camera.js', 'utf8') + '\nglobalThis.Camera = Camera;', context);
const target = { x: 1200, y: -800, angle: 0, speed: 0, maxSpeed: 100 };
const positions = [5, 15, 30, 60, 120].map(fps => {
  const camera = new context.Camera();
  for (let frame = 0; frame < fps; frame++) camera.update(target, 1 / fps);
  return camera.x;
});
assert.ok(Math.max(...positions) - Math.min(...positions) < 1e-8, 'one second of follow converges equally at 5–120 fps');

const camera = new context.Camera();
camera.update(target, 1 / 60);
camera.pan(1000, -500);
target.x += 800;
camera.update(target, 0.2);
assert.equal(camera.detached, true);
assert.ok(Math.abs(camera.x - target.x) > 100, 'panned camera stays detached while the bike moves');
camera.resetPan();
assert.equal(camera.detached, false);
assert.equal(camera.x, target.x, 'recenter immediately restores the latest bike position');
assert.equal(camera.y, target.y);
target.x += 100;
camera.update(target, 0.2);
assert.ok(Math.abs(camera.x - target.x) < 45, 'follow stays responsive at low frame rates');
assert.equal(camera.panX, 0);
camera.update(target, NaN);
assert.ok(Number.isFinite(camera.x), 'missing frame timing cannot corrupt the camera');
console.log('Camera follow checks passed: frame-rate independence, recenter, moving target, detached pan.');
