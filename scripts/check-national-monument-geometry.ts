import assert from 'node:assert/strict';
import * as T from 'three';
import {buildNationalMonument} from './landmarks/national-monument-builder';
import spec from './landmarks/national-monument-spec.json';
import source from './landmarks/national-monument-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const geometries:T.BufferGeometry[]=[],group=new T.Group();
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);geometries.push(g);group.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},hip(x,y,z,w,d,h,c){const g=new T.BufferGeometry(),v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[0,h,0]];g.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4].flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,c,x,y,z);},prism(){throw Error('unused');},gableRoof(){throw Error('unused');},window(){throw Error('unused');},clock(){throw Error('unused');},sign(){throw Error('unused');}};
buildNationalMonument(spec.footprint.lengthMetres,spec.footprint.widthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const g of geometries){const p=g.getAttribute('position');for(const x of p.array)assert.ok(Number.isFinite(x));triangles+=(g.index?.count||p.count)/3;}
const counts:Record<string,number>={};for(const g of geometries)counts[g.type]=(counts[g.type]||0)+(g.index?.count||g.getAttribute('position').count)/3;console.log({triangles,counts});assert.ok(triangles<40000);const bounds=new T.Box3().setFromObject(group);assert.ok(bounds.max.y<=22.01&&bounds.max.y>=21.99);assert.ok(bounds.max.x-bounds.min.x<52&&bounds.max.z-bounds.min.z<50);

assert.equal(source.lions.length,2);assert.equal(spec.spatialSuppression,false);console.log(bounds);


const anchor=source.anchor,scale=111320*Math.cos(anchor[1]*Math.PI/180);
const mapped=source.podium.geometry.coordinates[0][0];
for(let i=0;i<mapped.length;i++){
 assert.ok(Math.abs(source.podium.ring[i][0]-(mapped[i][0]-anchor[0])*scale)<1e-7);
 assert.ok(Math.abs(source.podium.ring[i][1]-(anchor[1]-mapped[i][1])*111320)<1e-7);
 const [x,z]=source.podium.ring[i];
 assert.ok(geometries.some(g=>{const p=g.getAttribute('position');for(let k=0;k<p.count;k++)if(Math.abs(p.getX(k)-x)<1e-4&&Math.abs(p.getZ(k)-z)<1e-4&&Math.abs(p.getY(k))<1e-5)return true;return false;}),'actual mapped outer podium vertex retained');
}
for(const lion of source.lions){const [lng,lat]=lion.coordinates,[x,z]=lion.localPosition;assert.ok(Math.abs(x-(lng-anchor[0])*scale)<1e-7&&Math.abs(z-(anchor[1]-lat)*111320)<1e-7);assert.ok(new T.Raycaster(new T.Vector3(x,10,z),new T.Vector3(0,-1,0)).intersectObject(group,true).some(hit=>hit.point.y>2),'both lions stand on actual nodes');}
const [nx,nz]=source.frontUnit;
assert.equal(new T.Raycaster(new T.Vector3(nx*-5,5,nz*-5),new T.Vector3(0,-1,0),0,3.9).intersectObject(group,true).length,0,'semicircular wall retains its open interior');
const wallMiddle=source.urnWall.ring[10].map((v,i)=>(v+source.urnWall.ring[29][i])/2);
assert.ok(new T.Raycaster(new T.Vector3(wallMiddle[0],10,wallMiddle[1]),new T.Vector3(0,-1,0)).intersectObject(group,true).some(hit=>hit.point.y>5),'curved wall is present');
for(const [x,z] of [[25,0],[0,25],[25,25],[-32,0]])assert.equal(new T.Raycaster(new T.Vector3(x,50,z),new T.Vector3(0,-1,0)).intersectObject(group,true).length,0,'surrounding Dam plaza is untouched');
assert.deepEqual(spec.suppressOsmIds,['w168680619','n5413222221','n5413222222','w940729263','w1320477257']);
console.log('Exact podium/lions, open urn-wall interior and retained Dam square passed');

for(const mappedPart of [source.urnWall,source.pylonBase])for(const [x,z] of mappedPart.ring)assert.ok(geometries.some(g=>{const p=g.getAttribute('position');for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-x)<1e-4&&Math.abs(p.getZ(i)-z)<1e-4&&Math.abs(p.getY(i)-1.08)<1e-5)return true;return false;}),'exact wall/base source vertex retained');
