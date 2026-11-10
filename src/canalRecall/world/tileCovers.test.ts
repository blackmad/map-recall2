import test from 'node:test';
import assert from 'node:assert/strict';
import { type CoversFile, changedCoversTiles, coversHides, resolveTileIds, tileCoversHash, tileCoversLines } from './tileCovers.ts';
import { HIDE_COVER_OSM, HIDE_COVER_PAND } from './cellFormat.ts';

const covers: CoversFile = { models: { 'chunk-a': { p: ['0363100012000001', '0363100012000002'], o: ['way/9'] }, 'ordinary-b': { p: ['0363100012000002'] } } };

test('coversHides: pands get the IMBAG prefix, OSM ways their own id, shared ids list both models', () => {
  const h = coversHides(covers);
  assert.deepEqual([...h.keys()], ['NL.IMBAG.Pand.0363100012000001', 'NL.IMBAG.Pand.0363100012000002', 'way/9']);
  assert.deepEqual(h.get('NL.IMBAG.Pand.0363100012000002'), { id: 'NL.IMBAG.Pand.0363100012000002', reasons: HIDE_COVER_PAND, models: ['chunk-a', 'ordinary-b'] });
  assert.equal(h.get('way/9')!.reasons, HIDE_COVER_OSM);
});

test('a tile slice holds only the hides of its own buildings', () => {
  const h = coversHides(covers);
  assert.deepEqual(tileCoversLines(['NL.IMBAG.Pand.0363100012000002', 'x'], h), [`NL.IMBAG.Pand.0363100012000002:${HIDE_COVER_PAND}:chunk-a,ordinary-b`]);
  const a = tileCoversHash(['NL.IMBAG.Pand.0363100012000001', 'other'], h);
  const moved = coversHides({ models: { ...covers.models, 'chunk-c': { p: ['0363100012999999'] } } });
  assert.equal(tileCoversHash(['NL.IMBAG.Pand.0363100012000001', 'other'], moved), a, 'a model elsewhere does not move this tile');
  assert.notEqual(tileCoversHash(['NL.IMBAG.Pand.0363100012999999'], moved), tileCoversHash(['NL.IMBAG.Pand.0363100012999999'], h), 'a new cover moves the tile that holds the pand');
  assert.equal(tileCoversHash(['untouched'], h), tileCoversHash([], h), 'an uncovered tile has the empty slice');
});

test('a model added or removed changes only the tiles of its pands', () => {
  const tiles = { '1/1': ['NL.IMBAG.Pand.0363100012000001'], '1/2': ['NL.IMBAG.Pand.0363100012000500'], '2/2': ['way/9'] };
  const slice = (c: typeof covers) => new Map(Object.entries(tiles).map(([t, ids]) => [t, tileCoversHash(ids, coversHides(c))]));
  const before = slice(covers);
  const after = slice({ models: { ...covers.models, 'chunk-new': { p: ['0363100012000500'] } } });
  assert.deepEqual(changedCoversTiles(Object.keys(tiles), Object.fromEntries(before), after), ['1/2']);
  assert.deepEqual(changedCoversTiles(Object.keys(tiles), undefined, after), Object.keys(tiles), 'no previous slices: every tile');
});

test('resolveTileIds reuses the cache while the tile sha holds and re-reads a changed tile', () => {
  const reads: string[] = [];
  const read = (t: string) => { reads.push(t); return [`id-${t}`]; };
  const first = resolveTileIds(['a', 'b'], t => `sha-${t}`, null, read);
  assert.equal(first.parsed, 2);
  const second = resolveTileIds(['a', 'b'], t => (t === 'b' ? 'sha-b2' : `sha-${t}`), first.cache, read);
  assert.equal(second.parsed, 1);
  assert.deepEqual(reads, ['a', 'b', 'b']);
  assert.deepEqual(second.cache.tiles.b, { sha: 'sha-b2', ids: ['id-b'] });
  assert.deepEqual(resolveTileIds(['a'], t => `sha-${t}`, second.cache, read).cache.tiles, { a: second.cache.tiles.a }, 'a tile that left the list drops out');
});
