/**
 * Rewrite the `distractors` field on every bridge in the published extract so
 * the four options are bridges you could believably be standing on.
 *
 * `build-amsterdam-extract.ts` drew them from the twelve highest-scoring
 * bridges in the city, so all 300 bridges shared a 13-name pool. This pass
 * replaces that with same-water bridges first, nearest bridges after.
 *
 * Both inputs are already cached extracts, so this is a pure local derivation —
 * no Overpass round trip. It writes to a staging path and reports coverage plus
 * a diff against what is published; `--publish` promotes it.
 *
 *   npx tsx scripts/build-bridge-distractors.ts
 *   npx tsx scripts/build-bridge-distractors.ts --publish
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BridgeCrossingIndex } from '../src/canalRecall/bridgeCrossings';
import {
  pickBridgeDistractors, reportBridgeDistractors, type BridgeDistractorCandidate,
} from '../src/canalRecall/bridgeDistractors';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extractDir = resolve(root, 'public/data/extracts/amsterdam');
const publishedPath = resolve(extractDir, 'bridges.json');
const stagingPath = resolve(extractDir, 'staging/bridges.json');

/** The same register numbers the crossing builder and the runtime drop. */
const GENERIC_BRIDGE_NAME = /^(brug|bridge)\s*\d+$/i;

interface BridgeFeature {
  id: string;
  name: string;
  center: [number, number];
  distractors?: string[];
  [key: string]: unknown;
}

const bridges = JSON.parse(readFileSync(publishedPath, 'utf8')) as BridgeFeature[];
const crossings = JSON.parse(
  readFileSync(resolve(extractDir, 'bridge-crossings.json'), 'utf8'),
) as BridgeCrossingIndex;

const candidates: BridgeDistractorCandidate[] = bridges
  .filter((bridge) => bridge.name && !GENERIC_BRIDGE_NAME.test(bridge.name))
  .map((bridge) => ({
    id: bridge.id,
    name: bridge.name,
    center: bridge.center,
    waterways: (crossings.bridges[bridge.id] ?? [])
      .map((crossing) => crossing.waterway)
      .filter((waterway): waterway is string => !!waterway),
  }));

const assigned = new Map<string, string[]>();
for (const candidate of candidates) {
  assigned.set(candidate.id, pickBridgeDistractors(candidate, candidates, {
    exclude: (name) => GENERIC_BRIDGE_NAME.test(name),
  }));
}

const before = reportBridgeDistractors(
  new Map(bridges.filter((b) => assigned.has(b.id)).map((b) => [b.id, b.distractors ?? []])),
  candidates,
);
const after = reportBridgeDistractors(assigned, candidates);

const withWaterway = candidates.filter((candidate) => (candidate.waterways ?? []).length > 0).length;
console.log(`Bridges:                 ${bridges.length} (${candidates.length} named, register numbers skipped)`);
console.log(`Waterway known:          ${withWaterway} (${(100 * withWaterway / candidates.length).toFixed(1)}%)`);
console.log('');
console.log('                         before   after');
console.log(`Distinct names offered   ${String(before.distinctNames).padStart(6)}  ${String(after.distinctNames).padStart(6)}`);
console.log(`Full four options        ${String(before.complete).padStart(6)}  ${String(after.complete).padStart(6)}`);
console.log(`With a same-water option ${String(before.withSameWater).padStart(6)}  ${String(after.withSameWater).padStart(6)}`);
console.log(`Median option distance   ${String(before.medianDistractorMetres).padStart(5)}m  ${String(after.medianDistractorMetres).padStart(5)}m`);

const changed = candidates.filter((candidate) => {
  const bridge = bridges.find((b) => b.id === candidate.id);
  return JSON.stringify(bridge?.distractors ?? []) !== JSON.stringify(assigned.get(candidate.id));
});
console.log('');
console.log(`Diff vs published:       ${changed.length} of ${candidates.length} bridges change`);
for (const sample of ['Magere Brug', 'Blauwbrug', 'Torensluis', 'Berlagebrug', 'Nesciobrug']) {
  const candidate = candidates.find((entry) => entry.name === sample);
  if (!candidate) continue;
  const bridge = bridges.find((b) => b.id === candidate.id);
  console.log(`  ${sample}`);
  console.log(`    was: ${(bridge?.distractors ?? []).join(', ') || '—'}`);
  console.log(`    now: ${(assigned.get(candidate.id) ?? []).join(', ') || '—'}`);
}

for (const bridge of bridges) {
  const next = assigned.get(bridge.id);
  if (next) bridge.distractors = next;
}

const target = process.argv.includes('--publish') ? publishedPath : stagingPath;
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(bridges));
console.log('');
console.log(`Wrote ${target.replace(`${root}/`, '')}`);
if (target === stagingPath) console.log('Review, then re-run with --publish.');
