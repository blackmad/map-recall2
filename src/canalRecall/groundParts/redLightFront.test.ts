import assert from 'node:assert/strict';
import test from 'node:test';
import { drawRedLightFront, redLightDoors, redLightFrontOf, RED_LIGHT_LOOK, type FrontPanelSink } from './redLightFront.ts';
import { windowFrontsOf } from '../buurtGenerator/kit/frontKit.ts';

type Rec = { kind: 'panel' | 'box'; a0: number; a1: number; z0: number; z1: number; hex: string; lit?: boolean };
const recorder = () => {
  const out: Rec[] = [];
  const sink: FrontPanelSink = {
    panel: (a0, a1, _o, z0, z1, hex, lit) => { out.push({ kind: 'panel', a0, a1, z0, z1, hex, ...(lit ? { lit } : {}) }); },
    box: (a0, a1, _o0, _o1, z0, z1, hex, lit) => { out.push({ kind: 'box', a0, a1, z0, z1, hex, ...(lit ? { lit } : {}) }); },
  };
  return { out, sink };
};

test('red-light front: doors at the measured pitch, the frame head at 2.7 m, one lit tube run over it (177991)', () => {
  // 0363100012177991: 3.49 m, three doors.
  assert.equal(redLightDoors(0, 3.49).length, 3);
  const { out, sink } = recorder();
  drawRedLightFront(sink, 0, 3.49, 0, 0);
  const tubes = out.filter(r => r.hex === RED_LIGHT_LOOK.tubeHex);
  assert.equal(tubes.length, 1);
  assert.ok(tubes[0].lit, 'the tube is its own light');
  assert.ok(tubes[0].z0 > 2.7 && tubes[0].z1 < 3, `tube over the head (${tubes[0].z0}-${tubes[0].z1})`);
  const kicks = out.filter(r => r.hex === RED_LIGHT_LOOK.kickHex);
  assert.equal(kicks.length, 3);
  assert.ok(kicks.every(k => k.z1 === RED_LIGHT_LOOK.kickM));
  assert.ok(out.some(r => r.kind === 'box' && r.hex === RED_LIGHT_LOOK.frameHex && Math.abs(r.z0 - 2.7) < 1e-9), 'a head rail at 2.7 m');
  assert.ok(out.every(r => r.a0 >= -1e-9 && r.a1 <= 3.49 + 1e-9), 'inside its span');
});

test('red-light front: a tube per door and curtains gathered over a dark room (178276); junk fields are dropped', () => {
  const { out, sink } = recorder();
  drawRedLightFront(sink, 0, 4.8, 0, 0, { doors: 4, tube: 'doors', curtains: 'gathered', curtainHex: '#8a1a24' });
  assert.equal(out.filter(r => r.hex === RED_LIGHT_LOOK.tubeHex).length, 4);
  assert.equal(out.filter(r => r.hex === RED_LIGHT_LOOK.roomHex).length, 4);
  const curtains = out.filter(r => r.hex === '#8a1a24');
  assert.equal(curtains.length, 4);
  assert.ok(curtains.every(c => c.a1 - c.a0 < 0.5), 'gathered: a third of the door');
  assert.deepEqual(redLightFrontOf({ doors: 0, tube: 'neon', frameHex: 'red', curtains: 'gathered', headM: 9 }), { curtains: 'gathered' });
  assert.equal(redLightDoors(0, 0.5).length, 0, 'too narrow: nothing');
  assert.deepEqual(windowFrontsOf([{ a0: 0.1, a1: 0.9, doors: 3 }, { a0: 0.5, a1: 0.52 }, null, { a0: -1, a1: 1 }]), [{ a0: 0.1, a1: 0.9, doors: 3 }]);
});

test('red-light front: tube none draws no tube (round 17: a sign band or awning over the head)', () => {
  const { out, sink } = recorder();
  drawRedLightFront(sink, 0, 3.2, 0, 0, { tube: 'none' });
  assert.equal(out.filter(r => r.hex === RED_LIGHT_LOOK.tubeHex).length, 0);
  assert.equal(redLightFrontOf({ tube: 'none' })?.tube, 'none');
});
