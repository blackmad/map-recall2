/**
 * Close-up evidence shots for the landmark geometry audit (detached openings, window rhythm, coplanar z-fighting).
 *
 * Renders a landmark GLB with its own materials (so coplanar overlaps z-fight exactly as WebGL draws them in game)
 * from an explicit camera, and overlays the offending geometry: `boxes` as depth-ignoring wireframes, `tris` as a
 * translucent tint. three.js is served from node_modules; no network needed.
 *
 *   node --import tsx scripts/landmarks/geometry-audit-shots.ts --id=oude-lutherse-kerk --eye=30,8,20 --target=10,6,5 [--fov=45] [--out=file.png]
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import {chromium, type Browser, type Page} from '@playwright/test';

export type V3 = [number, number, number];
export interface ShotOverlay {boxes?: {min: V3; max: V3; color?: number}[]; tris?: {p: number[]; color?: number}[]}
export interface Shot {
  eye: V3; target: V3; fov?: number; width?: number; height?: number; out: string; overlay?: ShotOverlay; flat?: boolean;
  /** Camera near/far planes (game-like depth precision: MapLibre's custom-layer near plane is metres, not centimetres). */
  near?: number; far?: number;
  /** Apply the game's landmark depth bias (signature-landmarks-source.js: polygonOffset factor -32, units -4096). */
  gameBias?: boolean;
  /** Override the bias as [factor, units] (to test a fix). */
  bias?: [number, number];
}

const ROOT = path.resolve(import.meta.dirname, '../..');
const threeDir = path.resolve(path.dirname(createRequire(import.meta.url).resolve('three')), '..');

const HTML = `<html><body style="margin:0;background:#a9bfd0"><script type="importmap">{"imports":{"three":"http://local/build/three.module.js","three/addons/":"http://local/examples/jsm/"}}</script>
<script type="module">
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const r=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true,logarithmicDepthBuffer:false});document.body.appendChild(r.domElement);
let model=null,overlay=null;const s=new T.Scene();s.background=new T.Color('#a9bfd0');s.add(new T.HemisphereLight(0xdfe8f0,0x6b6458,1.6));
const sun=new T.DirectionalLight(0xfff1dd,2.2);sun.position.set(-30,40,25);s.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(800,800),new T.MeshLambertMaterial({color:0x8f8478}));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;s.add(ground);
window.load=(b64,flat)=>new Promise((res,rej)=>{
  if(model){s.remove(model);model=null;}
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(bytes.buffer,'',g=>{
    if(flat)g.scene.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.flatShading=true;o.material.side=T.DoubleSide;}});
    model=g.scene;s.add(model);res(true);
  },rej);
});
window.shot=(sh)=>{
  if(overlay){s.remove(overlay);}overlay=new T.Group();s.add(overlay);
  for(const b of (sh.overlay?.boxes??[])){const h=new T.Box3Helper(new T.Box3(new T.Vector3(...b.min),new T.Vector3(...b.max)),b.color??0xff00ff);h.material.depthTest=false;h.material.linewidth=2;h.renderOrder=10;overlay.add(h);}
  for(const t of (sh.overlay?.tris??[])){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(t.p,3));const m=new T.Mesh(g,new T.MeshBasicMaterial({color:t.color??0xff00ff,transparent:true,opacity:.55,side:T.DoubleSide,depthTest:false}));m.renderOrder=9;overlay.add(m);}
  const w=sh.width??900,h=sh.height??620;r.setSize(w,h);
  model.traverse(o=>{if(o.isMesh){for(const m of [o.material].flat()){const b=sh.bias??(sh.gameBias?[-32,-4096]:[0,0]);m.polygonOffset=b[0]!==0||b[1]!==0;m.polygonOffsetFactor=b[0];m.polygonOffsetUnits=b[1];m.needsUpdate=true;}}});
  const cam=new T.PerspectiveCamera(sh.fov??45,w/h,sh.near??.3,sh.far??3000);cam.position.set(...sh.eye);cam.lookAt(...sh.target);cam.updateProjectionMatrix();
  r.render(s,cam);
  return r.domElement.toDataURL('image/png');
};
document.title='ready';
</script></body></html>`;

export class ShotRenderer {
  private browser?: Browser;
  private page?: Page;
  private loaded = '';
  async open(): Promise<void> {
    this.browser = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
    this.page = await this.browser.newPage({viewport: {width: 1000, height: 700}});
    this.page.on('pageerror', e => console.log('pageerror', e.message));
    await this.page.route('http://local/**', route => {
      const p = new URL(route.request().url()).pathname.replace(/^\//, '');
      route.fulfill({body: fs.readFileSync(path.join(threeDir, p)), contentType: 'text/javascript'});
    });
    await this.page.setContent(HTML);
    await this.page.waitForFunction(() => document.title === 'ready', null, {timeout: 60000});
  }
  async shoot(glb: string, shot: Shot): Promise<string> {
    // swiftshader under heavy load occasionally loses the context and returns a blank frame: verify and retry.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (!this.page) await this.open();
        const page = this.page!;
        const key = `${glb}|${shot.flat ? 1 : 0}`;
        if (this.loaded !== key) {
          await page.evaluate(([b, f]) => (window as unknown as {load: (b: string, f: boolean) => Promise<boolean>}).load(b as string, f as boolean), [fs.readFileSync(glb).toString('base64'), !!shot.flat] as const);
          this.loaded = key;
        }
        const url = await page.evaluate(sh => (window as unknown as {shot: (s: unknown) => string}).shot(sh), shot as unknown as Record<string, unknown>);
        const png = Buffer.from(url.replace(/^data:image\/png;base64,/, ''), 'base64');
        const stats = await sharp(png).stats();
        if (stats.channels.slice(0, 3).some(c => c.stdev > 2)) {
          fs.mkdirSync(path.dirname(shot.out), {recursive: true});
          fs.writeFileSync(shot.out, png);
          return shot.out;
        }
      } catch (e) { console.log('shot retry', String(e).slice(0, 120)); }
      await this.close();
      this.page = undefined; this.browser = undefined; this.loaded = '';
    }
    throw new Error(`blank render for ${shot.out}`);
  }
  async close(): Promise<void> { await this.browser?.close(); }
}

if (process.argv[1]?.endsWith('geometry-audit-shots.ts')) {
  const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const v3 = (s: string | undefined, d: V3): V3 => (s ? s.split(',').map(Number) as V3 : d);
  const id = arg('id')!;
  const glb = arg('glb') ?? path.join(ROOT, `public/canal-drive/models/${id}.glb`);
  const r = new ShotRenderer();
  const out = arg('out') ?? path.join(ROOT, `artifacts/geometry-audit/manual/${id}.png`);
  await r.shoot(glb, {eye: v3(arg('eye'), [40, 20, 40]), target: v3(arg('target'), [0, 5, 0]), fov: Number(arg('fov') ?? 45), out, flat: process.argv.includes('--flat'),
    near: arg('near') ? Number(arg('near')) : undefined, far: arg('far') ? Number(arg('far')) : undefined, gameBias: process.argv.includes('--game-bias'), bias: arg('bias') ? arg('bias')!.split(',').map(Number) as [number, number] : undefined,
    overlay: arg('box') ? {boxes: [{min: v3(arg('box')!.split(';')[0], [0, 0, 0]), max: v3(arg('box')!.split(';')[1], [0, 0, 0])}]} : undefined});
  await r.close();
  console.log(out);
}
