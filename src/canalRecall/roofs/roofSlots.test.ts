import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyRoof, decodeRoofFactTile, encodeRoofFactTile, slotForFamily, type RoofFact } from './roofSlots.ts';
import { applyRoofFact, composeEnrichers, roofFactsEnricher } from './roofFacts.ts';
import { measuredRoofFurniture, UNIT_TRIANGLES } from './roofFurniture.ts';
import { ExtraSink } from '../facadeExtraCore.ts';
import { meshBuildingFor, buildFeatureChunk, type Feature } from '../threeBuildingFeatures.ts';
import { FLAT_ROOF_GREYS, ROOF_SLOT_TONES, hexToRgb, lumaOf } from '../look/palette.ts';

/** n pixels of one colour plus a few of another (skylights, shadows). */
const roof = (main: [number, number, number], n = 400, extra: Array<[[number, number, number], number]> = []) => {
  const px: number[] = [];
  for (let i = 0; i < n; i++) px.push(...main);
  for (const [c, k] of extra) for (let i = 0; i < k; i++) px.push(...c);
  return { rgb: Uint8Array.from(px), n: px.length / 3 };
};

test('classifyRoof: red pantile, grey gravel, dark bitumen, slate, sedum, solar', () => {
  // Ortho-like colours (cast included): pantile red reads salmon, dark roofs teal.
  const red = roof([190, 120, 95]);
  assert.equal(classifyRoof(red.rgb, red.n, 3)?.slot, 'pantile-red');
  const gravel = roof([132, 136, 122], 400, [[[235, 235, 230], 20], [[40, 45, 50], 30]]);
  assert.equal(classifyRoof(gravel.rgb, gravel.n, 1)?.slot, 'gravel');
  const dark = roof([78, 92, 92]);
  assert.equal(classifyRoof(dark.rgb, dark.n, 1)?.slot, 'bitumen-dark');
  assert.equal(classifyRoof(dark.rgb, dark.n, 3)?.slot, 'slate');
  const sedum = roof([95, 125, 70]);
  assert.equal(classifyRoof(sedum.rgb, sedum.n, 1)?.slot, 'sedum');
  // Over a pitched roof the same green is a tree canopy: never sedum.
  assert.notEqual(classifyRoof(sedum.rgb, sedum.n, 3)?.slot, 'sedum');
  const solar = roof([45, 62, 92], 300, [[[130, 132, 125], 100]]);
  const s = classifyRoof(solar.rgb, solar.n, 1);
  assert.equal(s?.slot, 'solar');
  assert.ok((s?.solarShare ?? 0) > 0.5);
  assert.equal(classifyRoof(new Uint8Array(15), 5, 1), null, 'too few pixels is no reading');
});

test('hand-label families map onto slots by roof type', () => {
  assert.equal(slotForFamily('D', 1), 'bitumen-dark');
  assert.equal(slotForFamily('D', 3), 'slate');
  assert.equal(slotForFamily('L', 3), 'zinc');
  assert.equal(slotForFamily('G', 3), null);
});

const fact = (over: Partial<RoofFact> = {}): RoofFact => ({ slot: 'gravel', rgb: [130, 128, 120], confidence: 0.9, solarShare: 0, terrace: false, furniture: [], ...over });

test('the sidecar round-trips, drops low-confidence readings and keeps furniture', () => {
  const tile = encodeRoofFactTile([
    ['0363100012000002', fact({ slot: 'pantile-red', rgb: [181, 84, 58], solarShare: 0.2 })],
    ['0363100012000001', fact({ terrace: true, furniture: [{ kind: 'hvac', e: 3.25, n: -2, w: 1, l: 2, yawDeg: 30 }, { kind: 'skylight', e: 1, n: 1, w: 0.75, l: 1.5, yawDeg: 0 }] })],
    ['0363100012000003', fact({ confidence: 0.2 })],
  ], 'CC BY 4.0', 'test');
  assert.equal(tile.read, 3);
  assert.equal(tile.ids.length, 2);
  const back = decodeRoofFactTile(JSON.parse(JSON.stringify(tile)));
  assert.deepEqual([...back.keys()], ['0363100012000001', '0363100012000002']);
  const red = back.get('0363100012000002')!;
  assert.equal(red.slot, 'pantile-red');
  assert.ok(red.rgb.every((v, i) => Math.abs(v - [181, 84, 58][i]) <= 5), 'colour within 5:5:5 quantisation');
  assert.equal(red.solarShare, 0.2);
  const flat = back.get('0363100012000001')!;
  assert.equal(flat.terrace, true);
  assert.deepEqual(flat.furniture.map(f => [f.kind, f.e, f.n, f.l, f.w, f.yawDeg]), [['hvac', 3.25, -2, 2, 1, 30], ['skylight', 1, 1, 1.5, 0.75, 0]]);
});

test('the enricher stamps BAG pands from the z14 sidecar and ignores others', async () => {
  const tile = encodeRoofFactTile([['0363100012000001', fact({ slot: 'white-membrane', rgb: [220, 220, 215], furniture: [{ kind: 'vent', e: 1, n: 1, w: 0.25, l: 0.25, yawDeg: 0 }] })]], 'CC BY 4.0', 'test');
  const urls: string[] = [];
  const fetchImpl = (async (url: string) => { urls.push(url); return new Response(JSON.stringify(tile)); }) as unknown as typeof fetch;
  const apply = await roofFactsEnricher('../data/', fetchImpl)({ z: 14, x: 8413, y: 5386 }, new AbortController().signal);
  const features = [{ properties: { id: 'NL.IMBAG.Pand.0363100012000001' } as Record<string, unknown> }, { properties: { id: 'w123' } as Record<string, unknown> }];
  apply!(features);
  assert.deepEqual(urls, ['../data/roof-facts/14/8413/5386.json.gz']);
  assert.equal(features[0].properties.roofSlot, 'white-membrane');
  assert.equal(typeof features[0].properties.roofFurniture, 'string');
  assert.equal(features[1].properties.roofSlot, undefined);
  // Composed with another enricher, a failing fetch costs only its own stamp.
  const broken = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  const both = await composeEnrichers(roofFactsEnricher('x', broken), async () => (fs: any[]) => { fs[0].properties.year = 1900; })({ z: 14, x: 1, y: 1 }, new AbortController().signal);
  const f2 = [{ properties: {} as Record<string, unknown> }];
  both!(f2);
  assert.equal(f2[0].properties.year, 1900);
});

const square: Feature['geometry'] = { type: 'Polygon', coordinates: [[[4.87, 52.366], [4.8702, 52.366], [4.8702, 52.3661], [4.87, 52.3661], [4.87, 52.366]]] };
const feature = (props: Record<string, unknown>): Feature => ({ type: 'Feature', properties: { id: 'NL.IMBAG.Pand.0363100012000001', height: 12, facade: 'x', facadeStyle: 'postwar', ...props }, geometry: square });

test('the generic tier reads the slot: flat lid colour, pitched cell and tint, furniture in the extras chunk', () => {
  const prior = meshBuildingFor(feature({}), 'photo')!;
  assert.ok(FLAT_ROOF_GREYS.includes(prior.lid!.hex), 'no stamp: the grey prior');
  const p: Record<string, unknown> = {};
  applyRoofFact(p, fact({ slot: 'white-membrane', rgb: [225, 225, 220], furniture: [{ kind: 'hvac', e: 5, n: 5, w: 1.2, l: 2, yawDeg: 10 }, { kind: 'skylight', e: 8, n: 4, w: 1, l: 1, yawDeg: 0 }] }));
  const measured = meshBuildingFor(feature(p), 'photo')!;
  const y = lumaOf(hexToRgb(measured.lid!.hex)), [lo, hi] = ROOF_SLOT_TONES['white-membrane'].luma;
  assert.ok(y >= lo && y <= hi, `white membrane lid luma ${y}`);
  assert.equal(measured.measuredRoof?.furniture.length, 2);
  const extras = buildFeatureChunk([feature(p)], 'photo', 'extras');
  const guessed = buildFeatureChunk([feature({})], 'photo', 'extras');
  assert.ok(extras.indices.length > 0, 'measured furniture is drawn');
  assert.notEqual(extras.indices.length, guessed.indices.length);
  // A pitched slot on a pitched plan picks the slate cell and the measured tint.
  const q: Record<string, unknown> = { roofPlanned: true, facadeStyle: 'canal' };
  applyRoofFact(q, fact({ slot: 'slate', rgb: [80, 86, 92] }));
  const pitched = meshBuildingFor(feature(q), 'photo');
  if (pitched?.roof) {
    assert.equal(pitched.roof.plan.material, 'slate');
    const [a, b] = ROOF_SLOT_TONES.slate.luma, yy = lumaOf(hexToRgb(pitched.roof.roofHex));
    assert.ok(yy >= a && yy <= b);
  }
});

test('furniture units stay within 60 triangles each and the measured set is bounded', () => {
  assert.ok(UNIT_TRIANGLES <= 60);
  const sink = new ExtraSink(230);
  const items = Array.from({ length: 16 }, (_, i) => ({ kind: (['hvac', 'skylight', 'chimney', 'vent', 'solar', 'overrun'] as const)[i % 6], e: i, n: i, w: 1, l: 1.5, yawDeg: 15 * i }));
  const placed = measuredRoofFurniture({ furniture: items, terrace: true }, [0, 0], 10, { cx: 5, cy: 5, ux: 1, uy: 0, len: 12, wid: 8 }, sink);
  assert.equal(placed, 16 + 5);
  assert.equal(sink.tris.length, (16 + 5) * UNIT_TRIANGLES);
  assert.ok(sink.tris.every(t => t.p.every(v => v[2] >= 10 - 1e-9)), 'nothing below the roof');
});
