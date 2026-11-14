// realLook trim (round 2): photo cells without white accents draw lintels and sills in the wall channel; flag off is
// byte-identical (colour and mask), presets with white accents keep their stone, and the look-atlas cache is bypassed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { bayTextures, releaseBayTextures } from '../bayTextures.ts';
import { BAY_ENTRIES, bayVariant } from '../bayLook.ts';
import { resetRealLook } from './realLook.ts';
import { lookAtlasStamp } from './lookAtlas.ts';

function paint(v: string | undefined, entry: (typeof BAY_ENTRIES)[number], look: 'photo' | 'storybook' = 'photo') {
  const g = globalThis as any, prevDoc = g.document, prevFlag = g.__canalRecallRealLook;
  g.document = { createElement: () => createCanvas(1, 1) };
  if (v === undefined) delete g.__canalRecallRealLook; else g.__canalRecallRealLook = v;
  resetRealLook(); releaseBayTextures();
  try {
    const t = bayTextures(bayVariant(entry), createCanvas(1, 1) as any, look);
    const read = (c: any) => Buffer.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
    return { colour: read(t.colour), mask: read(t.mask) };
  } finally {
    releaseBayTextures();
    if (prevDoc === undefined) delete g.document; else g.document = prevDoc;
    if (prevFlag === undefined) delete g.__canalRecallRealLook; else g.__canalRecallRealLook = prevFlag;
    resetRealLook();
  }
}
const upper = (pale: boolean) => BAY_ENTRIES.find(e => e.kind === 'upper' && e.archetype === 'c19' && !e.smooth && !!bayVariant(e).paleAccents === pale && bayVariant(e).lintel === 'flat' && !bayVariant(e).openingGroup)!;
const wallPx = (m: Buffer) => { let n = 0; for (let i = 0; i < m.length; i += 4) if (m[i] > 200 && m[i + 1] < 50) n++; return n; };

test('trim off: cells byte-identical to the flag asked off', () => {
  for (const e of [upper(false), upper(true)]) {
    const a = paint(undefined, e), b = paint('walls,doors,trees', e);
    assert.ok(a.colour.equals(b.colour) && a.mask.equals(b.mask));
  }
});

test('trim on: a front without white accents takes its lintel and sill into the wall channel', () => {
  const off = paint(undefined, upper(false)), on = paint('trim', upper(false));
  assert.ok(wallPx(on.mask) > wallPx(off.mask), `${wallPx(off.mask)} -> ${wallPx(on.mask)} wall texels`);
  assert.ok(!on.colour.equals(off.colour));
});

test('trim on: white-accent presets and other looks keep their stone lintels', () => {
  const off = paint(undefined, upper(true)), on = paint('trim', upper(true));
  assert.ok(off.colour.equals(on.colour) && off.mask.equals(on.mask), 'pale preset unchanged');
  const s0 = paint(undefined, upper(false), 'storybook'), s1 = paint('trim', upper(false), 'storybook');
  assert.ok(s0.colour.equals(s1.colour) && s0.mask.equals(s1.mask), 'storybook unchanged');
});

test('trim on: the look-atlas browser cache is bypassed (never reads or stores the flag-off stamp)', () => {
  const g = globalThis as any, prev = g.__canalRecallRealLook;
  try {
    g.__canalRecallRealLook = 'trim'; resetRealLook();
    assert.equal(lookAtlasStamp('https://example.org/js/three-buildings.bundle.js?v=abc123', ''), null);
    g.__canalRecallRealLook = 'walls'; resetRealLook();
    assert.equal(lookAtlasStamp('https://example.org/js/three-buildings.bundle.js?v=abc123', ''), 'abc123');
  } finally { if (prev === undefined) delete g.__canalRecallRealLook; else g.__canalRecallRealLook = prev; resetRealLook(); }
});
