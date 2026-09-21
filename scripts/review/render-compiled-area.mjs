/** Render a compiled district to PNGs without publishing or activating anything.
 *
 * Reads the area run's compiled appearance tiles, feeds the owners to the shared
 * city appearance adapter in a headless WebGL page, and writes fixed-camera
 * screenshots under the loop run directory. No server, no release, no activation.
 *
 * Usage: node --import tsx scripts/review/render-compiled-area.mjs --area=apollobuurt-v1
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { selectStreetFrontage } from '../../src/canalRecall/review/districtFrontage.ts';

const flag = (name) => process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const areaId = flag('area');
if (!areaId) throw Error('Usage: --area=<areaId>');
const OUT = flag('out') ?? `.cache/reconstruction-loop-20260921/district-renders/${areaId}`;

const areasRoot = `.cache/city-appearance/areas/${areaId}/runs`;
const runs = await fs.readdir(areasRoot);
if (!runs.length) throw Error(`No compiled run for ${areaId}`);
const run = path.join(areasRoot, runs.sort().at(-1));
const tilesDir = (await fs.readdir(run)).find((name) => name.startsWith('tiles-'));
if (!tilesDir) throw Error('No tiles stage in the run');
const index = JSON.parse(await fs.readFile(path.join(run, tilesDir, 'index.json'), 'utf8'));

const ownersById = new Map();
for (const key of index.tileList) {
  const file = path.join(run, tilesDir, `${key}.json.gz`);
  const tile = JSON.parse(zlib.gunzipSync(await fs.readFile(file)).toString());
  for (const owner of [...(tile.owners ?? []), ...(tile.halo ?? [])]) if (!ownersById.has(owner.id)) ownersById.set(owner.id, owner);
}
const owners = [...ownersById.values()].filter((owner) => owner.geometry?.frame?.originRD && owner.geometry?.building?.surfaces?.length);
if (!owners.length) throw Error('No renderable owners in the compiled tiles');
console.log(JSON.stringify({ areaId, run: path.basename(run), buildings: index.buildings, owners: owners.length, observations: index.observations }));

const origin = owners[0].geometry.frame.originRD;
const frontage = selectStreetFrontage(owners, origin);

const bundle = await build({
  stdin: { contents: "export * as THREE from 'three'; export {createCityAppearanceThreeAdapter} from './src/canalRecall/cityAppearanceThree.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'iife', globalName: 'AreaRender', platform: 'browser',
});
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent('<!doctype html><html><head><title>District render</title><style>body{margin:0;background:#dfe4e8}canvas{display:block}</style></head><body></body></html>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  const info = await page.evaluate(({ owners, frontage, frontageGroundY }) => {
    const { THREE, createCityAppearanceThreeAdapter } = window.AreaRender;
    const origin = owners[0].geometry.frame.originRD;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dfe4e8');
    scene.add(new THREE.HemisphereLight('#ffffff', '#a9aaa0', 2.2));
    const light = new THREE.DirectionalLight('#fff4df', 2); light.position.set(-200, 400, 150); scene.add(light);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(innerWidth, innerHeight); document.body.append(renderer.domElement);
    const resource = createCityAppearanceThreeAdapter({ parent: scene, targetOriginRD: origin })(owners);
    resource.flush();
    const bounds = new THREE.Box3().setFromObject(resource.group);
    const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    // Ground = the median declared groundNAP, computed in Node so the ground
    // plane and the street-frontage camera share one datum. Fall back to the
    // scene bounds only when no owner declares a finite groundNAP.
    const groundY = Number.isFinite(frontageGroundY) ? frontageGroundY : bounds.min.y;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.4 + 60, size.z * 1.4 + 60), new THREE.MeshStandardMaterial({ color: '#c7cabf', roughness: 1, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(center.x, groundY - 0.05, center.z); scene.add(ground);
    const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 20000);
    // The street-frontage camera is selected in Node by
    // `src/canalRecall/review/districtFrontage.ts` (typed + checked); this page
    // only applies it. The district-scale `street-eye-*` views remain skylines.
    window.areaRender = { scene, renderer, camera, center, size, render: () => renderer.render(scene, camera) };
    return { buildings: owners.length, triangles: resource.stats.triangles, drawCalls: renderer.info.render.calls, size: [size.x, size.y, size.z] };
  }, { owners, frontage, frontageGroundY: frontage?.groundY });

  const views = [
    { name: 'overview-oblique', offset: [0.85, 0.75, 0.85], mult: 1.1, look: [0, 0, 0], fov: 45 },
    { name: 'aerial-high', offset: [0.2, 1.6, 0.25], mult: 0.9, look: [0, 0, 0], fov: 45 },
    { name: 'street-eye-south', offset: [0.0, 0.012, 0.55], mult: 1.0, look: [0, 0.06, 0], fov: 62 },
    { name: 'street-eye-east', offset: [0.55, 0.012, 0.0], mult: 1.0, look: [0, 0.06, 0], fov: 62 },
    { name: 'street-frontage', absolute: true },
  ];
  for (const view of views) {
    await page.evaluate(({ view, frontage }) => {
      const s = window.areaRender;
      if (view.absolute) {
        if (!frontage) return;
        s.camera.fov = frontage.fov; s.camera.updateProjectionMatrix();
        s.camera.position.set(...frontage.position);
        s.camera.lookAt(new (s.center.constructor)(...frontage.target));
        s.render();
        return;
      }
      const radius = Math.max(s.size.x, s.size.z);
      s.camera.fov = view.fov; s.camera.updateProjectionMatrix();
      const target = s.center.clone().add(new (s.center.constructor)(view.look[0], view.look[1], view.look[2]));
      s.camera.position.copy(s.center).add(new (s.center.constructor)(view.offset[0], view.offset[1], view.offset[2]).multiplyScalar(radius * view.mult));
      if (view.name.startsWith('street')) s.camera.position.y = 1.7;
      s.camera.lookAt(target);
      s.render();
    }, { view, frontage });
    await page.screenshot({ path: path.join(OUT, `${view.name}.png`) });
  }
  console.log(JSON.stringify({ output: OUT, views: views.map((v) => v.name), info, frontage, errors }, null, 2));
} finally {
  await browser.close();
}
