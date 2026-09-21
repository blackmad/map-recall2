/**
 * Named regression for the 2026-09-21 case-14 source-shape-study refresh.
 *
 * The whole-facade "accent" guard in `cityAppearanceFacadeRecipes.ts` stops a
 * trim region covering >=60% of the source crop from repainting the wall. The
 * delivered review packet was built before that guard, so case-14 Elandsgracht
 * 19's stored full source-shape study still painted the entire wall white even
 * though the metric candidate was already correct. `refresh-reviewed-shape-study.ts`
 * republished the stale study; this check pins that the delivered packet now
 * paints the declared red brick and no whole-wall accent, so the overpaint
 * cannot silently return.
 *
 * Run: npx tsx scripts/review/check-reviewed-shape-study.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { compileSourceShapePreview } from './source-shape-preview.ts';

const CASES = 'public/data/facade-repair-preview/cases.json';
const TRIM = new Set(['accent', 'band', 'surround', 'plinth']);

const bytes = fs.readFileSync(CASES);
const sha = createHash('sha256').update(bytes).digest('hex');
const packet = JSON.parse(bytes.toString('utf8'));

assert.equal(packet.previewOnly, true, 'review packet must be a previewOnly packet');
assert.ok(Array.isArray(packet.cases) && packet.cases.length > 0, 'review packet must carry cases');

const entry = packet.cases.find((item: any) => item?.caseId === 'case-14');
assert.ok(entry, 'case-14 must be present');
const input = entry.shapeFeatures?.full;
assert.ok(input, 'case-14 must carry a stored full shape-study input');
assert.ok(Array.isArray(input.features), 'case-14 shape features must be an array');

/** The whole-crop accent feature the guard is meant to suppress. */
const wholeCropTrim = (features: any[], width: number, height: number) =>
  (features ?? []).filter((feature: any) => {
    if (feature.kind !== 'material' || !TRIM.has(feature.region)) return false;
    if (!Array.isArray(feature.bounds) || feature.bounds.length !== 4) return false;
    const [left, top, right, bottom] = feature.bounds;
    return (Math.max(0, right - left) * Math.max(0, bottom - top)) / (width * height) >= 0.6;
  });

const suppressed = wholeCropTrim(input.features, input.width, input.height);
assert.ok(suppressed.length > 0, 'case-14 must still declare the whole-crop accent feature the guard exists for');

const stored = entry.shapeStudy?.full;
assert.ok(stored, 'case-14 must carry a stored full shape study');

const fresh = compileSourceShapePreview({
  width: input.width,
  height: input.height,
  cropSha256: input.cropSha256,
  captureDate: input.captureDate,
  features: input.features,
});

// The delivered study must be exactly a fresh guarded compile; this is what
// makes the revision durable across a packet rebuild rather than a one-off edit.
assert.equal(
  JSON.stringify(stored),
  JSON.stringify(fresh),
  'case-14 stored full shape study is out of sync with the guarded compiler; re-run scripts/review/refresh-reviewed-shape-study.ts',
);

// The guard drops the whole-crop accent patch and the declared brick survives.
const materialPatches = (stored.patches ?? []).filter((patch: any) => patch.featureKind === 'observed-material');
assert.equal(materialPatches.length, 1, `case-14 must paint exactly one wall material; found ${materialPatches.length}`);
assert.equal(materialPatches[0].colour, '#8b4513', 'case-14 wall must be the declared red brick #8b4513');
assert.ok(materialPatches[0].featureId.endsWith('full:material-wall'), 'the one material patch is the declared wall, not the accent');
assert.equal(stored.patches.length, 83, `expected 83 case-14 full patches, found ${stored.patches.length}`);

console.log(
  `Reviewed shape study: case-14 packet ${sha.slice(0, 12)} is a fresh guarded compile ` +
    `(${stored.patches.length} patches, wall ${materialPatches[0].colour}, whole-crop accent suppressed).`,
);
