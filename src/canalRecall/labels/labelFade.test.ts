import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LABEL_FADE_MS, LABEL_HOLD_MS, LabelFade, screenTextAngle, StreetLabelPlacement, uprightAngle } from './labelFade.ts';
import { occlusionWanted, StreetLabelOcclusion } from './streetLabelOcclusion.ts';
import { labelCss, PILL_CLASS } from './labelStyle.ts';

// Issue #122, user 2026-10-30 in pitched Free Ride: labels popped in and out
// with no fade; names sat across their streets at Kattenburg; street names
// drew over the Oosterdok buildings; Klimmuur Centraal switched look.

/** Run `frames` frames of 16 ms, calling `want` each frame; returns the alphas. */
function run<K>(fade: LabelFade<K>, t0: number, frames: number, each: (frame: number) => number): { t: number; alphas: number[] } {
  const alphas: number[] = [];
  let t = t0;
  for (let i = 0; i < frames; i++) { t += 16; fade.begin(t); alphas.push(each(i)); }
  return { t, alphas };
}

test('labels fade in over LABEL_FADE_MS, not in one frame', () => {
  const fade = new LabelFade<string>();
  const { alphas } = run(fade, 1000, 30, () => fade.want('Kadijksplein', true));
  assert.ok(alphas[0] < 0.1, `first frame ${alphas[0]}`);
  const half = alphas[Math.round(LABEL_FADE_MS / 2 / 16) - 1];
  assert.ok(half > 0.35 && half < 0.65, `half way ${half}`);
  assert.equal(alphas[alphas.length - 1], 1);
});

test('a label that loses its place holds, then fades out; a building fades it at once', () => {
  const fade = new LabelFade<string>();
  let { t } = run(fade, 1000, 30, () => fade.want('a', true));
  // Lost for less than the hold: full strength, still placed.
  ({ t } = run(fade, t, Math.floor(LABEL_HOLD_MS / 16) - 1, () => fade.want('a', false)));
  assert.equal(fade.alpha('a'), 1);
  fade.begin(t + 16);
  assert.ok(fade.placed('a'));
  // Then a fade, ending in no state at all.
  const out = run(fade, t + 16, 40, () => fade.want('a', false)).alphas;
  assert.ok(out.some(a => a > 0.2 && a < 0.8), 'passes through mid alpha');
  assert.equal(out[out.length - 1], 0);
  assert.equal(fade.size, 0);
  // Hidden by a building: no hold.
  ({ t } = run(fade, 5000, 30, () => fade.want('b', true)));
  const hidden = run(fade, t, 3, () => fade.want('b', false, { noHold: true })).alphas;
  assert.ok(hidden[2] < 0.9, `occluded label starts fading at once: ${hidden}`);
});

test('a label on the collision edge does not flicker: alternate frames stay at full strength', () => {
  const fade = new LabelFade<string>();
  const { t } = run(fade, 1000, 30, () => fade.want('edge', true));
  const { alphas } = run(fade, t, 120, i => fade.want('edge', i % 2 === 0));
  assert.equal(Math.min(...alphas), 1, 'no dip on a one-frame loss');
});

test('labels shown last frame are placed first; a spoiler drops at once', () => {
  const fade = new LabelFade<object>();
  const a = { n: 'a' }, b = { n: 'b' }, c = { n: 'c' };
  fade.begin(16);
  fade.want(c, true);
  assert.deepEqual(fade.order([a, b, c]).map(x => x.n), ['c', 'a', 'b']);
  fade.drop(c);
  assert.equal(fade.alpha(c), 0);
  fade.begin(32);
  assert.deepEqual(fade.leftovers(), []);
});

// A pitched camera looking north (−y in world px is north): points further
// ahead are smaller and nearer the horizon. Focal length and camera distance
// in world px; screen centre at (600, 700).
const pitched = (x: number, y: number) => {
  const depth = 400 + (600 - y) * 0.9; // further ahead (smaller y) = deeper
  const k = 500 / depth;
  return { x: 600 + (x - 600) * k, y: 300 + (y - 100) * k * 0.5 };
};

test('Kattenburg: a name follows its street on screen in a pitched camera, upright', () => {
  // A street running 30° off the view direction, to the right of the camera.
  const worldAngle = -Math.PI / 2 + Math.PI / 6;
  const x = 900, y = 300;
  const hit = screenTextAngle(pitched, x, y, worldAngle)!;
  const a = pitched(x - Math.cos(worldAngle) * 24, y - Math.sin(worldAngle) * 24);
  const b = pitched(x + Math.cos(worldAngle) * 24, y + Math.sin(worldAngle) * 24);
  const expected = uprightAngle(Math.atan2(b.y - a.y, b.x - a.x));
  assert.ok(Math.abs(hit.angle - expected) < 1e-9);
  // The old frame (world angle less the camera rotation) is far off: that was the bug.
  assert.ok(Math.abs(uprightAngle(worldAngle) - hit.angle) > 0.2, `old ${uprightAngle(worldAngle)} new ${hit.angle}`);
  assert.ok(Math.abs(hit.angle) <= Math.PI / 2);
  // The reverse direction of the same street reads the same way.
  assert.ok(Math.abs(screenTextAngle(pitched, x, y, worldAngle + Math.PI)!.angle - hit.angle) < 1e-9);
});

test('near vertical a name keeps its reading direction instead of flipping', () => {
  const flat = (x: number, y: number) => ({ x, y });
  // Just past vertical one way, previously read the other way: kept.
  const kept = screenTextAngle(flat, 0, 0, Math.PI / 2 + 0.05, -Math.PI / 2 + 0.05)!;
  assert.ok(kept.angle < 0, `kept ${kept.angle}`);
  // Far from vertical: plain upright.
  assert.ok(Math.abs(screenTextAngle(flat, 0, 0, Math.PI - 0.2, -1.2)!.angle - (-0.2)) < 1e-9);
});

test('StreetLabelPlacement uses the camera projection, rotation included', () => {
  const placement = new StreetLabelPlacement();
  const r = Math.PI / 2;
  const camera = { rotation: r, worldToScreen: (x: number, y: number) => ({ x: x * Math.cos(-r) - y * Math.sin(-r), y: x * Math.sin(-r) + y * Math.cos(-r) }) };
  const label = { x: 10, y: 10, angle: Math.PI / 4 };
  const placed = placement.place(camera, label);
  assert.ok(Math.abs(placed.angle - uprightAngle(Math.PI / 4 - r)) < 1e-9);
  assert.ok(Math.abs(placed.scale - 1) < 1e-9);
});

// Oosterdok (#122): the anchor sat in the open but the text ran on across a
// facade in front. Each end is tested as well as the middle.
test('Oosterdok: a name whose end runs behind a building is hidden', () => {
  const box = (w: number, s: number, e: number, n: number, height: number) => ({
    geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    properties: { height },
  });
  // A 20 m block north-east of the camera; world px are 1e-5 degrees here.
  const block = box(4.9060, 52.3770, 4.9070, 52.3780, 20);
  const host = {
    map: { transform: { getCameraLngLat: () => ({ lng: 4.9050, lat: 52.3760 }), getCameraAltitude: () => 25 } },
    _completeCity: { sampleFeatures: () => [block] },
    worldToLngLat: (x: number, y: number) => [x * 1e-5, y * 1e-5] as [number, number],
  };
  const occ = new StreetLabelOcclusion();
  let hiddenBy = occ.frame(host, {}, true);
  for (let i = 0; i < 5 && !hiddenBy; i++) hiddenBy = occ.frame(host, {}, true);
  assert.ok(hiddenBy, 'index ready');
  // Label middle west of the block, in the open; its east end lies behind the block.
  const label = { x: 490540, y: 5237850, text: 'Simon Carmiggeltstraat' };
  const ends = [{ x: 490500, y: 5237850 }, { x: 490740, y: 5237850 }];
  assert.equal(hiddenBy!({ ...label }), false, 'middle alone is clear');
  assert.equal(hiddenBy!({ ...label }, ends), true, 'an end behind the block hides it');
  // Not pitched (top-down): no test at all.
  assert.equal(occ.frame(host, {}, false), null);
});

test('Klimmuur Centraal: the overlay pill matches the Free Ride marker plate', () => {
  const css = labelCss();
  assert.match(css, new RegExp(`\\.l\\.${PILL_CLASS} \\.n\\{[^}]*border-radius:11px`));
  assert.match(css, new RegExp(`\\.l\\.${PILL_CLASS} \\.n\\{[^}]*text-transform:none`), 'no plaque caps');
  // The pill rule comes after the landmark class rule, so it wins at equal specificity.
  assert.ok(css.indexOf(`.l.${PILL_CLASS} .n{`) > css.indexOf('.l.landmark .n{'));
});

test('Oosterdok: the sightline test runs on any tilted map, not only chase and cockpit', () => {
  assert.equal(occlusionWanted(true, 0), true);
  assert.equal(occlusionWanted(false, 14), true, 'north-up and heading-up tilt 14°');
  assert.equal(occlusionWanted(false, 0), false, 'flat top-down: nothing stands in front');
  assert.equal(occlusionWanted(false, undefined), false);
});
