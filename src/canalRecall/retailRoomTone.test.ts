// Round m, one room per shop (lane shop-one-room-20261121): every goods kind but the two exempt has a room family, its
// pane fillers are painted on that family's room, and its signature cell is painted on the same room, so the panes of
// one shop share the room exactly; with the shop-variety flag off the goods cells are as before.
// `node --import tsx --test src/canalRecall/retailRoomTone.test.ts`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS_KINDS, paintGoods, type Ctx2D, type GoodsKind } from './retailGoods.js';
import { FILLER_CELLS, FILLER_KINDS, FILLER_LAYERS, fillerCell, paintFiller } from './retailPaneFillers.js';
import { FAMILY_FILLERS, FAMILY_ROOMS, ROOM_FAMILIES, ROOM_FAMILY_OF, roomOf } from './retailRoomTone.js';
import { PANE_SETS, planPanes } from './shopVariety.js';

/** A context that records every fill (style and shape) instead of drawing. */
function recorder(): { ctx: Ctx2D; ops: string[] } {
  const ops: string[] = [];
  let path: string[] = [];
  const ctx = {
    fillStyle: '' as unknown, strokeStyle: '' as unknown, lineWidth: 1, globalAlpha: 1,
    fillRect: (x: number, y: number, w: number, h: number) => { ops.push(`rect ${String(ctx.fillStyle)} ${[x, y, w, h].map(v => v.toFixed(2))}`); },
    beginPath: () => { path = []; }, closePath: () => {}, moveTo: (x: number, y: number) => { path.push(`M${x.toFixed(1)},${y.toFixed(1)}`); },
    lineTo: (x: number, y: number) => { path.push(`L${x.toFixed(1)},${y.toFixed(1)}`); },
    arc: () => {}, ellipse: (x: number, y: number) => { path.push(`E${x.toFixed(1)},${y.toFixed(1)}`); }, quadraticCurveTo: () => {},
    fill: () => { ops.push(`fill ${String(ctx.fillStyle)} ${path.join('')}`); }, stroke: () => {}, save: () => {}, restore: () => {},
    translate: () => {}, scale: () => {}, rect: () => {}, clip: () => {},
    createLinearGradient: (...a: number[]) => { const stops: string[] = []; return { addColorStop: (o: number, c: string) => { stops.push(`${o}:${c}`); }, toString: () => `lin(${a.join(',')}|${stops.join(' ')})` }; },
    createRadialGradient: (...a: number[]) => { const stops: string[] = []; return { addColorStop: (o: number, c: string) => { stops.push(`${o}:${c}`); }, toString: () => `rad(${a.map(v => v.toFixed(1)).join(',')}|${stops.join(' ')})` }; },
  };
  return { ctx: ctx as unknown as Ctx2D, ops };
}
/** The room's opening ops: the back wall, the ceiling shadow, the dado and its rail, the floor and its shadow. */
const ROOM_OPS = 6;

test('every goods kind but automatiek and redWindow has a family; every family room and filler set is used', () => {
  for (const k of GOODS_KINDS) {
    if (k === 'automatiek' || k === 'redWindow') { assert.equal(ROOM_FAMILY_OF[k], undefined, k); continue; }
    assert.ok(ROOM_FAMILY_OF[k], `${k}: a room family`);
  }
  for (const f of ROOM_FAMILIES) {
    assert.ok(Object.values(ROOM_FAMILY_OF).includes(f), `${f} is used`);
    assert.equal(new Set(FAMILY_FILLERS[f]).size, FAMILY_FILLERS[f].length, `${f}: distinct fillers`);
    for (const k of FAMILY_FILLERS[f]) assert.ok(Object.entries(PANE_SETS).some(([g, s]) => ROOM_FAMILY_OF[g as GoodsKind] === f && s!.fillers.includes(k)), `${f}/${k} is drawn by some kind`);
  }
  assert.equal(FILLER_CELLS.length, ROOM_FAMILIES.reduce((n, f) => n + FAMILY_FILLERS[f].length, 0));
});

test("a kind's pane fillers are painted on its own family's room, and its plans draw only them", () => {
  for (const [kind, set] of Object.entries(PANE_SETS) as Array<[GoodsKind, NonNullable<(typeof PANE_SETS)[GoodsKind]>]>) {
    const fam = ROOM_FAMILY_OF[kind]!;
    for (const f of set.fillers) assert.ok(FAMILY_FILLERS[fam].includes(f), `${kind} (${fam}): ${f}`);
    const row = Array.from({ length: 6 }, (_, i) => ({ a0: i * 1.2, a1: i * 1.2 + 1.1, bay: i }));
    for (let s = 0; s < 12; s++) for (const c of planPanes(kind, row, [[7.3, 8.3]], `t${s}`)) if (!c.signature) assert.doesNotThrow(() => fillerCell(fam, c.filler));
  }
  for (const f of FILLER_KINDS) assert.ok(FILLER_CELLS.some(c => c.filler === f), `${f} has a cell`);
  for (const [i, c] of FILLER_CELLS.entries()) assert.equal(fillerCell(c.family, c.filler).page, Math.floor(i / 4));
  assert.equal(FILLER_LAYERS, Math.ceil(FILLER_CELLS.length / 4));
});

test('signature and fillers of one shop open with the same room: wall, ceiling, dado, floor, at one glass light', () => {
  for (const [kind, set] of Object.entries(PANE_SETS) as Array<[GoodsKind, NonNullable<(typeof PANE_SETS)[GoodsKind]>]>) {
    const sig = recorder(); paintGoods(sig.ctx, kind, 0, 0, 256, true);
    const room = sig.ops.slice(0, ROOM_OPS);
    assert.match(room[0], new RegExp(`^rect ${roomOf(kind)!.wall} `), `${kind}: the family wall`);
    for (const f of set.fillers) {
      const fil = recorder(); paintFiller(fil.ctx, ROOM_FAMILY_OF[kind]!, f, 0, 0, 256);
      assert.deepEqual(fil.ops.slice(0, ROOM_OPS), room, `${kind}/${f}: the signature's room`);
      // The glass over both (retailGoods glassOver: its first fill is the family's light level).
      const glass = (ops: string[]) => ops.find(o => o.startsWith('rect rgba(22,18,14,'));
      assert.equal(glass(fil.ops.slice(ROOM_OPS)), glass(sig.ops.slice(ROOM_OPS)), `${kind}/${f}: one glass light`);
    }
  }
});

test('flag off: the goods cells paint their own rooms as before (no family room)', () => {
  for (const kind of ['cafe', 'gelato', 'doner', 'brownBar'] as const) {
    const off = recorder(); paintGoods(off.ctx, kind, 0, 0, 256, false);
    const on = recorder(); paintGoods(on.ctx, kind, 0, 0, 256, true);
    assert.notDeepEqual(off.ops, on.ops, kind);
    assert.ok(!off.ops.some(o => o.startsWith(`rect ${FAMILY_ROOMS[ROOM_FAMILY_OF[kind]!].dado} `)), `${kind}: no family dado with the flag off`);
  }
});
