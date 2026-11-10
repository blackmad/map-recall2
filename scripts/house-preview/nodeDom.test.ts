import test from 'node:test';
import assert from 'node:assert/strict';
import { installNodeDom, assertImageLoaded, imageLoads } from './nodeDom.ts';

test('the shim loads the brick photo from document.baseURI and asserts it', async () => {
  const uninstall = installNodeDom();
  try {
    const g = globalThis as any;
    imageLoads.clear();
    assert.throws(() => assertImageLoaded('Bricks057'), /no image matching/);
    const image = new g.Image();
    image.src = new URL('materials/ambientcg/Bricks057/colour.jpg', g.document.baseURI).href;
    assert.throws(() => assertImageLoaded('Bricks057'), /did not decode/); // read, not yet decoded
    await image.decode();
    assert.ok(image.width > 0 && image.height > 0);
    assertImageLoaded('Bricks057');
    const canvas = g.document.createElement('canvas'); canvas.width = canvas.height = 4;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, 4, 4);
    assert.equal(ctx.getImageData(0, 0, 1, 1).data[3], 255);
  } finally { uninstall(); }
});

test('a broken load fails loudly instead of the painter\'s silent fallback', async () => {
  const uninstall = installNodeDom();
  try {
    const g = globalThis as any;
    imageLoads.clear();
    const image = new g.Image();
    image.src = new URL('materials/ambientcg/Bricks057/missing.jpg', g.document.baseURI).href;
    await assert.rejects(image.decode());
    assert.throws(() => assertImageLoaded('Bricks057'), /did not decode/);
    assert.throws(() => g.document.createElement('div'), /not stubbed/);
  } finally { uninstall(); }
});
