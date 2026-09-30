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
assert.equal(repairOriginTranslation('Een schans is een aarden wal en als zodanig is de Oudeschans gebouwd.', 'A bastion is an earthen wall and as such the Oudeschans was built.'),
  'A rampart is an earthen wall and as such the Oudeschans was built.');
assert.equal(nameGenericOrigin('Lauriergracht', 'The South European ornamental tree', { laurier: 'laurel' }), 'Named after the laurel, a South European ornamental tree.');
assert.equal(repairOriginTranslation('Van 1974 tot 1980 lid van de Eerste Kamer.', 'From 1974 to 1980 member of the House of Lords.'),
  'From 1974 to 1980 member of the Senate (Eerste Kamer).');
assert.equal(repairOriginTranslation('De oude schutterij kreeg in 1522 geweren of kloveren.', 'In 1522 the old shooting club received rifles or crossbows.'),
  'In 1522 the old civic guard received firearms (klovers, or arquebuses).');
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

// Direction and English names (Vondelkerkstraat, Den Brielstraat, Jan Evertsenstraat).
assert.equal(repairOriginTranslation('De straat is onder deze naam van de gemeente Nieuwer-Amstel overgenomen.',
  'The street was taken over by the municipality of Nieuwer-Amstel under this name.'),
  'The street was taken over from the municipality of Nieuwer-Amstel under this name.', 'annexed, not handed over');
assert.equal(repairOriginTranslation('Den Briel werd in 1572 als eerste stad door de geuzen op de Spanjaarden veroverd.',
  'Den Briel was the first city to be conquered by the Gueux on the Spaniards in 1572.'),
  'Den Briel was the first city to be taken from the Spanish by the Geuzen in 1572.');
assert.equal(repairOriginTranslation('Zeeuws geslacht. Slag bij Duins (1639). Gesneuveld in de Tweede Engelse oorlog.',
  'Zeelandish family. Battle of Duins (1639). Killed in the Second English War.'),
  'Zeeland family. Battle of the Downs (1639). Killed in the Second Anglo-Dutch War.');

assert.equal(repairOriginTranslation('De Valkenweg-pont werd daardoor Adelaarsweg-pont.', 'The Valkenweg bridge was therefore renamed Adelaarsweg-pont.'),
  'The Valkenweg ferry was therefore renamed Adelaarsweg-pont.', 'a pont is a ferry');
assert.equal(repairOriginTranslation('de veerman die de watergeuzen hielp', 'the ferryman who helped the water gunners'),
  'the ferryman who helped the Sea Beggars (watergeuzen)');
assert.equal(repairOriginTranslation('per boekenkist', 'he managed to escape in 1621 through a bookcase.'), 'he managed to escape in 1621 in a book chest.');
assert.equal(repairOriginTranslation('Letterkundige (1876-1931).', 'Literary (1876-1931).'), 'Man of letters (1876-1931).');
assert.equal(repairOriginTranslation('Het werelddeel.', 'The world region.'), 'The continent.');
assert.equal(repairOriginTranslation('x', 'they stayed in a inn, a embankment, a one-year plant.'), 'they stayed in an inn, an embankment, a one-year plant.',
  'a/an only before the listed words');

assert.equal(repairOriginTranslation('Met het rooien van de straten en de bebouwing werd in 1664 begonnen.',
  'The demolition of the streets and buildings began in 1664.'), 'Laying out the streets and building began in 1664.', 'rooien lays streets out');
assert.equal(repairOriginTranslation('1 x winnaar Wereldbeker', '1 x winner World Cup, played two World Cup finals'),
  '1 x winner Intercontinental Cup (Wereldbeker), played two World Cup finals', 'the finals stay the World Cup');
assert.equal(repairOriginTranslation('Geïnspireerd door Indische en Arabische muziek.', 'Inspired by Indian and Arabic music.'),
  'Inspired by Indian and Arabic music.', 'Indian music is Indian');
assert.equal(repairOriginTranslation('in dienst van de West-Indische Compagnie', 'in service of the West Indian Company'), 'in service of the West India Company');

assert.equal(repairOriginTranslation('Johan de Witt, raadpensionaris van Holland', 'Johan de Witt, council pensionary of Holland'), 'Johan de Witt, Grand Pensionary of Holland');
assert.equal(repairOriginTranslation('Een Ringvaart is de boezem van een polder.', 'A canal is the bosom of a polder.'),
  'A ring canal (ringvaart) is the storage basin (boezem) of a polder.');

// Repair runs before the stem rewrite (as the publish script does), so a
// class the glossary renames must stay a class (Mezenstraat, 2026-09-30).
assert.equal(nameGenericOrigin('Mezenstraat', repairOriginTranslation('De zangvogel.', 'The singing bird.'), { mezen: 'tit' }),
  'Named after the tit, a songbird.');

assert.equal(repairOriginTranslation('Jhr. George Gerard Clifford (1779-1847). Thesaurier van Amsterdam.',
  'Mr. George Gerard Clifford (1779-1847). Thesaurus of Amsterdam.'), 'Jonkheer George Gerard Clifford (1779-1847). Treasurer of Amsterdam.');
assert.equal(repairOriginTranslation('Mr. Hendrik Ludolf Wichers (1800-1853).', 'Mr. Hendrik Ludolf Wichers (1800-1853).'),
  'Mr. Hendrik Ludolf Wichers (1800-1853).', 'a Dutch law degree (mr.) is not a jonkheer');
assert.equal(repairOriginTranslation('Griffier van de Staten van Utrecht (1550-1618).', 'Treasurer of the States of Utrecht (1550-1618).'),
  'Clerk (griffier) of the States of Utrecht (1550-1618).');

assert.equal(repairOriginTranslation('De overtoom was ter hoogte van de Nieuwendijk.', 'The quay was at the level of the Nieuwendijk.'),
  'The overtoom (a slipway for hauling boats over a dam) was at the level of the Nieuwendijk.');
assert.equal(repairOriginTranslation('Toen hij verongelukte', 'When he was killed in a car accident'), 'When he died in an accident', 'no car in the source');

assert.equal(repairOriginTranslation('Een vonder is een smalle houten verbinding over een water.', 'A viaduct is a narrow wooden connection over a body of water.'),
  'A vonder is a narrow wooden footbridge over a body of water.');
assert.equal(repairOriginTranslation('Een van de boerengeneraals van Oranje Vrijstaat.', 'One of the farmer generals of the Orange Free State.'),
  'One of the Boer generals of the Orange Free State.');

assert.equal(repairOriginTranslation('Kasteel onder Haelen. Onder Michiel de Ruyter.', 'Castle under Haelen. Vice-admiral under Michiel de Ruyter.'),
  'Castle near Haelen. Vice-admiral under Michiel de Ruyter.', 'a place near, a commander under');
assert.equal(repairOriginTranslation('Ook wel zwaardwalvis.', 'Also known as swordfish, black.'), 'Also known as the killer whale (zwaardwalvis), black.');

assert.equal(repairOriginTranslation('De straat is onder de naam Ringlaan van de vroegere gemeente Watergraafsmeer overgekomen.',
  'The street has been renamed Ringlaan from the former municipality of Watergraafsmeer.'),
  'The street came over from the former municipality of Watergraafsmeer under the name Ringlaan.', 'came over under a name, not renamed');
assert.equal(repairOriginTranslation('namens de PVDA wethouder Onderwijs', 'was from 1979 to 1983 a member of parliament for the PVDA as a councillor for Education'),
  'was from 1979 to 1983 alderman for the PvdA, responsible for Education');

assert.equal(repairOriginTranslation('Wim Suurbier, rechter verdediger. 3 x winnaar Europa Cup Landskampioenen',
  'Wim Suurbier, lawyer and defender. 3 x winner European Cup Winners\' Cup'), 'Wim Suurbier, right back. 3 x winner European Cup',
  'a rechter verdediger is a right back, and the Landskampioenen cup is the European Cup');
assert.equal(repairOriginTranslation('Voor de Gedempte Nieuwe Looierssloot zie ...', 'For the Drowned Nieuwe Looierssloot, see ...'),
  'For the filled-in Nieuwe Looierssloot, see ...');

assert.equal(repairOriginTranslation('de Tweede, Derde en Vierde Boerhaavestraat; Eerste Hulp',
  'For the Second, Third and Fourth Boerhaavestraat; First Aid; the Second Anglo-Dutch War; First and Second Wetering Plantsoen'),
  'For the Tweede, Derde and Vierde Boerhaavestraat; First Aid; the Second Anglo-Dutch War; Eerste and Tweede Weteringplantsoen',
  'ordinals stay Dutch only in street names');

assert.equal(repairOriginTranslation('De Korte Geuzenstraat. Anne Frank is in 1945 in het vernietigingskamp Bergen-Belsen overleden.',
  'The Short Geuzenstraat. Anne Frank died in the Bergen-Belsen extermination camp in 1945. A short walk.'),
  'The Korte Geuzenstraat. Anne Frank died in the Bergen-Belsen concentration camp in 1945. A short walk.');

assert.equal(repairOriginTranslation('even voor 1600 bij de stad getrokken', 'drawn to the city just before 4:00 PM, there is talk'),
  'drawn to the city just before 1600, there is talk', 'a year read as a clock time, capitals too');
assert.equal(repairOriginTranslation('de pretentieloze, uit de losse pols geschoten foto', 'the pretentious, candid photo'), 'the unpretentious, candid photo');

assert.equal(repairOriginTranslation('Middeleeuws lied over een vrouwenmoordenaar die zelf door een prinses vermoord wordt.',
  'Medieval song about a female murderer who is herself murdered by a princess.'),
  'Medieval song about a murderer of women who is himself killed by a princess.');

assert.equal(repairOriginTranslation('Een breeuwer dichtte de naden. De lakenindustrie.', 'A brewer sealed the seams. The linen industry.'),
  'A caulker (breeuwer) sealed the seams. The cloth (laken) industry.');

assert.equal(repairOriginTranslation('De goudvink (Pyrrhula pyrrhula).', 'The goldfinch (Pyrrhula pyrrhula). Goldfinches can be found here.'),
  'The bullfinch (Pyrrhula pyrrhula). Bullfinches can be found here.', 'a goudvink is a bullfinch');
assert.equal(repairOriginTranslation('De gierzwaluw (Apus apus).', 'The swallow (Apus apus). Swallows fly.'), 'The swift (Apus apus). Swifts fly.');

assert.equal(repairOriginTranslation('De plant, wild en gekweekt. wordt ook klaproos genoemd.', 'The plant, wild and cultivated. is also called buttercup.'),
  'The plant, wild and cultivated. Also called klaproos (corn poppy).', 'a papaver is a poppy, not a buttercup');
assert.equal(repairOriginTranslation('Bloem, behorende tot de anjerfamilie.', 'Flower, belonging to the rose family.'), 'Flower, belonging to the pink (carnation) family.');
assert.equal(repairOriginTranslation('Plant uit de schermbloemenfamilie.', 'Plant from the aster family.'), 'Plant from the carrot (umbellifer) family.');
assert.equal(repairOriginTranslation('Ook wel rode bosbes. De vossenbes.', 'Also known as red currant. The foxberry.'), 'Also known as lingonberry (cowberry). The lingonberry.');
assert.equal(repairOriginTranslation("Tot 1863 ... zogenaamde 'bomen' ... de boomklok geluid.",
  "Until 1863, the city of the IJ was separated by a palisade, so-called 'trees'. When opening the 'trees', the tree bell was sounded."),
  "Until 1863, the city was separated from the IJ by a palisade, so-called 'bomen' (booms). When opening the booms, the boom bell (boomklok) was sounded.");
assert.equal(repairOriginTranslation('Vervaardigde een elektriseermachine.', 'Developed an electroplating machine.'), 'Developed an electrostatic generator.');

process.stdout.write('Street-name origin checks passed\n');
