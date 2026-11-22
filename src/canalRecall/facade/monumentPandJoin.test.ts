import test from 'node:test';
import assert from 'node:assert/strict';
import { joinMonumentToPand, matchUnit, registerAddresses, type BagUnit } from './monumentPandJoin.ts';

const KOETSHUIS = '0363100012167905', OFFICE = '0363100012167975';

test('rm 2389: the address (Keizersgracht 607) beats the point that falls in the Vijzelstraat 79 office', () => {
  const j = joinMonumentToPand({ registerPands: [], addressPands: [KOETSHUIS], pointPand: OFFICE });
  assert.deepEqual(j, { pand: KOETSHUIS, source: 'address', disagrees: true });
});

test('register pand ids come first, the point breaks ties inside them', () => {
  assert.deepEqual(joinMonumentToPand({ registerPands: ['a', 'b'], addressPands: ['c'], pointPand: 'b' }), { pand: 'b', source: 'register-pand', disagrees: false });
  assert.deepEqual(joinMonumentToPand({ registerPands: ['a'], addressPands: [], pointPand: 'x' }), { pand: 'a', source: 'register-pand', disagrees: true });
});

test('several address pands: most addresses win, then the nearest', () => {
  assert.equal(joinMonumentToPand({ registerPands: [], addressPands: ['a', 'b', 'b'], pointPand: null }).pand, 'b');
  assert.equal(joinMonumentToPand({ registerPands: [], addressPands: ['a', 'b'], pointPand: 'x', distanceM: { a: 20, b: 3 } }).pand, 'b');
});

test('the point stays the fallback; no evidence means no pand', () => {
  assert.deepEqual(joinMonumentToPand({ registerPands: [], addressPands: [], pointPand: 'p' }), { pand: 'p', source: 'point', disagrees: false });
  assert.deepEqual(joinMonumentToPand({ registerPands: [], addressPands: [], pointPand: null }), { pand: null, source: 'none', disagrees: false });
});

test('register metadata: addresses per BAG relation, with letter and pand id', () => {
  const rel = 'https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/bagrelatie/';
  const t = (s: string, k: string, v: string) => ({ s: { value: rel + s }, p: { value: `https://linkeddata.cultureelerfgoed.nl/def/ceo#${k}` }, o: { value: v } });
  const addrs = registerAddresses([
    t('75416', 'openbareRuimte', 'Keizersgracht'), t('75416', 'huisnummer', '607'), t('75416', 'postcode', '1017DS'),
    t('1', 'openbareRuimte', 'Oudezijds Achterburgwal'), t('1', 'huisnummer', '27 A'), t('1', 'huisletter', 'A'), t('1', 'pandIdentificatie', '0363100012177986'),
    { s: { value: 'https://example/other' }, p: { value: 'https://linkeddata.cultureelerfgoed.nl/def/ceo#huisnummer' }, o: { value: '9' } },
  ]);
  assert.deepEqual(addrs.map(a => [a.street, a.number, a.letter, a.postcode, a.pand]), [['Keizersgracht', 607, null, '1017DS', null], ['Oudezijds Achterburgwal', 27, 'A', null, '0363100012177986']]);
});

test('unit match: exact letter first, then the number alone', () => {
  const u = (number: number, letter: string | null, x: number): BagUnit => ({ street: 'Keizersgracht', number, letter, addition: null, pands: [String(x)] });
  const units = [u(603, null, 1), u(607, 'A', 2), u(607, null, 3)];
  const a = { street: 'Keizersgracht', number: 607, letter: null, addition: null, postcode: '1017DS', vbo: null, pand: null };
  assert.equal(matchUnit(a, units)?.pands[0], '3');
  assert.equal(matchUnit({ ...a, letter: 'A' }, units)?.pands[0], '2');
  assert.equal(matchUnit({ ...a, letter: 'B' }, units)?.pands[0], '2');
  assert.equal(matchUnit({ ...a, number: 609 }, units), null);
});
