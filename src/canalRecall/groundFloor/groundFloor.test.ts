// Lane ground-floor-20261116: the GroundFloor record, its merge, the photo-read schema, the extract flag and the inset
// renderer. `node --import tsx --test src/canalRecall/groundFloor/groundFloor.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { drawProblems, piersBetween, archRiseM, type GroundFloorDraw, type GroundFloorPart } from './types.js';
import { mergeGroundFloor, drawOf } from './merge.js';
import { readProblems, toGroundFloorPart, type GroundFloorRead } from './read.js';
import { fromDescriber, fromGroundFront, fromRegisterText, fromStorefrontSpec } from './sources.js';
import { groundFloorEnabled, groundFloorFor, groundFloorOf, setGroundFloors } from './extract.js';
import { groundHead, upperHead } from '../houseSpec/describer.js';
import { groundFloorFrontTris, groundFloorOpenings, retailFrontTris } from '../retailFront.js';
import { decorateShopfront, setShopTemplates } from '../shopfronts.js';

const READS = JSON.parse(fs.readFileSync('data/ground-floor/reads-pilot.json', 'utf8')) as { reads: GroundFloorRead[] };
const STING = '0363100012175382';

test('pilot reads: every readable read validates; at least 40 fronts', () => {
  assert.ok(READS.reads.length >= 40);
  for (const r of READS.reads) assert.deepEqual(readProblems(r), [], r.pandId);
  assert.ok(READS.reads.filter(r => r.readable).length >= 40);
});

test('describer: heads[0] is kept as the ground head; upperHead still ignores it', () => {
  assert.equal(groundHead(['round', 'flat', 'flat']), 'round');
  assert.equal(upperHead(['round', 'flat', 'flat']), 'flat');
  assert.equal(groundHead([]), 'not-visible');
});

test('merge: openings from the strongest source, piers follow them, other fields each from their best source', () => {
  const read = toGroundFloorPart(READS.reads.find(r => r.pandId === STING)!)!;
  const reg = fromRegisterText('Pand met hardstenen plint en natuurstenen onderpui', 'rce:1')!;
  const g = mergeGroundFloor(STING, [read, reg])!;
  assert.equal(g.openings.length, 1);
  assert.equal(g.openings[0].head, 'round');
  assert.equal(g.receipts.openings!.source, 'photo-read');
  // The read states a rusticated plinth, the register a stone band: the read outranks the register.
  assert.equal(g.plinth.kind, 'rusticated');
  assert.equal(g.receipts.plinth!.source, 'photo-read');
  assert.deepEqual(g.piers.map(p => p.rusticated), [true, true]);
  assert.deepEqual(drawProblems(drawOf(g)), []);
  // A hand spec outranks the read's openings.
  const hand: GroundFloorPart = { source: 'hand', confidence: 0.9, openings: [{ a0: 0.1, a1: 0.9, sillM: 0, headM: 3, head: 'flat', kind: 'shop' }] };
  const h = mergeGroundFloor(STING, [read, hand])!;
  assert.equal(h.receipts.openings!.source, 'hand');
  assert.equal(h.piers.length, 2);
  assert.equal(h.receipts.piers!.source, 'photo-read', 'piers material from the read when the hand spec states none');
  // Nothing with openings: no record (today's template).
  assert.equal(mergeGroundFloor(STING, [reg]), null);
  assert.equal(mergeGroundFloor(STING, []), null);
});

test('merge: a field the reader marked low counts at half its confidence', () => {
  const a: GroundFloorPart & { lowFields?: string[] } = { source: 'photo-read', confidence: 0.8, openings: [{ a0: 0, a1: 1, sillM: 0, headM: 3, head: 'flat', kind: 'shop' }], sign: { kind: 'none' }, lowFields: ['sign'] };
  const g = mergeGroundFloor('1', [a])!;
  assert.equal(g.receipts.sign!.confidence, 0.4);
  assert.equal(g.receipts.openings!.confidence, 0.8);
});

test('sources: storefront bays, recipe ground front, describer ground row, register text', () => {
  const sf = fromStorefrontSpec({ name: 'X', frame: '#222222', span: [0, 6], bays: 'P:0.4 W D:1.0 W P:0.4', windows: 'arched', heightM: 4 }, 6)!;
  assert.deepEqual(sf.openings!.map(o => o.kind), ['shop', 'door', 'shop']);
  assert.equal(sf.openings![0].head, 'round');
  assert.ok(Math.abs(sf.openings![0].a0 - 0.4 / 6) < 1e-9);
  const rg = fromGroundFront({ kind: 'arcade', bays: ['window', 'door', 'window'] }, 4.2)!;
  assert.deepEqual(rg.openings!.map(o => o.head), ['round', 'round', 'round']);
  const d = fromDescriber({ v: 1, pandId: STING, image: { ref: 'x', kind: 'crop' }, reader: 'r', readable: true, extent: 'single', storeys: 4, bays: 3, windows: '?' as never, heads: ['round', 'flat', 'flat', 'flat'], bands: '?' as never, windowSurround: '?' as never, sills: '?' as never, doorBay: '?' as never, doorIndex: 1, groundBays: 3, ground: 'shopfront', basement: '?' as never, crown: '?' as never, cornice: '?' as never, wallFamily: '?' as never, finish: '?' as never, gaps: [] })!;
  assert.deepEqual(d.openings!.map(o => [o.head, o.kind]), [['round', 'shop'], ['round', 'door'], ['round', 'shop']]);
  assert.equal(fromRegisterText('Eenvoudig pand'), null);
  assert.equal(fromRegisterText('onderbouw met rustica')!.plinth!.kind, 'rusticated');
});

test('piers: the wall left between openings', () => {
  assert.deepEqual(piersBetween([{ a0: 0.2, a1: 0.7, sillM: 0, headM: 3, head: 'flat', kind: 'shop' }], 'stone'), [{ a0: 0, a1: 0.2, material: 'stone' }, { a0: 0.7, a1: 1, material: 'stone' }]);
  assert.equal(archRiseM('round', 3), 1.5);
});

test('extract: off by default; stamps only a listed pand with a template, and only when installed', () => {
  assert.equal(groundFloorEnabled(null, null), false);
  assert.equal(groundFloorEnabled('?groundFloor=1', null), true);
  const gf = drawOf(mergeGroundFloor(STING, [toGroundFloorPart(READS.reads.find(r => r.pandId === STING)!)])!);
  const f = { type: 'Feature' as const, properties: { id: `NL.IMBAG.Pand.${STING}` } as Record<string, unknown>, geometry: null };
  setShopTemplates({ version: 1, templates: ['clothes'], buildings: { [`NL.IMBAG.Pand.${STING}`]: [0, 4.89, 52.37] } });
  try {
    const before = decorateShopfront(f);
    assert.equal(before.properties.groundFloor, undefined, 'no extract: nothing stamped');
    setGroundFloors({ version: 1, buildings: { [STING]: gf } });
    assert.deepEqual(groundFloorFor(`NL.IMBAG.Pand.${STING}`), gf);
    const after = decorateShopfront(f);
    assert.deepEqual(groundFloorOf(after.properties.groundFloor), gf);
    const { groundFloor: _g, ...rest } = after.properties;
    assert.deepEqual(rest, before.properties, 'the stamp adds only groundFloor');
  } finally { setGroundFloors(null); setShopTemplates(null); }
});

const E = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
const along = (p: number[]) => p[0], out = (p: number[]) => -p[1];
const STING_GF = (): GroundFloorDraw => drawOf(mergeGroundFloor(STING, [toGroundFloorPart(READS.reads.find(r => r.pandId === STING)!)])!);

test('renderer: The Sting draws its arch, rusticated piers and a board in the opening, no fascia band', () => {
  const gf = STING_GF(), s0 = 0, s1 = 5.9, top = 5.6;
  const tris = groundFloorFrontTris({ template: 'clothes', seed: 'sting', word: 'The Sting' }, gf, E, s0, s1, 0, top);
  assert.ok(tris.length > 40);
  const [o] = groundFloorOpenings(gf, s0, s1, 0, top);
  assert.equal(o.head, 'round');
  assert.ok(o.crown - o.spring > 1, 'a semicircular head');
  // Everything stays within the front and under the storey top, and nothing stands more than a blade's reach out.
  for (const t of tris) for (const p of t.p) {
    assert.ok(along(p) >= s0 - 0.05 && along(p) <= s1 + 0.05, `along ${along(p)}`);
    assert.ok(p[2] >= -1e-6 && p[2] <= top + 0.45, `z ${p[2]}`);
    assert.ok(out(p) <= 1.2, `out ${out(p)}`);
  }
  // Glass inside the opening never rises above the arch: every set-back point lies under the arch line.
  const r = (o.a1 - o.a0) / 2, mid = (o.a0 + o.a1) / 2;
  for (const t of tris) for (const p of t.p) if (out(p) < -0.05 && along(p) > o.a0 + 0.01 && along(p) < o.a1 - 0.01) {
    const u = (along(p) - mid) / r, arch = o.spring + (o.crown - o.spring) * Math.sqrt(Math.max(0, 1 - u * u));
    assert.ok(p[2] <= arch + 0.06, `glass at ${along(p).toFixed(2)},${p[2].toFixed(2)} above the arch ${arch.toFixed(2)}`);
  }
});

test('renderer: cost per front stays near the retailGround budget (140 tris on 6 m without props)', () => {
  for (const r of READS.reads.filter(x => x.readable)) {
    const g = mergeGroundFloor(r.pandId, [toGroundFloorPart(r)]);
    assert.ok(g, r.pandId);
    const tris = groundFloorFrontTris({ template: 'clothes', seed: r.pandId, word: 'Shop' }, drawOf(g), E, 0, 6, 0, Math.min(5.6, g.groundTopM ?? 4));
    assert.ok(tris.length <= 420, `${r.pandId}: ${tris.length}`);
  }
});

test('renderer: no record leaves the template front byte-identical', () => {
  const golden = JSON.parse(fs.readFileSync(new URL('./fixtures/template-golden.json', import.meta.url), 'utf8')) as Record<string, string>;
  const hash = (v: unknown) => { let h = 2166136261; const s = JSON.stringify(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  // The golden was written from origin/main's retailFront.ts (base 92446e4c7; bestseller, bike and souvenir re-taken at the 2026-11-19 merge, where main moved them) for every template; the fillPanes
  // extraction and the inset mode must not move a byte of it.
  for (const [t, h] of Object.entries(golden)) assert.equal(hash(retailFrontTris({ template: t as never, seed: 's' + t, word: 'Shop Name' }, E, 0, 6, 0, 3.4)), h, t);
});

test('fix round: dark by default; a painted pui or fascia colour stands only on a confident read; neutral fill', async () => {
  const { GF_DARK } = await import('../retailFront.js');
  const { GF_HEX_CONF } = await import('./read.js');
  const base: GroundFloorRead = { v: 1, pandId: '0363100000000001', image: { ref: 'r' }, reader: 't', prompt: 'gf-read-v1', readable: true, conf: 0.6, extent: 'single',
    openings: [{ a0: 0.05, a1: 0.95, sillM: 0, headM: 3, head: 'flat', kind: 'shop' }], groundFinish: { material: 'painted-pui', hex: '#f4f0e8' }, fascia: { kind: 'band', hex: '#e9479a' }, sign: { kind: 'fascia' } } as GroundFloorRead;
  const low = toGroundFloorPart(base)!, sure = toGroundFloorPart({ ...base, conf: GF_HEX_CONF })!, marked = toGroundFloorPart({ ...base, conf: 0.9, low: ['fascia'] })!;
  assert.equal(low.groundFinish!.hex, undefined); assert.equal(low.fascia!.hex, undefined);
  assert.equal(sure.groundFinish!.hex, '#f4f0e8'); assert.equal(sure.fascia!.hex, '#e9479a');
  assert.equal(marked.fascia!.hex, undefined); assert.equal(marked.groundFinish!.hex, '#f4f0e8');
  // A non-chain template with no stated colours draws a dark board; neutral drops the template's awning.
  const gf = drawOf(mergeGroundFloor('0363100000000001', [low])!);
  const hexes = new Set(groundFloorFrontTris({ template: 'bakery', seed: 'b', word: 'Bakker' }, gf, E, 0, 6, 0, 3.6).map(t => t.hex));
  assert.ok(hexes.has(GF_DARK));
  const neutral = groundFloorFrontTris({ template: 'telecom', seed: 'n', word: 'KPN', neutral: true }, gf, E, 0, 6, 0, 3.6);
  assert.ok(neutral.length > 20 && neutral.every(t => !t.lit));
});

test('fix round: an arch fanlight faces the street (no back-facing quadrants)', () => {
  const tris = groundFloorFrontTris({ template: 'clothes', seed: 'sting', word: 'The Sting' }, STING_GF(), E, 0, 5.9, 0, 5.6);
  // Every face drawn in the opening's plane with a street-facing normal winds so its geometric normal faces the street.
  for (const t of tris) {
    if (Math.abs(t.n[1] - (-1)) > 1e-6 && Math.abs(t.n[1] - 1) > 1e-6) continue;
    const [a, b, c] = t.p, ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
    const cross = uz * vx - ux * vz; // y component of (b-a) x (c-a)
    if (Math.abs(cross) < 1e-9) continue;
    assert.ok(Math.sign(cross) === Math.sign(t.n[1]), `winding vs normal at ${JSON.stringify(t.p)}`);
  }
});

test('fix round 2: the sign keeps its band over the openings; with no room it goes up as a board in the opening', async () => {
  const { groundFloorSignBand, GF_MIN_HEAD_M } = await import('../retailFront.js');
  // Burger King, Reguliersbreestraat (0363100012179469): a 0.8 m dark fascia over 3 m heads, on the mesher's 3.2 m storey.
  const bk = drawOf(mergeGroundFloor('0363100012179469', [toGroundFloorPart(READS.reads.find(r => r.pandId === '0363100012179469')!)])!);
  const board = bk.fascia.hex!, band = groundFloorSignBand(bk);
  assert.ok(band > 0.8 && band < 1.0);
  for (const top of [3.2, 4.0]) {
    const ops = groundFloorOpenings(bk, 0, 10, 0, top), crown = Math.max(...ops.map(o => o.crown));
    assert.ok(crown <= top - band + 1e-6 || crown <= GF_MIN_HEAD_M + 1e-6, `top ${top}: crown ${crown}`);
    const tris = groundFloorFrontTris({ template: 'fastFood', seed: 'bk', chain: { fascia: '#f4efe6', letters: '#d2232a', word: 'BURGER KING' }, letters: 0 }, bk, E, 0, 10, 0, top);
    const fascia = tris.filter(t => t.hex === board && t.p.every(p => p[2] >= crown - 1e-6));
    assert.ok(fascia.length >= 2, `top ${top}: a fascia over the heads`);
  }
  // A storey too low for heads at GF_MIN_HEAD_M plus the band: the board goes into the widest shop opening.
  const tris = groundFloorFrontTris({ template: 'fastFood', seed: 'bk', chain: { fascia: '#f4efe6', letters: '#d2232a', word: 'BURGER KING' }, letters: 0 }, bk, E, 0, 10, 0, 2.5);
  const ops = groundFloorOpenings(bk, 0, 10, 0, 2.5), widest = ops.filter(o => o.kind === 'shop').sort((p, q) => (q.a1 - q.a0) - (p.a1 - p.a0))[0];
  const inside = tris.filter(t => t.hex === board && t.p.every(p => p[0] >= widest.a0 - 1e-6 && p[0] <= widest.a1 + 1e-6 && p[2] <= widest.spring + 1e-6 && p[2] >= widest.spring - 0.7));
  assert.ok(inside.length >= 2, 'a board in the opening');
  // No sign read stays bare: no board in the opening.
  const bare = { ...bk, sign: { kind: 'none' as const } };
  const inOpening = (ts: ReturnType<typeof groundFloorFrontTris>) => ts.filter(t => t.hex === board && t.p.every(p => p[0] >= widest.a0 - 1e-6 && p[0] <= widest.a1 + 1e-6 && p[2] <= widest.spring + 1e-6 && p[2] >= widest.spring - 0.7));
  assert.equal(inOpening(groundFloorFrontTris({ template: 'fastFood', seed: 'bk', chain: { fascia: '#f4efe6', letters: '#d2232a', word: 'BURGER KING' }, letters: 0 }, bare, E, 0, 10, 0, 2.5)).length, 0);
});
