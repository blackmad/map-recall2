import assert from 'node:assert/strict';
import * as T from 'three';
import specs from './landmarks/industrial-theater-specs.json';
import { buildIndustrialTheaterLandmark } from './landmarks/industrial-theater-builders.ts';
const spec = specs.find(s => s.id === 'stadsschouwburg')!;
assert.deepEqual(spec.suppressOsmIds, ['w57863115', 'NL.IMBAG.Pand.0363100012168738'], 'actual current BAG parent must not survive as a taller procedural duplicate');
assert.equal(spec.spatialSuppression, false);
const faces: {colour: string; p: T.Vector3[]}[] = [];
const add = (g: T.BufferGeometry, colour: string, x = 0, y = 0, z = 0, angle = 0) => {
 g.rotateY(angle);g.translate(x,y,z);const f=g.index?g.toNonIndexed():g,p=f.getAttribute('position');
 for(let i=0;i<p.count;i+=3)faces.push({colour,p:[0,1,2].map(j=>new T.Vector3(p.getX(i+j),p.getY(i+j),p.getZ(i+j)))});
};
const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
buildIndustrialTheaterLandmark('stadsschouwburg',spec.footprint.lengthMetres,spec.footprint.widthMetres,{add,box,prism:()=>{},hip:()=>{},window:()=>{},sign:()=>{}} as any);
for(const h of [17.5,22.5]) {
 const upper=faces.filter(t=>t.p.every(p=>Math.abs(p.y-h)<.001));
 assert.ok(!upper.some(t=>t.p[1].clone().sub(t.p[0]).cross(t.p[2].clone().sub(t.p[0])).y>.001), 'base extrusion no longer owns a duplicate upward brick/dark cap');
 const roof=faces.filter(t=>t.colour==='slate'&&t.p.every(p=>Math.abs(p.y-h-.03)<.001));
 assert.ok(roof.length>2,'separate slate lid spans the mapped body');
 assert.ok(roof.every(t=>t.p[1].clone().sub(t.p[0]).cross(t.p[2].clone().sub(t.p[0])).y>0), 'slate lid normals face up for coherent lighting');
}
console.log('Stadsschouwburg: exact BAG alias, upward slate lids and removed duplicate caps verified.');
