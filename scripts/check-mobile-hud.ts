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
// portrait as well as landscape, and the thumbstick drives the direction a
// thumb is actually pointing.

import assert from 'node:assert/strict';
import { resolveViewport, DESIGN_WIDTH, DESIGN_HEIGHT, type Viewport } from '../src/canalRecall/viewport.ts';
import { hudLayout, hudBand, rectsIntersect, type Rect } from '../src/canalRecall/hudLayout.ts';
import {
  dpadLayout, isInsideDpad, noKeys, stickRadius, stickVector, relativeCommand, absoluteCommand,
  keysScreenAngle, assistedHeading, turnToward, cruiseThrottle, normalizeAngle, STICK_CRUISE_FRACTION,
  HARD_TURN_SPEED_SCALE, alignmentSpeedScale, turnAroundHeading, PIVOT_RATE,
} from '../src/canalRecall/touchControls.ts';
import { constrainCarToRoad } from '../src/canalRecall/carRoadGuard.ts';

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

// Desktop fills the window. A near-16:9 landscape keeps design density and
// grows the short axis instead of letterboxing into a 810 px strip.
{
  const viewport = resolveViewport({ windowWidth: 1440, windowHeight: 900, devicePixelRatio: 1 });
  assert.equal(viewport.mode, 'desktop');
  assert.equal(viewport.width, DESIGN_WIDTH);
  assert.equal(viewport.height, 800, 'logical height expands to the window aspect');
  assert.equal(viewport.cssWidth, 1440, 'the canvas fills the window width');
  assert.equal(viewport.cssHeight, 900, 'and the window height — no letterbox');
  checks += 5;
}

// A true 16:9 desktop still lands on the historic 1280×720 logical space.
{
  const viewport = resolveViewport({ windowWidth: 1920, windowHeight: 1080, devicePixelRatio: 1 });
  assert.equal(viewport.width, DESIGN_WIDTH);
  assert.equal(viewport.height, DESIGN_HEIGHT);
  assert.equal(viewport.cssWidth, 1920);
  assert.equal(viewport.cssHeight, 1080);
  checks += 4;
}

// Named regression: a tall desktop browser used to get a landscape strip in
// white paper (the screenshot that reopened this). Fill, don't letterbox.
{
  const viewport = resolveViewport({ windowWidth: 900, windowHeight: 1200, devicePixelRatio: 1 });
  assert.equal(viewport.mode, 'desktop');
  assert.equal(viewport.cssWidth, 900);
  assert.equal(viewport.cssHeight, 1200, 'tall desktop fills the window');
  assert.equal(viewport.width, DESIGN_WIDTH);
  assert.equal(viewport.height, Math.round(DESIGN_WIDTH * 1200 / 900));
  assert.ok(viewport.height > DESIGN_HEIGHT, 'logical space grows taller, not letterboxed');
  checks += 6;
}

// Wide compact must stay 1:1 with the CSS box — clamping logical width below
// the window and pinning canvas to 100% used to stretch every card sideways.
{
  const viewport = resolveViewport({ windowWidth: 1600, windowHeight: 800, devicePixelRatio: 2, touch: true });
  assert.equal(viewport.mode, 'compact');
  assert.equal(viewport.width, 1600, 'logical width matches the window');
  assert.equal(viewport.cssWidth, 1600);
  assert.equal(viewport.scale, 1, 'no CSS stretch of the chrome');
  checks += 4;
}

// On a wide canvas the chrome sits in a centred band, not on the bezels.
{
  const viewport = resolveViewport({ windowWidth: 1920, windowHeight: 800, touch: true });
  const band = hudBand(viewport);
  const layout = hudLayout({ viewport, tripWidth: 180 });
  assert.equal(band.width, 900, 'compact chrome caps at the phone-landscape width');
  assert.equal(band.x, Math.round((1920 - 900) / 2));
  assert.equal(layout.recall.x, band.x + 12, 'left cards sit on the band, not x=12 of the monitor');
  assert.ok(layout.destination.x + layout.destination.width <= band.x + band.width,
    'right cards stay inside the band');
  assert.ok(layout.dpad && layout.dpad.bounds.x >= band.x, 'the d-pad follows the band too');
  checks += 5;
}

{
  const viewport = resolveViewport({ windowWidth: 2560, windowHeight: 1080 });
  const band = hudBand(viewport);
  const layout = hudLayout({ viewport, tripWidth: 180 });
  assert.equal(band.width, DESIGN_WIDTH, 'desktop chrome caps at the design width');
  assert.ok(layout.destination.x > band.x, 'destination is not glued to the left bezel');
  assert.ok(layout.destination.x + layout.destination.width <= band.x + band.width + 0.5,
    'and not glued to the right bezel either');
  assert.equal(Math.round(layout.destination.x + layout.destination.width), band.x + band.width - 15,
    'desktop destination keeps its design inset inside the band');
  checks += 4;
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
                plaqueExtraLines: feedbackVisible ? 2 : 0,
              });
              // A portrait phone folds location and destination into the
              // plaque; those rects alias `recall` rather than competing.
              const band: Array<[string, Rect]> = layout.destinationInRecall
                ? [['recall', layout.recall], ['compass', layout.compass]]
                : [
                  ['recall', layout.recall],
                  ['location', layout.location],
                  ['destination', layout.destination],
                  ['compass', layout.compass],
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

// Named regression (user report 2026-09-27, "the mobile HUD takes up way too
// much of the screen"): on a 390×664 phone the plaque plus the destination bar
// reached y≈168 and the overview sat beside the vehicle at mid-screen. The
// portrait top chrome is now one card, and the overview stays in the top band.
{
  for (const [w, h] of [[390, 664], [375, 667], [390, 844]]) {
    const viewport = resolveViewport({ windowWidth: w, windowHeight: h, touch: true });
    const layout = hudLayout({ viewport, tripWidth: 180, feedbackVisible: true, neighborhoodVisible: true });
    ok(layout.destinationInRecall, `${w}×${h} portrait folds the destination into the plaque`);
    const plaqueBottom = layout.recall.y + layout.recall.height;
    ok(plaqueBottom <= 90, `${w}×${h} plaque ends by y=90 even with a feedback line (got ${plaqueBottom})`);
    ok(plaqueBottom / viewport.height < 0.14, `${w}×${h} plaque is under 14% of the screen`);
    const mapBottom = layout.minimap.y + layout.minimap.height;
    ok(mapBottom < viewport.height * 0.3,
      `${w}×${h} overview stays in the top band, clear of the vehicle at mid-screen (bottom ${mapBottom})`);
  }
  const landscape = hudLayout({ viewport: resolveViewport({ windowWidth: 844, windowHeight: 390, touch: true }), tripWidth: 180 });
  ok(!landscape.destinationInRecall, 'landscape keeps its corner destination card');
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

// --- Thumbstick -------------------------------------------------------------
//
// Named regression (2026-09-26, reported on a phone): "impossible to turn; even
// in absolute mode I can't reliably go east". Auto-throttle held ArrowUp, so
// absolute-mode "right" resolved to north-east; the camera turned with the
// vehicle so "right" was not right on screen; and a thumb sliding off the pad
// dropped all input mid-turn.

const near = (a: number, b: number, eps = 1e-9) => Math.abs(normalizeAngle(a - b)) <= eps;

{
  const viewport = resolveViewport({ windowWidth: 390, windowHeight: 844, touch: true, safeBottom: 34 });
  const pad = dpadLayout(viewport)!;
  const radius = stickRadius(pad);
  const origin = { x: pad.cx, y: pad.cy };

  ok(isInsideDpad(origin, pad), 'the stick zone contains its own centre');
  ok(!isInsideDpad({ x: pad.cx, y: pad.cy - pad.bounds.height }, pad),
    'a touch above the zone is a camera pan, not a stick touch');

  ok(stickVector(origin, { x: origin.x + radius * 0.1, y: origin.y }, radius) === null,
    'the dead zone reads as no deflection');
  const east = stickVector(origin, { x: origin.x + radius, y: origin.y }, radius)!;
  ok(east.magnitude === 1 && near(east.screenAngle, 0), 'full right is magnitude 1 at angle 0');

  // Captured thumb that has wandered far outside the zone still steers, clamped.
  const wandered = { x: origin.x + radius * 4, y: origin.y + 1 };
  ok(!isInsideDpad(wandered, pad), 'the wandered thumb really is outside the zone');
  const far = stickVector(origin, wandered, radius)!;
  ok(far.magnitude === 1 && far.x > 0.99, 'a thumb past the rim reads as full deflection, not as released');

  // Absolute: screen directions become world headings through the camera.
  ok(near(absoluteCommand(east, 0)!.targetAngle, 0), 'north-up: stick right drives due east');
  const west = stickVector(origin, { x: origin.x - radius, y: origin.y }, radius)!;
  ok(near(absoluteCommand(west, 0)!.targetAngle, Math.PI), 'north-up: stick left drives due west');
  ok(near(absoluteCommand(east, Math.PI / 2)!.targetAngle, Math.PI / 2),
    'map turned 90°: stick right drives the world direction that is right on screen');

  // Keyboard absolute: pure right is exactly east (no phantom throttle key).
  ok(keysScreenAngle({ ...noKeys(), ArrowRight: true }) === 0, 'the right arrow alone is angle 0');
  ok(keysScreenAngle({ ...noKeys(), ArrowLeft: true, ArrowRight: true }) === null, 'cancelling keys point nowhere');

  // Relative: analog, signed, pull back brakes, forward runs faster than cruise.
  const halfRight = stickVector(origin, { x: origin.x + radius * 0.6, y: origin.y }, radius)!;
  const halfLeft = stickVector(origin, { x: origin.x - radius * 0.6, y: origin.y }, radius)!;
  const r = relativeCommand(halfRight), l = relativeCommand(halfLeft);
  ok(r.steer > 0 && r.steer < 1 && l.steer < 0 && Math.abs(r.steer + l.steer) < 1e-9, 'relative steer is analog and signed');
  ok(relativeCommand(east).steer === 1, 'the rim is full lock');
  const back = stickVector(origin, { x: origin.x, y: origin.y + radius }, radius)!;
  ok(relativeCommand(back).brake === 1 && relativeCommand(back).speedFraction === 0, 'pulling back brakes');
  const up = stickVector(origin, { x: origin.x, y: origin.y - radius }, radius)!;
  ok(relativeCommand(up).speedFraction === 1, 'pushing forward is full speed');
  ok(relativeCommand(null).speedFraction === STICK_CRUISE_FRACTION && relativeCommand(null).steer === 0,
    'a thumb resting in the dead zone cruises straight');
}

// Road assist and heading helpers.
{
  const streetAngle = (20 * Math.PI) / 180; // an east-north-east street
  ok(near(assistedHeading(0, streetAngle), streetAngle), 'pushing east on a slanted street follows the street');
  ok(near(assistedHeading(Math.PI, streetAngle), streetAngle + Math.PI), 'pushing west follows it the other way');
  ok(near(assistedHeading(-Math.PI / 2, streetAngle), -Math.PI / 2),
    'pushing north across the street is not bent onto it');
  ok(near(assistedHeading(0.3, null), 0.3), 'no road means no assist');
  ok(near(turnToward(0, Math.PI / 2, 0.1), 0.1), 'turning is rate-limited');
  ok(near(turnToward(3.1, -3.1, 0.2), -3.1), 'turning crosses ±π the short way');
  ok(cruiseThrottle(0, 100, 300) === 1, 'cruise floors it from a standstill');
  ok(cruiseThrottle(200, 100, 300) > 0 && cruiseThrottle(200, 100, 300) < 0.1,
    'over cruise speed it eases off without triggering lift-off braking');
}

// A desktop viewport has no d-pad to hit-test against.
{
  const desktop = resolveViewport({ windowWidth: 1440, windowHeight: 900 });
  assert.equal(dpadLayout(desktop), null);
  assert.equal(isInsideDpad({ x: 100, y: 100 }, null), false);
  checks += 2;
}

// --- Turning round ------------------------------------------------------------
//
// Named regression (user report 2026-09-28, "mobile controls are better but
// still an issue, can't really turn around"). Measured on the iPhone profile:
// full left for 3 s turned 12° and locked ~15° off the street, because a
// cruise-speed turn reached the kerb before 90° and the road guard eased the
// heading straight every frame; pulling back reversed in circles at -30 px/s.
{
  const stick = (x: number, y: number) => ({ x, y, magnitude: Math.hypot(x, y), screenAngle: Math.atan2(y, x) });
  const straight = relativeCommand(stick(0, -0.1));
  const fullLock = relativeCommand(stick(-1, 0));
  ok(fullLock.speedFraction <= straight.speedFraction * (HARD_TURN_SPEED_SCALE + 0.01),
    'a full-lock turn slows to a crawl so it fits inside the street');
  ok(relativeCommand(stick(-0.35, -0.1)).speedFraction > straight.speedFraction * 0.95,
    'a gentle curve keeps its speed');
  const back = relativeCommand(stick(0, 1));
  ok(back.turnAround && back.steer === 0 && back.brake > 0, 'straight back brakes and asks to turn round');
  ok(!relativeCommand(stick(-0.6, 0.8)).turnAround, 'back-and-sideways is a braking turn, not a turn-round');
  // Named regression (user report 2026-09-29, "because turning also tries to
  // go forward, my bike was struggling to turn around"): hard sideways asks to
  // pivot on the spot; any real forward push or a gentle curve does not.
  ok(fullLock.pivot === -1 && relativeCommand(stick(1, 0)).pivot === 1, 'hard sideways asks to pivot that way');
  ok(relativeCommand(stick(-0.9, -0.5)).pivot === 0, 'sideways and forward arcs instead of pivoting');
  ok(relativeCommand(stick(-0.35, 0)).pivot === 0, 'a gentle steer does not pivot');
  ok(back.pivot === 0 && relativeCommand(null).pivot === 0, 'back and released never pivot');
  ok(Math.PI / PIVOT_RATE > 0.7 && Math.PI / PIVOT_RATE < 1.5, 'a pivot takes about a second for 180°');
  ok(alignmentSpeedScale(0) === 1 && alignmentSpeedScale(Math.PI) < 0.2,
    'absolute mode crawls while pointing back down the street');
  ok(Math.abs(normalizeAngle(turnAroundHeading(0.3, 0.3) - (0.3 + Math.PI))) < 1e-9,
    'turn-round heads straight back along the street');

  // The guard keeps the bike on the road either way, but only eases the
  // heading when the rider is not steering hard.
  const road = { x: 0, y: 0, dist: 30, width: 10, angle: 0 };
  const car = () => ({ x: 0, y: 30, angle: 1.2, vx: 0, vy: 40, speed: 40 });
  const eased = car();
  constrainCarToRoad(eased, { x: 0, y: 8 }, road, road, { edgeTolerance: 4 });
  const held = car();
  constrainCarToRoad(held, { x: 0, y: 8 }, road, road, { edgeTolerance: 4, holdHeading: true });
  ok(eased.angle < 1.2, 'without a hard steer the guard eases the heading along the street');
  ok(held.angle === 1.2 && held.y === 8, 'with one it keeps the heading and still blocks the step off the road');
}

process.stdout.write(`Mobile HUD checks passed (${scenarios} layout scenarios, ${checks} assertions).\n`);
