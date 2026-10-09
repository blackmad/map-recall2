/** Inspect the delivered compressed asset, rather than only builder geometry.
 * The reported red roof belongs to the domestic Singel452 frontage behind the
 * pale Herengracht church front. Rays across its near end must find continuous
 * masonry from ground to the visible triangular end, without a floating gap.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const source=JSON.parse(fs.readFileSync('scripts/landmarks/singelkerk-footprints.json','utf8'));
const file=process.argv[2]??'public/canal-drive/models/singelkerk.glb';
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(file);
const angle=source.authorAngleRadians;
const native=(x,y,z)=>new T.Vector3(x*Math.cos(angle)+z*Math.sin(angle),y,-x*Math.sin(angle)+z*Math.cos(angle));
const material=new T.MeshBasicMaterial({side:T.DoubleSide}),brick=[],meshes=[];
for(const node of doc.getRoot().listNodes()){
 const matrix=new T.Matrix4().fromArray(node.getWorldMatrix());
 for(const primitive of node.getMesh()?.listPrimitives()??[]){
  const position=primitive.getAttribute('POSITION'),values=[];
  for(let i=0;i<position.getCount();i++)values.push(...position.getElement(i,[]));
  const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(values,3));
  const index=primitive.getIndices();if(index)geometry.setIndex(Array.from(index.getArray()));
  geometry.applyMatrix4(matrix);const mesh=new T.Mesh(geometry,material);
  mesh.userData.palette=primitive.getMaterial()?.getName();meshes.push(mesh);
  if(mesh.userData.palette==='brick')brick.push(mesh);
 }
}
assert(brick.length,'Delivered model must contain domestic brick massing');
const samples=[];
for(const x of [-.3,.3,.8])for(const y of [.05,1,5,10,14,16,17,18]){
 const hit=new T.Raycaster(native(x,y,11.5),native(0,0,1).normalize(),0,3).intersectObjects(brick)[0];
 assert(hit,`Rear roof-end masonry must extend continuously to grade: x${x} y${y}`);
 samples.push({x,y,endZ:11.5+hit.distance});
}
// Fractional pane samples cover the actual rectangular body of every arched
// front window, plus its crown. Allow real white mullions/tracery as first hits;
// masonry, roof plates and rear-house parts may never cover these apertures.
const facadeSamples=[],facadeFailures=[];
for(const x of [-10.15,-3.25,3.65])for(const [y,w,h] of [[4.25,2.4,4.45],[10.4,1.55,2.75]]){
 const points=[];
 for(const u of [.12,.29,.53,.71,.88])for(const v of [.15,.37,.61,.79])points.push([x+(u-.5)*w,y+v*(h-w/2)]);
 for(const u of [.2,.5,.8])points.push([x+(u-.5)*w,y+h-w/2+Math.sqrt((w/2)**2-((u-.5)*w)**2)*.5]);
 for(const [px,py] of points){
  const hit=new T.Raycaster(native(px,py,-35),native(0,0,1).normalize(),0,18).intersectObjects(meshes)[0];
  const sample={x:px,y:py,palette:hit?.object.userData.palette??null,distance:hit?.distance??null};facadeSamples.push(sample);
  if(!['glass','white'].includes(sample.palette))facadeFailures.push(sample);
 }
}
assert.equal(facadeFailures.length,0,`Decoded facade pane fractions occluded: ${JSON.stringify(facadeFailures)}`);
assert(facadeSamples.filter(s=>s.palette==='glass').length>100,'Fractional check must expose substantial actual glazing');
const bounds=new T.Box3();for(const mesh of meshes){mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox);}
// Compare installed roof interiors with independently triangulated source
// observations. Quantized roof boundaries are deliberately avoided; triangle
// centroids provide stable probes of every original measured roof region.
const slate=meshes.filter(m=>m.userData.palette==='slate'),decodedRoofThinSourceMisses=[];let decodedRoofInteriorSamples=0,decodedRoofMaxSourceResidualMetres=0;
for(const part of source.parts)for(const roof of part.roofPlanes){
 const rings=roof.rings.map(r=>r.map(p=>new T.Vector2(p[0],p[2]))),observations=roof.rings.flat();
 for(const triangle of T.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){
  const p=triangle.reduce((sum,i)=>sum.map((v,k)=>v+observations[i][k]/3),[0,0,0]);
  const hits=new T.Raycaster(native(p[0],p[1]+.05,p[2]),new T.Vector3(0,-1,0),0,.1).intersectObjects(slate);
  if(!hits.length){
   const points=triangle.map(i=>observations[i]),[a,b,c]=points;
   const projectedArea=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;
   const maxEdge=Math.max(...points.map((q,i)=>Math.hypot(q[0]-points[(i+1)%3][0],q[2]-points[(i+1)%3][2]))),minAltitude=2*projectedArea/maxEdge;
   // Compression displaces vertices by millimetres. Preserve these sub-mm
   // outline triangulation misses explicitly instead of calling them passes.
   assert(minAltitude<.001,`Installed roof absent at substantial source interior ${part.name} surface${roof.sourceSurface}`);
   decodedRoofThinSourceMisses.push({part:part.name,surface:roof.sourceSurface,triangle,centroid:p,projectedArea,minAltitude});continue;
  }
  const residual=Math.min(...hits.map(h=>Math.abs(h.point.y-p[1])));
  assert(residual<.005,`Installed roof differs from source by ${residual}m at surface${roof.sourceSurface}`);
  decodedRoofMaxSourceResidualMetres=Math.max(decodedRoofMaxSourceResidualMetres,residual);decodedRoofInteriorSamples++;
 }
}
const report={
 id:'singelkerk',file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 status:'decoded-cross-section-support-pass; visual comparison remains separate',
 reportedFragment:'Singel452 domestic roof end, source surfaces28/31/34, behind Herengracht facade',
 sourceRoofHeightRangeMetres:[17.08,20.15],frontCorniceHeightMetres:15,
 rearRoofStartAuthorZMetres:12.71,frontFacadeAuthorZMetres:-19.7,
 minimumSeparationMetres:32.41,supportedCrossSectionSamples:samples,
 decodedBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
 decodedFrontPaneSamples:facadeSamples.length,decodedFrontPaneGlassHits:facadeSamples.filter(s=>s.palette==='glass').length,
 decodedFrontPaneWhiteTraceryHits:facadeSamples.filter(s=>s.palette==='white').length,decodedFrontPaneFailures:facadeFailures,
 decodedRoofInteriorSamples,decodedRoofMaxSourceResidualMetres,decodedRoofThinSourceMisses,
 limitation:'The isolated distant gallery can expose the real rear-house skyline. This diagnostic establishes support in the exact GLB; it does not establish facade recognition, roof junction detail, native neighbors or game acceptance.'
};
console.log(JSON.stringify(report,null,2));
for(const mesh of meshes)mesh.geometry.dispose();material.dispose();
