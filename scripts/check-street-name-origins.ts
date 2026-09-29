import assert from 'node:assert/strict';
import {
  AMSTERDAM_WOONPLAATS_ID, cleanDescription, indexOrigins, nameKey, originFor, originsFromRecords,
  type BagOpenbareRuimte,
} from './lib/streetNameOrigins.ts';

const record = (overrides: Partial<BagOpenbareRuimte>): BagOpenbareRuimte => ({
  identificatie: '0363300000000001', naam: 'Rozengracht', typeOmschrijving: 'Weg',
  beschrijvingNaam: 'De bloem. De Rozengracht is gedempt in 1895.', eindGeldigheid: null,
  ligtInWoonplaatsId: AMSTERDAM_WOONPLAATS_ID, ...overrides,
});

// Records: only current, explained, known kinds; whitespace cleaned.
const origins = originsFromRecords([
  record({}),
  record({ identificatie: '2', naam: 'Oude naam', eindGeldigheid: '2001-01-01' }),
  record({ identificatie: '3', naam: 'Zonder uitleg', beschrijvingNaam: '  ' }),
  record({ identificatie: '4', naam: 'Terreintje', typeOmschrijving: 'Terrein' }),
  record({ identificatie: '5', naam: 'Magere Brug', typeOmschrijving: 'Kunstwerk', beschrijvingNaam: 'Naar  de smalle brug.  ' }),
]);
assert.deepEqual(origins.map(origin => origin.name), ['Magere Brug', 'Rozengracht'], 'ended, unexplained and unknown kinds are dropped');
assert.equal(origins[0].nl, 'Naar de smalle brug.', 'double and trailing spaces are cleaned');
assert.equal(origins[0].kind, 'bridge');
assert.equal(cleanDescription(null), '');

// Name matching forgives spelling noise only.
assert.equal(nameKey('’s-Gravendijkdreef'), nameKey("'s-Gravendijkdreef"), 'curly apostrophes match straight ones');
assert.equal(nameKey('Van  Limburg Stirumplein'), nameKey('van limburg stirumplein'));
assert.notEqual(nameKey('Rozengracht'), nameKey('Rozenstraat'));

// Matching to extract features.
const index = indexOrigins([
  ...origins,
  ...originsFromRecords([
    record({ identificatie: '6', naam: 'Kerkstraat', beschrijvingNaam: 'Naar de kerk.' }),
    record({ identificatie: '7', naam: 'Kerkstraat', beschrijvingNaam: 'Naar de oude dorpskerk van Weesp.', ligtInWoonplaatsId: '1012' }),
    record({ identificatie: '8', naam: 'Dubbelstraat', beschrijvingNaam: 'Naar persoon A.' }),
    record({ identificatie: '9', naam: 'Dubbelstraat', beschrijvingNaam: 'Naar persoon B.' }),
  ]),
]);
assert.equal(originFor(index, 'Rozengracht', 'street')?.bagId, '0363300000000001');
assert.equal(originFor(index, 'Rozengracht', 'water')?.bagId, '0363300000000001', 'a filled canal registered as a Weg explains the water too');
assert.equal(originFor(index, 'Rozengracht', 'bridge'), null, 'a street never explains a bridge');
assert.equal(originFor(index, 'Kerkstraat', 'street')?.nl, 'Naar de kerk.', 'Amsterdam proper wins over Weesp');
assert.equal(originFor(index, 'Dubbelstraat', 'street'), null, 'two explanations of one name are refused, not guessed');
assert.equal(originFor(index, 'Nergensstraat', 'street'), null);
assert.equal(originFor(index, 'Magere Brug', 'street')?.kind, 'bridge', 'a bridge carried as a routing way is explained by its Kunstwerk');

process.stdout.write('Street-name origin checks passed\n');
