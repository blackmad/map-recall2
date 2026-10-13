/**
 * Build `covers.json`: which pands each installed model stands on.
 *
 * Replaces the hand-kept `suppressOsmIds` lists (docs/handoffs/lane-bag-base-tiles-20261013.md,
 * deliverable 3). For every placed model (landmarks, manual and ordinary
 * catalogues, recipe houses, street chunks) the model's ground footprint is
 * joined against the BAG-keyed base tiles: a pand is covered when at least
 * 50% of it lies under the footprint or the footprint holds its centroid.
 * The footprint is the same one `check-osm-under-models` uses (native / plan /
 * rect / GLB occupancy, plus the polygons of the buildings the model already
 * hides), so the two audits cannot disagree about where a model stands.
 *
 * Output is staging: `artifacts/bag-tiles/covers.json`. Publishing it to
 * `public/canal-drive/models/covers.json` is the integrator's step.
 *
 * Usage: tsx scripts/build-covers.ts [--tiles=artifacts/bag-tiles/bag-tiles/14] [--out=artifacts/bag-tiles/covers.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, allSpecs, buildingTypesPlaced, footprintOf,
} from './lib/placedFootprints';
import { loadBagTiles, nearbyPands, resolveSuppressed } from './lib/bagTileIndex';
import { loadCoversReview, reviewKey } from './lib/coversReview';
import { COVERS_VERSION, coversPand, shortPandId, type CoversEntry, type CoversFile } from '../src/canalRecall/bagTiles';
import { ringsFootprint, unionFootprint } from '../src/canalRecall/landmarks/osmUnderModels';

const flag = (name: string): string | undefined => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const tilesDir = flag('tiles') ?? path.join(ROOT, 'artifacts/bag-tiles/bag-tiles/14');
const outFile = flag('out') ?? path.join(ROOT, 'artifacts/bag-tiles/covers.json');

const index = loadBagTiles(tilesDir);
const review = loadCoversReview();
console.log(`bag tiles: ${index.pands.size} pands, ${index.osmOnly.size} OSM-only features, ${index.osmToPands.size} OSM ids aliased`);

const models: Record<string, CoversEntry> = {};
const stats = { kept: 0, models: 0, withFootprint: 0, noFootprint: [] as string[], pandsCovered: 0, suppressOnly: 0, geoOnly: 0, oOnly: 0 };
for (const spec of allSpecs()) {
  stats.models++;
  const {fp} = await footprintOf(spec);
  const suppress = spec.suppressOsmIds.map(String);
  const resolved = resolveSuppressed(index, suppress);
  // Footprint = model outline plus the polygons of what it already hides (as in the OSM-under audit).
  const own = resolved.pands.map(id => index.pands.get(id)!.rings);
  const parts = [...(fp ? [fp] : []), ...(own.length ? [ringsFootprint(own.flat())] : [])];
  const covered = new Set<string>(resolved.pands);
  if (parts.length) {
    stats.withFootprint++;
    const footprint = unionFootprint(parts);
    for (const pand of nearbyPands(index, footprint.bounds)) {
      if (covered.has(pand.id)) continue;
      if (!coversPand(footprint, pand.rings, pand.centroid)) continue;
      // Reviewed neighbours (scripts/covers-review.json 'keep') stay drawn; undecided pands are listed, as before, for check-covers --strict.
      if (review[reviewKey(spec.id, pand.id)]?.decision === 'keep') { stats.kept++; continue; }
      covered.add(pand.id); stats.geoOnly++;
    }
  } else stats.noFootprint.push(spec.id);
  stats.suppressOnly += resolved.pands.length;
  const entry: CoversEntry = { p: [...covered].sort().map(shortPandId) };
  // Suppressed ids that are not a pand: OSM-only outlines the tiles still draw, and ids that match nothing (kept so behaviour is unchanged; check-covers lists them as stale).
  if (resolved.osmOnly.length || resolved.unresolved.length) { entry.o = [...resolved.osmOnly, ...resolved.unresolved].sort(); stats.oOnly += entry.o.length; }
  if (entry.p.length || entry.o) models[spec.id] = entry;
  stats.pandsCovered += entry.p.length;
}

const buildingTypes = buildingTypesPlaced().flatMap(p => [...p.suppress]).map(shortPandId).sort();
const file: CoversFile = { version: COVERS_VERSION, generatedAt: new Date().toISOString(), models, buildingTypes };
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(file)}\n`);
const bytes = fs.statSync(outFile).size;
console.log(`covers: ${Object.keys(models).length}/${stats.models} models with entries (${stats.withFootprint} with a footprint), ${stats.pandsCovered} model-pand links (${stats.suppressOnly} from today's suppress ids, ${stats.geoOnly} from footprint only, ${stats.kept} reviewed neighbours left out), ${stats.oOnly} non-pand ids kept, ${buildingTypes.length} building-type pands`);
console.log(`no footprint and no resolvable suppress ids: ${stats.noFootprint.length}${stats.noFootprint.length ? ` (${stats.noFootprint.slice(0, 8).join(', ')})` : ''}`);
console.log(`wrote ${outFile} (${(bytes / 1024).toFixed(0)} KB raw)`);
