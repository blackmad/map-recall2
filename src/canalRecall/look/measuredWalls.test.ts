import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROW_BREAK, jitterTone, measuredPeriodWall, measuredWallForYear, measuredWallsEnabled, wallClassOf } from './measuredWalls.js';
import { MEASURED_PERIOD_WALL_LISTS } from './measuredPeriodWalls.js';
import { decodeWallRows, partyWallPairs, rowSeedKey, wallRows, type RowBuilding } from './wallRows.js';
import { PERIOD_WALLS, hexToRgb, rgbToHsl, PERIODS } from './palette.js';
import { bayLookFor } from '../bayLook.js';

test('flag: off by default, on for ?walls=measured or the window flag', () => {
  assert.equal(measuredWallsEnabled('', {}), false);
  assert.equal(measuredWallsEnabled('?walls=guessed', {}), false);
  assert.equal(measuredWallsEnabled('?look=photo&walls=measured', {}), true);
  assert.equal(measuredWallsEnabled('', { CANAL_MEASURED_WALLS: true }), true);
  assert.equal(measuredWallsEnabled('', { CANAL_MEASURED_WALLS: 'yes' }), false);
});

test('wall classes: brick, buff, dull brick, light and grey render', () => {
  assert.equal(wallClassOf([110, 62, 48]), 'brick');
  assert.equal(wallClassOf([235, 232, 226]), 'render-light');
  assert.equal(wallClassOf([60, 60, 60]), 'render-grey');
  assert.equal(wallClassOf([96, 86, 80]), 'brick-dull', 'warm, dark, low chroma: overcast brown brick');
});

const lists = { canal: ['#111111', '#222222', '#333333', '#444444'], c19: ['#7a4a3a', '#8a5040', '#6a4a40', '#e8e2d6', '#905844', '#704438', '#7e5242', '#a06048'], school: ['#555555'], modern: ['#666666'] } as const;

test('a row shares one base tone; members vary only a little; a few break the row', () => {
  const ids = Array.from({ length: 400 }, (_, i) => `NL.IMBAG.Pand.03631000121${String(i).padStart(5, '0')}`);
  const walls = ids.map(id => measuredPeriodWall(id, 'c19', 'row-a', lists));
  // The row tone is the mode of the members (within jitter), and the breaks are near ROW_BREAK.
  const near = (a: string, b: string) => { const x = rgbToHsl(hexToRgb(a)), y = rgbToHsl(hexToRgb(b)); return Math.abs(x[2] - y[2]) <= 0.045 && Math.abs(x[0] - y[0]) <= 5; };
  const best = Math.max(...walls.map(w => walls.filter(v => near(v, w)).length));
  assert.ok(best / walls.length > 1 - ROW_BREAK - 0.08, `row coherence ${best}/${walls.length}`);
  assert.ok(best / walls.length < 1, 'some members break the row');
});

test('deterministic, and a building alone draws from its own id', () => {
  assert.equal(measuredPeriodWall('NL.IMBAG.Pand.1', 'c19', 'r', lists), measuredPeriodWall('NL.IMBAG.Pand.1', 'c19', 'r', lists));
  assert.ok(lists.c19.includes(measuredPeriodWall('NL.IMBAG.Pand.1', 'c19', null, lists) as never));
  assert.equal(measuredWallForYear('NL.IMBAG.Pand.1', null), null);
  assert.ok(PERIODS.every(p => MEASURED_PERIOD_WALL_LISTS[p] === null || MEASURED_PERIOD_WALL_LISTS[p]!.length > 0));
  assert.ok(PERIOD_WALLS.photo.canal!.includes(measuredPeriodWall('x', 'canal', null, { ...MEASURED_PERIOD_WALL_LISTS, canal: null })), 'an unmeasured period keeps the prior list');
  const [, , l0] = rgbToHsl(hexToRgb('#806050')), [, , l1] = rgbToHsl(hexToRgb(jitterTone('#806050', 0)));
  assert.ok(Math.abs(l0 - l1) <= 0.021);
});

test('bayLookFor: byte-identical without the stamp; the stamp only replaces the photo period pick; a measured recipe wall wins', () => {
  const id = 'NL.IMBAG.Pand.0363100012153271';
  assert.deepEqual(bayLookFor(id, 1895, 15, 'photo'), bayLookFor(id, 1895, 15, 'photo', undefined, undefined, undefined));
  assert.equal(bayLookFor(id, 1895, 15, 'photo', undefined, undefined, '#123456').wallHex, '#123456');
  assert.equal(bayLookFor(id, 1895, 15, 'cartoon', undefined, undefined, '#123456').wallHex, bayLookFor(id, 1895, 15, 'cartoon').wallHex);
  const recipe = { family: 'masonry', period: 'c19', wallHex: '#654321' } as never;
  assert.equal(bayLookFor(id, 1895, 15, 'photo', undefined, recipe, '#123456').wallHex, bayLookFor(id, 1895, 15, 'photo', undefined, recipe).wallHex);
});

// Three terraced houses in a row (shared party walls), one detached, one later infill.
const sq = (x0: number, w: number): [number, number][] => { const k = 1 / (111_320 * Math.cos(52.37 * Math.PI / 180)), y = 1 / 110_540; return [[x0 * k, 0], [(x0 + w) * k, 0], [(x0 + w) * k, 12 * y], [x0 * k, 12 * y], [x0 * k, 0]]; };
const row: RowBuilding[] = [
  { id: 'P3', ring: sq(0, 6), year: 1895 }, { id: 'P1', ring: sq(6, 6), year: 1896 }, { id: 'P2', ring: sq(12.3, 6), year: 1895 },
  { id: 'P4', ring: sq(40, 6), year: 1895 }, { id: 'P5', ring: sq(18.3, 6), year: 1975 },
];
test('party walls: shared and near-shared walls pair, a detached house and a gap do not', () => {
  const pairs = partyWallPairs(row).map(([i, j]) => `${row[i].id}-${row[j].id}`).sort();
  assert.deepEqual(pairs, ['P1-P2', 'P2-P5', 'P3-P1']);
  const rows = wallRows(row, partyWallPairs(row));
  assert.equal(rows.get('P3'), 'P1'); assert.equal(rows.get('P2'), 'P1');
  assert.equal(rows.has('P4'), false, 'detached');
  assert.equal(rows.has('P5'), false, 'the 1975 infill is not of the row');
});
test('facts tile rows round-trip by key order', () => {
  const buildings = { P1: [1895], P2: [1895], P3: [1900] };
  const decoded = decodeWallRows(buildings, [[rowSeedKey('P1'), 0, 2]]);
  assert.equal(decoded.get('P1'), rowSeedKey('P1')); assert.equal(decoded.get('P3'), rowSeedKey('P1')); assert.equal(decoded.has('P2'), false);
  assert.equal(decodeWallRows(buildings, undefined).size, 0);
});

test('sunlit period walls (#50): brighter, hue kept, brick capped, white stays white, the flag-off prior untouched', async () => {
  const { sunlitPeriodWall, SUNLIT_PERIOD_WALL_LISTS } = await import('./measuredWalls.js');
  const sun = 1.6;
  const brick = '#70564f', lit = sunlitPeriodWall(brick, sun);
  const [h0, s0, l0] = rgbToHsl(hexToRgb(brick)), [h1, s1, l1] = rgbToHsl(hexToRgb(lit));
  assert.ok(l1 > l0 + 0.03, `lighter ${brick} -> ${lit}`);
  assert.ok(Math.abs(s1 - s0) < 0.12, 'saturation about held');
  assert.ok(rgbToHsl(hexToRgb(sunlitPeriodWall('#b8a17a', 2)))[2] <= 0.6 + 0.005, 'a light brick stays brick, not cream');
  assert.ok(Math.abs(h1 - h0) <= 3, `hue held ${h0} -> ${h1}`);
  assert.equal(sunlitPeriodWall('#ffffff', sun), '#ffffff');
  const chroma = (hex: string) => { const c = hexToRgb(hex); return Math.max(...c) - Math.min(...c); };
  assert.ok(chroma(sunlitPeriodWall('#e8e7e3', sun)) <= chroma('#e8e7e3') + 3, 'a pale render gains no cream');
  assert.equal(sunlitPeriodWall(brick, 1), brick);
  for (const p of PERIODS) {
    const m = MEASURED_PERIOD_WALL_LISTS[p];
    assert.equal(SUNLIT_PERIOD_WALL_LISTS[p]?.length ?? null, m?.length ?? null);
  }
  // The guessed prior (flag off) is never lifted.
  assert.ok(PERIOD_WALLS.photo.c19!.includes('#b05a40'));
});
