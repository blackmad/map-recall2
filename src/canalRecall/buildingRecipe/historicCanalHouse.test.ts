/**
 * Historic canal-house library (De Wallen, 17th/18th c., 2026-10-10) and the Bilderdijkstraat gaps found with it:
 * gable ornament, front lean, ground fronts (pier arcades, timber pui, door + shutters), cornice paint, party-wall
 * clipping, mansards with pedimented dormers, several houses in one BAG pand, several gables on one front, towers and
 * triple gable lights. Every field is opt-in; `fit-golden` (last test) proves houses without them fit byte-identically.
 * Fixtures: the committed wallen-oza-41-57 and bilder-* face facts (read only).
 *   node --import tsx --test src/canalRecall/buildingRecipe/historicCanalHouse.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {compileBuilding} from './compile.ts';
import {fitIntent, fitGableLights, splitChain} from './fit.ts';
import {crownLandmarks, gableOrnaments, volute} from './gableOrnament.ts';
import {LEAN_FADE_M, MAX_LEAN_SHIFT_M} from './historicPasses.ts';
import {houseIntents} from '../blockFace/intent.ts';
import {fitHashes, readGolden} from '../../../scripts/building-recipes/fit-golden.ts';
import type {BuildingFacts} from './facts.ts';
import type {CanalhousePoint} from '../canalhouseRecipes.ts';

const F = 'scripts/block-face/faces';
const faceFacts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`${F}/${face}/pands/${pand}/facts.json`, 'utf8'));
const wallen = JSON.parse(fs.readFileSync(`${F}/wallen-oza-41-57/intent.json`, 'utf8'));
const wallenIntent = (pand: string) => houseIntents(wallen).find(i => i.pandId === pand)!;
const variant = (base: CanalHouseIntent, front: Partial<FrontIntent>, house: Partial<CanalHouseIntent> = {}) => validateIntent({...base, ...house, fronts: [{...base.fronts[0], ...front}]});
const meshes = (g: T.Object3D) => { const out: T.Mesh[] = []; g.updateMatrixWorld(true); g.traverse(o => { if (o instanceof T.Mesh) out.push(o); }); return out; };
const worldPoints = (m: T.Mesh) => { const p = m.geometry.getAttribute('position'); return Array.from({length: p.count}, (_, i) => new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); };
/** Max height of all geometry, and the facade-frame z of a named mesh's highest point. */
const facadeZ = (b: ReturnType<typeof compileBuilding>, test: (m: T.Mesh) => boolean) => {
  const facade = b.group.getObjectByName(`elevation/${b.fit.fronts[0].id}`)!, inv = facade.matrixWorld.clone().invert();
  return meshes(b.group).filter(test).flatMap(worldPoints).map(v => v.clone().applyMatrix4(inv));
};

// Oudezijds Achterburgwal 51 (Rijksmonument 14): neck gable with natural-stone wing pieces.
const P51 = '0363100012177920', f51 = faceFacts('wallen-oza-41-57', P51);
const plain51 = (): CanalHouseIntent => { const i = wallenIntent(P51); const {gableOrnament, groundFront, partyClip, ...front} = i.fronts[0]; return validateIntent({...i, fronts: [front]}); };

test('validator: historic fields are typed and checked', () => {
  const base = plain51();
  assert.throws(() => variant(base, {gableOrnament: {wings: 'volutes'}, gable: 'cornice'}), /wing pieces fill the shoulders/);
  assert.throws(() => variant(base, {gableOrnament: {gablet: 'crest'}}), /rooftop gablet stands on a cornice/);
  assert.throws(() => variant(base, {gableOrnament: {wings: 'feathers' as any}}), /gableOrnament.wings/);
  assert.throws(() => variant(base, {leanDegrees: 5}), /leanDegrees: 0..3/);
  assert.throws(() => variant(base, {groundFront: {kind: 'arcade', bays: ['door', 'gate' as any]}}), /groundFront.bays\[1\]/);
  assert.throws(() => variant(base, {groundFront: {kind: 'arcade', bays: ['door']}, shopfront: {colour: 'cream', fascia: false}}), /not together with shopfront/);
  assert.throws(() => variant(base, {roofFront: 'mansard'}), /mansard rises behind a cornice/);
  assert.throws(() => variant(base, {crownGroups: [{from: 0, to: 1}, {from: 1, to: 2}]}), /non-overlapping/);
  assert.throws(() => variant(base, {tower: {bays: {from: 0, to: 0}, rise: 9, cap: 'pyramid'}}), /tower.rise/);
  assert.throws(() => variant(base, {dormerStyle: 'pediment'}), /needs dormers/);
  assert.throws(() => variant(base, {}, {palette: {...base.palette, cornice: 'plaid'}}), /palette.cornice/);
  assert.doesNotThrow(() => variant(base, {gableOrnament: {wings: 'volutes', ears: true, cartouche: true, finial: 'crab'}, leanDegrees: 1.5, groundFront: {kind: 'pui', bays: ['door', 'window', 'shutter'], shutterColour: '#8a8a84'}, partyClip: true}));
});

test('gable ornament: wings, volutes, ears, cartouche and finial follow the fitted neck crown', () => {
  const b = compileBuilding(variant(plain51(), {gableOrnament: {wings: 'volutes', ears: true, cartouche: true, finial: 'crab'}}), f51);
  const crown = b.recipe.elevations[0].crown!.value.profile, lm = crownLandmarks(crown)!, eaves = b.fit.fronts[0].eavesM;
  assert.ok(lm, 'neck crown has a neck');
  const ornaments = b.recipe.elevations[0].ornaments!.value, ids = ornaments.map(o => o.id);
  for (const id of ['wing-l', 'wing-r', 'volute-l', 'volute-r', 'ear-l', 'ear-r', 'cartouche', 'finial']) assert.ok(ids.includes(id), `${id} present`);
  const W = b.fit.fronts[0].widthM;
  for (const o of ornaments) assert.ok(o.profile.every(([x, y]) => x >= 0 && x <= W + 1e-3 && y >= 0), `${o.id} stays on its facade`);
  // Wings lie on the shoulders (between the eaves and the neck foot), the finial above the cap.
  const wing = ornaments.find(o => o.id === 'wing-l')!;
  // (the facade x may run right-to-left: a mirrored front puts the viewer's left wing on the right shoulder)
  const xs = wing.profile.map(p => p[0]);
  assert.ok((Math.max(...xs) <= lm.neckLeft + 1e-3 || Math.min(...xs) >= lm.neckRight - 1e-3) && Math.min(...wing.profile.map(p => p[1])) >= eaves - 1e-6, 'wing on a shoulder');
  const finial = ornaments.find(o => o.id === 'finial')!;
  assert.ok(Math.min(...finial.profile.map(p => p[1])) >= lm.topY - 0.05 && Math.max(...finial.profile.map(p => p[1])) > lm.topY + 0.3, 'finial stands on the top');
  // Stone paint, simple polygons.
  assert.equal(new Set(ornaments.filter(o => /wing|volute|finial|cartouche|ear/.test(o.id)).map(o => o.fill)).size, 1);
  assert.ok(meshes(b.group).some(m => m.name.startsWith('ornament/volute-l')));
});

test('gable ornament: a crest stands on a cornice front; no neck means no wings', () => {
  const crest = gableOrnaments({ornament: {gablet: 'crest', wings: 'volutes'}, profile: [[0, 14], [6, 14]], eavesM: 14, widthM: 6, idPrefix: ''});
  assert.deepEqual(crest.ornaments.map(o => o.id), ['gablet', 'gablet-volute-l', 'gablet-volute-r']);
  assert.match(crest.warnings[0], /no neck/);
  assert.ok(crest.ornaments[0].profile.every(([x, y]) => y >= 13.98 && x > 2 && x < 4));
  const v = volute(1, 1, 0.3);
  assert.ok(v.length === 30 && v.every(([x, y]) => Math.hypot(x - 1, y - 1) <= 0.3 + 1e-6));
});

test('ground fronts: arcade, pui and wall bays become separate openings between piers, no shop glass', () => {
  const arcade = compileBuilding(variant(plain51(), {groundFront: {kind: 'arcade', bays: ['glazed-door', 'window', 'glazed-door'], colour: 'cream-painted'}}), f51);
  const e = arcade.recipe.elevations[0], gf = e.openings.value.filter(o => o.id.startsWith('gf-'));
  assert.deepEqual(gf.map(o => o.id).sort(), ['gf-b0-door', 'gf-b0-transom', 'gf-b1-window', 'gf-b2-door', 'gf-b2-transom'].sort());
  assert.ok(!e.openings.value.some(o => /^s0-b|shop/.test(o.id)), 'no ordinary ground windows or shop glass');
  const piers = e.blocks!.value.filter(b => b.id.startsWith('gf-pier'));
  assert.equal(piers.length, 4);
  // Openings sit between the piers, never on them.
  for (const o of gf) for (const p of piers) assert.ok(o.leftM >= p.leftM + p.widthM - 1e-6 || o.leftM + o.widthM <= p.leftM + 1e-6, `${o.id} clear of ${p.id}`);
  assert.equal(arcade.recipe.palette.value.shop, '#d9ccaa', 'piers paint in the ground front colour');
  const wall = compileBuilding(variant(plain51(), {groundFront: {kind: 'wall', bays: ['door', 'shutter', 'shutter'], shutterColour: '#8a8a84'}}), f51);
  const shutters = meshes(wall.group).filter(m => /gf-b\d-shutter\/pane$/.test(m.name));
  assert.equal(shutters.length, 2);
  assert.ok(shutters.every(m => (m.material as T.MeshStandardMaterial).color.getHexString() === '8a8a84'), 'roller shutters take shutterColour');
  assert.ok(!wall.recipe.elevations[0].blocks?.value.some(b => b.id.startsWith('gf-pier')), 'wall bays have brick piers');
  assert.throws(() => fitIntent(variant(plain51(), {groundFront: {kind: 'arcade', bays: ['door', 'door', 'door', 'door', 'door', 'door', 'door', 'door']}}), f51), /do not fit/);
});

test('cornice paint is separate from the window frames', () => {
  const P45 = '0363100012177924', i45 = wallenIntent(P45), f45 = faceFacts('wallen-oza-41-57', P45);
  const b = compileBuilding(variant(i45, {partyClip: undefined, gableOrnament: undefined}), f45);
  const colour = (m: T.Mesh) => (m.material as T.MeshStandardMaterial).color.getHexString();
  const cornice = meshes(b.group).filter(m => m.name.startsWith('cornice/')), frames = meshes(b.group).filter(m => /^opening\/s\d-b\d\/frame$/.test(m.name));
  assert.ok(cornice.length && frames.length);
  assert.ok(cornice.every(m => colour(m) === 'd9ccaa'), 'cream cornice');
  assert.ok(frames.every(m => colour(m) === '2e2a26'), 'dark frames');
  // Without palette.cornice the cornice keeps the frame paint.
  const plain = compileBuilding(variant(i45, {partyClip: undefined, gableOrnament: undefined}, {palette: {...i45.palette, cornice: undefined}}), f45);
  assert.ok(meshes(plain.group).filter(m => m.name.startsWith('cornice/')).every(m => colour(m) === '2e2a26'));
});

test('party clip: cornice ends follow an oblique party wall (Oudezijds Achterburgwal 43, ~17 degrees)', () => {
  const P43 = '0363100012177915', i43 = wallenIntent(P43), f43 = faceFacts('wallen-oza-41-57', P43);
  const reach = (clip: boolean) => {
    const b = compileBuilding(variant(i43, {partyClip: clip}), f43), ring = b.recipe.footprint.value[b.fit.fronts[0].polygonIndex].outer, [i0, i1] = b.fit.fronts[0].edge, n = ring.length;
    const facade = b.group.getObjectByName('elevation/front0')!, inv = facade.matrixWorld.clone().invert(), loc = (p: CanalhousePoint) => new T.Vector3(p[0], 0, p[1]).applyMatrix4(inv);
    // Distance past each party line (positive = into the neighbour) of every cornice vertex in front of the wall.
    const lines = [[loc(ring[i0]), loc(ring[(i0 - 1 + n) % n]), 1], [loc(ring[i1]), loc(ring[(i1 + 1) % n]), -1]] as const;
    let worst = 0;
    for (const v of facadeZ(b, m => m.name.startsWith('cornice/'))) for (const [a, p, side] of lines) {
      const d = a.clone().sub(p); if (d.z < 0.2 * d.length()) continue;
      const lineX = a.x + (v.z - a.z) * d.x / d.z;
      worst = Math.max(worst, side * (lineX - v.x));
    }
    return worst;
  };
  const before = reach(false), after = reach(true);
  assert.ok(before > 0.03, `unclipped cornice crosses the party plane (${before.toFixed(3)} m)`);
  assert.ok(after < 0.002, `clipped cornice stays on its side (${after.toFixed(4)} m)`);
});

test('front lean: the top moves out by height x tan(lean), the ground and the rear stay', () => {
  const base = plain51(), flat = compileBuilding(base, f51), leaning = compileBuilding(variant(base, {leanDegrees: 1.5}), f51);
  const top = (b: ReturnType<typeof compileBuilding>) => Math.max(...facadeZ(b, m => m.name.startsWith('crown/') && !m.name.includes('edge')).filter(v => v.y > b.fit.fronts[0].crownTopM - 0.2).map(v => v.z));
  const shift = top(leaning) - top(flat), h = leaning.fit.fronts[0].crownTopM;
  assert.ok(Math.abs(shift - Math.min(MAX_LEAN_SHIFT_M, h * Math.tan(1.5 * Math.PI / 180))) < 0.03, `crown top moved ${shift.toFixed(3)} m (expected ~${(h * Math.tan(1.5 * Math.PI / 180)).toFixed(3)})`);
  // Ground vertices and anything deeper than the fade do not move.
  const shell = (b: ReturnType<typeof compileBuilding>) => meshes(b.group).filter(m => m.name === 'shell/0').flatMap(worldPoints);
  const a = shell(flat), c = shell(leaning);
  assert.equal(a.length, c.length);
  for (let i = 0; i < a.length; i++) if (a[i].y < 1e-3) assert.ok(a[i].distanceTo(c[i]) < 1e-6, 'ground ring unchanged');
  const facade = flat.group.getObjectByName('elevation/front0')!, inv = facade.matrixWorld.clone().invert();
  for (let i = 0; i < a.length; i++) if (-a[i].clone().applyMatrix4(inv).z > LEAN_FADE_M + 0.5) assert.ok(a[i].distanceTo(c[i]) < 1e-6, 'rear unchanged');
});

test('mansard with a pedimented dormer (Oudezijds Achterburgwal 43)', () => {
  const P43 = '0363100012177915', b = compileBuilding(wallenIntent(P43), faceFacts('wallen-oza-41-57', P43));
  const m = b.fit.fronts[0].mansard!;
  assert.ok(m && m.heightM >= 1.4 && m.heightM <= 2.6 && Math.abs(Math.atan2(m.heightM, m.setbackM) * 180 / Math.PI - 72) < 1);
  assert.ok(meshes(b.group).some(x => x.name === 'mansard/front0' && x.userData.surface === 'roof'));
  const d = b.recipe.elevations[0].dormers!.value[0];
  assert.ok(d.frontOverhangM === 0.12 && d.roofRiseM >= 0.4 && d.wallSurface === 'trim', 'pediment: projecting trim gable');
  assert.ok((d.setbackM ?? 0) <= 0.1, 'dormer stands on the mansard face, not behind it');
});

test('several houses in one straight BAG pand: fronts split at an inserted vertex (Bilderdijkstraat 162443)', () => {
  const facts = faceFacts('bilder-233580-162444', '0363100012162443'), fr = facts.fronts[0];
  const cut = splitChain(fr, [1 / 3, 1 / 3, 1 / 3]);
  assert.ok(cut.inserted.length >= 1, 'a straight front gets vertices where no footprint vertex is within 1.5 m');
  const front = (id: string, share: number, gable: FrontIntent['gable']): FrontIntent => ({id, street: fr.street, share, gable, storeys: 4, bays: 2, doorBay: null, basement: 'none', cornice: 'simple', windows: 'sash', hoist: false});
  const intent = validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'split-test', pandId: facts.pandId, address: 'test', sources: [{id: 's', kind: 'street-panorama', capturedAt: '2025-01-01'}],
    fronts: [front('a', 1 / 3, 'cornice'), front('b', 1 / 3, 'step'), front('c', 1 / 3, 'cornice')], roof: {material: 'slate'}, palette: {brick: 'red-brown', frame: 'white', door: 'black'}});
  const b = compileBuilding(intent, facts), widths = b.fit.fronts.map(f => f.widthM);
  assert.ok(widths.every(w => Math.abs(w - fr.widthM / 3) < 0.35), `near-equal thirds (an existing vertex within 1.5 m still snaps): ${widths}`);
  assert.ok(b.fit.warnings.some(w => /vertex inserted/.test(w)));
  // Each front keeps its own eaves from its share of the 3DBAG profile; the footprint area is unchanged.
  const area = (r: number[][]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
  assert.ok(Math.abs(area(b.recipe.footprint.value[0].outer) - area(facts.surveyFootprintPolygonsRD[0][0])) < 0.01);
});

test('several gables on one front (crownGroups) and a tower over one bay', () => {
  const facts = faceFacts('bilder-236189-166159', '0363100012236189'), fr = facts.fronts[0];
  const base = {schemaVersion: 1, kind: 'canal-house', id: 'gables-test', pandId: facts.pandId, address: 'test', sources: [{id: 's', kind: 'street-panorama', capturedAt: '2025-01-01'}], roof: {material: 'slate'}, palette: {brick: 'red-brown', frame: 'white', door: 'black'}};
  const front = {id: 'front0', street: fr.street, storeys: 4, bays: 6, doorBay: null, basement: 'none', cornice: 'simple', windows: 'sash', hoist: false};
  const two = compileBuilding(validateIntent({...base, fronts: [{...front, gable: 'point', atticWindows: 1, crownGroups: [{from: 0, to: 1}, {from: 4, to: 5}]}]}), facts);
  const peaks = (p: CanalhousePoint[]) => p.filter((v, i) => i > 0 && i < p.length - 1 && v[1] > p[i - 1][1] && v[1] > p[i + 1][1]).length;
  assert.equal(peaks(two.recipe.elevations[0].crown!.value.profile), 2, 'two pointed gables');
  assert.equal(two.recipe.elevations[0].openings.value.filter(o => o.id.startsWith('attic-')).length, 2, 'one gable light each');
  const tower = compileBuilding(validateIntent({...base, fronts: [{...front, gable: 'cornice', tower: {bays: {from: 0, to: 0}, rise: 1.2, cap: 'pyramid'}}]}), facts);
  const t = tower.fit.fronts[0].towers![0];
  assert.ok(t.topM > tower.fit.fronts[0].eavesM + 2.5 && t.widthM > 1);
  assert.ok(meshes(tower.group).some(m => m.name.endsWith('/cap') && m.userData.surface === 'roof') && meshes(tower.group).some(m => m.name.endsWith('/body')));
  assert.ok(tower.recipe.elevations[0].openings.value.some(o => o.id.startsWith('tower-')), 'tower light');
});

test('triple gable lights shrink to fit a narrow crown instead of throwing "Opening escapes its wall"', () => {
  const profile: CanalhousePoint[] = [[0, 10], [2, 13], [4, 10]], warnings: string[] = [];
  const lights = fitGableLights(profile, [0, 1, 2].map(k => ({left: 0.6 + k * 1.05, width: 0.9, bottom: 10.25, height: 1.4})), warnings, 't');
  assert.equal(lights.length, 3);
  const at = (x: number) => x <= 2 ? 10 + 1.5 * x : 10 + 1.5 * (4 - x);
  for (const l of lights) assert.ok(l.bottom + l.height <= Math.min(at(l.left), at(l.left + l.width)) - 0.12 + 1e-6);
  assert.match(warnings[0], /shrunk/);
  const ok = [{left: 1.5, width: 1, bottom: 10.25, height: 0.5}];
  assert.equal(fitGableLights(profile, ok, [], 't'), ok, 'lights that fit are untouched');
  // Bilderdijkstraat 164451's triple-light gable compiles with three lights.
  const face = JSON.parse(fs.readFileSync(`${F}/bilder-164451-156126/intent.json`, 'utf8')), house = face.houses.find((h: any) => JSON.stringify(h.rhythm).includes('triple arched window'));
  const intent = houseIntents(face).find(i => i.pandId === house.pandId)!;
  const triple = validateIntent({...intent, fronts: intent.fronts.map((f, i) => i === 0 ? {...f, atticWindows: 3} : f)});
  const b = compileBuilding(triple, faceFacts('bilder-164451-156126', house.pandId));
  assert.equal(b.recipe.elevations[0].openings.value.filter(o => /attic-\d$/.test(o.id)).length, 3);
});

test('fit-golden: every per-house recipe without the historic fields is byte-identical', () => {
  const golden = readGolden(), now = fitHashes();
  assert.deepEqual(Object.keys(now).sort(), Object.keys(golden).sort());
  for (const [id, h] of Object.entries(golden)) assert.equal(now[id], h, `${id} changed`);
});
