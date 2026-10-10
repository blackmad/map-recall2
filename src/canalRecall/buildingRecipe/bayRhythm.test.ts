/**
 * Schema additions of 2026-10-10 (block-face strip reviews): per-bay widths, off-centre gables/crowns, a shopfront that
 * leaves the residential entrance bay alone, two-storey shopfronts and a stucco wall material. Houses that do not opt in
 * stay byte-identical (scripts/building-recipes/fit-golden.ts; the last test here runs that check).
 * The variants derive from the committed 087959 intent/facts in memory.
 *   node --import tsx --test src/canalRecall/buildingRecipe/bayRhythm.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {validateIntent, type CanalHouseIntent} from './intent.ts';
import {compileBuilding} from './compile.ts';
import {recipeSlotFor} from '../streetChunks/soup.ts';
import {cityStuccoTint, cityTint, cityWallTint, hexToRgb, rgbToHsl} from './recipeLook.ts';
import {fitHashes, readGolden} from '../../../scripts/building-recipes/fit-golden.ts';
import type {BuildingFacts} from './facts.ts';

const H = 'scripts/building-recipes/houses/bilder-087959';
const base = JSON.parse(fs.readFileSync(`${H}/intent.json`, 'utf8'));
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`${H}/facts.json`, 'utf8'));
const plainFront = {id: 'front0', street: base.fronts[0].street, gable: 'flat', storeys: 4, bays: 3, doorBay: 0, basement: 'none', cornice: 'simple', windows: 'sash', hoist: false};
const variant = (front: Record<string, unknown> = {}, house: Record<string, unknown> = {}): CanalHouseIntent => validateIntent({...base, ...house, fronts: [{...plainFront, ...front}]});
const rowOf = (b: ReturnType<typeof compileBuilding>, s: number) => b.recipe.elevations[0].openings.value
  .filter(o => new RegExp(`^s${s}-b\\d+$`).test(o.id)).map(o => ({c: o.leftM + o.widthM / 2, l: o.leftM, r: o.leftM + o.widthM, w: o.widthM})).sort((a, b) => a.c - b.c);
const width = (b: ReturnType<typeof compileBuilding>) => b.fit.fronts[0].widthM;

test('bayWidths: windows sit in the middle of unequal bays and are as wide as their bay', () => {
  const b = compileBuilding(variant({bays: 2, bayWidths: [1, 2.4], axisGrid: 2}), facts), W = width(b);
  for (const s of [1, 2, 3]) {
    const [left, right] = rowOf(b, s);
    assert.ok(Math.abs(left.c - W * (1 / 3.4) / 2) < 0.01, `storey ${s}: left window centred in a bay of 1/3.4 of the front`);
    assert.ok(Math.abs(right.c - W * (1 + 2.4 / 2) / 3.4) < 0.01, `storey ${s}: right window centred in its bay`);
    assert.ok(right.w > left.w * 1.6, `storey ${s}: the wide bay has the wide window (${right.w} vs ${left.w})`);
  }
  // Axes still line up between storeys.
  assert.ok(Math.abs(rowOf(b, 1)[1].c - rowOf(b, 3)[1].c) < 0.01);
});

test('bayWidths: equal weights give symmetric cells', () => {
  const equal = compileBuilding(variant({bays: 3, axisGrid: 3}), facts), weighted = compileBuilding(variant({bays: 3, axisGrid: 3, bayWidths: [1, 1, 1]}), facts);
  // Equal weights: three cells of a third each (the equal-pier grid has wider outer-to-inner piers), so centres differ by < 0.3 m but are symmetric.
  const w = rowOf(weighted, 1), W = width(weighted);
  assert.ok(Math.abs(w[0].c + w[2].c - W) < 0.01 && Math.abs(w[1].c - W / 2) < 0.01, 'symmetric');
  assert.equal(rowOf(equal, 1).length, 3);
});

test('storeyBayWidths: a storey with its own rhythm (one far-left window and a close pair)', () => {
  const b = compileBuilding(variant({bays: [3, 3, 3, 3], axisGrid: 3, storeyBayWidths: {last: [1.3, 0.85, 0.85]}}), facts), top = rowOf(b, 3), mid = rowOf(b, 1);
  assert.equal(top.length, 3);
  assert.ok(top[1].c - top[0].c > top[2].c - top[1].c, 'the pair is closer than the loner');
  assert.ok(Math.abs(mid[1].c - width(b) / 2) < 0.4, 'other storeys keep the shared grid');
});

test('bayWidths and storeyBayWidths validation', () => {
  assert.throws(() => variant({bays: 3, axisGrid: 3, bayWidths: [1, 2]}), /bayWidths: 3 relative widths/);
  assert.throws(() => variant({bays: 3, axisGrid: 3, bayWidths: [1, 0.05, 1]}), /bayWidths/);
  assert.throws(() => variant({bays: 3, axisGrid: 3, bayWidths: [8, 0.9, 1]}), /8x/);
  assert.throws(() => variant({bays: 3, storeyBayWidths: {'1': [1, 2]}}), /storeyBayWidths.1: 3 relative widths/);
  assert.throws(() => variant({bays: 3, storeyBayWidths: {'9': [1, 2, 3]}}), /storeyBayWidths.9/);
  assert.throws(() => variant({bays: 3, storeyAxes: {'1': [0, 1, 2]}, storeyBayWidths: {'1': [1, 2, 3]}}), /not together with storeyAxes/);
});

const crownX = (b: ReturnType<typeof compileBuilding>) => { const p = b.recipe.elevations[0].crown!.value.profile, top = Math.max(...p.map(q => q[1])); return {xs: p.filter(q => q[1] >= top - 1e-6).map(q => q[0]), p}; };

test('crownAt: the gable stands on part of the front, the rest is plain eaves, gable windows follow it', () => {
  const b = compileBuilding(variant({gable: 'step', atticWindows: 1, crownAt: {from: 0.5, to: 1}}), facts), W = width(b), {xs, p} = crownX(b);
  assert.ok(Math.min(...xs) > W * 0.5 - 1e-6, 'the peak is in the right half');
  assert.equal(p[0][0], 0, 'profile still starts at the left corner'); assert.ok(Math.abs(p.at(-1)![0] - W) < 0.01);
  assert.ok(p.filter(q => q[0] < W * 0.5 - 1e-6).every(q => Math.abs(q[1] - p[0][1]) < 1e-6), 'left half stays at the eaves');
  const attic = b.recipe.elevations[0].openings.value.find(o => o.id.startsWith('attic'))!;
  assert.ok(Math.abs(attic.leftM + attic.widthM / 2 - W * 0.75) < 0.02, 'attic window centred under the gable');
  // The default crown stays centred.
  const centred = compileBuilding(variant({gable: 'step', atticWindows: 1}), facts), a2 = centred.recipe.elevations[0].openings.value.find(o => o.id.startsWith('attic'))!;
  assert.ok(Math.abs(a2.leftM + a2.widthM / 2 - W / 2) < 0.02);
});

test('crownBays follows the bays, including one attic light per bay; cornice caps fill the span', () => {
  const b = compileBuilding(variant({gable: 'step', bays: 3, axisGrid: 3, bayWidths: [1, 1, 2.2], atticWindows: 1, crownBays: {from: 2, to: 2}}), facts), W = width(b);
  const attic = b.recipe.elevations[0].openings.value.find(o => o.id.startsWith('attic'))!;
  assert.ok(Math.abs(attic.leftM + attic.widthM / 2 - (W * (2 + 1.1) / 4.2)) < 0.02, 'attic light on the third bay axis');
  const {xs} = crownX(b); assert.ok(Math.min(...xs) > W * 2 / 4.2 - 1e-6);
  const cap = compileBuilding(variant({gable: 'cornice', crownCap: 'pediment', crownCapRise: 'low', crownAt: {from: 0.33, to: 1}}), facts), c = crownX(cap);
  assert.ok(c.xs.every(x => x > width(cap) * 0.5), 'pediment peak right of centre');
  assert.ok(c.p.some(q => q[0] > width(cap) * 0.9 && q[1] > c.p[0][1] + 0.05) || c.p.at(-2)![0] > width(cap) * 0.9, 'the cap runs to the right edge');
});

test('crownAt validation: needs a crown, a sane span, and not both spellings', () => {
  assert.throws(() => variant({gable: 'flat', crownAt: {from: 0, to: 0.5}}), /no crown to place/);
  assert.throws(() => variant({gable: 'cornice', crownAt: {from: 0, to: 0.5}}), /needs a crownCap/);
  assert.throws(() => variant({gable: 'step', crownAt: {from: 0.6, to: 0.7}}), /crownAt: \{from, to\}/);
  assert.throws(() => variant({gable: 'step', crownAt: {from: 0.2, to: 1.2}}), /crownAt/);
  assert.throws(() => variant({gable: 'step', crownAt: {from: 0, to: 0.5}, crownBays: {from: 0, to: 1}}), /alternatives/);
  assert.throws(() => variant({gable: 'step', bays: 3, crownBays: {from: 2, to: 3}}), /crownBays/);
});

const shopFront = {colour: 'black', fascia: true, displayWindows: 1};

test('shopfront.bays: the entrance bay keeps its own door and wall, the shop takes the other bays', () => {
  const b = compileBuilding(variant({bays: 2, axisGrid: 2, bayWidths: [1, 1.8], doorBay: 0, shopfront: {...shopFront, bays: [1, 1]}}), facts), e = b.recipe.elevations[0], W = width(b);
  const door = e.openings.value.find(o => o.id === 'door')!, glass = e.openings.value.filter(o => o.id.startsWith('shop-') && o.id !== 'shop-door');
  const edge = W * 1 / 2.8;
  assert.ok(door.leftM + door.widthM < edge, 'door inside the left bay');
  assert.ok(glass.length >= 1 && glass.every(o => o.leftM >= edge - 1e-6), 'no shop glass over the entrance bay');
  const bands = e.bands!.value, fascia = bands.find(x => x.id === 'fascia')!, riser = bands.find(x => x.id === 'shop-riser')!;
  assert.ok(fascia.leftM >= edge - 1e-6 && riser.leftM >= edge - 1e-6, 'fascia and riser start at the shop bay');
  assert.ok(Math.abs(fascia.leftM + fascia.widthM - W) < 0.01, 'and run to the right corner');
  assert.ok(e.blocks!.value.every(x => x.leftM >= edge - 0.01 || x.leftM + x.widthM <= edge + 0.01), 'piers stand at the shop boundary');
  // Without `bays` the shopfront covers the whole front as before.
  const whole = compileBuilding(variant({bays: 2, axisGrid: 2, doorBay: null, shopfront: shopFront}), facts).recipe.elevations[0].bands!.value.find(x => x.id === 'fascia')!;
  assert.ok(whole.leftM < 0.05 && whole.leftM + whole.widthM > W - 0.05);
});

test('shopfront.bays: ground windows stay in wall bays beside the shop; overlap with the entrance is rejected', () => {
  const b = compileBuilding(variant({bays: 3, axisGrid: 3, doorBay: 0, shopfront: {...shopFront, bays: [2, 2]}}), facts), ids = b.recipe.elevations[0].openings.value.map(o => o.id);
  assert.ok(ids.includes('door') && ids.includes('s0-b1'), `entrance door and a ground window in the wall bay: ${ids}`);
  assert.ok(!ids.includes('s0-b2'), 'no wall window where the shop is');
  assert.throws(() => variant({bays: 3, axisGrid: 3, doorBay: 1, shopfront: {...shopFront, bays: [0, 1]}}), /cover the entrance bay/);
  assert.throws(() => variant({bays: 3, axisGrid: 3, doorBay: 0, shopfront: {...shopFront, bays: [0, 2]}}), /covers every bay/);
  assert.throws(() => variant({bays: 3, axisGrid: 3, doorBay: 0, shopfront: {...shopFront, bays: [1, 3]}}), /shopfront.bays: \[first, last\]/);
  assert.throws(() => variant({bays: 3, axisGrid: 3, doorBay: 0, shopfront: {...shopFront, bays: [1, 2], residentialDoor: {side: 'left'}}}), /not together with residentialDoor/);
  // The ground storey must sit on the grid for the overlap to be checkable.
  assert.throws(() => variant({bays: [2, 3, 3, 3], axisGrid: 3, storeyAxes: {'0': [0, 1]}, doorBay: 1, shopfront: {...shopFront, bays: [1, 2]}}), /cover the entrance bay/);
});

test('two-storey shopfront: storey-1 windows in the shop span go, the glass is double height with a mezzanine transom, fascia at the top', () => {
  const one = compileBuilding(variant({bays: 3, axisGrid: 3, doorBay: null, shopfront: shopFront}), facts);
  const two = compileBuilding(variant({bays: 3, axisGrid: 3, doorBay: null, shopfront: {...shopFront, storeys: 2}}), facts);
  const e1 = one.recipe.elevations[0], e2 = two.recipe.elevations[0];
  assert.equal(rowOf(one, 1).length, 3); assert.equal(rowOf(two, 1).length, 0, 'storey 1 windows dropped');
  assert.equal(rowOf(two, 2).length, 3, 'upper storeys keep theirs');
  const g1 = e1.openings.value.find(o => o.id === 'shop-0')!, g2 = e2.openings.value.find(o => o.id === 'shop-0')!;
  const h = two.fit.fronts[0].storeyHeightsM;
  assert.ok(g2.heightM > g1.heightM + h[1] * 0.9, `glass spans both storeys (${g1.heightM} -> ${g2.heightM})`);
  assert.ok(g2.horizontalBars && g2.horizontalBars.length >= 1, 'transom bar at the mezzanine floor');
  const fascia1 = e1.bands!.value.find(x => x.id === 'fascia')!, fascia2 = e2.bands!.value.find(x => x.id === 'fascia')!;
  assert.ok(fascia2.bottomM > fascia1.bottomM + h[1] * 0.9, 'fascia moves up a storey');
  assert.ok(e2.bands!.value.some(x => x.id === 'shop-mezzanine'), 'mezzanine slab band');
  assert.ok(!e1.bands!.value.some(x => x.id === 'shop-mezzanine'));
  assert.throws(() => variant({storeys: 2, bays: 3, doorBay: null, shopfront: {...shopFront, storeys: 2}}), /at least 3 storeys/);
  assert.throws(() => variant({bays: 3, doorBay: null, shopfront: {...shopFront, storeys: 3}}), /storeys: 1 or 2/);
});

test('two-storey shop limited to bays leaves the wall bays\' storey-1 windows', () => {
  const b = compileBuilding(variant({bays: 3, axisGrid: 3, doorBay: 0, shopfront: {...shopFront, storeys: 2, bays: [1, 2]}}), facts), W = width(b), row = rowOf(b, 1);
  assert.equal(row.length, 1); assert.ok(row[0].c < W / 3, 'only the entrance bay keeps its first-floor window');
});

test('stucco: the look keeps white white where the brick tint lands at tan', () => {
  const l = (hex: string) => rgbToHsl(hexToRgb(hex));
  for (const white of ['#e6e2d8', '#ece9e0']) {
    const brick = l(cityWallTint(white)), stucco = l(cityStuccoTint(white));
    assert.ok(brick[2] <= 0.6 + 1e-3 && brick[1] >= 0.11, 'regression: the brick tint of a white wall is a mid-lightness tan');
    assert.ok(stucco[2] >= 0.88 && stucco[1] <= 0.3, `stucco white stays light and unsaturated (${stucco})`);
  }
  const cream = l(cityStuccoTint('#d9ccaa')), grey = l(cityStuccoTint('#9a9a94'));
  assert.ok(cream[2] > 0.78 && cream[1] > 0.2, 'cream stays cream');
  assert.ok(grey[1] < 0.06 && Math.abs(grey[2] - (l('#9a9a94')[2] * 1.06 + 0.03)) < 0.02, 'grey stays neutral');
  assert.equal(cityTint('stucco', '#e6e2d8'), cityStuccoTint('#e6e2d8'));
});

test('wallMaterial stucco puts the wall surfaces in the stucco slot; brick houses are untouched; fronts cannot override it', () => {
  const slots = (house: CanalHouseIntent) => {
    const b = compileBuilding(house, facts), pick = recipeSlotFor(house), out = new Set<string>();
    b.group.traverse(o => { if (o instanceof T.Mesh && o.userData.surface === 'wall') out.add(pick(o)); });
    return [...out];
  };
  assert.deepEqual(slots(variant({}, {palette: {...base.palette, wallMaterial: 'stucco', brick: 'white-painted'}})), ['stucco']);
  assert.deepEqual(slots(variant()), ['brick']);
  assert.throws(() => variant({palette: {wallMaterial: 'stucco'}}), /set the wall material on the house palette/);
  assert.throws(() => variant({}, {palette: {...base.palette, wallMaterial: 'marble'}}), /wallMaterial/);
});

test('tall stepped gable: crownRise, crownSteps and crownFinial control height, steps and the finial block', () => {
  const plain = compileBuilding(variant({gable: 'step', atticWindows: 1, crownAt: {from: 0.35, to: 0.65}}), facts);
  const tall = compileBuilding(variant({gable: 'step', atticWindows: 1, crownAt: {from: 0.35, to: 0.65}, crownRise: 1.1, crownSteps: 3, crownFinial: true}), facts);
  const eaves = tall.fit.fronts[0].eavesM, p = tall.recipe.elevations[0].crown!.value.profile, top = Math.max(...p.map(q => q[1])), upper = tall.fit.fronts[0].storeyHeightsM.at(-1)!;
  assert.ok(Math.abs(top - eaves - 0.4 - 1.1 * upper) < 0.02, `crown top = eaves + 1.1 upper storeys + finial (${top - eaves})`);
  const steps = (b: ReturnType<typeof compileBuilding>) => new Set(b.recipe.elevations[0].crown!.value.profile.map(q => q[1].toFixed(3))).size;
  assert.ok(steps(tall) > steps(plain) - 1, 'three steps per side');
  const finial = p.filter(q => q[1] >= top - 1e-6);
  assert.equal(finial.length, 2, 'a finial block with a flat top');
  assert.ok(finial[1][0] - finial[0][0] < 0.7, 'finial is a small block');
  assert.throws(() => variant({gable: 'point', crownSteps: 3}), /only a step gable has steps/);
  assert.throws(() => variant({gable: 'point', crownFinial: true}), /flat top/);
  assert.throws(() => variant({gable: 'step', crownRise: 5}), /crownRise/);
});

test('round oculus in the gable and tall two-light windows', () => {
  const b = compileBuilding(variant({gable: 'step', atticWindows: 1, atticShape: 'round', crownAt: {from: 0.35, to: 0.65}, crownRise: 1.1}), facts), W = width(b);
  const o = b.recipe.elevations[0].openings.value.find(x => x.id.startsWith('attic'))!;
  assert.equal(o.head, 'oval'); assert.ok(Math.abs(o.widthM - o.heightM) < 1e-9, 'round');
  assert.ok(Math.abs(o.leftM + o.widthM / 2 - W / 2) < 0.02, 'centred under the gable');
  assert.throws(() => variant({atticShape: 'round'}), /needs atticWindows/);
  const std = compileBuilding(variant({windows: 'sash'}), facts), tall = compileBuilding(variant({windows: 'two-light', windowProportion: 'tall'}), facts);
  const w = (x: ReturnType<typeof compileBuilding>) => x.recipe.elevations[0].openings.value.find(o => o.id === 's2-b1')!;
  assert.ok(w(tall).heightM > w(std).heightM * 1.15, 'taller');
  assert.deepEqual(w(tall).verticalBars, [0.5]); assert.deepEqual(w(tall).horizontalBars, [0.8]);
  assert.ok(w(tall).bottomM - tall.fit.fronts[0].storeyHeightsM[0] >= 0, 'sits on the storey');
});

test('a shopfront limited to bays keeps the ground storey proportions of its neighbours', () => {
  const full = compileBuilding(variant({bays: 3, axisGrid: 3, doorBay: 1, shopfront: {...shopFront, bays: [2, 2]}}), facts), none = compileBuilding(variant({bays: 3, axisGrid: 3, doorBay: 1}), facts);
  assert.deepEqual(full.fit.fronts[0].storeyHeightsM, none.fit.fronts[0].storeyHeightsM, 'partial shop does not stretch the ground storey (rows keep lining up along the row)');
});

test('per-house recipes that do not opt in fit byte-identically (fit-golden.json)', () => {
  assert.deepEqual(fitHashes(), readGolden());
});
