/**
 * Steps 3-5 of global anchoring: fit one along-street shift per block.
 *
 * The premise, from §21 and §22, was: the surviving identity failures are not
 * scatter, they are displacements of about one canal frontage, sign unknown; and
 * because a block shares a camera pass, a stretch of quay and a numbering
 * sequence, that displacement should be common to the whole run rather than
 * private to one house. A per-wall check can only report such an error as a
 * conflict, while a per-block fit could correct it.
 *
 * **On the evidence available the premise is false, and this tool exists to say
 * so.** Decomposing the variance, blocks differ from one another *less* than the
 * houses inside one block differ from each other -- between/within 0.79 for the
 * block and 0.58 for the street, where a real block effect needs above 1. Held
 * out, a shift fitted without one pand and then asked to predict it makes 17 of
 * 25 predictions worse than assuming no shift at all. The displacement is a
 * property of the individual house, not of the run it stands in, so one shift per
 * block is the wrong model and the correction below must not be applied.
 *
 * That is a result about 82 read panden on 17 usable blocks, which is thin. It is
 * reported as a direction rather than a verdict, and the numbers are recomputed
 * every run so a larger store can overturn it. What it does settle is that
 * shipping the correction now would be shipping noise.
 *
 * Everything below is kept anyway: the machinery is right even though the model
 * it fits is not, the guards are what produced the finding, and the same
 * decomposition is what will test whatever model replaces it.
 *
 * The observation. A band renders world positions into a 1-D along-wall
 * coordinate. A doorplate reading gives `alongM`, where the plate appeared in our
 * render; BAG gives `along`, where that house number actually lives, projected
 * onto the same axis. Their difference is `offsetM`, and it is the same quantity
 * `check-number-anchors.ts` already reports, computed by the same extracted
 * `assemble` so the two tools cannot drift apart.
 *
 * What the shift means, and its sign. If our render is displaced by Δ, then the
 * pixels we placed at band coordinate m actually show world coordinate m + Δ.
 * A plate we read at `alongM` is therefore really at `alongM + Δ`, and BAG puts
 * it at `along`, so
 *
 *     Δ = along - alongM = -offsetM
 *
 * and the corrected test for "is this plate on our wall" is
 * `alongM + Δ ∈ [wallStartM, wallEndM]`. The wall span itself is not moved: it
 * comes from the footprint and is world-truth. It is the imagery that is
 * displaced.
 *
 * The fit is a consensus, not a mean. Every observed Δ is proposed as a
 * hypothesis, the one supporting the most readings within INLIER_M wins, and it
 * is then refined to the median of its own inliers. A mean would be dragged by a
 * single plate matched to the wrong address point, and those exist by
 * construction — a two-digit number recurs every hundred houses.
 *
 * Three things guard against fooling ourselves, and they are the reason this file
 * is worth more than the correction it computes:
 *
 *   - **Is there a block effect at all?** If offsets scatter randomly within a
 *     block there is nothing to fit and the design is wrong. So the variance is
 *     decomposed -- spread *between* block medians against spread *within* a
 *     block -- and reported before any correction is. The comparison has to be
 *     between against within: comparing within against the *pooled* spread is
 *     the trap, because pooling contains the between-group variation and will
 *     almost always make within look smaller, which is how the first version of
 *     this file printed "a block-wide shift is a real effect" over data saying
 *     the opposite.
 *   - **Hold-out is the primary test.** A shift fitted from a block's readings and
 *     then graded on those same readings is circular and will look excellent. So
 *     each block with three or more read panden is fitted with one pand held out,
 *     and the error is measured on the pand the fit never saw — against the null
 *     hypothesis Δ = 0, which is what the pipeline assumes today.
 *   - **A block with one reading proves nothing about itself** and is counted
 *     separately, never folded into the headline.
 *
 * Usage: npx tsx scripts/facade-twin/fit-block-shifts.ts [--write]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import {
  assemble, DOORPLATE_MAX_M, DOORPLATE_MIN_M, MAX_ANCHOR_OFFSET_M,
} from '../../src/canalRecall/facade/doorplates.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const WRITE = process.argv.includes('--write');

// Two readings agree about a shift when they fall this close. It has to exceed
// the 1-2 m of intrinsic scatter in BAG address points, which sit inside the
// building rather than on the plaque, or the fit would be resolving noise.
const INLIER_M = 2.0;
// A block is locked when this many distinct panden support one shift. One
// reading is a suggestion; it cannot be checked against anything.
const MIN_SUPPORT = 2;
// Below this the block is already registered and a "correction" would be noise.
const MEANINGFUL_SHIFT_M = 1.5;

type Band = {
  pandId: string; panoramaId: string; spanM: number; wallStartM: number; wallEndM: number;
  origin: { x: number; y: number }; direction: { x: number; y: number };
};
type Address = { street: string; houseNumber: number; pandId: string | null; rd: { x: number; y: number } };
type Block = { blockId: string; street: string; parity: string; members: Array<{ pandId: string; numbers: number[]; alongM: number }> };

/**
 * Both files have default names that whichever render ran last overwrites, and
 * readings join to a band on pand AND panorama — so a mismatched pair does not
 * error, it silently drops every band whose chosen view differs and fits the
 * model to the remainder. Name them, and say how many actually pair up.
 */
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const manifestFile = arg('manifest') ?? 'manifest.json';
const readingsFile = arg('readings') ?? 'readings.json';
const manifest = JSON.parse(await readFile(path.join(CACHE, 'number-bands', manifestFile), 'utf8')).bands as Band[];
const readingStore = JSON.parse(await readFile(path.join(CACHE, 'number-bands', readingsFile), 'utf8')).bands as
  Array<{ pandId: string; panoramaId: string; readings: Array<{ text: string; confidence: number; alongM: number; heightM: number }> }>;
{
  const have = new Set(readingStore.map(r => `${r.pandId}|${r.panoramaId}`));
  const shared = manifest.filter(b => have.has(`${b.pandId}|${b.panoramaId}`)).length;
  if (shared < manifest.length * 0.5) {
    console.error(`${manifestFile} and ${readingsFile} share ${shared} of ${manifest.length} bands`
      + ` — not one render. Pass --manifest= and --readings= from the same pass.`);
    process.exit(2);
  }
  if (shared < manifest.length) console.log(`  ${shared} of ${manifest.length} bands carry readings.`);
}
const blocks = JSON.parse(await readFile(path.join(STAGING, 'blocks.json'), 'utf8')).blocks as Block[];
const addresses = JSON.parse(await readFile(path.join(CACHE, 'address-points.json'), 'utf8')).addresses as Address[];

const readingsOf = new Map(readingStore.map(r => [`${r.pandId}|${r.panoramaId}`, r.readings]));
const blocksOf = new Map<string, string[]>();
for (const b of blocks) for (const m of b.members) (blocksOf.get(m.pandId) ?? blocksOf.set(m.pandId, []).get(m.pandId)!).push(b.blockId);
const blockById = new Map(blocks.map(b => [b.blockId, b]));

const CELL = 60;
const grid = new Map<string, Address[]>();
for (const a of addresses) {
  const k = `${Math.floor(a.rd.x / CELL)},${Math.floor(a.rd.y / CELL)}`;
  (grid.get(k) ?? grid.set(k, []).get(k)!).push(a);
}
const near = (x: number, y: number, r: number) => {
  const out: Address[] = [];
  for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++)
    for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++)
      for (const a of grid.get(`${gx},${gy}`) ?? []) out.push(a);
  return out;
};

type Observation = { pandId: string; panoramaId: string; value: number; offsetM: number; alongM: number; band: Band };
const observations: Observation[] = [];
for (const band of manifest) {
  const rs = readingsOf.get(`${band.pandId}|${band.panoramaId}`);
  if (!rs?.length) continue;
  const cx = band.origin.x + band.direction.x * band.spanM / 2;
  const cy = band.origin.y + band.direction.y * band.spanM / 2;
  const alongOf = (a: Address) =>
    (a.rd.x - band.origin.x) * band.direction.x + (a.rd.y - band.origin.y) * band.direction.y;
  const behindOf = (a: Address) =>
    Math.abs(-(a.rd.x - band.origin.x) * band.direction.y + (a.rd.y - band.origin.y) * band.direction.x);
  const local = near(cx, cy, band.spanM / 2 + 30).map(a => ({ a, along: alongOf(a) }))
    .filter(p => p.along > -8 && p.along < band.spanM + 8)
    // The next street's backs are not about this frontage; see check-number-anchors.
    .filter(p => behindOf(p.a) <= 20);

  for (const r of assemble(rs)) {
    if (r.heightM < DOORPLATE_MIN_M || r.heightM > DOORPLATE_MAX_M) continue;
    if (r.digits < 2 && r.text.trim().length < 2) continue;
    const value = Number(r.text);
    if (!Number.isFinite(value)) continue;
    const options = local.filter(p => p.a.houseNumber === value);
    if (!options.length) continue;
    const best = options.sort((p, q) => Math.abs(p.along - r.alongM) - Math.abs(q.along - r.alongM))[0];
    const offsetM = r.alongM - best.along;
    if (Math.abs(offsetM) > MAX_ANCHOR_OFFSET_M) continue;
    observations.push({ pandId: band.pandId, panoramaId: band.panoramaId, value, offsetM, alongM: r.alongM, band });
  }
}

/** One shift per pand: several plates on one façade are one measurement, not several. */
const median = (v: number[]) => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
type PandVote = { pandId: string; shift: number; plates: number };
const votesByBlock = new Map<string, PandVote[]>();
{
  const byPand = new Map<string, number[]>();
  for (const o of observations) (byPand.get(o.pandId) ?? byPand.set(o.pandId, []).get(o.pandId)!).push(-o.offsetM);
  for (const [pandId, shifts] of byPand) {
    const vote: PandVote = { pandId, shift: median(shifts), plates: shifts.length };
    for (const bid of blocksOf.get(pandId) ?? []) (votesByBlock.get(bid) ?? votesByBlock.set(bid, []).get(bid)!).push(vote);
  }
}

/** Consensus: the hypothesis with most support, refined to the median of its inliers. */
function consensus(votes: PandVote[]) {
  let best = { shift: NaN, support: 0, members: [] as PandVote[] };
  for (const hypothesis of votes) {
    const members = votes.filter(v => Math.abs(v.shift - hypothesis.shift) <= INLIER_M);
    if (members.length > best.support) best = { shift: median(members.map(m => m.shift)), support: members.length, members };
  }
  return best;
}

console.log('\nOne shift per block, fitted from house numbers\n');
console.log(`  ${observations.length} plate readings matched to an address, on ${new Set(observations.map(o => o.pandId)).size} panden`);
const sized = [...votesByBlock].map(([bid, v]) => ({ bid, votes: v })).filter(b => b.votes.length >= MIN_SUPPORT);
console.log(`  blocks reached: ${votesByBlock.size}; with ${MIN_SUPPORT}+ panden read: ${sized.length}`);
console.log(`  blocks with a single reading (cannot check themselves): ${votesByBlock.size - sized.length}`);

// ── Is there a block effect at all? ──────────────────────────────────────────
// If not, the entire design is wrong and nothing below is worth reading.
{
  const within: number[] = [], centres: number[] = [];
  for (const { votes } of sized) {
    const c = median(votes.map(v => v.shift));
    centres.push(c);
    for (const v of votes) within.push(v.shift - c);
  }
  const sd = (v: number[]) => {
    if (v.length < 2) return NaN;
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
  };
  const all = sized.flatMap(b => b.votes.map(v => v.shift));
  console.log('\n  Is a shift a property of the block, or of the house?');
  console.log(`    spread of every pand shift, ignoring blocks:  ${sd(all).toFixed(2)} m`);
  console.log(`    spread of block medians (between blocks):     ${sd(centres).toFixed(2)} m`);
  console.log(`    spread within a block, about its own median:  ${sd(within).toFixed(2)} m`);
  // The test is between-block against within-block, not within-block against the
  // pooled total: pooling includes the between-block variation, so within will
  // almost always look smaller than it and comparing the two proves nothing. A
  // block-wide shift is real only when blocks differ from each other by MORE than
  // their own members differ among themselves.
  const ratio = sd(centres) / sd(within);
  console.log(`    between / within:                             ${ratio.toFixed(2)}`);
  console.log(ratio > 1
    ? '    -> blocks differ from each other more than their members do: a block-wide shift is real.'
    : '    -> members of one block differ MORE than blocks differ from each other.\n'
      + '       The displacement is a property of the house, not of the block, and one\n'
      + '       shift per block is the wrong model.');
}

// ── What is the displacement actually a property of? ─────────────────────────
// The block turned out not to explain it, and "not the block" is only half an
// answer. The same variance decomposition costs nothing to run against every
// other grouping the data offers, and the winner says where the fault lives:
// a panorama effect is a pose problem, a pand effect is a footprint or
// wall-choice problem, and a street effect would be a datum problem.
{
  const sd = (v: number[]) => {
    if (v.length < 2) return NaN;
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return Math.sqrt(v.reduce((q, x) => q + (x - m) ** 2, 0) / (v.length - 1));
  };
  const decompose = (label: string, keyOf: (o: Observation) => string) => {
    const groups = new Map<string, number[]>();
    for (const o of observations) (groups.get(keyOf(o)) ?? groups.set(keyOf(o), []).get(keyOf(o))!).push(-o.offsetM);
    const usable = [...groups.values()].filter(v => v.length >= 2);
    if (usable.length < 2) { console.log(`    ${label.padEnd(34)}too few groups with 2+ readings`); return; }
    const centres = usable.map(median);
    const within = usable.flatMap(v => { const c = median(v); return v.map(x => x - c); });
    const ratio = sd(centres) / sd(within);
    console.log(`    ${label.padEnd(34)}${String(usable.length).padStart(4)} groups   between ${sd(centres).toFixed(2)} m   within ${sd(within).toFixed(2)} m   ratio ${ratio.toFixed(2)}`);
  };
  console.log('\n  Which grouping explains the displacement? (between / within above 1 means it does)\n');
  decompose('the block', o => (blocksOf.get(o.pandId) ?? ['-'])[0]);
  decompose('the street', o => (blockById.get((blocksOf.get(o.pandId) ?? ['-'])[0])?.street ?? '-'));
  decompose('the panorama (one camera pose)', o => o.panoramaId);
  // Grouping by pand induces exactly the same partition as grouping by panorama
  // whenever the store holds one band per pand, which it does. Printing both as
  // if they were independent tests would be presenting one measurement twice, so
  // it is said rather than shown.
  const oneBandPerPand = new Set(observations.map(o => o.pandId)).size === new Set(observations.map(o => `${o.pandId}|${o.panoramaId}`)).size;
  console.log(oneBandPerPand
    ? '\n    (grouping by pand is the same partition as by panorama here -- one band per pand --\n'
      + '     so its "within" is not a pose effect at all: it is the plate-to-plate scatter on a\n'
      + '     single facade, which is the noise floor every other row is measured against.)'
    : '');
}

// ── Hold-out: the only non-circular test ─────────────────────────────────────
const heldOut: Array<{ bid: string; pandId: string; predicted: number; actual: number }> = [];
for (const { bid, votes } of sized) {
  if (votes.length < 3) continue; // fitting needs 2 after holding 1 out
  for (const out of votes) {
    const rest = votes.filter(v => v.pandId !== out.pandId);
    if (rest.length < 2) continue;
    const fit = consensus(rest);
    if (fit.support < MIN_SUPPORT) continue;
    heldOut.push({ bid, pandId: out.pandId, predicted: fit.shift, actual: out.shift });
  }
}
console.log('\n  Hold-out — fit each block without one pand, then predict that pand:\n');
if (heldOut.length) {
  const errFit = heldOut.map(h => Math.abs(h.actual - h.predicted));
  const errNull = heldOut.map(h => Math.abs(h.actual));
  const q = (v: number[], p: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  console.log(`    ${heldOut.length} held-out panden on ${new Set(heldOut.map(h => h.bid)).size} blocks`);
  console.log(`    median |error| with the block fit:   ${median(errFit).toFixed(2)} m   (p90 ${q(errFit, 0.9).toFixed(2)})`);
  console.log(`    median |error| assuming no shift:    ${median(errNull).toFixed(2)} m   (p90 ${q(errNull, 0.9).toFixed(2)})`);
  const better = heldOut.filter(h => Math.abs(h.actual - h.predicted) < Math.abs(h.actual)).length;
  console.log(`    the fit beats "no shift" on ${better} of ${heldOut.length} held-out panden`);
  // Both conditions, and deliberately so. A median that improves by a few
  // centimetres while the fit makes most individual predictions worse is not a
  // working correction, and comparing medians alone would have called this one a
  // success at 1.79 m against 1.84 m.
  const majority = better > heldOut.length / 2;
  const worthwhile = median(errFit) < median(errNull) * 0.8;
  console.log(majority && worthwhile
    ? '    -> the shift generalises to readings it was not fitted on.'
    : `    -> it does NOT generalise${majority ? '' : ` (it makes ${heldOut.length - better} of ${heldOut.length} predictions worse)`}.\n`
      + '       Fitting noise. This correction must not be applied.');
} else {
  console.log('    no block has three read panden, so nothing can be held out.');
  console.log('    This is a coverage problem, not a method problem: render more bands.');
}

// ── The blocks that would be corrected ───────────────────────────────────────
const locks = sized.map(({ bid, votes }) => ({ bid, ...consensus(votes) }))
  .filter(l => l.support >= MIN_SUPPORT && Math.abs(l.shift) >= MEANINGFUL_SHIFT_M)
  .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
console.log(`\n  Blocks whose imagery is displaced by ${MEANINGFUL_SHIFT_M} m or more: ${locks.length} of ${sized.length}\n`);
console.log('    block                                     shift   support   panden on it');
for (const l of locks.slice(0, 15)) {
  const b = blockById.get(l.bid)!;
  console.log(`    ${l.bid.padEnd(38)}${l.shift.toFixed(2).padStart(7)} m${String(l.support).padStart(6)}${String(b.members.length).padStart(11)}`);
}

if (WRITE) {
  const out = path.join(STAGING, 'block-shifts.json');
  await writeFile(out, JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      generator: 'scripts/facade-twin/fit-block-shifts.ts',
      inlierM: INLIER_M, minSupport: MIN_SUPPORT,
      note: 'Positive shift means the imagery is displaced that far along the band axis: a plate read at alongM is really at alongM + shift. The wall span is not moved -- it comes from the footprint and is world-truth.',
    },
    blocks: sized.map(({ bid, votes }) => {
      const fit = consensus(votes);
      return { blockId: bid, shiftM: +fit.shift.toFixed(2), support: fit.support, votes: votes.map(v => ({ pandId: v.pandId, shiftM: +v.shift.toFixed(2), plates: v.plates })) };
    }),
  }, null, 1));
  console.log(`\n  wrote ${path.relative(process.cwd(), out)}`);
} else {
  console.log('\n  (dry run - pass --write to publish block-shifts.json)');
}
console.log();
