/** Look-pass components on Bilderdijkstraat (integrator review 2026-10-09): round-arched top storeys under a
 * wide parapet (081118), 087959's low pediment over a shared axis grid (photo proposal 2026-10-10), two-colour
 * banding (079721), framed shopfronts with sign bands. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {compileBuilding, resolveIntent} from './compile.ts';
import type {BuildingFacts} from './facts.ts';
import {validateIntent, DIMINISHING_WINDOW_HEIGHTS} from './intent.ts';

const raw = (id: string) => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
const build = (id: string) => compileBuilding(resolveIntent(raw(id), raw), facts(id));
const names = (g: T.Object3D) => { const out: string[] = []; g.traverse(o => { if (o instanceof T.Mesh) out.push(o.name); }); return out; };

for (const id of ['bilder-081118']) test(`${id}: round-arched top storey under a wide rounded parapet`, () => {
  const b = build(id), e = b.recipe.elevations[0], top = b.fit.fronts[0].storeyHeightsM.length - 1;
  const arched = e.openings.value.filter(o => o.id.startsWith(`s${top}-`) && o.head === 'segmental');
  assert.ok(arched.length >= 2, 'top-storey windows have heads');
  for (const o of arched) assert.ok(Math.abs(o.headRiseM! - o.widthM / 2) < 0.01, 'semicircular head');
  const xs = e.crown!.value.profile.filter(p => p[1] > b.fit.fronts[0].eavesM + 0.05).map(p => p[0]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > b.fit.fronts[0].widthM * 0.85, 'parapet spans the front');
  assert.ok(names(b.group).some(n => n.startsWith('ornament/arch-')), 'relieving arches');
});

test('bilder-087959: low pediment over the middle, three arched top windows on axes 0, 1, 3 of the four-axis grid', () => {
  const b = build('bilder-087959'), e = b.recipe.elevations[0], f = b.fit.fronts[0], top = f.storeyHeightsM.length - 1;
  const arched = e.openings.value.filter(o => o.id.startsWith(`s${top}-`) && o.head === 'segmental');
  assert.equal(arched.length, 3);
  for (const o of arched) assert.ok(Math.abs(o.headRiseM! - o.widthM / 2) < 0.01, 'semicircular head');
  // Same axes as the storey below: the top storey skips axis 2 (the photo's gap), it does not re-space its three windows.
  const centres = (s: number) => e.openings.value.filter(o => new RegExp(`^s${s}-b\\d+$`).test(o.id)).map(o => o.leftM + o.widthM / 2).sort((a, c) => a - c);
  const below = centres(top - 1), above = centres(top);
  assert.equal(below.length, 4);
  for (const [k, axis] of [0, 1, 3].entries()) assert.ok(Math.abs(above[k] - below[axis]) < 0.02, `top window ${k} on axis ${axis}`);
  // Low pediment: one apex, about 0.4 m over the eaves, over the middle of the front only.
  const profile = e.crown!.value.profile, peak = Math.max(...profile.map(p => p[1]));
  assert.ok(peak - f.eavesM > 0.3 && peak - f.eavesM < 0.75, `cap rise ${peak - f.eavesM}`);
  const raised = profile.filter(p => p[1] > f.eavesM + 0.05).map(p => p[0]);
  assert.ok(Math.max(...raised) - Math.min(...raised) < f.widthM * 0.8, 'medium span, not a full-width parapet');
  // Thai Thara: recessed centre entrance, residential door at the right, lettering on the fascia.
  const shopDoor = e.openings.value.find(o => o.id === 'shop-door')!, res = e.openings.value.find(o => o.id === 'door')!;
  assert.ok(shopDoor.recessM! > 0.3);
  assert.ok(f.mirrored ? res.leftM < shopDoor.leftM : res.leftM > shopDoor.leftM, 'residential door on the viewer\'s right');
  assert.equal(f.signBand?.mount, 'fascia');
  assert.ok(names(b.group).includes('sign/lettering'));
});

test('bilder-079721: lintel bands are stripes of the band brick, not stone', () => {
  const b = build('bilder-079721');
  const stripes = b.recipe.elevations[0].bands!.value.filter(d => d.id.startsWith('lintel-'));
  assert.ok(stripes.length >= 3 && stripes.every(d => d.surface === 'accent'));
  assert.equal(b.recipe.palette.value.accent, '#8c3b2c');
});

test('shopfronts: piers, stall riser, framed glazing and a fascia with a lettering panel, in the shop paint', () => {
  const b = build('bilder-087959'), e = b.recipe.elevations[0], n = names(b.group);
  for (const id of ['shop-riser', 'fascia']) assert.ok(e.bands!.value.some(d => d.id === id), id);
  assert.ok(e.blocks!.value.filter(d => d.surface === 'shop').length === 2, 'two piers');
  const glass = e.openings.value.filter(o => o.id.startsWith('shop-'));
  assert.ok(glass.length && glass.every(o => o.frameSurface === 'shop'));
  assert.equal(b.recipe.palette.value.shop, '#1e1e1e');
  assert.ok(n.some(x => x.includes('shop-0/frame')));
});

/* Canal-belt windows and white accents (survey 2026-10-14, docs/canal-house-windows-and-accents-20261014.md). Every
 * field is optional and absent fields leave existing recipes byte-identical (fit-golden). Fixture front: bilder-153622
 * (5 storeys x 3 bays) with the canal fields patched in; named regressions: the canal-belt refits (cw-*). */
const canal = (patch: Record<string, unknown>) => { const i = raw('bilder-153622'); Object.assign(i.fronts[0], patch); return i; };
const fitCanal = (patch: Record<string, unknown>) => compileBuilding(resolveIntent(canal(patch), raw), facts('bilder-153622'));
const upper = (b: ReturnType<typeof build>, s: number) => b.recipe.elevations[0].openings.value.filter(o => new RegExp(`^s${s}-b\\d+$`).test(o.id));

test('canal windows: the schema takes the new fields and rejects junk', () => {
  validateIntent(canal({windows: 'sash-6-over-6', storeyWindows: {'1': 'sash-9-over-9', '4': 't-window'}, windowShare: 0.66, windowHeights: 'diminishing',
    windowHead: {kind: 'segmental', archRing: {colour: 'stone', keystone: true}}, bands: 'speklagen', speklagen: {spacing: 12, courses: 2},
    windowSurround: 'sill', storeyHeights: [1.4, 1, 0.97, 0.95, 0.9], plinth: 'low', cornice: 'frieze'}));
  validateIntent(canal({windowHead: {kind: 'relieving', storeys: [2, 3], archRing: {colour: 'band', style: 'blocks', widthCourses: 4}}}));
  const bad: [Record<string, unknown>, RegExp][] = [
    [{windows: 'sash-7-over-7'}, /windows/], [{storeyWindows: {'9': 'sash'}}, /storeyWindows/], [{storeyWindows: {'1': 'shop'}}, /storeyWindows/],
    [{windowHead: {kind: 'relieving'}}, /relieving/], [{windowHead: {kind: 'pointed'}}, /windowHead/],
    [{windowHead: {kind: 'segmental', archRing: {colour: 'gold'}}}, /archRing/], [{windowHead: {kind: 'flat', archRing: {colour: 'stone'}}}, /keystone/],
    [{windowHead: {kind: 'segmental', archRing: {colour: 'stone', style: 'none'}}}, /keystone/],
    [{windowHeights: [0.7, 0.7]}, /windowHeights/], [{windowHeights: [0.7, 0.7, 0.7, 0.7, 0.95]}, /windowHeights/], [{windowShare: 0.9}, /windowShare/],
    [{bands: 'speklagen'}, /speklagen/], [{speklagen: {spacing: 10}}, /speklagen/], [{bands: 'speklagen', speklagen: {spacing: 2}}, /spacing/],
    [{storeyHeights: [1, 1]}, /storeyHeights/], [{storeyHeights: [1, 1, 1, 1, 4]}, /3x/], [{plinth: 'tall'}, /plinth/], [{basementBars: true}, /basementBars/],
  ];
  for (const [patch, message] of bad) assert.throws(() => validateIntent(canal(patch)), message, JSON.stringify(patch));
});

test('canal windows: pane layouts are glazing bars inside the pane', () => {
  const six = upper(fitCanal({windows: 'sash-6-over-6'}), 2)[0];
  assert.deepEqual(six.verticalBars, [1 / 3, 2 / 3]);
  assert.deepEqual(six.horizontalBars, [.25, .5, .75]);
  assert.ok(six.horizontalBarWidthsM![1] > six.horizontalBarWidthsM![0], 'meeting rail heavier than the glazing bars');
  assert.equal(upper(fitCanal({windows: 'sash-8-over-8'}), 2)[0].verticalBars!.length, 3);
  assert.equal(upper(fitCanal({windows: 'sash-9-over-9'}), 2)[0].horizontalBars!.length, 5);
  // T-venster, cross-transom and small-over-one carry thin bars that must stay inside the pane.
  for (const kind of ['t-window', 'cross-transom', 'small-over-one']) {
    const o = upper(fitCanal({windows: kind}), 2)[0];
    assert.ok(o.diagonalBars!.length > 0, kind);
    for (const seg of o.diagonalBars!) for (const [x, y] of seg) assert.ok(x > 0 && x < 1 && y > 0 && y < 1, `${kind} bar inside the opening`);
  }
  const t = upper(fitCanal({windows: 't-window'}), 2)[0];
  assert.deepEqual(t.horizontalBars, [.76]);
  assert.ok(Math.max(...t.diagonalBars![0].map(p => p[1])) < .76, 'mullion stops under the transom');
  const mixed = fitCanal({windows: 'sash-6-over-6', storeyWindows: {'2': 'six-pane'}});
  assert.deepEqual(upper(mixed, 2)[0].horizontalBars, [1 / 3, 2 / 3]);
  assert.deepEqual(upper(mixed, 3)[0].horizontalBars, [.25, .5, .75]);
});

test('canal windows: segmental and round heads, stone rings with keystones, block arches, keystone only', () => {
  const seg = fitCanal({windowHead: {kind: 'segmental', archRing: {colour: 'stone', keystone: true}}});
  const o = upper(seg, 2)[0], e = seg.recipe.elevations[0];
  assert.ok(o.head === 'segmental' && Math.abs(o.headRiseM! - o.widthM * 0.08) < 0.002, 'shallow segmental head (survey median 0.08 x width)');
  assert.ok(e.ornaments!.value.some(r => r.id === `arch-${o.id}` && r.fill === 'stone'));
  const key = e.dressings!.value.find(d => d.id === `keystone-${o.id}`)!;
  assert.ok(key && Math.abs(key.leftM + key.widthM / 2 - (o.leftM + o.widthM / 2)) < 0.002, 'keystone centred on the head');
  const round = upper(fitCanal({windowHead: {kind: 'round', storeys: [4]}}), 4)[0];
  assert.ok(Math.abs(round.headRiseM! - round.widthM / 2) < 0.01, 'semicircular');
  const blocks = fitCanal({windowHead: {kind: 'relieving', storeys: [3], archRing: {colour: 'frame', style: 'blocks'}}}).recipe.elevations[0];
  const w3 = blocks.openings.value.filter(x => /^s3-b\d+$/.test(x.id));
  assert.ok(w3.every(x => !x.head), 'relieving: the window itself stays square-headed');
  const voussoirs = blocks.ornaments!.value.filter(r => r.id.startsWith('arch-s3-'));
  assert.equal(voussoirs.length, w3.length * 5, 'five blocks per arch');
  assert.ok(voussoirs.every(r => r.fill === 'trim'));
  const only = fitCanal({windowHead: {kind: 'segmental', archRing: {colour: 'stone', style: 'none', keystone: true}}}).recipe.elevations[0];
  assert.ok(!(only.ornaments?.value ?? []).some(r => r.id.startsWith('arch-')) && only.dressings!.value.some(d => d.id.startsWith('keystone-')), 'keystone without a ring');
});

test('canal windows: measured heights, widths and storeys', () => {
  const dim = fitCanal({windowHeights: 'diminishing'}), f = dim.fit.fronts[0];
  for (const s of [2, 3, 4]) {
    const o = upper(dim, s)[0];
    assert.ok(Math.abs(o.heightM / f.storeyHeightsM[s] - DIMINISHING_WINDOW_HEIGHTS[s]) < 0.01, `storey ${s} share`);
  }
  const share = fitCanal({windowShare: 0.66}), wsum = upper(share, 3).reduce((t, x) => t + x.widthM, 0);
  assert.ok(Math.abs(wsum / share.fit.fronts[0].widthM - 0.66) < 0.02, `windows take 66 % of the front (${wsum / share.fit.fronts[0].widthM})`);
  const sh = fitCanal({storeyHeights: [2, 1, 1, 1, 1]}).fit.fronts[0].storeyHeightsM;
  assert.ok(Math.abs(sh[0] / sh[1] - 2) < 0.01, 'ground twice the first floor');
});

test('canal accents: speklagen, sills, attic frieze', () => {
  const spek = fitCanal({bands: 'speklagen', speklagen: {spacing: 10, courses: 2}}).recipe.elevations[0].bands!.value.filter(b => b.id.startsWith('spek-'));
  assert.ok(spek.length >= 10, `${spek.length} courses`);
  for (let i = 1; i < spek.length; i++) assert.ok(Math.abs(spek[i].bottomM - spek[i - 1].bottomM - 0.55) < 0.002, 'every 10 courses (0.55 m)');
  assert.ok(spek.every(b => Math.abs(b.heightM - 0.11) < 0.001 && b.surface === 'stone'));
  const sill = fitCanal({windowSurround: 'sill'}).recipe.elevations[0].dressings!.value;
  assert.ok(sill.length > 0 && sill.every(d => d.id.startsWith('sill-')), 'sills only, no lintels');
  const frieze = fitCanal({cornice: 'frieze'}).recipe.elevations[0].cornice!.value;
  assert.ok(frieze.heightM === 1.6 && frieze.depthM === 0.25);
});

test('canal-belt refits (named regressions): block arches and speklagen on 175702, cross-transom on 179665, barred souterrain lights on 176601', () => {
  const e = build('cw-heren-175702').recipe.elevations[0];
  assert.equal(e.ornaments!.value.filter(r => r.id.startsWith('arch-s1-')).length, 15, 'three five-block arches over the first floor');
  assert.ok(e.bands!.value.some(x => x.id.startsWith('spek-')));
  assert.ok(build('cw-heren-179665').recipe.elevations[0].openings.value.filter(o => /^s0-b\d+$/.test(o.id)).every(o => o.horizontalBars?.[0] === .6));
  const base = build('cw-heren-176601').recipe.elevations[0].openings.value.filter(o => o.id.startsWith('basement-'));
  assert.ok(base.length && base.every(o => o.verticalBars!.length === 4), 'barred basement lights');
});
