import assert from 'node:assert/strict';
import {compileSourceShapePreview} from './source-shape-preview';
const feature:any={id:'awning',kind:'awning',bounds:[0,110,704,232],state:'extended',colour:'#bca56e',stripeColour:'#dddccd',stripeCount:24,awningProfile:'curved',valance:'straight',disposition:'agent-inspected'};
const render=(f:any)=>compileSourceShapePreview({features:[f],width:704,height:539,cropSha256:'a'.repeat(64),captureDate:'2025-01-01'}).patches;
const p=render(feature),ys=p.flatMap(p=>p.triangles.filter((_,i)=>i%3===1)),zs=p.flatMap(p=>p.triangles.filter((_,i)=>i%3===2));
assert.ok(Math.max(...ys)-Math.min(...ys)>1.20,'front silhouette spans actual crop height, not a thin fixed strip');assert.ok(Math.max(...zs)-Math.min(...zs)>.4,'canopy projects from wall');assert.equal(new Set(p.map(p=>p.colour)).size,2,'striped fabric preserved');assert.ok(new Set(zs.map(z=>z.toFixed(3))).size>6,'curved profile has depth subdivisions');
assert.ok(render({...feature,state:'absent'}).length===0);assert.ok(render({...feature,state:'unknown'}).length===0);
const retracted=render({...feature,state:'retracted'});const rz=retracted.flatMap(p=>p.triangles.filter((_,i)=>i%3===2));assert.ok(Math.max(...rz)-Math.min(...rz)<.001,'closed awning never gets extended fabric');
console.log('Awning geometry: visible silhouette, projection, curved striped canopy, and absent/unknown/retracted states passed.');
