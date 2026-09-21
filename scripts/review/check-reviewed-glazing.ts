/**
 * Named regression for the 2026-09-21 near-white window glazing guard.
 *
 * The 25-case review flagged case-11 De Clercqstraat 26, and rendering its
 * metric candidate showed every upper window as a blank white pane. The cause
 * is the extraction: it declared `colour:"#ffffff"` for all twelve full-tier
 * windows (the near-white frame/curtain it sampled), and the facade compiler
 * painted that observed hex straight into the glazing. The same pattern affects
 * case-18.
 *
 * `cityAppearanceFacadeRecipes.ts` now treats a near-white window colour as
 * undeclared and falls back to the neutral glass (`windowGlass`), while a real
 * glass hex is kept and door leaves are untouched (a white door is real
 * architecture). `scripts/review/refresh-reviewed-glazing.ts` republished only
 * case-11's metric patches and full source-shape study.
 *
 * This pins the guard on synthetic features (boundary included), the delivered
 * case-11 packet (stored gap preserved, neutral glazing rendered, study equal to
 * a fresh guarded compile), and that case-18 still carries the gap.
 *
 * Run: npx tsx scripts/review/check-reviewed-glazing.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { compileSourceShapePreview } from './source-shape-preview.ts';

const CASES = 'public/data/facade-repair-preview/cases.json';
const OUT = 'review-data/case-glazing.json';
const GLASS = '#526a6b';

const bytes = fs.readFileSync(CASES);
const packet = JSON.parse(bytes.toString('utf8'));
const caseById = (id: string) => {
  const entry = packet.cases.find((row: any) => row.caseId === id);
  assert.ok(entry, `${id} missing from the review packet`);
  return entry;
};

const studyFor = (features: any[], width = 400, height = 600) =>
  compileSourceShapePreview({
    width,
    height,
    cropSha256: createHash('sha256').update(`glazing-fixture:${width}x${height}`).digest('hex'),
    captureDate: '2026-09-21T00:00:00Z',
    features,
  });

const windowPatches = (study: any) => (study.patches ?? []).filter((patch: any) => patch.featureKind === 'observed-window');
const doorPatches = (study: any) => (study.patches ?? []).filter((patch: any) => patch.featureKind === 'observed-door');

// A near-white window colour is the frame/curtain, not glass: the glazing must
// fall back to the neutral glass and no white pane may remain.
{
  const study = studyFor([
    { id: 'full:w1', kind: 'window', bounds: [50, 100, 150, 250], head: 'rectangular', colour: '#ffffff', disposition: 'machine-observed-unreviewed' },
  ]);
  const colours = new Set(windowPatches(study).map((patch: any) => patch.colour));
  assert.ok(colours.has(GLASS), 'near-white window glazing must fall back to neutral glass');
  assert.ok(!colours.has('#ffffff'), 'near-white window glazing must not paint a white pane');
}

// A genuine glass hex is kept, and the guard boundary is exactly 235 per channel.
{
  const kept = studyFor([
    { id: 'full:w1', kind: 'window', bounds: [50, 100, 150, 250], head: 'rectangular', colour: '#334947', disposition: 'machine-observed-unreviewed' },
  ]);
  assert.ok(new Set(windowPatches(kept).map((patch: any) => patch.colour)).has('#334947'), 'a real glass hex must be kept');
  const belowBoundary = studyFor([
    { id: 'full:w1', kind: 'window', bounds: [50, 100, 150, 250], head: 'rectangular', colour: '#e8e8e8', disposition: 'machine-observed-unreviewed' },
  ]);
  assert.ok(new Set(windowPatches(belowBoundary).map((patch: any) => patch.colour)).has('#e8e8e8'), 'a light glass below the 235 boundary must be kept');
  const atBoundary = studyFor([
    { id: 'full:w1', kind: 'window', bounds: [50, 100, 150, 250], head: 'rectangular', colour: '#ebebeb', disposition: 'machine-observed-unreviewed' },
  ]);
  assert.ok(new Set(windowPatches(atBoundary).map((patch: any) => patch.colour)).has(GLASS), 'a window colour at the 235 boundary must be recoloured');
}

// Door leaves are excluded: a white door stays white (real architecture).
{
  const study = studyFor([
    { id: 'full:d1', kind: 'door', bounds: [50, 100, 150, 350], head: 'rectangular', colour: '#ffffff', disposition: 'machine-observed-unreviewed' },
  ]);
  assert.ok(new Set(doorPatches(study).map((patch: any) => patch.colour)).has('#ffffff'), 'a white door leaf must be kept');
}

// case-11: the extraction gap is preserved, but the rendered glazing is neutral.
{
  const entry = caseById('case-11');
  const fullWindows = entry.shapeFeatures.full.features.filter((feature: any) => feature.kind === 'window');
  assert.equal(fullWindows.length, 12, 'case-11 full window count changed');
  assert.ok(fullWindows.every((feature: any) => feature.colour === '#ffffff'), 'case-11 extraction gap must stay visible (#ffffff)');
  const metricColours = new Set((entry.patches ?? []).filter((patch: any) => patch.featureKind === 'observed-window').map((patch: any) => patch.colour));
  assert.ok(metricColours.has(GLASS), 'case-11 metric glazing must be neutral glass');
  // Each full window feature that survives the ground-coverage gate must carry
  // neutral glazing and no white pane. A white frame patch is allowed (the
  // reviewed ground shop display declares one); w7/w8/w9 are suppressed by the
  // gate and carry no metric patch at all.
  for (const feature of fullWindows) {
    const featureColours = new Set((entry.patches ?? [])
      .filter((patch: any) => patch.featureKind === 'observed-window' && patch.featureId.endsWith(`:${feature.id}`))
      .map((patch: any) => patch.colour));
    if (!featureColours.size) continue;
    assert.ok(featureColours.has(GLASS), `case-11 ${feature.id} metric glazing must be neutral`);
    assert.ok(!featureColours.has('#ffffff'), `case-11 ${feature.id} metric glazing must not be white`);
  }
  const stored = entry.shapeStudy.full;
  const storedColours = new Set(windowPatches(stored).map((patch: any) => patch.colour));
  assert.ok(storedColours.has(GLASS), 'case-11 full study must render neutral glazing');
  for (const feature of fullWindows) {
    const featureColours = new Set(windowPatches(stored)
      .filter((patch: any) => patch.featureId.endsWith(`:${feature.id}`))
      .map((patch: any) => patch.colour));
    assert.ok(featureColours.has(GLASS) && !featureColours.has('#ffffff'), `case-11 ${feature.id} study glazing must be neutral`);
  }
  const fresh = compileSourceShapePreview({ width: entry.shapeFeatures.full.width, height: entry.shapeFeatures.full.height, cropSha256: entry.shapeFeatures.full.cropSha256, captureDate: entry.shapeFeatures.full.captureDate, features: entry.shapeFeatures.full.features });
  if (Array.isArray(stored.omissions)) fresh.omissions = stored.omissions;
  assert.equal(JSON.stringify(stored), JSON.stringify(fresh), 'case-11 stored study is out of sync; re-run scripts/review/refresh-reviewed-glazing.ts');
}

// case-18 is the other case with the extraction gap; the guard applies there too.
{
  const entry = caseById('case-18');
  const windows = (entry.shapeFeatures?.full?.features ?? []).filter((feature: any) => feature.kind === 'window');
  assert.ok(windows.length > 0 && windows.every((feature: any) => feature.colour === '#ffffff'), 'case-18 near-white window gap changed');
}

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      version: 1,
      kind: 'case-glazing',
      generatedAt: new Date().toISOString(),
      packet: { path: CASES, sha256: createHash('sha256').update(bytes).digest('hex') },
      guard: { nearWhiteMinChannel: 235, windowFallback: GLASS, doorLeavesExcluded: true },
      delivered: { 'case-11': { nearWhiteWindows: 12, metricGlazing: GLASS, studyTiers: ['full'] } },
      unrefreshed: { 'case-18': 'declares near-white windows; packet artifacts not refreshed this pass' },
    },
    null,
    2,
  ) + '\n',
);

console.log(
  'Reviewed glazing regression passed: near-white window colours fall back to neutral glass (#526a6b), real glass and white doors are kept, ' +
    'and case-11 delivers 12 neutral-glazed windows with its extraction gap preserved.',
);
