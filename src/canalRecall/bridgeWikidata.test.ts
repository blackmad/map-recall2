import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bridgeMatchKey, bridgeNumberLabel, matchBridgeWikidata, wikipediaTag, type WikidataBridgeCandidate } from './bridgeWikidata.ts';

const at = (lat: number, lng: number): [number, number] => [lat, lng];

test('OSM spelling variants fold to the official name', () => {
  assert.equal(bridgeMatchKey('Katten brug'), bridgeMatchKey('Kattenbrug'));
  assert.equal(bridgeMatchKey('Hilletjes Brug'), bridgeMatchKey('Hilletjesbrug'));
  assert.equal(bridgeMatchKey('Hollandse Iepbrug'), bridgeMatchKey('De Hollandse Iepbrug'));
  assert.equal(bridgeMatchKey('Maria Skłodowska-Curiebrug'), bridgeMatchKey('Maria Sklodowska-Curiebrug'));
  assert.notEqual(bridgeMatchKey('Kunstbrug'), bridgeMatchKey('Jaap Kunstbrug'));
});

test('numbered labels', () => {
  assert.equal(bridgeNumberLabel('Brug 236'), 236);
  assert.equal(bridgeNumberLabel('brug nr. 41'), 41);
  assert.equal(bridgeNumberLabel('Brug 236 (Amsterdam)'), 236);
  assert.equal(bridgeNumberLabel('Blauwbrug'), undefined);
});

const kattenbrug: WikidataBridgeCandidate = { qid: 'Q1', coord: at(52.3700, 4.9000), names: ['Brug 99', 'Kattenbrug'], nlwiki: 'Kattenbrug' };

test('a close item named alike matches; a far one does not', () => {
  const near = matchBridgeWikidata({ name: 'Katten brug', center: at(52.3701, 4.9001) }, [kattenbrug]);
  assert.equal(near?.qid, 'Q1');
  assert.equal(near?.via, 'name');
  assert.equal(matchBridgeWikidata({ name: 'Katten brug', center: at(52.3800, 4.9000) }, [kattenbrug]), null);
});

test('the register number matches a "Brug N" item when no name does', () => {
  const brug411: WikidataBridgeCandidate = { qid: 'Q2', coord: at(52.35, 4.85), names: ['Brug 411'], nlwiki: 'Brug 411' };
  assert.equal(matchBridgeWikidata({ name: 'Godenbrug', center: at(52.35, 4.85), registerNr: 411 }, [brug411])?.via, 'number');
  assert.equal(matchBridgeWikidata({ name: 'Godenbrug', center: at(52.35, 4.85) }, [brug411]), null);
  assert.equal(matchBridgeWikidata({ name: 'Godenbrug', center: at(52.35, 4.85), registerNr: 412 }, [brug411]), null);
});

test('two different items named alike nearby are ambiguous', () => {
  const twin = { ...kattenbrug, qid: 'Q3' };
  assert.equal(matchBridgeWikidata({ name: 'Kattenbrug', center: at(52.37, 4.90) }, [kattenbrug, twin]), null);
});

test('a name match outranks a number match', () => {
  const numbered: WikidataBridgeCandidate = { qid: 'Q4', coord: at(52.37, 4.90), names: ['Brug 99'] };
  assert.equal(matchBridgeWikidata({ name: 'Kattenbrug', center: at(52.37, 4.90), registerNr: 99 }, [numbered, kattenbrug])?.qid, 'Q1');
});

test('the wikipedia tag prefers the Dutch article', () => {
  assert.equal(wikipediaTag({ nlwiki: 'Kattenbrug', enwiki: 'Cat Bridge' }), 'nl:Kattenbrug');
  assert.equal(wikipediaTag({ enwiki: 'Cat Bridge' }), 'en:Cat Bridge');
  assert.equal(wikipediaTag({}), undefined);
});
