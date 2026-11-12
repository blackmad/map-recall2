// The facade record (F1 S1, #380): byte layout pinned, every field round-trips, provenance classes on three real pands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genericBayWindow,
  BAYS_FIT, DOOR_BAY_AUTO, DOOR_BAY_NONE, FACADE_BANDS, FACADE_FIELDS, FACADE_GROUND_KINDS, FACADE_RECORD_BYTES, FACADE_RECORD_VERSION,
  FACADE_WALL_MATERIALS, emptyFacadeRecord, facadeField, facadeLayoutMetres, facadeRecordFor, facadeRecordsFor, facadeWallRGB,
  packFacadeRecord, packFacadeRecordFor, srcClass, unpackFacadeRecord, type FacadeRecord,
} from './facadeRecord.ts';
import { CORNICES, WINDOWS, WINDOW_HEADS, WINDOW_SURROUNDS, ARCH_RING_STYLES } from '../buildingRecipe/intent.ts';

test('the layout fits 64 bytes and no two fields share a bit', () => {
  assert.equal(FACADE_RECORD_BYTES, 64);
  assert.equal(FACADE_RECORD_VERSION, 1);
  const used = new Uint8Array(64);
  for (const x of FACADE_FIELDS) {
    const span = x.kind === 'rgb' ? [[x.byte, 0xff], [x.byte + 1, 0xff], [x.byte + 2, 0xff]]
      : x.kind === 'u16' ? [[x.byte, 0xff], [x.byte + 1, 0xff]]
      : x.kind === 'u8' ? [[x.byte, 0xff]]
      : [[x.byte, ((1 << x.width!) - 1) << x.bit!]];
    for (const [b, mask] of span) {
      assert.ok(b < 64, `${x.name} past byte 63`);
      assert.equal(used[b] & mask, 0, `${x.name} overlaps byte ${b}`);
      assert.ok(mask <= 0xff, `${x.name} spills out of byte ${b}`);
      used[b] |= mask;
    }
  }
  // Byte 63 is F2's reserve; every other reserved bit is listed here so a new field has to be placed on purpose.
  assert.equal(used[63], 0);
  // Reserved: byte 3 bit 7, byte 15 bit 7, byte 38 bit 7, byte 59 bits 3-7.
  assert.deepEqual([...used.slice(0, 63)].map((v, i) => [i, v]).filter(([, v]) => v !== 0xff), [[3, 0x7f], [15, 0x7f], [38, 0x7f], [59, 0x07]]);
});

test('byte offsets are pinned (the GLSL unpack and the design doc §1.2 read these)', () => {
  const pin: Record<string, [number, number?, number?]> = {
    wall: [0], wallMaterial: [3, 0, 4], frame: [4], glassTone: [7, 2, 3], style: [7, 5, 3], wallHcm: [8], plinthDm: [10], seed: [11], roof: [12],
    storeys: [16], groundDm: [17], upperDm: [18], atticDm: [19], baysGround: [20], baysUpper: [21], baysAttic: [22], doorBay: [23], windowKind: [24],
    windowHead: [25, 0, 3], archRing: [25, 3, 2], keystone: [25, 5, 1], tympanum: [25, 6, 2], windowShare: [26], windowHeightQ: [27],
    cornice: [28, 0, 3], statedMask: [30], shareQ: [31, 1, 7],
    accent: [32], bands: [35, 0, 3], spekSpacing: [36], surround: [38, 0, 3], band: [42], windowRevealCm: [46], doorRevealCm: [47],
    groundKind: [48, 0, 4], entrance: [49, 0, 3], fascia: [50], shopPaint: [53], displayWindows: [56], door: [60],
  };
  for (const [name, [byte, bit, width]] of Object.entries(pin)) {
    const x = facadeField(name as any);
    assert.equal(x.byte, byte, name);
    if (bit !== undefined) { assert.equal(x.bit, bit, name); assert.equal(x.width, width, name); }
  }
  // Enum widths hold their vocabularies.
  assert.ok(WINDOWS.length <= 255 && WINDOW_HEADS.length <= 8 && CORNICES.length <= 8 && WINDOW_SURROUNDS.length <= 8 && ARCH_RING_STYLES.length <= 4);
  assert.ok(FACADE_BANDS.length <= 8 && FACADE_GROUND_KINDS.length <= 16 && FACADE_WALL_MATERIALS.length <= 16);
});

test('every field round-trips through pack/unpack at its extremes and at random values', () => {
  let s = 12345;
  const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
  for (let trial = 0; trial < 200; trial++) {
    const r = emptyFacadeRecord() as Record<string, any>;
    for (const x of FACADE_FIELDS) {
      const max = x.kind === 'rgb' || x.kind === 'u8' ? 255 : x.kind === 'u16' ? 65535 : (1 << x.width!) - 1;
      const pick = () => trial === 0 ? max : trial === 1 ? 0 : Math.floor(rnd() * (max + 1));
      r[x.name] = x.kind === 'rgb' ? [pick(), pick(), pick()] : pick();
    }
    const bytes = packFacadeRecord(r as FacadeRecord);
    assert.equal(bytes.length, 64);
    assert.deepEqual(unpackFacadeRecord(bytes), r);
  }
  // u16 little-endian, so the shader's `texel.z & 0xffff` is wallHcm.
  const r = emptyFacadeRecord(); r.wallHcm = 0x1234;
  const b = packFacadeRecord(r);
  assert.equal(b[8], 0x34); assert.equal(b[9], 0x12);
  assert.equal(new Uint32Array(b.buffer)[2] & 0xffff, 0x1234);
  // Out-of-range values clamp to the field and never spill into a neighbour.
  const o = emptyFacadeRecord(); o.windowHead = 99; o.archRing = 0;
  assert.equal(unpackFacadeRecord(packFacadeRecord(o)).archRing, 0);
  assert.equal(unpackFacadeRecord(packFacadeRecord(o)).windowHead, 7);
});

test('provenance classes: prior, inferred, register/hand, photo-measured', () => {
  assert.equal(srcClass(undefined), 0);
  assert.equal(srcClass('default'), 0);
  assert.equal(srcClass('3dbag'), 0);
  assert.equal(srcClass('bag'), 1);
  assert.equal(srcClass('vision-judge'), 1);
  assert.equal(srcClass('vision-judge', 0.85), 3);
  assert.equal(srcClass('monument-text'), 2);
  assert.equal(srcClass('author'), 2);
  assert.equal(srcClass('reviewed'), 2);
  assert.equal(srcClass('streetlevel-measured'), 3);
});

// Real records from the published house-specs extract (2026-11-12).
/** Register-only: a spout gable with a hoist beam, brick (Rijksmonument text). */
const REGISTER = { d: { fronts: [{ gable: 'spout', hoist: true }], palette: { wallMaterial: 'brick' } }, x: { elements: ['hoist-beam', 'shutters-3d'], historicGable: 'spout' }, s: { 'fronts/0/gable': 'monument-text', 'fronts/0/hoist': 'monument-text', 'palette/wallMaterial': 'monument-text', 'facts/elements': 'monument-text', 'facts/historicGable': 'monument-text' } };
/** Block-face house, Bilderdijkstraat (NL.IMBAG.Pand.0363100012133467), measured on the street strip. */
const BLOCK_FACE = {
  d: {
    fronts: [{ axisGrid: 6, bandHeights: { sill: 0.1, transom: 0.08 }, bandLines: ['sill', 'transom'], bandTransomAt: 0.63, bands: 'both', basement: 'none', bays: [1, 4, 4, 4], cornice: 'bracketed', doorBay: null, gable: 'cornice', hoist: false, id: 'front0',
      shopfront: { colour: 'black', fascia: true, glazing: 'split', displayWindows: 4, stallriser: 'low' }, storeys: 4, street: 'Bilderdijkstraat', surroundStoreys: [3],
      windowHead: { kind: 'segmental', storeys: [1, 2], archRing: { colour: 'stone', style: 'blocks', keystone: true } }, windowHeights: [0.7, 0.635, 0.651, 0.655], windowShare: 0.64, windowSurround: 'keystone', windows: 'sash' }],
    roof: { material: 'red-tile' }, palette: { brick: '#6a4a36', cornice: 'white', door: 'black', frame: 'white', stone: 'cream' },
  },
  s: Object.fromEntries(['axisGrid', 'bandHeights', 'bandLines', 'bandTransomAt', 'bands', 'basement', 'bays', 'cornice', 'doorBay', 'gable', 'hoist', 'shopfront', 'storeys', 'windowHead', 'windowHeights', 'windowShare', 'windowSurround', 'windows'].map(k => [`fronts/0/${k}`, 'streetlevel-measured'])
    .concat([['palette/brick', 'streetlevel-measured'], ['palette/stone', 'streetlevel-measured'], ['palette/frame', 'streetlevel-measured'], ['palette/door', 'streetlevel-measured'], ['roof/material', 'pdok-ortho']])),
};

test('a register-only pand: brick and hoist from the register (Src 2), everything else the canal prior (Src 0)', () => {
  const r = facadeRecordFor({ id: '0363100012166927', style: 'canal', wallHex: '#7a3e2c', heightM: 14.2, eavesM: 11.4, spec: REGISTER });
  assert.equal(FACADE_WALL_MATERIALS[r.wallMaterial], 'brick');
  assert.equal(r.wallSrc, 2);
  assert.equal(r.hoist, 1);
  assert.equal(r.wallHcm, 1140, 'the 3DBAG eaves, not the ridge');
  assert.equal(WINDOWS[r.windowKind], 'sash-6-over-6', 'canal prior window');
  assert.equal(r.statedMask, 0, 'the register states none of the layout fields');
  assert.equal(r.baysUpper, BAYS_FIT, 'no count, no front length: the shader fits bays');
  assert.equal(r.doorBay, DOOR_BAY_AUTO);
  assert.equal(r.bands, 0); assert.equal(r.bandsSrc, 0);
  assert.equal(r.surroundSrc, 0);
  assert.equal(FACADE_GROUND_KINDS[r.groundKind], 'residential');
  // Storeys fill the wall: ground + n x upper = wall height.
  const m = facadeLayoutMetres(r);
  assert.ok(Math.abs(m.ground + (r.storeys - 1) * m.upper - m.wallH) < 0.15, JSON.stringify(m));
});

test('a block-face house: every measured field lands, with Src 3 and the stated mask', () => {
  const r = facadeRecordFor({ id: '0363100012133467', style: 'c19', wallHex: '#6a4a36', heightM: 16.0, eavesM: 14.5, spec: BLOCK_FACE });
  assert.equal(r.storeys, 4);
  assert.equal(r.baysUpper, 6, 'axisGrid wins over the per-storey list');
  assert.equal(r.baysGround, 1);
  assert.equal(r.doorBay, DOOR_BAY_NONE);
  assert.equal(WINDOWS[r.windowKind], 'sash');
  assert.equal(WINDOW_HEADS[r.windowHead], 'segmental');
  assert.equal(ARCH_RING_STYLES[r.archRing], 'blocks');
  assert.equal(r.keystone, 1);
  assert.equal(r.windowShare, Math.round(0.64 * 255));
  assert.equal(r.windowHeightQ, Math.round(0.651 * 255), 'median of the upper storeys');
  assert.equal(CORNICES[r.cornice], 'bracketed');
  assert.equal(FACADE_BANDS[r.bands], 'both'); assert.equal(r.bandsSrc, 3);
  assert.equal(r.bandLines, 0b011, 'sill + transom');
  assert.equal(r.bandSillCm, 10);
  assert.equal(r.bandTransomAt, Math.round(0.63 * 255));
  assert.equal(WINDOW_SURROUNDS[r.surround], 'keystone'); assert.equal(r.surroundSrc, 3); assert.equal(r.keystoneSrc, 3);
  assert.deepEqual(r.accent, [0xe4, 0xdc, 0xc4], 'palette stone "cream"');
  assert.deepEqual(r.frame, [0xec, 0xe9, 0xe0], 'palette frame "white"'); assert.equal(r.frameSrc, 3);
  assert.deepEqual(r.door, [0x1e, 0x1e, 0x1e]);
  assert.equal(r.roofSrc, 1, 'roof material from the orthophoto');
  assert.equal(FACADE_GROUND_KINDS[r.groundKind], 'shop'); assert.equal(r.groundSrc, 3);
  assert.equal(r.displayWindows, 4); assert.equal(r.fasciaOn, 1);
  // storeys, bays, windows, head, door, heights, cornice, ground: all stated.
  assert.equal(r.statedMask, 0xff);
});

test('a prior-only pand: the style fit, every Src 0, a front length gives a bay count', () => {
  const r = facadeRecordFor({ id: '0363100099999999', style: 'postwar', wallHex: '#8a6b5a', heightM: 12, minHeightM: 0, frontLengthM: 18 });
  assert.equal(r.wallSrc, 0); assert.equal(r.frameSrc, 0); assert.equal(r.statedMask, 0);
  assert.equal(r.baysUpper, 10, '18 m / 1.8 m pitch');
  assert.equal(r.storeys, 4);
  assert.equal(WINDOWS[r.windowKind], 'plain');
  assert.equal(CORNICES[r.cornice], 'none');
  // Pale look trait: a stone-lintel surround, inferred (Src 1).
  const pale = facadeRecordFor({ id: 'x', style: 'canal', wallHex: '#8a6b5a', heightM: 12, look: { pale: true } });
  assert.equal(WINDOW_SURROUNDS[pale.surround], 'stone-lintel'); assert.equal(pale.surroundSrc, 1);
});

test('accents below Src 2 do not reach the record (the F3 ruling)', () => {
  const judged = { d: { fronts: [{ bands: 'speklagen', windowSurround: 'full-frame' }] }, s: { 'fronts/0/bands': 'vision-judge', 'fronts/0/windowSurround': 'vision-judge' } };
  const r = facadeRecordFor({ id: 'j', style: 'canal', wallHex: '#7a3e2c', heightM: 12, spec: judged });
  assert.equal(r.bands, 0); assert.equal(r.surround, 0);
  const confident = { ...judged, c: { 'fronts/0/bands': 0.9 } };
  assert.equal(FACADE_BANDS[facadeRecordFor({ id: 'j', style: 'canal', wallHex: '#7a3e2c', heightM: 12, spec: confident }).bands], 'speklagen');
});

test('measured eaves above 3DBAG win (ruling 2); a judge eaves does not', () => {
  const spec = (src: string) => ({ d: { fronts: [{ eavesHeight: 11.0 }] }, s: { 'fronts/0/eavesHeight': src } });
  assert.equal(facadeRecordFor({ id: 'h', style: 'canal', wallHex: '#7a3e2c', heightM: 13, eavesM: 7.94, spec: spec('streetlevel-measured') }).wallHcm, 1100);
  assert.equal(facadeRecordFor({ id: 'h', style: 'canal', wallHex: '#7a3e2c', heightM: 13, eavesM: 7.94, spec: spec('vision-judge') }).wallHcm, 794);
});

test('stated storey heights normalise to the wall; a different top storey becomes the attic', () => {
  const spec = { d: { fronts: [{ storeys: 4, storeyHeights: [4, 3.2, 3.2, 2.4] }] }, s: { 'fronts/0/storeys': 'author', 'fronts/0/storeyHeights': 'author' } };
  const r = facadeRecordFor({ id: 'a', style: 'canal', wallHex: '#7a3e2c', heightM: 12.8, eavesM: 12.8, spec });
  const m = facadeLayoutMetres(r);
  assert.equal(r.storeys, 4);
  assert.equal(m.ground, 4); assert.equal(m.upper, 3.2); assert.equal(m.attic, 2.4);
  assert.equal(r.statedMask & 0b100001, 0b100001);
});

test('the wall colour is the mesher tint: wallHex x the per-building tone jitter', () => {
  const rgb = facadeWallRGB({ id: '0363100012166927', wallHex: '#7a3e2c' });
  // hash01('<id>:tone') in [0, 1) -> jitter in [0.9, 1.1): every channel scales by one factor.
  const k = rgb[0] / 0x7a;
  assert.ok(k >= 0.89 && k <= 1.11);
  assert.ok(Math.abs(rgb[1] - 0x3e * k) <= 1 && Math.abs(rgb[2] - 0x2c * k) <= 1);
  assert.deepEqual(facadeRecordFor({ id: '0363100012166927', style: 'canal', wallHex: '#7a3e2c', heightM: 10 }).wall, rgb);
});

test('multi-front pands get one record per front; packing is deterministic', () => {
  const spec = { d: { fronts: [{ share: 0.6, storeys: 3 }, { share: 0.4, storeys: 4 }] }, s: { 'fronts/0/share': 'author', 'fronts/1/share': 'author' } };
  const rs = facadeRecordsFor({ id: 'm', style: 'c19', wallHex: '#6a4a36', heightM: 13, spec });
  assert.equal(rs.length, 2);
  assert.equal(rs[0].shareQ, Math.round(0.6 * 127)); assert.equal(rs[1].shareQ, Math.round(0.4 * 127));
  assert.equal(rs[0].storeys, 3); assert.equal(rs[1].storeys, 4);
  const input = { id: 'm', style: 'c19' as const, wallHex: '#6a4a36', heightM: 13, spec };
  assert.deepEqual(packFacadeRecordFor(input), packFacadeRecordFor(input));
});

test('S6b: an unstated front copies the photo look\'s bay preset (head, stone, sash bars, frame, opening size); stated fields win', () => {
  // bayLook.ts c19 preset 82: a stone arch over a rect transom window, pale jamb blocks; bayVariantOpenings: 2 x 0.275 of the bay, 0.70 tall.
  const bay = genericBayWindow({ archetype: 'c19', shape: 'rect', lintel: 'arch', sash: 'transom', paleAccents: true }, { axes: [0.25, 0.75], width: 0.275, sill: 0.147, head: 0.847 });
  assert.deepEqual({ ...bay, share: +bay.share!.toFixed(2), height: +bay.height!.toFixed(2) }, { head: 'flat', surround: 'full-frame', sills: true, kind: 't-window', dark: false, share: 0.55, height: 0.7 });
  assert.equal(genericBayWindow({ archetype: 'modern', shape: 'rect', lintel: 'none', sash: 'plain', frameTone: 'dark' }).surround, 'none');
  assert.equal(genericBayWindow({ archetype: 'canal', shape: 'segmental', lintel: 'none', sash: 'paired-transom' }).head, 'segmental');
  const generic = { storeys: 3, groundM: 3.5, storeyM: 3.1, windows: 3, doorWindow: 2, variant: 1, bay };
  const base = { id: 'bay-prior', style: 'c19' as const, wallHex: '#8a6145', heightM: 14, minHeightM: 0, frontLengthM: 6, generic };
  const r = facadeRecordFor(base);
  assert.equal(WINDOW_HEADS[r.windowHead], 'flat');
  assert.equal(WINDOW_SURROUNDS[r.surround], 'full-frame');
  assert.equal(WINDOWS[r.windowKind], 't-window');
  assert.equal(r.windowShare, Math.round(0.55 * 255));
  assert.equal(r.bands, 0, 'the bay looks paint no storey band');
  assert.equal(r.doorBay, 2);
  const stated = facadeRecordFor({ ...base, spec: { d: { fronts: [{ windowHead: { kind: 'segmental' }, windows: 'sash' }] } } });
  assert.equal(WINDOW_HEADS[stated.windowHead], 'segmental');
  assert.equal(WINDOWS[stated.windowKind], 'sash');
});

test('S6d wall material prior: the register finish at Src 1, else unset; the spec palette wins', async () => {
  const { recordWallMaterial } = await import('../threeBuildingMesh.ts');
  assert.deepEqual(recordWallMaterial({ registerFinish: 'light' }), { wallMaterial: 'stucco', wallMaterialSrc: 1 });
  assert.deepEqual(recordWallMaterial({ registerFinish: 'brick' }), { wallMaterial: 'brick', wallMaterialSrc: 1 });
  assert.deepEqual(recordWallMaterial({}), {});
  const base = { id: 'mat', style: 'c19' as const, wallHex: '#8a6145', heightM: 12, minHeightM: 0 };
  assert.equal(FACADE_WALL_MATERIALS[facadeRecordFor({ ...base, wallMaterial: 'stucco', wallMaterialSrc: 1 }).wallMaterial], 'stucco');
  assert.equal(FACADE_WALL_MATERIALS[facadeRecordFor({ ...base, wallMaterial: 'stucco', spec: { d: { palette: { wallMaterial: 'brick' } } } }).wallMaterial], 'brick');
});
