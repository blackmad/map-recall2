import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {clipTriangleToCameraDepth,clipTriangleAtStreetGrade} from './software-camera-clipping.ts';
const camera=new PerspectiveCamera(60,1,.1,10);camera.updateMatrixWorld(true);
test('street stage clips below-grade backing without mutating source or reversing visible faces',()=>{
 const points=[new Vector3(0,-1,0),new Vector3(2,1,0),new Vector3(0,1,0)],before=points.map(p=>p.toArray());
 const result=clipTriangleAtStreetGrade(points,0);assert.equal(result.length,2);
 assert.deepEqual(points.map(p=>p.toArray()),before);
 const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
 for(const triangle of result){assert(triangle.every(p=>p.y>=0));assert(triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).dot(normal)>0);}
 assert.deepEqual(clipTriangleAtStreetGrade(points,2),[]);
 assert.deepEqual(clipTriangleAtStreetGrade(points,-2).map(t=>t.map(p=>p.toArray())),[before]);
 assert.throws(()=>clipTriangleAtStreetGrade(points,NaN));
});
test('behind-eye triangle is discarded, a crossing triangle is bounded before perspective division',()=>{
 assert.deepEqual(clipTriangleToCameraDepth([new Vector3(-1,0,1),new Vector3(1,0,1),new Vector3(0,1,2)],camera),[]);
 const triangles=clipTriangleToCameraDepth([new Vector3(-1,0,-1),new Vector3(1,0,-1),new Vector3(0,1,1)],camera);
 assert.equal(triangles.length,2);
 for(const point of triangles.flat()){assert(point.z<=-.1+1e-12);assert(Number.isFinite(point.clone().project(camera).x));}
});
test('visible geometry is preserved; far-plane crossing cannot occupy foreground depth',()=>{
 const points=[new Vector3(-1,0,-1),new Vector3(1,0,-1),new Vector3(0,1,-2)];
 assert.deepEqual(clipTriangleToCameraDepth(points,camera).map(t=>t.map(p=>p.toArray())),[points.map(p=>p.toArray())]);
 const clipped=clipTriangleToCameraDepth([points[0],points[1],new Vector3(0,1,-20)],camera);
 for(const point of clipped.flat())assert(-point.z<=10+1e-12);
});
