/**
 * Pins the A2 roofline arithmetic: the coarse/snap contract, the strict
 * "only sky above" purity rule, the 3DBAG eave plausibility gate, multi-view
 * consensus (including the single-view carve-out), and the pixel ↔ metre
 * frame conversion. If any of these silently drift, every downstream metre
 * does too.
 */
import assert from 'node:assert/strict';
import {
  applyEaveGate, applyRoofMaxGate, applyViewBias, columnBoundary, consensusProfile, consensusToViewPx, estimateViewBias, LABEL,
  medianOffset, pixelToWorld, profileShape, rescueSky, resampleProfile, stripBoundaries, type Luma, type Mask,
} from './stripRoofline.ts';
import type { StripFrame } from './stripFrame.ts';

let checks = 0;
const check = (name: string, fn: () => void) => {
  checks++;
  try { fn(); } catch (error) { console.error(`FAIL ${name}:`, error); process.exitCode = 1; }
};

/** Build a 1-column mask/luma pair from per-row labels and luma values. */
function column(labels: number[], luma: number[]): { mask: Mask; luma: Luma } {
  assert.equal(labels.length, luma.length);
  return {
    mask: { width: 1, height: labels.length, labels: Uint8Array.from(labels) },
    luma: { width: 1, height: luma.length, values: Uint8Array.from(luma) },
  };
}

check('a synthetic step gable with a blurred edge is recovered within 2 px', () => {
  const height = 100;
  const trueEdge = 40;
  // The mask commits to "building" a few rows late (typical segmentation
  // softness): sky through row 42, building from 43.
  const labels = new Array(height).fill(LABEL.SKY);
  for (let y = 43; y < height; y++) labels[y] = LABEL.BUILDING;
  // The photo's real edge, at row 40, is blurred over a couple of rows.
  const luma = new Array(height).fill(200);
  for (let y = 0; y < height; y++) {
    if (y >= trueEdge + 2) luma[y] = 50;
    else if (y === trueEdge) luma[y] = 150;
    else if (y === trueEdge + 1) luma[y] = 90;
  }
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.nullReason, null);
  assert.equal(result.method, 'snapped');
  assert.ok(result.rowPx !== null && Math.abs(result.rowPx - trueEdge) <= 2,
    `expected within 2px of ${trueEdge}, got ${result.rowPx}`);
});

check('no gradient clears the threshold: the coarse boundary is kept', () => {
  const height = 60;
  const labels = new Array(height).fill(LABEL.SKY);
  for (let y = 30; y < height; y++) labels[y] = LABEL.BUILDING;
  const luma = new Array(height).fill(128); // flat: no real edge to snap to
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.method, 'coarse');
  assert.equal(result.rowPx, 30);
});

check('the top row already building: null, clipped', () => {
  const height = 20;
  const labels = new Array(height).fill(LABEL.BUILDING);
  const luma = new Array(height).fill(80);
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.rowPx, null);
  assert.equal(result.nullReason, 'clipped');
});

check('a column with no sky at all: null, no-sky', () => {
  const height = 20;
  const labels = new Array(height).fill(LABEL.UNKNOWN);
  const luma = new Array(height).fill(80);
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.rowPx, null);
  assert.equal(result.nullReason, 'no-sky');
});

check('a short building blip well above the real roof: null, not-open-sky-above', () => {
  // This is the shape of the false-low-line bug: a couple of stray
  // "building" pixels (segmentation noise) high up, real sky, then the real
  // roof. Before the purity rule this accepted the deeper run outright;
  // now any non-sky pixel more than the edge tolerance above the chosen
  // transition disqualifies it, rather than silently reporting the lower one.
  const height = 60;
  const labels = new Array(height).fill(LABEL.SKY);
  labels[10] = LABEL.BUILDING; labels[11] = LABEL.BUILDING; // run of 2, too short to be a candidate itself
  for (let y = 35; y < height; y++) labels[y] = LABEL.BUILDING; // the deeper, otherwise-qualifying run
  const luma = new Array(height).fill(180);
  for (let y = 35; y < height; y++) luma[y] = 60;
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.rowPx, null);
  assert.equal(result.nullReason, 'not-open-sky-above');
});

check('a tree high up, a sky gap, then building: null, not-open-sky-above', () => {
  // The exact failure reported: a tree canopy (occluder) well above the
  // transition, with sky visible through its gaps immediately below it, then
  // a solid building run further down (e.g. a window row, not the real
  // roof). The gap of "sky" between the canopy and the window would let the
  // old scan treat everything above the window as open sky; the purity rule
  // must not be fooled by that gap.
  const height = 80;
  const labels = new Array(height).fill(LABEL.SKY);
  for (let y = 5; y < 15; y++) labels[y] = LABEL.OCCLUDER; // the canopy
  // rows 15-49: sky (a gap under the canopy) — this is the trap
  for (let y = 50; y < height; y++) labels[y] = LABEL.BUILDING; // a false candidate, e.g. a window row
  const luma = new Array(height).fill(180);
  for (let y = 50; y < height; y++) luma[y] = 60;
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.rowPx, null);
  assert.equal(result.nullReason, 'not-open-sky-above');
});

check('mask speckle right at the edge (within tolerance) does not block the boundary', () => {
  const height = 50;
  const labels = new Array(height).fill(LABEL.SKY);
  labels[28] = LABEL.OTHER; // speckle 2 px above the transition — inside tolerance
  for (let y = 30; y < height; y++) labels[y] = LABEL.BUILDING;
  const luma = new Array(height).fill(180);
  for (let y = 30; y < height; y++) luma[y] = 60;
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.nullReason, null);
  assert.equal(result.coarsePx, 30);
});

check('a tree at the transition (occluder within 3 px): null, occluder-near-transition', () => {
  const height = 50;
  const labels = new Array(height).fill(LABEL.SKY);
  labels[28] = LABEL.OCCLUDER; // a branch, 2 px above the coarse transition — inside the purity tolerance...
  for (let y = 30; y < height; y++) labels[y] = LABEL.BUILDING;
  const luma = new Array(height).fill(180);
  for (let y = 30; y < height; y++) luma[y] = 60;
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  // ...but still caught by the separate ±3 px occluder-adjacency rule.
  assert.equal(result.rowPx, null);
  assert.equal(result.nullReason, 'occluder-near-transition');
});

check('an occluder anywhere above the transition now blocks it: null, not-open-sky-above', () => {
  // Stricter than the first version of this module: a bird far from the
  // roofline used to be tolerated. The purity rule the plan asked for does
  // not distinguish "far" from "near" — any occluder above disqualifies the
  // candidate, trading a few honest abstentions for never reporting a wrong
  // line under a tree.
  const height = 60;
  const labels = new Array(height).fill(LABEL.SKY);
  labels[2] = LABEL.OCCLUDER; // a bird, far from the roofline
  for (let y = 40; y < height; y++) labels[y] = LABEL.BUILDING;
  const luma = new Array(height).fill(180);
  for (let y = 40; y < height; y++) luma[y] = 60;
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.rowPx, null);
  assert.equal(result.nullReason, 'not-open-sky-above');
});

check('stripBoundaries tallies null reasons across columns', () => {
  const width = 3, height = 20;
  const labels = new Uint8Array(width * height).fill(LABEL.UNKNOWN); // every column: no-sky
  const luma = new Uint8Array(width * height).fill(80);
  const boundaries = stripBoundaries({ width, height, labels }, { width, height, values: luma });
  assert.equal(boundaries.nullReasons['no-sky'], 3);
  assert.equal(boundaries.rowPx.every(v => v === null), true);
});

check('applyEaveGate: a boundary 2 m below the matched eave is rejected', () => {
  const frame: StripFrame = {
    start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, leftEdge: 'start',
    bottomNap: 0, topNap: 20, marginFactor: 1, marginM: 0,
    requestedPixelsPerMetre: 10, pixelsPerMetreX: 10, pixelsPerMetreY: 10,
  };
  const eaveNap = 15; // the matched 3DBAG wall's own top
  // row 30 -> up = 20 - 30/10 = 17 (above the eave: fine)
  // row 60 -> up = 20 - 60/10 = 14 (exactly 1 m below eave: at the margin, kept)
  // row 90 -> up = 20 - 90/10 = 11 (4 m below eave: rejected)
  const rowPx: Array<number | null> = [30, 60, 90, null];
  const result = applyEaveGate(frame, rowPx, eaveNap, 1.0);
  assert.equal(result.rowPx[0], 30);
  assert.equal(result.rowPx[1], 60);
  assert.equal(result.rowPx[2], null);
  assert.equal(result.rowPx[3], null);
  assert.equal(result.gated, 1);
});

check('applyEaveGate leaves an already-null column alone and gates nothing when eave is far below', () => {
  const frame: StripFrame = {
    start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, leftEdge: 'start',
    bottomNap: 0, topNap: 20, marginFactor: 1, marginM: 0,
    requestedPixelsPerMetre: 10, pixelsPerMetreX: 10, pixelsPerMetreY: 10,
  };
  const rowPx: Array<number | null> = [5, null, 8];
  const result = applyEaveGate(frame, rowPx, 0, 1.0); // eave far below every candidate
  assert.deepEqual(result.rowPx, rowPx);
  assert.equal(result.gated, 0);
});

check('two views that disagree by more than the tolerance give null consensus', () => {
  const a: Array<[number, number | null]> = [[0, 10], [0.1, 10], [0.2, 10]];
  const b: Array<[number, number | null]> = [[0, 10.6], [0.1, 10.1], [0.2, 10.6]];
  const { profile, singleView } = consensusProfile([a, b], 0.25);
  assert.equal(profile[0][1], null); // |10 - 10.6| = 0.6 > 0.25
  assert.ok(profile[1][1] !== null); // |10 - 10.1| = 0.1 <= 0.25
  assert.equal(profile[2][1], null);
  assert.deepEqual(singleView, [false, false, false]);
});

check('a single view is returned unchanged, flagged singleView', () => {
  const only: Array<[number, number | null]> = [[0, 5], [0.1, null]];
  const { profile, singleView } = consensusProfile([only]);
  assert.deepEqual(profile, only);
  assert.deepEqual(singleView, [true, false]);
});

check('exactly one of several views resolves a column: kept, flagged singleView', () => {
  const a: Array<[number, number | null]> = [[0, 10], [0.1, null]];
  const b: Array<[number, number | null]> = [[0, null], [0.1, null]];
  const { profile, singleView } = consensusProfile([a, b], 0.25);
  assert.equal(profile[0][1], 10);
  assert.equal(singleView[0], true);
  assert.equal(profile[1][1], null);
  assert.equal(singleView[1], false);
});

check('three views: two agreeing outvote a lone disagreement', () => {
  const a: Array<[number, number | null]> = [[0, 10]];
  const b: Array<[number, number | null]> = [[0, 10.05]];
  const c: Array<[number, number | null]> = [[0, 12]];
  const { profile, singleView } = consensusProfile([a, b, c], 0.25);
  // median of [10, 10.05, 12] is 10.05 but the pair alone must agree within
  // tolerance; spread across all three is 2, so this must abstain rather than
  // silently averaging in the outlier.
  assert.equal(profile[0][1], null);
  assert.equal(singleView[0], false);
});

check('resampleProfile bins pixel rows onto a 0.10 m grid using the frame', () => {
  const frame: StripFrame = {
    start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, leftEdge: 'start',
    bottomNap: 0, topNap: 10, marginFactor: 1, marginM: 0,
    requestedPixelsPerMetre: 10, pixelsPerMetreX: 10, pixelsPerMetreY: 10,
  };
  // 101 px wide (10 m at 10 px/m), boundary rises 1 px per column: row=x, so
  // up(x) = 10 - x/10 exactly, and a 0.10 m bin holds exactly one column.
  const rowPx: Array<number | null> = new Array(101).fill(null).map((_, x) => x);
  const profile = resampleProfile(frame, rowPx, 0.1);
  assert.equal(profile[0][0], 0);
  assert.equal(profile[0][1], 10);
  assert.equal(profile[50][0], 5);
  assert.equal(profile[50][1], 5);
});

check('shape: a peak well above both ends is shaped, a slope is not', () => {
  const shaped: Array<[number, number | null]> = [[0, 10], [1, 12], [2, 10]];
  const sloped: Array<[number, number | null]> = [[0, 10], [1, 10.7], [2, 11.5]];
  assert.equal(profileShape(shaped), 'shaped');
  assert.equal(profileShape(sloped), 'sloped');
});

check('the frame conversion round-trips against a real manifest record (Herengracht 242)', () => {
  // Taken verbatim from strips-roofline-v2/manifest.json, strip 0.
  const frame: StripFrame = {
    start: { x: 120916.68089035057, y: 487247.30030098074 },
    end: { x: 120917.12089048907, y: 487253.0703009909 },
    leftEdge: 'start',
    bottomNap: 0.4599999904632568,
    topNap: 19.69899845123291,
    marginFactor: 1.06,
    marginM: 0.17360256396456447,
    requestedPixelsPerMetre: 48,
    pixelsPerMetreX: 47.92990683409238,
    pixelsPerMetreY: 47.975470338650645,
  };
  const width = 294, height = 923;
  for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [147, 460]]) {
    const { along, up } = pixelToWorld(frame, x, y);
    const xBack = (along + frame.marginM) * frame.pixelsPerMetreX;
    const yBack = (frame.topNap - up) * frame.pixelsPerMetreY;
    assert.ok(Math.abs(xBack - x) < 1e-6, `x round-trip: ${xBack} vs ${x}`);
    assert.ok(Math.abs(yBack - y) < 1e-6, `y round-trip: ${yBack} vs ${y}`);
  }
  // The top-left pixel sits at the wall's own frame corner: along ≈ -marginM,
  // up == topNap exactly (y=0 is defined as the top of the frame).
  const topLeft = pixelToWorld(frame, 0, 0);
  assert.ok(Math.abs(topLeft.along - (-frame.marginM)) < 1e-9);
  assert.equal(topLeft.up, frame.topNap);
});

check('estimateViewBias: a constant offset between two views is recovered and the busier view is the reference', () => {
  const reference: Array<[number, number | null]> = [[0, 20], [0.1, 20.5], [0.2, 21], [0.3, 21.5], [0.4, 22]];
  // Same shape, shifted up 1.2 m, and missing one column (still more resolved on `reference`).
  const shifted: Array<[number, number | null]> = [[0, 21.2], [0.1, 21.7], [0.2, null], [0.3, 22.7], [0.4, 23.2]];
  const { biasesM, referenceIndex } = estimateViewBias([reference, shifted]);
  assert.equal(referenceIndex, 0);
  assert.equal(biasesM[0], 0);
  assert.ok(Math.abs(biasesM[1] - 1.2) < 1e-6, `bias ${biasesM[1]}`);
});

check('estimateViewBias: with 3 views, the middle one by height is the reference, not the busiest', () => {
  const low: Array<[number, number | null]> = [[0, 10], [0.1, 10], [0.2, 10], [0.3, 10]];
  const mid: Array<[number, number | null]> = [[0, 11], [0.1, 11]]; // fewer columns, but the true middle
  const high: Array<[number, number | null]> = [[0, 12], [0.1, 12], [0.2, 12]];
  const { referenceIndex } = estimateViewBias([low, mid, high]);
  assert.equal(referenceIndex, 1);
});

check('estimateViewBias: too little overlap leaves a view unaligned (bias 0) rather than guessing', () => {
  const reference: Array<[number, number | null]> = [[0, 20], [0.1, 20], [0.2, 20], [0.3, 20], [0.4, 20]];
  const barelyOverlapping: Array<[number, number | null]> = [[0, 25], [0.1, null], [0.2, null], [0.3, null], [0.4, null]];
  const { biasesM } = estimateViewBias([reference, barelyOverlapping], 0.1, 3);
  assert.equal(biasesM[1], 0);
});

check('applyViewBias shifts a profile onto the reference scale', () => {
  const profile: Array<[number, number | null]> = [[0, 21.2], [0.1, null], [0.2, 22.7]];
  const aligned = applyViewBias(profile, 1.2);
  assert.equal(aligned[0][1], 20);
  assert.equal(aligned[1][1], null);
  assert.ok(Math.abs((aligned[2][1] ?? NaN) - 21.5) < 1e-6);
});

check('bias correction rescues consensus: two views of the same gable, offset 1.2 m, agree once aligned', () => {
  const a: Array<[number, number | null]> = [[0, 20], [0.1, 21], [0.2, 22], [0.3, 21], [0.4, 20]];
  const b: Array<[number, number | null]> = [[0, 21.2], [0.1, 22.2], [0.2, 23.2], [0.3, 22.2], [0.4, 21.2]];
  const naive = consensusProfile([a, b], 0.25);
  assert.ok(naive.profile.every(([, up]) => up === null), 'naive consensus should null everything: 1.2 m > 0.25 m tolerance');
  const { biasesM, referenceIndex } = estimateViewBias([a, b]);
  const aligned = [a, b].map((p, i) => applyViewBias(p, biasesM[i]));
  const fixed = consensusProfile(aligned, 0.25);
  assert.ok(fixed.profile.every(([, up]) => up !== null), 'aligned consensus should resolve every column');
  // Absolute NAP is kept on the reference view's own scale, not invented.
  assert.equal(fixed.profile[2][1], a[2][1]); // reference is `a` (both have 5/5 resolved; ties keep the first)
  assert.equal(referenceIndex, 0);
});

/** Build a width x height mask/luma pair from a row-major label grid and luma grid. */
function grid(labels: number[][], lumaRows: number[][]): { mask: Mask; luma: Luma } {
  const height = labels.length, width = labels[0].length;
  const flatLabels = new Uint8Array(width * height);
  const flatLuma = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    flatLabels[y * width + x] = labels[y][x];
    flatLuma[y * width + x] = lumaRows[y][x];
  }
  return {
    mask: { width, height, labels: flatLabels },
    luma: { width, height, values: flatLuma },
  };
}

check('rescueSky: a bright, smooth overcast sky mislabelled as occluder is rescued around a dark branch, not through it', () => {
  const width = 9, height = 7;
  // Rows 0-4: overcast "sky", mislabelled occluder (3) end to end by the
  // segmentation model, except a single dark branch column (x=4) partway down.
  // Rows 5-6: building.
  const isBranch = (x: number, y: number) => x === 4 && y >= 1 && y <= 3;
  const labels: number[][] = [];
  const lumaRows: number[][] = [];
  for (let y = 0; y < height; y++) {
    const labelRow: number[] = [];
    const lumaRow: number[] = [];
    for (let x = 0; x < width; x++) {
      if (y < 5) { labelRow.push(LABEL.OCCLUDER); lumaRow.push(isBranch(x, y) ? 40 : 200); }
      else { labelRow.push(LABEL.BUILDING); lumaRow.push(60); }
    }
    labels.push(labelRow);
    lumaRows.push(lumaRow);
  }
  const { mask, luma } = grid(labels, lumaRows);
  const result = rescueSky(mask, luma);
  // Columns well clear of the branch's own 5x5 window (>= windowRadius+1 away),
  // and rows well clear of the building band below, are rescued on both sides
  // of the branch — the rescue reaches past it rather than stopping at it.
  for (const x of [0, 1, 7, 8]) for (let y = 0; y < 3; y++) {
    assert.equal(result.labels[y * width + x], LABEL.SKY, `(${x},${y}) should be rescued`);
  }
  // The branch itself survives as an occluder, not overwritten by the rescue
  // that reaches all around it.
  assert.equal(result.labels[2 * width + 4], LABEL.OCCLUDER);
  assert.ok(result.rescuedSkyFraction > 0);
});

check('rescueSky: a bright smooth wall below the roofline is NOT rescued — it is not connected to the top edge', () => {
  const width = 3, height = 6;
  const labels: number[][] = [];
  const lumaRows: number[][] = [];
  for (let y = 0; y < height; y++) {
    const labelRow: number[] = [];
    const lumaRow: number[] = [];
    for (let x = 0; x < width; x++) {
      if (y === 0) { labelRow.push(LABEL.SKY); lumaRow.push(220); }
      else if (y === 1) { labelRow.push(LABEL.BUILDING); lumaRow.push(60); } // a hard stop: the roofline itself
      else { labelRow.push(LABEL.OCCLUDER); lumaRow.push(200); } // a bright, smooth (sunlit) wall below — looks like sky, isn't reachable
    }
    labels.push(labelRow); lumaRows.push(lumaRow);
  }
  const { mask, luma } = grid(labels, lumaRows);
  const result = rescueSky(mask, luma);
  for (let y = 2; y < height; y++) for (let x = 0; x < width; x++) {
    assert.equal(result.labels[y * width + x], LABEL.OCCLUDER, `(${x},${y}) below the roofline must stay unrescued`);
  }
  assert.equal(result.rescuedSkyFraction, 0);
});

check('applyRoofMaxGate: a boundary 2 m above the pand roof max is rejected, 1 m above is kept', () => {
  const profile: Array<[number, number | null]> = [[0, 20], [0.1, 21], [0.2, 22], [0.3, null]];
  const roofMaxNap = 20; // 1 m margin: up to 21 kept, above rejected
  const result = applyRoofMaxGate(profile, roofMaxNap, 1.0);
  assert.equal(result.profile[0][1], 20);
  assert.equal(result.profile[1][1], 21); // exactly at the margin: kept (not `>`)
  assert.equal(result.profile[2][1], null); // 2 m above: rejected
  assert.equal(result.profile[3][1], null); // already null: untouched
  assert.equal(result.gated, 1);
});

check('medianOffset: the median of up - reference, or null with nothing resolved', () => {
  const profile: Array<[number, number | null]> = [[0, 10], [0.1, null], [0.2, 12], [0.3, 14]];
  assert.equal(medianOffset(profile, 10), 2); // median of [0, 2, 4] is 2
  assert.equal(medianOffset([[0, null]], 10), null);
});

check('rescueSky leaves the original mask untouched', () => {
  const { mask, luma } = grid([[LABEL.OCCLUDER, LABEL.OCCLUDER], [LABEL.BUILDING, LABEL.BUILDING]], [[200, 200], [60, 60]]);
  const before = Uint8Array.from(mask.labels);
  rescueSky(mask, luma);
  assert.deepEqual(mask.labels, before);
});

check('consensusToViewPx: a non-reference view with a known bias round-trips onto its own pixel rows', () => {
  // Two views of the same wall, both 10 px/m, 10 m wide, top at NAP 20.
  // View A is the reference (bias 0); view B reads 1 m higher than A, so
  // estimateViewBias/applyViewBias would report viewBiasM = 1 for B and shift
  // B's profile down by 1 m before consensus. Consensus therefore lives on
  // A's (the reference's) own scale. A column at consensus up=15 (A's own
  // scale) must draw on B's own photo at B's own up=16 (15 + viewBiasM),
  // since that is what B's camera actually saw before alignment.
  const frameA: StripFrame = {
    start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, leftEdge: 'start',
    bottomNap: 0, topNap: 20, marginFactor: 1, marginM: 0,
    requestedPixelsPerMetre: 10, pixelsPerMetreX: 10, pixelsPerMetreY: 10,
  };
  const frameB = { ...frameA }; // same physical frame; the bias is B's own reading error, not a different render
  const consensus: Array<[number, number | null]> = [[5, 15]]; // along=5m, up=15 (A's/reference's own scale)
  const viewBiasM = 1; // B read 1 m higher than the reference before alignment

  // A is the reference: viewBiasM=0, so its own pixel row is a plain NAP->px conversion.
  const pxA = consensusToViewPx(frameA, consensus, 100, 0);
  const rowAt5mA = Math.round(5 * frameA.pixelsPerMetreX);
  assert.equal(pxA[rowAt5mA], (frameA.topNap - 15) * frameA.pixelsPerMetreY); // (20-15)*10 = 50

  // B is non-reference: the drawn row must be B's OWN up (15 + 1 = 16), not
  // the raw consensus value of 15 — the bug being fixed here.
  const pxB = consensusToViewPx(frameB, consensus, 100, viewBiasM);
  const rowAt5mB = Math.round(5 * frameB.pixelsPerMetreX);
  assert.equal(pxB[rowAt5mB], (frameB.topNap - 16) * frameB.pixelsPerMetreY); // (20-16)*10 = 40, not (20-15)*10 = 50
  assert.notEqual(pxB[rowAt5mB], pxA[rowAt5mA]); // the two views must NOT draw the same row for the same wall-metre
});

if (!process.exitCode) console.log(`stripRoofline: ${checks} checks passed`);
