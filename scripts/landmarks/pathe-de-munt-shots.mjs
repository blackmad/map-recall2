// Usage: node scripts/landmarks/pathe-de-munt-shots.mjs <outDir>
// Renders the built public/canal-drive/models/pathe-de-munt.glb from street height, straight at the
// Vijzelstraat front and from the north-west 3/4, with three.js from jsDelivr (no dev server needed).
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const out = process.argv[2] ?? 'artifacts/landmark-lanes/pathe-de-munt';
const glb = fs.readFileSync('public/canal-drive/models/pathe-de-munt.glb').toString('base64');
// Native metres: X east, Y up, Z south. Front wall midpoint and outward (west) normal from the BAG ring.
const mid = [-7.2455, -0.6235], outward = [-0.9899, -0.1418], along = [-0.1418, 0.9899];
const views = {
  front: {pos: [mid[0] + outward[0] * 30, 1.7, mid[1] + outward[1] * 30], look: [mid[0], 10.5, mid[1]], fov: 46},
  threeQuarter: {pos: [mid[0] + outward[0] * 17 - along[0] * 16, 2.2, mid[1] + outward[1] * 17 - along[1] * 16], look: [mid[0], 8, mid[1]], fov: 66},
  aerial: {pos: [mid[0] + outward[0] * 38 - along[0] * 22, 34, mid[1] + outward[1] * 38 - along[1] * 22], look: [mid[0] + 12, 6, mid[1]], fov: 50},
};
const html = `<html><body style="margin:0;background:#9fb6c8"><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
<script type="module">
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(900,1000);document.body.appendChild(r.domElement);
const s=new T.Scene();s.background=new T.Color('#a9bfd0');s.add(new T.HemisphereLight(0xdfe8f0,0x6b6458,1.6));const sun=new T.DirectionalLight(0xfff1dd,2.2);sun.position.set(-30,40,25);s.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(400,400),new T.MeshLambertMaterial({color:0x8f8478}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;s.add(ground);
const cam=new T.PerspectiveCamera(60,.9,.1,1000);
window.shot=async(v)=>{cam.fov=v.fov;cam.aspect=v.aspect;cam.updateProjectionMatrix();r.setSize(v.w,v.h);cam.position.set(...v.pos);cam.lookAt(...v.look);r.render(s,cam);};
const bytes=Uint8Array.from(atob('${glb}'),c=>c.charCodeAt(0));
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(bytes.buffer,'',g=>{g.scene.traverse(o=>{if(o.isMesh)o.material.flatShading=true});s.add(g.scene);document.title='ready'},e=>{document.title='error '+e});
</script></body></html>`;
const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
const page = await br.newPage({viewport: {width: 1000, height: 1000}});
page.on('pageerror', e => console.log('pageerror', e.message));
await page.setContent(html);
await page.waitForFunction(() => /^(ready|error)/.test(document.title), null, {timeout: 60000});
console.log(await page.title());
fs.mkdirSync(out, {recursive: true});
for (const [name, v] of Object.entries(views)) {
  const w = 800, h = name === 'front' ? 1000 : 700;
  await page.evaluate(v => window.shot(v), {...v, w, h, aspect: w / h});
  await page.locator('canvas').screenshot({path: `${out}/model-${name}.png`});
}
await br.close();
