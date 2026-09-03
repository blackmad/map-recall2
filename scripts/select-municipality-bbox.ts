/**
 * Print the `osmium extract -b` bbox for one city's municipality.
 *
 * The refresh script uses this to cut a province-sized download down to a
 * city-sized one *after* the boundary has been read, rather than before. That
 * ordering is the whole point: a city extract cut to a guessed bbox can slice
 * through the municipality relation, and an incomplete relation assembles into
 * no polygon at all, which is how Rotterdam failed with
 * "Rotterdam municipality polygon was not found" while its data was right
 * there.
 *
 * Usage: tsx scripts/select-municipality-bbox.ts <boundaries.geojson> <cityName>
 */
import { readFile } from 'node:fs/promises';
import {
  type BoundaryFeature, boundingBox, findMunicipality, hasAreaGeometry, osmiumBbox,
} from './lib/municipality.ts';

const [boundaryFile, cityName] = process.argv.slice(2);
if (!boundaryFile || !cityName) {
  process.stderr.write('usage: select-municipality-bbox.ts <boundaries.geojson> <cityName>\n');
  process.exit(2);
}

const source = JSON.parse(await readFile(boundaryFile, 'utf8')) as { features: BoundaryFeature[] };
const municipality = findMunicipality(source.features, cityName);
if (!municipality || !hasAreaGeometry(municipality)) {
  process.stderr.write(`${cityName}: no admin_level 8 polygon in ${boundaryFile}\n`);
  process.exit(3);
}

process.stdout.write(`${osmiumBbox(boundingBox(municipality.geometry!.coordinates))}\n`);
