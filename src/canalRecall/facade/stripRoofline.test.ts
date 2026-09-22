/**
 * Pins the A2 roofline arithmetic: the coarse/snap contract, the abstention
 * rules, multi-view consensus, and the pixel ↔ metre frame conversion. If any
 * of these silently drift, every downstream metre does too.
 */
import assert from 'node:assert/strict';
import {
  columnBoundary, consensusProfile, LABEL, pixelToWorld, profileShape,
  resampleProfile, stripBoundaries, type Luma, type Mask,
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

check('a short building blip is skipped as noise, not taken as the edge', () => {
  const height = 60;
  const labels = new Array(height).fill(LABEL.SKY);
  labels[10] = LABEL.BUILDING; labels[11] = LABEL.BUILDING; // run of 2, too short
  for (let y = 35; y < height; y++) labels[y] = LABEL.BUILDING; // the real run
  const luma = new Array(height).fill(180);
  for (let y = 35; y < height; y++) luma[y] = 60;
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.coarsePx, 35);
});

check('a tree at the transition (occluder within 3 px): null', () => {
  const height = 50;
  const labels = new Array(height).fill(LABEL.SKY);
  labels[28] = LABEL.OCCLUDER; // a branch, 2 px above the coarse transition
  for (let y = 30; y < height; y++) labels[y] = LABEL.BUILDING;
  const luma = new Array(height).fill(180);
  for (let y = 30; y < height; y++) luma[y] = 60;
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.rowPx, null);
  assert.equal(result.nullReason, 'occluder-near-transition');
});

check('an occluder well clear of the transition does not block it', () => {
  const height = 60;
  const labels = new Array(height).fill(LABEL.SKY);
  labels[2] = LABEL.OCCLUDER; // a bird, far from the roofline
  for (let y = 40; y < height; y++) labels[y] = LABEL.BUILDING;
  const luma = new Array(height).fill(180);
  for (let y = 40; y < height; y++) luma[y] = 60;
  const { mask, luma: lumaImg } = column(labels, luma);
  const result = columnBoundary(mask, lumaImg, 0);
  assert.equal(result.nullReason, null);
});

check('stripBoundaries tallies null reasons across columns', () => {
  const width = 3, height = 20;
  const labels = new Uint8Array(width * height).fill(LABEL.UNKNOWN); // every column: no-sky
  const luma = new Uint8Array(width * height).fill(80);
  const boundaries = stripBoundaries({ width, height, labels }, { width, height, values: luma });
  assert.equal(boundaries.nullReasons['no-sky'], 3);
  assert.equal(boundaries.rowPx.every(v => v === null), true);
});

check('two views that disagree by more than the tolerance give null consensus', () => {
  const a: Array<[number, number | null]> = [[0, 10], [0.1, 10], [0.2, 10]];
  const b: Array<[number, number | null]> = [[0, 10.6], [0.1, 10.1], [0.2, 10.6]];
  const consensus = consensusProfile([a, b], 0.25);
  assert.equal(consensus[0][1], null); // |10 - 10.6| = 0.6 > 0.25
  assert.ok(consensus[1][1] !== null); // |10 - 10.1| = 0.1 <= 0.25
  assert.equal(consensus[2][1], null);
});

check('a single view is returned unchanged: nothing to disagree with', () => {
  const only: Array<[number, number | null]> = [[0, 5], [0.1, null]];
  assert.deepEqual(consensusProfile([only]), only);
});

check('three views: two agreeing outvote a lone disagreement', () => {
  const a: Array<[number, number | null]> = [[0, 10]];
  const b: Array<[number, number | null]> = [[0, 10.05]];
  const c: Array<[number, number | null]> = [[0, 12]];
  const consensus = consensusProfile([a, b, c], 0.25);
  // median of [10, 10.05, 12] is 10.05 but the pair alone must agree within
  // tolerance; spread across all three is 2, so this must abstain rather than
  // silently averaging in the outlier.
  assert.equal(consensus[0][1], null);
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

if (!process.exitCode) console.log(`stripRoofline: ${checks} checks passed`);
