/**
 * Belt windows lane (2026-11-22, Herengracht 2-90): the measured opening grid (validation, the look's default → row →
 * exception resolution, the boxes scaled to the drawn front and storeys, the joinery pieces), the pixel pass's profiles,
 * and the fixes found on Herengracht 90 (the cornice centre only over the front's middle; corner pilasters not read off
 * "shopfront with pilasters"; the door kept between measured windows).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOINERY, OPENING_GLASS, OPENING_GLASS_LIT, OPENING_REVEAL, STOCK_STONE, darkPaint, joineryPieces, methodOf, openingBoxes, openingGridOf, openingGridProblems, resolvedLook, type OpeningGrid } from './openingGrid.ts';
import { bandWindows, runsOver, windowBars, type RgbImage } from '../beltReview/openingProfile.ts';
import { TEXT_CUES } from '../beltReview/plotRead.ts';
import { gridSpanOnRun, runOnLine, soloCentreOnEdge, soloGroundBoxes, stockTrimOf } from '../threeBuildingMesh.ts';

/** Herengracht 90 as measured by eye on its crop (50 px/m): three bays, wide 2-light casements under a toplight. */
const H90: OpeningGrid = {
  frontM: 5.66, storeyM: [5.64, 3.48, 2.68, 2.52],
  default: { frame: '#efece4', sash: '#3b2c22' },
  rows: [
    { storey: 1, x: [0.172, 0.496, 0.821], w: 1.34, h: 2.48, sill: 0.66, panes: { cols: 2, rows: 2, transom: 0.26 }, by: 'eye' },
    { storey: 2, x: [0.172, 0.496, 0.821], w: 1.34, h: 1.9, sill: 0.2, panes: { cols: 2, rows: 1, transom: 0.32 }, by: 'eye' },
    { storey: 3, x: [0.175, 0.498, 0.823], w: 1.34, h: 1.46, sill: 0.3, panes: { cols: 2, rows: 2 }, except: { '1': { head: 'segmental' } }, by: { all: 'eye', x: 'pixel' } },
  ],
};

test('openingGridProblems: a sound grid passes; each bad field is named', () => {
  assert.deepEqual(openingGridProblems(H90), []);
  assert.ok(openingGridOf(H90));
  assert.equal(openingGridOf({ ...H90, frontM: 0 }), null);
  const bad = (rows: unknown) => openingGridProblems({ ...H90, rows });
  assert.ok(bad([{ ...H90.rows[0], x: [1.2] }]).some(p => /x/.test(p)), 'a share outside 0..1');
  assert.ok(bad([{ ...H90.rows[0], panes: { cols: 0, rows: 1 } }]).some(p => /panes/.test(p)));
  assert.ok(bad([{ ...H90.rows[0], panes: { cols: 1, rows: 1, transom: 0.9 } }]).some(p => /transom/.test(p)));
  assert.ok(bad([{ ...H90.rows[0], surround: 'gothic' }]).some(p => /surround/.test(p)));
  assert.ok(bad([{ ...H90.rows[0], storey: 9 }]).length > 0, 'a storey the grid has no height for');
});

test('resolvedLook / methodOf: default, then the row, then the bay exception; the method per field', () => {
  const l = resolvedLook(H90, H90.rows[2], 1)!;
  assert.equal(l.head, 'segmental');
  assert.equal(l.frame, '#efece4');
  assert.equal(l.w, 1.34);
  assert.equal(resolvedLook(H90, H90.rows[2], 0)!.head, undefined);
  assert.equal(methodOf(H90.rows[2], 'x'), 'pixel');
  assert.equal(methodOf(H90.rows[2], 'w'), 'eye');
  assert.equal(methodOf(H90.rows[0], 'x'), 'eye');
});

test('openingBoxes: stretched to a drawn front near the photo\'s, metres kept on a run much longer; z to the drawn storey', () => {
  const same = openingBoxes(H90, 1, { frontM: 5.66, storeyM: 3.48 });
  assert.equal(same.length, 3);
  assert.ok(Math.abs(same[0].x - 0.172 * 5.66) < 1e-3 && Math.abs(same[0].hw - 0.67) < 1e-3);
  assert.ok(Math.abs(same[0].z0 - 0.66) < 1e-3 && Math.abs(same[0].z1 - 3.14) < 1e-3);
  // A front 10 % wider: the grid stretched with it.
  const wide = openingBoxes(H90, 1, { frontM: 6.226, storeyM: 3.48 });
  assert.ok(Math.abs(wide[0].hw - 0.67 * 1.1) < 1e-3);
  // A run half again as long (Herengracht 70's 6.38 m run, 4.17 m wall): the windows keep their metres from the start.
  const long = openingBoxes(H90, 1, { frontM: 8.5, storeyM: 3.48 });
  assert.ok(Math.abs(long[2].x - 0.821 * 5.66) < 1e-3 && Math.abs(long[2].hw - 0.67) < 1e-3);
  // A shorter drawn storey scales the heights.
  const low = openingBoxes(H90, 2, { frontM: 5.66, storeyM: 2.68 / 2 });
  assert.ok(Math.abs(low[0].z0 - 0.1) < 1e-3);
  assert.deepEqual(openingBoxes(H90, 0, { frontM: 5.66, storeyM: 4 }), [], 'no ground row: no boxes');
});

test('joineryPieces: glass (the toplight paler), the frame ring, the sash bars in the sash colour; a surround when asked', () => {
  const [b] = openingBoxes(H90, 1, { frontM: 5.66, storeyM: 3.48 });
  const p = joineryPieces({ ...b, sash: '#3b2c22' }, '#efece4', '#ffffff');
  // Dark sashes: the glass behind them lit (the sky in it), so the bars read (belt windows 2).
  assert.ok(p.some(q => q.hex === OPENING_GLASS_LIT.light), 'a toplight');
  assert.ok(p.some(q => q.hex === OPENING_GLASS_LIT.pane) && p.some(q => q.hex === OPENING_GLASS_LIT.sky));
  assert.ok(!p.some(q => q.hex === OPENING_GLASS.pane), 'no dark glass behind dark sashes');
  assert.ok(p.some(q => q.hex === '#efece4' && q.out === JOINERY.frameOut), 'the frame');
  assert.ok(p.filter(q => q.hex === '#3b2c22').length >= 3, 'a mullion, a rail and the transom in the sash colour');
  assert.ok(!p.some(q => q.hex === '#ffffff'), 'no surround by default');
  assert.ok(p.some(q => q.hex === OPENING_REVEAL && q.out < JOINERY.glassOut), 'the reveal\'s shadow behind the frame');
  const blocks = joineryPieces({ ...b, surround: 'block-dressings' }, '#efece4', '#ffffff').filter(q => q.hex === '#ffffff');
  const widths = new Set(blocks.map(q => +(q.pts[1][0] - q.pts[0][0]).toFixed(3)));
  assert.ok(widths.size >= 2, 'long and short blocks in turn');
  const arch = joineryPieces({ ...b, head: 'round' }, '#efece4', '#ffffff');
  assert.ok(Math.max(...arch.filter(q => q.hex !== OPENING_REVEAL).flatMap(q => q.pts.map(t => t[1]))) <= b.z1 + 1e-6, 'an arched head stays inside the box (its reveal\'s shadow round it)');
});

/** A synthetic crop: a wall colour with dark windows and a white bar in each. */
function wallWithWindows(): RgbImage {
  const width = 200, height = 100, data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3, win = y >= 20 && y < 80 && ((x >= 20 && x < 70) || (x >= 120 && x < 170));
    const bar = win && (x === 44 || x === 45 || x === 144 || x === 145);
    const c = bar ? [240, 240, 240] : win ? [40, 50, 60] : [150, 80, 60];
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
  }
  return { width, height, data };
}

test('openingProfile: runs over a threshold; the windows of a band and the bars inside one', () => {
  assert.deepEqual(runsOver([0, 1, 1, 0, 1, 1, 1], 0.5, 2), [[1, 3], [4, 7]]);
  const img = wallWithWindows(), r = bandWindows(img, { y0: 0, y1: 100 }, 100);
  assert.equal(r.windows.length, 2);
  assert.ok(Math.abs(r.windows[0].x0 - 20) <= 3 && Math.abs(r.windows[1].x1 - 170) <= 3);
  assert.ok(Math.abs(r.windows[0].y0 - 20) <= 3 && Math.abs(r.windows[0].y1 - 80) <= 3);
  const bars = windowBars(img, { x0: 20, x1: 70, y0: 20, y1: 80 }, 2);
  assert.equal(bars.mullions.length, 1);
  assert.ok(Math.abs(bars.mullions[0] - 0.5) < 0.05);
});

test('TEXT_CUES.pilasters: a shopfront\'s or door\'s pilasters are not the front\'s (Herengracht 90)', () => {
  const cue = (t: string) => TEXT_CUES.pilasters.test(t.replace(/ \| /g, '|'));
  assert.equal(cue('shopfront with pilasters and a fascia'), false);
  assert.equal(cue('doorcase with pilasters | brick front'), false);
  assert.equal(cue('giant pilasters | brick front'), true);
  assert.equal(cue('brick front | corner pilasters'), true);
});

test('soloCentreOnEdge: the cornice centre only on the front run\'s wall over its middle (Herengracht 90\'s rear wing)', () => {
  const rd = { corniceDress: { centre: 'attic' as const, centreRiseM: 1.3, centreLight: 'square' as const, centreDropM: 1.2 } };
  const solo = { designSolo: true as const };
  assert.equal(soloCentreOnEdge(solo, rd, true, 6, 0, 6), rd, 'the front wall holding the middle keeps it');
  const rear = soloCentreOnEdge(solo, rd, false, 3, 0, 3);
  assert.equal(rear.corniceDress.centre, undefined);
  assert.equal((rear.corniceDress as Record<string, unknown>).centreDropM, undefined);
  assert.equal(soloCentreOnEdge(solo, rd, true, 8, 0, 2.5).corniceDress.centre, undefined, 'a front wall short of the middle');
  assert.equal(soloCentreOnEdge({}, rd, false, 3, 0, 3), rd, 'not a solo plot: unchanged');
});

test('soloGroundBoxes (measured): the door between measured windows near its axis, else at it; a basement window under each', () => {
  const layout = { bays: 3, bayWidthM: 2, groundM: 4, storeyM: 3, lengthM: 6 };
  const g = { windowRatio: 0.6, doorRatio: 0.6, basementRatio: 0.3 };
  // The stock upper axes (one window a bay, centred) stand in for the read's openings.
  const o = { upper: { axes: [0.5], head: 0.85, sill: 0.25, width: 0.5 } } as unknown as Parameters<typeof soloGroundBoxes>[1];
  // Windows at 1 m and 3 m; the read door on the middle axis (3 m) clashes; the gap between the windows (1.5-2.5 m) is too
  // narrow for it, the gap past the second window is within reach.
  const wins = [{ x: 1, hw: 0.5, z0: 1.5, z1: 3.5 }, { x: 3, hw: 0.5, z0: 1.5, z1: 3.5 }];
  const boxes = soloGroundBoxes(layout, o, g, 1, true, undefined, wins)!;
  const door = boxes.find(b => b.kind === 'door')!;
  assert.ok(door.a0 * 6 >= 3.5 - 1e-6, 'the door stands clear of the measured windows');
  assert.equal(boxes.filter(b => b.kind === 'window').length, 2);
  assert.equal(boxes.filter(b => b.kind === 'basement').length, 2, 'a low window under each window over the band');
  // Five windows and no gap near the axis (Herengracht 40): the door at its axis, the window over it dropped.
  const five = [0.6, 1.8, 3, 4.2, 5.4].map(x => ({ x, hw: 0.4, z0: 1.5, z1: 3.5 }));
  const b5 = soloGroundBoxes({ ...layout, bays: 5, bayWidthM: 1.2 }, o, g, 2, true, undefined, five)!;
  const d5 = b5.find(b => b.kind === 'door')!;
  assert.ok(Math.abs((d5.a0 + d5.a1) / 2 * 6 - 3) < 0.05);
  assert.equal(b5.filter(b => b.kind === 'window').length, 4);
});

test('belt windows 2: white joinery keeps the dark glass; the frame and bars at least the stock cell\'s', () => {
  const [b] = openingBoxes(H90, 1, { frontM: 5.66, storeyM: 3.48 });
  const p = joineryPieces({ ...b, sash: undefined }, '#efece4', '#ffffff');
  assert.ok(p.some(q => q.hex === OPENING_GLASS.pane) && !p.some(q => q.hex === OPENING_GLASS_LIT.pane));
  assert.ok(p.filter(q => q.hex === '#efece4').length >= 6, 'bars in the frame colour when no sash paint is stated');
  assert.ok(JOINERY.frame >= 0.09 && JOINERY.bar >= 0.04);
  assert.equal(darkPaint('#2e302f'), true);
  assert.equal(darkPaint('#ece9e0'), false);
  assert.equal(darkPaint(undefined), false);
});

test('belt windows 2: a grid row without a surround takes the stock trim; stated surrounds draw', () => {
  const stock = stockTrimOf({ lintel: 'flat', family: 'masonry', archetype: 'canal', shape: 'rect', trimDensity: undefined, paleAccents: true });
  assert.deepEqual(stock, { lintel: 'flat', restrained: false, blocks: true });
  assert.equal(stockTrimOf({ lintel: 'none', archetype: 'canal', shape: 'rect' }).lintel, 'none');
  assert.equal(stockTrimOf({ archetype: 'canal', shape: 'arch' }).lintel, 'arch');
  const [b] = openingBoxes(H90, 1, { frontM: 5.66, storeyM: 3.48 }, stock);
  assert.deepEqual(b.surround, { stock });
  const p = joineryPieces(b, '#efece4', '#ffffff');
  assert.ok(p.some(q => q.hex === STOCK_STONE && q.pts[0][1] > b.z1), 'a stone lintel over the head');
  assert.ok(p.some(q => q.hex === STOCK_STONE && q.pts[2][1] <= b.z0), 'a stone sill under it');
  assert.ok(p.some(q => q.hex === '#eee9de'), 'pale blocks beside the jambs');
  const stated = openingBoxes({ ...H90, default: { ...H90.default, surround: 'sill' } }, 1, { frontM: 5.66, storeyM: 3.48 }, stock)[0];
  assert.equal(stated.surround, 'sill', 'a stated surround wins over the stock trim');
  for (const s of ['keystone', 'jack-blocks', 'full-frame'] as const) assert.ok(joineryPieces({ ...b, surround: s }, '#2e302f', '#ffffff').some(q => q.hex === '#ffffff' && q.pts[0][1] >= b.z1 - 0.01), `${s}: a head`);
});

test('belt windows 2: the photo line places the grid on its stretch of a longer run (Herengracht 72), and picks the run', () => {
  const origin = { lng: 4.89, lat: 52.377 }, kx = 111_320 * Math.cos(52.377 * Math.PI / 180), M = 110_540;
  const ll = (x: number, y: number): [number, number] => [origin.lng + x / kx, origin.lat + y / M];
  // A 6.6 m run along x; the photo's 4.2 m front from 2.4 m to 6.6 m.
  const line = [...ll(2.4, 0.3), ...ll(6.6, 0.3)] as [number, number, number, number];
  assert.deepEqual(openingGridProblems({ ...H90, line }), []);
  assert.ok(openingGridProblems({ ...H90, line: [1, 2, 3] }).length);
  const span = gridSpanOnRun({ line }, [0, 0, 6.6, 0], 6.6, true, origin);
  assert.ok(Math.abs(span.startM - 2.4) < 0.02 && Math.abs(span.frontM - 4.2) < 0.02);
  const rev = gridSpanOnRun({ line }, [6.6, 0, 0, 0], 6.6, false, origin);
  assert.ok(Math.abs(rev.startM - 2.4) < 0.02, 'a run drawn right to left as seen: the same stretch as seen');
  assert.deepEqual(gridSpanOnRun({}, [0, 0, 6.6, 0], 6.6, true, origin), { startM: 0, frontM: 6.6 }, 'no line: the whole run');
  assert.deepEqual(gridSpanOnRun({ line: [...ll(2, 9), ...ll(6, 9)] as [number, number, number, number] }, [0, 0, 6.6, 0], 6.6, true, origin), { startM: 0, frontM: 6.6 }, 'a line off the run: the whole run');
  // A corner house (Herengracht 82): the longer side-street run is not on the line.
  const edge = (x0: number, y0: number, x1: number, y1: number) => ({ e: { x0, y0, x1, y1 } as never });
  const canal = [edge(0, 0, 6.7, 0)], side = [edge(6.7, 0, 6.7, -10.6)];
  assert.equal(runOnLine([side, canal], [...ll(0, 0.2), ...ll(6.7, 0.2)] as [number, number, number, number], origin), canal);
});

test('belt windows 2: the read door index takes the gap before that measured window (Herengracht 78)', () => {
  const layout = { bays: 3, bayWidthM: 1.33, groundM: 4, storeyM: 3, lengthM: 4 };
  const g = { windowRatio: 0.6, doorRatio: 0.6 };
  const o = { upper: { axes: [0.5], head: 0.85, sill: 0.25, width: 0.5 } } as unknown as Parameters<typeof soloGroundBoxes>[1];
  // Door first from the left, windows at 1.92 m and 3.2 m: the stock axis (bay 0, 0.67 m) is in the first gap already;
  // with the door read second, it stands between the windows only when that gap holds it.
  const wins = [{ x: 1.92, hw: 0.56, z0: 1.4, z1: 3.9 }, { x: 3.2, hw: 0.56, z0: 1.4, z1: 3.9 }];
  const boxes = soloGroundBoxes(layout, o, g, 0, true, undefined, wins)!;
  const door = boxes.find(b => b.kind === 'door')!;
  assert.ok(door.a1 * 4 <= 1.36 + 1e-6, 'the door left of the first window');
  assert.equal(boxes.filter(b => b.kind === 'window').length, 2, 'both windows kept');
});
