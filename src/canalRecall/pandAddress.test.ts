import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADDRESS_HIDDEN_TEXT, addressSentence, compactNumbers, pandAddressOf, streetShown, withoutStreetClause } from './pandAddress';

test('house numbers compact to a lone number, a pair, or a span', () => {
  assert.equal(compactNumbers([{ n: 12 }]), '12');
  assert.equal(compactNumbers([{ n: 12, letter: 'a' }, { n: 12, letter: 'C' }, { n: 12, letter: 'b' }]), '12A–12C');
  assert.equal(compactNumbers([{ n: 4 }, { n: 2 }]), '2, 4');
  assert.equal(compactNumbers([65, 55, 57, 59, 61, 63, 55].map(n => ({ n }))), '55–65');
  assert.equal(compactNumbers([{ n: 0 }, { n: NaN }]), '');
});

test('a pand on two streets lists both, most numbers first, capped at three', () => {
  const rows = [
    ...[12, 14].map(n => ({ street: 'Herengracht', n })), { street: 'Leliegracht', n: 2 },
    { street: 'Aagje', n: 1 }, { street: 'Beetje', n: 1 }, { street: 'Zeeg', n: 1 },
  ];
  assert.deepEqual(pandAddressOf(rows), [['Herengracht', '12, 14'], ['Aagje', '1'], ['Beetje', '1']]);
  assert.deepEqual(pandAddressOf([{ street: '', n: 3 }, { street: 'X', n: 0 }]), []);
});

const ADDRESS = [['Anthony Fokkerweg', '55–65'], ['Leliegracht', '2']] as [string, string][];

test('Free Ride says the whole address', () => {
  assert.equal(addressSentence(ADDRESS, { freeRide: true, quizPromptName: 'Leliegracht' }), 'Address: Anthony Fokkerweg 55–65 / Leliegracht 2.');
  assert.equal(addressSentence(ADDRESS, { freeRide: true }), 'Address: Anthony Fokkerweg 55–65 / Leliegracht 2.');
});

test('a quiz mode withholds every street while any question is open, and says them between questions', () => {
  for (const open of [{ quizPromptName: 'Herengracht' }, { quizCandidateName: 'Herengracht' }, { _silentPass: { name: 'Herengracht' } }]) {
    assert.equal(addressSentence(ADDRESS, { freeRide: false, ...open }), ADDRESS_HIDDEN_TEXT, JSON.stringify(open));
    assert(!addressSentence(ADDRESS, { freeRide: false, ...open }).includes('Anthony'));
  }
  assert.equal(addressSentence(ADDRESS, { freeRide: false }), 'Address: Anthony Fokkerweg 55–65 / Leliegracht 2.');
  assert.equal(streetShown({ freeRide: false, quizPromptName: '' }, 'X'), true);
});

test('no address, no sentence; a mapped place loses its street clause when withheld', () => {
  assert.equal(addressSentence(undefined, {}), '');
  assert.equal(addressSentence([], {}), '');
  assert.equal(withoutStreetClause('A Sikh gurdwara at Schakelstraat 21.', 'Schakelstraat 21'), 'A Sikh gurdwara.');
  assert.equal(withoutStreetClause('A café.', ''), 'A café.');
});
