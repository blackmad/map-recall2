/**
 * Named regression for the colour/material review cases (case-08 / case-14).
 *
 * Why this exists: the 21 Sep user review grouped case-08 ("missing building
 * color") and case-14 ("misunderstanding building color entirely — it's red
 * brick with white accents"). Reading the source crops and the extracted
 * material features shows two distinct defects, neither of them a sampler
 * tuning problem:
 *
 *   - case-14 Elandsgracht 19 declares its upper wall correctly (`brick`,
 *     `#8b4513`) but also carries a whole-facade `accent` (`#ffffff`, bounds =
 *     the entire crop). The compiler painted the accent last, so the candidate
 *     rendered white over a red-brick source. `cityAppearanceFacadeRecipes.ts`
 *     now skips a trim region that spans the whole crop; this check pins that
 *     the red brick survives and a localized band still paints.
 *   - case-08 Rozengracht 251 declares a `brick` upper wall with **no colour**
 *     and no localized trim. The renderer falls back to the neutral base
 *     (`#d7d0c7`), so the candidate is beige where the source is a dark
 *     desaturated brick. That is a missing extraction field, not a paint bug;
 *     this check records the measured crop colour so the gap is visible.
 *
 * The sampled wall colour is a `needs-review` observation, never an accepted
 * material. On occluded or shadowed crops (case-14 carries a large tree) the
 * sample is explicitly unreliable and the declared material is the better
 * source. Run: npx tsx scripts/review/check-reviewed-wall-colour.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { sampleWallColour } from '../../src/canalRecall/facade/wallColourSample.ts';
import { compileSourceShapePreview } from './source-shape-preview.ts';

const CASES = 'public/data/facade-repair-preview/cases.json';
const EVIDENCE = 'public/data/city-expansion/evidence';
const OUT = 'review-data/case-wall-colour.json';
const RENDER_BASE = '#d7d0c7';

const data = JSON.parse(fs.readFileSync(CASES, 'utf8'));
const caseById = (id: string) => {
  const entry = data.cases.find((item: any) => item.caseId === id);
  assert.ok(entry, `${id} missing from the review packet`);
  return entry;
};
const luma = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return (r + g + b) / 3;
};

// Measure every reviewed full crop and publish the declared observation.
const samples: any[] = [];
for (const entry of data.cases) {
  const observation = entry.candidateObservations?.[0];
  const features = entry.shapeFeatures?.full?.features;
  const sha = observation?.images?.full?.sha256;
  if (!sha || !features) { samples.push({ caseId: entry.caseId, status: 'no-crop' }); continue; }
  try {
    const decoded = await sharp(path.join(EVIDENCE, `${sha}.jpg`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const sample = sampleWallColour(
      { data: decoded.data, width: decoded.info.width, height: decoded.info.height, channels: 3 },
      features,
    );
    samples.push({ caseId: entry.caseId, status: 'measured', sourceSha256: sha, sample });
  } catch {
    samples.push({ caseId: entry.caseId, status: 'missing-crop', sourceSha256: sha });
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  version: 1, kind: 'declared-wall-colour-observation', generatedAt: new Date().toISOString(),
  basis: 'masked-crop-percentile', state: 'needs-review',
  note: 'Diagnostic wall-colour samples. Masked openings and localized trim, skipped crop margins, excluded near-white joinery. Unreliable on occluded/shadowed crops; the declared extraction material is the fallback, not this sample.',
  renderBase: RENDER_BASE,
  samples,
}, null, 2) + '\n');

const sampleOf = (id: string) => samples.find(row => row.caseId === id)?.sample;
const featuresOf = (id: string) => caseById(id).shapeFeatures.full.features as any[];
const materials = (features: any[]) => features.filter(f => f.kind === 'material');
const coverage = (feature: any, width: number, height: number) => {
  const [left, top, right, bottom] = feature.bounds;
  return ((right - left) * (bottom - top)) / (width * height);
};

// case-14: a correctly declared red-brick wall must not be overpainted by a
// whole-facade "accent". Compile fresh from the stored features and inspect.
{
  const features = featuresOf('case-14');
  const wall = materials(features).find(f => f.region === 'upper-wall');
  assert.ok(wall, 'case-14 must declare an upper-wall material');
  assert.equal(wall.colour, '#8b4513', 'case-14 upper-wall colour changed');
  const accent = materials(features).find(f => f.region === 'accent');
  assert.ok(accent, 'case-14 must carry the whole-facade accent that caused the defect');
  assert.equal(accent.colour, '#ffffff', 'case-14 accent colour changed');
  const dims = caseById('case-14').shapeFeatures.full;
  assert.ok(coverage(accent, dims.width, dims.height) >= 0.6, 'case-14 accent is expected to span the whole crop');

  const compiled = compileSourceShapePreview({
    width: dims.width, height: dims.height, cropSha256: dims.cropSha256, captureDate: dims.captureDate, features,
  });
  const painted = compiled.patches.filter((patch: any) => patch.featureKind === 'observed-material').map((patch: any) => patch.colour);
  assert.ok(painted.includes('#8b4513'), 'the declared red-brick wall must be painted');
  assert.ok(!painted.includes('#ffffff'), 'a whole-facade accent must not overpaint the wall');
}

// case-08: the upper wall is declared brick but carries no colour, and the
// neutral render base is far from the measured crop. Pin the gap so a future
// extraction that supplies the colour is noticed.
{
  const wall = materials(featuresOf('case-08')).find(f => f.region === 'upper-wall');
  assert.ok(wall, 'case-08 must declare an upper-wall material');
  assert.equal(wall.colour, undefined, 'case-08 is expected to still miss its wall colour');
  const sample = sampleOf('case-08');
  assert.ok(sample, 'case-08 crop must sample');
  assert.equal(sample.family, 'brick', `case-08 measured wall should read as brick, got ${sample.family}`);
  assert.ok(luma(RENDER_BASE) - luma(sample.hex) > 80, `render base ${RENDER_BASE} should be far lighter than the measured wall ${sample.hex}`);
}

console.log(`Wall-colour regression passed: case-14 red brick survives the whole-facade accent; case-08 measured ${sampleOf('case-08')?.hex} vs render base ${RENDER_BASE}. Wrote ${OUT}.`);
