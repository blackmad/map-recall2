import assert from 'node:assert/strict';
import {
  AMSTERDAM_WOONPLAATS_ID, cleanDescription, indexOrigins, nameKey, originFor, originsFromRecords, repairOriginTranslation,
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

// Known translator failures on this register (2026-09-29 run).
assert.equal(repairOriginTranslation('De bloem. De Rozengracht is gedempt in 1895.', 'The flower. The Rozengracht was suppressed in 1895.'),
  'The flower. The Rozengracht was filled in in 1895.', 'gedempt is filled in, not suppressed');
assert.equal(repairOriginTranslation('Een gracht, gedeeltelijk gedempt.', 'A canal, partially silenced.'), 'A canal, partially filled in.');
assert.equal(repairOriginTranslation('Zij waren niet gedempt.', 'The protest was suppressed.').includes('filled in'), true, 'only where the Dutch says gedempt');
assert.equal(repairOriginTranslation('De protesten werden onderdrukt.', 'The protests were suppressed.'), 'The protests were suppressed.');
assert.equal(repairOriginTranslation('Kort nadat de grond even voor 1600 bij de stad wordt getrokken.',
  'Shortly after the land was drawn to the city just before 4:00 p.m.'), 'Shortly after the land was drawn to the city just before 1600', 'a year read as a clock time');
assert.equal(repairOriginTranslation('Om 15:00 uur.', 'At 3:00 p.m.'), 'At 3:00 p.m.', 'a real time stays');
assert.equal(repairOriginTranslation('Natuurkundige. Ontdekte de blinde vlek. Marisplein, Jacob Oud-Zuid Rb. 26-1-1922 15: m 9',
  'Physicist. Discovered the blind spot. Marisplein, Jacob Oud-Zuid Rb. 26-1-1922 3:00 p.m. m 9'),
  'Physicist. Discovered the blind spot.', 'an unfinished register note is dropped');
assert.equal(repairOriginTranslation('Later (Rb. 29-11-1986) veranderd.', 'Later (Rb. 29-11-1986) changed.'), 'Later (council decision, 1986) changed.');
assert.equal(repairOriginTranslation('Opgeheven bij Rb. 19-10-1949.', 'Abolished by Rb. 19-10-1949.'), 'Abolished by council decision in 1949.');
assert.equal(repairOriginTranslation('x', 'In Rb. of 21-1-1976, a part was renamed.'), 'By council decision in 1976, a part was renamed.');
assert.equal(repairOriginTranslation('x', 'Laid out (Rb. Nieuwer-Amstel 12-3-1914).'), 'Laid out (council decision of Nieuwer-Amstel, 1914).');

process.stdout.write('Street-name origin checks passed\n');
