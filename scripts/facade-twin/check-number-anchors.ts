/**
 * Ask the buildings what they are called, and see whether we agree.
 *
 * Cross-view agreement — the same footprint landing on the same house from two
 * panoramas — is necessary but not sufficient, and a review of this branch was
 * right to say so. Where every view of a pand happens to share a heading, a
 * heading-dependent error is the same in each and the views agree with one
 * another while pointing at the wrong house. Something outside the geometry has
 * to name the building.
 *
 * A house number does. It is the only thing in a street photograph that is an
 * *identifier* rather than a description: a detector saying "façade" cannot
 * certify which pand a crop belongs to, but "270" can, because BAG says which
 * pand carries 270. The reading is also independent of the geometry being
 * tested — the plaque reads 270 whether or not our projection is a metre out —
 * so it is not the circular test that intersecting a ray with a guessed wall
 * would be.
 *
 * What it certifies and what it does not:
 *
 *   - **Identity: yes.** A number read inside our wall span that belongs to the
 *     pand we projected is direct evidence the correspondence holds.
 *   - **Metric registration: only along the wall, and only loosely.** A BAG
 *     address point is a point inside the building, not the surveyed centre of
 *     the plaque, so the along-band offset carries a metre or two of intrinsic
 *     scatter. It is sharp enough to catch a one-house error, which is 5–6 m on
 *     a canal terrace, and far too blunt to calibrate anything.
 *   - **Nothing vertical.** The band is placed from the massing's ground level.
 *
 * A reading that names the *neighbour* is not a failure of this instrument. It
 * is the measurement: either the number genuinely sits on the adjacent frontage,
 * or our wall is one house out, and the along-band offset says which.
 *
 * Usage: npx tsx scripts/facade-twin/check-number-anchors.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import {
  assemble, CONVICTING_MARGIN_M, DOORPLATE_MAX_M, DOORPLATE_MIN_M, MAX_ANCHOR_OFFSET_M,
} from '../../src/canalRecall/facade/doorplates.ts';

const CACHE = path.resolve('.cache/facade-twin');
const BANDS = path.join(CACHE, 'number-bands');

interface AddressPoint {
  street: string; houseNumber: number; letter: string | null; display: string;
  lngLat: [number, number]; rd: { x: number; y: number }; pandId: string | null;
}

const addresses = JSON.parse(await readFile(path.join(CACHE, 'address-points.json'), 'utf8')).addresses as AddressPoint[];
const manifest = JSON.parse(await readFile(path.join(BANDS, 'manifest.json'), 'utf8')).bands as any[];
const readings = JSON.parse(await readFile(path.join(BANDS, 'readings.json'), 'utf8')).bands as
  Array<{ pandId: string; panoramaId: string; readings: Array<{ text: string; confidence: number; alongM: number; heightM: number }> }>;

/** House numbers a pand carries, as a doorplate would show them. */
const numbersOf = new Map<string, Set<number>>();
for (const a of addresses) {
  if (!a.pandId) continue;
  (numbersOf.get(a.pandId) ?? numbersOf.set(a.pandId, new Set()).get(a.pandId)!).add(a.houseNumber);
}

// Spatial bucket over address points, so each band only tests its own stretch.
const CELL = 25;
const bucket = new Map<string, AddressPoint[]>();
for (const a of addresses) {
  const k = `${Math.floor(a.rd.x / CELL)}:${Math.floor(a.rd.y / CELL)}`;
  (bucket.get(k) ?? bucket.set(k, []).get(k)!).push(a);
}
const near = (x: number, y: number, radius: number) => {
  const out: AddressPoint[] = [];
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), r = Math.ceil(radius / CELL);
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++)
    for (const a of bucket.get(`${cx + i}:${cy + j}`) ?? [])
      if (Math.hypot(a.rd.x - x, a.rd.y - y) <= radius) out.push(a);
  return out;
};


type Verdict = 'confirmed' | 'neighbour-only' | 'conflict' | 'party-wall' | 'unread';
const results: any[] = [];

for (const band of manifest) {
  const read = readings.find(r => r.pandId === band.pandId && r.panoramaId === band.panoramaId);
  if (!read) continue;
  const own = numbersOf.get(band.pandId) ?? new Set<number>();

  // Every address point along this band, with its own along-band position.
  const centreX = band.origin.x + band.direction.x * band.spanM / 2;
  const centreY = band.origin.y + band.direction.y * band.spanM / 2;
  const alongOf = (a: AddressPoint) =>
    (a.rd.x - band.origin.x) * band.direction.x + (a.rd.y - band.origin.y) * band.direction.y;
  const local = near(centreX, centreY, band.spanM / 2 + 30)
    .map(a => ({ a, along: alongOf(a) }))
    .filter(p => p.along > -8 && p.along < band.spanM + 8);

  // The decoy: the same band, scored against a house two doors along the same
  // street. It shares the street, the fabric and the stretch of numbers, so it
  // is the hypothesis a one-house registration error would produce -- and if
  // assembly were spelling numbers out of noise, it would confirm this as
  // readily as the truth.
  const ownSorted = [...own].sort((a, b) => a - b);
  const decoy = new Set(ownSorted.map(n => n + 4));

  const matched = assemble(read.readings)
    // A digit string that is nobody's house number in this stretch is noise:
    // a date stone, a bus route, a price. Keep only readings that name a real
    // address nearby, and record how far off it sits.
    .map(r => {
      const value = Number(r.text);
      const options = local.filter(p => p.a.houseNumber === value);
      if (!options.length) return { ...r, value, address: null as any, offsetM: null as number | null };
      const best = options.sort((p, q) => Math.abs(p.along - r.alongM) - Math.abs(q.along - r.alongM))[0];
      return { ...r, value, address: best.a, offsetM: Number((r.alongM - best.along).toFixed(2)) };
    })
    .filter(r => r.address !== null)
    // A number has to be read roughly where that number lives, or it is a
    // coincidence rather than a reading. Seven of the ten "conflicts" in the
    // first run were single digits -- '2', '4', '5', '6' -- matched to an
    // address point nine to twenty-two metres away: there are only ten digits,
    // the search radius holds dozens of addresses, and a collision is close to
    // certain. The genuine reads sat within a metre.
    //
    // The tolerance has to be wider than the error it is meant to catch, or it
    // would reject exactly the failures worth finding. A one-house error on a
    // canal terrace is 5-6 m, so 9 m still sees a two-house slip while refusing
    // a reading from the far end of the block.
    .filter(r => r.offsetM !== null && Math.abs(r.offsetM) <= MAX_ANCHOR_OFFSET_M)
    // A single digit is a weak identifier -- one in ten -- and the numbers it
    // collides with are the low ones every canal street starts with. Two digits
    // or more, or it does not get to certify anything.
    .filter(r => r.digits >= 2 || r.text.trim().length >= 2);

  const insideWall = (m: number) => m >= band.wallStartM - 0.6 && m <= band.wallEndM + 0.6;
  /**
   * A plate at a party wall settles nothing, in either direction.
   *
   * A doorplate sits beside a door and on a canal terrace a door often sits hard
   * against the party wall, so a plate within half a metre of that wall could
   * belong to either house. Measured over 400 panden: a confirming reading sits
   * at 0.46 of the half-width from centre -- mid-wall -- while a conflicting one
   * sits at 1.77, past the wall entirely, and 87% of conflicts fall within half a
   * metre of the party wall. Those were the neighbour's plate, seen because the
   * band deliberately carries 0.7 of a frontage of context on each side.
   *
   * The margin applies to BOTH verdicts. Exempting confirmations was the first
   * thing I tried and it is not defensible: if a plate at a shared wall cannot
   * convict, it cannot acquit either, and the exemption is worth exactly five
   * points of confirm rate -- 81% against 76% -- which is the size of the thumb
   * it puts on the scale. Under the original rule, with 0.6 m of tolerance in
   * both directions and no ambiguous zone at all, the rate is 69%.
   *
   * Reclassified rather than discarded: party-wall readings get their own row,
   * because a rule that makes bad news disappear is not a fix.
   */
  const margin = Math.min(CONVICTING_MARGIN_M, (band.wallEndM - band.wallStartM) * 0.2);
  const wellInside = (m: number) => m >= band.wallStartM + margin && m <= band.wallEndM - margin;
  const doorplate = (r: { heightM: number }) => r.heightM >= DOORPLATE_MIN_M && r.heightM <= DOORPLATE_MAX_M;
  const plates = matched.filter(r => insideWall(r.alongM) && doorplate(r));
  const confirming = plates.filter(r => own.has(r.value) && wellInside(r.alongM));
  const conflicting = plates.filter(r => !own.has(r.value) && wellInside(r.alongM));
  const partyWall = plates.filter(r => !wellInside(r.alongM));
  const signage = matched.filter(r => insideWall(r.alongM) && !doorplate(r));
  // The decoy is only a control if it is scored by exactly the rule that decides
  // a confirmation. Judged more loosely it would fail more often than the real
  // thing for reasons that have nothing to do with the hypothesis it tests.
  const decoyConfirming = plates.filter(r => decoy.has(r.value) && wellInside(r.alongM));
  const neighbouring = matched.filter(r => !own.has(r.value) && !insideWall(r.alongM));

  const verdict: Verdict = confirming.length ? 'confirmed'
    : conflicting.length ? 'conflict'
    : partyWall.length ? 'party-wall'
    : neighbouring.length ? 'neighbour-only'
    : 'unread';

  results.push({
    pandId: band.pandId, panoramaId: band.panoramaId, verdict,
    standoffM: band.standoffM, obliquityDeg: band.obliquityDeg, leafOff: band.leafOff,
    ownNumbers: [...own].sort((a, b) => a - b),
    wallSpanM: [band.wallStartM, band.wallEndM],
    readings: matched.map(r => ({
      text: r.text, confidence: r.confidence, alongM: r.alongM, heightM: r.heightM,
      glyph: doorplate(r) ? 'doorplate' : 'signage',
      offsetM: r.offsetM, isOwn: own.has(r.value), insideWall: insideWall(r.alongM),
      address: `${r.address.street} ${r.address.display}`,
    })),
    rawReadingCount: read.readings.length,
    assembledCount: assemble(read.readings).length,
    signage: signage.map(r => ({ text: r.text, glyphHeightM: r.heightM, isOwn: own.has(r.value),
      address: `${r.address.street} ${r.address.display}` })),
    decoyConfirmed: decoyConfirming.length > 0,
  });
}

const by = (v: Verdict) => results.filter(r => r.verdict === v);
const decoyConfirmed = results.filter(r => r.decoyConfirmed).length;
const offsets = results.flatMap(r => r.readings.filter((x: any) => x.isOwn && x.insideWall).map((x: any) => Math.abs(x.offsetM)))
  .sort((a: number, b: number) => a - b);
const q = (p: number) => offsets.length ? offsets[Math.floor(p * (offsets.length - 1))] : NaN;

console.log(`\nHouse numbers read off the near-side pass, ${results.length} panden\n`);
console.log(`  assembled candidates: ${results.reduce((t, r) => t + r.assembledCount, 0)} `
  + `from ${results.reduce((t, r) => t + r.rawReadingCount, 0)} raw readings`);
console.log(`  decoy (a house two doors along) confirmed on ${decoyConfirmed} of ${results.length} bands\n`);
console.log(`  confirmed        ${String(by('confirmed').length).padStart(3)}   a number this pand carries, on the wall we projected`);
console.log(`  neighbour only   ${String(by('neighbour-only').length).padStart(3)}   real numbers read, all outside our wall span`);
console.log(`  conflict         ${String(by('conflict').length).padStart(3)}   another pand's number well inside our wall span`);
console.log(`  party wall       ${String(by('party-wall').length).padStart(3)}   a plate within ${CONVICTING_MARGIN_M} m of the party wall — could be either house, so it settles nothing`);
console.log(`  unread           ${String(by('unread').length).padStart(3)}   nothing legible that names a nearby address`);
if (offsets.length) {
  console.log(`\n  along-band offset of a confirming reading from its BAG address point:`);
  console.log(`    n = ${offsets.length}   median ${q(0.5).toFixed(2)} m   p90 ${q(0.9).toFixed(2)} m   max ${offsets[offsets.length - 1].toFixed(2)} m`);
  console.log(`    (a BAG point is inside the building, not on the plaque, so a metre or two is expected)`);
}
console.log();
for (const r of results) {
  const best = r.readings.filter((x: any) => x.isOwn && x.insideWall).sort((a: any, b: any) => b.confidence - a.confidence)[0]
    ?? r.readings.sort((a: any, b: any) => b.confidence - a.confidence)[0];
  console.log(`  ${r.verdict.padEnd(15)} ${r.pandId.slice(-6)}  ${String(r.standoffM).padStart(5)} m  `
    + `${r.ownNumbers.slice(0, 4).join('/').padEnd(14)} `
    + (best ? `read ${String(best.text).padEnd(5)} @${best.confidence.toFixed(2)} ${best.insideWall ? 'in ' : 'out'} ${String(best.offsetM).padStart(6)} m  ${best.address}`
            : `${r.rawReadingCount} raw readings, none named an address`));
}

await writeFile(path.join(BANDS, 'anchors.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/check-number-anchors.ts',
    area: AREA.areaId,
    note: 'Identity evidence, not metric calibration. A confirming reading certifies that the '
      + 'wall projected belongs to the pand requested. The along-band offset is loose because a '
      + 'BAG address point is inside the building, not the surveyed centre of the plaque.',
  },
  summary: {
    panden: results.length,
    confirmed: by('confirmed').length, neighbourOnly: by('neighbour-only').length,
    conflict: by('conflict').length, partyWall: by('party-wall').length, unread: by('unread').length,
    offsetMedianM: offsets.length ? Number(q(0.5).toFixed(2)) : null,
    // The control travels with the number it controls. A confirmed count is
    // only worth reading next to how often the same method confirms a house
    // that is not there.
    decoyConfirmed,
  },
  panden: results,
}, null, 1));

/**
 * The acceptance bar, as a number rather than a paragraph.
 *
 * "Really good correspondence between panoramas and 3DBAG buildings" was the
 * standing goal for weeks without a threshold, so every headline written against
 * it chose its own. The owner has now set it: identity first, and identity is
 * met when 95% of the panden this instrument can decide are confirmed rather
 * than contradicted. Precision -- how far along the façade -- comes after, and
 * is deliberately not gated here.
 *
 * The denominator is confirmed + conflict, the readings that say something. A
 * pand whose plate sits on a party wall, or whose numbers all fall outside our
 * wall span, has not been decided either way and must not be counted as a pass.
 */
const IDENTITY_BAR = 0.95;
const MIN_DECIDED = 30;
const decided = by('confirmed').length + by('conflict').length;
const rate = decided ? by('confirmed').length / decided : 0;
console.log(`\nidentity — ${by('confirmed').length} of ${decided} decided panden confirm, ${(rate * 100).toFixed(0)}%`
  + `  (bar ${IDENTITY_BAR * 100}%; the decoy confirms ${decoyConfirmed})`);
if (decided < MIN_DECIDED) {
  console.error(`\nINCONCLUSIVE — ${decided} decided panden is too few to test a ${IDENTITY_BAR * 100}% bar. Render more bands.`);
  process.exit(1);
}
if (rate < IDENTITY_BAR) {
  console.error(`\nFAIL — the wall we project is the right house ${(rate * 100).toFixed(0)}% of the time when this can be told apart, below ${IDENTITY_BAR * 100}%.`);
  process.exit(1);
}
console.log(`\nPASS — identity holds at ${(rate * 100).toFixed(0)}%, at or above the ${IDENTITY_BAR * 100}% bar.`);
