// Portrait, touch and viewport regressions.
//
// The failure this suite exists to stop: a 390×844 phone used to get a
// 390×219 letterboxed canvas floating in the middle of the screen, the HUD drew
// into that strip using constants written for 1280×720, and the MapLibre layer
// underneath kept a different size — so the map and the HUD showed different
// parts of Amsterdam and most of the HUD was off screen entirely.
//
// The properties asserted here are the ones that were false before: the canvas
// fills a phone screen, every HUD rectangle is on screen and disjoint in
// portrait as well as landscape, and the d-pad reports the direction a thumb is
// actually touching.

import assert from 'node:assert/strict';
import { resolveViewport, DESIGN_WIDTH, DESIGN_HEIGHT, type Viewport } from '../src/canalRecall/viewport.ts';
import { hudLayout, rectsIntersect, type Rect } from '../src/canalRecall/hudLayout.ts';
import { dpadLayout, dpadKeysAt, isInsideDpad, applyAutoThrottle, noKeys } from '../src/canalRecall/touchControls.ts';

let checks = 0;
const ok = (condition: boolean, message: string): void => { assert.ok(condition, message); checks++; };

// --- Viewport ---------------------------------------------------------------

// The named regression: iPhone 13 portrait. Before, this produced a 219 px-tall
// canvas centred in an 844 px-tall window.
{
  const viewport = resolveViewport({ windowWidth: 390, windowHeight: 844, devicePixelRatio: 3, touch: true });
  assert.equal(viewport.mode, 'compact', 'a phone gets the compact layout');
  assert.equal(viewport.orientation, 'portrait');
  assert.equal(viewport.cssWidth, 390, 'the canvas fills the window width');
  assert.equal(viewport.cssHeight, 844, 'and the window height — no letterbox');
  assert.equal(viewport.width, 390, 'logical units are CSS pixels, so 13 px type stays 13 px');
  assert.equal(viewport.height, 844);
  assert.equal(viewport.scale, 1);
  checks += 7;
}

// A phone in landscape is still compact, and still fills the screen.
{
  const viewport = resolveViewport({ windowWidth: 844, windowHeight: 390, devicePixelRatio: 3, touch: true });
  assert.equal(viewport.mode, 'compact');
  assert.equal(viewport.orientation, 'landscape');
  assert.equal(viewport.cssHeight, 390, 'no letterbox in landscape either');
  checks += 3;
}

// Desktop is untouched: the fixed 16:9 space, letterboxed as before.
{
  const viewport = resolveViewport({ windowWidth: 1440, windowHeight: 900, devicePixelRatio: 1 });
  assert.equal(viewport.mode, 'desktop');
  assert.equal(viewport.width, DESIGN_WIDTH);
  assert.equal(viewport.height, DESIGN_HEIGHT);
  assert.equal(Math.round(viewport.cssWidth), 1440);
  assert.equal(Math.round(viewport.cssHeight), 810, '16:9 letterbox retained on desktop');
  checks += 5;
}

// A touch laptop and a big landscape tablet have the room for the desktop
// layout; only small screens get the compact one.
{
  assert.equal(resolveViewport({ windowWidth: 1366, windowHeight: 900, touch: true }).mode, 'desktop');
  assert.equal(resolveViewport({ windowWidth: 1024, windowHeight: 768, touch: true }).mode, 'compact');
  checks += 2;
}

// The named regression behind the latched-desktop bug: the page overflowed
// horizontally, so Chrome widened the layout viewport past the short-edge
// threshold and a portrait phone reported itself 835 px wide. Portrait plus
// touch is a phone whatever width it claims.
{
  assert.equal(resolveViewport({ windowWidth: 835, windowHeight: 1044, touch: true }).mode, 'compact',
    'a wide-reporting portrait touch device is still a phone');
  assert.equal(resolveViewport({ windowWidth: 900, windowHeight: 1200 }).mode, 'desktop',
    'but a portrait desktop window without touch is not');
  checks += 2;
}

// A zero-sized window happens during orientation changes; it must not produce
// NaN rectangles downstream.
{
  const viewport = resolveViewport({ windowWidth: 0, windowHeight: 0, touch: true });
  ok(Number.isFinite(viewport.width) && viewport.width > 0, 'a zero-sized window falls back to a usable space');
  ok(Number.isFinite(viewport.height) && viewport.height > 0, 'in both axes');
}

// --- HUD layout: nothing off screen, nothing overlapping ---------------------

const PHONES: Array<{ name: string; w: number; h: number; safeTop: number; safeBottom: number }> = [
  { name: 'iphone-se', w: 375, h: 667, safeTop: 0, safeBottom: 0 },
  { name: 'iphone-13', w: 390, h: 844, safeTop: 47, safeBottom: 34 },
  { name: 'iphone-pro-max', w: 430, h: 932, safeTop: 59, safeBottom: 34 },
  { name: 'pixel-7', w: 412, h: 915, safeTop: 24, safeBottom: 24 },
  { name: 'iphone-13-landscape', w: 844, h: 390, safeTop: 0, safeBottom: 21 },
  { name: 'ipad-portrait', w: 768, h: 1024, safeTop: 24, safeBottom: 20 },
];

function onScreen(rect: Rect, viewport: Viewport): boolean {
  return rect.x >= 0 && rect.y >= 0
    && rect.x + rect.width <= viewport.width
    && rect.y + rect.height <= viewport.height;
}

let scenarios = 0;
for (const phone of PHONES) {
  const viewport = resolveViewport({
    windowWidth: phone.w, windowHeight: phone.h, devicePixelRatio: 3, touch: true,
    safeTop: phone.safeTop, safeBottom: phone.safeBottom,
  });
  for (const feedbackVisible of [false, true]) {
    for (const neighborhoodVisible of [false, true]) {
      for (const landmarkVisible of [false, true]) {
        for (const landmarkHeight of [50, 80, 130]) {
          for (const minimapVisible of [false, true]) {
            for (const zoomVisible of [false, true]) {
              const layout = hudLayout({
                viewport, tripWidth: 180, feedbackVisible, neighborhoodVisible,
                landmarkHeight, minimapVisible, zoomVisible,
              });
              const band: Array<[string, Rect]> = [
                ['recall', layout.recall],
                ['location', layout.location],
                ['destination', layout.destination],
              ];
              if (landmarkVisible) band.push(['landmark', layout.landmark]);
              if (minimapVisible) band.push(['minimap', layout.minimap]);
              if (zoomVisible) band.push(['zoom', layout.zoomBadge]);
              if (layout.dpad) band.push(['dpad', layout.dpad.bounds]);

              const name = `${phone.name}`
                + (feedbackVisible ? '+feedback' : '') + (neighborhoodVisible ? '+hood' : '')
                + (landmarkVisible ? `+card${landmarkHeight}` : '')
                + (minimapVisible ? '+minimap' : '') + (zoomVisible ? '+zoom' : '');

              for (let i = 0; i < band.length; i++) {
                assert.ok(onScreen(band[i][1], viewport),
                  `${band[i][0]} is off screen in ${name}: ${JSON.stringify(band[i][1])} vs ${viewport.width}×${viewport.height}`);
                for (let j = i + 1; j < band.length; j++) {
                  assert.equal(rectsIntersect(band[i][1], band[j][1]), false,
                    `${band[i][0]} overlaps ${band[j][0]} in ${name}: ${JSON.stringify(band[i][1])} vs ${JSON.stringify(band[j][1])}`);
                }
              }
              scenarios++;
            }
          }
        }
      }
    }
  }
}

// The d-pad must never be covered: it is the only way to drive.
{
  const viewport = resolveViewport({ windowWidth: 390, windowHeight: 844, touch: true, safeTop: 47, safeBottom: 34 });
  const layout = hudLayout({ viewport, tripWidth: 180, landmarkHeight: 130 });
  const pad = layout.dpad;
  ok(pad !== null, 'a touch phone gets a d-pad');
  ok(pad!.bounds.y + pad!.bounds.height <= viewport.height - viewport.safeBottom,
    'the d-pad clears the home indicator');
  ok(layout.landmark.y + layout.landmark.height <= pad!.bounds.y,
    'the trivia card sits above the d-pad rather than over it');
}

// Phones fold the speed/odometer into the score row; desktop keeps it separate.
{
  const phone = hudLayout({ viewport: resolveViewport({ windowWidth: 390, windowHeight: 844, touch: true }), tripWidth: 180 });
  const desktop = hudLayout({ viewport: resolveViewport({ windowWidth: 1440, windowHeight: 900 }), tripWidth: 180 });
  ok(phone.tripInRecall, 'the phone merges the trip readout into the score row');
  ok(!desktop.tripInRecall, 'the desktop keeps its own trip readout');
  ok(desktop.dpad === null, 'the desktop gets no d-pad');
}

// --- D-pad hit testing ------------------------------------------------------

{
  const viewport = resolveViewport({ windowWidth: 390, windowHeight: 844, touch: true, safeBottom: 34 });
  const pad = dpadLayout(viewport)!;
  const { cx, cy, cell } = pad;
  const at = (dx: number, dy: number) => dpadKeysAt([{ x: cx + dx, y: cy + dy }], pad);

  assert.deepEqual(at(-cell, 0), { ...noKeys(), ArrowLeft: true }, 'left cell steers left');
  assert.deepEqual(at(cell, 0), { ...noKeys(), ArrowRight: true }, 'right cell steers right');
  assert.deepEqual(at(0, -cell), { ...noKeys(), ArrowUp: true }, 'top cell is throttle');
  assert.deepEqual(at(0, cell), { ...noKeys(), ArrowDown: true }, 'bottom cell brakes');
  assert.deepEqual(at(0, 0), noKeys(), 'the dead centre steers nowhere');
  checks += 5;

  // Corners give diagonals, which is how you brake into a turn.
  assert.deepEqual(at(-cell, cell), { ...noKeys(), ArrowLeft: true, ArrowDown: true },
    'the bottom-left corner brakes and steers left');
  checks++;

  // A touch outside the pad is a camera pan, not a steering input.
  const outside = { x: cx, y: cy - pad.bounds.height };
  assert.equal(isInsideDpad(outside, pad), false, 'a touch above the pad is not a pad touch');
  assert.deepEqual(dpadKeysAt([outside], pad), noKeys(), 'and drives nothing');
  checks += 2;

  // Two thumbs on the pad combine rather than fight.
  assert.deepEqual(
    dpadKeysAt([{ x: cx - cell, y: cy }, { x: cx, y: cy - cell }], pad),
    { ...noKeys(), ArrowLeft: true, ArrowUp: true },
    'two touches combine',
  );
  checks++;
}

// --- Auto-throttle ----------------------------------------------------------

{
  assert.deepEqual(applyAutoThrottle(noKeys()), { ...noKeys(), ArrowUp: true },
    'the vehicle rolls forward with no input, so steering is the only job');
  assert.deepEqual(
    applyAutoThrottle({ ...noKeys(), ArrowLeft: true }),
    { ...noKeys(), ArrowLeft: true, ArrowUp: true },
    'steering keeps the throttle on');
  assert.deepEqual(
    applyAutoThrottle({ ...noKeys(), ArrowDown: true }),
    { ...noKeys(), ArrowDown: true },
    'braking overrides auto-throttle, or you could never stop');
  checks += 3;
}

// A desktop viewport has no d-pad to hit-test against.
{
  const desktop = resolveViewport({ windowWidth: 1440, windowHeight: 900 });
  assert.equal(dpadLayout(desktop), null);
  assert.deepEqual(dpadKeysAt([{ x: 100, y: 100 }], null), noKeys());
  checks += 2;
}

process.stdout.write(`Mobile HUD checks passed (${scenarios} layout scenarios, ${checks} assertions).\n`);
