/** Browser side of measured-swatches.ts: GLB fixtures (extras -> userData) through the game's city look, one flat swatch each. */
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createCityLook} from '../../src/canalRecall/look/cityLook.ts';

export interface Swatch { base64: string; label: string }
const SIZE = 150;

/** Renders each GLB as an orthographic swatch in a row-major grid; returns the canvas PNG and the mean sRGB of each swatch interior. */
async function render(swatches: Swatch[], columns: number, brickUrl: string | null): Promise<{png: string; means: number[][]}> {
  const rows = Math.ceil(swatches.length / columns), W = columns * SIZE, H = rows * SIZE;
  const renderer = new T.WebGLRenderer({antialias: false, preserveDrawingBuffer: true});
  renderer.setSize(W, H, false); renderer.outputColorSpace = T.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  let brick: HTMLImageElement | null = null;
  if (brickUrl) { brick = new Image(); brick.src = brickUrl; try { await brick.decode(); } catch { brick = null; } }
  const city = createCityLook(T, {brick, size: 256});
  await city.ready;
  city.uniforms.enuFromWorld.value.set(1, 0, 0, 0, 0, -1, 0, 1, 0);
  const scene = new T.Scene(); scene.background = new T.Color('#c9d6e0');
  const loader = new GLTFLoader();
  for (let i = 0; i < swatches.length; i++) {
    const bytes = Uint8Array.from(atob(swatches[i].base64), c => c.charCodeAt(0));
    const gltf = await loader.parseAsync(bytes.buffer, '');
    gltf.scene.position.set((i % columns) * 2.2, -Math.floor(i / columns) * 2.2, 0);
    scene.add(gltf.scene);
    city.dress(gltf.scene, {lit: false});
  }
  const camera = new T.OrthographicCamera(-1.1, columns * 2.2 - 1.1, 1.1, -(rows * 2.2 - 1.1), 0.1, 50);
  camera.position.z = 10;
  renderer.render(scene, camera);
  const gl = renderer.getContext(), px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const means: number[][] = [];
  for (let i = 0; i < swatches.length; i++) {
    const x0 = (i % columns) * SIZE + 20, y0 = Math.floor(i / columns) * SIZE + 20, sum = [0, 0, 0]; let n = 0;
    for (let y = y0; y < y0 + SIZE - 40; y++) for (let x = x0; x < x0 + SIZE - 40; x++) {
      const o = ((H - 1 - y) * W + x) * 4; sum[0] += px[o]; sum[1] += px[o + 1]; sum[2] += px[o + 2]; n++;
    }
    means.push(sum.map(v => v / n));
  }
  return {png: renderer.domElement.toDataURL('image/png'), means};
}
(window as any).renderSwatches = render;
