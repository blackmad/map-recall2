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

  const info = await page.evaluate(({ owners }) => {
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
    // Ground = the median declared groundNAP, which is already render-space
    // (render y = local + sourceHeightOffset, and napToSourceHeight subtracts it).
    const groundSamples = owners.map((owner) => owner.geometry.building.groundNAP).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    const groundY = groundSamples.length ? groundSamples[Math.floor(groundSamples.length / 2)] : bounds.min.y;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.4 + 60, size.z * 1.4 + 60), new THREE.MeshStandardMaterial({ color: '#c7cabf', roughness: 1, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(center.x, groundY - 0.05, center.z); scene.add(ground);
    const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 20000);
    // Street-scale frontage: pick a substantial wall near the district centre
    // and stand across the street from its building at eye height. The
    // district-scale `street-eye-*` views are skylines; this is the one a human
    // can judge storey rhythm, roofline and massing against.
    const renderCenter = (owner) => {
      const c = owner.geometry.building.center ?? [0, 0];
      const o = owner.geometry.frame.originRD;
      return new THREE.Vector3(c[0] + o.x - origin.x, 0, c[1] + origin.y - o.y);
    };
    const widestWall = (owner) => {
      const o = owner.geometry.frame.originRD;
      const toRender = (p) => [p[0] + o.x - origin.x, p[1], p[2] + origin.y - o.y];
      let wall = null;
      for (const s of owner.geometry.building.surfaces ?? []) {
        if (s.type !== 'wall' || (s.rings?.[0]?.length ?? 0) < 4) continue;
        const rp = s.rings[0].map(toRender);
        const ys = rp.map((p) => p[1]);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const bottom = rp.filter((p) => Math.abs(p[1] - minY) < 1e-6);
        const top = rp.filter((p) => Math.abs(p[1] - maxY) < 1e-6);
        if (bottom.length < 2 || !top.length) continue;
        const width = Math.hypot(bottom[1][0] - bottom[0][0], bottom[1][2] - bottom[0][2]);
        const height = maxY - minY;
        if (width < 3 || height < 3) continue;
        if (!wall || width * height > wall.area) wall = { rp, bottom, top, area: width * height, width, height, toRender, owner };
      }
      return wall;
    };
    let frontage = null;
    if (owners.length) {
      const district = owners.map(renderCenter).reduce((a, c) => a.add(c), new THREE.Vector3()).multiplyScalar(1 / owners.length);
      const candidates = [];
      for (const owner of owners) {
        const wall = widestWall(owner);
        if (!wall) continue;
        const c = renderCenter(owner);
        const dist = c.distanceTo(district);
        candidates.push({ owner, wall, center: c, dist, score: wall.area / (1 + dist / 40) });
      }
      const pick = candidates.sort((a, b) => b.score - a.score)[0] ?? null;
      if (pick) {
        const { owner, wall } = pick;
        const [a, b] = wall.bottom;
        const edge1 = new THREE.Vector3(b[0] - a[0], 0, b[2] - a[2]);
        const edge3 = new THREE.Vector3(wall.top[0][0] - a[0], wall.top[0][1] - a[1], wall.top[0][2] - a[2]);
        const normal = edge1.cross(edge3);
        if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
        normal.normalize();
        const mid = wall.rp.reduce((acc, p) => acc.add(new THREE.Vector3(...p)), new THREE.Vector3()).multiplyScalar(1 / wall.rp.length);
        if (normal.dot(new THREE.Vector3(mid.x - pick.center.x, 0, mid.z - pick.center.z)) < 0) normal.multiplyScalar(-1);
        // Stand far enough back to take in the building and its roofline, capped
        // so a long slab still reads as a street stretch, not a distant object.
        const pts = (owner.geometry.building.surfaces ?? []).flatMap((s) => s.rings.flatMap((r) => r.map(wall.toRender)));
        const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[2]), pys = pts.map((p) => p[1]);
        const bx = (Math.min(...xs) + Math.max(...xs)) / 2, bz = (Math.min(...zs) + Math.max(...zs)) / 2, by = (Math.min(...pys) + Math.max(...pys)) / 2;
        const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
        const standoff = Math.max(18, Math.min(90, span * 1.15 + 8));
        frontage = {
          position: [bx + normal.x * standoff, groundY + 1.7, bz + normal.z * standoff],
          target: [bx, by, bz],
          building: owner.geometry.building.id,
          street: owner.geometry.building.street ?? null,
          width: Math.round(wall.width * 10) / 10, height: Math.round(wall.height * 10) / 10,
        };
      }
    }
    window.areaRender = { scene, renderer, camera, center, size, render: () => renderer.render(scene, camera) };
    return { buildings: owners.length, triangles: resource.stats.triangles, drawCalls: renderer.info.render.calls, size: [size.x, size.y, size.z], frontage };
  }, { owners });

  const views = [
    { name: 'overview-oblique', offset: [0.85, 0.75, 0.85], mult: 1.1, look: [0, 0, 0], fov: 45 },
    { name: 'aerial-high', offset: [0.2, 1.6, 0.25], mult: 0.9, look: [0, 0, 0], fov: 45 },
    { name: 'street-eye-south', offset: [0.0, 0.012, 0.55], mult: 1.0, look: [0, 0.06, 0], fov: 62 },
    { name: 'street-eye-east', offset: [0.55, 0.012, 0.0], mult: 1.0, look: [0, 0.06, 0], fov: 62 },
    { name: 'street-frontage', absolute: true, fov: 55 },
  ];
  for (const view of views) {
    await page.evaluate(({ view, frontage }) => {
      const s = window.areaRender;
      if (view.absolute) {
        if (!frontage) return;
        s.camera.fov = view.fov; s.camera.updateProjectionMatrix();
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
    }, { view, frontage: info.frontage });
    await page.screenshot({ path: path.join(OUT, `${view.name}.png`) });
  }
  console.log(JSON.stringify({ output: OUT, views: views.map((v) => v.name), info, errors }, null, 2));
} finally {
  await browser.close();
}
