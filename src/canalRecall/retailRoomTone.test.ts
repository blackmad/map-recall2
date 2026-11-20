import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS_KINDS } from './retailGoods.js';
import { FILLER_KINDS } from './retailPaneFillers.js';
import { FILLER_ROOM_TONE, GOODS_ROOM_TONE, toneDistance, toneFits, toneTint } from './retailRoomTone.js';
import { PANE_SETS, planPanes } from './shopVariety.js';

test('the room-tone table is the painters\' measured means (room-tones.ts --write)', async () => {
  const { measureRoomTones } = await import('../../scripts/retail-real/roomToneMeasure.ts');
  const t = await measureRoomTones();
  for (const k of GOODS_KINDS) assert.equal(GOODS_ROOM_TONE[k], t.goods[k], k);
  for (const k of FILLER_KINDS) assert.equal(FILLER_ROOM_TONE[k], t.fillers[k], k);
});

test('a filler takes the signature room: brightness matched, hue nudged, never brightened', () => {
  const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const t = rgb(toneTint('cafe', 'tablesBright')), f = rgb(FILLER_ROOM_TONE.tablesBright), s = rgb(GOODS_ROOM_TONE.cafe);
  assert.ok(Math.abs(lum(f.map((c, i) => c * t[i] / 255)) - lum(s)) < 0.12 * lum(s), 'brightness close to the signature');
  for (const [k, fl] of [['cosmetics', 'promoPoster'], ['gelato', 'menuPoster'], ['brownBar', 'lounge']] as const) {
    const c = rgb(toneTint(k, fl)), top = Math.max(...c);
    assert.ok(Math.min(...c) >= top * 0.78, `${k}/${fl}: hue held (${toneTint(k, fl)})`);
  }
  assert.ok(rgb(toneTint('gelato', 'lamps')).every(c => c <= 255));
  assert.equal(toneFits('gelato', 'lamps'), false);
});

test('no shop shows a filler too dark for its room; every set keeps one', () => {
  const row = (n: number) => Array.from({ length: n }, (_, i) => ({ a0: i * 1.2, a1: i * 1.2 + 1.1, bay: i }));
  for (const [kind, set] of Object.entries(PANE_SETS)) {
    let fit = set!.fillers.filter(f => toneFits(kind as never, f));
    if (fit.length < 2) fit = set!.fillers.slice().sort((p, q) => toneDistance(kind as never, p) - toneDistance(kind as never, q)).slice(0, 2);
    for (let s = 0; s < 12; s++) for (const c of planPanes(kind as never, row(6), [[7.3, 8.3]], `t${s}`)) {
      if (!c.signature) assert.ok(fit.includes(c.filler), `${kind}: ${c.filler}`);
    }
  }
});
