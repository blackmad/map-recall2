// Before/after review strip for the GLB cleanup pass.
//
//   node scripts/landmarks/glb-cleanup-strip.mjs --out=artifacts/glb-cleanup/strips id=before.glb,after.glb [id2=before.glb,after.glb ...]
//
// For every model writes <out>/<id>.png: two rows (before on top, after below) of six views each (four street-level
// oblique faces, a 3/4 aerial and a straight-down roof view), plus <out>/contact.png stacking all models. Six views are
// enough to see windows standing off walls, holes in roofs and sides, and untextured shells at gallery size.
// three.js is served from node_modules (no network needed); software GL so it runs headless.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const out = path.resolve(ROOT, (args.find(a => a.startsWith('--out=')) ?? '--out=artifacts/glb-cleanup/strips').slice(6));
const items = args.filter(a => !a.startsWith('--')).map(a => {
  const [id, files] = a.split('=');
  const [before, after] = files.split(',');
  return {id, before: path.resolve(before), after: path.resolve(after)};
});
if (!items.length) { console.error('usage: glb-cleanup-strip.mjs [--out=dir] id=before.glb,after.glb ...'); process.exit(2); }
fs.mkdirSync(out, {recursive: true});

const threeDir = path.join(ROOT, 'node_modules/three');
const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
const page = await br.newPage({viewport: {width: 420, height: 300}});
page.on('pageerror', e => console.log('pageerror', e.message));
await page.route('http://local/**', route => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  route.fulfill({body: fs.readFileSync(path.join(threeDir, p)), contentType: 'text/javascript'});
});
await page.setContent(`<html><body style="margin:0;background:#a9bfd0"><script type="importmap">{"imports":{"three":"http://local/build/three.module.js","three/addons/":"http://local/examples/jsm/"}}</script>
<script type="module">
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});document.body.appendChild(r.domElement);
const cam=new T.PerspectiveCamera(40,1,.1,3000);
window.load=(b64)=>new Promise((res,rej)=>{
  const s=new T.Scene();s.background=new T.Color('#a9bfd0');s.add(new T.HemisphereLight(0xdfe8f0,0x6b6458,1.5));
  const sun=new T.DirectionalLight(0xfff1dd,2.2);sun.position.set(-30,60,40);s.add(sun);
  const ground=new T.Mesh(new T.PlaneGeometry(900,900),new T.MeshLambertMaterial({color:0x8f8478}));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;s.add(ground);
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(bytes.buffer,'',g=>{
    g.scene.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.side=T.DoubleSide;}});
    s.add(g.scene);
    const box=new T.Box3().setFromObject(g.scene);
    window.scene=s;window.box=box;window.size=box.getSize(new T.Vector3());res(true);
  },rej);
});
window.shot=(w,h,view)=>{
  const c=window.box.getCenter(new T.Vector3()),sz=window.size,R=Math.max(sz.x,sz.z),H=sz.y;
  r.setSize(w,h);cam.aspect=w/h;
  const dist=Math.max(R*0.95,H*1.4,20);
  const dirs={front:[0,0,1],right:[1,0,0],back:[0,0,-1],left:[-1,0,0]};
  if(view==='aerial'){cam.position.set(c.x+dist*.7,c.y+dist*.75,c.z+dist*.8);cam.lookAt(c.x,H*.35,c.z);}
  else if(view==='top'){cam.position.set(c.x,c.y+Math.max(R,H)*1.6,c.z+.01);cam.up.set(0,0,-1);cam.lookAt(c.x,0,c.z);}
  else{const d=dirs[view];cam.up.set(0,1,0);cam.position.set(c.x+d[0]*dist+d[2]*dist*.28,Math.max(2.2,H*.22),c.z+d[2]*dist-d[0]*dist*.28);cam.lookAt(c.x,H*.4,c.z);}
  cam.updateProjectionMatrix();r.render(window.scene,cam);
  cam.up.set(0,1,0);
};
document.title='ready';
</script></body></html>`);
await page.waitForFunction(() => document.title === 'ready', null, {timeout: 60000});

const VIEWS = ['front', 'right', 'back', 'left', 'aerial', 'top'];
async function row(file) {
  const b64 = fs.readFileSync(file).toString('base64');
  await page.evaluate(b => window.load(b), b64);
  const imgs = [];
  for (const v of VIEWS) {
    await page.evaluate(([w, h, view]) => window.shot(w, h, view), [420, 300, v]);
    imgs.push((await page.locator('canvas').screenshot()).toString('base64'));
  }
  return imgs;
}
const sections = [];
for (const it of items) {
  const rows = {before: await row(it.before), after: await row(it.after)};
  const html = ['before', 'after'].map(k => `<div style="font:13px sans-serif;margin:2px 0"><b>${it.id} ${k}</b></div><div style="white-space:nowrap">${rows[k].map(b => `<img width="300" src="data:image/png;base64,${b}">`).join('')}</div>`).join('');
  const sheet = await br.newPage({viewport: {width: 1830, height: 400}});
  await sheet.setContent(`<body style="margin:6px;background:#fff">${html}</body>`);
  await sheet.screenshot({path: path.join(out, `${it.id}.png`), fullPage: true});
  await sheet.close();
  sections.push(html);
  console.log('strip', path.relative(ROOT, path.join(out, `${it.id}.png`)));
}
const contact = await br.newPage({viewport: {width: 1830, height: 400}});
await contact.setContent(`<body style="margin:6px;background:#fff">${sections.join('<hr>')}</body>`);
await contact.screenshot({path: path.join(out, 'contact.png'), fullPage: true});
await br.close();
console.log('contact', path.relative(ROOT, path.join(out, 'contact.png')));
