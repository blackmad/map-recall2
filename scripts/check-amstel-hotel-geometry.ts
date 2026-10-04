import assert from 'node:assert/strict';
import * as T from 'three';
import data from './landmarks/amstel-hotel-footprints.json';
import spec from './landmarks/amstel-hotel-spec.json';
const specs = [spec];
import { buildAmstelHotel } from './landmarks/amstel-hotel-builder.ts';
const everyId = new Set<string>();
for (const spec of specs) {
  for (const id of spec.suppressOsmIds) { assert.ok(!everyId.has(id), `${id} belongs to exactly one ensemble`); everyId.add(id); }
  assert.equal(spec.spatialSuppression, false);
  assert.ok(spec.footprint.lengthMetres < 90 && spec.footprint.widthMetres < 32, 'scope remains inside its actual hall, no same-suffix BAG record elsewhere');
  assert.ok(!spec.suppressOsmIds.includes('NL.IMBAG.Pand.0363100012236902'), 'actual central connector stays separate');
  const triangles: { c: string; p: T.Vector3[] }[] = [];
  const add = (g: T.BufferGeometry, c: string, x = 0, y = 0, z = 0, a = 0) => {
    g.rotateY(a); g.translate(x, y, z); const flat = g.index ? g.toNonIndexed() : g, p = flat.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) triangles.push({ c, p: [0, 1, 2].map(j => new T.Vector3(p.getX(i + j), p.getY(i + j), p.getZ(i + j))) });
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, a = 0) => add(new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, a);
  const gableRoof = (x: number,y: number,z: number,w: number,d: number,h: number,c: string) => {
    const v=[[-w/2,0,-d/2],[w/2,0,-d/2],[-w/2,0,d/2],[w/2,0,d/2],[-w/2,h,0],[w/2,h,0]], f=[0,4,5,0,5,1,2,3,5,2,5,4,0,2,4,1,5,3,0,1,3,0,3,2];
    const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(f.flatMap(i=>v[i]),3)); add(g,c,x,y,z);
  };
  buildAmstelHotel(spec.id, 1, 1, { add, box, gableRoof, clock:()=>{} } as any);
  assert.ok(triangles.length < 38000);
  const roofs = triangles.filter(t => t.c === 'slate');
  for (const t of roofs) {
    const normal=t.p[1].clone().sub(t.p[0]).cross(t.p[2].clone().sub(t.p[0]));
    if (normal.y < -.0001) assert.ok(t.p.every(p=>Math.abs(p.y-27.635)<.001), 'only the four closed finial-cone undersides face down; mansard/dormer panels face up');
  }
  assert.ok(triangles.every(t => t.p.every(p => [p.x,p.y,p.z].every(Number.isFinite))), 'all projected geometry is finite');
  const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),hit=new T.Vector3();
  const heightAt=(x:number,z:number,filter=(t:{c:string})=>true)=>{
    ray.origin.set(x,50,z);return Math.max(...triangles.filter(filter).map(t=>ray.intersectTriangle(t.p[0],t.p[1],t.p[2],false,hit)?hit.y:-Infinity));
  };
  assert.ok(heightAt(0,-3.4,t=>t.c==='slate')>29.5&&heightAt(0,-3.4,t=>t.c==='slate')<29.6,'central pavilion has surveyed29.54m top');
  assert.ok(heightAt(20,-3.4,t=>t.c==='slate')>27&&heightAt(20,-3.4,t=>t.c==='slate')<27.2,'long mansard is lower than pavilion');
  assert.ok(heightAt(-33,-3.4,t=>t.c==='slate')>28.3&&heightAt(-33,-3.4,t=>t.c==='slate')<28.5,'end pavilion retains independent roof level');
  assert.ok(heightAt(-34,-3.4)<28.5&&heightAt(1,-3.4)<29.65,'narrow stone pavilion rails preserve the actual exposed slate roof instead of covering it with a pale full-width slab');
  assert.ok(heightAt(0,12)>8.5&&heightAt(0,12)<11.5,'river conservatory stays low');
  assert.ok(heightAt(20,12)>3.4&&heightAt(20,12)<3.7,'river terrace is not extruded to hotel height');
  assert.equal(spec.suppressOsmIds.length,2,'one physical parent only');
  assert.equal(data.parent.bagId,'NL.IMBAG.Pand.0363100012165491');
  assert.ok(Math.max(...triangles.flatMap(t=>t.p.map(p=>p.y)))<30.5,'sculptures do not inflate whole building');
  console.log('Amstel Hotel:',triangles.length,'triangles; tall pavilions, lower mansard, low river terrace/conservatory verified.');
}
