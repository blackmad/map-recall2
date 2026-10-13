/**
 * Match Amsterdam civic offices (stadsloketten / stadsdeelkantoren: OSM townhall or office=government named
 * Stadsloket*, Stadsdeel*) to BAG pand ids. Open data only.
 *   node --import tsx scripts/landmarks/civic-offices-match.ts   (writes scripts/landmarks/civic-offices.json)
 * Hand-kept fields (signatureElements, sharedWith, modelStatus) survive a re-run.
 */
import {runMatch} from './public-match-lib.ts';
await runMatch({
  out: 'scripts/landmarks/civic-offices.json', key: 'offices', refName: 'civic-offices',
  query: `[out:json][timeout:60];(nwr["amenity"="townhall"]["name"~"^Stadsloket|^Stadsdeel"](52.27,4.72,52.44,5.05);nwr["office"="government"]["name"~"^Stadsloket|^Stadsdeel"](52.27,4.72,52.44,5.05););out center tags;`,
  source: 'OSM amenity=townhall / office=government Stadsloket*, Stadsdeel* (Overpass), PDOK Locatieserver + BAG WFS, pand-reference panoramas (CC BY 4.0)',
  exclude: /Weesp|Zaanstad|Amstelveen|Diemen/,
});
