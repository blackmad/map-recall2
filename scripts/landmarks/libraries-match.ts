/**
 * Match Amsterdam OBA library branches (OSM amenity=library, operator OBA) to BAG pand ids. Open data only.
 *   node --import tsx scripts/landmarks/libraries-match.ts   (writes scripts/landmarks/libraries.json)
 * Hand-kept fields (signatureElements, sharedWith, modelStatus) survive a re-run.
 */
import {runMatch} from './public-match-lib.ts';
await runMatch({
  out: 'scripts/landmarks/libraries.json', key: 'libraries', refName: 'libraries',
  query: `[out:json][timeout:60];(nwr["amenity"="library"]["operator"~"OBA"](52.27,4.72,52.44,5.05);nwr["amenity"="library"]["name"~"^OBA"](52.27,4.72,52.44,5.05););out center tags;`,
  source: 'OSM amenity=library operator OBA (Overpass), PDOK Locatieserver + BAG WFS, pand-reference panoramas (CC BY 4.0)',
  exclude: /Diemen|Duivendrecht|Ouderkerk|Weesp|Amstelveen|Zaanstad/,
});
