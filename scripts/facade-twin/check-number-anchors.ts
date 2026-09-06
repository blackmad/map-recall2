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

/**
 * Digits of one doorplate, put back together into the number they spell.
 *
 * The recogniser returns 220 of its 330 readings as a single character. A
 * doorplate reading "242" comes back as '2', '4', '2' at three positions, and a
 * matcher that only ever compares whole strings throws all three away — which is
 * why 21 of 30 panden read as `unread` while the tiles plainly contain numbers.
 * Correcting the camera's vertical datum put the doors in frame and did almost
 * nothing to that count, because fragmentation, not aim, is what binds.
 *
 * Two facts about type make regrouping possible without guessing. `heightM` is
 * the glyph's height in metres, not its position, so digits of one plate share a
 * size; and a digit's advance is roughly 0.5–0.9 of its height, so digits of one
 * plate sit an advance apart while separate plates sit metres apart. A run that
 * satisfies both is a number; anything else is left as the single digit it was.
 *
 * The obvious danger is that this manufactures its own evidence: concatenating
 * scattered digits can spell anything, and with enough candidates something will
 * match. `decoyNumbers` below is the guard — the same assembled readings are
 * scored a second time against a house two doors along, and if assembly were
 * inventing matches it would invent them for the decoy just as readily.
 */
const MIN_ADVANCE = 0.35, MAX_ADVANCE = 1.4, MIN_SIZE_RATIO = 0.55;
const MAX_ANCHOR_OFFSET_M = 9;
/**
 * A doorplate digit is 8-25 cm, and glyph height tells you what you are reading.
 *
 * Every reading that confirmed came in at 9.8, 15.3 or 20.8 cm. Every reading
 * that conflicted came in at 43.1, 44.7 or 54.9 cm -- half-metre characters,
 * which is painted shopfront signage or a gable stone, not a number beside a
 * door. The separation is total on the sample there is, so the two are recorded
 * as different instruments rather than averaged into one rate.
 *
 * Signage is not discarded: a metre-wide "176" painted on a frontage is real
 * evidence about that frontage, and on a corner site it may be the only number
 * facing this way. It is just not a doorplate, and a business sign can name an
 * address that is not the building it hangs on, so it does not get to certify
 * identity on its own.
 */
const DOORPLATE_MIN_M = 0.06, DOORPLATE_MAX_M = 0.28;

function assemble<T extends { text: string; confidence: number; alongM: number; heightM: number }>(
  readings: readonly T[],
): Array<{ text: string; confidence: number; alongM: number; heightM: number; digits: number }> {
  const glyphs = readings
    .filter(r => /^\d$/.test(r.text.trim()) && r.heightM > 0)
    .sort((a, b) => a.alongM - b.alongM);
  const out = readings.map(r => ({
    text: r.text.trim(), confidence: r.confidence, alongM: r.alongM, heightM: r.heightM, digits: 1,
  }));
  for (let i = 0; i < glyphs.length; i++) {
    let text = glyphs[i].text.trim(), confidence = glyphs[i].confidence;
    let alongSum = glyphs[i].alongM, heightSum = glyphs[i].heightM;
    for (let j = i + 1; j < glyphs.length && j - i < 4; j++) {
      const previous = glyphs[j - 1], next = glyphs[j];
      const size = Math.min(previous.heightM, next.heightM) / Math.max(previous.heightM, next.heightM);
      const advance = (next.alongM - previous.alongM) / ((previous.heightM + next.heightM) / 2);
      if (size < MIN_SIZE_RATIO || advance < MIN_ADVANCE || advance > MAX_ADVANCE) break;
      text += next.text.trim();
      confidence = Math.min(confidence, next.confidence);
      alongSum += next.alongM; heightSum += next.heightM;
      const digits = j - i + 1;
      out.push({ text, confidence, alongM: alongSum / digits, heightM: heightSum / digits, digits });
    }
  }
  return out;
}

type Verdict = 'confirmed' | 'neighbour-only' | 'conflict' | 'unread';
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
  const decoyConfirming = matched.filter(r => decoy.has(r.value) && insideWall(r.alongM));
  const doorplate = (r: { heightM: number }) => r.heightM >= DOORPLATE_MIN_M && r.heightM <= DOORPLATE_MAX_M;
  const confirming = matched.filter(r => own.has(r.value) && insideWall(r.alongM) && doorplate(r));
  const signage = matched.filter(r => insideWall(r.alongM) && !doorplate(r));
  const conflicting = matched.filter(r => !own.has(r.value) && insideWall(r.alongM) && doorplate(r));
  const neighbouring = matched.filter(r => !own.has(r.value) && !insideWall(r.alongM));

  const verdict: Verdict = confirming.length ? 'confirmed'
    : conflicting.length ? 'conflict'
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
console.log(`  conflict         ${String(by('conflict').length).padStart(3)}   another pand's number inside our wall span`);
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
    conflict: by('conflict').length, unread: by('unread').length,
    offsetMedianM: offsets.length ? Number(q(0.5).toFixed(2)) : null,
    // The control travels with the number it controls. A confirmed count is
    // only worth reading next to how often the same method confirms a house
    // that is not there.
    decoyConfirmed,
  },
  panden: results,
}, null, 1));
