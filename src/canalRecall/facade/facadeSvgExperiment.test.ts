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
assert.match(svg,/width="640" height="960" viewBox="0 0 640 960"/);
assert.ok(!svg.includes('preserveAspectRatio="none"'));
assert.match(svg,/Evidence only: &lt;not accepted&gt; &amp; unregistered/);
assert.match(svg,/data-material="render" d="M64 192 L576 192 L576 912 L64 912 Z"/);
assert.match(svg,/data-material="tile" d="M64 192 L192 76\.8 L448 76\.8 L576 192 Z"/);
assert.match(svg,/<rect x="128" y="288" width="128" height="240" data-kind="window"/);
assert.match(svg,/data-kind="door" data-visibility="inferred"/);
assert.match(svg,/data-occlusion="tree" d="M12\.8 566\.4 L70\.4 528 L115\.2 912 L12\.8 912 Z"/);
assert.ok(!svg.includes('<not accepted>'));

// The same normalized shape must occupy the same source-pixel box on either
// aspect ratio. Its arched head radius is computed in physical pixels.
const arch={...sample,openings:[{...sample.openings[1],visibility:'observed'}]};
const tall=renderFacadeSvg(arch,{width:200,height:1000});
const wide=renderFacadeSvg(arch,{width:1000,height:200});
const arc=(markup:string)=>{
 const match=markup.match(/<path d="M([\d.]+) ([\d.]+) V([\d.]+) A([\d.]+) ([\d.]+) 0 0 1 ([\d.]+) ([\d.]+) V([\d.]+) Z" data-kind="door"/);
 assert.ok(match,'rendered door has a source-pixel arc');
 return match.slice(1).map(Number);
};
const [tx,tyBottom,tyTop,trX,trY,tRight]=arc(tall);
assert.deepEqual([tx,tyBottom,tRight],[126,950,158]);
assert.equal(tyTop,620+trY);
assert.equal(trX,16);
assert.ok(trY<=16,'vertical arch radius cannot exceed half its physical width');
const [wx,wyBottom,wyTop,wrX,wrY,wRight]=arc(wide);
assert.deepEqual([wx,wyBottom,wRight],[630,190,790]);
assert.equal(wyTop,124+wrY);
assert.equal(wrX,80);
assert.ok(wrY<=80);
assert.equal(wrY,Math.min(80,66/3));
assert.deepEqual(toSourceFacadeFeatures(arch,{width:200,height:1000})[0].bounds,[126,620,158,950]);
const source80={...sample,openings:[{...sample.openings[1],bounds:[150,120,120,180]}]};
const source80Svg=renderFacadeSvg(source80,{width:275,height:873});
assert.match(source80Svg,/stroke-width="1.375"/,'frames use one uniform source-pixel width');
const source80Arc=arc(source80Svg);
assert.equal(source80Arc[3],16.5);
assert.equal(source80Arc[4],16.5,'narrow source 80 arch uses width in source pixels');
assert.equal(source80Arc[5]-source80Arc[0],33,'the proposed box width is unchanged');
assert.ok(Math.abs(source80Arc[1]-source80Arc[2]-140.64)<1e-9);

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
