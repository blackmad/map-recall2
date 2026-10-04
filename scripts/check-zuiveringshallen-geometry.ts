import assert from 'node:assert/strict';
import * as T from 'three';
import data from './landmarks/zuiveringshallen-footprints.json';
import specs from './landmarks/zuiveringshallen-specs.json';
import { buildZuiveringshallen } from './landmarks/zuiveringshallen-builders.ts';
const everyId = new Set<string>();
for (const spec of specs) {
  for (const id of spec.suppressOsmIds) { assert.ok(!everyId.has(id), `${id} belongs to exactly one ensemble`); everyId.add(id); }
  assert.equal(spec.spatialSuppression, false);
  assert.ok(spec.footprint.lengthMetres < 80 && spec.footprint.widthMetres < 50, 'scope remains inside its actual hall, no same-suffix BAG record elsewhere');
  assert.ok(!spec.suppressOsmIds.includes('NL.IMBAG.Pand.0363100012236902'), 'actual central connector stays separate');
  const triangles: { c: string; p: T.Vector3[] }[] = [];
  const add = (g: T.BufferGeometry, c: string, x = 0, y = 0, z = 0, a = 0) => {
    g.rotateY(a); g.translate(x, y, z); const flat = g.index ? g.toNonIndexed() : g, p = flat.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) triangles.push({ c, p: [0, 1, 2].map(j => new T.Vector3(p.getX(i + j), p.getY(i + j), p.getZ(i + j))) });
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, a = 0) => add(new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, a);
  buildZuiveringshallen(spec.id, 1, 1, { add, box } as any);
  assert.ok(triangles.length < 38000);
  const roofs = triangles.filter(t => t.c === 'slate');
  for (const t of roofs) {
    const normal = t.p[1].clone().sub(t.p[0]).cross(t.p[2].clone().sub(t.p[0]));
    // Roof panels must face up; rooflight boxes also have side/bottom faces.
    if (Math.abs(normal.y) > .1 && t.p.some(p => p.y < 17)) assert.ok(normal.y > 0, 'actual pitched roof faces upward');
  }
  const e = data.ensembles.find(e => e.id === spec.id)!, a = e.authorHeadingDegrees * Math.PI / 180;
  const project = (p: number[]) => { const x = (p[0] - e.anchor[0]) * 111320 * Math.cos(e.anchor[1] * Math.PI / 180), y = (p[1] - e.anchor[1]) * 110540; return [x * Math.sin(a) + y * Math.cos(a), x * Math.cos(a) - y * Math.sin(a)]; };
  const ray = new T.Ray();
  const heightAt = (x: number, z: number) => {
    ray.origin.set(x, 50, z); ray.direction.set(0, -1, 0); const hit = new T.Vector3();
    return Math.max(...roofs.filter(t => ray.intersectTriangle(t.p[0], t.p[1], t.p[2], false, hit)).map(t => { ray.intersectTriangle(t.p[0], t.p[1], t.p[2], false, hit); return hit.y; }));
  };
  assert.ok(heightAt(3, 0) > 17 && heightAt(3, 0) < 18.2, 'main hall keeps its surveyed high ridge');
  if (spec.id !== 'de-krakeling') {
    const p = e.parents.find(p => p.bagId.endsWith(spec.id === 'zuiveringshal-west' ? '6658' : '6952'))!;
    assert.ok(e.parents.every(p => p.bagId.startsWith('NL.IMBAG.Pand.036310001223')), 'canonical surveyed BAG identities, never last-four-digit matching');
    const ps = p.geometry.coordinates[0].map(project), x = (Math.min(...ps.map(p => p[0])) + Math.max(...ps.map(p => p[0]))) / 2, z = (Math.min(...ps.map(p => p[1])) + Math.max(...ps.map(p => p[1]))) / 2;
    assert.ok(heightAt(x, z) > 10.3 && heightAt(x, z) < 10.8, 'actual street wing is lower than main hall');
  }
  assert.ok(Math.max(...triangles.flatMap(t => t.p.map(p => p.y))) < 18.5, 'small rooflights do not inflate the entire building');
  console.log(`${spec.id}: ${e.parents.length} disjoint parents; ${triangles.length} triangles; high hall / low wings verified.`);
}
assert.equal(everyId.size, 58);
// Existing game facts travel with the venue ID across its2020 relocation.
// Historical-site trivia must say it concerns the former home, not the new hall.
const factData = JSON.parse((await import('node:fs')).readFileSync('public/data/extracts/amsterdam/facts.json', 'utf8'));
const krakeling = factData.features.find((f: { id: string }) => f.id === 'extract_landmarks_1635482107');
assert.ok(krakeling);
for (const fact of krakeling.facts as { text: string; sourceQuoteEnglish?: string }[]) {
  if (/foundation|Koekjesbrug/i.test(fact.text)) assert.match(fact.text, /former|previous|old home/i, 'old-location curiosity states its historical scope');
  if (/foundation/i.test(fact.text)) {
    assert.match(fact.text, /2010s/); assert.doesNotMatch(fact.text, /1910s/);
    assert.match(fact.sourceQuoteEnglish ?? '', /2010s/, 'translated source agrees with corrected decade');
  }
}
console.log('Krakeling trivia passed: former-city-center scope and corrected2010s foundation history.');
