// brickLift v2 (look/brickLift.ts, default on; ?brickLift=v1 is byte-identical to the old lift), stucco / white / buff pinned, dark brick lower and in hue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BRICK_LIFT_DEFAULT_ON, C19_WALLS_V2, brickLiftEnabled, brickLiftOn, brickLiftV2ProfileWall, brickLiftV2Tint, isDarkBrick, periodWallList, resetBrickLiftFlag } from './brickLift.ts';
import { cityLookTint } from './cityLook.ts';
import { PERIOD_WALLS, cityStuccoTint, cityTint, cityWallTint, hexToRgb, rgbToHsl } from './palette.ts';
import { rgbToLab } from './brickTone.ts';
import { bayLookFor } from '../bayLook.ts';
import { buurtProfileAt } from '../buurtProfiles/data.ts';
import { specWallIsBrick } from '../houseSpec/decorate.ts';

const withFlag = <T>(v: string | undefined, f: () => T): T => {
  const prev = process.env.BRICK_LIFT;
  if (v === undefined) delete process.env.BRICK_LIFT; else process.env.BRICK_LIFT = v;
  resetBrickLiftFlag();
  try { return f(); } finally { if (prev === undefined) delete process.env.BRICK_LIFT; else process.env.BRICK_LIFT = prev; resetBrickLiftFlag(); }
};
const L = (hex: string) => rgbToLab(hexToRgb(hex))[0];
const hueOf = (hex: string) => { const [, a, b] = rgbToLab(hexToRgb(hex)); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };
/** Stucco, white and buff walls the lift must not touch (the user's brighter-palette priority, 2026-10-16). */
const PALE = ['#e2d5ba', '#d9c5a4', '#d3b184', '#f2f2ee', '#e4ddcd', '#d8d8d2', '#c9b79a', '#dfd9d7', '#ece8e1'];
const BRICKS = ['#b05a40', '#a24d38', '#9a5846', '#7a3d2b', '#6b331f', '#4a2a1c', '#787878', '#8d8d90', '#c07f61'];

test('the flag: ?brickLift=v2 or BRICK_LIFT=v2, nothing else', () => {
  assert.equal(brickLiftEnabled(null, null), false, 'off by default (integrator, 2026-11-12: v2 not closer to the photos)');
  assert.equal(BRICK_LIFT_DEFAULT_ON, false);
  assert.equal(brickLiftEnabled('?world=live&brickLift=v1', null), false);
  assert.equal(brickLiftEnabled(null, 'v1'), false);
  assert.equal(brickLiftEnabled('?brickLift=v2', 'v1'), true, 'the query wins');
  assert.equal(brickLiftEnabled('?brickLift=v1', 'v2'), false);
  assert.equal(withFlag(undefined, brickLiftOn), false);
  assert.equal(withFlag('v2', brickLiftOn), true);
  assert.equal(withFlag('v1', brickLiftOn), false);
});

test('brickLift=v1: cityLookTint is the old tint for every wall (byte-identical)', () => {
  withFlag('v1', () => {
    for (const h of [...PALE, ...BRICKS]) {
      assert.equal(cityLookTint('brick', h, undefined, undefined, undefined, brickLiftOn()), cityLookTint('accent', h, undefined, undefined, undefined, brickLiftOn()));
      if (rgbToHsl(hexToRgb(h))[1] >= 0.12) assert.equal(cityLookTint('brick', h, undefined, undefined, undefined, brickLiftOn()), cityWallTint(h), h);
    }
    assert.deepEqual(periodWallList('photo', 'c19', PERIOD_WALLS.photo.c19), PERIOD_WALLS.photo.c19);
  });
});

test('default (v2): stucco, white and buff draw exactly as today, on every slot', () => {
  const off = withFlag('v1', () => PALE.map(h => ['brick', 'accent', 'stucco'].map(s => cityLookTint(s as 'brick', h, undefined, undefined, undefined, brickLiftOn()))));
  const on = withFlag('v2', () => PALE.map(h => ['brick', 'accent', 'stucco'].map(s => cityLookTint(s as 'brick', h, undefined, undefined, undefined, brickLiftOn()))));
  assert.deepEqual(on, off);
  for (const h of PALE) { assert.equal(isDarkBrick(h), false, h); assert.equal(brickLiftV2Tint(h), null, h); assert.equal(brickLiftV2ProfileWall(h), h, h); }
  withFlag('v2', () => { for (const h of PALE) assert.equal(cityLookTint('stucco', h, undefined, undefined, undefined, brickLiftOn()), cityStuccoTint(h)); });
});

test('default (v2): a dark brick draws lower, keeps its hue, and the 0.3 floor no longer holds it up', () => {
  for (const h of ['#7a3d2b', '#6b331f', '#4a2a1c', '#a24d38']) {
    const off = withFlag('v1', () => cityLookTint('brick', h, undefined, undefined, undefined, brickLiftOn())), on = withFlag('v2', () => cityLookTint('brick', h, undefined, undefined, undefined, brickLiftOn()));
    assert.ok(L(on) < L(off), `${h}: ${on} darker than ${off}`);
    assert.ok(Math.abs(((hueOf(on) - hueOf(off) + 540) % 360) - 180) < 6, `${h} hue holds`);
  }
  assert.ok(withFlag('v2', () => L(cityLookTint('brick', '#3c2119', undefined, undefined, undefined, brickLiftOn()))) < withFlag('v1', () => L(cityLookTint('brick', '#3c2119', undefined, undefined, undefined, brickLiftOn()))) - 8);
  // a grey brick stays grey (no saturation floor), only lower
  const grey = withFlag('v2', () => cityLookTint('brick', '#787878', undefined, undefined, undefined, brickLiftOn()));
  assert.ok(Math.hypot(...rgbToLab(hexToRgb(grey)).slice(1)) < 3, grey);
});

test('default (v2): a profile brick wall takes the gain; pale and buff profile walls do not', () => {
  assert.ok(L(brickLiftV2ProfileWall('#c07f61')) < L('#c07f61') - 12);
  assert.equal(brickLiftV2ProfileWall('#e2d8d4'), '#e2d8d4');
  assert.equal(brickLiftV2ProfileWall('#d3b184'), '#d3b184');
});

test('the c19 list: brick entries replaced, buff / cream / stucco entries byte-identical, other archetypes untouched', () => {
  const base = PERIOD_WALLS.photo.c19!;
  assert.equal(C19_WALLS_V2.length, base.length);
  base.forEach((h, i) => { if (!isDarkBrick(h)) assert.equal(C19_WALLS_V2[i], h, `slot ${i} ${h}`); });
  assert.ok(C19_WALLS_V2.some((h, i) => h !== base[i]));
  withFlag('v2', () => {
    assert.equal(periodWallList('photo', 'c19', base), C19_WALLS_V2);
    for (const a of ['canal', 'school', 'modern'] as const) assert.equal(periodWallList('photo', a, PERIOD_WALLS.photo[a]), PERIOD_WALLS.photo[a]);
    assert.equal(periodWallList('storybook', 'c19', PERIOD_WALLS.storybook.c19), PERIOD_WALLS.storybook.c19);
  });
});

test('regression: Bellamybuurt-Noord 1905 (0363100012160567, measured #4f3b25) draws darker and no longer terracotta', () => {
  const id = 'NL.IMBAG.Pand.0363100012160567', at: [number, number] = [4.8625, 52.3748];
  const draw = () => { const b = bayLookFor(id, 1905, 14, 'photo', 'quiet', undefined, undefined, buurtProfileAt(...at)); return cityLookTint('brick', b.wallHex, undefined, undefined, undefined, brickLiftOn()); };
  const off = withFlag('v1', draw), on = withFlag(undefined, draw);
  assert.ok(L(on) <= L(off), `${on} no lighter than ${off}`);
});

test('specWallIsBrick: unstated material counts as brick (v2 default), not under v1; stated finishes win', () => {
  const view = {} as never;
  withFlag('v1', () => { assert.equal(specWallIsBrick(view, {}), false); assert.equal(specWallIsBrick(view, { registerFinish: 'brick' }), true); });
  withFlag('v2', () => {
    assert.equal(specWallIsBrick(view, {}), true);
    assert.equal(specWallIsBrick(view, { registerFinish: 'light' }), false);
    assert.equal(specWallIsBrick({ wallMaterial: 'stucco' } as never, {}), false);
    assert.equal(specWallIsBrick({ wallMaterial: 'painted-brick' } as never, {}), false);
    assert.equal(specWallIsBrick({ wallMaterial: 'brick' } as never, { registerFinish: 'light' }), true);
  });
  void cityTint;
});

test('scope: cityLookTint without the flag argument (recipes, landmarks, GLBs) never moves, even with v2 the default', () => {
  withFlag('v2', () => { for (const h of BRICKS) assert.equal(cityLookTint('brick', h), withFlag('v1', () => cityLookTint('brick', h))); });
});
