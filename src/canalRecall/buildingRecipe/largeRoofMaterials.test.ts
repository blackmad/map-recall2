/**
 * Large-tier roof materials from the orthophoto (`roof.flat`, `roof.surfaces`) and measured rear walls
 * (`measured.otherWalls`), with the named regression the user's frame raised (2026-10-16, riding north over the
 * Nijlpaardenbrug from the Plantage: "are these roofs broken in the game? they look disconnected"): the Entrepotdok
 * warehouses, pand 0363100012164981. Before: navy slate saddles (in-game luma 76) standing on pale gravel flat roofs
 * (luma 139) over an orange prior brick in the courtyards, beside a dark measured front. The 3DBAG shell itself was
 * closed; the disconnection was the materials.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {validateLargeIntent} from './largeIntent.ts';
import {compileBuilding} from './compile.ts';
import {roofMaterialOf, type CompiledLargeBuilding} from './largeCompile.ts';
import {largeRoofFit} from './fitLarge.ts';
import {topology} from './gates.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';
import {CITY_ROOF, cityRoofTint, hexToRgb, rgbToHsl} from '../look/palette.ts';
import {SUNNY_LIGHT_RIG, sunDirection} from '../rendererShared/lightRig.ts';
import {linearToSrgb, srgbToLinear} from '../look/sunny.ts';

const HOUSES = 'scripts/building-recipes/houses', ID = 'entrepotdok-164981';
const rawIntent = () => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/intent.json`, 'utf8'));
const facts = () => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/facts.json`, 'utf8'));
/** The front saddles the 2025 orthophoto shows in orange pantiles (intent roof.surfaces[0]). */
const RED_SADDLES = [320, 311, 291, 310, 292, 290, 319, 303, 305, 304, 296, 306, 312, 318, 314, 331, 297, 325, 326, 328, 288, 299, 315, 301, 293, 294];
/** The NW end's saddle, grey (slate) on the orthophoto. */
const SLATE_SADDLE = [300, 330];

test('large intent: roof.flat, roof.surfaces and measured.otherWalls are validated', () => {
  const base = rawIntent();
  assert.equal(validateLargeIntent(base).roof?.surfaces?.[0].material, 'red-tile');
  const roof = (r: object) => ({...base, roof: {...base.roof, ...r}});
  assert.throws(() => validateLargeIntent(roof({flat: 'gravel'})), /roof.flat/);
  assert.throws(() => validateLargeIntent(roof({tone: 'dark'})), /roof.tone: unknown field/);
  assert.throws(() => validateLargeIntent(roof({surfaces: [{roofSurfaces: [1], material: 'red-tile'}]})), /evidence/);
  assert.throws(() => validateLargeIntent(roof({surfaces: [{roofSurfaces: [1, 1], material: 'red-tile', evidence: 'x'}]})), /listed twice/);
  assert.throws(() => validateLargeIntent(roof({surfaces: [{roofSurfaces: [], material: 'red-tile', evidence: 'x'}]})), /roofSurfaces/);
  assert.throws(() => validateLargeIntent({...base, measured: {...base.measured, otherWalls: 'yes'}}), /measured.otherWalls/);
  // a listed surface that is not a roof plane of the pand fails the fit, not silently
  assert.throws(() => largeRoofFit({material: 'slate', surfaces: [{roofSurfaces: [9999], material: 'red-tile', evidence: 'x'}]}, facts(), [0, 0]), /9999/);
});

test('roofMaterialOf: no regions and no flat = the default material (unchanged output)', () => {
  const a = [0, 10, 0], b = [1, 10, 0], c = [0, 10, 1];
  for (const k of ['steep', 'low', 'flat'] as const) assert.equal(roofMaterialOf({material: 'slate'}, a, b, c, k), 'slate');
  assert.equal(roofMaterialOf({material: 'slate', flat: 'bitumen'}, a, b, c, 'flat'), 'bitumen');
  assert.equal(roofMaterialOf({material: 'slate', flat: 'bitumen'}, a, b, c, 'steep'), 'slate');
  const region = {material: 'red-tile' as const, surface: 1, rings: [[[-1, -1], [2, -1], [2, 2], [-1, 2]] as [number, number][]], yMin: 9.9, yMax: 10.1};
  assert.equal(roofMaterialOf({material: 'slate', regions: [region]}, a, b, c, 'flat'), 'red-tile');
  // same plan, another height: not that plane
  assert.equal(roofMaterialOf({material: 'slate', regions: [{...region, yMin: 14, yMax: 15}]}, a, b, c, 'steep'), 'slate');
});

/** Rendered sRGB luma of an albedo on a face with world normal `n` (x east, y up, z south) under the sunny rig (Lambert, exposure folded in). */
function sunnyLuma(hex: string, n: number[]): number {
  const r = SUNNY_LIGHT_RIG, [se, sn, su] = sunDirection(r.sunAzimuthDeg, r.sunElevationDeg);
  const lumY = (h: string) => { const [R, G, B] = hexToRgb(h).map(v => srgbToLinear(v)); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
  const cos = Math.max(0, n[0] * se + n[1] * su - n[2] * sn), up = (n[1] + 1) / 2;
  const E = (lumY(r.sunColour) * r.sunIntensity * cos + (lumY(r.skyColour) * up + lumY(r.groundColour) * (1 - up)) * r.skyIntensity) / Math.PI;
  return linearToSrgb(Math.min(1, lumY(hex) * E));
}

test('Entrepotdok 164981 (user 2026-10-16, Nijlpaardenbrug): roofs from the orthophoto meet their walls, one brick, no dark slate saddles', async () => {
  const intent = validateLargeIntent(rawIntent());
  const built = compileBuilding(intent, facts()) as CompiledLargeBuilding;
  const f = facts(), area = (ids: number[]) => f.roofsRD.filter((r: {surfaceId: string}) => ids.includes(Number(r.surfaceId.split(':').at(-1)))).reduce((s: number, r: {areaM2: number}) => s + r.areaM2, 0);
  // pitched roof plan area per material, from the compiled meshes (facts areaM2 is the plan area)
  const pitched = new Map<string, number>(), meshes: T.Mesh[] = [];
  built.group.traverse(o => { if (o instanceof T.Mesh) meshes.push(o); });
  const triArea = (m: T.Mesh) => { const p = m.geometry.getAttribute('position'); let s = 0; const v = [0, 1, 2].map(() => new T.Vector3()); for (let i = 0; i < p.count; i += 3) { v.forEach((x, k) => x.fromBufferAttribute(p, i + k)); s += Math.abs(new T.Vector3().subVectors(v[1], v[0]).cross(new T.Vector3().subVectors(v[2], v[0])).y) / 2; } return s; };
  for (const m of meshes.filter(m => m.userData.surface === 'roof' && !m.name.startsWith('roof/flat'))) {
    const mat = m.name.split('/')[2] ?? intent.roof!.material;
    pitched.set(mat, (pitched.get(mat) ?? 0) + triArea(m));
  }
  const red = pitched.get('red-tile') ?? 0, slate = pitched.get('slate') ?? 0;
  assert.ok(Math.abs(red - area(RED_SADDLES)) < 0.02 * area(RED_SADDLES), `red-tile pitched ${red.toFixed(1)} vs the ortho saddles ${area(RED_SADDLES).toFixed(1)} m²`);
  assert.ok(slate < area(SLATE_SADDLE) + 30, `slate pitched ${slate.toFixed(1)} m²: only the NW saddle (${area(SLATE_SADDLE).toFixed(1)}) and slanted wall bits`);
  // flat roofs: the dark membrane tone in the game, not the pale gravel the slate default's flat tone drew as
  const flats = meshes.filter(m => m.name.startsWith('roof/flat'));
  assert.ok(flats.length > 0);
  for (const m of flats) assert.equal(cityRoofTint('bitumen', '#' + (m.material as T.MeshStandardMaterial).color.getHexString()), CITY_ROOF.flat[2], m.name);
  // the red saddles draw red in the game (hue of the city pantile), and no pitched face draws near-black on its shade side
  for (const m of meshes.filter(m => m.userData.surface === 'roof' && m.name.endsWith('/red-tile'))) {
    const tint = cityRoofTint('roofTile', '#' + (m.material as T.MeshStandardMaterial).color.getHexString()), [h, s] = rgbToHsl(hexToRgb(tint));
    assert.ok((h < 30 / 360 || h > 340 / 360) && s >= 0.35, `${m.name}: ${tint}`);
  }
  let darkest = 255;
  for (const m of meshes.filter(m => m.userData.surface === 'roof' && !m.name.startsWith('roof/flat'))) {
    const slot = m.userData.materialSlot as 'roofTile' | 'slate', tint = cityRoofTint(slot, '#' + (m.material as T.MeshStandardMaterial).color.getHexString());
    m.geometry.computeVertexNormals();
    const nrm = m.geometry.getAttribute('normal');
    for (let i = 0; i < nrm.count; i += 3) darkest = Math.min(darkest, sunnyLuma(tint, [nrm.getX(i), nrm.getY(i), nrm.getZ(i)]));
  }
  assert.ok(darkest >= 70, `darkest pitched roof face luma ${darkest.toFixed(1)}`);
  // one brick: every brick wall mesh (fronts, rear, courtyards) carries a measured colour within a narrow band
  const bricks = meshes.filter(m => m.userData.surface === 'wall' && m.userData.materialSlot === 'brick');
  assert.ok(bricks.length >= 4);
  for (const m of bricks) assert.equal((m.material as T.Material).userData.tintSource, 'measured', m.name);
  const L = bricks.filter(m => !m.name.includes("arch@")).map(m => rgbToHsl(hexToRgb('#' + (m.material as T.MeshStandardMaterial).color.getHexString()))[2]);
  assert.ok(Math.max(...L) - Math.min(...L) < 0.06, `brick lightness spread (arch bands are a shade darker by design) ${L.map(v => v.toFixed(3)).join(' ')}`);
  // roofs meet their walls: a closed shell, no floating component, within the gate's 2 cm
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const topo = topology(await decodeTriangles(glb.bytes));
  assert.equal(topo.openEdges, 0, JSON.stringify(topo.openEdgeSamples));
  assert.deepEqual(topo.floating, []);
});
