// F1 S5 (#380): the record shader's CPU twin (facadeTwin.ts) lays a record out in metres as the GLSL does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facadePixel, frBrick, frCover, frOpening } from './facadeTwin.ts';
import { ATLAS_WALL_MEAN, FACADE_WALL_MEAN } from './facadeShader.ts';
import { DOOR_BAY_AUTO, DOOR_BAY_NONE, emptyFacadeRecord, type FacadeRecord } from './facadeRecord.ts';

const rec = (patch: Partial<FacadeRecord> = {}): FacadeRecord => ({
  ...emptyFacadeRecord(), wall: [120, 70, 50], roof: [60, 60, 70], frame: [240, 236, 226], door: [40, 50, 48],
  storeys: 4, groundDm: 35, upperDm: 30, plinthDm: 0, wallHcm: 1300, style: 1, baysGround: 3, baysUpper: 3,
  doorBay: DOOR_BAY_NONE, windowShare: 150, windowHeightQ: 160, windowHead: 0, ...patch,
});
const px = (r: FacadeRecord, u: number, v: number, kind = 0, len = 6, fw = 0.01) => facadePixel(r, [u, v, len], kind, [fw, fw]);
const same = (a: number[], b: number[]) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

test('box coverage: full inside, half on an edge, none outside', () => {
  assert.equal(frCover(0.5, 0, 1, 0.1), 1);
  assert.ok(Math.abs(frCover(1, 0, 1, 0.1) - 0.5) < 1e-9);
  assert.equal(frCover(2, 0, 1, 0.1), 0);
  assert.ok(frOpening([0.5, 1.2], [0.01, 0.01], 0, 1, 0, 1.4, 2, 0) > 0.99, 'inside a round head');
  assert.equal(frOpening([0.02, 1.38], [0.01, 0.01], 0, 1, 0, 1.4, 2, 0), 0, 'the round head clips the corner');
});

test('wall between bays, glass in a pane, wall above the eaves and on party walls', () => {
  const r = rec({ wallMaterial: 1 }), wall = [120, 70, 50].map(c => (c / 255) * FACADE_WALL_MEAN); // stucco: no coursing
  assert.ok(same(px(r, 0.05, 5).rgb, wall), 'the pier between bays');
  const pane = px(r, 1.0, 3.5 + 1.5); // bay 0 centre (bay 2 m), first upper storey, mid window
  assert.ok(!same(pane.rgb, wall) && pane.m[0] < 0.01, 'glass in the pane, no wall mask');
  assert.ok(same(px(r, 1.0, 13.5).rgb, wall), 'above wallHcm');
  assert.ok(same(px(r, 1.0, 5, 3).rgb, wall), 'a party wall is blank');
  assert.deepEqual(px(r, 1.0, 5, 7).m, [0, 0], 'roof');
});

test('the door: the stated bay, the centre bay for AUTO, none for NONE', () => {
  const door = [40 / 255, 50 / 255, 48 / 255];
  assert.ok(same(px(rec({ doorBay: 2 }), 5.0, 1.0).rgb, door), 'stated bay 2');
  assert.ok(same(px(rec({ doorBay: DOOR_BAY_AUTO }), 3.0, 1.0).rgb, door), 'AUTO: the middle of three');
  assert.ok(!same(px(rec(), 5.0, 1.0).rgb, door), 'NONE: a window');
});

test('stated fields move pixels: bays, storeys, head', () => {
  const sample = (r: FacadeRecord) => { const out: number[] = []; for (let v = 0.1; v < 13; v += 0.2) for (let u = 0.05; u < 6; u += 0.1) out.push(...px(r, u, v).rgb); return out; };
  const base = sample(rec());
  const differs = (r: FacadeRecord) => sample(r).some((x, i) => Math.abs(x - base[i]) > 1 / 255);
  assert.ok(differs(rec({ baysUpper: 2 })), 'bays');
  assert.ok(differs(rec({ storeys: 3 })), 'storeys');
  assert.ok(differs(rec({ windowHead: 2 })), 'head');
  assert.ok(!differs(rec()), 'the same record draws the same');
});

test('a wider pixel footprint blends the frame edge (no aliasing step)', () => {
  const r = rec(), sharp = px(r, 0.6, 5, 0, 6, 0.001).rgb, soft = px(r, 0.6, 5, 0, 6, 0.4).rgb;
  assert.ok(!same(sharp, soft));
});

test('S6 coursing: mean 1 over the wall near, flat far; painted brick fainter; stucco smooth', () => {
  const mean = (material: number, fw: number) => { let s = 0, n = 0; for (let y = 0; y < 30; y += 0.0071) for (let x = 0; x < 30; x += 0.0731) { s += frBrick([x, y], [fw, fw], material); n++; } return s / n; };
  // Brick patches (S6c) are 0.22 x 0.125 m at FR_MOTTLE: a 30 m square holds about 33k of them, so the mean is 1 within 0.01.
  assert.ok(Math.abs(mean(0, 0.004) - 1) < 0.02, `brick mean ${mean(0, 0.004)}`);
  assert.equal(frBrick([0.3, 0.3], [0.5, 0.5], 0), 1, 'far: the mean');
  const spread = (material: number) => { let lo = 9, hi = 0; for (let y = 0; y < 0.5; y += 0.003) { const b = frBrick([0.1, y], [0.004, 0.004], material); lo = Math.min(lo, b); hi = Math.max(hi, b); } return hi - lo; };
  assert.ok(spread(2) < spread(0) * 0.5 && spread(2) > 0, 'painted brick: fainter');
  assert.equal(spread(1), 0, 'stucco: smooth');
});

test('S6 lookParity (reported, not a gate): the record wall mean is wallHex itself; the atlas reads ATLAS_WALL_MEAN of it', () => {
  const r = rec({ windowShare: 0, baysUpper: 1, baysGround: 1, storeys: 1, wallHcm: 2000 });
  let s = 0, n = 0;
  for (let y = 0.02; y < 19; y += 0.0097) for (let x = 0.01; x < 30; x += 0.0631) { const c = px(r, x, y, 3, 30, 0.004).rgb; s += 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; n++; }
  const hex = (0.299 * 120 + 0.587 * 70 + 0.114 * 50) / 255, atlas = hex * ATLAS_WALL_MEAN;
  console.log(`lookParity: record wall luma ${(s / n * 255).toFixed(1)}, atlas ${(atlas * 255).toFixed(1)} (${((s / n - atlas) * 255).toFixed(1)} luma)`);
  assert.ok(Math.abs(s / n - hex * FACADE_WALL_MEAN) * 255 <= 2, 'the coursing keeps the record wall at its own mean');
});

test('S6 accents move pixels: speklagen, storey bands, lintel, frame, sill, keystone, quoins', () => {
  const sample = (r: FacadeRecord) => { const out: number[] = []; for (let v = 0.1; v < 13; v += 0.05) for (let u = 0.05; u < 6; u += 0.05) out.push(...px(r, u, v).rgb); return out; };
  const base = sample(rec());
  const differs = (r: FacadeRecord) => sample(r).some((x, i) => Math.abs(x - base[i]) > 1 / 255);
  for (const [name, patch] of Object.entries({ speklagen: { spekSpacing: 7, spekCourses: 2 }, storey: { bands: 1, bandSillCm: 14 }, lintel: { bands: 2, bandHeadCm: 17 }, stoneLintel: { surround: 1 }, frame: { surround: 2 }, sill: { sills: 1 }, keystone: { keystone: 1 }, quoins: { quoins: 1 } }))
    assert.ok(differs(rec({ accent: [240, 236, 226], band: [240, 236, 226], ...patch } as Partial<FacadeRecord>)), name);
});

test('S6b: window kinds draw their glazing, a shop ground storey, the eaves cornice, the reveal shadow', () => {
  const sample = (r: FacadeRecord, v0 = 0.1, v1 = 13) => { const out: number[] = []; for (let v = v0; v < v1; v += 0.03) for (let u = 0.05; u < 6; u += 0.03) out.push(...px(r, u, v).rgb); return out; };
  const differs = (a: FacadeRecord, b: FacadeRecord, v0?: number, v1?: number) => { const x = sample(a, v0, v1), y = sample(b, v0, v1); return x.some((q, i) => Math.abs(q - y[i]) > 1 / 255); };
  assert.ok(differs(rec({ windowKind: 3 }), rec({ windowKind: 8 })), 'plain vs sash-6-over-6');
  assert.ok(differs(rec({ windowKind: 8 }), rec({ windowKind: 12 })), 'sash-6-over-6 vs t-window');
  assert.ok(differs(rec(), rec({ groundKind: 1, stallriserDm: 7, fasciaHeightDm: 6, fascia: [30, 40, 60], shopPaint: [90, 30, 30] }), 0.1, 3.4), 'shop ground');
  assert.ok(differs(rec(), rec({ cornice: 2, accent: [240, 236, 226] }), 12, 13), 'cornice band');
  assert.ok(differs(rec({ windowRevealCm: 0 }), rec({ windowRevealCm: 11 })), 'reveal shadow');
  assert.ok(differs(rec({ bands: 0 }), rec({ bands: 1, bandSillCm: 16, band: [226, 217, 194] })), 'storey string course');
});

test('S6c brick patches: the wall keeps a brick texture at the benchmark distance (photo medians 0.066 / 0.131 / 0.147)', () => {
  // brick-texture.ts's measure on the twin: detail (0.25 m running mean removed) std over the mean, pixel-centre samples down columns.
  const texture = (ppm: number) => {
    const step = 1 / ppm, half = Math.max(1, Math.round(0.125 / step));
    let s = 0, s2 = 0, n = 0, m = 0;
    for (let c = 0; c < 60; c++) {
      const ys: number[] = [];
      for (let k = 0; k < 8 * ppm; k++) ys.push(frBrick([0.37 + c * 0.913, 2.5 + k * step], [step, step], 0));
      for (let k = half; k < ys.length - half; k++) { let a = 0; for (let j = k - half; j <= k + half; j++) a += ys[j]; const d = ys[k] - a / (2 * half + 1); s += d; s2 += d * d; n++; m += ys[k]; }
    }
    return Math.sqrt(s2 / n - (s / n) ** 2) / (m / n);
  };
  assert.ok(texture(20) > 0.04 && texture(20) < 0.09, `20 px/m: ${texture(20)}`);
  assert.ok(texture(27) > 0.09 && texture(27) < 0.14, `27 px/m (the median pose; the coursing alone gives 0): ${texture(27)}`);
  assert.ok(texture(50) > 0.12 && texture(50) < 0.17, `50 px/m: ${texture(50)}`);
});
