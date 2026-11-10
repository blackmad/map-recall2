/**
 * Canal-belt kit (lane belt-gg-west 2026-11-10): attic lights in an entablature frieze (`friezeVents.sill` +
 * `friezeVents.light`), measured on Herengracht 92 and 94 (2021-01-25 strip). Validated, drawn as one dark light per
 * top-storey axis inside the frieze, and a front without the key (or with the Helmersbuurt `drop` form) is unchanged.
 *   node --import tsx --test src/canalRecall/buildingRecipe/grachtengordelWest.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {resolvePlacement} from '../blockFace/houseType.ts';
import {defaultTypeLoader} from '../blockFace/typeLibrary.ts';
import {ENTABLATURE} from './entablature.ts';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/${pand}/facts.json`, 'utf8'));
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };

function house(edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const t = defaultTypeLoader('ggw-1740-frieze-cornice')!;
  const design = resolvePlacement(t, {type: t.id}, 'Herengracht').design;
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'herengracht-175700', pandId: '0363100012175700', address: 'Herengracht 92', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2021-01-25'}], ...design, notes: []} as CanalHouseIntent);
}
const bad = (h: CanalHouseIntent, patch: Partial<FrontIntent>) => () => validateIntent({...h, fronts: h.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);

test('frieze attic lights: validation of sill/light/drop', () => {
  const h = house();
  const fv = h.fronts[0].friezeVents!;
  assert.throws(bad(h, {friezeVents: {...fv, drop: 0.2}}), /one of drop .* or sill/);
  assert.throws(bad(h, {friezeVents: {span: 1.1, rise: 0.45}}), /one of drop .* or sill/);
  assert.throws(bad(h, {friezeVents: {...fv, sill: 2.0}}), /friezeVents.sill/);
  assert.throws(bad(h, {friezeVents: {...fv, slot: true}}), /light or slot/);
  assert.throws(bad(h, {friezeVents: {...fv, span: 0.15}}), /friezeVents.light/);
  assert.throws(bad(h, {entablature: undefined, cornice: 'simple'}), /needs an entablature/);
});

test('frieze attic lights: one dark light per axis inside the entablature frieze of Herengracht 92; none without the key', async () => {
  const f = facts('herengracht-84-148', '0363100012175700');
  const built = await compileBuilding(house(), f);
  const panels = meshes(built.group, /^frieze-vents\/.*\/panels$/), lights = meshes(built.group, /^frieze-vents\/.*\/lights$/);
  assert.equal(panels.length, 1);
  assert.equal(lights.length, 1);
  assert.equal(lights[0].userData.surface, 'door');
  assert.equal(lights[0].geometry.getAttribute('position').count, 3 * 30, 'three lights of 5 faces');
  assert.equal(panels[0].geometry.getAttribute('position').count, 3 * 4 * 30, 'a frame of four bars round each light');
  // The lights stand in the frieze: their foot is the entablature foot + sill, their face proud of the frieze face.
  const box = new T.Box3().setFromBufferAttribute(lights[0].geometry.getAttribute('position') as T.BufferAttribute);
  const p = new T.Box3().setFromBufferAttribute(panels[0].geometry.getAttribute('position') as T.BufferAttribute);
  assert.ok(box.max.z > ENTABLATURE.friezeDepthM, 'pane in front of the frieze face');
  assert.ok(Math.abs((box.min.y - p.min.y) - 0.07) < 1e-3 && Math.abs((p.max.y - p.min.y) - 0.45) < 1e-3, 'a 0.45 m frame, the pane 7 cm inside its edge');
  assert.ok(p.max.z - box.max.z >= 0.035 - 1e-6 && box.max.z - ENTABLATURE.friezeDepthM >= 0.035 - 1e-6, 'frame, pane and frieze faces 3.5 cm apart');
  const without = await compileBuilding(house(fr => { delete fr.friezeVents; }), f);
  assert.equal(meshes(without.group, /^frieze-vents/).length, 0);
});

test('resizePerStorey keeps a souterrain weight first (a cornice house of four storeys drawn with three)', async () => {
  const {resizePerStorey} = await import('../blockFace/houseType.ts');
  const body = {bays: 3, storeyHeights: [1.9, 4.0, 3.05, 2.65, 2.6], windowHeights: [0.82, 0.79, 0.68, 0.65], headLines: [0.875, 0.885, 0.81, 0.81]};
  const three = resizePerStorey(body, 4, 3);
  assert.deepEqual(three.storeyHeights, [1.9, 4.0, 3.05, 2.6]);
  assert.deepEqual(three.windowHeights, [0.82, 0.79, 0.65]);
  assert.deepEqual(resizePerStorey({bays: 3, storeyHeights: [3, 2, 2]}, 3, 4).storeyHeights, [3, 2, 2, 2], 'a list without a souterrain entry is unchanged in behaviour');
});

// ---- Round 2 (2026-11-10): sized gablets and the Louis XIV crest, attic light size, reviewer ground/door pins. ----
import {gableOrnaments} from './gableOrnament.ts';
import {typePinProblems} from '../blockFace/reviewCrowns.ts';
import {decidePand, type MatchableType, type PandEvidence, type StripEvidence} from '../blockFace/autoPlace.ts';

const flat = (w: number, eaves: number) => [[0, eaves], [w, eaves]] as [number, number][];
const bbox = (pts: [number, number][]) => ({x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1]))});

test('gablets: without gabletSize the small default piece is unchanged; a size scales it to the measure', () => {
  const small = gableOrnaments({ornament: {gablet: 'pediment'}, profile: flat(8.6, 14.9), eavesM: 14.9, widthM: 8.6, idPrefix: ''}).ornaments;
  const b0 = bbox(small[0].profile);
  assert.equal(+(b0.x1 - b0.x0).toFixed(4), 1.6, 'default 1.6 m pediment');
  assert.equal(+(b0.y1 - 14.88).toFixed(4), +(0.22 + 1.6 * 0.42).toFixed(4));
  // Herengracht 96: a 4.2 x 1.6 m pediment over the centre two bays.
  const big = gableOrnaments({ornament: {gablet: 'pediment', gabletSize: {span: 4.2, rise: 1.6}}, profile: flat(8.6, 14.9), eavesM: 14.9, widthM: 8.6, idPrefix: ''}).ornaments;
  const b1 = bbox(big[0].profile);
  assert.ok(Math.abs(b1.x1 - b1.x0 - 4.2) < 1e-3 && Math.abs((b1.x0 + b1.x1) / 2 - 4.3) < 1e-3, 'centred, 4.2 m');
  assert.ok(Math.abs(b1.y1 - (14.88 + 1.6)) < 1e-3, 'apex at the measured rise');
  // Keizersgracht 254: a semicircular crest 3.5 x 1.3 m.
  const crest = gableOrnaments({ornament: {gablet: 'crest', gabletSize: {span: 3.5, rise: 1.3}}, profile: flat(5.63, 14), eavesM: 14, widthM: 5.63, idPrefix: ''}).ornaments;
  const b2 = bbox(crest[0].profile);
  assert.ok(Math.abs(b2.x1 - b2.x0 - 3.5) < 1e-3 && Math.abs(b2.y1 - (13.98 + 1.3)) < 1e-3);
});

test('gablets: the Louis XIV crest of Keizersgracht 246 spans the front with scrolls, a crab and a light 4 cm proud', () => {
  const made = gableOrnaments({ornament: {gablet: 'louis', gabletSize: {span: 5.2, rise: 2.1}, gabletLight: 'arched'}, profile: flat(5.61, 17.06), eavesM: 17.06, widthM: 5.61, idPrefix: ''}).ornaments;
  assert.deepEqual(made.map(o => o.id), ['gablet', 'gablet-volute-l', 'gablet-volute-r', 'gablet-finial', 'gablet-light']);
  const body = bbox(made[0].profile);
  assert.ok(Math.abs(body.x1 - body.x0 - 5.2) < 1e-3, 'across the front');
  assert.ok(Math.abs(body.y1 - (17.04 + 2.1)) < 1e-3, 'arch top at the rise');
  const light = made.at(-1)!;
  assert.equal(light.fill, 'shop');
  assert.ok(light.depthM - made[0].depthM >= 0.035, 'light face clear of the crest face (z-fight band)');
  const lb = bbox(light.profile);
  assert.ok(lb.x0 > body.x0 && lb.x1 < body.x1 && lb.y0 > body.y0 && lb.y1 < body.y1, 'the light stands inside the crest');
  // A simple polygon: no point repeats.
  assert.equal(new Set(made[0].profile.map(p => p.join())).size, made[0].profile.length);
});

test('gablets: validation of gabletSize and gabletLight', () => {
  const h = house();
  const at = (o: object) => () => validateIntent({...h, fronts: h.fronts.map(f => ({...f, gableOrnament: o}))} as CanalHouseIntent);
  assert.throws(at({gabletSize: {span: 4, rise: 1}}), /gabletSize: needs a gablet/);
  assert.throws(at({gablet: 'pediment', gabletSize: {span: 4, rise: 5}}), /gabletSize/);
  assert.throws(at({gablet: 'pediment', gabletLight: 'oculus'}), /gabletLight/);
  assert.doesNotThrow(at({gablet: 'louis', gabletSize: {span: 5.2, rise: 2.1}, gabletLight: 'oculus'}));
});

test('atticSize: Keizersgracht 256 neck light 1.3 x 1.6 m just over the shoulders; absent = the fitted light', async () => {
  const t = defaultTypeLoader('ggw-1700-neck-bell-gable')!;
  const design = resolvePlacement(t, {type: t.id, crown: 'neck', storeys: 4}, 'Keizersgracht').design;
  const intent = (edit?: (f: FrontIntent) => void) => { const d = structuredClone(design); if (edit) d.fronts.forEach(edit); return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'keizersgracht-169390', pandId: '0363100012169390', address: 'Keizersgracht 256', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2021-01-22'}], ...d, notes: []} as CanalHouseIntent); };
  const f = facts('keizersgracht-240-312', '0363100012169390');
  const {fitIntent} = await import('./fit.ts');
  const attic = (i: CanalHouseIntent) => fitIntent(i, f).recipe.elevations.flatMap(e => e.openings.value).filter(o => /attic-0/.test(o.id));
  const [sized] = attic(intent());
  assert.ok(sized && Math.abs(sized.widthM - 1.3) < 1e-3 && Math.abs(sized.heightM - 1.6) < 1e-3, `sized light ${JSON.stringify(sized)}`);
  const [fitted] = attic(intent(fr => { delete fr.atticSize; }));
  assert.ok(fitted && fitted.widthM <= 0.9 && Math.abs(fitted.bottomM - sized.bottomM + 0.15 - 0.25) < 1e-3, 'fitted light: <= 0.9 m wide, 0.25 m over the eaves');
  assert.throws(() => intent(fr => { fr.atticSize = {span: 5, rise: 1}; }), /atticSize/);
  assert.throws(() => intent(fr => { fr.atticWindows = 0; }), /atticSize: needs atticWindows/);
});

test('reviewer pins: ground and doorBay are checked against the type and drawn (Herengracht 96: street door in the third of four bays)', () => {
  const types = [defaultTypeLoader('ggw-1740-frieze-cornice')!];
  const base = {face: 'herengracht-84-148', types: ['ggw-1740-frieze-cornice'], pands: ['0363100012167714'], reason: 'r'};
  assert.deepEqual(typePinProblems([{...base, ground: 'door-street', doorBay: 2}], types as never), []);
  assert.match(typePinProblems([{...base, ground: 'no-such-ground'}], types as never).join(), /not a ground/);
  assert.match(typePinProblems([{...base, doorBay: -1}], types as never).join(), /doorBay/);
  const strip: StripEvidence = {date: '2021-01-25', px: [0, 344], palette: {wall: '#a7a08a', accent: '#e0e0e0', frame: '#e0e0e0', band: null, cornice: '#dddddd', fascia: '#333333', shares: {wall: 0.8, accent: 0.05, glass: 0.15}, stucco: false, bandRunsM: [], wallHsl: null, pixels: 1000}, wall: '#a7a08a', skyline: null, voidShare: 0, foliageShare: 0, columns: 4, doorSide: 'right', accentSide: null};
  const ev: PandEvidence = {pandId: '0363100012167714', address: 'Herengracht 96B', builtYear: 1740, widthM: 8.6, eavesM: 16.39, roofMaxM: 19, storeys3dbag: 5, groundUses: ['woonfunctie'], osm: [], strip};
  const d = decidePand(types as MatchableType[], ev, 'x', '2021-01-25', {accept: true, storeys: 4, ground: 'door-street', doorBay: 2});
  assert.equal(d.kind, 'placed');
  if (d.kind !== 'placed') return;
  assert.equal(d.house.type!.ground, 'door-street');
  assert.equal(d.house.type!.doorBay, 2);
  const plain = decidePand(types as MatchableType[], ev, 'x', '2021-01-25', {accept: true, storeys: 4});
  assert.ok(plain.kind === 'placed' && plain.house.type!.ground === undefined && plain.house.type!.doorBay === undefined, 'no pin: unchanged');
});
