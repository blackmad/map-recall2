/**
 * Inferred rears must be correct geometry: no coplanar or tight (< 3 cm) same-facing overlap with their own wall, with each
 * other, or with a neighbour's wall (lane rear-zfight 2026-10-14).
 *
 * Every Kinkerstraat sheet said GATES FAIL from the GLB audit's z-fight check: kinker-1-29 had 186.5 m2 coplanar + 115 m2
 * tight overlap, 1.5 m2 with `--no-rears`. Cause: each inferred window was a full frame plate 3 cm proud of the wall (inside
 * the audit's 2-3 cm "tight" band, which bleeds through at distance) with a glass pane only 1.5 cm in front of it (coplanar
 * with the plate it covered). The window is now a sloped frame ring standing on the wall around a glass pane 4 cm proud:
 * nothing is laid parallel within 3 cm of anything else, and the frame touches the wall so nothing floats.
 *
 *   node --import tsx --test src/canalRecall/blockFace/rearZFight.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import type {MaterialSoup} from '../landmarks/facadeCompare.ts';
import {auditZFight} from '../landmarks/geometryAudit.ts';
import {loadMaterialSoup} from '../../../scripts/landmarks/material-soup.ts';
import {addInferredRear} from './rear.ts';
import {compileBlockFace} from './compile.ts';
import {validateBlockFace} from './intent.ts';

/** A pand with a vertical wall (12 m) on every footprint edge, normals outward, in recipe-local x/z (anchor RD 0,0). */
function pand(id: string, ring: number[][]): {facts: BuildingFacts; group: T.Group} {
  const area = ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const pos: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], la = [a[0], -a[1]], lb = [b[0], -b[1]];
    // Outward normal in RD for a CCW ring is (dy, -dx); in local (x, z = -y) that is (dy, dx).
    const n = area > 0 ? [b[1] - a[1], b[0] - a[0]] : [a[1] - b[1], a[0] - b[0]];
    const quad = [[la[0], 0, la[1]], [lb[0], 0, lb[1]], [lb[0], 12, lb[1]], [la[0], 12, la[1]]];
    const cross = (() => { const u = [quad[1][0] - quad[0][0], 0, quad[1][2] - quad[0][2]]; return [-u[2] * 12, 0, u[0] * 12]; })(); // (b-a) x up
    const flip = cross[0] * n[0] + cross[2] * n[1] < 0;
    const tri = (i0: number, i1: number, i2: number) => pos.push(...quad[i0], ...(flip ? quad[i2] : quad[i1]), ...(flip ? quad[i1] : quad[i2]));
    tri(0, 1, 2); tri(0, 2, 3);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const wall = new T.Mesh(g, new T.MeshStandardMaterial()); wall.name = 'shell/walls'; wall.userData = {surface: 'wall'};
  const group = new T.Group(); group.add(wall);
  const facts = {pandId: id, fronts: [{outwardNormalRD: [0, -1]}], surveyFootprintPolygonsRD: [[ring]]} as unknown as BuildingFacts;
  return {facts, group};
}

/** World-space triangles of a group as an audit soup; material per mesh role (brick / frame / glass). */
function soupOf(groups: T.Group[]): MaterialSoup {
  const materials = [{name: 'brick', rgb: [120, 60, 40] as [number, number, number]}, {name: 'frame', rgb: [230, 230, 230] as [number, number, number]}, {name: 'glass', rgb: [30, 40, 50] as [number, number, number]}];
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  for (const grp of groups) {
    grp.updateMatrixWorld(true);
    grp.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      const p = (o.geometry as T.BufferGeometry).getAttribute('position'), m = o.userData.surface === 'glass' ? 2 : o.userData.surface === 'trim' ? 1 : 0, v = new T.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); indices.push(positions.length / 3); positions.push(v.x, v.y, v.z); if (i % 3 === 2) triMaterial.push(m); }
    });
  }
  return {positions, indices, triMaterial, materials};
}

test('two-pand L-shaped block: inferred rears have zero coplanar or tight overlap, skip the wing that covers the neighbour, stay attached', () => {
  // Street to the south. A is a plain 6 x 10 m house; B is an L whose rear wing (x 3..12, y 10..14) wraps behind half of A.
  const A = pand('A', [[0, 0], [6, 0], [6, 10], [0, 10]]);
  const B = pand('B', [[6, 0], [12, 0], [12, 14], [3, 14], [3, 10], [6, 10]]);
  const ra = addInferredRear(A.group, A.facts, [0, 0], [3.2, 3.2, 3.2], 9.6, '#223344', '#eeeeee', [B.facts]);
  const rb = addInferredRear(B.group, B.facts, [0, 0], [3.2, 3.2, 3.2], 9.6, '#223344', '#eeeeee', [A.facts]);
  // A's rear edge is half covered by B's wing: the covered span is skipped, the open yard span keeps its window.
  assert.equal(ra.edges.length, 1);
  assert.ok(ra.edges[0].skippedShared >= 1, 'window on the span B covers is skipped');
  assert.ok(ra.edges[0].windowsPerStorey >= 1, 'the yard span keeps a window');
  assert.ok(rb.windows >= 9, `B's rear has a grid (${rb.windows})`);
  // No window centre of A lies on or inside B's footprint (it would sit on B's wall).
  const meshes: T.Mesh[] = [];
  A.group.traverse(o => { if (o instanceof T.Mesh && o.userData.component === 'rear') meshes.push(o); });
  for (const m of meshes) {
    const p = (m.geometry as T.BufferGeometry).getAttribute('position');
    for (let i = 0; i < p.count; i++) assert.ok(p.getX(i) < 3 - 0.2, `A's rear window at x ${p.getX(i).toFixed(2)} lies on B's wing`);
  }
  // Correct geometry: the audit's coplanar and tight bands are empty (they were 3 cm plate on brick, 1.5 cm glass on plate).
  const z = auditZFight(soupOf([A.group, B.group]));
  assert.equal(+z.area.toFixed(3), 0, `coplanar overlap ${z.area} m2`);
  assert.equal(+z.tightArea.toFixed(3), 0, `tight (2-3 cm) overlap ${z.tightArea} m2`);
  // Attached: every rear vertex is between 0 and 5 cm off its wall (rear walls face +y in RD, i.e. -z local, at z = -10 or -14).
  for (const [grp, rep] of [[A.group, ra], [B.group, rb]] as const) {
    assert.ok(rep.maxProudM <= 0.05);
    grp.traverse(o => {
      if (!(o instanceof T.Mesh) || o.userData.component !== 'rear') return;
      const p = (o.geometry as T.BufferGeometry).getAttribute('position');
      let touch = Infinity;
      for (let i = 0; i < p.count; i++) {
        const off = Math.min(...[-10, -14].map(w => Math.abs(p.getZ(i) - w)));
        assert.ok(off <= 0.05 + 1e-6, `proud ${off}`);
        touch = Math.min(touch, off);
      }
      if (o.userData.surface === 'trim') assert.ok(touch <= 0.005, 'the frame stands on the wall');
    });
  }
});

test('kinker-1-29 (named regression): the compiled chunk has under 5 m2 of visible coplanar + tight z-fighting', async () => {
  const dir = 'scripts/block-face/faces/kinker-1-29', members = JSON.parse(fs.readFileSync(path.join(dir, 'discovery.json'), 'utf8')).members;
  const {fileTypeLoader} = await import('./typeLibrary.ts');
  const {sharedTerrain} = await import('../../../scripts/lib/terrainField.ts');
  const face = validateBlockFace(JSON.parse(fs.readFileSync(path.join(dir, 'intent.json'), 'utf8')), members, fileTypeLoader());
  const facts = new Map(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(path.join(dir, 'pands', h.pandId, 'facts.json'), 'utf8')) as BuildingFacts]));
  const r = await compileBlockFace(face, facts, 'face-kinker-1-29', {terrainAt: sharedTerrain()});
  assert.equal(r.rears.length, 11);
  assert.ok(r.rears.reduce((s, x) => s + x.windows, 0) >= 100, 'rears still carry their window grids');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rear-z-')), 'chunk.glb');
  fs.writeFileSync(tmp, r.chunk.glb);
  const z = auditZFight(await loadMaterialSoup(tmp));
  assert.ok(z.area + z.tightArea < 5, `kinker-1-29 z-fight ${z.area.toFixed(1)} m2 coplanar + ${z.tightArea.toFixed(1)} m2 tight (was 186.5 + 115.0)`);
});

test('a shell standing 4 cm behind the BAG rear edge: the window sits on the measured wall, not on the BAG line', () => {
  const shell = pand('S', [[0, 0], [8, 0], [8, 10.04], [0, 10.04]]);
  const facts = {...shell.facts, surveyFootprintPolygonsRD: [[[[0, 0], [8, 0], [8, 10], [0, 10]]]]} as unknown as BuildingFacts;
  const r = addInferredRear(shell.group, facts, [0, 0], [3.2, 3.2, 3.2], 9.6, '#223344', '#eeeeee', []);
  assert.ok(r.windows >= 6);
  shell.group.traverse(o => {
    if (!(o instanceof T.Mesh) || o.userData.component !== 'rear') return;
    const p = (o.geometry as T.BufferGeometry).getAttribute('position');
    for (let i = 0; i < p.count; i++) { const proud = -10.04 - p.getZ(i); assert.ok(proud >= -0.001 && proud <= 0.041, `vertex ${proud.toFixed(3)} m off the wall`); }
  });
  const z = auditZFight(soupOf([shell.group]));
  assert.equal(+(z.area + z.tightArea).toFixed(3), 0);
});

test('kinker-363-371 089983 (sloped wall top under a roof cut): no frame reaches above the wall it stands on', async () => {
  const {wallTopAt} = await import('./rear.ts');
  // One rear wall facing -z local (RD +y) at z = -10, its top sloping from 12 m at x = 0 to 6 m at x = 8.
  const quad = [[0, 0, -10], [8, 0, -10], [8, 6, -10], [0, 12, -10]];
  const facing = new T.Vector3().crossVectors(new T.Vector3(8, 0, 0), new T.Vector3(8, 6, 0)).z < 0; // order 0,1,2 faces -z
  const order = facing ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(order.flatMap(i => quad[i]), 3));
  const wall = new T.Mesh(g, new T.MeshStandardMaterial()); wall.name = 'shell/walls'; wall.userData = {surface: 'wall'};
  const group = new T.Group(); group.add(wall);
  assert.ok(Math.abs(wallTopAt(group, [4, -10], [0, -1]) - 9) < 1e-3, 'height at the point, not the highest corner');
  const facts = {pandId: 'W', fronts: [{outwardNormalRD: [0, -1]}], surveyFootprintPolygonsRD: [[[[0, 0], [8, 0], [8, 10], [0, 10]]]]} as unknown as BuildingFacts;
  const r = addInferredRear(group, facts, [0, 0], [3, 3, 3, 3], 12, '#223344', '#eeeeee', []);
  assert.ok(r.windows >= 3);
  group.traverse(o => {
    if (!(o instanceof T.Mesh) || o.userData.component !== 'rear') return;
    const p = (o.geometry as T.BufferGeometry).getAttribute('position');
    for (let i = 0; i < p.count; i++) assert.ok(p.getY(i) <= 12 - 0.75 * p.getX(i) + 1e-6, `frame vertex at x ${p.getX(i).toFixed(2)} y ${p.getY(i).toFixed(2)} above the wall top`);
  });
});
