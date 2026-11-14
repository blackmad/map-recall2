// Lane retail-ground (2026-11-14): the template classifier, the front geometry, the measured pui and the flag's
// byte-identity when off. `node --import tsx --test src/canalRecall/retailGround.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RETAIL_TEMPLATES, TEMPLATE_LOOKS, retailGroundEnabled, signText, signWord, templateForTags } from './retailTemplates.js';
import { FRONT, MIN_LETTER_M, fitWord, glassTone, retailDoor, retailFrontTris, strokePx } from './retailFront.js';
import { wordRuns } from './blockLetters.js';
import { LOGOS, LOGO_GRID, logoFor, retailLogoLayer } from './retailLogos.js';
import { hostOnFront, ringEdges, segDist, steppedRun } from './retailHosting.js';
import fs from 'node:fs';
import { decorateShopfront, setShopfronts, setShopTemplates } from './shopfronts.js';
import { bayTextures, type BayVariant } from './bayTextures.js';
import { insideCentre } from './retailArea.js';

const g = globalThis as { __canalRecallRetailGround?: boolean };

test('flag: off by default, URL beats env', () => {
  assert.equal(retailGroundEnabled(null, null), false);
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

test('round 3b lettering: no glyph run wider than its fascia, strokes legible at 72 deg from 12 m, else a plain board', () => {
  // A 6.5 cm stroke is 3.4 css px at the acceptance lens; 5-6 cm strokes broke into dotted glyphs.
  assert.ok(strokePx(MIN_LETTER_M) >= 3, `${strokePx(MIN_LETTER_M)} px`);
  const names = ['VERHAGEN', 'POUW', 'KOEKEMANNETJE', 'CUCKOO S NEST', 'VAN DER LINDE', 'A', 'J J WESSELMAN', '420'];
  for (const name of names) for (let avail = 0.2; avail <= 14; avail += 0.15) for (const maxCell of [0.065, 0.075, 0.1]) {
    const fit = fitWord(name, avail, maxCell);
    if (!fit) { assert.ok(wordRuns(name.split(' ')[0]).width * MIN_LETTER_M > avail - 1e-6, `${name} @${avail}: a board though the first word fits`); continue; }
    const { runs, width } = wordRuns(fit.text);
    assert.ok(name.startsWith(fit.text), `${name}: ${fit.text} is a leading run of whole words`);
    assert.ok(fit.cell >= MIN_LETTER_M - 1e-9 && fit.cell <= maxCell + 1e-9, `${name} @${avail}: cell ${fit.cell}`);
    assert.ok(width * fit.cell <= avail + 1e-9, `${name} @${avail}: ${width * fit.cell} m of letters on ${avail} m`);
    for (const r of runs) assert.ok(r.c1 <= width && r.c0 >= 0);
  }
  // Every template front: the lettering sits inside its fascia on walls from a door's width to a long shop.
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
  for (const t of RETAIL_TEMPLATES) for (const L of [2.2, 3.4, 5, 9]) {
    const plain = retailFrontTris({ template: t, seed: 'x' }, e, 0.3, 0.3 + L, 0, 3.6).length;
    const named = retailFrontTris({ template: t, seed: 'x', word: 'KOEKEMANNETJE' }, e, 0.3, 0.3 + L, 0, 3.6);
    for (const tri of named.slice(plain)) for (const [x] of tri.p) assert.ok(x >= 0.3 - 1e-6 && x <= 0.3 + L + 1e-6, `${t} on ${L} m: a letter at ${x}`);
  }
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
  const kinds = ['groundShop', 'shopCafe', 'shopWindow', 'shopBar', 'shopDeli', 'shopFlorist', 'shopBike'] as const;
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
  assert.ok(untraced.some(t => t.hex === '#b8b0a0'), 'a door handle');
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
  };
  assert.equal(fx.cases.length, 3);
  for (const c of fx.cases) {
    const cands = c.candidates.map((k: { id: string; ring: [number, number][] }) => ({ id: k.id, ring: k.ring }));
    const read = (key: 'street' | 'open') => (cand: { id: string; ring: [number, number][] }, e: ReturnType<typeof ringEdges>[number]) => {
      const k = c.candidates.find((q: { id: string }) => q.id === cand.id);
      return k[key][ringEdges(cand.ring).findIndex(f => f.x0 === e.x0 && f.y0 === e.y0)];
    };
    const hit = hostOnFront(cands, 0, 0, id => c.candidates.find((q: { id: string }) => q.id === id)?.uses ?? undefined, read('street'), read('open'));
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
  const handle = tris.find(t => t.hex === '#b8b0a0')!;
  assert.ok(handle.p.every(p => p[0] <= 0.8 + 1e-6 || p[0] >= 6 - 0.8 - 1e-6), 'a door 0.8 m wide');
});

// Lane retail-look-20261114 (David: shop ground floors "look very cheap and out of place"): the fronts on the retail-look
// sheet (scripts/retail-ground/look-fronts.json) are named regressions. Each pinned shop keeps its template, and every
// template front keeps the round-3 anatomy: a cornice cap over the fascia, end posts, a recessed door, glass that reflects
// the street over its upper part, and a triangle budget near round 2's.
const LOOK_PINS: Array<[string, string, string]> = [
  ['0363100012092013', 'ah', 'Albert Heijn, Kinkerstraat 89'],
  ['0363100012169187', 'ah', 'Albert Heijn, Westerstraat 79'],
  ['0363100012233666', 'hema', 'HEMA, Ferdinand Bolstraat 93A'],
  ['0363100012176699', 'butcher', 'Keurslagerij Pouw, Haarlemmerdijk 95'],
  ['0363100012173480', 'books', 'De Kookboekhandel, Haarlemmerdijk 133'],
  ['0363100012178799', 'bakery', 'Bakkerij Verhagen, Utrechtsestraat 61'],
  ['0363100012152738', 'doner', 'Kebab House, Ferdinand Bolstraat 23'],
  ['0363100012177422', 'brownBar', "Cafe 't Papeneiland, Prinsengracht 2"],
];

test('retail look: the pinned shops keep their templates; the Kinkerstraat 98/104 shops draw the plain pui', () => {
  const extract = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/shop-templates.json', 'utf8')) as { templates: string[]; buildings: Record<string, [number, ...unknown[]]> };
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
