/**
 * Compare `covers.json` (model -> pands it stands on, built by build-covers.ts)
 * with today's hand-kept `suppressOsmIds`, through the OSM<->pand map in the
 * BAG-keyed base tiles.
 *
 * Reports, per the lane handoff (deliverable 3):
 *   hidden bugs  pands a model covers by footprint that its suppress list does not hide today
 *   alias-only   suppress ids that name an OSM way/relation of a pand, not the pand's tile id,
 *                so they hide nothing in the BAG-keyed tiles today but covers will hide the pand
 *   houseboats   suppress ids that name a boat in houseboats.json: boats are drawn from their own chunk,
 *                never from the BAG tiles, so they are live ids, not stale (prune-stale-suppress must keep them)
 *   stale        suppress ids that match no tile feature, no pand alias and no houseboat (no covering pand)
 * and fails (exit 1) on covers.json inconsistencies: a pand listed that is not in the tiles,
 * a directly-suppressed pand missing from its model's entry, a pand listed that covers-review.json keeps drawn, or a model with no entry at all
 * whose suppress list resolves to something. `--strict` also fails on hidden bugs.
 *
 * Usage: tsx scripts/check-covers.ts [--tiles=dir] [--covers=file] [--strict] [--verbose]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, allSpecs } from './lib/placedFootprints';
import { loadBagTiles, resolveSuppressed } from './lib/bagTileIndex';
import { loadCoversReview, reviewKey } from './lib/coversReview';
import { fullPandId, type CoversFile } from '../src/canalRecall/bagTiles';

const flag = (name: string): string | undefined => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const strict = process.argv.includes('--strict'), verbose = process.argv.includes('--verbose');
const tilesDir = flag('tiles') ?? [path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14'), path.join(ROOT, 'artifacts/bag-tiles/bag-tiles/14')].find(fs.existsSync)!;
const coversFile = flag('covers') ?? [path.join(ROOT, 'public/canal-drive/models/covers.json'), path.join(ROOT, 'artifacts/bag-tiles/covers.json')].find(fs.existsSync)!;
if (!tilesDir || !coversFile) { console.error('missing bag tiles or covers.json: run `node --import tsx scripts/build-bag-buildings.ts --tiles` and scripts/build-covers.ts first'); process.exit(2); }

const index = loadBagTiles(tilesDir);
const review = loadCoversReview();
const covers = JSON.parse(fs.readFileSync(coversFile, 'utf8')) as CoversFile;
const boatIds = new Set<string>((JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/houseboats.json'), 'utf8')).boats as {id: string}[]).map(b => b.id));
const houseboats: string[] = [];
const problems: string[] = [];
const hidden: string[] = [], reviewedHide: string[] = [], aliasOnly: string[] = [], stale: string[] = [];
let suppressIds = 0, effective = 0;

for (const spec of allSpecs()) {
  const ids = spec.suppressOsmIds.map(String);
  suppressIds += ids.length;
  const resolved = resolveSuppressed(index, ids);
  effective += resolved.direct.length + resolved.osmOnly.length;
  const entry = covers.models[spec.id];
  const covered = new Set((entry?.p ?? []).map(fullPandId));
  for (const id of covered) if (!index.pands.has(id)) problems.push(`${spec.id}: covers lists ${id}, which is not in the tiles`);
  for (const id of resolved.pands) if (!covered.has(id)) problems.push(`${spec.id}: suppresses ${id} but covers does not list it`);
  for (const id of resolved.osmOnly) if (!entry?.o?.includes(id)) problems.push(`${spec.id}: suppresses OSM-only ${id} but covers does not keep it`);
  // A pand reviewed 'keep' for this model is a neighbour that stays drawn: listing it hides a real building (Felix Meritis's rear house,
  // un-suppressed 2026-10-23, was still hidden by a covers.json built the week before).
  for (const id of covered) if (review[reviewKey(spec.id, id)]?.decision === 'keep') problems.push(`${spec.id}: covers lists ${id}, reviewed 'keep' (a neighbour that stays drawn) in scripts/covers-review.json: rebuild covers.json`);
  const today = new Set(resolved.direct);
  const viaAlias = new Set(resolved.viaAlias);
  for (const id of covered) {
    if (today.has(id)) continue;
    if (viaAlias.has(id)) aliasOnly.push(`${spec.id} ${id}`);
    else if (review[reviewKey(spec.id, id)]?.decision === 'hide') reviewedHide.push(`${spec.id} ${id}`);
    else hidden.push(`${spec.id} ${id}`);
  }
  for (const id of resolved.unresolved) (boatIds.has(id) ? houseboats : stale).push(`${spec.id} ${id}`);
}
// Named regressions (issue #123, 2026-10-30): a 2026-10-13 stale-prune deleted these boat ids because boats are not in the
// BAG tiles, and the generic houseboat box drew through the Sea Palace pagoda and the Houseboat Museum model.
const REQUIRED_BOAT_SUPPRESS: Record<string, string> = { 'sea-palace': 'w454006714', 'houseboat-museum': 'w174999382' };
for (const [model, boat] of Object.entries(REQUIRED_BOAT_SUPPRESS)) {
  const spec = allSpecs().find(s => s.id === model);
  if (!spec) problems.push(`${model}: spec missing (regression REQUIRED_BOAT_SUPPRESS)`);
  else if (!spec.suppressOsmIds.map(String).includes(boat)) problems.push(`${model}: must suppress its houseboat ${boat}, or the generic boat box draws through the model`);
  if (!boatIds.has(boat)) problems.push(`${model}: houseboat ${boat} is no longer in houseboats.json; re-key REQUIRED_BOAT_SUPPRESS`);
}
const btCovered = new Set(covers.buildingTypes.map(fullPandId));
for (const id of btCovered) if (!index.pands.has(id)) stale.push(`building-types ${id} (instance pand not in the tiles)`);

const show = (title: string, rows: string[]) => {
  console.log(`${title}: ${rows.length}`);
  for (const row of rows.slice(0, verbose ? rows.length : 12)) console.log(`  ${row}`);
  if (!verbose && rows.length > 12) console.log(`  ... ${rows.length - 12} more (--verbose)`);
};
console.log(`covers join: ${Object.keys(covers.models).length} model entries, ${covers.buildingTypes.length} building-type pands; ${suppressIds} suppressOsmIds in ${allSpecs().length} specs, ${effective} effective in the BAG-keyed tiles`);
show('reviewed hide (footprint-only, decided in scripts/covers-review.json: part of the model)', reviewedHide);
show('hidden bugs (covered by footprint, not hidden by suppressOsmIds today)', hidden);
show('alias-only (suppress id is an OSM alias of a covered pand, hides nothing in BAG-keyed tiles today)', aliasOnly);
show('houseboats (suppress id is a houseboats.json boat, hidden in the boats chunk)', houseboats);
show('stale (suppress id matches no tile feature and no pand alias)', stale);
for (const p of problems.slice(0, 30)) console.log(`PROBLEM ${p}`);
const fail = problems.length > 0 || (strict && hidden.length > 0);
console.log(fail ? `covers check FAILED (${problems.length} inconsistencies${strict ? `, ${hidden.length} hidden bugs` : ''})` : `covers check ok${hidden.length ? ` (${hidden.length} hidden bugs reported, not failing; use --strict)` : ''}`);
process.exit(fail ? 1 : 0);
