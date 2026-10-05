import fs from 'node:fs';
import * as T from 'three';
import {Document, NodeIO} from '@gltf-transform/core';
import {dedup, weld, prune} from '@gltf-transform/functions';
import {openTopPrism, upwardRoofPlane} from '../landmarks/house-geometry';
import type {BuildingTools} from '../landmarks/cultural-builders';

type Spec = {id:string; variant:string; height:number; localFootprint:number[][]; frontage:{localVertices:number[][];width:number;angleRadians:number}; [key:string]:unknown};
type Colour = Parameters<BuildingTools['box']>[6];
const palette: Partial<Record<Colour,string>> = {brick:'#92775c',stone:'#c4bba2',white:'#e5e5d8',slate:'#515753',glass:'#354746',dark:'#343b36',frame:'#bebdb0',green:'#446b51'};
const specs:Spec[] = JSON.parse(fs.readFileSync('scripts/jan-evertsen-pilot/native-specs.json','utf8'));

/** One bounded parametric assembly used by both native surveyed drafts. No facade textures. */
export function buildCanopyHouse(spec:Spec,b:BuildingTools) {
  const points=spec.localFootprint.slice(0,-1).map(p=>new T.Vector2(p[0],p[1]));
  const shape=new T.Shape(points);
  b.add(openTopPrism(shape,0,spec.height),'brick');
  b.add(upwardRoofPlane(shape,spec.height),'slate');
  const [a,c]=spec.frontage.localVertices,w=spec.frontage.width,angle=spec.frontage.angleRadians;
  const mid=[(a[0]+c[0])/2,(a[1]+c[1])/2],tx=Math.cos(angle),tz=-Math.sin(angle),nx=Math.sin(angle),nz=Math.cos(angle);
  function box(u:number,y:number,out:number,width:number,height:number,depth:number,color:Colour) {
    b.box(mid[0]+u*tx+out*nx,y,mid[1]+u*tz+out*nz,width,height,depth,color,angle);
  }
  function opening(u:number,y:number,width:number,height:number,shop=false) {
    // Overlay glazing and frames are on the first visible facade surface, clear of the parent wall.
    const frame=.09, color=shop?'frame':'white';
    box(u,y,.065,width,height,.095,'glass');
    box(u-width/2,y,.13,frame,height+.12,.16,color);
    box(u+width/2,y,.13,frame,height+.12,.16,color);
    box(u,y,.13,width+.1,frame,.16,color);
    box(u,y+height-frame,.13,width+.1,frame,.16,color);
    box(u,y+height*.73,.15,width,frame*.7,.18,color);
    if(!shop) box(u,y-.12,.2,width+.24,.12,.35,'stone');
  }
  // Ground floor is a coherent storefront, door and shared overhead canopy.
  const pier=spec.variant==='dark-pier-shop'?'dark':'stone';
  box(0,0,.06,w,.22,.18,pier);
  const doorWidth=.86,doorX=-w/2+.64;
  opening(doorX,.24,doorWidth,2.72,true);
  box(doorX,1.7,.25,.035,.34,.06,'dark');
  const storefrontLeft=-w/2+1.32,storefrontRight=w/2-.32,shopW=storefrontRight-storefrontLeft;
  for(let i=0;i<3;i++) opening(storefrontLeft+shopW*(i+.5)/3,.35,shopW/3-.12,2.6,true);
  for(const u of [-w/2+.1,-w/2+1.22,w/2-.1]) box(u,.22,.12,.2,2.85,.27,pier);
  box(0,3.09,.64,w+.05,.16,1.32,'stone');
  box(0,3.24,1.3,w+.06,.21,.12,'white');
  box(0,3.43,1.3,w+.12,.09,.18,'slate');
  box(0,3.26,.06,w,.36,.18,'stone');
  if(spec.variant==='pale-framed-shop') box(.36,3.83,.2,w*.66,.56,.13,'green');
  // Upper layout is expressly provisional: supplied photograph crops these levels.
  const rows=spec.height>15?4:3, upperStart=4.35, upperEnd=spec.height-2.1;
  for(let floor=0;floor<rows;floor++) {
    const y=upperStart+floor*(upperEnd-upperStart)/(rows-1);
    for(let bay=0;bay<3;bay++) {
      const u=(bay-1)*w*.285;
      opening(u,y,w*.205,1.9);
      box(u,y+.06,.17,.065,1.7,.17,'white');
    }
  }
  box(0,spec.height-.19,.055,w,.17,.21,'brick');
}

const output='artifacts/jan-evertsen-pilot/models'; fs.mkdirSync(output,{recursive:true});
for(const spec of specs) {
  const parts:{g:T.BufferGeometry;c:Colour}[]=[];
  const b={add(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,angle=0){g.rotateY(angle);g.translate(x,y,z);parts.push({g,c});},
    box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,angle=0){this.add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,angle);}} as BuildingTools;
  buildCanopyHouse(spec,b);
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(spec.id),mesh=doc.createMesh(spec.id);
  doc.getRoot().setDefaultScene(scene);
  const bounds=new T.Box3(); let triangles=0;
  for(const c of Object.keys(palette) as Colour[]) {
    const geos=parts.filter(p=>p.c===c).map(p=>p.g.index?p.g.toNonIndexed():p.g); if(!geos.length)continue;
    const positions=Float32Array.from(geos.flatMap(g=>Array.from(g.getAttribute('position').array)));
    const normals=Float32Array.from(geos.flatMap(g=>Array.from(g.getAttribute('normal').array)));
    for(let i=0;i<positions.length;i+=3)bounds.expandByPoint(new T.Vector3(positions[i],positions[i+1],positions[i+2]));
    triangles+=positions.length/9; const rgb=new T.Color(palette[c]!);
    const material=doc.createMaterial(c).setBaseColorFactor([rgb.r,rgb.g,rgb.b,1]).setRoughnessFactor(.9).setMetallicFactor(0);
    mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer)).setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer)).setMaterial(material));
  }
  scene.addChild(doc.createNode(spec.id).setMesh(mesh)); await doc.transform(weld(),dedup(),prune());
  const path=`${output}/${spec.id}.glb`; await new NodeIO().write(path,doc);
  const result={...spec,modelPath:path,triangles,bytes:fs.statSync(path).size,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},sourceArchiveStatus:'staged; sync and private commit pending',visualAcceptance:'pending; roof and upper floors provisional'};
  fs.writeFileSync(`${output}/${spec.id}.json`,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({id:spec.id,triangles,bytes:result.bytes,bounds:result.bounds}));
}
