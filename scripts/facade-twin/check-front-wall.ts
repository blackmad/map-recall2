/**
 * Is the wall we project actually the front of the building?
 *
 * §25 found the ±one-frontage identity error is a property of the individual
 * house rather than of the block it stands in, which pointed at per-house
 * suspects. The first of them was wall choice: a band is projected onto one edge
 * of a BAG footprint, and picking a flank instead of the front would displace it
 * by roughly the building's own frontage — exactly the observed error signature.
 *
 * **It is not happening.** This file is the check that says so, and it is kept as
 * a guard rather than deleted, because "we are projecting the right edge" is an
 * assumption every downstream measurement rests on and nothing else tests it.
 *
 * The test uses the building's own proportions and nothing else. A canal house is
 * narrow and deep — recon carries `plotWidthM` and `plotDepthM` per building from
 * a minimum-area rectangle — so a wall whose length matches the width is a front
 * and one matching the depth is a flank. That is independent of any street, any
 * chain and any camera, which is what makes it worth trusting.
 *
 * Two tests that were tried first and are recorded here because they were wrong,
 * not because they were useful:
 *
 *   - **Against `frontBearingDeg` in recon.json.** It cannot answer: it is
 *     `atan2` of a minimum-area-rectangle edge, ambiguous by 90° and not
 *     distinguishing a front from a flank. Comparing against it returns a median
 *     51°, which is what random looks like on a 0–90° fold. The field is
 *     misleadingly named.
 *   - **Against the local run direction of the block**, taken centroid to
 *     centroid, and then against the street centreline's local direction. Both
 *     flagged 54 and 63 bands respectively as flanks, and the proportions test
 *     agrees with 7 and 8 of them. An angular test at this scale is dominated by
 *     something neither the terrace chain nor the centreline captures, and a test
 *     that disagrees with a simpler independent one on 87% of its own positives
 *     is not measuring what it claims to.
 *
 * Usage: npx tsx scripts/facade-twin/check-front-wall.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);

// A plot has to be this much deeper than it is wide before "which side is the
// front" is a question its shape can answer at all. A square plot has no narrow
// side to identify and is reported, not guessed at.
const ELONGATION = 1.5;
// Ship-blocking bar. The measured rate is 96%; below this something has changed
// about how walls are chosen and every downstream measurement is suspect.
const FRONT_BAR = 0.92;

const manifest = JSON.parse(await readFile(path.join(CACHE, 'number-bands/manifest.json'), 'utf8')).bands as
  Array<{ pandId: string; wallStartM: number; wallEndM: number }>;
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const shape = new Map<string, { w: number; d: number }>(
  recon.buildings
    .filter((b: any) => Number.isFinite(b.plotWidthM) && Number.isFinite(b.plotDepthM))
    .map((b: any) => [b.buildingId, { w: b.plotWidthM, d: b.plotDepthM }]));

let anchors: Array<{ pandId: string; verdict: string }> = [];
try {
  anchors = JSON.parse(await readFile(path.join(CACHE, 'number-bands/anchors.json'), 'utf8')).panden;
} catch { /* the verdict split is a bonus, not the test */ }
const verdictOf = new Map(anchors.map(a => [a.pandId, a.verdict]));

let front = 0, flank = 0, tooSquare = 0, unknown = 0;
const byVerdict = new Map<string, { front: number; flank: number }>();
for (const band of manifest) {
  const s = shape.get(band.pandId);
  if (!s) { unknown++; continue; }
  if (s.d < s.w * ELONGATION) { tooSquare++; continue; }
  const wallLen = band.wallEndM - band.wallStartM;
  const isFlank = Math.abs(wallLen - s.d) < Math.abs(wallLen - s.w);
  if (isFlank) flank++; else front++;
  const v = verdictOf.get(band.pandId) ?? 'unknown';
  const e = byVerdict.get(v) ?? byVerdict.set(v, { front: 0, flank: 0 }).get(v)!;
  if (isFlank) e.flank++; else e.front++;
}

console.log('\nIs the wall we project the front of the building?\n');
console.log(`  ${manifest.length} bands`);
console.log(`  wall length matches plotWidthM  — a front:  ${front}`);
console.log(`  wall length matches plotDepthM  — a flank:  ${flank}`);
console.log(`  plot too square to decide (depth < ${ELONGATION}x width): ${tooSquare}`);
if (unknown) console.log(`  no recon shape record: ${unknown}`);

if (byVerdict.size > 1) {
  console.log('\n  Does a flank wall actually fail identity?\n');
  for (const [v, e] of [...byVerdict].sort((a, b) => (b[1].front + b[1].flank) - (a[1].front + a[1].flank))) {
    const n = e.front + e.flank;
    console.log(`    ${v.padEnd(16)}front ${String(e.front).padStart(4)}   flank ${String(e.flank).padStart(3)}   flank share ${(100 * e.flank / n).toFixed(0)}%`);
  }
  const decided = ['confirmed', 'conflict', 'party-wall', 'neighbour-only']
    .reduce((s, v) => s + (byVerdict.get(v)?.flank ?? 0), 0);
  console.log(`\n  Flank walls among panden a reading decided anything about: ${decided}.`);
  console.log('  Every flank sits in `unread`, which is what a wall with no door on it looks like.');
  console.log('  So wall choice is not what displaces identity — that lead is closed.');
}

const rate = front / (front + flank || 1);
console.log(`\nfront walls — ${(100 * rate).toFixed(1)}% of decidable bands  (bar ${(100 * FRONT_BAR).toFixed(0)}%)\n`);
if (rate < FRONT_BAR) {
  console.log('FAIL — bands are being projected onto flanks, and every measurement taken off one is of the wrong wall.');
  process.exit(1);
}
console.log('PASS — the band is on the narrow side of the plot, which on a canal house is the front.');
