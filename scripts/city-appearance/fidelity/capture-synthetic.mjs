/** Renderer engineering fixture, explicitly not a photo fidelity evaluation. */
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { owner,record } from './synthetic-fixture.ts';
const fixture=structuredClone(owner),observation=structuredClone(record);
fixture.geometry.building.surfaces[0].rings[0]=[[0,0,0],[8,0,0],[8,5,0],[0,5,0]];
observation.derivationKey='synthetic';
const source=observation.facadeDescription.sources.ground;
source.features.push(
 {id:'window',kind:'window',head:'segmental',bounds:[320,100,500,260],disposition:'machine-observed-unreviewed',surroundColour:'#e8e5d7',transom:.25},
 {id:'brick',kind:'material',region:'upper-wall',material:'brick',colour:'#925b46',bounds:[10,5,790,395],disposition:'machine-observed-unreviewed'},
 {id:'finish',kind:'material',region:'ground-floor',material:'paint',colour:'#e5e3d8',bounds:[20,285,780,390],disposition:'machine-observed-unreviewed'},
 {id:'awning',kind:'awning',state:'retracted',colour:'#354239',bounds:[300,55,530,75],disposition:'machine-observed-unreviewed'}
);
fixture.observations=[{id:observation.id,buildingId:fixture.id,geometryRevision:fixture.geometryRevision,evidenceKey:observation.evidenceKey,payload:observation}];
const bundle=await build({stdin:{contents:"export * as THREE from 'three'; export {createCityAppearanceThreeAdapter} from './src/canalRecall/cityAppearanceThree.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife',globalName:'FidelityFixture'});
const output='.cache/city-appearance/fidelity-engineering';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],metrics=[];
try{
 const page=await browser.newPage({viewport:{width:900,height:700}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setContent('<body style="margin:0"><div style="position:absolute;background:white;padding:8px;font:16px sans-serif">Synthetic engineering fixture — not a photograph or fidelity result</div></body>');
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 for(const mode of ['legacy','observed']){
  const data=structuredClone(fixture);if(mode==='legacy')delete data.observations[0].payload.facadeDescription;
  const metric=await page.evaluate(({data})=>{
   const {THREE,createCityAppearanceThreeAdapter}=window.FidelityFixture;
   if(window.fixtureView){window.fixtureView.resource.dispose();window.fixtureView.renderer.dispose();window.fixtureView.renderer.domElement.remove();}
   const scene=new THREE.Scene();scene.background=new THREE.Color('#dce2df');scene.add(new THREE.HemisphereLight(0xffffff,0x777777,3));
   const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,700);document.body.append(renderer.domElement);
   const resource=createCityAppearanceThreeAdapter({parent:scene,targetOriginRD:{x:0,y:0},targetOffsetNAP:.65,proceduralFacades:true})([data]);resource.setLod(data.id,'detail');resource.flush();
   const camera=new THREE.PerspectiveCamera(45,900/700,.1,100);window.fixtureView={resource,renderer,scene,camera};
   return resource.stats;
  },{data});
  for(const [view,position,target] of [['ground',[4,2,-7],[4,1.8,0]],['facade',[4,2.5,-10],[4,2.5,0]],['oblique',[11,4,-8],[4,2,0]]]){
   await page.evaluate(({position,target})=>{const v=window.fixtureView;v.camera.position.set(...position);v.camera.lookAt(...target);v.renderer.render(v.scene,v.camera);},{position,target});
   await page.screenshot({path:`${output}/${mode}-${view}.png`});
  }
  metrics.push({mode,...metric});
 }
 assert.deepEqual(errors,[]);assert.equal(metrics[1].doors,1);assert.equal(metrics[1].windows,1);assert.equal(metrics[1].awnings,1);
 await fs.writeFile(`${output}/metrics.json`,JSON.stringify({scope:'synthetic-engineering-only',metrics,errors},null,2));
 console.log(JSON.stringify({output,metrics,errors}));
}finally{await browser.close();}
