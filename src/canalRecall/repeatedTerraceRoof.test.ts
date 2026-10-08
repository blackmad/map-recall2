import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import earcut from 'earcut';
import { localOuterRing } from './roofMesh.js';
import { repeatedTerraceRoofTriangles } from './repeatedTerraceRoof.js';
import type { RoofTri } from './roofMesh.js';

const scope = JSON.parse(fs.readFileSync(new URL('../../docs/references/marnixstraat-repeated-row/scope.json', import.meta.url), 'utf8'));
const cross = (p:RoofTri['p']) => {
  const a=p[1].map((v,i)=>v-p[0][i]),b=p[2].map((v,i)=>v-p[0][i]);
  return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
};
function hit(origin:number[],direction:number[],t:RoofTri):number|undefined {
  const c=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a:number[],b:number[])=>a.reduce((v,x,i)=>v+x*b[i],0),sub=(a:number[],b:number[])=>a.map((x,i)=>x-b[i]);
  const e1=sub(t.p[1],t.p[0]),e2=sub(t.p[2],t.p[0]),h=c(direction,e2),det=dot(e1,h);
  if(Math.abs(det)<1e-9)return;const s=sub(origin,t.p[0]),u=dot(s,h)/det;if(u<0||u>1)return;
  const q=c(s,e1),v=dot(direction,q)/det;if(v<0||u+v>1)return;const distance=dot(e2,q)/det;if(distance>0)return distance;
}

test('eight native roofs retain upward slope winding, outline bounds, native crest and visible central window',()=>{
  for(const [index,parent] of scope.parents.entries()) {
    const outer=parent.geometry.coordinates[0],origin={lng:outer[0][0],lat:outer[0][1]},kx=111320*Math.cos(origin.lat*Math.PI/180);
    const ring=localOuterRing(parent.geometry)!.slice(0,-1),nativeIndices=earcut(ring.flat());
    const vertices=parent.marnixstraatFrontage.vertices;
    const frontPoints=vertices.map(([lng,lat]:number[])=>[(lng-origin.lng)*kx,(lat-origin.lat)*110540]);
    const dx=frontPoints[1][0]-frontPoints[0][0],dy=frontPoints[1][1]-frontPoints[0][1],length=Math.hypot(dx,dy);
    const normal:[number,number]=[dy/length,-dx/length];
    const rise=2.6,eaves=parent.installedHeightMetres-rise;
    const roof=repeatedTerraceRoofTriangles(outer,origin,{front:{start:frontPoints[0],end:frontPoints[1],normal},widthM:3,gable:index%2?'step':'spout',exposedEnds:[index===0,index===7]},eaves,rise,{bayM:3,storeyM:3,cellM:1},kx);
    assert(roof.length>20);
    for(const t of roof) {
      assert(t.p.flat().every(Number.isFinite));
      const n=cross(t.p),len=Math.hypot(...n);
      assert(n.reduce((v,x,i)=>v+x*t.n[i],0)/len>.99999);
      if(t.part==='slope')assert(t.n[2]>0);
      for(const p of t.p){assert(p[2]>=eaves-1e-8&&p[2]<=parent.installedHeightMetres+1e-8);
        // Northern end has a surveyed notch: use native triangles, not its box.
        assert(Array.from({length:nativeIndices.length/3},(_,i)=>nativeIndices.slice(i*3,i*3+3).map(j=>ring[j])).some(tri=>{
          const signs=tri.map((a,i)=>{const b=tri[(i+1)%3];return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);});
          return signs.every(s=>s>=-1e-6)||signs.every(s=>s<=1e-6);
        }));
      }
    }
    const center=frontPoints[0].map((v:number,i:number)=>(v+frontPoints[1][i])/2);
    const ray=[center[0]+normal[0]*3,center[1]+normal[1]*3,eaves+rise*.35];
    const hits=roof.map(t=>({t,d:hit(ray,[-normal[0],-normal[1],0],t)})).filter(v=>v.d!==undefined).sort((a,b)=>a.d!-b.d!);
    assert(hits.length);assert.equal(hits[0].t.part,'decal');assert.equal(hits[0].t.hex,'#30463b');
    const glassRay=[ray[0]+dx/length*.22,ray[1]+dy/length*.22,ray[2]];
    const glassHits=roof.map(t=>({t,d:hit(glassRay,[-normal[0],-normal[1],0],t)})).filter(v=>v.d!==undefined).sort((a,b)=>a.d!-b.d!);
    assert(glassHits.length);assert.equal(glassHits[0].t.hex,'#354b50');
  }
});


test('party roof ends remain closed when adjacent parents have unequal crest heights',()=>{
  const origin={lng:4.877,lat:52.375},kx=111320*Math.cos(origin.lat*Math.PI/180);
  const ll=([x,y]:number[])=>[origin.lng+x/kx,origin.lat+y/110540];
  const outer=[[0,0],[12,0],[12,16],[0,16],[0,0]].map(ll);
  const roof=repeatedTerraceRoofTriangles(outer,origin,{front:{start:[0,0],end:[12,0],normal:[0,-1]},widthM:3,gable:'spout',exposedEnds:[false,false],wallHex:'#8b7059'},13,2.4,{bayM:3,storeyM:3,cellM:1},kx);
  // These horizontal rays pass above a lower neighbor but below this roof's
  // crest. They must hit a masonry party closure, rather than an open volume.
  for(const [ray,direction,nx]of[[[14,8,14],[-1,0,0],1],[[-2,8,14],[1,0,0],-1]]as const){
    const hits=roof.map(t=>({t,d:hit([...ray],[...direction],t)})).filter(v=>v.d!==undefined).sort((a,b)=>a.d!-b.d!);
    assert(hits.length,'Party roof gap exposes sky');assert.equal(hits[0].t.part,'plate');assert.equal(hits[0].t.hex,'#8b7059');assert(Math.abs(hits[0].d!-2)<1e-6);assert.equal(hits[0].t.n[0],nx);
  }
});
