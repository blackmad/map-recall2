/**
 * Match Amsterdam hospitals (OSM amenity=hospital) to BAG pand ids. Open data only.
 *   node --import tsx scripts/landmarks/hospitals-match.ts   (writes scripts/landmarks/hospitals.json)
 * Hand-kept fields (signatureElements, sharedWith, modelStatus) survive a re-run. Campuses are many pands: the
 * entrance building and the street-facing wing are the ones modelled; the list says which pands each row covers.
 */
import {runMatch} from './public-match-lib.ts';
await runMatch({
  out: 'scripts/landmarks/hospitals.json', key: 'hospitals', refName: 'hospitals',
  query: `[out:json][timeout:60];(nwr["amenity"="hospital"]["name"](52.27,4.72,52.44,5.05););out center tags;`,
  source: 'OSM amenity=hospital (Overpass), PDOK Locatieserver + BAG WFS, pand-reference panoramas (CC BY 4.0)',
  // OSM maps these campuses as areas without an address tag: the main entrance address by hand (BAG/PDOK)
  addrOverride: {'Amsterdam UMC locatie AMC': 'Meibergdreef 9', 'Antoni van Leeuwenhoek': 'Plesmanlaan 121', 'BovenIJ Ziekenhuis': 'Statenjachtstraat 1', 'OLVG, locatie Oost': 'Oosterpark 9'},
  exclude: /Diemen|Duivendrecht|Ouderkerk|Weesp|Amstelveen|Zaanstad/,
});
