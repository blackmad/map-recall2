import assert from 'node:assert/strict';
import { compileEntranceAssembly, entranceOpeningVoid } from './facadeEntranceAssemblies.ts';

const frame={a:[0,0],u:[1,0],n:[0,1],width:6,bottom:0,top:5};
const item={id:'raised',featureId:'preview:raised',t:3,y:1.74,width:1.2,height:2.4,colour:'#f4f1e8' as const,recess:{depthM:.42},access:{kind:'stairs' as const,pavementY:0,landingDepthM:.22,stepCount:3,riseM:.18,treadM:.28}};
const patches=compileEntranceAssembly(frame,item);
assert.ok(patches.length>=9,'recessed stair entrance produces rear, side, tread and riser planes');
assert.ok(patches.every(p=>p.previewOnly&&p.inferredDimensions),'entrance dimensions retain preview-only inferred provenance');
const z=patches.flatMap(p=>p.triangles.filter((_,index)=>index%3===2));
assert.ok(Math.min(...z)<-.4&&Math.max(...z)>.5,'assembly has real recess and outward stair depth, not a flat wall box');
assert.ok(patches.every(p=>{for(let i=0;i<p.triangles.length;i+=9){const a=p.triangles.slice(i,i+3),b=p.triangles.slice(i+3,i+6),c=p.triangles.slice(i+6,i+9),ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]),area=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]);if(area<1e-8)return false;}return true;}),'recess sides and access surfaces contain no degenerate triangles');
assert.deepEqual(entranceOpeningVoid(item),{mode:'preview-opening-void',t:3,bottom:.54,width:1.2,height:2.4,depthM:.42,inferredDimensions:true});
assert.throws(()=>compileEntranceAssembly(frame,{id:'bad',featureId:'bad',t:1,y:1,width:1,height:2,access:{kind:'stairs',pavementY:0,landingDepthM:0,stepCount:0,riseM:.2,treadM:.2}} as any));
console.log('Facade entrance assemblies: recessed planes and inferred access steps passed.');
