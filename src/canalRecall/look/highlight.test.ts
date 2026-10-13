import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DESATURATE_RADIUS_M, HIDDEN, HIGHLIGHT_GLSL, HIGHLIGHT_RECIPES, accentSeparation, applyMeshHighlight, attachHighlightPasses, baseMaterialOf,
  detachHighlightPasses, highlightAccent, highlightDefines, highlightMaterialFor, highlightStyle, metresBetween, withinDesaturation,
} from './highlight.ts';
import { landmarkHighlightStates } from './highlightLandmarks.ts';
import { beaconAlpha, convexHull, mercatorFromLocal, mercatorOf, ringBand, ringOutline } from './highlightMarker.ts';
import { HIGHLIGHT_CORAL, HIGHLIGHT_YELLOW, HUD_ACCENT } from './palette.ts';
import { createCityLookMaterial, createCityUniforms, variantDefines } from './cityLook.ts';

test('style: ?highlight=a|b|c, aliases, and today\'s yellow by default', () => {
  assert.equal(highlightStyle(''), 'yellow');
  assert.equal(highlightStyle('?highlight=a'), 'a');
  assert.equal(highlightStyle('?highlight=rim'), 'b');
  assert.equal(highlightStyle('?highlight=C'), 'c');
  assert.equal(highlightStyle('?highlight=bogus'), 'yellow');
  assert.equal(highlightAccent('yellow', ''), HIGHLIGHT_YELLOW);
  assert.equal(highlightAccent('a', ''), HIGHLIGHT_CORAL);
  assert.equal(highlightAccent('a', '?highlightAccent=hud'), HUD_ACCENT);
});

test('yellow compiles today\'s programs: no define, and the paint branch is the old `vHighlight > 0.5` for states 0/1', () => {
  assert.deepEqual(highlightDefines('yellow'), {});
  assert.deepEqual(highlightDefines('a'), { HL_KEEP: '' });
  assert.match(HIGHLIGHT_GLSL, /#define HL_PAINT\(h\) \(\(h\) > 0\.5 && \(h\) < 1\.5\)/);
  assert.match(HIGHLIGHT_GLSL, /#define HL_PAINT\(h\) false/);
  // The yellow style never writes the dim state.
  assert.equal(HIGHLIGHT_RECIPES.yellow.desaturate, false);
  assert.deepEqual(HIDDEN, { drawn: 0, hide: 1, highlight: 2, dim: 3 });
});

test('candidate recipes: a outline+ring+beacon, b rim+ring (animated), c desaturate+ring', () => {
  const on = (s: 'a' | 'b' | 'c') => Object.entries(HIGHLIGHT_RECIPES[s]).filter(([, v]) => v).map(([k]) => k).sort();
  assert.deepEqual(on('a'), ['beacon', 'keepMaterials', 'outline', 'ring']);
  assert.deepEqual(on('b'), ['animated', 'keepMaterials', 'rim', 'ring']);
  assert.deepEqual(on('c'), ['desaturate', 'keepMaterials', 'ring']);
});

test('colour-blind check: the coral clears ΔE 20 from every backdrop in all four visions; the HUD accent does not', () => {
  for (const [vision, r] of Object.entries(accentSeparation(HIGHLIGHT_CORAL))) assert.ok(r.min >= 20, `${vision}: ΔE ${r.min.toFixed(1)} against ${r.against}`);
  const hud = accentSeparation(HUD_ACCENT);
  assert.ok(Math.min(...Object.values(hud).map(r => r.min)) < 10, 'the HUD copper sits on the brick/pantile range');
});

test('distance helpers: 60 m radius', () => {
  const a: [number, number] = [4.8838, 52.3745];
  const b: [number, number] = [a[0], a[1] + 59 / 110_540];
  assert.ok(Math.abs(metresBetween(a, b) - 59) < 0.5);
  assert.equal(withinDesaturation(a, b), true);
  assert.equal(withinDesaturation(a, [a[0], a[1] + (DESATURATE_RADIUS_M + 2) / 110_540]), false);
  assert.equal(withinDesaturation(null, b), false);
});

test('ring: band outside either winding, convex hull of several footprints, circle without one', () => {
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  for (const ring of [square, [...square].reverse()]) {
    const band = ringBand(ring, 0.4, 4);
    assert.equal(band.positions.length, 4 * 2 * 3);
    // Inner vertex of the (0,0) corner sits outside the square, outer farther out.
    const xs = band.positions.filter((_, i) => i % 3 === 0), ys = band.positions.filter((_, i) => i % 3 === 1);
    assert.ok(Math.min(...xs) < -4 && Math.max(...xs) > 14 && Math.min(...ys) < -4 && Math.max(...ys) > 14);
    assert.deepEqual(band.alphas.slice(0, 2).map(a => a > 0), [true, false]);
  }
  assert.equal(convexHull([[0, 0], [2, 0], [1, 1], [2, 2], [0, 2], [1, 0.2]]).length, 4);
  const anchor: [number, number] = [4.9, 52.37];
  assert.equal(ringOutline(undefined, anchor).length, 40);
  const fp = (dx: number) => [[[4.9 + dx, 52.37], [4.9001 + dx, 52.37], [4.9001 + dx, 52.3701], [4.9 + dx, 52.3701], [4.9 + dx, 52.37]]] as [number, number][][];
  assert.equal(ringOutline([fp(0)], anchor).length, 5);
  assert.equal(ringOutline([fp(0), fp(0.0002)], anchor).length, 4);
});

test('beacon fades with distance, never below 30 %', () => {
  assert.equal(beaconAlpha(50), 1);
  assert.ok(beaconAlpha(500) < 0.8 && beaconAlpha(500) > 0.3);
  assert.ok(Math.abs(beaconAlpha(5000) - 0.3) < 1e-9);
});

test('marker frame: local metres → Mercator matches the projection', () => {
  const m = mercatorFromLocal([4.9, 52.37]), [x, y] = mercatorOf(4.9, 52.37);
  assert.equal(m[12], x); assert.equal(m[13], y);
  // 100 m north is −y in Mercator.
  const [, yn] = mercatorOf(4.9, 52.37 + 100 / 111_200);
  assert.ok(Math.abs((y + m[5] * 100) - yn) / Math.abs(yn - y) < 0.01);
});

test('landmark entries: yellow matches by landmark id only; candidates also by suppressed building, and dim within 60 m', () => {
  const at = (dm: number): [number, number] => [4.88, 52.37 + dm / 110_540];
  const entries = [
    { name: 'glb', spec: { landmarkId: 'L1' }, placement: { anchor: at(0) } },
    { name: 'recipe house', spec: { suppressOsmIds: ['w1'] }, placement: { anchor: at(10) } },
    { name: 'neighbour', spec: { suppressOsmIds: ['w9'] }, placement: { anchor: at(40) } },
    { name: 'far', spec: {}, placement: { anchor: at(200) } },
    { name: 'types', spec: { sceneFactory: () => null, suppressOsmIds: ['w1'] }, placement: { anchor: at(0) } },
  ];
  const named = (r: ReturnType<typeof landmarkHighlightStates>) => Object.fromEntries([...r.states].map(([e, s]) => [(e as any).name, s]));
  const landmark = { id: 'L1', lngLat: at(0), buildingIds: ['w1'] };
  assert.deepEqual(named(landmarkHighlightStates(entries, landmark, 'yellow')), { glb: 'highlight' });
  assert.deepEqual(named(landmarkHighlightStates(entries, landmark, 'a')), { glb: 'highlight', 'recipe house': 'highlight' });
  assert.deepEqual(named(landmarkHighlightStates(entries, landmark, 'c')), { glb: 'highlight', 'recipe house': 'highlight', neighbour: 'dim' });
  // A tapped building (no landmark id) lights the recipe house standing on it.
  assert.deepEqual(named(landmarkHighlightStates(entries, { lngLat: at(10), featureTarget: { id: 'w1' } }, 'b')), { 'recipe house': 'highlight' });
});

test('whole-mesh variants: candidates keep the material, yellow swaps, dim desaturates a clone; passes attach and detach', () => {
  const red = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  assert.equal(highlightMaterialFor(THREE, red, 'highlight', 'a'), red);
  const yellow = highlightMaterialFor(THREE, red, 'highlight', 'yellow');
  assert.equal(yellow.color.getHexString(), 'ffd21f');
  const dim = highlightMaterialFor(THREE, red, 'dim', 'c');
  assert.notEqual(dim, red);
  assert.equal(baseMaterialOf(dim), red);
  assert.ok(dim.color.r - dim.color.g < red.color.r - red.color.g, 'less saturated');
  assert.equal(highlightMaterialFor(THREE, red, 'dim', 'c'), dim, 'cached');

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), red), root = new THREE.Group();
  root.add(mesh);
  applyMeshHighlight(THREE, root, 'highlight', { style: 'a' });
  assert.equal(mesh.material, red);
  assert.deepEqual(mesh.children.map(c => c.name), ['mesh/highlight-outline']);
  applyMeshHighlight(THREE, root, 'dim', { style: 'c' });
  assert.equal(mesh.children.length, 0);
  assert.equal(mesh.material, dim);
  applyMeshHighlight(THREE, root, 'plain', { style: 'c' });
  assert.equal(mesh.material, red);

  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), red, 3);
  const [rim] = attachHighlightPasses(THREE, inst, { style: 'b', merged: true });
  assert.ok(rim.isInstancedMesh && rim.instanceMatrix === inst.instanceMatrix);
  assert.equal(rim.material.defines.HL_MERGED, '');
  assert.equal(rim.material.blending, THREE.AdditiveBlending);
  detachHighlightPasses(inst);
  assert.equal(inst.children.length, 0);
  assert.deepEqual(attachHighlightPasses(THREE, inst, { style: 'c' }), [], 'c has no passes');
});

test('city look: a dim variant, and the shader reads the shared state', () => {
  const uniforms = createCityUniforms(THREE);
  const m = createCityLookMaterial(THREE, { lit: false, kind: 'slot', dim: true }, uniforms);
  assert.equal(m.defines.CITY_DIM, '');
  assert.match(m.vertexShader, /vHighlight = hlState\(hidden\)/);
  assert.match(m.fragmentShader, /if \(HL_PAINT\(vHighlight\)\)/);
  assert.equal(variantDefines({ lit: true, kind: 'slot', highlight: true, dim: true }).CITY_DIM, undefined, 'highlight wins');
});
