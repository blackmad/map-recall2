/**
 * The strip frame is a certificate: if it is wrong, every metre downstream is
 * wrong by the same factor, silently. So the arithmetic is pinned here rather
 * than trusted because it looked right once.
 */
import assert from 'node:assert/strict';
import { isAtLeastApart, pickDistinctViews, stripFrame } from './stripFrame.ts';

let checks = 0;
const check = (name: string, fn: () => void) => {
  checks++;
  try { fn(); } catch (error) { console.error(`FAIL ${name}:`, error); process.exitCode = 1; }
};

check('a square frame reports the renderer\'s own pixels per metre', () => {
  const frame = stripFrame({
    wallStart: { x: 0, y: 0 }, wallEnd: { x: 10, y: 0 },
    bottomNap: -0.8, topNap: 19.2, marginFactor: 1.06,
    requestedPixelsPerMetre: 40, renderedWidth: 424, renderedHeight: 800,
  });
  assert.equal(frame.start.x, 0);
  assert.equal(frame.end.x, 10);
  assert.equal(frame.leftEdge, 'start');
  assert.equal(frame.bottomNap, -0.8);
  assert.equal(frame.topNap, 19.2);
  assert.ok(Math.abs(frame.marginM - 0.3) < 1e-9, `margin ${frame.marginM}`);
  assert.ok(Math.abs(frame.pixelsPerMetreX - 40) < 1e-9, `x ${frame.pixelsPerMetreX}`);
  assert.ok(Math.abs(frame.pixelsPerMetreY - 40) < 1e-9, `y ${frame.pixelsPerMetreY}`);
});

check('a diagonal wall keeps its true length in the frame', () => {
  const frame = stripFrame({
    wallStart: { x: 0, y: 0 }, wallEnd: { x: 3, y: 4 },
    bottomNap: 0, topNap: 10, marginFactor: 1.05,
    requestedPixelsPerMetre: 20, renderedWidth: 105, renderedHeight: 200,
  });
  assert.ok(Math.abs(frame.pixelsPerMetreX - 20) < 1e-9, `x ${frame.pixelsPerMetreX}`);
  assert.ok(Math.abs(frame.marginM - 0.125) < 1e-9, `margin ${frame.marginM}`);
});

check('separation is inclusive at the threshold', () => {
  const a = { point: { x: 0, y: 0 } }, b = { point: { x: 3, y: 0 } }, c = { point: { x: 2.9, y: 0 } };
  assert.equal(isAtLeastApart(a, b, 3), true);
  assert.equal(isAtLeastApart(a, c, 3), false);
});

check('distinct views drop near-duplicates and keep the best first', () => {
  const at = (x: number) => ({ point: { x, y: 0 }, name: `${x}` });
  const views = [at(0), at(1), at(2), at(5), at(6), at(12)];
  const chosen = pickDistinctViews(views, 3, 3);
  assert.deepEqual(chosen.map(v => v.name), ['0', '5', '12']);
});

check('distinct views stop when the list runs out', () => {
  const at = (x: number) => ({ point: { x, y: 0 }, name: `${x}` });
  const chosen = pickDistinctViews([at(0), at(0.5)], 5, 3);
  assert.equal(chosen.length, 1);
});

if (!process.exitCode) console.log(`stripFrame: ${checks} checks passed`);
