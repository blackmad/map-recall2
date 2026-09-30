import assert from 'node:assert/strict';
import {
  AMSTERDAM_WOONPLAATS_ID, cleanDescription, indexOrigins, nameGenericOrigin, refersToItself, withoutCrossReference, nameKey, nameStem, originFor, originsFromRecords, repairOriginTranslation,
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
// Historical terms the translator took literally (Herengracht, Kloveniersburgwal, Frans Halsstraat, Kuiperssteeg, Karel Doormanstraat).
assert.equal(repairOriginTranslation('Het gedeelte voorbij de Leidsegracht behoort tot de uitleg van 1658.', 'The part beyond the Leidsegracht belongs to the explanation of 1658.'),
  'The part beyond the Leidsegracht belongs to the expansion of 1658.');
assert.equal(repairOriginTranslation('De Kloveniersburgwal dankt zijn naam aan een onderdeel van de schutterij dat kloveniers werd genoemd, naar het vuurwapen dat de manschappen gebruikten, een veldslang.',
  'The Kloveniersburgwal owes its name to a part of the artillery that was called crossbowmen, after the firearm used by the men, a field snake.'),
  'The Kloveniersburgwal owes its name to a company of the civic guard called the kloveniers, after the firearm its men carried, the klover or culverin.');
assert.equal(repairOriginTranslation('Schilderde portretten en schuttersstukken.', 'Painted portraits and hunting scenes.'), 'Painted portraits and civic guard portraits.');
assert.equal(repairOriginTranslation('Naar de hier gevestigde kuiperij.', 'To the brewery established here.'), 'To the cooperage established here.');
assert.equal(repairOriginTranslation('Schout-bij-nacht in Nederlands-Indië.', 'Night commander in the Dutch East Indies.'), 'Night commander in the Dutch East Indies.',
  'a capitalised rendering is left for review rather than guessed');
assert.equal(repairOriginTranslation('Tijdens de oorlog schout-bij-nacht in Nederlands-Indië.', 'During the war, he was night commander in the Dutch East Indies.'),
  'During the war, he was rear admiral in the Dutch East Indies.');
assert.equal(repairOriginTranslation('Naar de Heren Regeerders van de stad (De stad werd vroeger niet bestuurd, maar geregeerd).',
  'To the Lords Regulators of the city (The city was not previously governed, but ruled).'),
  'To the ruling lords (Heren Regeerders) of the city (in those days the city was not governed but ruled).');
// Cross-references a card cannot follow, and register index noise (Goudbalpad, Blancefloorstraat, Rozenstraat).
assert.deepEqual(withoutCrossReference('A pear variety. The street is on the former allotments De Bongerd. See Boomgaardlaan.'),
  { text: 'A pear variety. The street is on the former allotments De Bongerd.' });
assert.deepEqual(withoutCrossReference("Figure from the medieval romance 'Floris ende Blancefloor'. Blancplein, Mont See Mont."),
  { text: "Figure from the medieval romance 'Floris ende Blancefloor'." });
assert.deepEqual(withoutCrossReference('Village west of Utrecht. Meerpad, Nieuwe Zie Nieuwe.'), { text: 'Village west of Utrecht.' });
assert.deepEqual(withoutCrossReference('See Rozengracht.'), { text: '', see: 'Rozengracht' });
assert.deepEqual(withoutCrossReference('The canal behind the Voorburgwal. See further Oudezijds Voorburgwal.'),
  { text: 'The canal behind the Voorburgwal.' });
assert.deepEqual(withoutCrossReference('The canal behind the Voorburgwal on the old side. See further Oudezijds Voorburgwal. The square was named Walenpleintje in 1978. See there.'),
  { text: 'The canal behind the Voorburgwal on the old side. The square was named Walenpleintje in 1978.' }, 'a reference mid-text goes too');
assert.equal(repairOriginTranslation('Deze Amstel, nu voor 2/3 gedempt, bij de Dam.', 'This Amstel, now partially dammed for 2/3, near the Dam.'),
  'This Amstel, now partially filled in for 2/3, near the Dam.', 'the Dam square is not afdammen');
assert.equal(repairOriginTranslation('Nog steeds waterkering, zij het als slaperdijk.', 'Still a water barrier, albeit as a sleeping wall.'),
  'Still a water barrier, albeit as a sleeper dike (a reserve dike behind the front line).');
// The register's Oudezijds Voorburgwal street record is the Nieuwezijds text; it points at itself.
assert.ok(refersToItself({ name: 'Oudezijds Voorburgwal', nl: 'Voor het ontstaan van de naam zie Oudezijds Voorburgwal. De Nieuwezijds Voorburgwal is gedempt.' }));
assert.ok(!refersToItself({ name: 'Oudezijds Achterburgwal', nl: 'De gracht achter de voorburgwal. Zie verder Oudezijds Voorburgwal.' }), 'a cross-reference to another name is fine');
// Filling in, however the translator rendered it (Open Havenfront, Plantage Muidergracht, Westerstraat).
assert.equal(repairOriginTranslation('Gedempt voor de bouw van het Centraal Station.', 'Muted for the construction of Central Station.'),
  'Filled in for the construction of Central Station.');
assert.equal(repairOriginTranslation('Na demping hernoemd.', 'Renamed after flooding.'), 'Renamed after filling in.');
assert.equal(repairOriginTranslation('De Nieuwezijds Voorburgwal werd in 1884 gedempt.', 'The Nieuwezijds Voorburgwal was demoted in 1884.'),
  'The Nieuwezijds Voorburgwal was filled in in 1884.');
assert.equal(repairOriginTranslation('Het terrein overstroomde; later gedempt.', 'The site suffered flooding; later filled in.'),
  'The site suffered flooding; later filled in.', 'flooding stays where the Dutch says overstroming');
assert.equal(repairOriginTranslation('De gracht werd rechtgetrokken en later gedempt.', 'The canal was straightened and later dampened.'),
  'The canal was straightened and later filled in.', 'straightened stays where the Dutch says recht');
assert.equal(repairOriginTranslation('Reynier Reael, schepen van de stad.', 'Reynier Reael, captain of the city.'),
  'Reynier Reael, alderman (schepen) of the city.');
assert.equal(repairOriginTranslation('Voor de stadsuitleg van 1593 lag de poort hier.', 'For the city tour of 1593, the gate was here.'),
  'Before the city expansion of 1593, the gate was here.');
// Mistranslations that taught something false (Pruimenstraat, Mussenstraat, Fazantenweg).
assert.equal(repairOriginTranslation('De vruchten van de pruimenboom.', 'The fruits of the pear tree.'), 'The fruits of the plum tree.');
assert.equal(repairOriginTranslation('De tot de vinken behorende vogels.', 'The birds belonging to the sparrows.'), 'The birds belonging to the finches.');
assert.equal(repairOriginTranslation('De hoender.', 'The chicken.'), 'The fowl.');
// A bare class says what the name means, from the reviewed stem glossary.
const stems = { egelantier: 'eglantine (sweet briar)', linden: 'linden (lime tree)', berberis: 'barberry', kogeldistel: 'globe thistle', fazanten: 'pheasant' };
assert.equal(nameStem('Tweede Egelantiersdwarsstraat'), 'egelantier');
assert.equal(nameStem('Koekoeksplein'), 'koekoek');
assert.equal(nameGenericOrigin('Egelantiersgracht', 'The shrub.', stems), 'Named after the eglantine (sweet briar), a shrub.');
assert.equal(nameGenericOrigin('Lindengracht', 'The deciduous tree.', stems), 'Named after the linden (lime tree), a deciduous tree.');
assert.equal(nameGenericOrigin('Berberisstraat', 'The shrub.', stems), 'Named after the barberry, a shrub.');
assert.equal(nameGenericOrigin('Kogeldistelstraat', 'Thistle species', stems), 'Named after the globe thistle, a thistle.');
assert.equal(nameGenericOrigin('Fazantenweg', 'The fowl.', stems), 'Named after the pheasant, a fowl.');
assert.equal(nameGenericOrigin('Meeuwenlaan', 'The bird family.', { meeuwen: 'gull' }), 'Named after the gull, a bird.');
assert.equal(nameGenericOrigin('Duinbeek', 'The shrub.', stems), 'The shrub.', 'a stem the glossary lacks is left alone');
assert.equal(nameGenericOrigin('Lindengracht', 'The canal was filled in in 1895.', stems), 'The canal was filled in in 1895.', 'only a bare class is rewritten');
// Glossary, from the published texts (Korte Lijnbaanssteeg, Haarlemmerdijk, Albert Cuypstraat).
assert.equal(repairOriginTranslation('Naar de lijnbanen van de touwslagerijen.', 'The line tracks of the rope warehouses.'),
  'The ropewalks of the rope-making works.');
assert.equal(repairOriginTranslation('Vóór de stadsuitleg van 1593.', 'Before the city layout of 1593.'), 'Before the city expansion of 1593.');
assert.equal(repairOriginTranslation('Een plan voor de wijk.', 'A city layout for the district.'), 'A city layout for the district.',
  'a glossary fix applies only where the Dutch says the word');
assert.equal(repairOriginTranslation('Na demping van de Zaagmolensloot.', 'After the damming of the Zaagmolensloot.'),
  'After the filling in of the Zaagmolensloot.');
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
