import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BuildingContextIndex,type FootprintBox} from './buildingContextIndex.js';

test('neighbor lookup matches the full scan at cell seams, courtyard gaps and across large footprints',()=>{
 const features:Array<{id:string;box:FootprintBox}>=[];
 for(let y=0;y<12;y++)for(let x=0;x<20;x++)features.push({id:`${x}/${y}`,box:[4.88+x*.00029,52.37+y*.00027,4.88+x*.00029+.00031,52.37+y*.00027+.00028]});
 features.push({id:'long',box:[4.879,52.371,4.885,52.3711]},{id:'seam',box:[4.88099997,52.371,4.88100001,52.371001]},{id:'invalid',box:[Infinity,Infinity,-Infinity,-Infinity]});
 const index=new BuildingContextIndex(features,f=>f.box),pad=.00000005;
 const brute=(source:typeof features)=>features.filter(f=>!source.includes(f)&&source.some(s=>f.box[2]>=s.box[0]-pad&&f.box[0]<=s.box[2]+pad&&f.box[3]>=s.box[1]-pad&&f.box[1]<=s.box[3]+pad));
 for(const source of [[features[0]],[features[62],features[149]],features.slice(40,80),[features.at(-3)!],[]])
  assert.deepEqual(index.neighbors(source,f=>source.includes(f)),brute(source));
});

test('resident replacement drops departed context and keeps original order',()=>{
 const a={id:'a',box:[4.88,52.37,4.881,52.371] as FootprintBox},b={id:'b',box:[4.881,52.37,4.882,52.371] as FootprintBox},c={id:'c',box:[4.88,52.371,4.881,52.372] as FootprintBox};
 const old=new BuildingContextIndex([c,a,b],f=>f.box),next=new BuildingContextIndex([a,b],f=>f.box);
 assert.deepEqual(old.neighbors([a],f=>f===a),[c,b]);
 assert.deepEqual(next.neighbors([a],f=>f===a),[b]);
 assert.deepEqual(next.neighbors([a],()=>true),[]);
});
