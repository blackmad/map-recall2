import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual basemap method, without loading a GPU or rebuilding a filter here.
const source = fs.readFileSync('public/canal-drive/js/vector-map.js', 'utf8');
const start = source.indexOf('  setPlaces(landmarks, boundaries) {');
const end = source.indexOf('\n  setTrees(', start);
assert.ok(start > 0 && end > start);
const Basemap = vm.runInNewContext(`(class {${source.slice(start, end)}})`);
const data = new Map();
const map = new Basemap();
map.map = { getSource: id => ({ setData: value => data.set(id, value) }) };
map._spoils = name => name.includes('Amsterdam');
const place = (id, name, manualPoi, prominenceScore) => ({ id, name, manualPoi, prominenceScore, center: [52.3890237, 4.8374469] });
map.setPlaces([
  place('manual', 'Amsterdam Sloterdijk station', true, 0),
  place('ordinary-spoiler', 'Amsterdam shop', false, 300),
  place('ordinary-visible', 'Independent shop', false, 300),
  place('ordinary-low', 'Tiny shop', false, 100),
], []);
const pins = data.get('amsterdam-pois').features;
assert.deepEqual(Array.from(pins, p => p.properties.id), ['manual', 'ordinary-visible']);
assert.deepEqual(Array.from(pins[0].geometry.coordinates), [4.8374469, 52.3890237], 'sourced entrance survives map projection');
console.log('Manual destination pins survive broad name filtering; ordinary spoilers and low-prominence places remain filtered.');
