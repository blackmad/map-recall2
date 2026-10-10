/**
 * Regressions from the Marnixstraat install (2026-10-10):
 *  - Marnixstraat 124-138: the backs of a straight row were one 1,224 m2 blank plane (GLB audit blank-wall) -> inferred rear
 *    windows, attached, never on a party wall;
 *  - the same face had 11 downward roof triangles: a crown whose profile lies on the eaves line (narrow stepped gable)
 *    was extruded as one polygon, leaving a 13 m zero-height strip with a downward bottom wall;
 *  - Marnixstraat 100-ish (marnix-c) 169033|174107: a 0.14 m frontage step made the jog-backing masonry with backwards
 *    winding, which z-fought the neighbour (0.08 m2);
 *  - Bilderdijkstraat joints: mm-wide abutment overlaps are not z-fighting; 2-8 cm survey front steps are snapped.
 *   node --import tsx --test src/canalRecall/blockFace/rearsAndWinding.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {auditFile} from '../../../scripts/audit-glb-quality.ts';
import {compileBlockFace, closeFrontSlits, planFaceGround, zFightArea} from './compile.ts';
import {houseIntents, validateBlockFace} from './intent.ts';

const load = (id: string) => {
  const dir = `scripts/block-face/faces/${id}`, members = JSON.parse(fs.readFileSync(path.join(dir, 'discovery.json'), 'utf8')).members;
  const face = validateBlockFace(JSON.parse(fs.readFileSync(path.join(dir, 'intent.json'), 'utf8')), members);
  const facts = new Map(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(path.join(dir, 'pands', h.pandId, 'facts.json'), 'utf8')) as BuildingFacts]));
  const st = JSON.parse(fs.readFileSync(path.join(dir, 'strip.json'), 'utf8'));
  return {face, facts, strip: {heightPx: st.height, pixelsPerMetre: st.pixelsPerMetre, groundNAP: st.groundNAP}};
};

test('Marnixstraat 124-138: inferred rears clear blank-wall legitimately, attached and modest, no inverted roof', async () => {
  const {face, facts} = load('marnix-124-138');
  const r = await compileBlockFace(face, facts);
  assert.deepEqual(r.gates.filter(g => !g.pass), []);
  assert.equal(r.rears.length, 8);
  for (const rear of r.rears) {
    assert.equal(rear.source, 'inferred');
    assert.ok(rear.windows >= 12, `${rear.pandId} has a window grid`);
    assert.ok(rear.triangles / rear.windows <= 4, 'frame plate + pane only');
    assert.ok(rear.maxProudM <= 0.05, 'attached within 5 cm');
  }
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rear-')), 'chunk.glb');
  fs.writeFileSync(tmp, r.chunk.glb);
  const audit = await auditFile(tmp);
  const fails = audit.findings.filter(f => f.severity === 'fail').map(f => f.kind);
  assert.ok(!fails.includes('blank-wall'), `blank-wall: ${audit.findings.filter(f => f.kind === 'blank-wall').map(f => f.message).join('; ')}`);
  assert.ok(!fails.includes('inverted-roof'));
  assert.ok(!audit.findings.some(f => f.kind === 'detached' && f.severity === 'fail'), 'no hovering windows (rear wing walls are lower than the main body)');
  // Without inference the back is the blank plane the audit rejected.
  const bare = await compileBlockFace(face, facts, 'bare', {inferRears: false});
  fs.writeFileSync(tmp, bare.chunk.glb);
  assert.ok((await auditFile(tmp)).findings.some(f => f.kind === 'blank-wall' && f.severity === 'fail'));
});

test('rear windows are never placed where a neighbour shares the wall', async () => {
  const {face, facts} = load('marnix-124-138');
  const r = await compileBlockFace(face, facts);
  // A straight row's rear edges are its own outer wall: nothing is skipped; party walls are side edges and are not rear-facing.
  assert.ok(r.rears.every(x => x.edges.every(e => e.skippedShared === 0)));
  // Shift the right neighbour's ring onto the left house's rear edge: the shared span is skipped.
  const {addInferredRear} = await import('./rear.ts');
  const a = structuredClone(facts.get(face.houses[1].pandId)!), b = structuredClone(facts.get(face.houses[2].pandId)!);
  const built = compileBuilding(houseIntents(face)[1], a);
  // Re-use house 1's own footprint as the "neighbour": every rear edge is then shared.
  const report = addInferredRear(built.group, built.facts, built.anchorRD, [3.2, 3.2, 3.2], 9.6, '#223344', '#eeeeee', [a]);
  assert.equal(report.windows, 0);
  assert.ok(report.edges.every(e => e.windowsPerStorey === 0));
  void b;
});

test('narrow stepped gable: the crown has no zero-height strip along the eaves line', () => {
  const {face, facts} = load('marnix-124-138');
  const g = planFaceGround(face, closeFrontSlits([...facts.values()]).facts);
  const i = 1, built = compileBuilding(houseIntents(face)[i], g.facts[i]);
  built.group.updateMatrixWorld(true);
  let down = 0, crowns = 0;
  built.group.traverse(o => {
    if (!(o instanceof T.Mesh) || !o.name.startsWith('crown/') || o.name === 'crown/edge') return;
    crowns++;
    const p = o.geometry.getAttribute('position'), idx = o.geometry.index, n = idx ? idx.count : p.count;
    for (let t = 0; t < n; t += 3) {
      const v = [0, 1, 2].map(k => new T.Vector3().fromBufferAttribute(p, idx ? idx.getX(t + k) : t + k));
      const nn = new T.Vector3().crossVectors(v[1].clone().sub(v[0]), v[2].clone().sub(v[0]));
      const area = nn.length() / 2; nn.normalize();
      if (nn.y < -0.5 && area > 0.5) down++;
    }
  });
  assert.ok(crowns >= 1);
  assert.equal(down, 0, 'no wide downward crown wall (it sat on the eaves line, coincident with the upward top wall)');
});

test('jog-backing masonry: caps face up and sides face out, whatever the footprint orientation (marnix-c 169033|174107)', async () => {
  const {face, facts} = load('marnix-c');
  const r = await compileBlockFace(face, facts);
  assert.deepEqual(r.interference.filter(i => !i.pass), []);
  const g = planFaceGround(face, closeFrontSlits([...facts.values()]).facts);
  for (const [i, intent] of houseIntents(face).entries()) {
    const built = compileBuilding(intent, g.facts[i]);
    built.group.updateMatrixWorld(true);
    built.group.traverse(o => {
      if (!(o instanceof T.Mesh) || !o.name.startsWith('shell/jog-backing')) return;
      const p = o.geometry.getAttribute('position'), tris: T.Vector3[][] = [];
      for (let t = 0; t < p.count; t += 3) tris.push([0, 1, 2].map(k => new T.Vector3().fromBufferAttribute(p, t + k)));
      const normal = (v: T.Vector3[]) => new T.Vector3().crossVectors(v[1].clone().sub(v[0]), v[2].clone().sub(v[0]));
      const caps = tris.filter(v => normal(v).length() > 2e-3 && Math.abs(normal(v).normalize().y) > 0.9 && v[0].y > 1);
      const inCap = (x: number, z: number) => caps.some(v => {
        const s1 = (v[1].x - v[0].x) * (z - v[0].z) - (v[1].z - v[0].z) * (x - v[0].x), s2 = (v[2].x - v[1].x) * (z - v[1].z) - (v[2].z - v[1].z) * (x - v[1].x), s3 = (v[0].x - v[2].x) * (z - v[2].z) - (v[0].z - v[2].z) * (x - v[2].x);
        return (s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0);
      });
      for (const v of caps) assert.ok(normal(v).y > 0, `${intent.id}: jog cap faces up`);
      // Every side wall must have its normal pointing away from the polygon's own cap area, at least on average.
      let outward = 0, inward = 0;
      for (const v of tris) {
        const nn = normal(v), area = nn.length() / 2;
        if (area < 1e-3) continue;
        nn.normalize();
        if (Math.abs(nn.y) > 0.9) continue;
        const mid = v.reduce((s, q) => s.add(q), new T.Vector3()).multiplyScalar(1 / 3);
        if (inCap(mid.x + nn.x * 0.003, mid.z + nn.z * 0.003)) inward += area; else outward += area;
      }
      assert.ok(inward <= outward * 0.05, `${intent.id}: jog sides face outward (outward ${outward.toFixed(2)} m2, inward ${inward.toFixed(2)} m2)`);
    });
  }
});

test('z-fight measure: a few-mm abutment at a party line is not z-fighting; a real overlap still is', () => {
  const tri = (x0: number, x1: number) => ({p: [[x0, 0, 0], [x1, 0, 0], [x0, 4, 0]], n: [0, 0, 1], slot: 'door', surface: 'door'});
  const left = tri(0, 1), right = {...tri(0.997, 2), p: [[0.997, 0, 0], [2, 0, 0], [0.997, 4, 0]]};
  assert.ok(zFightArea([left], [right]) > 0, 'raw overlap exists');
  assert.equal(zFightArea([left], [right], 0.01, undefined, 0.005), 0);
  const real = {...tri(0.5, 2), p: [[0.5, 0, 0], [2, 0, 0], [0.5, 4, 0]]};
  assert.ok(zFightArea([left], [real], 0.01, undefined, 0.005) > 0.3);
});

test('Bilderdijkstraat 157757|164549: a 5 cm survey front step is snapped flush; larger real setbacks are left', async () => {
  const {face, facts, strip} = load('bilder-157757-164549');
  const r = await compileBlockFace(face, facts, undefined, {strip});
  assert.equal(r.frontSnaps.length >= 1, true);
  const s = r.frontSnaps[0];
  assert.ok(Math.abs(s.stepBeforeM) >= 0.04 && Math.abs(s.stepBeforeM) <= 0.09);
  assert.ok(Math.abs(s.stepAfterM!) < 0.015, `step after snap ${s.stepAfterM}`);
  assert.deepEqual(r.interference.filter(i => !i.pass), []);
  // Marnix-c's 0.137 m frontage step is a real setback: not snapped.
  const mc = load('marnix-c'), rc = await compileBlockFace(mc.face, mc.facts);
  assert.ok(!rc.frontSnaps.some(x => Math.abs(x.stepBeforeM) > 0.1));
});
