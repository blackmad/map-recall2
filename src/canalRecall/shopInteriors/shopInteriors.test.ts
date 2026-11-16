// Lane shop-interiors-20261116: the type-to-room mapping, the deterministic atlas, the pane encoding and flag-off parity.
//   node --import tsx --test src/canalRecall/shopInteriors/shopInteriors.test.ts
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { GOODS_KINDS } from '../retailGoods.js';
import { RETAIL_TEMPLATES, TEMPLATE_LOOKS } from '../retailTemplates.js';
import { retailFrontTris } from '../retailFront.js';
import { ATLAS_H, ATLAS_W, FACE, paintInteriorAtlas, roomCell } from './atlas.js';
import { GOODS_ROOM, INTERIOR_V, ROOM_KINDS, decodeAccent, decodeVariant, interiorAccent, roomFor, roomVariant, shopInteriorsEnabled } from './rooms.js';
import { shopInteriorGlsl } from './shader.js';

const g = globalThis as { __canalRecallRetailReal?: boolean; __canalRecallShopInteriors?: boolean };
const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };

test('flag: default off; ?shopInteriors=1 or SHOP_INTERIORS=1 turn it on', () => {
  assert.equal(shopInteriorsEnabled(null, null), false);
  assert.equal(shopInteriorsEnabled('?a=1&shopInteriors=1', null), true);
  assert.equal(shopInteriorsEnabled('?shopInteriors=0', '1'), false);
  assert.equal(shopInteriorsEnabled(null, '1'), true);
});

test('rooms: each shop type gets its own trade room, never a random one', () => {
  const want: Record<string, string | null> = {
    ah: 'supermarket', jumbo: 'supermarket', etos: 'pharmacy', kruidvat: 'pharmacy', apotheek: 'pharmacy', bakery: 'bakery', turkishBakery: 'bakery',
    butcher: 'bakery', cheese: 'bakery', bike: 'bikeShop', books: 'bookshop', bruna: 'bookshop', hairdresser: 'hairdresser', tattoo: 'hairdresser',
    restaurant: 'restaurant', cafe: 'cafeBar', brownBar: 'cafeBar', clothes: 'clothing', doner: 'takeaway', frites: 'takeaway', snackbar: 'takeaway',
    florist: 'florist', optician: 'gallery', exchange: 'office', moneyTransfer: 'office', coffeeshop: 'dark', smartshop: 'dark',
    febo: null, redLight: null,
  };
  g.__canalRecallRetailReal = true;
  try {
    for (const [t, room] of Object.entries(want)) assert.equal(roomFor({ template: t }), room, t);
    // Every template that draws goods resolves deterministically to a room kind or a deliberate null.
    for (const t of RETAIL_TEMPLATES) { const r = roomFor({ template: t, goods: TEMPLATE_LOOKS[t].goods }); assert.ok(r === null || ROOM_KINDS.includes(r), t); }
  } finally { delete g.__canalRecallRetailReal; }
  for (const k of GOODS_KINDS) assert.ok(k in GOODS_ROOM, k);
  // Every room kind except the generic/quiet ones is some trade's room.
  const used = new Set(Object.values(GOODS_ROOM));
  for (const r of ROOM_KINDS) if (r !== 'shopGeneric') assert.ok(used.has(r) || r === 'restaurant' || r === 'office', r);
});

test('rooms: a neutral front (groundShop) is the plain generic shop, a quiet front dark, anything else none', () => {
  assert.equal(roomFor({ shopKind: 'groundShop' }), 'shopGeneric');
  assert.equal(roomFor({ quiet: true }), 'dark');
  assert.equal(roomFor({ shopKind: 'shopCafe' }), null);
  assert.equal(roomFor({}), null);
});

test('encoding: accent bytes and the variant round-trip and are seeded', () => {
  for (const room of ROOM_KINDS) for (const v of [0, 1, 77, 255]) for (const lit of [true, false]) assert.deepEqual(decodeAccent(interiorAccent(room, v, lit)), { room, variant: v, lit });
  assert.equal(roomVariant('pand-1'), roomVariant('pand-1'));
  const vs = new Set(Array.from({ length: 200 }, (_, i) => roomVariant(`p${i}`)));
  assert.ok(vs.size > 100, `${vs.size} variants over 200 shops`);
  const d = decodeVariant(roomVariant('x'));
  assert.ok(d.depthM >= 3.6 && d.depthM <= 6 && d.offset >= 0 && d.offset < 1);
});

test('atlas: deterministic, opaque faces, a mid plane with both furniture and gaps', () => {
  const a = paintInteriorAtlas(), b = paintInteriorAtlas();
  assert.equal(a.length, ATLAS_W * ATLAS_H * 4);
  assert.ok(Buffer.from(a.buffer).equals(Buffer.from(b.buffer)));
  const at = (x: number, y: number) => a[(y * ATLAS_W + x) * 4 + 3];
  for (const room of ROOM_KINDS) {
    const [cx, cy] = roomCell(room);
    for (const k of ['back', 'side', 'floor', 'ceil'] as const) {
      const [x, y, w, h] = FACE[k];
      for (let j = 0; j < h; j += 7) for (let i = 0; i < w; i += 7) assert.equal(at(cx + x + i, cy + y + j), 255, `${room} ${k} opaque`);
    }
    const [x, y, w, h] = FACE.mid;
    let solid = 0, clear = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) (at(cx + x + i, cy + y + j) > 128 ? solid++ : clear++);
    assert.ok(solid > 0.03 * w * h && clear > 0.2 * w * h, `${room} mid plane: ${solid} solid, ${clear} clear`);
  }
  // Pinned bytes: a painter change must be deliberate (update the hash with the reviewed atlas sheet).
  assert.equal(createHash('sha256').update(a).digest('hex').slice(0, 16), ATLAS_HASH);
});
const ATLAS_HASH = 'pending';

test('retail fronts: flag on draws each window as one interior quad; off is byte-identical to before', () => {
  g.__canalRecallRetailReal = true;
  try {
    for (const t of ['bakery', 'bike', 'books', 'ah', 'restaurant', 'butcher'] as const) {
      g.__canalRecallShopInteriors = false;
      const off = retailFrontTris({ template: t, seed: 's', word: 'TEST', letters: 99, goods: 300 }, e, 0.3, 6.3, 0, 3.6);
      delete g.__canalRecallShopInteriors;
      const unset = retailFrontTris({ template: t, seed: 's', word: 'TEST', letters: 99, goods: 300 }, e, 0.3, 6.3, 0, 3.6);
      assert.equal(JSON.stringify(unset), JSON.stringify(off), `${t}: unset = off`);
      g.__canalRecallShopInteriors = true;
      const on = retailFrontTris({ template: t, seed: 's', word: 'TEST', letters: 99, goods: 300 }, e, 0.3, 6.3, 0, 3.6);
      const glass = on.filter(tri => tri.uv?.some(([, v]) => v >= INTERIOR_V));
      assert.ok(glass.length >= 2 && glass.length % 2 === 0, `${t}: interior quads`);
      for (const tri of glass) {
        assert.equal(decodeAccent(tri.accentHex!).room, roomFor({ template: t, goods: TEMPLATE_LOOKS[t].goods }));
        for (const [u, v] of tri.uv!) { assert.ok(u >= -1e-9 && u <= 1 + 1e-9); assert.ok(v >= INTERIOR_V - 1e-9 && v <= INTERIOR_V + 1 + 1e-9); }
      }
      assert.ok(on.length <= off.length, `${t}: ${on.length} tris on, ${off.length} off`);
    }
    g.__canalRecallShopInteriors = true;
    const febo = retailFrontTris({ template: 'febo', seed: 's', goods: 300 }, e, 0.3, 6.3, 0, 3.6);
    assert.equal(febo.filter(tri => tri.uv?.some(([, v]) => v >= INTERIOR_V)).length, 0, 'FEBO keeps its automatiek');
  } finally { delete g.__canalRecallRetailReal; delete g.__canalRecallShopInteriors; }
});

test('shader: one function, uniforms declared, the atlas size baked in', () => {
  const s = shopInteriorGlsl();
  for (const k of ['uniform sampler2D shopAtlas', 'uniform float shopDusk', 'bool shopInterior(', `vec2(${ATLAS_W}.0, ${ATLAS_H}.0)`]) assert.ok(s.includes(k), k);
});
