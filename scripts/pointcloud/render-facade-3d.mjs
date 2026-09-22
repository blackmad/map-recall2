/**
 * Render compiled point-cloud façade meshes to PNGs in 3-D.
 *
 * Reads the OBJ files written by the Museumkwartier spike, draws them with the
 * repo's Three.js in a headless WebGL page, and writes one screenshot per mesh
 * plus a street-level view of the whole measured scene. No server, no
 * publication.
 *
 * Usage: node --import tsx scripts/pointcloud/render-facade-3d.mjs [--dir=<path>]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const flag = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const dir = path.resolve(flag('dir') ?? '.cache/pointcloud/spike');
const out = path.resolve(flag('out') ?? '.cache/pointcloud/spike/3d');
await fs.mkdir(out, { recursive: true });

const bundle = await build({
  stdin: {
    contents: `
      export * as THREE from 'three';
      export { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, write: false, format: 'iife', globalName: 'FacadeRender', platform: 'browser',
});
const script = bundle.outputFiles[0].text;

const exists = async (file) => { try { await fs.access(file); return true; } catch { return false; } };
const pageHtml = (body) => `<!doctype html><html><body style="margin:0;background:#0b0f14"><canvas id="c"></canvas>
  <script>${script}</script>
  <script>${body}</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const errors = [];
const shot = async (name, body) => {
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  await page.setContent(pageHtml(body));
  await page.waitForFunction('window.__rendered === true', { timeout: 20_000 });
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  await page.close();
};

const lighting = `
  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x3a3326, 1.1));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xfff2dd, 2.1); key.position.set(-1, 1.5, 1.2); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc0ff, 0.6); fill.position.set(1.4, 0.3, -0.9); scene.add(fill);
`;

try {
  const objs = (await fs.readdir(dir)).filter((name) => name.endsWith('.obj') && !name.startsWith('scene'));
  for (const name of objs) {
    const objText = await fs.readFile(path.join(dir, name), 'utf8');
    await shot(name.replace(/\.obj$/, ''), `
      const { THREE, OBJLoader } = FacadeRender;
      const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
      renderer.setSize(900, 1100, false);
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0f14);
      const group = new OBJLoader().parse(${JSON.stringify(objText)});
      group.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: 0xd7d0c7, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide }); });
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
      group.position.sub(center); scene.add(group);
      ${lighting}
      const camera = new THREE.PerspectiveCamera(35, 900 / 1100, 0.1, 5000);
      const distance = Math.max(size.x, size.y) * 1.5;
      camera.position.set(distance * 0.45, size.y * 0.06, distance); camera.lookAt(0, 0, 0);
      renderer.render(scene, camera); window.__rendered = true;
    `);
  }

  if (await exists(path.join(dir, 'scene.obj'))) {
    const objText = await fs.readFile(path.join(dir, 'scene.obj'), 'utf8');
    const colours = await exists(path.join(dir, 'scene-colours.json')) ? JSON.parse(await fs.readFile(path.join(dir, 'scene-colours.json'), 'utf8')) : {};
    const setup = `
      const { THREE, OBJLoader } = FacadeRender;
      const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
      renderer.setSize(900, 1100, false);
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0f14);
      const colours = ${JSON.stringify(colours)};
      const group = new OBJLoader().parse(${JSON.stringify(objText)});
      group.traverse((o) => {
        if (!o.isMesh) return;
        const hex = colours[o.name] ?? colours[o.parent?.name] ?? '#d7d0c7';
        o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide });
      });
      group.rotation.x = -Math.PI / 2;
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
      group.position.sub(center); scene.add(group);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 4, size.z * 4), new THREE.MeshStandardMaterial({ color: 0x1a2029, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -size.y / 2; scene.add(ground);
      ${lighting}
      const render = (camera) => { renderer.render(scene, camera); window.__rendered = true; };
    `;
    await shot('scene-street', `${setup}
      const camera = new THREE.PerspectiveCamera(40, 900 / 1100, 0.1, 5000);
      camera.position.set(size.x * 0.05, size.y * 0.15, size.z * 0.95);
      camera.lookAt(0, size.y * 0.05, 0);
      render(camera);
    `);
    await shot('scene-aerial', `${setup}
      const camera = new THREE.PerspectiveCamera(40, 900 / 1100, 0.1, 5000);
      camera.position.set(size.x * 1.0, size.y * 1.6, size.z * 1.15);
      camera.lookAt(0, 0, 0);
      render(camera);
    `);
  }
} finally {
  await browser.close();
}
if (errors.length) throw new Error(errors.join('\n'));
process.stdout.write(`Rendered façade meshes and scene to ${out}\n`);
