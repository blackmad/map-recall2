// The stamp catalogue (issue #283): one stamp per buurt, and a buurt is a
// named boundary of a ranked kind in public/data/extracts/amsterdam/boundaries.json
// (the same rule the game uses to stamp one, landmarkData.ts buildNeighborhoods,
// and the knowledge map draws, knowledgeMap.ts BUURT_KIND_RANKS). Kept as a
// list so the landing, the arrival card and the album count against the same
// total without loading 130 kB of boundaries; stampCatalogue.test.ts fails
// when the extract and this list drift.

export const AMSTERDAM_STAMP_BUURTS: readonly string[] = Object.freeze([
  'Apollobuurt', 'Betondorp', 'Borneo-eiland', 'Buitenveldert', 'Buitenveldert-West', 'Centrum',
  'Chassébuurt', 'Czaar Peterbuurt', 'Da Costabuurt', 'De Baarsjes', 'De Pijp', 'Diamantbuurt',
  'Duivelseiland', 'Floradorp', 'Frederik Hendrikbuurt', 'Funenpark', 'Gelderlandpleinbuurt',
  'Gouden Bocht', 'Grachtengordel', 'Helmersbuurt', 'Hoofddorppleinbuurt', 'Hoofdweg e.o.',
  'Houthaven', 'IJburg', 'IJselbuurt', 'Java-eiland', 'Jordaan', 'Kadijken', 'Karlskrona-eiland',
  'Kattenburg', 'Kinkerbuurt', 'KNSM-eiland', 'Landlust', 'Libau-eiland', 'Marineterrein',
  'Memeleiland', 'Molenwijkpark', 'Museumkwartier', 'Narva-eiland', 'Nieuw-West', 'Nieuwe Pijp',
  'Nieuwmarkt/Lastage', 'Nieuwmarktbuurt', 'Noord', 'Oost', 'Oostelijk Havengebied',
  'Oostelijke Eilanden', 'Oostenburg', 'Oosterdokseiland', 'Oud-Zuid', 'Oude Pijp', 'Overhoeks',
  'Overtoomse Sluis', 'Plantage', 'Polder Meerzicht', 'Prinses Irenebuurt e.o.', 'Rapenburg',
  'Revaleiland', 'Rijnbuurt', 'Rivierenbuurt', 'Scheldebuurt', 'Schinkelbuurt', 'Slotervaart',
  'Sluisbuurt', 'Spaarndammerbuurt', 'Sporenburg', 'Sportheldenbuurt', 'Staatsliedenbuurt',
  'Stadionbuurt', 'Stettineiland', 'Tuindorp Nieuwendam', 'Uilenburg', 'Valkenburg',
  'Van Galenbuurt', 'Van Lennepbuurt', 'Vivaldi', 'Vondelparkbuurt', 'VU-kwartier', 'Weesp',
  'Weesperbuurt', 'West', 'Westindische Buurt', 'Westpoort', 'Wiborgeiland', 'Willemspark',
  'Wittenburg', 'Zuid', 'Zuidas', 'Zuidoost',
]);
