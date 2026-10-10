// Named regression: the Vondelpark Rosarium hex beds (OSM a147997044) carry rose
// bushes, none on the paths between them, in one instanced draw.
//   node --import tsx scripts/check-rose-gardens.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import data from '../public/canal-drive/js/rose-garden-data.js';
import {roseBushInstances} from '../src/canalRecall/roseBeds.ts';
globalThis.window = {CanalRecallThree: {THREE}};
globalThis.location = {href: 'http://localhost/canal-drive/'};
const {InventoryTrees} = await import('../public/canal-drive/js/inventory-trees-source.js');

const rosarium = data.gardens.find(g => g.id === 'a147997044');
assert.ok(rosarium, 'Vondelpark Rosarium planted');
assert.ok(rosarium.beds.length >= 65 && rosarium.beds.length <= 85, `hex beds ${rosarium.beds.length}`);
for (const bed of rosarium.beds) assert.ok(bed.bushes >= 6 && bed.area >= 7 && bed.area <= 40, JSON.stringify(bed));
assert.ok(new Set(rosarium.beds.map(b => b.colour)).size >= 5, 'bed colours vary');
const total = data.gardens.reduce((s, g) => s + g.bushes.length / 4, 0);
assert.ok(total <= 5000, `bush budget ${total}`);

// No bush reaches the beige walking surface of a rendered Vondelpark path; foliage
// may overhang the 0.25 m darker casing, as real roses spill over a bed edge.
const all = {west: -180, east: 180, south: -90, north: 90};
const bushes = roseBushInstances(rosarium, all);
const land = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/park-landscape.geojson', 'utf8'));
const [lng0, lat0] = rosarium.origin, kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
const local = ([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * ky];
const paths = land.features.filter(f => f.properties.role === 'path' && f.properties.park === 'Vondelpark')
  .map(f => ({c: f.geometry.coordinates.map(local), half: f.properties.width / 2}))
  .filter(p => p.c.some(([x, y]) => Math.abs(x) < 120 && Math.abs(y) < 120));
assert.ok(paths.length > 60, `rosarium paths ${paths.length}`);
const seg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
let worst = Infinity;
for (const r of bushes) {
  const p = local([r.lng, r.lat]);
  for (const path of paths) for (let i = 0; i < path.c.length - 1; i++)
    worst = Math.min(worst, seg(p, path.c[i], path.c[i + 1]) - path.half - r.radius);
}
assert.ok(worst > 0, `a bush overlaps a path by ${(-worst).toFixed(2)} m`);

// Renderer: one extra instanced draw at the Rosarium, none elsewhere.
const view = (lng, lat, zoom) => ({addLayer() {}, on() {}, off() {}, triggerRepaint() {}, getZoom: () => zoom,
  getCenter: () => ({lng, lat}), getBounds: () => ({getWest: () => lng - .0012, getEast: () => lng + .0012,
    getSouth: () => lat - .0007, getNorth: () => lat + .0007})});
const projection = {MercatorCoordinate: {fromLngLat: ([lng, lat]) => {
  const x = (lng + 180) / 360, y = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2;
  return {x, y, z: 0, meterInMercatorCoordinateUnits: () => 1 / (40075016.686 * Math.cos(lat * Math.PI / 180))};
}}};
const draws = (lng, lat, zoom) => {
  const layer = new InventoryTrees(view(lng, lat, zoom), projection);
  layer.enabled = true; layer.ready = true; layer.rebuild();
  const roses = layer.meshes.filter(m => m.material === layer.materials.get('rose'));
  const triangles = roses.reduce((s, m) => s + m.count * m.geometry.attributes.position.count / 3, 0);
  return {roses: layer.debugRoses, draws: roses.length, meshes: layer.meshes.length, triangles};
};
const at = draws(4.86373, 52.35762, 17.5), far = draws(4.9, 52.37, 17.5), low = draws(4.86373, 52.35762, 16);
assert.equal(at.draws, 1, JSON.stringify(at));
assert.equal(at.meshes, 1, 'only the rose mesh without tree tiles');
assert.ok(at.roses >= 900, JSON.stringify(at));
assert.equal(at.triangles, at.roses * 20);
assert.equal(far.meshes, 0); assert.equal(low.meshes, 0, 'below zoom 16.5 no roses');
console.log(JSON.stringify({gardens: data.gardens.map(g => ({id: g.id, name: g.name, beds: g.beds.length, bushes: g.bushes.length / 4})),
  rosariumView: at, pathClearanceMinM: Number(worst.toFixed(2))}));
