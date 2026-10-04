import assert from 'node:assert/strict';
import * as T from 'three';
import { buildAmstelTowerLandmark } from './landmarks/amstel-towers-builders';
import type { BuildingTools } from './landmarks/cultural-builders';
import specs from './landmarks/amstel-towers-specs.json';
import sources from './landmarks/amstel-towers-footprints.json';
import pois from './landmarks/amstel-towers-pois.json';

for (const spec of specs) {
  const geometries: T.BufferGeometry[]=[];
  const add: BuildingTools['add']=(geometry,_colour,x=0,y=0,z=0,angle=0)=>{
    geometry.rotateY(angle);geometry.translate(x,y,z);geometries.push(geometry);
  };
  const box: BuildingTools['box']=(x,y,z,w,h,d,c,angle=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,angle);
  // Conservative lettering allowance; the shared exporter owns final glyphs.
  const b:BuildingTools={add,box,prism:()=>{throw Error('unsupported prism')},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:(text,x,y,z,pixel,c='dark')=>{
    for(let i=0;i<text.length*35;i++)box(x+(i%30)*pixel,y+Math.floor(i/30)*pixel,z,pixel,pixel,pixel*.45,c);
  }};
  buildAmstelTowerLandmark(spec.id,0,0,b);
  const bounds=new T.Box3();let triangles=0;
  for(const geometry of geometries){geometry.computeBoundingBox();bounds.union(geometry.boundingBox!);triangles+=(geometry.index?.count??geometry.getAttribute('position').count)/3;for(const v of geometry.getAttribute('position').array)assert(Number.isFinite(v));}
  assert(triangles<40000,`${spec.id} triangle budget`);assert.equal(spec.spatialSuppression,false);assert.equal(spec.surveyed.northOffsetDegrees,-20.3);
  assert(spec.suppressOsmIds.every(id=>/^(?:[nwr]\d+|NL\.IMBAG\.Pand\.\d{16})$/.test(id)));
  assert(specs.filter(s=>s.id!==spec.id).every(other=>!other.suppressOsmIds.some(id=>spec.suppressOsmIds.includes(id))), 'towers do not suppress each other');
  const source=sources.find(s=>s.id===spec.id)!;
  assert(source.geometry.coordinates.length);
  assert(source.mappedParts.every(part=>spec.suppressOsmIds.includes(part.osmId)),'every exact owned legacy volume suppressed');
  assert(source.mappedParts.length>=8,'roof/podium/corner part audit included');assert(pois.find(p=>p.modelId===spec.id)?.description);
  const height=bounds.max.y;assert(Math.abs(height-({ 'rembrandt-tower':150,'breitner-tower':95,'mondriaan-tower':122.3 }[spec.id]!))<.1);
  console.log(spec.id,JSON.stringify({triangles:Math.round(triangles),height:Number(height.toFixed(2)),width:Number((bounds.max.x-bounds.min.x).toFixed(2)),depth:Number((bounds.max.z-bounds.min.z).toFixed(2))}));
  geometries.forEach(g=>g.dispose());
}
