/**
 * De Baarsjes rows on Jan Evertsenstraat (lane de-baarsjes-faces-20261016): the kit keys the rows needed and the named
 * regressions of the authored faces.
 *  - 105 (155048, evertsen-91-135): box frame 1.10-1.93 m touching its flat neighbour, half of the party-wall window at
 *    4.56-6.00 m (ruler crop, 120 px/m); 107 (078348) mirrors it so the two halves meet across the party wall;
 *  - 93 (114417): no box frame and no lisene (`null` overrides remove the type's fields);
 *  - 129 (102496): the wide four-light window beside its box (`axisWindows`);
 *  - 101-119: one coping line for the row (`measuredEaves`, one strip row);
 *  - the measured glass-block band: joints read with the band, deeper steps only when measured.
 *   node --import tsx --test src/canalRecall/blockFace/deBaarsjesRows.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import crypto from 'node:crypto';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {WINDOWS, validateIntent, type FrontIntent} from '../buildingRecipe/intent.ts';
import {WINDOW_KINDS} from '../buildingRecipe/deBaarsjesIntent.ts';
import {GLASS_BLOCK, glassBlockBand, measuredMortar} from '../buildingRecipe/amsterdamSchool.ts';
import {houseIntents, validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {mirrorFront} from './houseType.ts';
import {mergeCoplanar} from './recipeRoof.ts';
import {prepareFaceFacts} from './compile.ts';

const DIR = 'scripts/block-face/faces/evertsen-91-135';
const raw = JSON.parse(fs.readFileSync(`${DIR}/intent.json`, 'utf8'));
const members: string[] = JSON.parse(fs.readFileSync(`${DIR}/discovery.json`, 'utf8')).members;
const face: BlockFaceIntent = validateBlockFace(raw, members);
const intents = houseIntents(face);
const intentOf = (pand: string) => intents.find(i => i.pandId.endsWith(pand))!;
const factsOf = (pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`${DIR}/pands/0363100012${pand}/facts.json`, 'utf8'));
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };
const storey2 = (pand: string) => {
  const {recipe, report} = fitIntent(intentOf(pand), factsOf(pand));
  const el = recipe.elevations[0];
  return {width: report.fronts[0].widthM, erker: report.fronts[0].erker, windows: el.openings.value.filter(o => /^s2-/.test(o.id)).sort((a, b) => a.leftM - b.leftM)};
};

test('WINDOW_KINDS (axisWindows validation) lists exactly the intent WINDOWS', () => {
  assert.deepEqual([...WINDOW_KINDS], [...WINDOWS]);
});

test('bayFill and axisWindows validate; misuse is rejected', () => {
  const i = intentOf('155048');
  const patch = (p: Partial<FrontIntent> & Record<string, unknown>) => { const x = structuredClone(i) as any; Object.assign(x.fronts[0], p); return x; };
  validateIntent(patch({}));
  assert.throws(() => validateIntent(patch({bayFill: [0.5, 0.98]})), /bayFill: 5 window shares/);
  assert.throws(() => validateIntent(patch({bayFill: [0.5, 0.98, 0.98, 0.2, 0.97]})), /each 0\.3\.\.1/);
  assert.throws(() => validateIntent(patch({bayWidths: undefined})), /bayFill: needs bayWidths/);
  assert.throws(() => validateIntent(patch({axisWindows: {'7': 'casement-pair'}})), /axisWindows\.7: an axis 0\.\.4/);
  assert.throws(() => validateIntent(patch({axisWindows: {'1': 'porthole'} as any})), /axisWindows\.1: one of/);
});

test('mirrorFront reverses bayFill and flips the axisWindows keys', () => {
  const f = intentOf('155048').fronts[0];
  const m = mirrorFront({...f, axisWindows: {'1': 'casement-pair'}});
  assert.deepEqual(m.bayFill, [...f.bayFill!].reverse());
  assert.deepEqual(m.axisWindows, {'3': 'casement-pair'});
});

test('105: the box frame touches its flat neighbour; the far window is half of one straddling the party wall', () => {
  const {width, erker, windows} = storey2('155048');
  assert.ok(erker && Math.abs(erker.leftM - 1.10) < 0.03 && Math.abs(erker.widthM - 0.83) < 0.03, `box 1.10-1.93 m (${erker?.leftM} + ${erker?.widthM})`);
  const flat = windows.find(w => w.leftM > erker!.leftM + 0.1 && w.leftM < 2.5)!, half = windows[windows.length - 1];
  assert.ok(flat.leftM - (erker!.leftM + erker!.widthM) < 0.03, 'the flat window touches the box (one pier)');
  assert.ok(Math.abs(half.leftM - 4.56) < 0.05 && width - (half.leftM + half.widthM) < 0.03, `half window 4.56-6.00 m (${half.leftM} + ${half.widthM})`);
  // 107 is the mirror: its half window starts at its left party wall, so the two halves read as one window.
  const n = storey2('078348').windows[0];
  assert.ok(n.leftM < 0.03 && Math.abs(n.widthM - half.widthM) < 0.01, `107 starts with the other half (${n.leftM} + ${n.widthM})`);
});

test('93: null overrides remove the type\'s box frames and lisene', () => {
  const f = intentOf('114417').fronts[0];
  assert.equal(f.bayWindows, undefined);
  assert.equal(f.lisenes, undefined);
  assert.equal(storey2('114417').erker, undefined);
});

test('129: the wide window takes its axis kind (four lights), the others the type\'s', () => {
  const {windows} = storey2('102496');
  const wide = windows.find(w => w.widthM > 2.5)!;
  assert.deepEqual(wide.verticalBars, [0.25, 0.5, 0.75]);
  assert.ok(windows.filter(w => w !== wide).every(w => (w.verticalBars ?? []).length <= 1));
});

test('101-119: one coping line for the row', () => {
  const rows = new Set(['147193', '113053', '155048', '078348', '065988', '062999', '099114', '151042', '142949', '096804'].map(p => face.continuity.measuredEaves!.find(m => m.pand.endsWith(p))!.stripRow));
  assert.equal(rows.size, 1);
});

test('measured glass-block band: joints from the band colour, deeper steps only when measured', () => {
  assert.equal(measuredMortar('#4c4d3d'), '#63644f');
  const zMax = (v: number[]) => Math.max(...v.filter((_, k) => k % 3 === 2));
  const b = {leftM: 0, widthM: 6, bottomM: 3.1, topM: 4.7, cellM: 0.2};
  const plain = glassBlockBand(b), measured = glassBlockBand({...b, colour: '#4c4d3d'});
  assert.equal(zMax(plain.glass), GLASS_BLOCK.proudM);
  assert.equal(zMax(plain.grid), GLASS_BLOCK.gridProudM);
  assert.ok(zMax(measured.grid) - zMax(measured.glass) >= 0.03 && zMax(measured.glass) >= 0.03, 'steps clear of the 3 cm z-fight tolerance');
});

test('mergeCoplanar: the memoised merge gives the restart-from-scratch result (hash recorded from the old algorithm)', () => {
  // 30 seeded unit-grid layouts (squares, some split into triangles), corners on (x + y) % 3 = 0. The hash was recorded
  // with the O(n^3) "first mergeable pair, then start over" loop that this lane replaced (121-125 compiled for hours).
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out: unknown[] = [];
  for (let c = 0; c < 30; c++) {
    const pieces: number[][][] = [];
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) if (rnd() < 0.7) {
      if (rnd() < 0.3) pieces.push([[x, y], [x + 1, y], [x + 1, y + 1]], [[x, y], [x + 1, y + 1], [x, y + 1]]);
      else pieces.push([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]);
    }
    out.push(mergeCoplanar(pieces, (p: number[]) => (p[0] + p[1]) % 3 === 0));
  }
  assert.equal(out.reduce((n: number, r) => n + (r as unknown[]).length, 0), 151);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex').slice(0, 16), 'bb1a64b41f2c3eb3');
});

test('59-89: slots pair at shared piers; 75-89 carry a painted sign panel over the canopy instead of glass block', () => {
  const dir = 'scripts/block-face/faces/evertsen-59-89';
  const odd = validateBlockFace(JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8')), JSON.parse(fs.readFileSync(`${dir}/discovery.json`, 'utf8')).members);
  const hs = houseIntents(odd);
  // Through the face planner (measured coping, shared ground, canopy group), as the chunk compile builds them.
  const st = JSON.parse(fs.readFileSync(`${dir}/strip.json`, 'utf8'));
  const prep = prepareFaceFacts(odd, new Map(odd.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(`${dir}/pands/${h.pandId}/facts.json`, 'utf8'))])), {strip: {heightPx: st.height, pixelsPerMetre: st.pixelsPerMetre, groundNAP: st.groundNAP}});
  const build = (p: string) => { const k = prep.intents.findIndex(i => i.pandId.endsWith(p)); return compileBuilding(prep.intents[k], prep.ground.facts[k]); };
  // 61 (107408): slot on the left: the French door 0.32-1.23 m touching its window, the half window at 4.34-6.03 m.
  const b = build('107408'), fr = b.fit.fronts[0], s2 = b.recipe.elevations[0].openings.value.filter(o => /^s2-/.test(o.id)).sort((p, q) => p.leftM - q.leftM);
  assert.ok(Math.abs(s2[0].leftM - 0.32) < 0.05 && s2[1].leftM - (s2[0].leftM + s2[0].widthM) < 0.03, `door then its window (${s2.map(o => o.leftM).join(', ')})`);
  assert.ok(fr.widthM - (s2[2].leftM + s2[2].widthM) < 0.03, 'the half window reaches the party wall');
  assert.equal(fr.lisenes?.length, 1, 'the slot pier');
  assert.equal(fr.canopy!.glassBlocks!.panel, undefined);
  const p = build('107343'), g = p.fit.fronts[0].canopy!.glassBlocks!;
  assert.equal(g.panel, '#9a947d');
  assert.equal(meshes(p.group, /glass-block/).length, 0, 'no glass, no grid');
  const panel = meshes(p.group, /band-panel$/)[0];
  assert.equal((panel.material as T.MeshStandardMaterial).color.getHexString(), '9a947d');
  assert.equal((panel.material as T.Material).userData.tintSource, 'measured');
  const intent = structuredClone(hs.find(i => i.pandId.endsWith('107343'))!) as any;
  intent.fronts[0].shopfront.awning.glassBlocks = {rows: 7, panel: 'white'};
  assert.throws(() => validateIntent(intent), /panel: '#rrggbb'/);
});

test('94-142: box frames flank the shared lisenes; 96 ends the row with a wide window and a recessed tail', () => {
  const dir = 'scripts/block-face/faces/evertsen-94-142';
  const even = validateBlockFace(JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8')), JSON.parse(fs.readFileSync(`${dir}/discovery.json`, 'utf8')).members);
  const hs = houseIntents(even);
  const fit = (p: string) => fitIntent(hs.find(i => i.pandId.endsWith(p))!, JSON.parse(fs.readFileSync(`${dir}/pands/0363100012${p}/facts.json`, 'utf8')));
  // 128 (088014) and 126 (118917) share a lisene: 128's box at its right end, 126's at its left (strip ruler crop of 118).
  const r = fit('088014').report.fronts[0], l = fit('118917').report.fronts[0];
  assert.ok(r.erker!.leftM + r.erker!.widthM > r.widthM - 1.5, `128 box on the right (${r.erker!.leftM})`);
  assert.ok(l.erker!.leftM < 1.5, `126 box on the left (${l.erker!.leftM})`);
  const end = fit('110500');
  assert.equal(end.report.fronts.length, 2, 'the visible front and the recessed tail');
  const wide = end.recipe.elevations[0].openings.value.find(o => /s2-/.test(o.id) && o.widthM > 2.5);
  assert.deepEqual(wide?.verticalBars, [0.25, 0.5, 0.75]);
  assert.equal(end.recipe.elevations[1].openings.value.filter(o => /s[123]-/.test(o.id)).length, 0, 'no windows on the unseen tail');
});

/** A face's houses through the face planner (measured coping, shared ground, canopies), as the chunk compile builds them. */
function planned(faceId: string) {
  const dir = `scripts/block-face/faces/${faceId}`;
  const f = validateBlockFace(JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8')), JSON.parse(fs.readFileSync(`${dir}/discovery.json`, 'utf8')).members);
  const st = JSON.parse(fs.readFileSync(`${dir}/strip.json`, 'utf8'));
  const prep = prepareFaceFacts(f, new Map(f.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(`${dir}/pands/${h.pandId}/facts.json`, 'utf8'))])), {strip: {heightPx: st.height, pixelsPerMetre: st.pixelsPerMetre, groundNAP: st.groundNAP}});
  const k = (p: string) => prep.intents.findIndex(i => i.pandId.endsWith(p));
  return {face: f, prep, fit: (p: string) => fitIntent(prep.intents[k(p)], prep.ground.facts[k(p)])};
}

test('45-53: small panes all over; 43 and 45 stand on the shared street level despite a 1.1-1.4 m 3DBAG maaiveld', () => {
  const {face, fit} = planned('evertsen-43-57');
  const w = fit('127935').recipe.elevations[0].openings.value.find(o => o.id === 's2-b1')!;
  assert.deepEqual(w.verticalBars, [0.25, 0.5, 0.75]);
  assert.deepEqual(w.horizontalBars, [0.36, 0.8]);
  // One coping line: 45 (maaiveld 1.43 m NAP) gets the row's eaves, not 1.4 m less.
  assert.ok(Math.abs(fit('061604').report.fronts[0].eavesM - fit('094327').report.fronts[0].eavesM) < 0.1);
  const bad = structuredClone(face) as any;
  bad.continuity.streetLevel = 'stepped';
  assert.throws(() => validateBlockFace(bad, bad.houses.map((h: {pandId: string}) => h.pandId)), /streetLevelPands: only with streetLevel "shared"/);
});

test('68-92: the 2.6 m windows straddle the party walls (halves flush with the shared line), four lights with small-pane top lights', () => {
  const {fit} = planned('evertsen-68-92');
  const a = fit('144630'), b = fit('092098');
  const s2 = (x: typeof a) => x.recipe.elevations[0].openings.value.filter(o => /^s2-/.test(o.id)).sort((p, q) => p.leftM - q.leftM);
  const last = s2(a).at(-1)!, first = s2(b)[0];
  assert.ok(a.report.fronts[0].widthM - (last.leftM + last.widthM) < 0.05 && first.leftM < 0.05, `${last.leftM}+${last.widthM} | ${first.leftM}`);
  assert.ok(Math.abs(last.widthM + first.widthM - 2.62) < 0.15, 'the halves make one 2.6 m window');
  const full = s2(a).find(o => o.widthM > 2.4)!;
  assert.equal(full.diagonalBars?.length, 4);
});

test('52-56: the row house beside the low end keeps its own roof band (stepBody), not the tower-bay rule', () => {
  const {prep} = planned('evertsen-52-66');
  const r = prep.recipeRoofs!.find(x => x.pandId.endsWith('147483'))!;
  assert.ok(!r.notes.some(n => /tower bay/.test(n)), r.notes.join('; '));
  assert.ok(r.notes.some(n => /^per-front eaves 17\.\d+\/13\.\d+ m$/.test(n)), r.notes.join('; '));
});
