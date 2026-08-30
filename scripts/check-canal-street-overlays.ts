import assert from 'node:assert/strict';
import { STREET_OVERLAY_LAYER_IDS, streetOverlayLayers } from '../src/canalRecall/streetOverlayStyle';

const layers = streetOverlayLayers();
assert.deepEqual(layers.map(layer => layer.id), [...STREET_OVERLAY_LAYER_IDS]);
assert.equal(layers.filter(layer => layer.type === 'line').length, 3);
assert.equal(layers.some(layer => layer.type === 'symbol'), false,
  'Street names have one owner: the canvas renderer that can hide the active quiz and rider area.');
process.stdout.write('Canal Recall native street-overlay checks passed.\n');
