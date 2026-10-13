import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {canalhouseRoofUvs} from './canalhouseRoofMaterials.ts';
test('roof UVs retain metre scale and continuity across a different triangulation',()=>{
 const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,0,3,0,0,0,3,3,3,0,0,3,3,3,0,3,3],3));g.computeVertexNormals();const uv=canalhouseRoofUvs(g,3);
 assert.equal(uv.getX(1),uv.getX(3));assert.equal(uv.getY(1),uv.getY(3));assert.equal(uv.getX(2),uv.getX(5));assert.equal(uv.getY(2),uv.getY(5));
 assert.ok(Math.abs(Math.abs(uv.getX(1)-uv.getX(0))-1)<1e-6);assert.ok(Math.abs(Math.abs(uv.getY(2)-uv.getY(0))-Math.sqrt(2))<1e-6);
 assert.throws(()=>canalhouseRoofUvs(g,0),/scale/);g.dispose();
});
