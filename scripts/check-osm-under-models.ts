/**
 * Fails when an OSM/BAG building from the city tiles lies (>= 50% of its area)
 * inside a placed model's ground footprint but is not in that model's
 * suppressOsmIds, i.e. the plain extrusion is drawn through the model.
 * Geometry lives in src/canalRecall/landmarks/osmUnderModels.ts.
 *
 * Models checked: every placed model the game draws (PLACED_MODELS: surveyed
 * landmarks, manual catalogue + hospitals, ordinary buildings), plus street
 * chunks and building-types instances. Footprint, best source first:
 *   native   scripts/landmarks/<id>-footprints.json nativeRing + anchor
 *   plan     spec.buildingFootprint (ordinary / chunk native plans)
 *   rect     spec.footprint oriented rectangle (only when no GLB could be placed)
 *   glb      occupancy raster of the GLB placed at the surveyed anchor (tris above 2.5 m)
 * The tiles' polygons for the model's own suppressOsmIds are always added.
 *
 * Reviewed exclusions live in scripts/landmarks/osm-under-models-allowlist.json ({modelId: {osmId: reason}}).
 *
 * Usage: tsx scripts/check-osm-under-models.ts [--verbose] [--json=out.json] [model-id ...]
 */
import fs from 'node:fs';
import {ROOT, readJson, allSpecs, footprintOf, kindOf, buildingTypesPlaced, indexAround, byIdIndex, buildingsIn, type Placed} from './lib/placedFootprints';
import {outerRings, ringsFootprint, unionFootprint, orientedRectRing, unsuppressedUnder, type Footprint, type LngLat, type TileBuilding} from '../src/canalRecall/landmarks/osmUnderModels';

const ALLOWLIST = `${ROOT}/scripts/landmarks/osm-under-models-allowlist.json`;

/** Dev aid: how well does the placed GLB occupancy match the native/plan outline (validates the placement maths)? */
async function calibrate() {
  const rows: string[] = [];
  for (const spec of allSpecs()) {
    const {named} = await footprintOf(spec, true);
    const plan = spec.buildingFootprint ? ringsFootprint(outerRings(spec.buildingFootprint as {type: string; coordinates: unknown})) : null;
    const rect = !spec.surveyed && spec.footprint ? ringsFootprint([orientedRectRing(spec.footprint.centre, spec.footprint.headingDegrees, spec.footprint.lengthMetres, spec.footprint.widthMetres)]) : null;
    const ref = named.native ?? plan ?? rect, glb = named.glb;
    if (!ref || !glb) continue;
    const sample = (a: Footprint, b: Footprint) => { let n = 0, k = 0; for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) { const p: LngLat = [a.bounds.w + (i + .5) / 40 * (a.bounds.e - a.bounds.w), a.bounds.s + (j + .5) / 40 * (a.bounds.n - a.bounds.s)]; if (a.contains(p)) { n++; if (b.contains(p)) k++; } } return n ? k / n : 0; };
    rows.push(`${spec.id}: native covered by glb ${sample(ref, glb).toFixed(2)}, glb inside native ${sample(glb, ref).toFixed(2)}`);
  }
  console.log(rows.join('\n'));
}
async function main() {
  if (process.argv.includes('--calibrate')) return calibrate();
  const args = process.argv.slice(2), verbose = args.includes('--verbose'), only = args.filter(a => !a.startsWith('--')), jsonOut = args.find(a => a.startsWith('--json='))?.slice(7);
  const allow: Record<string, Record<string, string>> = fs.existsSync(ALLOWLIST) ? readJson(ALLOWLIST) : {};
  const report: {model: string; kind: string; source: string; hits: ReturnType<typeof unsuppressedUnder>}[] = [];
  const placed: Placed[] = [];
  for (const spec of allSpecs()) {
    if (only.length && !only.includes(spec.id)) continue;
    const {fp, source} = await footprintOf(spec);
    placed.push({id: spec.id, kind: kindOf(spec), suppress: new Set(spec.suppressOsmIds.map(String)), fp, source, centre: (spec.surveyed?.anchor ?? spec.footprint?.centre ?? [0, 0]) as LngLat});
  }
  // Ids hidden by ANY placed model (also under an `only` filter) are not "drawn through" another model.
  const claimed = new Map<string, string>();
  for (const spec of allSpecs()) for (const id of spec.suppressOsmIds) if (!claimed.has(String(id))) claimed.set(String(id), spec.id);
  const bt = buildingTypesPlaced();
  for (const p of bt) for (const id of p.suppress) if (!claimed.has(id)) claimed.set(id, p.id);

  const checked: Record<string, number> = {}, bySource: Record<string, number> = {}, hitsByKind: Record<string, number> = {}, skipped: string[] = [];
  let bad = 0;
  for (const p of [...placed, ...bt]) {
    // Footprint = model outline plus the polygons of the buildings it already hides.
    indexAround(p.centre);
    const own = [...p.suppress].map(id => byIdIndex.get(id)).filter((b): b is TileBuilding => !!b).flatMap(b => b.rings);
    const parts = [...(p.fp ? [p.fp] : []), ...(own.length ? [ringsFootprint(own)] : [])];
    if (!parts.length) { skipped.push(p.id); continue; }
    const footprint = unionFootprint(parts);
    checked[p.kind] = (checked[p.kind] ?? 0) + 1; bySource[p.source] = (bySource[p.source] ?? 0) + 1;
    const claimedElsewhere = new Set([...claimed].filter(([, owner]) => owner !== p.id).map(([id]) => id));
    const hits = unsuppressedUnder(footprint, buildingsIn(footprint.bounds), p.suppress, claimedElsewhere).filter(h => !allow[p.id]?.[h.id]);
    if (hits.length) {
      report.push({model: p.id, kind: p.kind, source: p.source, hits});
      bad++; hitsByKind[p.kind] = (hitsByKind[p.kind] ?? 0) + 1;
      console.log(`${p.id} [${p.kind}, footprint ${p.source}] unsuppressed: ${hits.map(h => `${h.id} (${Math.round(h.overlap * 100)}% inside, ${h.height ?? '?'}m, ${Math.round(h.areaM2)}m2)`).join('; ')}`);
    } else if (verbose) console.log(`ok ${p.id} [${p.kind}, ${p.source}]`);
  }
  const total = Object.values(checked).reduce((a, b) => a + b, 0);
  console.log(`OSM-under check: ${total} models (${Object.entries(checked).map(([k, v]) => `${k} ${v}`).join(', ')}); footprint sources ${JSON.stringify(bySource)}; ${skipped.length} without footprint${skipped.length ? ` (${skipped.slice(0, 8).join(', ')}${skipped.length > 8 ? ', ...' : ''})` : ''}; ${bad} with unsuppressed OSM buildings${bad ? ` ${JSON.stringify(hitsByKind)}` : ''}`);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
  process.exit(bad ? 1 : 0);
}
await main();
