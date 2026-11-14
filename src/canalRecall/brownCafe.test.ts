import assert from 'node:assert/strict';
import test from 'node:test';
import { BROWN_CAFE, GROUND_PX, bayTextures, type BayVariant } from './bayTextures.js';

/** Every canvas call of one cell's colour and mask passes, with fill styles and rects (retailGround.test.ts's recorder). */
function paint(v: BayVariant, look: 'photo' | 'cartoon' = 'photo') {
  const calls: string[] = [], fills: Array<{ style: string; rect: number[] }> = [];
  let style = '';
  const grad = () => ({ addColorStop: (...a: unknown[]) => calls.push(`stop${JSON.stringify(a)}`) });
  const ctx = new Proxy({ createLinearGradient: grad, createRadialGradient: grad }, {
    get(target, key) {
      if (key in target) return target[key as keyof typeof target];
      return (...a: number[]) => { calls.push(`${String(key)}${JSON.stringify(a)}`); if (key === 'fillRect') fills.push({ style, rect: a }); };
    },
    set(_t, key, value) { if (key === 'fillStyle') style = String(value); calls.push(`${String(key)}=${String(value)}`); return true; },
  });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) } as unknown as Document;
  try { bayTextures(v, {} as CanvasImageSource, look); } finally { globalThis.document = previous; }
  return { calls, fills };
}

// Named regression, feedback 7be6c55a: café Hendrix (Bilderdijkkade / De Clercqstraat, pand 0363100012132271), an OSM
// pub, so a shopBar cell. With retailGround off it drew vertical timber planks from 1.7 m down and two small panes
// washed 30 % amber that read as opaque beige panels, plus a painted hanging disc.
test('a brown café cell is glazed: big panes over a low riser, no planks, no amber wash, no painted disc', () => {
  for (const archetype of ['c19', 'canal', 'modern'] as const) for (const look of ['photo', 'cartoon'] as const) {
    const { calls, fills } = paint({ archetype, kind: 'shopBar', windows: 2, shape: 'rect', shutters: false, paintedFrames: false }, look);
    assert.ok(!calls.some(c => c.startsWith('arc(') || c.startsWith('arc[')), `${archetype}/${look}: no hanging disc`);
    assert.ok(!calls.some(c => /rgba\(255,180,90,0\.30?\)|rgba\(255,200,120,0\.45\)/.test(c)), `${archetype}/${look}: no amber wash over the glass`);
    // The old riser planks: 54 px wide boards every 70 px.
    assert.ok(!fills.some(f => f.rect[2] === 54), `${archetype}/${look}: no plank boards`);
  }
  const glassShare = (GROUND_PX - BROWN_CAFE.glassTop - BROWN_CAFE.riser) / GROUND_PX;
  assert.ok(glassShare > 0.45, `glass ${glassShare.toFixed(2)} of the storey height`);
  assert.ok(BROWN_CAFE.riser <= 80, 'a low stall riser (under 0.8 m)');
});

test('the brown café glass is a hole in the tint mask (untinted glass, not wall paint)', () => {
  const { calls } = paint({ archetype: 'c19', kind: 'shopBar', windows: 3, shape: 'rect', shutters: false, paintedFrames: false });
  // glassRect in the mask pass: black fill over a rounded rect at the glazing's top-left.
  const i = calls.findIndex(c => c === `moveTo[${BROWN_CAFE.side + 1},${BROWN_CAFE.glassTop}]`);
  assert.ok(i > 0, 'the glazing rect is drawn');
});
