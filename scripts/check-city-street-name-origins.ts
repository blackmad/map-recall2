/**
 * Checks for the non-Amsterdam street-name origin import
 * (scripts/lib/cityStreetNameOrigins.ts) and the published city files.
 *
 *   npx tsx scripts/check-city-street-name-origins.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  dutchSentences, keptDutchOpening, originDutch, recordFor, registerKind, repairCityOriginTranslation, type RegisterRecord,
} from './lib/cityStreetNameOrigins.ts';

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; process.stdout.write(`  · ${name}\n`); };

check('initials and abbreviations do not end a sentence', () => {
  assert.deepEqual(dutchSentences('Vernoemd naar Th. J. Stieltjes, ingenieur. Hij bouwde o.a. bruggen.'),
    ['Vernoemd naar Th. J. Stieltjes, ingenieur.', 'Hij bouwde o.a. bruggen.']);
});

check('naming-decision bookkeeping is dropped from the Dutch', () => {
  assert.equal(originDutch('Vernoemd naar de Schie. Bij besluit B. en W. van 10 februari 1950 vastgesteld.'), 'Vernoemd naar de Schie.');
});

check('bridges are recognised by name', () => {
  assert.equal(registerKind('Admiraliteitsbrug'), 'bridge');
  assert.equal(registerKind('1e Landscheidingviaduct'), 'bridge');
  assert.equal(registerKind('Coolsingel'), 'street');
});

// Named regression: Rotterdam's register has two texts for 209 names, e.g.
// 'Achterklooster' in the city centre and in Pernis.
check('a reused name is explained only by the record near the extract street', () => {
  const centre: RegisterRecord = { id: '1', name: 'Achterklooster', nlFull: 'Dankt zijn naam aan het klooster van de Predikheren.', sourceUrl: 'x/1', lat: 51.9225, lon: 4.4840 };
  const pernis: RegisterRecord = { id: '2', name: 'Achterklooster', nlFull: 'Benaming voor een weg achter de Pernisser Molenweg.', sourceUrl: 'x/2', lat: 51.8880, lon: 4.3880 };
  const near = recordFor([centre, pernis], [[51.9230, 4.4835]]);
  assert.equal(near.record?.id, '1');
  assert.equal(recordFor([centre, pernis], [[51.9230, 4.4835], [51.8885, 4.3885]]).record, null, 'both places in the extract: withheld');
  assert.equal(recordFor([centre, pernis], [[52.1, 4.3]]).record, null, 'neither nearby: withheld');
  assert.equal(recordFor([centre, { ...centre, id: '3' }], [[52.1, 4.3]]).record?.id, '1', 'one distinct text needs no position');
});

check('a filled-in canal is not "embanked"', () => {
  assert.equal(repairCityOriginTranslation('In 1897 werd de Reserveboezem geheel gedempt.', 'In 1897 the Reserveboezem was entirely embanked.'),
    'In 1897 the Reserveboezem was entirely filled in.');
  assert.equal(repairCityOriginTranslation('De dijk werd verhoogd.', 'The dike was embanked.'), 'The dike was embanked.', 'only when the Dutch says gedempt');
});

// Named regressions from the Rotterdam spot-check (2026-10-02).
check('spot-check repairs: of/or, Naar, industriestad, ambacht, gegraven', () => {
  assert.equal(repairCityOriginTranslation('Renatus Cartesius (of René Descartes), 1596-1650.', 'Renatus Cartesius (of René Descartes), 1596–1650.'),
    'Renatus Cartesius (or René Descartes), 1596–1650.');
  assert.equal(repairCityOriginTranslation('Geuneburg of Geuneborgh, oude naam van Schipborg.', 'Geuneburg of Geuneborgh, former name of Schipborg.'),
    'Geuneburg or Geuneborgh, former name of Schipborg.');
  assert.equal(repairCityOriginTranslation('Voormalig slot, ook wel Slot van Haaften genaamd.', 'Former castle, also known as Castle of Haaften.'),
    'Former castle, also known as Castle of Haaften.', 'an English "of" is left alone');
  assert.equal(repairCityOriginTranslation('Naar de Dalton-H.B.S., die daar gevestigd was.', 'To the Dalton-H.B.S., which was housed there.'),
    'Named after the Dalton-H.B.S., which was housed there.');
  assert.equal(repairCityOriginTranslation('Industriestad in het Verenigd Koninkrijk.', 'Industrial Estate in the United Kingdom.'), 'Industrial city in the United Kingdom.');
  assert.equal(repairCityOriginTranslation('Het ambacht Rotterdam behoorde aan een Bokel.', 'The craft Rotterdam belonged to a Bokel.'), 'The manor Rotterdam belonged to a Bokel.');
  assert.equal(repairCityOriginTranslation('De haven werd in 1881 gegraven.', 'The harbour was dredged in 1881.'), 'The harbour was dug in 1881.');
});

check('an untranslated Dutch opening word is caught, names and shared words are not', () => {
  assert.equal(keptDutchOpening('Roofvogel.', 'Roofvogel.', 'Buizerdstraat'), 'Roofvogel');
  assert.equal(keptDutchOpening('Herkauwer uit de orde der evenhoevigen.', 'Herkauwer from the order of even-toed ungulates.', 'Antilopestraat'), 'Herkauwer');
  assert.equal(keptDutchOpening('Havenstad in Finland.', 'Havenstad in Finland.', 'Helsinkipad'), 'Havenstad');
  assert.equal(keptDutchOpening('Plant.', 'Plant.', 'Cymbelkruid'), null);
  assert.equal(keptDutchOpening('Miguel de Cervantes, 1547-1616, Spaans schrijver.', 'Miguel de Cervantes, 1547-1616, Spanish writer.', 'Cervantesstraat'), null);
  assert.equal(keptDutchOpening('Anna, prinses van Saksen.', 'Anna, princess of Saxony.', 'Anna van Saksenhof'), null);
  assert.equal(keptDutchOpening('Geuneburg of Geuneborgh, oude naam.', 'Geuneburg or Geuneborgh, former name.', 'Geuneburg'), null);
});

for (const city of ['rotterdam']) {
  const file = `public/data/extracts/${city}/street-name-origins.json`;
  if (!existsSync(file)) continue;
  check(`${city}: published origins are English, sourced and attributed`, () => {
    const data = JSON.parse(readFileSync(file, 'utf8')) as { source: { url: string; licence: string }; origins: Array<{ name: string; kind: string; en: string; sourceUrl: string; enSource: string }> };
    assert.ok(data.source.url && data.source.licence, 'dataset url and licence');
    assert.ok(data.origins.length > 1000, 'a meaningful number of origins');
    for (const origin of data.origins) {
      assert.ok(['street', 'water', 'bridge'].includes(origin.kind), `${origin.name}: kind`);
      assert.ok(origin.en && origin.sourceUrl && origin.enSource, `${origin.name}: en, sourceUrl, enSource`);
      assert.ok(!/\b(?:vernoemd|genoemd naar|werd|deze straat)\b/i.test(origin.en), `${origin.name}: still Dutch: ${origin.en}`);
    }
  });
}
process.stdout.write(`city street-name origins: ${passed} checks passed\n`);
