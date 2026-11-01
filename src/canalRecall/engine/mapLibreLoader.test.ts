import assert from 'node:assert/strict';
import test from 'node:test';
import { engineFlag } from './worldViewApi';
import { loadMapLibreIfNeeded, mapLibreTags, wantsMapLibre } from './mapLibreLoader';

test('the loader asks for MapLibre exactly when engineFlag() picks the MapLibre world view', () => {
  const cases: Array<[string, unknown]> = [['', undefined], ['?engine=own', undefined], ['?engine=maplibre', undefined], ['?engine=OWN', undefined],
    ['', 'own'], ['?engine=own', 'maplibre'], ['?ride=free&engine=own', undefined], ['?engine=', undefined],
    ['', 'maplibre'], ['?ride=free&engine=maplibre', undefined], ['?engine=MapLibre', undefined], ['?engine=maplibre', 'own']];
  for (const [search, global] of cases) {
    (globalThis as any).__canalRecallEngine = global;
    // game.js picks the engine for DEFAULT_CITY_ID (Amsterdam) before any saved city applies.
    try { assert.equal(wantsMapLibre(search, global), engineFlag(search, 'amsterdam') === 'maplibre', `${search} / ${global}`); }
    finally { delete (globalThis as any).__canalRecallEngine; }
  }
});

test('maplibre writes the same three tags index.html had, in order; the default (own) writes nothing', () => {
  const written: string[] = [];
  const doc = { write: (m: string) => written.push(m) };
  const asked = { location: { search: '?engine=maplibre' } } as any;
  assert.equal(loadMapLibreIfNeeded(asked, doc), true);
  assert.equal(written.join(''), mapLibreTags());
  assert.match(written[0], /tiles\.openfreemap\.org.*maplibre-gl@5\.24\.0\/dist\/maplibre-gl\.css.*<script src="https:\/\/unpkg\.com\/maplibre-gl@5\.24\.0\/dist\/maplibre-gl\.js"><\/script>$/);
  assert.equal(asked.__canalRecallMapLibreLoad, 'written');
  written.length = 0;
  const spec = { location: { search: '' }, __canalRecallEngine: 'maplibre' } as any;
  assert.equal(loadMapLibreIfNeeded(spec, doc), true, 'the ENGINE=maplibre spec lane');
  written.length = 0;
  const def = { location: { search: '' } } as any;
  assert.equal(loadMapLibreIfNeeded(def, doc), false);
  assert.equal(written.length, 0);
  const own = { location: { search: '?engine=own' } } as any;
  assert.equal(loadMapLibreIfNeeded(own, doc), false);
  assert.equal(written.length, 0);
});
