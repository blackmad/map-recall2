import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DESATURATE_RADIUS_M, HIDDEN, HIGHLIGHT_GLSL, HIGHLIGHT_RECIPES, accentSeparation, applyMeshHighlight, attachHighlightPasses, baseMaterialOf,
  detachHighlightPasses, featureCentre, highlightAccent, highlightDefines, highlightFeature, highlightMaterialFor, highlightStyle, metresBetween,
  OUTLINE_FAR_PX, OUTLINE_PX, outlineWidthPx, withinDesaturation,
  HIGHLIGHT_BOOST_GLOBAL, ROOF_WASH_ALPHA, SMALL_TARGET_FADE_SHARE, SMALL_TARGET_SHARE, footprintShare, smallTargetBoost,
} from './highlight.ts';
import { landmarkHighlightStates } from './highlightLandmarks.ts';
import { beaconAlpha, beaconRaise, footprintRadiusPx, markerSlot, mercatorFromLocal, mercatorOf, ringBand, ringOutlines, ringsArea } from './highlightMarker.ts';
import { HIGHLIGHT_CORAL, HIGHLIGHT_YELLOW, HUD_ACCENT } from './palette.ts';
import { createCityLookMaterial, createCityUniforms, variantDefines } from './cityLook.ts';

test('style: ?highlight=a|b|c|yellow, aliases, and a by default', () => {
  assert.equal(highlightStyle(''), 'a');
  assert.equal(highlightStyle('?highlight=default'), 'a');
  assert.equal(highlightStyle('?highlight=yellow'), 'yellow');
  assert.equal(highlightStyle('?highlight=off'), 'yellow');
  assert.equal(highlightStyle('?highlight=a'), 'a');
  assert.equal(highlightStyle('?highlight=rim'), 'b');
  assert.equal(highlightStyle('?highlight=C'), 'c');
  assert.equal(highlightStyle('?highlight=bogus'), 'a');
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

test('candidate recipes: a outline+ring+beacon (+ small-target wash), b rim+ring (animated), c desaturate+ring', () => {
  const on = (s: 'a' | 'b' | 'c') => Object.entries(HIGHLIGHT_RECIPES[s]).filter(([, v]) => v).map(([k]) => k).sort();
  assert.deepEqual(on('a'), ['beacon', 'keepMaterials', 'outline', 'ring', 'wash']);
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

test('ring: band outside either winding, one ring per footprint, circle without one', () => {
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  for (const ring of [square, [...square].reverse()]) {
    const band = ringBand(ring, 0.4, 4);
    assert.equal(band.positions.length, 4 * 2 * 3);
    // Inner vertex of the (0,0) corner sits outside the square, outer farther out.
    const xs = band.positions.filter((_, i) => i % 3 === 0), ys = band.positions.filter((_, i) => i % 3 === 1);
    assert.ok(Math.min(...xs) < -4 && Math.max(...xs) > 14 && Math.min(...ys) < -4 && Math.max(...ys) > 14);
    assert.deepEqual(band.alphas.slice(0, 2).map(a => a > 0), [true, false]);
  }
  const anchor: [number, number] = [4.9, 52.37];
  assert.deepEqual(ringOutlines(undefined, anchor).map(r => r.length), [40]);
  const fp = (dx: number) => [[[4.9 + dx, 52.37], [4.9001 + dx, 52.37], [4.9001 + dx, 52.3701], [4.9 + dx, 52.3701], [4.9 + dx, 52.37]]] as [number, number][][];
  assert.deepEqual(ringOutlines([fp(0), fp(0.0002)], anchor).map(r => r.length), [5, 5]);
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
  assert.deepEqual(mesh.children.map(c => c.name), ['mesh/highlight-outline', 'mesh/highlight-roof']);
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

test('outline: 2 px near, widening to 3.5 px by 300 m (chase on a terrace house reads ≥ 1.5 px), clamped', () => {
  assert.equal(outlineWidthPx(30), OUTLINE_PX);
  assert.equal(outlineWidthPx(100), OUTLINE_PX);
  // The Oud-West terrace from the chase camera (213 m, scripts/highlight-outline-width.mjs).
  assert.ok(outlineWidthPx(213) > 2.7 && outlineWidthPx(213) < 2.9);
  assert.equal(outlineWidthPx(300), OUTLINE_FAR_PX);
  assert.equal(outlineWidthPx(5000), OUTLINE_FAR_PX);
  assert.equal(outlineWidthPx(NaN), OUTLINE_PX);
  const [pass] = attachHighlightPasses(THREE, new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), { style: 'a' });
  assert.equal(pass.material.uniforms.hlFarScale.value, OUTLINE_FAR_PX / OUTLINE_PX);
  assert.match(pass.material.vertexShader, /mix\(1\.0, hlFarScale, far\)/);
});

test('3DBAG detailed mode: the outline keeps to one feature of a batched tile; yellow declines', () => {
  const g = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  const n = g.getAttribute('position').count, ids = new Float32Array(n);
  // Second half of the box is feature 7, shifted 10 m east.
  for (let i = n / 2; i < n; i++) { ids[i] = 7; g.getAttribute('position').setX(i, g.getAttribute('position').getX(i) + 10); }
  g.setAttribute('_feature_id_0', new THREE.BufferAttribute(ids, 1));
  const feature = { attribute: '_feature_id_0', id: 7 };
  const centre = featureCentre(g, feature)!;
  assert.ok(centre[0] > 8 && centre[0] < 12, String(centre));
  assert.equal(featureCentre(g, { attribute: '_feature_id_0', id: 3 }), null);
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial());
  assert.equal(highlightFeature(THREE, mesh, feature, 'yellow'), false);
  assert.equal(mesh.children.length, 0);
  assert.equal(highlightFeature(THREE, mesh, feature, 'a'), true);
  const [pass] = mesh.children as any[];
  assert.equal(pass.material.defines.HL_FEATURE, '_feature_id_0');
  assert.match(pass.material.vertexShader, /^attribute float _feature_id_0;/);
  assert.equal(pass.material.uniforms.hlFeatureId.value, 7);
  assert.deepEqual(pass.material.uniforms.hlCentre.value.toArray(), centre);
  assert.throws(() => attachHighlightPasses(THREE, mesh, { style: 'a', feature: { attribute: 'x;discard', id: 1 } }));
  detachHighlightPasses(mesh);
  assert.equal(mesh.children.length, 0);
});

test('default-frame marker layer: after the last 3D layer, so buildings streamed in later never paint over it', () => {
  const layers = [
    { id: 'background', type: 'background' }, { id: 'roads', type: 'line' }, { id: 'highlight-marker', type: 'custom' },
    { id: 'osm-colored-buildings', type: 'fill-extrusion' }, { id: 'labels', type: 'symbol' }, { id: 'three-building-facades', type: 'custom' },
    { id: 'poi-labels', type: 'symbol' },
  ];
  assert.equal(layers[markerSlot(layers, 'highlight-marker')].id, 'poi-labels');
  assert.equal(markerSlot(layers.slice(0, 6), 'highlight-marker'), 6, 'top when a 3D layer is last');
  assert.equal(markerSlot(layers.slice(0, 3), 'highlight-marker'), -1, 'no 3D layer yet: stays');
});

test('small targets: full boost under 1 % of the frame, gone past 2 %; the beacon rises by the shortfall', () => {
  assert.deepEqual(smallTargetBoost(0), { share: 0, weight: 0, shortfall: 0 }, 'no footprint: no boost');
  // The Oud-West terrace house from the chase camera (~0.2 % of the frame): full boost, most of the shortfall.
  const terrace = smallTargetBoost(0.002);
  assert.equal(terrace.weight, 1);
  assert.ok(Math.abs(terrace.shortfall - 0.8) < 1e-9);
  assert.equal(smallTargetBoost(SMALL_TARGET_SHARE).weight, 1);
  const mid = smallTargetBoost((SMALL_TARGET_SHARE + SMALL_TARGET_FADE_SHARE) / 2);
  assert.ok(Math.abs(mid.weight - 0.5) < 1e-9 && mid.shortfall === 0);
  assert.equal(smallTargetBoost(SMALL_TARGET_FADE_SHARE).weight, 0);
  assert.equal(smallTargetBoost(0.08).weight, 0, 'a church from the saddle: none');
  assert.equal(beaconRaise({ weight: 0, shortfall: 0 }), 1);
  assert.equal(beaconRaise(smallTargetBoost(0.01)), 2);
  assert.ok(beaconRaise(terrace) > 2.7 && beaconRaise(terrace) <= 3);
  // Share of a 6 × 12 m house (r = √(72/π) ≈ 4.8 m) at ~27 px in a 1280 × 800 frame.
  assert.ok(Math.abs(footprintShare(27, 1280, 800) - 0.00224) < 1e-4);
  assert.equal(footprintShare(0, 1280, 800), 0);
  assert.equal(ringsArea([[[0, 0], [6, 0], [6, 12], [0, 12]]]), 72);
  assert.equal(ringsArea([[[0, 0], [0, 12], [6, 12], [6, 0]]]), 72, 'either winding');
});

test('small targets: footprint radius on screen from the local → clip matrix', () => {
  const camera = new THREE.PerspectiveCamera(36.87, 1280 / 800, 1, 5000);
  camera.up.set(0, 0, 1);
  camera.position.set(0, -200, 80); camera.lookAt(0, 0, 10); camera.updateMatrixWorld();
  const mvp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const d = camera.position.distanceTo(new THREE.Vector3(0, 0, 10));
  const focal = 400 / Math.tan((36.87 / 2) * Math.PI / 180);
  const r = footprintRadiusPx(mvp.elements, [0, 0, 10], 4.8, 1280, 800);
  // Across the view (east-west) the radius is not foreshortened: r·f/d.
  assert.ok(Math.abs(r - 4.8 * focal / d) / r < 0.05, `${r} vs ${4.8 * focal / d}`);
  // Behind the camera: 0.
  camera.lookAt(0, -400, 80); camera.updateMatrixWorld();
  assert.equal(footprintRadiusPx(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements, [0, 0, 10], 4.8, 1280, 800), 0, 'behind the camera');
  assert.equal(footprintRadiusPx(mvp.elements, [0, 0, 10], 0, 1280, 800), 0);
});

test('roof wash: a third pass under a, drawn only while boosted, upward faces only, up by frame', () => {
  const g = globalThis as any;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 15), new THREE.MeshLambertMaterial()), scene = new THREE.Scene();
  scene.add(mesh);
  const passes = attachHighlightPasses(THREE, mesh, { style: 'a' });
  const roof = passes.find((p: any) => p.name.endsWith('roof'));
  assert.ok(roof, 'roof pass');
  assert.equal(roof.material.defines.HL_ROOF, '');
  assert.equal(roof.material.depthWrite, false);
  assert.ok(roof.material.polygonOffset);
  assert.match(roof.material.fragmentShader, /HL_ROOF/);
  delete g[HIGHLIGHT_BOOST_GLOBAL];
  assert.equal(roof.visible, false, 'no boost: not drawn');
  g[HIGHLIGHT_BOOST_GLOBAL] = 1;
  assert.equal(roof.visible, true);
  mesh.visible = false;
  assert.equal(roof.visible, false, 'follows the building');
  mesh.visible = true;
  const renderer = { getDrawingBufferSize: (v: any) => v.set(1280, 800), domElement: { clientWidth: 1280 } };
  const camera = new THREE.PerspectiveCamera();
  scene.updateMatrixWorld();
  roof.onBeforeRender(renderer, scene, camera);
  assert.equal(roof.material.uniforms.hlWash.value, ROOF_WASH_ALPHA);
  assert.deepEqual(roof.material.uniforms.hlUp.value.toArray(), [0, 0, 1], 'metre world: +z by default');
  // glTF frame (+y up), rotated so that its +y maps to the world's... still +y in a metre world.
  const gltf = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial());
  scene.add(gltf);
  const [, gRoof] = attachHighlightPasses(THREE, gltf, { style: 'a', up: [0, 1, 0] });
  scene.updateMatrixWorld();
  gRoof.onBeforeRender(renderer, scene, camera);
  assert.deepEqual(gRoof.material.uniforms.hlUp.value.toArray(), [0, 1, 0]);
  // Mercator world (the landmark holder in the shared frame: glTF +y → Mercator +z): up is found through the matrix.
  const holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  const u = 1e-8;
  holder.matrix.makeScale(u, -u, u).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  holder.add(gltf);
  scene.updateMatrixWorld(true);
  gRoof.onBeforeRender(renderer, scene, camera);
  const up = gRoof.material.uniforms.hlUp.value;
  assert.ok(Math.abs(up.y - 1) < 1e-6, `glTF +y is up: ${up.toArray()}`);
  g[HIGHLIGHT_BOOST_GLOBAL] = 0.5;
  roof.onBeforeRender(renderer, scene, camera);
  assert.equal(roof.material.uniforms.hlWash.value, ROOF_WASH_ALPHA * 0.5);
  delete g[HIGHLIGHT_BOOST_GLOBAL];
  // Not on a 3D Tiles feature (frame unknown), not under b / c / yellow.
  assert.equal(attachHighlightPasses(THREE, mesh, { style: 'a', feature: { attribute: '_feature_id_0', id: 1 } }).length, 1);
  assert.equal(attachHighlightPasses(THREE, mesh, { style: 'b' }).length, 1);
  assert.equal(HIGHLIGHT_RECIPES.a.wash && !HIGHLIGHT_RECIPES.b.wash && !HIGHLIGHT_RECIPES.c.wash && !HIGHLIGHT_RECIPES.yellow.wash, true);
});
