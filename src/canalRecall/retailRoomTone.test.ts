import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS_KINDS } from './retailGoods.js';
import { FILLER_KINDS } from './retailPaneFillers.js';
import { FILLER_ROOM_TONE, GOODS_ROOM_TONE, toneFits, toneTint } from './retailRoomTone.js';
import { PANE_SETS, planPanes } from './shopVariety.js';

test('the room-tone table is the painters\' measured means (room-tones.ts --write)', async () => {
  const { measureRoomTones } = await import('../../scripts/retail-real/roomToneMeasure.ts');
  const t = await measureRoomTones();
  for (const k of GOODS_KINDS) assert.equal(GOODS_ROOM_TONE[k], t.goods[k], k);
  for (const k of FILLER_KINDS) assert.equal(FILLER_ROOM_TONE[k], t.fillers[k], k);
});

test('a filler takes the signature room: the tint maps its mean onto the signature mean', () => {
  const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const t = rgb(toneTint('cafe', 'windowBar')), f = rgb(FILLER_ROOM_TONE.windowBar), s = rgb(GOODS_ROOM_TONE.cafe);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(f[i] * t[i] / 255 - s[i]) <= 2, `channel ${i}`);
  assert.equal(toneTint('gelato', 'lamps'), '#ffffff', 'never brightens');
  assert.equal(toneFits('gelato', 'lamps'), false);
  assert.equal(toneFits('brownBar', 'lamps'), true);
});

test('no shop shows a filler too dark for its room; every set keeps one', () => {
  const row = (n: number) => Array.from({ length: n }, (_, i) => ({ a0: i * 1.2, a1: i * 1.2 + 1.1, bay: i }));
  for (const [kind, set] of Object.entries(PANE_SETS)) {
    const fit = set!.fillers.filter(f => toneFits(kind as never, f));
    for (let s = 0; s < 12; s++) for (const c of planPanes(kind as never, row(6), [[7.3, 8.3]], `t${s}`)) {
      if (!c.signature && fit.length) assert.ok(fit.includes(c.filler), `${kind}: ${c.filler}`);
    }
  }
});
