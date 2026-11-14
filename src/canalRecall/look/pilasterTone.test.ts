import assert from 'node:assert/strict';
import test from 'node:test';
import { PILASTER_SHADE, pilasterHex, pilasterStated, pilasterToneEnabled, pilasterToneOn, resetPilasterToneFlag } from './pilasterTone.js';
import { ExtraSink, type ExtraContext } from '../facadeExtraCore.js';
import { ORNAMENT_COMPONENTS, WHITE, STONE } from '../facadeOrnaments.js';

test('flag: on by default; ?pilasterTone=0 / PILASTER_TONE=0 restores the dice colours; the query wins over env', () => {
  assert.equal(pilasterToneEnabled(null, null), true);
  assert.equal(pilasterToneEnabled('?pilasterTone=0', null), false);
  assert.equal(pilasterToneEnabled(null, '0'), false);
  assert.equal(pilasterToneEnabled('?a=1&pilasterTone=1', '0'), true);
  const saved = process.env.PILASTER_TONE;
  try {
    process.env.PILASTER_TONE = '0'; resetPilasterToneFlag(); assert.equal(pilasterToneOn(), false);
    delete process.env.PILASTER_TONE; resetPilasterToneFlag(); assert.equal(pilasterToneOn(), true);
  } finally { if (saved === undefined) delete process.env.PILASTER_TONE; else process.env.PILASTER_TONE = saved; resetPilasterToneFlag(); }
});

test('an unstated pilaster takes the wall colour x PILASTER_SHADE; stated or flag off keeps the pale dice colour', () => {
  assert.equal(PILASTER_SHADE, 0.9);
  assert.equal(pilasterHex({ wallHex: '#534b4b' }, WHITE, true), '#4b4444');
  assert.equal(pilasterHex({ wallHex: '#534b4b' }, WHITE, false), WHITE);
  assert.equal(pilasterHex({ wallHex: '#534b4b', registerForce: ['corner-pilasters'] }, STONE, true), STONE);
  assert.equal(pilasterHex({ wallHex: '#534b4b', statedFirst: ['corner-pilasters'] }, WHITE, true), WHITE);
  assert.equal(pilasterHex({ wallHex: '#534b4b', recipe: { paleAccents: true } }, WHITE, true), WHITE);
  assert.equal(pilasterStated({ recipe: { paleAccents: false } }), false);
  assert.equal(pilasterStated({ registerForce: ['hoist-beam'] }), false);
});

// Haarlemmerdijk 29 (0363100012167795) front as the mesher sees it: c19, 3.78 m, wall #534b4b (scripts/check-pilaster-tone.ts
// pins the real tile). The component builds the same boxes either way; only their colour moves.
const front = (over: Partial<ExtraContext> = {}): ExtraContext => ({
  id: 'NL.IMBAG.Pand.0363100012167795', style: 'c19', wallKey: '-7924,13213', f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 3.78 }, base: 0, top: 11.4,
  layout: { bays: 2, bayWidthM: 1.89, groundM: 3.6, storeys: 3, storeyM: 2.6, doorBays: [0] }, wallHex: '#534b4b', accentHex: '#ffffff', groundLevel: true, ...over,
});
const pilasters = ORNAMENT_COMPONENTS.find(c => c.id === 'corner-pilasters')!;
const draw = (c: ExtraContext, r: number, on: boolean) => {
  const saved = process.env.PILASTER_TONE;
  process.env.PILASTER_TONE = on ? '1' : '0'; resetPilasterToneFlag();
  try { const s = new ExtraSink(1000); pilasters.build(c, s, r); return s.tris; }
  finally { if (saved === undefined) delete process.env.PILASTER_TONE; else process.env.PILASTER_TONE = saved; resetPilasterToneFlag(); }
};

test('corner-pilasters: same geometry on and off; the dice pilaster is wall-toned, a register-stated one stays white', () => {
  for (const r of [0.1, 0.7]) {
    const off = draw(front(), r, false), on = draw(front(), r, true);
    assert.ok(off.length > 0);
    assert.deepEqual(on.map(t => [t.p, t.n]), off.map(t => [t.p, t.n]), 'same triangles');
    assert.ok(off.every(t => t.hex === (r < 0.6 ? WHITE : STONE)), 'off: the dice colour');
    assert.ok(on.every(t => t.hex === '#4b4444'), 'on: the wall x 0.9');
    const stated = draw(front({ registerForce: ['corner-pilasters'] }), r, true);
    assert.ok(stated.every(t => t.hex === (r < 0.6 ? WHITE : STONE)), 'stated: pale');
  }
});
