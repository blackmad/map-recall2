// node --import tsx --test src/canalRecall/look/overviewTransition.test.ts (runs with npm run test:look)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLEND_END_ZOOM, BLEND_START_ZOOM, OverviewBlend, PRESENCE_SPAN, blendAtZoom, legacyBlend, presenceOf, transitionOn } from '../overviewTransition/blend.ts';
import { FOOTPRINT_FADE_ZOOM, NOT_PARK_CLASSES, footprintTone, overviewBasemapPatches } from '../overviewTransition/basemapOverview.ts';
import { frameStats, jump, jumps, lab, shareOverDeltaE, worstIndex, zoomWarp, type Frame } from '../overviewTransition/frameMetrics.ts';
import { groundPalette } from '../ownGround/groundLook.ts';

test('the blend is one smooth curve from zoom 14 to 15.6, no step anywhere', () => {
  assert.equal(blendAtZoom(BLEND_START_ZOOM - 1), 0);
  assert.equal(blendAtZoom(BLEND_START_ZOOM), 0);
  assert.equal(blendAtZoom(BLEND_END_ZOOM), 1);
  assert.equal(blendAtZoom(20), 1);
  assert.ok(Math.abs(blendAtZoom((BLEND_START_ZOOM + BLEND_END_ZOOM) / 2) - 0.5) < 1e-9);
  assert.equal(blendAtZoom(NaN), 0);
  // Largest change per 0.1 zoom is the smoothstep's peak slope (1.5 / window), far below the old 0 → 1 at zoom 15.
  let worst = 0;
  for (let z = 13; z < 17; z += 0.01) worst = Math.max(worst, blendAtZoom(z + 0.1) - blendAtZoom(z));
  assert.ok(worst <= 1.5 * 0.1 / (BLEND_END_ZOOM - BLEND_START_ZOOM) + 1e-6, `step ${worst}`);
  assert.equal(legacyBlend(14.99) - legacyBlend(15), -1);
});

test('presence is full by PRESENCE_SPAN of the blend and the colour carries the rest', () => {
  assert.equal(presenceOf(0), 0);
  assert.equal(presenceOf(PRESENCE_SPAN / 2), 0.5);
  assert.equal(presenceOf(PRESENCE_SPAN), 1);
  assert.equal(presenceOf(1), 1);
});

test('hysteresis: a zoom jittering at the edge of the window never toggles the city', () => {
  const b = new OverviewBlend();
  const edge = BLEND_START_ZOOM + 0.12; // raw blend ≈ 0.02 (BLEND_ON)
  const toggles: boolean[] = [];
  for (let i = 0; i < 200; i++) { b.update(edge + (i % 2 ? 0.02 : -0.02)); toggles.push(b.active); }
  const flips = toggles.slice(1).filter((a, i) => a !== toggles[i]).length;
  assert.ok(flips <= 1, `flips ${flips}`);
  b.update(15); assert.ok(b.active && b.value > 0.5);
  b.update(BLEND_START_ZOOM + 0.07); assert.ok(b.active, 'stays on until below BLEND_OFF');
  b.update(BLEND_START_ZOOM); assert.ok(!b.active); assert.equal(b.value, 0);
});

test('?transition=0 opts out; default on', () => {
  assert.equal(transitionOn(''), true);
  assert.equal(transitionOn('?transition=0'), false);
  assert.equal(transitionOn('?a=1&transition=off'), false);
  assert.equal(transitionOn('?transition=1'), true);
});

test('overview basemap: protected areas in the land tone, footprints in the roof tone until the city is complete', () => {
  const palette = groundPalette('bright');
  const { paint, zoomRanges } = overviewBasemapPatches([
    { id: 'park', type: 'fill', 'source-layer': 'park' }, { id: 'park_outline', type: 'line', 'source-layer': 'park' },
    { id: 'building', type: 'fill', 'source-layer': 'building' }, { id: 'water', type: 'fill', 'source-layer': 'water' },
  ], palette);
  const by = Object.fromEntries(paint.map(p => [`${p.id}:${p.property}`, p.value]));
  const park = by['park:fill-color'] as unknown[];
  assert.deepEqual(park.slice(0, 3), ['match', ['get', 'class'], NOT_PARK_CLASSES]);
  assert.equal(park[3], `rgb(${palette.tones.land.base.join(',')})`);
  assert.equal(park[4], `rgb(${palette.tones.park.join(',')})`);
  assert.equal(by['park_outline:line-opacity'], 0);
  assert.equal(by['building:fill-color'], `rgb(${footprintTone().join(',')})`);
  assert.deepEqual(zoomRanges, [{ id: 'building', minzoom: 13, maxzoom: BLEND_END_ZOOM + FOOTPRINT_FADE_ZOOM }]);
  assert.ok(!Object.keys(by).some(k => k.startsWith('water')), 'water stays with basemapGroundPatches');
  const tone = footprintTone();
  assert.ok(tone.every(v => Number.isInteger(v) && v >= 0 && v <= 255));
});

const solid = (w: number, h: number, rgb: [number, number, number]): Frame => {
  const data = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) data.set(rgb, i * 3);
  return { data, width: w, height: h, channels: 3 };
};

test('frame metrics: luma, chroma, ΔE share and the worst step', () => {
  assert.deepEqual(lab(255, 255, 255).map(v => Math.round(v) + 0), [100, 0, 0]);
  const white = solid(8, 8, [255, 255, 255]), grey = solid(8, 8, [128, 128, 128]), red = solid(8, 8, [200, 40, 40]);
  assert.equal(frameStats(white).luma, 255);
  assert.ok(frameStats(red).chroma > 50);
  assert.equal(shareOverDeltaE(white, white), 0);
  assert.equal(shareOverDeltaE(white, grey), 1);
  const j = jump(white, grey);
  assert.ok(j.dLuma < -100 && j.overDE === 1);
  const js = jumps([white, white, grey, grey]);
  assert.equal(worstIndex(js), 1);
});

test('zoomWarp: identity at k = 1, magnifies about the centre', () => {
  const f = solid(9, 9, [10, 10, 10]);
  f.data.set([250, 250, 250], (4 * 9 + 4) * 3);
  assert.deepEqual(Array.from(zoomWarp(f, 1, 4, 4).data), Array.from(f.data));
  const z = zoomWarp(f, 3, 4, 4);
  // The bright centre pixel now covers its neighbours (bilinear falloff).
  assert.ok(z.data[(4 * 9 + 5) * 3] > 100 && z.data[(4 * 9 + 4) * 3] === 250);
});
