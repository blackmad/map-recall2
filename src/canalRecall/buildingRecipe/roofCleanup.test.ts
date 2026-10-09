/**
 * Named regressions for 3DBAG roof artefacts on Bilderdijkstraat (integrator
 * review 2026-10-09): a box on 079721's roof, a spike on 155417, a "pyramid"
 * (ridge run out to a cornice front) on 153622, lumps on 081118 and 157650.
 * Gabled fronts (step/neck) keep their raised crown roofs.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from './facts.ts';
import {cleanRoof, FRONT_ZONE_M, HIP_ALLOWANCE_M, RAISE_M} from './roofCleanup.ts';

const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
const horizontal = (f: BuildingFacts) => ({horizontalFronts: f.fronts.map(x => x.street)});
const planArea = (ring: number[][]) => Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const segment = (p: number[], a: number[], b: number[]) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };

test('079721: the 7 m² box standing 2.5 m proud of the flat roof is clamped to the roof', () => {
  const f = facts('bilder-079721'), {facts: out, report} = cleanRoof(f, horizontal(f));
  assert.ok(f.heights.roofMaxM > 20.4);
  assert.ok(Math.abs(out.heights.roofMaxM - 18.02) < 0.05, `roof max ${out.heights.roofMaxM}`);
  assert.deepEqual(report.actions.filter(a => a.kind === 'raised-cluster').map(a => a.surfaceIds.map(s => s.split(':').at(-1))), [['50']]);
  // Plan geometry is untouched: the clean-up only moves heights.
  for (const [i, s] of out.roofsRD.entries()) assert.ok(Math.abs(planArea(s.ringsRD[0]) - planArea(f.roofsRD[i].ringsRD[0])) < 1e-3);
});

test('155417: the 2 m² 66° spike ends at the surrounding roof top', () => {
  const f = facts('bilder-155417'), {facts: out} = cleanRoof(f, horizontal(f));
  assert.ok(f.heights.roofMaxM - out.heights.roofMaxM > 2, 'spike removed');
  assert.ok(out.heights.roofMaxM <= 16.5 + 1e-6);
});

test('153622: a ridge run out to the cornice front is hipped back, the ridge itself stays', () => {
  const f = facts('bilder-153622'), {facts: out, report} = cleanRoof(f, horizontal(f));
  assert.ok(report.actions.some(a => a.kind === 'front-hip'));
  const front = f.fronts[0], g = f.heights.groundNAP;
  const high = out.roofsRD.flatMap(s => s.vertices).filter(v => v[2] - g > front.eavesM + HIP_ALLOWANCE_M && Math.min(...front.chainRD.slice(1).map((q, i) => segment(v, front.chainRD[i], q))) < 0.3);
  assert.equal(high.length, 0, 'no roof vertex on the frontage above eaves + allowance');
  assert.ok(Math.abs(out.heights.roofMaxM - f.heights.roofMaxM) < 0.01, 'the surveyed ridge height is kept behind the hip');
});

test('gabled fronts keep their LoD2.2 crown roofs (step 155418/156286/156287, neck 157154)', () => {
  for (const id of ['bilder-155418', 'bilder-156286', 'bilder-156287', 'bilder-157154']) {
    const f = facts(id), {report} = cleanRoof(f, {horizontalFronts: []});
    const g = f.heights.groundNAP;
    for (const a of report.actions) {
      // Anything clamped must lie outside the front zone.
      const surfaces = f.roofsRD.filter(s => a.surfaceIds.includes(s.surfaceId));
      assert.ok(surfaces.every(s => s.vertices.every(v => f.fronts.every(fr => Math.min(...fr.chainRD.slice(1).map((q, i) => segment(v, fr.chainRD[i], q))) >= FRONT_ZONE_M))), `${id} clamped a front-zone surface`);
      assert.ok(a.fromTopM - a.toTopM > RAISE_M && Number.isFinite(g));
    }
    assert.ok(report.roofMaxM > 18, `${id} keeps its crown height`);
  }
});

test('houses without artefacts pass through unchanged', () => {
  for (const id of ['bilder-080336', 'bilder-087959', 'bilder-092394', 'bilder-152363']) {
    const f = facts(id), out = cleanRoof(f, horizontal(f));
    assert.equal(out.facts, f, id);
    assert.equal(out.report.actions.length, 0);
  }
});
