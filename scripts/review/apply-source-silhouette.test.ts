import assert from 'node:assert/strict';
import {compileSourceShapePreview} from './source-shape-preview.ts';
import {applySourceSilhouette} from './apply-source-silhouette.ts';
const input:any={width:600,height:500,cropSha256:'b'.repeat(64),captureDate:'2025-01-01',features:[{id:'ground:door',kind:'door',head:'rectangular',colour:'#223c35',bounds:[250,180,350,430],disposition:'agent-inspected'},{id:'ground:wall',kind:'material',material:'paint',bounds:[0,0,600,500],colour:'#d6d4bc',disposition:'agent-inspected'}]};
const study=applySourceSilhouette(compileSourceShapePreview(input),input,[[0,500],[600,500],[600,95],[450,95],[450,45],[300,45],[300,110],[0,110]]);
assert.equal(study.sourceSilhouette.mode,'source-pixel-approximate');assert.equal(study.owner.geometry.building.surfaces[0].rings[0].length,8);
const frame=study.frame,toLocal=(p:number[])=>{const dx=p[0]-frame.a[0],dz=p[2]-frame.a[1];return [dx*frame.u[0]+dz*frame.u[1],p[1]];};
const ring=study.owner.geometry.building.surfaces[0].rings[0];assert.ok(toLocal(ring[0])[0]>toLocal(ring[1])[0],'pixel x is mirrored so source image left remains screen-left');
assert.ok(study.patches.some((p:any)=>p.featureId.endsWith('ground:door')),'opening below the roof silhouette remains');
assert.ok(study.patches.every((p:any)=>p.triangles.length%9===0&&p.triangles.every(Number.isFinite)),'clipped triangles remain finite');
const outline=ring.map((p:number[])=>toLocal(p));const inside=(p:number[])=>{let hit=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j],cross=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);if(Math.abs(cross)<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7)return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
for(const patch of study.patches)for(let i=0;i<patch.triangles.length;i+=3)assert.ok(inside(toLocal(patch.triangles.slice(i,i+3))),'material and opening vertices are trimmed to the stepped skyline');
for(const patch of study.patches)for(let i=0;i<patch.triangles.length;i+=9){const a=patch.triangles.slice(i,i+3),b=patch.triangles.slice(i+3,i+6),c=patch.triangles.slice(i+6,i+9),ab=b.map((v:number,j:number)=>v-a[j]),ac=c.map((v:number,j:number)=>v-a[j]);assert.ok(Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])>1e-9,'no degenerate clipped triangles');}
console.log('source silhouette clipping passed');
