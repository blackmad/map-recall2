/**
 * Bridge distractors have to be places the player could believably be.
 *
 * The published extract used to offer all 300 bridges the same 13 names — the
 * twelve highest-scoring bridges in Amsterdam — so on the Prinsengracht the
 * four options were Zeeburgerbrug, Nesciobrug, IJburglaan and the Berlagebrug,
 * and the correct answer was the only one within four kilometres. This pins
 * the properties that stops being true: a wide pool, near options, and named
 * canal-ring cases that must confuse each other rather than the ring road.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BridgeCrossingIndex } from '../src/canalRecall/bridgeCrossings';
import {
  metresBetween, pickBridgeDistractors, type BridgeDistractorCandidate,
} from '../src/canalRecall/bridgeDistractors';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extractDir = resolve(root, 'public/data/extracts/amsterdam');
const GENERIC_BRIDGE_NAME = /^(brug|bridge)\s*\d+$/i;

interface BridgeFeature {
  id: string;
  name: string;
  center: [number, number];
  distractors?: string[];
}

const bridges = JSON.parse(readFileSync(resolve(extractDir, 'bridges.json'), 'utf8')) as BridgeFeature[];
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
const byName = new Map(candidates.map((candidate) => [candidate.name, candidate]));
const byId = new Map(bridges.map((bridge) => [bridge.id, bridge]));

// --- Shape ------------------------------------------------------------------

const distinct = new Set<string>();
const distances: number[] = [];
for (const candidate of candidates) {
  const offered = byId.get(candidate.id)?.distractors ?? [];
  assert.equal(offered.length, 4, `${candidate.name} should have four options, has ${offered.length}`);
  assert.equal(new Set(offered).size, 4, `${candidate.name} offers a duplicate: ${offered.join(', ')}`);
  assert.ok(!offered.includes(candidate.name), `${candidate.name} is offered against itself`);
  for (const name of offered) {
    assert.ok(!GENERIC_BRIDGE_NAME.test(name), `${candidate.name} offers a register number: ${name}`);
    distinct.add(name);
    const other = byName.get(name);
    assert.ok(other, `${candidate.name} offers "${name}", which is not a bridge in the extract`);
    distances.push(metresBetween(candidate.center, other.center));
  }
}

// The regression that started this: 13 distinct names across the whole city.
assert.ok(
  distinct.size > 200,
  `the distractor pool collapsed to ${distinct.size} names across ${candidates.length} bridges`,
);

distances.sort((a, b) => a - b);
const median = distances[Math.floor(distances.length / 2)];
assert.ok(median < 1_000, `the median option is ${Math.round(median)} m away; it should be walkable`);

// --- Named canal-ring cases -------------------------------------------------

// Each of these should be confused with its neighbours on the same water. The
// Magere Brug and the Blauwbrug are both Amstel bridges a few hundred metres
// apart, and telling them apart is the piece of local knowledge on offer.
const ringCases: Array<{ bridge: string; expect: string[] }> = [
  { bridge: 'Magere Brug', expect: ['Blauwbrug', 'Hoge Sluis'] },
  { bridge: 'Blauwbrug', expect: ['Magere Brug', 'Hoge Sluis'] },
  { bridge: 'Berlagebrug', expect: ['Utrechtsebrug', 'Nieuwe Amstelbrug'] },
];
for (const { bridge, expect } of ringCases) {
  const candidate = byName.get(bridge);
  assert.ok(candidate, `${bridge} is missing from the extract`);
  const offered = byId.get(candidate.id)?.distractors ?? [];
  for (const name of expect) {
    assert.ok(
      offered.includes(name),
      `${bridge} should be confusable with ${name}; it offers ${offered.join(', ')}`,
    );
  }
  for (const name of offered) {
    const other = byName.get(name)!;
    const metres = metresBetween(candidate.center, other.center);
    assert.ok(metres < 2_500, `${bridge} offers ${name}, ${Math.round(metres)} m away`);
  }
}

// A bridge over known water gets same-water company. Below that share the
// crossings extract has probably lost its waterway identification.
const withKnownWater = candidates.filter((candidate) => (candidate.waterways ?? []).length > 0);
const sharing = withKnownWater.filter((candidate) => {
  const waters = new Set(candidate.waterways);
  return (byId.get(candidate.id)?.distractors ?? []).some((name) =>
    (byName.get(name)?.waterways ?? []).some((water) => waters.has(water)));
});
assert.ok(
  sharing.length / withKnownWater.length > 0.6,
  `only ${sharing.length} of ${withKnownWater.length} bridges over known water get a same-water option`,
);

// --- The published extract is what the builder produces ---------------------

for (const candidate of candidates) {
  const recomputed = pickBridgeDistractors(candidate, candidates, {
    exclude: (name) => GENERIC_BRIDGE_NAME.test(name),
  });
  assert.deepEqual(
    byId.get(candidate.id)?.distractors,
    recomputed,
    `${candidate.name} is stale; re-run build:bridge-distractors --publish`,
  );
}

process.stdout.write(
  `Bridge distractor checks passed (${candidates.length} bridges, ${distinct.size} distinct options, `
  + `median ${Math.round(median)} m).\n`,
);
