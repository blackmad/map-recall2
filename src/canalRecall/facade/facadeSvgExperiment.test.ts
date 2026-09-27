import assert from 'node:assert/strict';
import {FACADE_SVG_JSON_SCHEMA,renderFacadeSvg,toSourceFacadeFeatures,validateFacadeSvgExperiment} from './facadeSvgExperiment.ts';

const sample={
 version:1,
 walls:[{points:[[100,200],[900,200],[900,950],[100,950]],colour:'#C9BCA4',material:'render'}],
 openings:[
  {kind:'window',bounds:[200,300,200,250],shape:'rect',frameColour:'#F5F4EE',colour:'#617789',visibility:'observed'},
  {kind:'door',bounds:[630,620,160,330],shape:'arched',frameColour:'#564A3E',colour:'#382F29',visibility:'inferred'},
  {kind:'shop',bounds:[150,750,350,200],shape:'rect',frameColour:'#D9D3C7',colour:'#53636A',visibility:'observed'},
 ],
 roof:{points:[[100,200],[300,80],[700,80],[900,200]],colour:'#514943',material:'tile'},
 occlusions:[{points:[[20,590],[110,550],[180,950],[20,950]],kind:'tree'}],
 notes:'Evidence only: <not accepted> & unregistered.',
};

assert.equal(FACADE_SVG_JSON_SCHEMA.additionalProperties,false);
assert.equal(validateFacadeSvgExperiment(sample).openings.length,3);
const svg=renderFacadeSvg(sample,{width:640,height:960});
assert.equal(svg,renderFacadeSvg(sample,{width:640,height:960}));
assert.match(svg,/width="640" height="960" viewBox="0 0 1000 1000" preserveAspectRatio="none"/);
assert.match(svg,/Evidence only: &lt;not accepted&gt; &amp; unregistered/);
assert.match(svg,/data-material="render"/);
assert.match(svg,/data-material="tile"/);
assert.match(svg,/data-kind="door" data-visibility="inferred"/);
assert.match(svg,/data-occlusion="tree"/);
assert.ok(!svg.includes('<not accepted>'));

const features=toSourceFacadeFeatures(sample,{width:640,height:960});
assert.equal(features.length,2,'inferred door is not an observed FacadeFeature');
assert.deepEqual(features[0],{
 id:'svg-window-0',kind:'window',bounds:[128,288,256,528],disposition:'machine-observed-unreviewed',
 head:'rectangular',colour:'#617789',frameColour:'#F5F4EE',
});
assert.deepEqual(features[1],{
 id:'svg-shop-2',kind:'window',bounds:[96,720,320,912],disposition:'machine-observed-unreviewed',
 head:'rectangular',colour:'#53636A',frameColour:'#D9D3C7',region:'ground-floor',
});

const copy=()=>structuredClone(sample);
const reject=(change:(value:any)=>void,reason:RegExp)=>{const value=copy();change(value);assert.throws(()=>validateFacadeSvgExperiment(value),reason);};
reject(v=>{v.extra=true;},/not allowed/);
reject(v=>{v.walls[0].colour='url(javascript:bad)';},/hex colour/);
reject(v=>{v.openings[0].bounds=[900,300,200,250];},/inside the image/);
reject(v=>{v.openings[0].bounds=[200,300,0,250];},/positive/);
reject(v=>{v.openings[0].visibility='certain';},/visibility/);
reject(v=>{v.walls[0].points=[[100,100],[200,200],[300,300]];},/nonzero area/);
reject(v=>{v.roof.material='brick';},/material/);
reject(v=>{v.notes='bad\u0000xml';},/SVG-safe/);
assert.throws(()=>renderFacadeSvg(sample,{width:0,height:960}),/dimensions/);
console.log('facade SVG experiment: strict schema, deterministic SVG and source-pixel adapter pass');
