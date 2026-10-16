/**
 * Gate: fails when a city building sits in an angle, notch or courtyard of a placed landmark
 * (>= 50% of it inside the model's convex hull, under 50% under the model) with an abutter score
 * >= NOTCH_GATE_SCORE and no review in scripts/landmarks/landmark-abutters-allowlist.json.
 * That is the Noorderkerk case (2026-10-16): 1623 corner houses of the same monument in the
 * angles of the Greek cross, drawn by the kit as generic blocks.
 *
 * Reviewed `fold-in` / `unclear` entries are printed as known pending (they need a landmark lane);
 * `fine` / `separate-but-wrong` entries are accepted. Reviews whose building is no longer a
 * candidate (suppressed since) are listed as stale so the allowlist can be pruned.
 *
 * Geometry and scoring: src/canalRecall/landmarks/landmarkAbutters.ts. Evidence (bouwjaar, monument
 * numbers, OSM tags) comes from the committed snapshot scripts/landmarks/landmark-abutters-facts.json;
 * a tile id the snapshot never saw is scored on geometry alone. Refresh and the full survey:
 * scripts/landmarks/survey-landmark-abutters.ts.
 *
 * Usage: tsx scripts/check-landmark-abutters.ts [--verbose] [model-id ...]
 */
import fs from 'node:fs';
import {ALLOWLIST, candidatesFor, claimedIds, landmarkModels, readFacts, scoreCandidates} from './lib/landmarkAbutterCandidates';
import {gate, NOTCH_GATE_SCORE, type AbutterReview, type GateHit} from '../src/canalRecall/landmarks/landmarkAbutters';
import {readJson} from './lib/placedFootprints';

const args = process.argv.slice(2), verbose = args.includes('--verbose'), only = args.filter(a => !a.startsWith('--'));
const reviews: Record<string, Record<string, AbutterReview>> = fs.existsSync(ALLOWLIST) ? readJson(ALLOWLIST) : {};
const facts = readFacts();
if (!facts) console.log('warning: no landmark-abutters-facts.json; scoring on geometry only');
const {models} = await landmarkModels(only);
const claimed = claimedIds(), hits: (GateHit & {terms: string})[] = [], seen = new Set<string>();
for (const m of models) for (const c of scoreCandidates(m, candidatesFor(m, claimed), facts)) {
  seen.add(`${m.id}|${c.tile.id}`);
  hits.push({model: m.id, id: c.tile.id, score: c.score, categories: c.geometry.categories, terms: c.terms.map(t => t.signal).join(',')});
}
const {fail, pending} = gate(hits, reviews);
const stale = Object.entries(reviews).filter(([m]) => !only.length || only.includes(m)).flatMap(([m, r]) => Object.keys(r).filter(id => !seen.has(`${m}|${id}`)).map(id => `${m} ${id} (${r[id].verdict})`));
for (const p of pending) console.log(`known pending ${p.review.verdict}: ${p.model} ${p.id} score ${p.score} - ${p.review.reason.slice(0, 100)}`);
if (verbose) for (const s of stale) console.log(`stale review (no longer a candidate; prune): ${s}`);
for (const f of fail) console.log(`UNREVIEWED notch abutter: ${f.model} ${f.id} score ${f.score} [${f.categories.join(',')}] (${hits.find(h => h.model === f.model && h.id === f.id)!.terms})`);
console.log(`landmark-abutters: ${models.length} landmarks, ${hits.length} abutter candidates, ${hits.filter(h => h.categories.includes('notch') && h.score >= NOTCH_GATE_SCORE).length} notch >= ${NOTCH_GATE_SCORE}; ${pending.length} known pending, ${stale.length} stale reviews, ${fail.length} unreviewed`);
if (fail.length) console.log('Review each with scripts/landmarks/abutter-photos.ts and add it to scripts/landmarks/landmark-abutters-allowlist.json (verdict + reason + evidence), or suppress/fold it into the landmark.');
process.exit(fail.length ? 1 : 0);
