import assert from 'node:assert/strict';
import { createWallMaterialSprite, WALL_MATERIALS, WALL_MATERIAL_PIXEL_RATIO, WALL_MATERIAL_SPRITE_SIZE, type WallMaterialId } from './wallMaterialLibrary.js';

assert.equal(WALL_MATERIALS.length, 12);
assert.equal(new Set(WALL_MATERIALS.map(item=>item.id)).size, 12);
assert.equal(WALL_MATERIAL_PIXEL_RATIO, 1);
assert.equal(WALL_MATERIAL_SPRITE_SIZE & (WALL_MATERIAL_SPRITE_SIZE - 1), 0);

for (const material of WALL_MATERIALS) {
  const id = material.id, sprite = createWallMaterialSprite(id);
  assert.ok(material.label);
  assert.match(material.baseColour, /^#[0-9a-f]{6}$/);
  assert.equal(sprite.width, 128);
  assert.equal(sprite.height, 128);
  assert.equal(sprite.data.length, 128 * 128 * 4);
  assert.deepEqual(sprite.data, createWallMaterialSprite(id).data, `${id} must be deterministic`);
  for (let pixel = 3; pixel < sprite.data.length; pixel += 4) assert.equal(sprite.data[pixel], 255, `${id} must be opaque`);
  if (material.patternKind === 'smooth') {
    assert.equal(material.mortarColour, null);
    assert.equal(material.courseWidthM, null);
    assert.equal(material.courseHeightM, null);
  } else {
    assert.ok(material.courseWidthM! > material.courseHeightM!);
    assert.match(material.mortarColour!, /^#[0-9a-f]{6}$/);
  }
}

const brick = createWallMaterialSprite('redbrick');
const at = (x:number,y:number) => [...brick.data.slice((y*128+x)*4,(y*128+x)*4+3)];
// Two mortar pixels start every 16px course. Alternating vertical joints are
// exactly half a 64px brick apart; periods divide 128, including tile edges.
assert.deepEqual(at(0,8), at(64,8));
assert.deepEqual(at(32,24), at(96,24));
assert.notDeepEqual(at(0,8), at(32,8));
assert.notDeepEqual(at(32,8), at(32,24));
for (const y of [0,16,32,48,64,80,96,112]) assert.deepEqual(at(10,y), at(10,y+1));
assert.throws(() => createWallMaterialSprite('unsupported' as WallMaterialId), /Unknown wall material/);
console.log('wallMaterialLibrary: 12 deterministic opaque reusable materials and periodic courses passed');
