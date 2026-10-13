/**
 * Match Amsterdam's monumental schools (OSM amenity=school|college|university, filtered to a named shortlist) to BAG
 * pand ids. Open data only.
 *   node --import tsx scripts/landmarks/schools-match.ts   (writes scripts/landmarks/schools.json)
 */
import {runMatch} from './public-match-lib.ts';
const NAMES = 'Barlaeus|Vossius|Amsterdams Lyceum|Rijksakademie|Rietveld|Berlage Lyceum|Montessori Lyceum|Roeterseiland|Roeterstraat|Hogeschool van Amsterdam|Universiteit van Amsterdam|Spinoza|Cygnus|Het 4e Gymnasium|Sweelinck';
await runMatch({
  out: 'scripts/landmarks/schools.json', key: 'schools', refName: 'schools',
  query: `[out:json][timeout:60];(nwr["amenity"~"^(school|college|university)$"]["name"~"${NAMES}"](52.27,4.72,52.44,5.05);nwr["name"~"Rijksakademie"](52.27,4.72,52.44,5.05););out center tags;`,
  source: 'OSM amenity=school|college|university shortlist (Overpass), PDOK Locatieserver + BAG WFS, pand-reference panoramas (CC BY 4.0)',
  // no address tag in OSM: the street address by hand (BAG/PDOK)
  addrOverride: {'Amsterdams Lyceum': 'Valeriusplein 15', 'Gerrit Rietveld Academie': 'Fred. Roeskestraat 98', 'Roeterseiland (UvA)': 'Roetersstraat 11', 'Spinoza Lyceum': 'Spinozastraat 41', 'Hogeschool van Amsterdam': 'Wibautstraat 3b', 'Rietveldschool': 'Fred. Roeskestraat 98'},
  exclude: /Diemen|Duivendrecht|Ouderkerk|Weesp|Amstelveen|Zaanstad/,
});
