import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {bearingDeg, freeSides, lngLatToLocal, localToLngLat, minimumRotatedRectangle, rectIoU, swapAxes, type Pt} from './geometry.ts';
import {frontSide, frontTowardBearing, frontYaw, type Street} from './orientation.ts';
import {asymSlope, generate, layoutBays, mirrorBays} from './generate.ts';
import {bakeWorld} from './glb.ts';
import {FACADE_IDS, validateSpec, type TypeSpec} from './spec.ts';
import {bodyRectFromRoof, paramsFromFacts, ridgeAlongOf, roofFactsFromPlanes, slopeEavesFromItem, type CityJsonItem} from './facts.ts';
import {solarPosition} from '../../../scripts/building-types/solar.ts';
import {sharedTerrain} from '../../../scripts/lib/terrainField.ts';

const TYPES = path.join(import.meta.dirname, 'types');
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(TYPES, f), 'utf8')) as TypeSpec;
const T1 = load('nw-portiek-brick-pitched.json'), T6 = load('nw-pilotis-panel-flat.json'), T6C = load('nw-pilotis-centre-panel-flat.json');

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
  for (const spec of [T1, T6, T6C]) {
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
        if (!['clad-panel', 'clad-full'].includes(variant)) assert.equal(got.balconiesPerUpperStorey, want.balconiesPerUpperStorey, `${spec.id}/${variant}/${id} balconies`);
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
  // lowest roof point dragged to ~3 m by an annex/LoD artefact: eaves recovered from ridge, width and slope (3-storey + attic member)
  const roof30 = {form: 'gable' as const, ridgeDirRD: [1, 0] as [number, number], slopeDeg: 30, slantedPlanes: 2, roofAreaM2: 300};
  const lean = paramsFromFacts(T1, rect, {b3_bouwlagen: 4, b3_h_dak_min: 2.8, b3_h_nok: 12.0, b3_h_maaiveld: 0}, roof30);
  assert.ok(Math.abs(lean.params.eavesM - (12 - 5.25 * Math.tan(Math.PI / 6))) < 1e-6 && lean.params.storeys === 3);
  assert.ok(lean.warnings.some(w => w.includes('disagree with ridge')));
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

// --- 2026-10-11 sub-designs of the type-1 cluster (wide-core A/B, hof C, plinth D) ----------------------------------------

const SUBTYPES = ['nw-portiek-wide-core-beekenhoff', 'nw-portiek-wide-core-slotermeerlaan', 'nw-portiek-hof-garage-4st', 'nw-portiek-plinth-hip'].map(id => load(`${id}.json`));

test('sub-design specs validate; the generated model matches the counts written from the photos for every variant', () => {
  for (const spec of SUBTYPES) {
    assert.deepEqual(validateSpec(spec), [], spec.id);
    assert.equal(spec.facades.front.confidence, 'measured', `${spec.id} front is read from straight-on photos`);
    assert.ok(spec.facades.front.evidence.length >= 3, `${spec.id}: at least three photos of different panden`);
    assert.equal(new Set(spec.facades.front.evidence.map(e => e.pand)).size, spec.facades.front.evidence.length);
    for (const variant of Object.keys(spec.variants)) {
      // The -4w variants of the hof type are the 16.3 m members with four equal core windows instead of two windows + a stair window.
      const long = variant.endsWith('-4w'), eaves = spec.storeys * 2.93;
      const {report, mesh} = generate(spec, {lengthM: long ? 16.3 : spec.source.lengthM, widthM: spec.source.widthM, eavesM: eaves, ridgeM: eaves + 3.2, variant, storeys: spec.storeys});
      for (const id of FACADE_IDS) {
        const want = spec.facades[id].counted, got = report.facades[id];
        assert.equal(got.bays, want.bays, `${spec.id}/${variant}/${id} bays`);
        assert.equal(got.openingsPerUpperStorey, want.openingsPerUpperStorey + (long && id === 'front' ? 2 : 0), `${spec.id}/${variant}/${id} openings`);
        assert.equal(got.groundDoors, want.groundDoors, `${spec.id}/${variant}/${id} ground doors`);
        assert.equal(got.balconiesPerUpperStorey, want.balconiesPerUpperStorey, `${spec.id}/${variant}/${id} balconies`);
      }
      assert.equal(report.storeys, spec.storeys);
      assert.ok(mesh.triangles <= 3000, `${spec.id}/${variant}: ${mesh.triangles} triangles within the 3k recipe budget`);
      for (const bucket of mesh.buckets.values()) assert.ok(bucket.positions.every(Number.isFinite));
      assert.ok(Math.abs(mesh.bounds().max[1] - (eaves + 3.2)) < 1e-6, `${spec.id}/${variant}: roof reaches the given ridge`);
    }
  }
});

test('sub-designs keep the party-wall frame [pier | balcony bay | core | balcony bay | pier] with the photo-measured bay ratios', () => {
  for (const spec of SUBTYPES) {
    const bays = spec.facades.front.bays;
    assert.deepEqual(bays.map(b => b.role), ['corner', 'balcony', 'stair', 'balcony', 'corner'], spec.id);
    const w = bays.map(b => b.w);
    assert.equal(w[1], w[3], `${spec.id}: balcony bays are equal`);
    assert.ok(w[2] > w[1] * 1.4, `${spec.id}: the core is the widest bay`);
    const placed = layoutBays(bays, spec.source.lengthM);
    assert.ok(Math.abs(placed.at(-1)!.u1 - spec.source.lengthM) < 1e-9);
  }
  // measured from the straight-on photos (px ratio core : balcony bay): A/B 210 : 140, C 380 : 110
  const [A, , C] = SUBTYPES;
  assert.ok(Math.abs(A.facades.front.bays[2].w / A.facades.front.bays[1].w - 1.45) < 0.1);
  assert.ok(Math.abs(C.facades.front.bays[2].w / C.facades.front.bays[1].w - 3.3) < 0.2);
});

test('sub-design D: dark plinth brick under the upper wall, pale band between them', () => {
  const D = SUBTYPES[3];
  assert.ok(D.variants['buff-brown'].palette.plinth, 'dark plinth brick differs from the upper wall');
  assert.equal(D.facades.front.bands?.length, 1);
  const {mesh} = generate(D, {lengthM: 15.1, widthM: 10.9, eavesM: 14.6, ridgeM: 17.8});
  const keys = [...mesh.buckets.values()].map(b => `${b.key.slot}|${b.key.tint}`);
  assert.ok(keys.includes(`brick|${D.variants['buff-brown'].palette.plinth!.tint}`) && keys.includes(`brick|${D.variants['buff-brown'].palette.wall.tint}`), 'plinth and wall are separate brick materials');
});

test('type-1 brick variants carry the colour sampled from sunlit photos (grey-brown), not a saturated red', () => {
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const sampled: Record<string, string> = {brick: '#584f46', 'brick-cream': '#554741', 'clad-panel': '#5b4a43', 'brick-yellow': '#ab8f64'};
  for (const [variant, hex] of Object.entries(sampled)) {
    const got = rgb(T1.variants[variant].palette.wall.tint), want = rgb(hex);
    assert.ok(got.every((v, i) => Math.abs(v - want[i]) <= 2), `${variant}: wall tint ${T1.variants[variant].palette.wall.tint} is the photo median ${hex}`);
  }
  const [r, , b] = rgb(T1.variants.brick.palette.wall.tint);
  assert.ok(r / b < 1.4, 'the 4-storey brick (Herbert Spencerhof, David Humehof, Henri Bergsonstraat) is brown-grey, not red (old tint #8f5a44 has r/b 2.1)');
});

// --- 2026-10-11 cluster 2 / 5 / 8 designs and the type-6 slab-band leftover -------------------------------------------------

const CLUSTER_TYPES = ['nw-garage-pair-balcony-5st', 'nw-loggia-stack-flat-5st', 'nw-portiek-3st-blue-door', 'nw-glazed-tower-red-pitched', 'nw-glazed-tower-buff-flat', 'nw-garage-balcony-band-brown', 'nw-slit-window-garage-5st', 'nw-tower-top-balcony-5st', 'nw-brick-tower-stair-5st', 'nw-steel-stack-portiek', 'nw-canopy-core-garage-brick', 'nw-peach-render-entrance-front', 'nw-peach-render-balcony-front', 'nw-slab-band-glazed-flat'].map(id => load(`${id}.json`));

test('cluster designs validate, carry >= 3 photo pands of evidence on the front, and the generated model matches the counted bays for every variant', () => {
  for (const spec of CLUSTER_TYPES) {
    assert.deepEqual(validateSpec(spec), [], spec.id);
    assert.ok(spec.facades.front.evidence.length >= 3 && new Set(spec.facades.front.evidence.map(e => e.pand)).size === spec.facades.front.evidence.length, `${spec.id}: evidence`);
    for (const variant of Object.keys(spec.variants)) {
      const eaves = spec.storeys * 2.95;
      const {report, mesh} = generate(spec, {lengthM: spec.source.lengthM, widthM: spec.source.widthM, eavesM: eaves, ridgeM: eaves + 2.2, variant, roofForm: spec.roof.form});
      for (const id of FACADE_IDS) {
        const want = spec.facades[id].counted, got = report.facades[id];
        assert.deepEqual(got, want, `${spec.id}/${variant}/${id}`);
      }
      assert.ok(mesh.triangles <= 4500, `${spec.id}/${variant}: ${mesh.triangles} triangles`);
      for (const bucket of mesh.buckets.values()) assert.ok(bucket.positions.every(Number.isFinite));
    }
  }
});


// --- 2026-10-11 terraced houses: the front is the SHORT side -------------------------------------------------------------

const ROW_TYPES = ['nw-rowhouse-garage-door', 'nw-rowhouse-door-window', 'nw-rowhouse-tall-glass', 'nw-rowhouse-render-tile', 'nw-rowhouse-tall-glass-panel', 'nw-rowhouse-garage-door-3st', 'nw-rowhouse-garage-door-2st', 'nw-rowhouse-red-panel-door', 'nw-rowhouse-white-sheds', 'nw-rowhouse-render-pilaster', 'nw-rowhouse-ribbon-fascia'].map(id => load(`${id}.json`));
const house = (cx: number, w = 5.0, d = 8.5): Pt[] => [[cx - w / 2, -d / 2], [cx + w / 2, -d / 2], [cx + w / 2, d / 2], [cx - w / 2, d / 2]];

test('swapAxes: frontage first, short stays long rotated +90, corners and centre kept', () => {
  for (const deg of [0, 33, 90, 200]) {
    const r = minimumRotatedRectangle(rotate(house(0), deg, [10, 4])), q = swapAxes(r);
    assert.ok(Math.abs(q.length - 5.0) < 1e-6 && Math.abs(q.width - 8.5) < 1e-6);
    assert.deepEqual(q.center, r.center);
    assert.ok(Math.abs(q.short[0] + q.long[1]) < 1e-9 && Math.abs(q.short[1] - q.long[0]) < 1e-9, 'short = long rotated +90');
    assert.ok(rectIoU(rotate(house(0), deg, [10, 4]), q) > 0.999);
  }
});

test('terraced house front: the short side facing the street, either side, any rotation; a photo-confirmed bearing overrides the street rule', () => {
  for (const deg of [0, 40, 115, 270]) for (const side of [1, -1]) {
    const world = (p: Pt) => rotate([p], deg)[0];
    // house: 5 m frontage along x, 8.5 m deep along z; the street runs along x, 10 m off the +-z end (the short sides are the fronts)
    const street = line('residential', 'Rijtjesstraat', world([-30, side * 10]), world([30, side * 10]));
    const rect = swapAxes(minimumRotatedRectangle(rotate(house(0), deg)));
    const f = frontSide(rect, [street]), want = rotate([[0, side]], deg)[0];
    assert.ok(f.normal[0] * want[0] + f.normal[1] * want[1] > 0.999, `deg ${deg} side ${side}`);
    const flipped = frontTowardBearing(rect, f, bearingDeg(-want[0], -want[1]));
    assert.ok(flipped.normal[0] * want[0] + flipped.normal[1] * want[1] < -0.999, 'bearing override flips the front');
    assert.ok(Math.abs(flipped.midpoint[0] - (rect.center[0] - want[0] * 8.5 / 2)) < 1e-6);
    assert.equal(frontTowardBearing(rect, f, bearingDeg(want[0], want[1])), f, 'already facing the bearing: unchanged');
  }
});

test('freeSides: a middle house has two party walls, an end house one, a detached house none', () => {
  const rect = swapAxes(minimumRotatedRectangle(house(0))), f = frontSide(rect, [line('residential', 's', [30, -20], [30, 20])]);
  const t = f.tangent; // viewer-right of the front
  const sideOf = (sgn: number) => house(sgn * 5.0);
  const right = (sgn: number) => (sgn * t[0] > 0 ? 'x' : 'y');
  void right;
  const both = freeSides(rect, f.tangent, [house(5.0), house(-5.0)]);
  assert.deepEqual(both, {left: false, right: false});
  const one = freeSides(rect, f.tangent, [house(5.0)]);
  assert.equal(Number(one.left) + Number(one.right), 1);
  assert.deepEqual(freeSides(rect, f.tangent, []), {left: true, right: true});
  assert.deepEqual(freeSides(rect, f.tangent, [house(9.0)]), {left: true, right: true}, 'a gap of 4 m is not a party wall');
  void sideOf;
});

test('mirrorBays reverses the bay order and negates offsets; mirrored facades keep their counts', () => {
  const G = ROW_TYPES[1], bays = G.facades.front.bays, m = mirrorBays(bays);
  assert.deepEqual(m.map(b => b.id), [...bays.map(b => b.id)].reverse());
  assert.equal(m[2].elements[0].u, -(bays[0].elements[0].u ?? 0) || 0);
  const a = generate(G, {lengthM: 5, widthM: 8.5, eavesM: 5.9, ridgeM: 8.5, freeSides: {left: false, right: false}}), b = generate(G, {lengthM: 5, widthM: 8.5, eavesM: 5.9, ridgeM: 8.5, freeSides: {left: false, right: false}, mirror: true});
  assert.deepEqual(a.report.facades, b.report.facades);
  assert.equal(b.report.mirrored, true);
  assert.equal(a.mesh.triangles, b.mesh.triangles);
  // the door leaf is on the other half of the front
  const doorX = (mesh: ReturnType<typeof generate>['mesh']) => { const d = mesh.buckets.get(`door|${G.variants[G.defaultVariant].palette.door}`)!; let sx = 0, n = 0; for (let i = 0; i < d.positions.length; i += 3) if (d.positions[i + 2] > 4) { sx += d.positions[i]; n++; } return sx / n; };
  assert.ok(Math.sign(doorX(a.mesh)) === -Math.sign(doorX(b.mesh)) && Math.abs(doorX(a.mesh)) > 0.3, 'mirror puts the door on the other side');
});

test('terraced-house designs: validate, >= 3 distinct photo pands of evidence on the front, counted openings match the model for every variant, <= 400 triangles, party walls get no openings', () => {
  for (const spec of ROW_TYPES) {
    assert.deepEqual(validateSpec(spec), [], spec.id);
    assert.equal(spec.frontOnShort, true);
    assert.ok(spec.facades.front.evidence.length >= 3 && new Set(spec.facades.front.evidence.map(e => e.pand)).size === spec.facades.front.evidence.length, `${spec.id}: evidence`);
    const [lo, hi] = spec.eavesRangeM!, flat = spec.roof.form === 'flat', eaves = flat ? (lo + hi) / 2 : 5.9, ridge = flat ? eaves : 8.6;
    assert.ok(lo < eaves && hi > eaves, 'eaves range brackets the cluster median (5.9 m for the two-storey designs, the mid-range for the flat-roof three-storey one)');
    for (const variant of Object.keys(spec.variants)) for (const mirror of spec.alternateMirror ? [false, true] : [false]) {
      const base = {lengthM: 5.0, widthM: 8.5, eavesM: eaves, ridgeM: flat ? undefined : ridge, variant, mirror};
      const {report, mesh} = generate(spec, base);
      for (const id of FACADE_IDS) assert.deepEqual(report.facades[id], spec.facades[id].counted, `${spec.id}/${variant}/${id}`);
      assert.ok(mesh.triangles <= 400, `${spec.id}/${variant}: ${mesh.triangles} triangles`);
      const midGen = generate(spec, {...base, freeSides: {left: false, right: false}}), mid = midGen.report;
      assert.equal(mid.facades.left.bays + mid.facades.right.bays, 0, 'party walls have no bays');
      const mb = midGen.mesh.bounds();
      assert.ok(mb.max[0] <= 2.5 + spec.roof.vergeOverhangM + 1e-6 && mb.min[0] >= -2.5 - spec.roof.vergeOverhangM - 1e-6, 'a mid-terrace house does not reach across its party walls');
      const b = mesh.bounds();
      assert.ok(Math.abs(b.max[1] - ridge) < 1e-6 && b.min[1] >= -1e-9, `${spec.id}: ridge reached, nothing below ground`);
      assert.ok(b.max[0] <= 2.5 + spec.roof.vergeOverhangM + 0.03, 'an end house reaches at most a proud plinth band past its wall');
    }
  }
});

test('terraced houses: params from 3DBAG keep dak_min as the eaves and hold nothing back here (the held range lives in the spec)', () => {
  const spec = ROW_TYPES[0], rect = swapAxes(minimumRotatedRectangle(house(0)));
  const attrs = {b3_h_maaiveld: 0.2, b3_h_dak_min: 6.1, b3_h_nok: 9.1, b3_h_dak_max: 9.1, b3_bouwlagen: 3};
  // a 24 degree "main plane" (dormered roof) would put the eaves at 7.1 m for a ridge-across-depth gable: ignored for terraced houses
  const roof = {form: 'gable' as const, ridgeDirRD: [1, 0] as Pt, slopeDeg: 24, slantedPlanes: 2, roofAreaM2: 60};
  const {params} = paramsFromFacts(spec, rect, attrs, roof);
  assert.ok(Math.abs(params.eavesM - 5.9) < 1e-9, `eaves ${params.eavesM}`);
  assert.equal(params.lengthM, rect.length);
  assert.ok(params.lengthM < params.widthM, 'frontage first');
  assert.ok(spec.eavesRangeM![0] < params.eavesM && params.eavesM < spec.eavesRangeM![1]);
});

// Named regression Nassaukade 63X (0363100012124441): 3DBAG ground −9.67 NAP under a +5.9 roof. With the terrain field
// and the footprint, eaves and placement stand on the trusted ground (bag3dCityJson.ts `pandGroundNap`).
test('params from 3DBAG attributes stand on the trusted ground (Nassaukade 63X); an ordinary pand is unchanged', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/bag3d-nassaukade-63x.json', import.meta.url), 'utf8'));
  const pand = (item: any) => {
    const t = item.metadata.transform, b: any = Object.values(item.feature.CityObjects).find((o: any) => o.type === 'Building');
    const ringRd = b.geometry.find((g: any) => g.lod === '0').boundaries[0][0].map((i: number) => item.feature.vertices[i]).map((v: number[]) => [v[0] * t.scale[0] + t.translate[0], v[1] * t.scale[1] + t.translate[1]]);
    return {attrs: b.attributes, ringRd};
  };
  const rect = minimumRotatedRectangle(block(14.4, 10.5)), terrainAt = sharedTerrain();
  const outlier = pand(fixture.outlier);
  const raw = paramsFromFacts(T6, rect, outlier.attrs, null);
  const trusted = paramsFromFacts(T6, rect, outlier.attrs, null, {}, {terrainAt, ringRd: outlier.ringRd});
  assert.ok(Math.abs(raw.groundNapM - -9.674) < 0.001 && raw.params.eavesM > 15, `raw eaves ${raw.params.eavesM}`);
  assert.ok(Math.abs(trusted.groundNapM - 0.47) < 0.01, `ground ${trusted.groundNapM}`);
  assert.ok(Math.abs(trusted.params.eavesM - (outlier.attrs.b3_h_dak_50p - trusted.groundNapM)) < 1e-9 && trusted.params.eavesM < 6, `eaves ${trusted.params.eavesM}`);
  assert.ok(trusted.warnings.some(w => w.includes('failed estimate')));
  const ordinary = pand(fixture.ordinary);
  assert.deepEqual(paramsFromFacts(T6, rect, ordinary.attrs, null, {}, {terrainAt, ringRd: ordinary.ringRd}), paramsFromFacts(T6, rect, ordinary.attrs, null));
  assert.equal(paramsFromFacts(T6, rect, ordinary.attrs, null).groundNapM, ordinary.attrs.b3_h_maaiveld);
});

// --- 2026-10-16 Burgemeester Hogguerstraat galerijflats (Noordoever Sloterplas): inset walls, galleries, annexes, roof body --------

const HOG = load('nw-gallery-slab-15st-hogguer.json');
const HOG_PARAMS = {lengthM: 109.5, widthM: 12.4, eavesM: 43.8};
const annexOn = (variant: string) => HOG.annexes!.filter(a => (!a.variants || a.variants.includes(variant)) && !a.exceptVariants?.includes(variant)).length;

test('gallery slab: validates, matches its counted facades for both variants, 15 storeys, annexes drawn, within 24k triangles (a 110 m, 15-storey block of 190 flats)', () => {
  assert.deepEqual(validateSpec(HOG), []);
  for (const variant of Object.keys(HOG.variants)) {
    const {report, mesh} = generate(HOG, {...HOG_PARAMS, variant});
    for (const id of FACADE_IDS) assert.deepEqual(report.facades[id], HOG.facades[id].counted, `${variant}/${id}`);
    assert.equal(report.storeys, 15);
    assert.equal(report.annexes, annexOn(variant));
    assert.ok(mesh.triangles <= 24000, `${variant}: ${mesh.triangles} triangles`);
    for (const bucket of mesh.buckets.values()) assert.ok(bucket.positions.every(Number.isFinite));
  }
});

test('gallery slab: walls stand inset from the footprint edge; lift tower and machine room stand out east (front +z) and above the roof; the long entrance only on its variant; gable windows on the south gable only', () => {
  const {mesh} = generate(HOG, HOG_PARAMS), pal = HOG.variants['concrete-buff'].palette;
  const zf = 12.4 / 2 - HOG.insetM!.front, wall = mesh.buckets.get(`stucco|${pal.wall.tint}`)!;
  let wallMaxZ = -Infinity;
  for (let i = 2; i < wall.positions.length; i += 3) if (wall.positions[i - 1] > 6 && wall.positions[i - 1] < 43.7) wallMaxZ = Math.max(wallMaxZ, wall.positions[i]);
  assert.ok(Math.abs(wallMaxZ - zf) < 1e-6, `upper long wall at the inset line ${wallMaxZ}`);
  const b = mesh.bounds();
  assert.ok(Math.abs(b.max[2] - (12.4 / 2 + 6.8)) < 0.05, `lift tower 6.8 m out of the east edge: ${b.max[2]}`);
  assert.ok(Math.abs(b.max[1] - (43.8 + 3.9)) < 1e-6, `machine room / lift top ${b.max[1]}`);
  assert.ok(b.min[2] >= -12.4 / 2 - 5.9 && b.min[1] >= -1e-9);
  assert.equal(annexOn('long-entrance'), annexOn('concrete-buff'));
  const long = generate(HOG, {...HOG_PARAMS, variant: 'long-entrance'}).mesh;
  assert.ok(long.triangles !== mesh.triangles || JSON.stringify(long.bounds()) !== JSON.stringify(b) || [...long.buckets.values()].some((bk, i) => bk.positions.length !== [...mesh.buckets.values()][i]?.positions.length), 'long-entrance draws the longer wing');
  const glass = mesh.buckets.get(`glass|${pal.glass}`)!;
  let south = 0, north = 0;
  for (let i = 0; i < glass.positions.length; i += 9) { const x = glass.positions[i]; if (x < -109.5 / 2 - 0.01) south++; if (x > 109.5 / 2 + 0.01) north++; }
  assert.ok(south >= 14 && north === 0, `gable glass south ${south} north ${north}`);
});

test('generator features absent -> byte-identical mesh: zero inset and no annexes leave type 6 unchanged', () => {
  const p = {lengthM: 15.7, widthM: 9.9, eavesM: 16.1};
  const a = generate(T6, p).mesh, b = generate({...T6, insetM: {front: 0, back: 0}, annexes: []}, p).mesh;
  assert.deepEqual([...a.buckets.keys()], [...b.buckets.keys()]);
  for (const [key, bucket] of a.buckets) assert.deepEqual(b.buckets.get(key)!.positions, bucket.positions, key);
});

test('body rectangle from the 3DBAG roof: the tall slab, not the ring with its garage row, lift shaft, entrance hall; a split-off end bay is included', () => {
  const box2 = (x0: number, x1: number, z0: number, z1: number): Pt[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const axis = minimumRotatedRectangle(box2(-55, 51, -9.5, 15.5)); // ring rectangle of the pand without its end bay
  const roofs = [
    {ring: box2(-55, 51, -3.2, 9.2), z: 43.3, area: 1314},
    {ring: box2(51, 55, -3.2, 9.2), z: 43.32, area: 50}, // the absorbed end bay (another pand), same roof level
    {ring: box2(42, 46, 9.2, 16), z: 43.3, area: 27}, // lift shaft at the slab's roof level: a local protrusion
    {ring: box2(-46, 42, 9.2, 15.5), z: 2.4, area: 500}, // garages
    {ring: box2(38, 51, -9.5, -3.2), z: 2.4, area: 80}, // entrance hall
  ];
  const body = bodyRectFromRoof(roofs, axis)!;
  assert.ok(Math.abs(body.length - 110) < 0.6 && Math.abs(body.width - 12.4) < 0.25, `${body.length} x ${body.width}`);
  assert.ok(Math.hypot(body.center[0], body.center[1] - 3) < 0.3, `centre ${body.center}`);
  assert.equal(bodyRectFromRoof([], axis), null);
});

test('a flat-roofed type keeps its own ridge key when 3DBAG reads a stepped roof as slanted (one unit for identical slabs)', () => {
  const rect = minimumRotatedRectangle(block(109.5, 12.4));
  const roof = {form: 'gable' as const, ridgeDirRD: [0, 1] as [number, number], slopeDeg: 40, slantedPlanes: 3, roofAreaM2: 30};
  const {params} = paramsFromFacts(HOG, rect, {b3_h_dak_50p: 43.3, b3_h_dak_max: 47.2, b3_h_maaiveld: -0.5}, roof);
  assert.equal(params.ridge, HOG.roof.ridge);
  assert.equal(params.roofForm, 'flat');
  assert.equal(params.storeys, 15);
});

test('review-render sun from the panorama timestamp (camera-sheets --sun=photo)', () => {
  const [az, el] = solarPosition(new Date('2025-06-21T11:40:00Z'), 52.37, 4.83); // about local solar noon at midsummer
  assert.ok(Math.abs(az - 180) < 6 && Math.abs(el - 61) < 1.5, `${az} ${el}`);
  assert.ok(solarPosition(new Date('2025-01-01T00:00:00Z'), 52.37, 4.83)[1] < -40);
});

// Zuidoost terraced designs (issue #70): Gein 3, Holendrecht-Oost, Gein 4, Kelbergen.
const ZO_TYPES = ['zo-g3-red-clad', 'zo-g3-timber-brick', 'zo-ho-hood', 'zo-ho-annex', 'zo-ho-maldenhof', 'zo-g4-canopy-pair', 'zo-g4-roof-house', 'zo-kb-patio-ribbon'].map(id => load(`${id}.json`));

test('Zuidoost designs: validate, >= 4 distinct photo pands on the front, counted openings match for every variant and handedness, <= 400 triangles, party walls blank, ridge reached', () => {
  for (const spec of ZO_TYPES) {
    assert.deepEqual(validateSpec(spec), [], spec.id);
    assert.equal(spec.frontOnShort, true);
    assert.equal(spec.rowCoherentHeights, true, `${spec.id}: one roof line per row`);
    assert.ok(new Set(spec.facades.front.evidence.map(e => e.pand)).size >= 4, `${spec.id}: evidence`);
    const [lo, hi] = spec.eavesRangeM!, flat = spec.roof.form === 'flat', eaves = (lo + hi) / 2, ridge = flat ? undefined : eaves + 3.5;
    const mode = spec.roof.eavesFromPlanes, backEavesM = mode === 'low-back' ? eaves - 2.2 : mode === 'low-front' ? eaves + 3 : undefined;
    for (const variant of Object.keys(spec.variants)) for (const mirror of spec.alternateMirror ? [false, true] : [false]) {
      const base = {lengthM: 5.3, widthM: 10, eavesM: eaves, ridgeM: mode === 'low-front' ? eaves + 6.3 : ridge, backEavesM, variant, mirror};
      const {report, mesh} = generate(spec, base);
      for (const id of FACADE_IDS) assert.deepEqual(report.facades[id], spec.facades[id].counted, `${spec.id}/${variant}/${id}`);
      assert.ok(mesh.triangles <= 400, `${spec.id}/${variant}: ${mesh.triangles} triangles`);
      const mid = generate(spec, {...base, freeSides: {left: false, right: false}});
      assert.equal(mid.report.facades.left.bays + mid.report.facades.right.bays, 0, 'party walls have no bays');
      const b = mesh.bounds();
      assert.ok(b.min[1] >= -1e-9 && (flat || Math.abs(b.max[1] - base.ridgeM!) < 1e-6), `${spec.id}: ridge reached, nothing below ground`);
      // every opening stays on the house: a mirrored edge-referenced element must not land beyond the party wall
      assert.ok(b.max[0] <= 5.3 / 2 + spec.roof.vergeOverhangM + 0.06 && b.min[0] >= -5.3 / 2 - spec.roof.vergeOverhangM - 0.06, `${spec.id}/${variant}/${mirror}: within its frontage`);
    }
  }
});

test('mirrorBays: an edge-referenced element keeps its distance from the (swapped) edge; a centre offset is negated', () => {
  const bays = [{id: 'h', w: 1, role: 'windows', elements: [{kind: 'door', ref: 'left', levels: 'ground', u: 1.1, w: 0.9, h: 2.1}, {kind: 'window', levels: 'ground', u: 0.8, w: 1, h: 1}]}] as TypeSpec['facades']['front']['bays'];
  const m = mirrorBays(bays);
  assert.deepEqual([m[0].elements[0].ref, m[0].elements[0].u], ['right', 1.1]);
  assert.equal(m[0].elements[1].u, -0.8);
  const G = load('zo-g4-canopy-pair.json'), p = {lengthM: 5.4, widthM: 10.5, eavesM: 5.4, ridgeM: 9, variant: 'blue-door'};
  const doorX = (mirror: boolean) => { const d = generate(G, {...p, mirror}).mesh.buckets.get(`door|${G.variants['blue-door'].palette.door}`)!; let lo = Infinity, hi = -Infinity; for (let i = 0; i < d.positions.length; i += 3) if (d.positions[i + 2] > 5) { lo = Math.min(lo, d.positions[i]); hi = Math.max(hi, d.positions[i]); } return [lo, hi]; };
  const [a, b] = [doorX(false), doorX(true)];
  assert.ok(Math.abs(a[0] + b[1]) < 1e-6 && Math.abs(a[1] + b[0]) < 1e-6, `door leaf mirrored about the house centre: ${a} vs ${b}`);
});

test('asymmetric gable (catslide / swept front slope): one pitch through both eaves and the ridge; equal eaves = the symmetric roof, byte for byte', () => {
  const G = load('zo-g4-canopy-pair.json'), p = {lengthM: 5.4, widthM: 10.5, eavesM: 5.4, ridgeM: 9.06, variant: 'blue-door'};
  const {tan, tRidge} = asymSlope(5.25, 5.4, 3.04, 9.06);
  assert.ok(Math.abs(Math.atan(tan) * 180 / Math.PI - 42.7) < 0.2, 'measured 3DBAG main-plane slope of the Gein 4 houses is ~45 degrees');
  assert.ok(tRidge > 0 && Math.abs(9.06 - tan * (5.25 - tRidge) - 5.4) < 1e-9 && Math.abs(9.06 - tan * (5.25 + tRidge) - 3.04) < 1e-9, 'both eaves on the planes');
  const asym = generate(G, {...p, backEavesM: 3.04});
  // roof: lowest roof vertex at the back overhang, below the front one
  const roof = asym.mesh.buckets.get(`slate|${(G.variants['blue-door'].palette.roof as {tint: string}).tint}`)!, ys = (zSign: number) => { let m = Infinity; for (let i = 0; i < roof.positions.length; i += 3) if (Math.sign(roof.positions[i + 2]) === zSign) m = Math.min(m, roof.positions[i + 1]); return m; };
  assert.ok(ys(-1) < 3.04 && ys(-1) > 2.5 && ys(1) < 5.4 && ys(1) > 4.9, `back eave ${ys(-1)}, front eave ${ys(1)}`);
  assert.equal(asym.report.wallTopM, 3.04, 'the wall box stops at the lower eaves');
  assert.ok(Math.abs(asym.mesh.bounds().max[1] - 9.06) < 1e-9);
  const sym = generate(G, p).mesh, same = generate(G, {...p, backEavesM: 5.4}).mesh;
  for (const [key, bucket] of sym.buckets) assert.deepEqual(same.buckets.get(key)!.positions, bucket.positions, key);
  // a front slope swept down to the ground storey (Gein 4 roof houses): the back storeys follow the back eaves
  const R = load('zo-g4-roof-house.json'), r = generate(R, {lengthM: 5.2, widthM: 12.5, eavesM: 2.56, backEavesM: 5.6, ridgeM: 9.1, variant: 'orange'});
  assert.equal(r.report.wallTopM, 2.56);
  const glass = r.mesh.buckets.get(`glass|${R.variants.orange.palette.glass}`)!; let backTop = -Infinity;
  for (let i = 0; i < glass.positions.length; i += 3) if (glass.positions[i + 2] < -6) backTop = Math.max(backTop, glass.positions[i + 1]);
  assert.ok(backTop > 2.8 + 0.5 && backTop < 5.6, `back upper windows sit in the 2.8 m back storeys: top ${backTop}`);
});

test('slope eaves from 3DBAG roof planes: the slope falling towards the front is the front, b3_h_dak_min only sees the lower one', () => {
  // a 10 m deep house, front to the south (RD -y): front slope 0 -> 4.4 m from the ridge, eaves 5.4; back slope catslides to 3.0 at y = 10
  const V = [[0, 0, 5.4], [5, 0, 5.4], [5, 4.4, 9.4], [0, 4.4, 9.4], [0, 10, 3.0], [5, 10, 3.0]];
  const item = {metadata: {transform: {scale: [1, 1, 1], translate: [0, 0, 0]}}, feature: {type: 'CityJSONFeature', id: 'x', vertices: V, CityObjects: {b: {type: 'BuildingPart', geometry: [{lod: '2.2', type: 'Solid', boundaries: [[[[0, 1, 2, 3]], [[3, 2, 5, 4]]]], semantics: {surfaces: [{type: 'RoofSurface'}], values: [[0, 0]]}}]}}}} as unknown as CityJsonItem;
  assert.deepEqual(slopeEavesFromItem(item, [0, -1]), {frontNap: 5.4, backNap: 3.0});
  assert.deepEqual(slopeEavesFromItem(item, [0, 1]), {frontNap: 3.0, backNap: 5.4});
  assert.equal(slopeEavesFromItem({...item, feature: {...item.feature, CityObjects: {b: {type: 'BuildingPart', geometry: [{lod: '2.2', type: 'Solid', boundaries: [[[[0, 1, 2, 3]]]], semantics: {surfaces: [{type: 'RoofSurface'}], values: [[0]]}}]}}}} as unknown as CityJsonItem, [0, -1]), null, 'one slope: no reading');
});

test('kit parts absent -> byte-identical: no canopy, boards, palette bands or annex glaze arrays leave a terraced design unchanged; present, they add their own geometry', () => {
  const G = ROW_TYPES[1], p = {lengthM: 5, widthM: 8.5, eavesM: 5.9, ridgeM: 8.5};
  const a = generate(G, p).mesh, b = generate({...G, facades: {...G.facades, front: {...G.facades.front, boards: []}}}, p).mesh;
  for (const [key, bucket] of a.buckets) assert.deepEqual(b.buckets.get(key)!.positions, bucket.positions, key);
  const C = load('zo-g3-red-clad.json'), q = {lengthM: 5.3, widthM: 8.7, eavesM: 5.7, ridgeM: 9.3};
  const withBoards = generate(C, q).mesh.triangles, without = generate({...C, facades: {...C.facades, front: {...C.facades.front, boards: undefined}}}, q).mesh.triangles;
  assert.ok(withBoards > without + 20, `battens drawn (${withBoards} vs ${without})`);
});
