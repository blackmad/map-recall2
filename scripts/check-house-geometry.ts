import assert from 'node:assert/strict';
import * as T from 'three';
import { openTopPrism, upwardRoofPlane } from './landmarks/house-geometry';

const shape = new T.Shape([new T.Vector2(0,0),new T.Vector2(10,0),new T.Vector2(10,8),new T.Vector2(0,8)]);
shape.holes.push(new T.Path([new T.Vector2(4,3),new T.Vector2(6,3),new T.Vector2(6,5),new T.Vector2(4,5)]));
const shell = openTopPrism(shape, 2, 5), roof = upwardRoofPlane(shape, 5);
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
const hit = (geometry: T.BufferGeometry, x: number, z: number) => new T.Raycaster(new T.Vector3(x,20,z),new T.Vector3(0,-1,0)).intersectObject(new T.Mesh(geometry,material),false);
assert.equal(hit(roof,1,1)[0].point.y,5, 'roof spans the real outer footprint');
assert.equal(hit(shell,1,1)[0].point.y,2, 'separate roof owns the upper surface without a duplicate shell cap');
assert.equal(hit(roof,5,4).length,0, 'courtyard remains open through the roof');
assert.equal(hit(shell,5,4).length,0, 'courtyard remains open through the building volume');
assert.ok(Array.from(roof.getAttribute('normal').array).filter((_,i)=>i%3===1).every(y=>y>.99), 'roof faces upward after coordinate conversion');
const bounds = new T.Box3().setFromBufferAttribute(shell.getAttribute('position') as T.BufferAttribute);
assert.equal(bounds.min.y,2); assert.equal(bounds.max.y,5);
console.log('Shared footprint geometry preserves courtyard holes and vertical bounds, removes duplicate roof caps, and keeps roof lighting coherent.');
