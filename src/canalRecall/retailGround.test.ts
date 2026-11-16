// Lane retail-ground (2026-11-14): the template classifier, the front geometry, the measured pui and the flag's
// byte-identity when off. `node --import tsx --test src/canalRecall/retailGround.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REAL_ONLY_TEMPLATES, RETAIL_TEMPLATES, TEMPLATE_LOOKS, retailGroundEnabled, signText, signWord, templateForTags } from './retailTemplates.js';
import { FRONT, LETTER_STEM, MAX_LETTER_H, MIN_LETTER_H, fitWord, glassTone, retailDoor, retailFrontTris, strokePx } from './retailFront.js';
import { LOGOS, LOGO_GRID, glyphCellBox, glyphLayout, logoFor, retailLogoLayer } from './retailLogos.js';
import { PARTY, hostOnFront, ringEdges, segDist, steppedRun } from './retailHosting.js';
import fs from 'node:fs';
import { decorateShopfront, setShopfronts, setShopTemplates } from './shopfronts.js';
import { bayTextures, type BayVariant } from './bayTextures.js';
import { insideCentre } from './retailArea.js';
import { PRIOR, VEHICLE_GATE, paintOverGuess, clusters, drawnPaint, labHex, oklab, paintOf, streetPriors, vehicleBand, type Lab } from './retailPuiPaint.js';

const g = globalThis as { __canalRecallRetailGround?: boolean };

test('flag: on by default, URL beats env', () => {
  assert.equal(retailGroundEnabled(null, null), true);
  assert.equal(retailGroundEnabled('?retailGround=1', null), true);
  assert.equal(retailGroundEnabled('?retailGround=0', '1'), false);
  assert.equal(retailGroundEnabled('', '1'), true);
});

test('templates from OSM tags (2026-11-14 Overpass samples)', () => {
  const cases: Array<[Record<string, string>, string | null]> = [
    [{ shop: 'supermarket', brand: 'Albert Heijn', 'brand:wikidata': 'Q1653985', name: 'Albert Heijn' }, 'ah'],
    [{ shop: 'convenience', brand: 'Albert Heijn to go', 'brand:wikidata': 'Q77971185' }, 'ah'],
    [{ shop: 'florist', name: 'Jumbo' }, 'jumbo'],
    [{ amenity: 'restaurant', name: 'Chinees restaurant Jumbo' }, null],
    [{ shop: 'chemist', brand: 'Etos', 'brand:wikidata': 'Q2609459' }, 'etos'],
    [{ amenity: 'fast_food', brand: 'FEBO', cuisine: 'friture' }, 'febo'],
    [{ shop: 'books', brand: 'Bruna', 'brand:wikidata': 'Q3317555' }, 'bruna'],
    [{ shop: 'newsagent', name: 'Bestseller' }, 'bestseller'],
    [{ shop: 'gift', name: 'Amsterdam Duck Store' }, 'duck'],
    [{ shop: 'cannabis', name: 'Rockland' }, 'coffeeshop'],
    [{ shop: 'cannabis', name: 'Head Shop' }, 'smartshop'],
    [{ amenity: 'bar', name: "Barney's Farm" }, null],
    [{ amenity: 'pub', name: 'Café Wiener' }, 'brownBar'],
    [{ amenity: 'bar', name: 'Cocktail Lounge X' }, null],
    [{ amenity: 'cafe', name: 'Café Brel' }, 'brownBar'],
    [{ shop: 'bicycle', name: 'iBike', 'service:bicycle:rental': 'yes' }, 'bike'],
    [{ amenity: 'brothel' }, 'redLight'],
    [{ amenity: 'brothel', name: 'Boysclub 21' }, null],
    [{ amenity: 'fast_food', cuisine: 'kebab', name: 'Durum Doner Center' }, 'doner'],
    [{ amenity: 'restaurant', cuisine: 'surinamese', name: 'Seth takeout' }, 'toko'],
    [{ amenity: 'restaurant', name: 'Toko Restu' }, 'toko'],
    [{ shop: 'butcher', name: 'Slagerij ten Wolde' }, 'butcher'],
    [{ shop: 'greengrocer' }, 'greengrocer'],
    [{ shop: 'bakery', name: 'Bakkerij Kara Firin' }, 'turkishBakery'],
    [{ shop: 'bakery', name: 'Bakkerij Jan' }, 'bakery'],
    [{ shop: 'nuts', name: 'Notenbar Pijp' }, 'nuts'],
    [{ shop: 'cheese', name: 'Kaasland' }, 'cheese'],
    [{ shop: 'confectionery', name: 'Van Wonderen Stroopwafels' }, 'waffle'],
    [{ amenity: 'restaurant', cuisine: 'pancake' }, 'pancake'],
    [{ shop: 'gift', name: 'Amsterdam is My Style' }, 'souvenir'],
    [{ shop: 'books', name: 'Athenaeum Boekhandel' }, 'books'],
    [{ shop: 'mobile_phone' }, 'phone'],
    [{ amenity: 'fast_food', name: 'Pizzeria Ria' }, null],
    [{ shop: 'clothes', name: 'Zara' }, null],
  ];
  for (const [tags, want] of cases) assert.equal(templateForTags(tags), want, JSON.stringify(tags));
});

test('sign words fold to the block alphabet', () => {
  assert.equal(signWord('Café Wiener'), 'WIENER');
  assert.equal(signWord("Cuckoo's Nest"), 'CUCKOO S NEST');
  assert.equal(signWord('Coffeeshop 420'), '420');
  assert.ok(signWord('A very long business name indeed').length <= 14);
  // Round 3b: the trade gives way to the own name (Utrechtsestraat 61 drew 'BAKKERIJ', cut at the pand edge).
  assert.equal(signWord('Bakkerij Verhagen'), 'VERHAGEN');
  assert.equal(signWord('Keurslagerij Pouw'), 'POUW');
  assert.equal(signWord('Bakkerij'), 'BAKKERIJ');
  assert.equal(signWord('Fiets en Meer'), 'FIETS EN MEER');
  assert.equal(signWord('Wonder Bar One'), 'WONDER BAR ONE');
  assert.equal(signText('BAKKERIJ BASAK'), 'BASAK');
});

test('round 3c lettering: one textured bold-sans quad per letter, never wider than its fascia, legible at 72 deg from 12 m, else a plain board', () => {
  // The stem of the smallest letter (0.35 m quad) is 5 cm: 2.6 css px at the acceptance lens, a filtered texture stroke.
  assert.ok(strokePx(MIN_LETTER_H * LETTER_STEM) >= 2.5, `${strokePx(MIN_LETTER_H * LETTER_STEM)} px`);
  const names = ['VERHAGEN', 'POUW', 'KOEKEMANNETJE', 'CUCKOO S NEST', 'VAN DER LINDE', 'A', 'J J WESSELMAN', '420', 'TASHI DELEG'];
  for (const name of names) for (let avail = 0.2; avail <= 14; avail += 0.15) {
    const fit = fitWord(name, avail, MAX_LETTER_H);
    if (!fit) { assert.ok(glyphLayout(name.split(' ')[0]).width * MIN_LETTER_H > avail - 1e-6, `${name} @${avail}: a board though the first word fits`); continue; }
    assert.ok(name.startsWith(fit.text), `${name}: ${fit.text} is a leading run of whole words`);
    assert.ok(fit.heightM >= MIN_LETTER_H - 1e-9 && fit.heightM <= MAX_LETTER_H + 1e-9, `${name} @${avail}: ${fit.heightM} m letters`);
    assert.ok(fit.widthM <= avail + 1e-9, `${name} @${avail}: ${fit.widthM} m of letters on ${avail} m`);
  }
  // Every glyph quad's uv lies in the lettering cell, and letters advance left to right.
  const cell = glyphCellBox(), { quads } = glyphLayout('TASHI DELEG 420');
  assert.equal(quads.length, 13);
  for (const [i, q] of quads.entries()) {
    assert.ok(q.rect[0] >= cell.x - 1e-9 && q.rect[2] <= cell.x + cell.w + 1e-9 && q.rect[1] >= 1 - (cell.y + cell.h) - 1e-9 && q.rect[3] <= 1 - cell.y + 1e-9, q.ch);
    if (i) assert.ok(q.a0 >= quads[i - 1].a1 - 1e-9);
  }
  // Every template front: letters (layer 99) only with the layer, inside the fascia, letter colour over board colour.
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
  for (const t of RETAIL_TEMPLATES) for (const L of [2.2, 3.4, 5, 9]) {
    const look = TEMPLATE_LOOKS[t];
    const named = retailFrontTris({ template: t, seed: 'x', word: 'KOEKEMANNETJE', letters: 99 }, e, 0.3, 0.3 + L, 0, 3.6).filter(tri => tri.layer === 99);
    assert.equal(retailFrontTris({ template: t, seed: 'x', word: 'KOEKEMANNETJE' }, e, 0.3, 0.3 + L, 0, 3.6).filter(tri => tri.layer === 99).length, 0);
    for (const tri of named) {
      assert.equal(tri.hex, look.letters); assert.equal(tri.accentHex, look.fascia);
      for (const [x] of tri.p) assert.ok(x >= 0.5 - 1e-6 && x <= 0.1 + L + 1e-6, `${t} on ${L} m: a letter at ${x}`);
    }
  }
  // TASHI DELEG (Utrechtsestraat, the round 3b dotted board): on its 4.6 m board it letters whole.
  assert.equal(fitWord('TASHI DELEG', 4.6 - 0.4 - 0.28, MAX_LETTER_H)?.text, 'TASHI DELEG');
});

test('every template builds a front on its wall, within the plot line rules', () => {
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
  for (const t of RETAIL_TEMPLATES) {
    const tris = retailFrontTris({ template: t, word: 'TEST', seed: 'x' }, e, 0.3, 6.3, 0, 3.6);
    const door = retailDoor({ template: t, seed: 'x' }, 0.3, 6.3);
    assert.ok(tris.length > 10, t);
    for (const tri of tris) for (const [x, y, z] of tri.p) {
      assert.ok(x >= 0.2 && x <= 6.4, `${t}: along ${x}`);
      // Out from the wall (y = -outward): the fascia 0.12 m, an awning or pavement goods at most 1.1 m; into it only
      // inside the door's recess.
      const inDoor = !!door && x >= door.a0 - 1e-6 && x <= door.a1 + 1e-6;
      assert.ok(-y >= (inDoor ? -door.depthM - 1e-6 : -0.01) && -y <= 1.11, `${t}: out ${-y}`);
      assert.ok(z >= 0 && z <= 4.6, `${t}: up ${z}`);
    }
    assert.equal(retailFrontTris({ template: t, seed: 'x' }, e, 0, 1, 0, 3.6).length, 0);
  }
  assert.ok(FRONT.maxSpanM <= 14);
});

test('the template extract stamps only once installed', () => {
  const f: { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown } = { type: 'Feature', properties: { id: 'NL.IMBAG.Pand.1' }, geometry: null };
  setShopfronts(null); setShopTemplates(null);
  assert.equal(decorateShopfront(f), f);
  setShopTemplates({ version: 1, templates: ['ah'], buildings: { 'NL.IMBAG.Pand.1': [0, 4.9, 52.37] } });
  assert.deepEqual(decorateShopfront(f).properties.shopTemplate, ['ah', 4.9, 52.37]);
  setShopTemplates(null);
  assert.equal(decorateShopfront(f), f);
});

function paintCalls(v: BayVariant): string[] {
  const calls: string[] = [];
  const grad = () => ({ addColorStop: (...a: unknown[]) => calls.push(`stop${JSON.stringify(a)}`) });
  const ctx = new Proxy({ createLinearGradient: grad, createRadialGradient: grad }, {
    get(target, key) { if (key in target) return target[key as keyof typeof target]; return (...a: unknown[]) => calls.push(`${String(key)}${JSON.stringify(a)}`); },
    set(_t, key, value) { calls.push(`${String(key)}=${String(value)}`); return true; },
  });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) } as unknown as Document;
  try { bayTextures(v, {} as CanvasImageSource, 'photo'); } finally { globalThis.document = previous; }
  return calls;
}

test('shop cells: the pui with the flag on (no props), unchanged with it off', () => {
  // shopBar is held (RETAIL_HELD_KINDS, round n): it keeps the flag-off brown-café cell, tested in brownCafe.test.ts.
  const kinds = ['groundShop', 'shopCafe', 'shopWindow', 'shopDeli', 'shopFlorist', 'shopBike'] as const;
  for (const kind of kinds) {
    const v: BayVariant = { archetype: 'canal', kind, windows: 2, shape: 'rect', shutters: false, paintedFrames: false };
    g.__canalRecallRetailGround = false;
    const off = paintCalls({ ...v });
    g.__canalRecallRetailGround = true;
    const on = paintCalls({ ...v, windows: 3 });
    g.__canalRecallRetailGround = false;
    const offAgain = paintCalls({ ...v, windows: 1 });
    assert.ok(!on.some(c => c.startsWith('arc') || c.startsWith('ellipse')), `${kind}: no scallops, tables, flowers or wheels`);
    // Round 2: dark warm glass (no blue-grey sky fill), and no cream panel or amber fill in a brown bar.
    assert.ok(!on.some(c => /#7f939c|#3c474c|#efe3c8|#c47a2a/.test(c)), `${kind}: dark warm glass`);
    assert.notDeepEqual(on, off, kind);
    // The off painting does not depend on the flag having been on in between (cache keys differ).
    assert.deepEqual(offAgain.filter(c => !c.startsWith('width') && !c.startsWith('height')), off.filter(c => !c.startsWith('width') && !c.startsWith('height')), kind);
  }
  delete g.__canalRecallRetailGround;
});

test('the census centre polygon holds the Dam and not Sloterdijk', () => {
  assert.ok(insideCentre(4.8926, 52.3731));
  assert.ok(!insideCentre(4.838, 52.389));
});

test('looks: every template has one', () => {
  for (const t of RETAIL_TEMPLATES) assert.ok(TEMPLATE_LOOKS[t], t);
});

const wall = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
const outOf = (p: number[]) => p[0] * wall.nx + p[1] * wall.ny;

test('round 3 doors: one door per front, always in a recess at an end inside the post; a traced door where traced', () => {
  const untraced = retailFrontTris({ template: 'doner', seed: 'x' }, wall, 0, 6, 0, 3.4);
  const span = retailDoor({ template: 'doner', seed: 'x' }, 0, 6)!;
  assert.ok(span && span.depthM === FRONT.recessM, 'recessed by default');
  assert.ok(Math.abs(span.a0 - FRONT.postM) < 1e-9 || Math.abs(span.a1 - (6 - FRONT.postM)) < 1e-9, 'at an end, inside the post');
  const back = untraced.filter(t => t.p.some(p => outOf(p) < -0.01));
  assert.ok(back.length >= 10 && back.every(t => t.p.every(p => p[0] >= span.a0 - 1e-6 && p[0] <= span.a1 + 1e-6)), 'the recess only inside the door span');
  assert.ok(untraced.some(t => t.hex === glassTone('#4a4642', 0.6)), 'a glazed door leaf');
  assert.equal(retailDoor({ template: 'redLight', seed: 'x' }, 0, 6), null, 'window rows have no door');
  const recessed = retailFrontTris({ template: 'doner', seed: 'x', door: { a0: 2.5, a1: 3.5, depthM: 0.5 } }, wall, 0, 6, 0, 3.4);
  const inside = recessed.filter(t => t.p.some(p => outOf(p) < -0.01));
  assert.ok(inside.length >= 10, 'reveals, soffit, floor and the door at the back');
  assert.ok(inside.every(t => t.p.every(p => p[0] >= 2.5 - 1e-6 && p[0] <= 3.5 + 1e-6 && outOf(p) >= -0.5 - 1e-6)), 'inside the cut only');
  // No window content in front of the door.
  assert.ok(!recessed.some(t => t.p.every(p => outOf(p) > 0.015 && outOf(p) < 0.03 && p[0] > 2.55 && p[0] < 3.45 && p[2] > FRONT.riserM && p[2] < 1.5)));
});

test('brown bar: dark timber, no lit amber fill, no cream panel', () => {
  const tris = retailFrontTris({ template: 'brownBar', word: 'PIJP', seed: 'b' }, wall, 0, 8, 0, 3.4);
  assert.ok(!tris.some(t => /#d58a2e|#efe6d2/.test(t.hex)));
  const lit = tris.filter(t => t.lit).reduce((a, t) => a + Math.abs((t.p[1][0] - t.p[0][0]) * (t.p[2][2] - t.p[0][2]) - (t.p[2][0] - t.p[0][0]) * (t.p[1][2] - t.p[0][2])) / 2, 0);
  assert.ok(lit < 0.5, `warm glints only (${lit.toFixed(2)} m2 lit)`);
});

test('round 2 glass tone: content behind the glass darker and warmer than painted', () => {
  const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255); };
  for (const h of ['#f1efe8', '#d8452f', '#2f6fb0']) assert.ok(lum(glassTone(h)) < lum(h), h);
});

test('logos: Commons provenance with a free licence for every atlas entry; rects in their cells; a byte layer', () => {
  const prov = JSON.parse(fs.readFileSync(new URL('../../data/retail-ground/logos/provenance.json', import.meta.url), 'utf8'));
  const atlas = JSON.parse(fs.readFileSync(new URL('../../data/retail-ground/retail-logos.json', import.meta.url), 'utf8'));
  for (const l of LOGOS) {
    const p = prov.logos[l.key];
    assert.ok(p && /commons\.wikimedia\.org/.test(p.page) && /public domain|cc0|cc by/i.test(p.licence), `${l.key}: provenance`);
    assert.ok(l.aspect <= p.width / p.height * 1.8 && l.aspect >= p.width / p.height * 0.9, `${l.key}: aspect near the render's`);
    assert.ok(Math.abs(l.aspect - atlas.logos.find((q: { key: string }) => q.key === l.key).aspect) < 0.01, `${l.key}: aspect as the atlas holds it`);
    const r = logoFor(l.key)!;
    assert.ok(r.rect.every(v => v >= 0 && v <= 1) && r.rect[2] > r.rect[0] && r.rect[3] > r.rect[1]);
  }
  assert.ok(LOGOS.length <= LOGO_GRID.cols * LOGO_GRID.rows);
  assert.equal(logoFor('doner'), null);
  assert.equal(retailLogoLayer('procedural'), null);
  assert.ok(retailLogoLayer('photo')! <= 255);
  const tris = retailFrontTris({ template: 'ah', seed: 'a', logo: { layer: 200, ...logoFor('ah')! } }, wall, 0, 8, 0, 3.4);
  const logo = tris.filter(t => t.layer === 200);
  assert.equal(logo.length, 2);
  assert.ok(logo.every(t => t.uv!.every(([u, v]) => u >= logoFor('ah')!.rect[0] - 1e-6 && u <= logoFor('ah')!.rect[2] + 1e-6 && v >= logoFor('ah')!.rect[1] - 1e-6 && v <= logoFor('ah')!.rect[3] + 1e-6)));
});

test('hosting regressions: Kinkerstraat bike shops on their street fronts, the BP station AH not on the car wash', () => {
  const fx = JSON.parse(fs.readFileSync(new URL('../../data/retail-ground/hosting-regressions.json', import.meta.url), 'utf8'));
  const want: Record<string, { pand: string; front: string }> = {
    2809217417: { pand: '0363100012156816', front: 'street' },
    2809219299: { pand: '0363100012061473', front: 'street' },
    5198582619: { pand: '0363100012239989', front: 'nearest' },
    // Round 5: Keurslagerij Pouw on the 15 m white shopfront next door (SPILL), not the 23 m2 unit its node falls in.
    10829630288: { pand: '0363100012165106', front: 'street' },
  };
  assert.equal(fx.cases.length, 4);
  for (const c of fx.cases) {
    const cands = c.candidates.map((k: { id: string; ring: [number, number][] }) => ({ id: k.id, ring: k.ring }));
    const read = (key: 'street' | 'open') => (cand: { id: string; ring: [number, number][] }, e: ReturnType<typeof ringEdges>[number]) => {
      const k = c.candidates.find((q: { id: string }) => q.id === cand.id);
      return k[key][ringEdges(cand.ring).findIndex(f => f.x0 === e.x0 && f.y0 === e.y0)];
    };
    const hit = hostOnFront(cands, 0, 0, id => c.candidates.find((q: { id: string }) => q.id === id)?.uses ?? undefined, read('street'), read('open'), true);
    assert.deepEqual(hit && { pand: hit.id, front: hit.front }, want[c.node], c.what);
  }
});

test('tobacco: sigarenwinkels from shop=tobacco, unbranded newsagents and tobacco kiosks; placards and a narrow door', () => {
  assert.equal(templateForTags({ shop: 'tobacco', name: 'Sigarenmagazijn Bom' }), 'tobacco');
  assert.equal(templateForTags({ shop: 'newsagent', name: 'Primera', brand: 'Primera' }), 'tobacco');
  assert.equal(templateForTags({ shop: 'newsagent', name: 'Cigo Mark\'s' }), 'tobacco');
  assert.equal(templateForTags({ shop: 'kiosk', name: 'Royal Tobacco' }), 'tobacco');
  assert.equal(templateForTags({ shop: 'newsagent', name: 'Relay' }), null);
  assert.equal(templateForTags({ shop: 'newsagent', name: 'Bestseller' }), 'bestseller');
  assert.equal(templateForTags({ shop: 'kiosk', name: 'Ramon\'s Coffee Kiosk' }), null);
  const tris = retailFrontTris({ template: 'tobacco', seed: 't' }, wall, 0, 6, 0, 3.4);
  const cards = new Set(tris.filter(t => t.lit && Math.abs(outOf(t.p[0])) < 0.05 && t.p[0][2] < 2.5).map(t => t.hex));
  assert.ok(cards.size >= 6, `cluttered placards (${cards.size} colours)`);
  const leaf = tris.find(t => t.hex === glassTone('#4a4642', 0.6))!;
  assert.ok(leaf.p.every(p => p[0] <= FRONT.postM + 0.8 + 1e-6 || p[0] >= 6 - FRONT.postM - 0.8 - 1e-6), 'a door 0.8 m wide');
});

// Lane retail-look-20261114 (David: shop ground floors "look very cheap and out of place"): the fronts on the retail-look
// sheet (scripts/retail-ground/look-fronts.json) are named regressions. Each pinned shop keeps its template, and every
// template front keeps the round-3 anatomy: a cornice cap over the fascia, end posts, a recessed door, glass that reflects
// the street over its upper part, and a triangle budget near round 2's.
const LOOK_PINS: Array<[string, string, string]> = [
  ['0363100012092013', 'ah', 'Albert Heijn, Kinkerstraat 89'],
  ['0363100012169187', 'ah', 'Albert Heijn, Westerstraat 79'],
  ['0363100012233666', 'hema', 'HEMA, Ferdinand Bolstraat 93A'],
  // Round 5: Pouw's front is the 15 m white shopfront next door (retailHosting.ts SPILL), not its 23 m2 node unit.
  ['0363100012165106', 'butcher', 'Keurslagerij Pouw, Haarlemmerdijk 95'],
  ['0363100012173480', 'books', 'De Kookboekhandel, Haarlemmerdijk 133'],
  ['0363100012178799', 'bakery', 'Bakkerij Verhagen, Utrechtsestraat 61'],
  ['0363100012152738', 'doner', 'Kebab House, Ferdinand Bolstraat 23'],
  ['0363100012177422', 'brownBar', "Cafe 't Papeneiland, Prinsengracht 2"],
];

test('retail look: the pinned shops keep their templates; the Kinkerstraat 98/104 shops draw the plain pui', () => {
  // The staged extract (the lane's, reviewed); the published copy follows it when the integrator publishes.
  const extract = JSON.parse(fs.readFileSync('data/retail-ground/shop-templates.json', 'utf8')) as { templates: string[]; buildings: Record<string, [number, ...unknown[]]> };
  for (const [pand, template, what] of LOOK_PINS) {
    const row = extract.buildings[`NL.IMBAG.Pand.${pand}`];
    assert.ok(row, `${what}: in the template extract`);
    assert.equal(extract.templates[row[0]], template, what);
  }
  for (const pand of ['0363100012158180', '0363100012159635']) assert.equal(extract.buildings[`NL.IMBAG.Pand.${pand}`], undefined, `${pand}: no template`);
});

test('retail look: every template front has a cornice cap, end posts, a recessed door and a reflecting glass', () => {
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 }, out = (p: number[]) => -p[1];
  const top = 3.6 - FRONT.fasciaGapM;
  let total = 0;
  for (const t of RETAIL_TEMPLATES) {
    const tris = retailFrontTris({ template: t, word: 'WINKEL', seed: 'x' }, e, 0, 9, 0, 3.6);
    total += tris.length;
    assert.ok(tris.some(tri => tri.p.every(p => p[2] >= top - 1e-6) && tri.p.some(p => out(p) >= FRONT.capOutM - 1e-6)), `${t}: cornice cap`);
    if (TEMPLATE_LOOKS[t].content === 'redGlow') continue;
    assert.ok(tris.some(tri => tri.p.every(p => p[0] <= FRONT.postM + 1e-6) && tri.p.some(p => out(p) >= FRONT.frameOutM - 1e-6)), `${t}: end post`);
    assert.ok(tris.some(tri => tri.p.some(p => out(p) <= -FRONT.recessM + 1e-6)), `${t}: recessed door`);
    assert.ok(tris.some(tri => /^#7d878e$/i.test(tri.hex)), `${t}: the street in the glass`);
  }
  // Round 2 drew 13,020 triangles for the 35 templates on a 9 m front; round 3 stays within 20 % of it.
  assert.ok(total <= 13_020 * 1.2, `triangles ${total}`);
});

test('round 3b hosting: HEMA Ferdinand Bolstraat 93A spans the steps of its street wall, not one 4 m piece', () => {
  // Pand 0363100012233666, metres east/north of the HEMA node (OSM 249327305); the street wall steps by 0.4-0.8 m jogs.
  const ring: [number, number][] = [[30.4, 19.5], [-6.9, 10.6], [-5.8, 5.6], [-5.1, 5.7], [-4.6, 3.6], [-3.9, 3.8], [-2.9, -0.4], [-3.3, -0.6], [-3.1, -1.4],
    [-2.7, -1.3], [-1.8, -5.7], [-3.2, -6.0], [-1.1, -15.6], [37.2, -6.8], [30.4, 19.5]];
  const edges = ringEdges(ring), best = edges.slice().sort((p, q) => segDist(p.x0, p.y0, p.x1, p.y1, 0, 0) - segDist(q.x0, q.y0, q.x1, q.y1, 0, 0))[0];
  assert.ok(best.len < 5, `the nearest piece is ${best.len} m`);
  const run = steppedRun(best, edges);
  // 11.9 m of pieces within 0.9 m of its line (the 5.1 m and 9.8 m pieces 1.3-1.6 m out stay their own walls).
  assert.ok(run.len > 11, `run ${run.len} m`);
  assert.ok(run.parts.length >= 4 && run.parts.every(p => p.backM >= 0 && p.backM <= 0.9 + 1e-9), JSON.stringify(run.parts.map(p => p.backM)));
  // A plain rectangle's wall stays itself.
  const box = ringEdges([[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]), r = steppedRun(box[0], box);
  assert.equal(r.len, 10); assert.equal(r.parts.length, 1);
});

test('round 3c cost: panes are one interior quad of the shop cell; every template front within 140 tris on 6 m but the props', () => {
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 }, rect = [0.08, 0.155, 0.92, 0.56] as const;
  for (const t of RETAIL_TEMPLATES) {
    const tris = retailFrontTris({ template: t, seed: 'x', word: 'VERHAGEN', letters: 99, interior: { layer: 7, rect } }, e, 0.3, 6.3, 0, 3.6);
    const props = ['bike', 'greengrocer', 'florist', 'tobacco', 'febo', 'smartshop', 'brownBar', 'redLight'].includes(t);
    if (!props) assert.ok(tris.length <= 140, `${t}: ${tris.length} tris`);
    // Round 6: the bloemist's pavement display (two tables of pots, buckets before them) stays within 320.
    if (t === 'florist') assert.ok(tris.length <= 320, `${t}: ${tris.length} tris`);
    // Lane retail-real: tattoo and the snackbar exist only under ?retailReal (REAL_ONLY_TEMPLATES), where panes show goods.
    if (!props && !REAL_ONLY_TEMPLATES.includes(t)) assert.ok(tris.some(tri => tri.layer === 7) && !tris.some(tri => /^#7d878e$/i.test(tri.hex)), `${t}: the shop cell's interior, not flat goods`);
  }
});


const labOf = (hex: string): Lab => oklab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
const band = (parts: [string, number][]): Lab[] => parts.flatMap(([hex, n]) => Array.from({ length: n }, () => labOf(hex)));

test('round 4 pui paint: a pale frame share reads pale, a coloured one colour, glass and dark paint dark, a muddle nothing', () => {
  // Pouw (Westerstraat, 2025 pano): white frames in shade among dark glass.
  assert.equal(paintOf(clusters(band([['#a8b4b8', 30], ['#1e1c1c', 50], ['#4a4644', 20]])))?.cls, 'pale');
  assert.equal(paintOf(clusters(band([['#2e5a3c', 30], ['#1e1c1c', 60], ['#3a3634', 10]])))?.cls, 'colour');
  assert.equal(paintOf(clusters(band([['#262221', 60], ['#1a1818', 30], ['#504a46', 10]])))?.cls, 'dark');
  // A mid-grey wall with a bit of everything states nothing.
  assert.equal(paintOf(clusters(band([['#7a7672', 40], ['#8a8682', 40], ['#1e1c1c', 20]]))), null);
  assert.equal(paintOf([]), null);
});

test('round 4 pui paint: a pale reading is drawn as a lit white or cream, a dark one as read', () => {
  const pale = labOf(drawnPaint('pale', '#9fafb4'));
  assert.ok(pale[0] > 0.9 && Math.hypot(pale[1], pale[2]) <= 0.026, `pale ${drawnPaint('pale', '#9fafb4')}`);
  assert.ok(Math.abs(labOf(drawnPaint('dark', '#262221'))[0] - 0.36) < 0.01, 'a dark reading is drawn as dark paint, not glass-black');
  assert.equal(drawnPaint('dark', '#5a5048'), '#5a5048');
  assert.ok(labOf(drawnPaint('colour', '#2e5a3c'))[0] > labOf('#2e5a3c')[0]);
  assert.equal(labHex(labOf('#336699')), '#336699');
});

test('round 4 pui paint: the extract stamps the measured paint on template and plain shop pands, only once installed', () => {
  const f = (id: string): { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown } => ({ type: 'Feature', properties: { id }, geometry: null });
  setShopfronts(null);
  setShopTemplates({ version: 1, templates: ['ah'], buildings: { 'NL.IMBAG.Pand.1': [0, 4.9, 52.37] }, paint: { 'NL.IMBAG.Pand.1': '#e8ecee', 'NL.IMBAG.Pand.2': '#262221', 'NL.IMBAG.Pand.3': 'white' }, prior: { 'NL.IMBAG.Pand.4': '#4a3f38', 'NL.IMBAG.Pand.2': '#ffffff' } });
  const a = decorateShopfront(f('NL.IMBAG.Pand.1')).properties;
  assert.deepEqual([a.shopTemplate, a.puiPaint], [['ah', 4.9, 52.37], '#e8ecee']);
  const b = decorateShopfront(f('NL.IMBAG.Pand.2')).properties;
  assert.deepEqual([b.shopTemplate, b.puiPaint], [undefined, '#262221']);
  assert.equal(decorateShopfront(f('NL.IMBAG.Pand.4')).properties.puiPaint, '#4a3f38', 'a street prior stamps an unmeasured shop');
  const plain = f('NL.IMBAG.Pand.3');
  assert.equal(decorateShopfront(plain), plain);
  setShopTemplates(null);
  const off = f('NL.IMBAG.Pand.2');
  assert.equal(decorateShopfront(off), off);
});

test('round 4 pui paint: a measured paint frames the template front; absent, the template frame', () => {
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 6 } as const;
  const hexes = (paint?: string) => new Set(retailFrontTris({ template: 'butcher', seed: 'x', ...(paint ? { paint } : {}) }, e, 0, 6, 0, 3.4).map(t => t.hex));
  assert.ok(hexes('#e8ecee').has('#e8ecee'));
  assert.ok(!hexes().has('#e8ecee'));
});

test('round 5b street prior: a tight pale or coloured majority on a street, never a dark one', () => {
  const r = (street: string, cls: 'pale' | 'colour' | 'dark', paint: string) => ({ street, cls, paint });
  const p = streetPriors([
    r('Dark', 'dark', '#3a3430'), r('Dark', 'dark', '#4a4440'), r('Dark', 'dark', '#5a5450'), r('Dark', 'dark', '#5a5450'),
    r('White', 'pale', '#eeeeee'), r('White', 'pale', '#f0f0ec'), r('White', 'pale', '#e8eaec'), r('White', 'dark', '#3a3430'),
    r('Loose', 'pale', '#eeeeee'), r('Loose', 'pale', '#d8c08a'), r('Loose', 'pale', '#e8eaec'),
    r('Mixed', 'pale', '#eeeeee'), r('Mixed', 'pale', '#f0f0f0'), r('Mixed', 'colour', '#2e5a3c'), r('Mixed', 'dark', '#3a3430'),
    r('Few', 'pale', '#eeeeee'), r('Few', 'pale', '#f0f0f0'), r('', 'pale', '#eeeeee')]);
  assert.equal(p.get('Dark'), undefined, 'a dark majority is glass, not a paint: no prior');
  assert.deepEqual(p.get('White'), { cls: 'pale', paint: '#eeeeee', n: 4, share: 0.75 });
  assert.equal(p.get('Loose'), undefined, 'paints too far apart');
  assert.equal(p.get('Mixed'), undefined, 'no 75 % majority');
  assert.equal(p.get('Few'), undefined, `fewer than ${PRIOR.minReads} reads`);
  assert.equal(p.size, 1);
});

test('round 5b vehicles: a flat panel across the band or an extreme sideways smear reads as a vehicle; mullions do not', () => {
  const w = 60, h = 42, band = (f: (x: number, y: number) => number) => Array.from({ length: w * h }, (_, i) => f(i % w, Math.floor(i / w)));
  // A shopfront: glass with goods behind it between pale mullions every 12 px.
  assert.equal(vehicleBand(band((x, y) => (x % 12 < 2 ? 200 : 40) + ((x * 37 + y * 91) % 31)), w, h).vehicle, null);
  // A van's side: one flat panel.
  assert.equal(vehicleBand(band(() => 180), w, h).vehicle, 'panel');
  // A passing tram: horizontal streaks, nothing vertical.
  const smear = vehicleBand(band((x, y) => (y % 5 < 2 ? 210 : 60) + ((x + y) % 3)), w, h);
  assert.ok(smear.aniso < VEHICLE_GATE.minAniso);
  assert.equal(smear.vehicle, 'smear');
});

test('round 5b dark readings: replace a pale guess, keep a darker one; pale and coloured readings always replace', () => {
  assert.equal(paintOverGuess('#ece6e0', '#4a3f38', true), '#4a3f38');
  for (const guess of ['#2a4a38', '#1f2f4f', '#3a2a1f']) assert.equal(paintOverGuess(guess, '#4a3f38', true), guess);
  assert.equal(paintOverGuess('#2a4a38', '#eef0f0', false), '#eef0f0');
  // The stamp carries the dark flag.
  setShopfronts(null);
  setShopTemplates({ version: 1, templates: [], buildings: {}, paint: { 'NL.IMBAG.Pand.7': '#4a3f38', 'NL.IMBAG.Pand.8': '#eef0f0' }, dark: ['NL.IMBAG.Pand.7'] });
  const f = (id: string) => decorateShopfront({ type: 'Feature', properties: { id }, geometry: null } as { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }).properties;
  assert.equal(f('NL.IMBAG.Pand.7').puiDark, 1);
  assert.equal(f('NL.IMBAG.Pand.8').puiDark, undefined);
  setShopTemplates(null);
});

test('round 5b board: a measured paint paints the board of a front with no chain logo, letters in contrast', () => {
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 6 } as const;
  const tris = retailFrontTris({ template: 'butcher', seed: 'x', paint: '#e8ecee', letters: 99 }, e, 0, 6, 0, 3.4);
  assert.ok(!tris.some(t => t.hex === TEMPLATE_LOOKS.butcher.fascia), 'no red board');
  assert.ok(tris.filter(t => t.layer === 99).every(t => t.hex === '#2b2724'), 'dark letters on a pale board');
  const plain = retailFrontTris({ template: 'butcher', seed: 'x' }, e, 0, 6, 0, 3.4);
  assert.ok(plain.some(t => t.hex === TEMPLATE_LOOKS.butcher.fascia));
});

test('round 6: bike shop classes from OSM tags (the panorama spot check of 2026-11-15)', async () => {
  const { bikeShopClass, bikeCode, bikeFromCode } = await import('./retailBikes.js');
  const cases: Array<[Record<string, string>, string, string?]> = [
    [{ shop: 'bicycle', name: 'Yellow Bike', 'service:bicycle:rental': 'yes' }, 'rental', '#f2c21b'],
    [{ shop: 'bicycle', name: 'MacBike' }, 'rental', '#c8262d'],
    [{ amenity: 'bicycle_rental', name: 'Bike City' }, 'rental'],
    // SAM Tweewielen Service & Bike Rental, Karel Klinkenbergstraat 10: no rental row in the photo; a repair shop first.
    [{ shop: 'bicycle', name: 'SAM Tweewielen Service & Bike Rental' }, 'used'],
    [{ shop: 'bicycle', name: 'Gregario Cycling Services' }, 'used'],
    [{ shop: 'bicycle', name: 'Veloretti' }, 'premium'],
    [{ shop: 'bicycle', name: 'Maats Cycling Culture', 'service:bicycle:retail': 'yes' }, 'premium'],
    [{ shop: 'bicycle', name: 'Fietsen Veloretti', second_hand: 'yes' }, 'used'],
    [{ shop: 'bicycle', name: 'Rijwielhandel De Pijp' }, 'used'],
    [{ shop: 'bicycle', name: 'Mo', 'service:bicycle:retail': 'yes', 'service:bicycle:repair': 'yes' }, 'used'],
    [{ shop: 'bicycle' }, 'used'],
  ];
  for (const [tags, cls, hex] of cases) {
    const c = bikeShopClass(tags);
    assert.equal(c.cls, cls, tags.name);
    assert.equal(c.fleetHex, hex, tags.name);
    assert.deepEqual(bikeFromCode(bikeCode(c)), hex ? { cls, fleetHex: hex } : { cls });
  }
  assert.equal(bikeFromCode('x'), null);
  assert.equal(bikeFromCode(undefined), null);
});

test('round 6: bikes stand on the pavement beside the door, side-on, and cost what the receipt says', async () => {
  const { bikeQuads } = await import('./retailBikes.js');
  assert.equal(bikeQuads().length, 29);
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
  const off = retailFrontTris({ template: 'bike', seed: 'pand-1' }, e, 0.3, 6.3, 0, 3.6);
  for (const cls of ['used', 'premium', 'rental'] as const) {
    const input = { template: 'bike' as const, seed: 'pand-1', bike: { cls, ...(cls === 'rental' ? { fleetHex: '#f2c21b' } : {}) } };
    const on = retailFrontTris(input, e, 0.3, 6.3, 0, 3.6), door = retailDoor(input, 0.3, 6.3)!;
    const bikes = Math.round((on.length - off.length + 8 * 2) / 58); // the template's 4 pavement disc pairs give way (4 x 4 tris)
    assert.ok(bikes >= 4 && bikes <= 12, `${cls}: ${bikes} bikes`);
    for (const t of on) for (const [x, y, z] of t.p) {
      assert.ok(-y <= 1.11 && z <= 4.6 && x >= 0.2 && x <= 6.4, `${cls}: ${x} ${y} ${z}`);
    }
    // Outside bikes (more than 0.25 m out) keep clear of the door and of the road side of the pavement.
    const outside = on.filter(t => t.p.every(p => -p[1] > 0.25 && p[2] < 1.2));
    assert.ok(outside.length >= 2 * 58, `${cls}: ${outside.length} outside tris`);
    for (const t of outside) for (const [x, y] of t.p) {
      assert.ok(-y <= 0.7, `${cls}: bike ${-y} m out`);
      assert.ok(x <= door.a0 - 0.1 || x >= door.a1 + 0.1, `${cls}: bike over the door at ${x}`);
    }
    if (cls === 'rental') assert.ok(outside.some(t => t.hex === '#f2c21b'));
  }
});

test("round 6b: the second logo page (McDonald's, Gall & Gall, Kruidvat), & and ' in the glyph cell", async () => {
  const { LOGOS_2 } = await import('./retailLogos.js');
  for (const { key } of LOGOS_2) {
    const l = logoFor(key)!;
    assert.equal(l.page, 1, key);
    assert.ok(l.rect[0] >= 0 && l.rect[2] <= 1 && l.rect[1] >= 0 && l.rect[3] <= 1 && l.rect[2] > l.rect[0], key);
  }
  assert.equal(logoFor('ah')!.page, 0);
  assert.equal(glyphLayout('GALL & GALL').quads.map(q => q.ch).join(''), 'GALL&GALL');
  assert.equal(glyphLayout("McDONALD'S").quads.map(q => q.ch).join(''), "MCDONALD'S");
  // Every glyph's rect stays inside the lettering cell.
  const g = glyphCellBox();
  for (const q of glyphLayout("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&'").quads) assert.ok(q.rect[0] >= g.x - 1e-9 && q.rect[2] <= g.x + g.w + 1e-9, q.ch);
  assert.equal(templateForTags({ shop: 'chemist', name: 'Kruidvat', brand: 'Kruidvat' }), 'kruidvat');
  assert.equal(templateForTags({ shop: 'alcohol', name: 'Gall & Gall' }), 'gallgall');
  assert.equal(templateForTags({ amenity: 'fast_food', name: "McDonald's" }), 'mcdonalds');
});

test('round 7: a measured awning draws in its colour, replaces the template awning, and is nothing when absent', () => {
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
  // Optician / Unique Eyefashion (pair 17 of round 6): black awnings over a template with none.
  const plain = retailFrontTris({ template: 'hairdresser', seed: 'p' }, e, 0.3, 6.3, 0, 3.6);
  const black = retailFrontTris({ template: 'hairdresser', seed: 'p', awning: '#1f1f21' }, e, 0.3, 6.3, 0, 3.6);
  assert.ok(black.length > plain.length && black.length - plain.length <= 12, `${black.length - plain.length} awning tris`);
  assert.ok(black.some(t => t.hex === '#1f1f21'));
  // A template's own awning (greengrocer green) takes the measured colour, at no extra cost.
  const green = retailFrontTris({ template: 'greengrocer', seed: 'p' }, e, 0.3, 6.3, 0, 3.6);
  const measured = retailFrontTris({ template: 'greengrocer', seed: 'p', awning: '#1f1f21' }, e, 0.3, 6.3, 0, 3.6);
  assert.equal(measured.length, green.length);
  const g = (ts: typeof green) => ts.filter(t => t.hex === TEMPLATE_LOOKS.greengrocer.awning).length; // the fascia shares the green
  assert.ok(g(measured) < g(green) && measured.some(t => t.hex === '#1f1f21'));
});

// Named regression, round n 2026-11-15: café Hendrix (pand 0363100012132271, feedback 7be6c55a) drew as an opaque dark
// box with lit dots under the brownBar template; pubs and brown cafés keep the glazed café cell until a blind win.
test('brownBar is held: its cell keeps the flag-off painter', async () => {
  const { RETAIL_HELD, RETAIL_HELD_KINDS } = await import('./retailTemplates.js');
  assert.ok(RETAIL_HELD.includes('brownBar'));
  assert.ok(RETAIL_HELD_KINDS.includes('shopBar'));
});

test('round 5 (retail-real) PARTY (off by default): a node in a house on the party wall of a shop goes to the shop; not with spill off, not 1.5 m in', () => {
  // Two 5 m wide, 10 m deep pands on a street along y = 0 (street to the south); the house is x 0..5, the shop x 5..10.
  const house = { id: 'house', ring: [[0, 0], [5, 0], [5, 10], [0, 10], [0, 0]] as [number, number][] };
  const shop = { id: 'shop', ring: [[5, 0], [10, 0], [10, 10], [5, 10], [5, 0]] as [number, number][] };
  const uses = (id: string) => id === 'shop' ? { vbos: 1, area: { winkelfunctie: 60 } } : undefined;
  const street = (_c: unknown, e: { y0: number; y1: number }) => e.y0 === 0 && e.y1 === 0;
  assert.equal(hostOnFront([house, shop], 4.4, 2, uses, street, () => true, true, true)?.id, 'shop');
  assert.equal(hostOnFront([house, shop], 4.4, 2, uses, street, () => true, true)?.id, 'house');
  assert.equal(hostOnFront([house, shop], 4.4, 2, uses, street, () => true, false, true)?.id, 'house');
  assert.equal(hostOnFront([house, shop], 5 - PARTY.nodeM - 0.5, 2, uses, street, () => true, true, true)?.id, 'house');
  // A house with shop space of its own keeps the node.
  assert.equal(hostOnFront([house, shop], 4.4, 2, id => ({ vbos: 1, area: { winkelfunctie: id === 'shop' ? 60 : 30 } }), street, () => true, true)?.id, 'house');
});
