// Contact images for the GLB audit. Renders each model from a 3/4 aerial and a street-level view with
// problem markers: red = open hole loops, orange = see-through wall rays, magenta = detached parts,
// yellow = inverted roofs. three.js is served from node_modules (no network needed).
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export async function renderContact(items, outDir, root) {
  fs.mkdirSync(outDir, {recursive: true});
  const threeDir = path.join(root, 'node_modules/three');
  const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
  const page = await br.newPage({viewport: {width: 700, height: 460}});
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.route('http://local/**', route => {
    const p = new URL(route.request().url()).pathname.replace(/^\//, '');
    route.fulfill({body: fs.readFileSync(path.join(threeDir, p)), contentType: 'text/javascript'});
  });
  const html = `<html><body style="margin:0;background:#a9bfd0"><script type="importmap">{"imports":{"three":"http://local/build/three.module.js","three/addons/":"http://local/examples/jsm/"}}</script>
<script type="module">
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});document.body.appendChild(r.domElement);
const cam=new T.PerspectiveCamera(45,1,.1,2000);
window.load=(b64,markers)=>new Promise((res,rej)=>{
  const s=new T.Scene();s.background=new T.Color('#a9bfd0');s.add(new T.HemisphereLight(0xdfe8f0,0x6b6458,1.6));
  const sun=new T.DirectionalLight(0xfff1dd,2.2);sun.position.set(-30,40,25);s.add(sun);
  const ground=new T.Mesh(new T.PlaneGeometry(600,600),new T.MeshLambertMaterial({color:0x8f8478}));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;s.add(ground);
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(bytes.buffer,'',g=>{
    g.scene.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.flatShading=true;o.material.side=T.DoubleSide;}});
    s.add(g.scene);
    const box=new T.Box3().setFromObject(g.scene);const size=box.getSize(new T.Vector3()).length();
    for(const m of markers){const mesh=new T.Mesh(new T.SphereGeometry(Math.max(.35,size*.012),10,8),new T.MeshBasicMaterial({color:m.color,depthTest:false}));mesh.position.set(...m.p);mesh.renderOrder=9;s.add(mesh);}
    window.scene=s;window.box=box;window.size=size;res(true);
  },rej);
});
window.shot=(w,h,view)=>{
  const c=window.box.getCenter(new T.Vector3()),sz=window.size;r.setSize(w,h);cam.aspect=w/h;
  if(view==='aerial'){cam.position.set(c.x+sz*.55,c.y+sz*.45,c.z+sz*.75);cam.lookAt(c.x,c.y*.8,c.z);}
  else{cam.position.set(c.x-sz*.5,1.7,c.z+sz*.8);cam.lookAt(c.x,window.box.max.y*.4,c.z);}
  cam.updateProjectionMatrix();r.render(window.scene,cam);
};
document.title='ready';
</script></body></html>`;
  await page.setContent(html);
  await page.waitForFunction(() => document.title === 'ready', null, {timeout: 60000});
  const cells = [];
  for (const it of items) {
    const b64 = fs.readFileSync(it.file).toString('base64');
    const markers = [
      ...it.report.holes.points.map(p => ({p, color: 0xff0000})),
      ...it.report.seeThrough.points.map(p => ({p, color: 0xff9900})),
      ...it.report.detached.parts.filter(d => d.gap > 0.05 && (d.gap <= 2 || d.hovering)).map(d => ({p: d.centre, color: 0xff00ff})),
      ...it.report.invertedRoof.points.map(p => ({p, color: 0xffff00})),
    ];
    try { await page.evaluate(([b, m]) => window.load(b, m), [b64, markers]); } catch (e) { console.log('render failed', it.id, String(e)); continue; }
    const views = [];
    for (const view of ['aerial', 'street']) {
      await page.evaluate(([w, h, v]) => window.shot(w, h, v), [700, 460, view]);
      const file = path.join(outDir, `${it.id}-${view}.png`);
      await page.locator('canvas').screenshot({path: file});
      views.push(file);
    }
    cells.push({id: it.id, score: it.report.score, text: it.report.findings.map(f => f.kind).join(', '), views});
    console.log('shot', it.id);
  }
  // contact sheet
  const imgs = cells.map(c => `<div style="display:inline-block;margin:4px;width:520px;font:12px sans-serif"><b>${c.id}</b> score ${c.score.toFixed(0)} - ${c.text}<br>` +
    c.views.map(v => `<img width="255" src="data:image/png;base64,${fs.readFileSync(v).toString('base64')}">`).join('') + '</div>').join('');
  const sheet = await br.newPage({viewport: {width: 1100, height: 400}});
  await sheet.setContent(`<body style="margin:6px;background:#fff">${imgs}<div style="font:12px sans-serif">markers: red=open hole loop, orange=see-through ray, magenta=detached part, yellow=inverted roof</div></body>`);
  await sheet.screenshot({path: path.join(outDir, 'contact.png'), fullPage: true});
  await br.close();
  console.log(`contact sheet: ${path.join(outDir, 'contact.png')}`);
}
