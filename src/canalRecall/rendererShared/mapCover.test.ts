// node --import tsx --test src/canalRecall/rendererShared/mapCover.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssAlpha, mapCovered, opaqueCoverRect, uncoveredArea, type Rect } from './mapCover.js';

const R = (left: number, top: number, width: number, height: number): Rect => ({ left, top, right: left + width, bottom: top + height });

// Layouts measured on the guest briefing, 2026-10-29 (canvas, rail, photo vista), CSS px.
test('the briefing covers the map on every measured layout; a map beside the card is not covered', () => {
  assert.equal(mapCovered(R(0, 0, 1440, 900), [R(0, 0, 400, 900), R(400, 0, 1040, 900)]), true, 'desktop: rail + vista');
  assert.equal(mapCovered(R(0, 0, 820, 1180), [R(0, 0, 400, 1180), R(400, 0, 420, 1180)]), true, 'tablet portrait');
  assert.equal(mapCovered(R(0, 0, 390, 664), [R(0, 0, 390, 664)]), true, 'phone: the rail is full-bleed');
  assert.equal(mapCovered(R(0, 0, 844, 390), [R(0, 0, 844, 390)]), true, 'phone landscape');
  assert.equal(mapCovered(R(0, 0, 1440, 900), [R(0, 0, 400, 900)]), false, 'desktop without the vista: the map shows beside the rail');
  assert.equal(mapCovered(R(0, 0, 1440, 900), [R(0, 0, 400, 900), R(400, 0, 1040, 860)]), false, 'a 40 px strip of map shows');
  assert.equal(mapCovered(R(0, 0, 1440, 900), [R(0, 0, 400.4, 900), R(400.6, 0, 1039.4, 900)]), true, 'a sub-pixel seam is slack');
  assert.equal(mapCovered(R(0, 0, 0, 0), [R(0, 0, 10, 10)]), false, 'no map, nothing to pause');
});

test('uncoveredArea is the union, not the sum, and clips to the map', () => {
  assert.equal(uncoveredArea(R(0, 0, 100, 100), []), 10_000);
  assert.equal(uncoveredArea(R(0, 0, 100, 100), [R(0, 0, 60, 100), R(40, 0, 60, 100)]), 0, 'overlap');
  assert.equal(uncoveredArea(R(0, 0, 100, 100), [R(-50, -50, 100, 100)]), 7_500, 'clipped');
  assert.equal(uncoveredArea(R(0, 0, 100, 100), [R(0, 0, 50, 50), R(50, 50, 50, 50)]), 5_000, 'checkerboard');
});

test('a cover counts only while displayed, visible, opaque all the way up, with an opaque fill', () => {
  type El = { name: string; parentElement: El | null; getBoundingClientRect(): Rect };
  const body: El = { name: 'body', parentElement: null, getBoundingClientRect: () => R(0, 0, 400, 800) };
  const setup: El = { name: 'setup', parentElement: body, getBoundingClientRect: () => R(0, 0, 400, 800) };
  const rail: El = { name: 'rail', parentElement: setup, getBoundingClientRect: () => R(0, 0, 400, 800) };
  const base = { display: 'block', visibility: 'visible', opacity: '1', backgroundColor: 'rgba(0, 0, 0, 0)' };
  const styles = (over: Record<string, Partial<typeof base>>) => (e: El) => ({ ...base, ...(e.name === 'rail' ? { backgroundColor: 'rgb(244, 239, 229)' } : {}), ...over[e.name] });
  assert.deepEqual(opaqueCoverRect(rail as never, styles({}) as never), R(0, 0, 400, 800));
  assert.equal(opaqueCoverRect(rail as never, styles({ setup: { display: 'none' } }) as never), null, 'the briefing closed');
  assert.equal(opaqueCoverRect(rail as never, styles({ setup: { opacity: '0.98' } }) as never), null, 'fading out');
  assert.equal(opaqueCoverRect(rail as never, styles({ rail: { visibility: 'hidden' } }) as never), null);
  assert.equal(opaqueCoverRect(rail as never, styles({ rail: { backgroundColor: 'rgba(244, 239, 229, 0.9)' } }) as never), null, 'a translucent scrim');
  assert.equal(opaqueCoverRect(setup as never, styles({}) as never), null, 'the transparent wrapper hides nothing');
});

test('cssAlpha reads computed colours', () => {
  assert.equal(cssAlpha('rgb(1, 2, 3)'), 1);
  assert.equal(cssAlpha('rgba(1, 2, 3, 0.5)'), 0.5);
  assert.equal(cssAlpha('rgb(1 2 3 / 40%)'), 0.4);
  assert.equal(cssAlpha('transparent'), 0);
  assert.equal(cssAlpha('color(srgb 1 0 0)'), 0, 'unparsed is not opaque');
});

test('the pause is on for touch devices by default; ?coverPause forces it either way', async () => {
  const { coverPauseFlag } = await import('./mapCover.js');
  assert.equal(coverPauseFlag({ coarse: true }), true);
  assert.equal(coverPauseFlag({ coarse: false }), false, 'a desktop keeps drawing and warming up behind the card');
  assert.equal(coverPauseFlag({ coarse: false, asked: '1' }), true);
  assert.equal(coverPauseFlag({ coarse: true, asked: '0' }), false);
  assert.equal(coverPauseFlag({ coarse: true, asked: null }), true);
});
