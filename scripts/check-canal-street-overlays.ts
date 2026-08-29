import assert from 'node:assert/strict';
import { STREET_OVERLAY_LAYER_IDS, streetOverlayLayers } from '../src/canalRecall/streetOverlayStyle';

const layers = streetOverlayLayers();
assert.deepEqual(layers.map(layer => layer.id), [...STREET_OVERLAY_LAYER_IDS]);
assert.equal(layers.filter(layer => layer.type === 'line').length, 5);
const labels = layers.find(layer => layer.id === 'learned-street-labels');
assert.equal((labels?.layout as Record<string, unknown>)['symbol-placement'], 'line');
assert.equal((labels?.layout as Record<string, unknown>)['text-keep-upright'], true);
process.stdout.write('Canal Recall native street-overlay checks passed.\n');
