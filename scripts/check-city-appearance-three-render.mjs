/** Real WebGL smoke test of staged city geometry; no server, publication or review writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { compileBlockAppearance } from './city-appearance/compile-block-tiles.ts';
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
const evidence=JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json'));
const compiled=compileBlockAppearance(block,evidence),owners=compiled.tiles.flatMap(t=>t.owners);
const bundle=await build({stdin:{contents:"export * as THREE from 'three'; export {createCityAppearanceThreeAdapter} from './src/canalRecall/cityAppearanceThree.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife',globalName:'AppearanceSmoke',platform:'browser'});
await fs.mkdir('.cache/city-appearance',{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],metrics=[];
try{
  for(const width of [1280,390]){
    const page=await browser.newPage({viewport:{width,height:850}});page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<!doctype html><html><head><title>City appearance adapter smoke</title><style>body{margin:0;background:#e9e9df}canvas{display:block}</style></head><body></body></html>');
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const initial=await page.evaluate(({owners,origin})=>{
      const {THREE,createCityAppearanceThreeAdapter}=window.AppearanceSmoke;
      const scene=new THREE.Scene();scene.background=new THREE.Color('#e9e9df');
      scene.add(new THREE.HemisphereLight('#ffffff','#a9aaa0',2));const light=new THREE.DirectionalLight('#fff4df',2);light.position.set(-100,200,100);scene.add(light);
      const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
      const resource=createCityAppearanceThreeAdapter({parent:scene,targetOriginRD:origin})(owners);
      const bounds=new THREE.Box3().setFromObject(resource.group),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
      const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.2,2000);
      const radius=Math.max(size.x,size.z)*Math.max(1,1/camera.aspect)*1.3;camera.position.copy(center).add(new THREE.Vector3(.45,.7,.65).normalize().multiplyScalar(radius));camera.lookAt(center);
      renderer.render(scene,camera);const first=resource.pick(resource.group.children[0],0);
      window.smoke={scene,renderer,camera,resource,owners,origin,render:()=>renderer.render(scene,camera)};
      return {stats:resource.stats,drawCalls:renderer.info.render.calls,picked:first,canvas:[renderer.domElement.width,renderer.domElement.height],experimental:resource.group.userData.experimentalWallColours};
    },{owners,origin:block.origin});
    assert.equal(initial.stats.buildings,171);assert.equal(initial.experimental,false);assert.ok(initial.stats.triangles>0);assert.ok(initial.drawCalls<=8);assert.ok(owners.some(b=>b.id===initial.picked.buildingId));assert.equal(initial.canvas[0],width);
    await page.screenshot({path:`.cache/city-appearance/three-neutral-${width}.png`});
    const lod=await page.evaluate(()=>{
      const s=window.smoke;for(const b of s.owners)s.resource.setLod(b.id,'massing');s.resource.flush();s.render();const massing=s.resource.stats;
      s.resource.dispose();const disposed=s.resource.stats,detached=!s.scene.children.includes(s.resource.group);
      s.resource=window.AppearanceSmoke.createCityAppearanceThreeAdapter({parent:s.scene,targetOriginRD:s.origin,experimentalWallColours:true})(s.owners);
      for(const b of s.owners)s.resource.setLod(b.id,'detail');s.resource.flush();s.render();
      const picks=s.resource.group.children.flatMap(m=>m.userData.triangleIdentities),ids=[...new Set(picks.map(p=>p.observationId).filter(Boolean))];
      return {massing,disposed,detached,detail:s.resource.stats,observed:ids.length,amsta:ids.filter(id=>id.startsWith('0363100012237064'))};
    });
    assert.ok(lod.massing.triangles<initial.stats.triangles);assert.equal(lod.disposed.disposed,true);assert.equal(lod.disposed.meshes,0);assert.equal(lod.detached,true);assert.ok(lod.detail.meshes<=8);
    // Six represented records recover ground/roof fields only; none establishes wall paint.
    const colourCandidates=evidence.records.filter(r=>r.effectiveProposal?.wholeUsable==='yes'&&['brown','red','buff','grey','white','black'].includes(r.effectiveProposal.wallColour));
    assert.equal(colourCandidates.length,95);assert.equal(lod.observed,colourCandidates.length);
    assert.ok(lod.amsta.includes('0363100012237064_e_1hyy18v'));assert.ok(lod.amsta.includes('0363100012237064_e_0aws3g3'));
    await page.screenshot({path:`.cache/city-appearance/three-experimental-${width}.png`});
    metrics.push({width,initial,lod});await page.evaluate(()=>{window.smoke.resource.dispose();window.smoke.renderer.dispose();});await page.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile('.cache/city-appearance/three-render-metrics.json',JSON.stringify({metrics,errors},null,2));
  console.log(JSON.stringify({passed:true,metrics,errors},null,2));
}finally{await browser.close();}
