import fs from 'node:fs/promises';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import spec from './leids67-spec.json';
import {collect} from './leids67-export';
import {probes} from './leids67-builder';
const parts=collect(),meshes=parts.map(p=>{const m=new T.Mesh(p.g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData.colour=p.c;m.updateMatrixWorld();return m;}),ray=new T.Raycaster(),failures:string[]=[],checks:any[]=[];
for(const p of probes){const n=new T.Vector3(...p.normal),target=new T.Vector3(...p.point);ray.set(target.clone().addScaledVector(n,3),n.clone().negate());const hit=ray.intersectObjects(meshes)[0];const pass=!!hit&&hit.object.userData.colour===p.colour&&hit.distance<3.08;checks.push({label:p.label,pass,firstColour:hit?.object.userData.colour,distance:hit?.distance});if(!pass)failures.push('Facade first hit: '+p.label);}
for(const [i,p]of [[2,-5],[4,7]] .entries()){ray.set(new T.Vector3(p[0],35,p[1]),new T.Vector3(0,-1,0));const hit=ray.intersectObjects(meshes)[0];checks.push({label:'external-reentrant-'+i,point:p,pass:!hit,hit:hit?.point.toArray()});if(hit)failures.push('Closed external notch '+i);}
for(const r of spec.roofs){const mesh=parts.find(p=>p.g.userData.roof===r.surface)!;const normal=mesh.g.getAttribute('normal');for(let i=0;i<normal.count;i++)if(normal.getY(i)<=0)failures.push('Downward roof '+r.surface);const ys=r.ring.map(([x,z])=>r.plane[0]*x+r.plane[1]*z+r.plane[2]);if(Math.min(...ys)<Math.min(...r.surveyHeights)-.1||Math.max(...ys)>Math.max(...r.surveyHeights)+.1)failures.push('Roof plane extrapolation '+r.surface);checks.push({label:'roof-owner-'+r.surface,upward:true,range:[Math.min(...ys),Math.max(...ys)]});}
if(spec.roofs.length!==17||!spec.roofs.some(r=>r.surface===19))failures.push('Missing raw roof owner');
await MeshoptDecoder.ready;
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read('artifacts/ordinary-buildings/leids67/0363100012172459.glb');
const decoded=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).map(p=>{const g=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(p.getAttribute('POSITION')!.getArray()!,3));if(p.getIndices())g.setIndex(new T.BufferAttribute(p.getIndices()!.getArray()!,1));const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData.material=p.getMaterial()?.getName();m.updateMatrixWorld();return m;});
for(const p of probes){const n=new T.Vector3(...p.normal),target=new T.Vector3(...p.point);ray.set(target.clone().addScaledVector(n,3),n.clone().negate());const hit=ray.intersectObjects(decoded)[0],want=p.colour==='glass'?'glass':p.colour==='brick'?'masonry':'physical';const pass=!!hit&&hit.object.userData.material===want&&hit.distance<3.08;checks.push({label:'decoded-'+p.label,pass,firstMaterial:hit?.object.userData.material,distance:hit?.distance});if(!pass)failures.push('Decoded facade first hit: '+p.label);}
const boundaryClosures=parts.filter(p=>p.g.userData.boundaryClosure).map(p=>p.g.userData.boundaryClosure);
await fs.writeFile('artifacts/ordinary-buildings/leids67/boundary-ownership-repair.json',JSON.stringify({method:'Uncovered native perimeter intervals closed by closest bounded survey boundary; no new roof/cap; explicit native street front assemblies',maximumSurveyBoundaryDistance:Math.max(...boundaryClosures.map(c=>c.sourceDistance)),intervals:boundaryClosures},null,2)+'\n');
const result={scope:'Author geometry probes; no GPU/native-game/performance acceptance',checks,failures};await fs.writeFile('artifacts/ordinary-buildings/leids67/geometry-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({checks:checks.length,failures}));if(failures.length)process.exitCode=1;
