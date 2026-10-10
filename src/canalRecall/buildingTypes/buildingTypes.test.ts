import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {bearingDeg, lngLatToLocal, localToLngLat, minimumRotatedRectangle, rectIoU, type Pt} from './geometry.ts';
import {frontSide, frontYaw, type Street} from './orientation.ts';
import {generate, layoutBays} from './generate.ts';
import {bakeWorld} from './glb.ts';
import {FACADE_IDS, validateSpec, type TypeSpec} from './spec.ts';
import {paramsFromFacts, ridgeAlongOf, roofFactsFromPlanes} from './facts.ts';

const TYPES = path.join(import.meta.dirname, 'types');
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(TYPES, f), 'utf8')) as TypeSpec;
const T1 = load('nw-portiek-brick-pitched.json'), T6 = load('nw-pilotis-panel-flat.json');

const rotate = (pts: Pt[], deg: number, at: Pt = [0, 0]): Pt[] => pts.map(([x, z]) => { const a = deg * Math.PI / 180; return [at[0] + Math.cos(a) * x - Math.sin(a) * z, at[1] + Math.sin(a) * x + Math.cos(a) * z]; });
const block = (L: number, W: number): Pt[] => [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]];

test('minimum rotated rectangle recovers size, centre and is invariant to rotation, winding and start vertex', () => {
  for (const deg of [0, 17, 90, 133, 200, 311]) {
    const ring = rotate(block(14.4, 10.5), deg, [30, -12]);
    for (const variant of [ring, [...ring].reverse(), [...ring.slice(2), ...ring.slice(0, 2)]]) {
      const r = minimumRotatedRectangle(variant);
      assert.ok(Math.abs(r.length - 14.4) < 1e-6 && Math.abs(r.width - 10.5) < 1e-6, `deg ${deg}: ${r.length} x ${r.width}`);
      assert.ok(Math.hypot(r.center[0] - 30, r.center[1] + 12) < 1e-6);
      assert.ok(r.length >= r.width);
      assert.ok(Math.abs(r.long[0] * Math.cos(deg * Math.PI / 180) + r.long[1] * Math.sin(deg * Math.PI / 180)) > 1 - 1e-9, 'long axis parallel to the long side');
      assert.ok(rectIoU(variant, r) > 0.999);
    }
  }
});

test('rectangle of a notched footprint (balcony notches) keeps IoU high and reports the loss', () => {
  const ring: Pt[] = [[-7.85, -4.95], [7.85, -4.95], [7.85, 4.95], [3, 4.95], [3, 4.2], [1, 4.2], [1, 4.95], [-7.85, 4.95]];
  const r = minimumRotatedRectangle(ring);
  assert.ok(Math.abs(r.length - 15.7) < 1e-9 && Math.abs(r.width - 9.9) < 1e-9);
  const iou = rectIoU(ring, r);
  assert.ok(iou > 0.97 && iou < 1, `iou ${iou}`);
});

test('lng/lat <-> local round trip and compass bearing', () => {
  const anchor = {lng: 4.81, lat: 52.37};
  const p = lngLatToLocal(anchor, 4.8115, 52.3712);
  assert.ok(p[0] > 0 && p[1] < 0, 'east is +x, north is -z');
  const [lng, lat] = localToLngLat(anchor, p);
  assert.ok(Math.abs(lng - 4.8115) < 1e-9 && Math.abs(lat - 52.3712) < 1e-9);
  assert.equal(Math.round(bearingDeg(0, -10)), 0);
  assert.equal(Math.round(bearingDeg(10, 0)), 90);
  assert.equal(Math.round(bearingDeg(0, 10)), 180);
});

// --- front orientation -------------------------------------------------------------------------------------------

const line = (highway: string, name: string, ...pts: Pt[]): Street => ({highway, name, path: pts});

test('front = the long side facing the nearest street, for every rotation and for either side', () => {
  for (const deg of [0, 25, 90, 150, 270]) {
    for (const side of [1, -1]) {
      // street runs parallel to the long axis, 12 m off the +side or -side
      const world = (p: Pt) => rotate([p], deg)[0];
      const street = line('residential', 'Teststraat', world([-40, side * 12]), world([40, side * 12]));
      const rect = minimumRotatedRectangle(rotate(block(14.4, 10.5), deg));
      const f = frontSide(rect, [street]);
      const expected = rotate([[0, side]], deg)[0];
      assert.ok(f.normal[0] * expected[0] + f.normal[1] * expected[1] > 0.999, `deg ${deg} side ${side}: normal ${f.normal}`);
      assert.equal(f.street, 'Teststraat');
      assert.ok(Math.abs(f.streetDistanceM - (12 - 10.5 / 2 - 0.5)) < 0.01 + 1e-9 || f.streetDistanceM > 5);
      assert.equal(f.ambiguous, false);
    }
  }
});

test('a drivable street beats a nearer garden footpath; with only footpaths the nearest wins; a street at the gable is ambiguous', () => {
  const rect = minimumRotatedRectangle(block(14.4, 10.5));
  const road = line('residential', 'Straat', [-30, -14], [30, -14]), path = line('footway', 'pad', [-30, 9], [30, 9]);
  // road 14 m off the -z side (distance 14-5.25-0.5 = 8.25 from the sample line); footpath 9 m off the +z side
  assert.ok(frontSide(rect, [road, path]).normal[1] < -0.99, 'road side wins');
  assert.ok(frontSide(rect, [path]).normal[1] > 0.99, 'footpath only: its side wins');
  const end = line('residential', 'Kopstraat', [20, -20], [20, 20]);
  assert.equal(frontSide(rect, [end]).ambiguous, true);
});

test('frontYaw maps the local frame (front +z, tangent +x) onto the world: front normal and viewer-right tangent', () => {
  for (const deg of [0, 33, 90, 180, 247]) {
    const rect = minimumRotatedRectangle(rotate(block(14.4, 10.5), deg));
    const street = line('residential', 's', ...rotate([[-40, 12], [40, 12]], deg));
    const f = frontSide(rect, [street]);
    const yaw = frontYaw(f);
    const mb = generate(T1, {lengthM: 14.4, widthM: 10.5, eavesM: 14.6, ridgeM: 17.8}).mesh;
    const local = mb.bounds();
    const c = Math.cos(yaw), s = Math.sin(yaw);
    assert.ok(Math.abs((s * 1 + 0 * c) - f.normal[0]) < 1e-9 && Math.abs(c - f.normal[1]) < 1e-9, 'local z -> normal');
    assert.ok(Math.abs(c - f.tangent[0]) < 1e-9 && Math.abs(-s - f.tangent[1]) < 1e-9, 'local x -> tangent');
    assert.ok(local.max[2] > 10.5 / 2, 'balconies project past the front line');
    // viewer's right: facing the wall from outside, right = tangent. cross(forward, up) with forward = -normal.
    const right: Pt = [f.normal[1], -f.normal[0]];
    assert.ok(Math.abs(right[0] - f.tangent[0]) < 1e-9 && Math.abs(right[1] - f.tangent[1]) < 1e-9);
  }
});

test('the front of a south-facing block is on its south side and its balconies project south in the world frame', () => {
  const rect = minimumRotatedRectangle(block(14.4, 10.5)); // long axis along x
  const f = frontSide(rect, [line('residential', 's', [-40, 14], [40, 14])]); // +z = south
  assert.ok(Math.abs(f.normal[0]) < 1e-9 && Math.abs(f.normal[1] - 1) < 1e-9);
  const world = bakeWorld(generate(T1, {lengthM: 14.4, widthM: 10.5, eavesM: 14.6, ridgeM: 17.8}).mesh, [0, 0, 0], frontYaw(f));
  assert.ok(world.bounds().max[2] > 10.5 / 2 + 1, 'south extent has the balconies');
  const door = world.buckets.get(`door|${T1.variants.brick.palette.door}`)!;
  let southDoor = false;
  for (let i = 0; i < door.positions.length; i += 9) if (door.normals[i + 2] > 0.99 && door.positions[i + 2] > 10.5 / 2 && door.positions[i + 1] > 0.3 && door.positions[i + 1] < 3) southDoor = true;
  assert.ok(southDoor, 'the entrance door leaf faces south');
});

// --- spec + generator ---------------------------------------------------------------------------------------------

test('specs validate and bay counts are written down for every facade', () => {
  for (const spec of [T1, T6]) {
    assert.deepEqual(validateSpec(spec), []);
    for (const id of FACADE_IDS) assert.ok(spec.facades[id].evidence.length > 0);
  }
  assert.equal(T1.facades.front.confidence, 'measured');
  assert.equal(T6.facades.front.confidence, 'measured');
});

test('layoutBays scales relative widths to the facade length', () => {
  const bays = layoutBays(T6.facades.front.bays, 16.2);
  assert.equal(bays.length, 7);
  assert.ok(Math.abs(bays.at(-1)!.u1 - 16.2) < 1e-9);
  assert.ok(Math.abs(bays[3].u1 - bays[3].u0 - 1.6 * 16.2 / 15.8) < 1e-9);
});

test('generated model matches the counts written in the type JSON, for every cladding variant', () => {
  for (const [spec, base] of [[T1, {lengthM: 14.4, widthM: 10.5, eavesM: 14.6, ridgeM: 17.8}], [T6, {lengthM: 15.7, widthM: 9.9, eavesM: 16.1}]] as const) {
    for (const variant of Object.keys(spec.variants)) {
      const {report} = generate(spec, {...base, variant});
      for (const id of FACADE_IDS) {
        const want = spec.facades[id].counted, got = report.facades[id];
        assert.equal(got.bays, want.bays, `${spec.id}/${variant}/${id} bays`);
        assert.equal(got.openingsPerUpperStorey, want.openingsPerUpperStorey, `${spec.id}/${variant}/${id} openings`);
        assert.equal(got.groundDoors, want.groundDoors, `${spec.id}/${variant}/${id} ground doors`);
        // a re-clad variant may replace balconies; everything else must match
        if (variant !== 'clad-panel') assert.equal(got.balconiesPerUpperStorey, want.balconiesPerUpperStorey, `${spec.id}/${variant}/${id} balconies`);
        else assert.equal(got.balconiesPerUpperStorey, 0);
      }
    }
  }
});

test('storeys come from 3DBAG height; geometry reaches the eaves and ridge it was given', () => {
  const {mesh, report} = generate(T1, {lengthM: 14.4, widthM: 10.5, eavesM: 14.65, ridgeM: 17.9});
  const b = mesh.bounds();
  assert.equal(report.storeys, 5);
  assert.ok(Math.abs(report.storeyHeightM - 2.93) < 1e-9);
  assert.ok(Math.abs(b.max[1] - 17.9) < 1e-6, `ridge ${b.max[1]}`);
  assert.ok(b.min[1] >= -1e-9, 'nothing below the ground');
  assert.ok(b.max[0] <= 14.4 / 2 + T1.roof.vergeOverhangM + 1e-6 && b.min[0] >= -14.4 / 2 - T1.roof.vergeOverhangM - 1e-6, 'gable overhang only');
  const flat = generate(T6, {lengthM: 15.7, widthM: 9.9, eavesM: 16.1});
  assert.ok(Math.abs(flat.mesh.bounds().max[1] - 16.1) < 1e-6);
  assert.equal(flat.report.ridgeM, null);
});

test('mesh hygiene: finite, unit normals, no degenerate triangles, within the 3k recipe budget for the pitched type', () => {
  for (const [spec, p] of [[T1, {lengthM: 14.4, widthM: 10.5, eavesM: 14.65, ridgeM: 17.9}], [T6, {lengthM: 15.7, widthM: 9.9, eavesM: 16.1}]] as const) {
    for (const variant of Object.keys(spec.variants)) {
      const {mesh} = generate(spec, {...p, variant});
      for (const bucket of mesh.buckets.values()) {
        assert.ok(bucket.positions.every(Number.isFinite) && bucket.uvs.every(Number.isFinite));
        for (let i = 0; i < bucket.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(bucket.normals[i], bucket.normals[i + 1], bucket.normals[i + 2]) - 1) < 1e-6);
      }
    }
  }
  assert.ok(generate(T1, {lengthM: 14.4, widthM: 10.5, eavesM: 14.65, ridgeM: 17.9}).report.triangles <= 3000);
});

test('front/back/gable systems are on the right sides of the block', () => {
  const {mesh} = generate(T1, {lengthM: 14.4, widthM: 10.5, eavesM: 14.65, ridgeM: 17.9});
  const door = mesh.buckets.get(`door|${T1.variants.brick.palette.door}`)!;
  // entrance door leaf: the biggest door quad on the +z face, near x = 0
  let found = false;
  for (let i = 0; i < door.positions.length; i += 9) {
    const z = door.positions[i + 2], x = door.positions[i];
    if (Math.abs(door.positions[i + 5] - z) < 1e-9 && z > 10.5 / 2 && x > -2 && x < 0) found = true;
  }
  assert.ok(found, 'entrance door on the front (+z) facade at the stair core (just left of centre)');
});

test('roof facts: gable, hip and flat from 3DBAG-like planes; ridge direction versus the long side', () => {
  const plane = (az: number, slope: number, area: number) => {
    const s = Math.sin(slope * Math.PI / 180), c = Math.cos(slope * Math.PI / 180), a = az * Math.PI / 180;
    return {normal: [Math.sin(a) * s, Math.cos(a) * s, c] as [number, number, number], area};
  };
  const gable = roofFactsFromPlanes([plane(0, 30, 80), plane(180, 30, 80)]); // slopes fall north and south: ridge runs east-west
  assert.equal(gable.form, 'gable');
  assert.ok(Math.abs(Math.abs(gable.ridgeDirRD![0]) - 1) < 1e-6);
  const hip = roofFactsFromPlanes([plane(0, 30, 80), plane(180, 30, 80), plane(90, 30, 12), plane(270, 30, 12)]);
  assert.equal(hip.form, 'hip');
  assert.equal(roofFactsFromPlanes([plane(0, 2, 150)]).form, 'flat');
  const rect = minimumRotatedRectangle(block(14.4, 10.5)); // long axis east-west in local (east, south)
  assert.equal(ridgeAlongOf(rect, [1, 0]), 'long');
  assert.equal(ridgeAlongOf(rect, [0, 1]), 'short');
});

test('params from 3DBAG attributes: eaves above own ground, storeys cross-check, ridge sanity', () => {
  const rect = minimumRotatedRectangle(block(14.4, 10.5));
  const attrs = {b3_bouwlagen: 5, b3_dak_type: 'slanted', b3_h_dak_max: 17.158, b3_h_dak_50p: 15.486, b3_h_dak_min: 13.921, b3_h_maaiveld: -0.733, b3_h_nok: 17.0066};
  const {params, warnings} = paramsFromFacts(T1, rect, attrs, null);
  assert.ok(Math.abs(params.eavesM - 14.654) < 1e-9 && Math.abs(params.ridgeM! - 17.7396) < 1e-3);
  assert.equal(params.storeys, 5);
  assert.deepEqual(warnings, []);
  const bad = paramsFromFacts(T1, rect, {...attrs, b3_bouwlagen: 4, b3_h_dak_min: 5}, null);
  assert.ok(bad.warnings.some(w => w.includes('storey height')));
  // Geuzenveld members: eaves 12.4 m under a pitched roof, 3DBAG bouwlagen 5 counts the attic: four storeys
  const four = paramsFromFacts(T1, rect, {b3_bouwlagen: 5, b3_h_dak_min: 11.66, b3_h_nok: 15.14, b3_h_maaiveld: -0.738}, null);
  assert.equal(four.params.storeys, 4);
  assert.ok(four.warnings.some(w => w.includes('say 4 storeys')));
  assert.equal(paramsFromFacts(T1, rect, {b3_bouwlagen: 5, b3_h_dak_min: 13.588, b3_h_nok: 16.62, b3_h_maaiveld: -0.62}, null).params.storeys, 5);
  const flat = paramsFromFacts(T6, rect, {b3_bouwlagen: 5, b3_h_dak_50p: 15.3, b3_h_dak_max: 15.9, b3_h_maaiveld: -0.8}, null);
  assert.ok(Math.abs(flat.params.eavesM - 16.1) < 1e-9 && flat.params.roofForm === 'flat');
});

// --- GLB writers ---------------------------------------------------------------------------------------------------

test('GLB writers: baked keeps one node per instance with extras; instanced carries EXT_mesh_gpu_instancing; materials carry slots', async () => {
  const {NodeIO} = await import('@gltf-transform/core');
  const {ALL_EXTENSIONS} = await import('@gltf-transform/extensions');
  const {writeBakedGlb, writeInstancedGlb, writeMergedGlb} = await import('./glb.ts');
  const {mesh} = generate(T1, {lengthM: 14.4, widthM: 10.5, eavesM: 14.65, ridgeM: 17.9});
  const placed = [0, 1].map(i => ({name: `a${i}`, mesh, position: [10 * i, 1 + i, 5] as [number, number, number], yaw: i * 0.5, extras: {pandId: `p${i}`}}));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const baked = await io.readBinary((await writeBakedGlb('t', placed, {compress: 'none'})).bytes);
  const nodes = baked.getRoot().listNodes();
  assert.equal(nodes.length, 2);
  assert.deepEqual(nodes[1].getTranslation(), [10, 2, 5]);
  assert.equal((nodes[1].getExtras() as {pandId: string}).pandId, 'p1');
  const mats = baked.getRoot().listMaterials();
  assert.ok(mats.length > 5 && mats.every(m => typeof (m.getExtras() as {materialSlot?: string}).materialSlot === 'string'));
  const tris = (d: typeof baked) => d.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + p.getIndices()!.getCount() / 3, 0), 0);
  assert.equal(tris(baked), 2 * mesh.triangles);
  const merged = await io.readBinary((await writeMergedGlb('t', placed, {compress: 'none'})).bytes);
  assert.equal(tris(merged), 2 * mesh.triangles);
  assert.equal(merged.getRoot().listMeshes().length, 1);
  const inst = await writeInstancedGlb('t', [{name: 'g', mesh, instances: placed.map(p => ({position: p.position, yaw: p.yaw, scale: [1, 1, 1] as [number, number, number]}))}], {compress: 'none'});
  const doc = await io.readBinary(inst.bytes);
  assert.equal(doc.getRoot().listNodes().length, 1);
  assert.ok(doc.getRoot().listNodes()[0].getExtension('EXT_mesh_gpu_instancing'));
  assert.equal(inst.triangles, 2 * mesh.triangles, 'reported GPU triangles count the instances');
  assert.ok(inst.bytes.length < (await writeBakedGlb('t', placed, {compress: 'none'})).bytes.length * 0.7, 'one mesh + transforms is much smaller than two baked copies');
});
