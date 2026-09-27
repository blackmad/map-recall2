import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {creamRuns,fitOuterArch,mergeSeeds,run} from './detect-entrance-assemblies.ts';

test('filled cream entrance seeds exclude two-pixel shop trim',()=>{
  const w=200,h=100,rgb=Buffer.alloc(w*h*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)rgb.set(
    x>=20&&x<30&&y>=82&&y<97||x>=60&&x<62&&y>=82&&y<97?[220,210,185]:[150,95,78],(y*w+x)*3);
  const seeds=creamRuns(rgb,w,h,78);
  assert.equal(seeds.length,1);
  assert.deepEqual([seeds[0].box.x0,seeds[0].box.x1],[20,30]);
});

test('nested seed pieces merge; adjacent apertures remain separate',()=>{
  const seed=(x0:number,x1:number,source:string)=>({box:{x0,y0:75,x1,y1:98,pixels:100},source,core:'glass' as const});
  const groups=mergeSeeds([seed(20,34,'glass'),seed(22,32,'cream'),seed(35,49,'neighbor')],120,100);
  assert.equal(groups.length,2);
  assert.deepEqual([groups[0].box.x0,groups[0].box.x1],[20,34]);
});

test('outer arch follows a convex dark edge and terminates at detected ground',()=>{
  const w=120,h=100,rgb=Buffer.alloc(w*h*3,160);
  for(let x=36;x<=74;x++){
    const z=(x-55)/19,y=Math.round(70+8*z*z);
    for(let dy=0;dy<2;dy++)rgb.set([35,31,29],((y+dy)*w+x)*3);
  }
  const fit=fitOuterArch({x0:40,y0:78,x1:70,y1:95,pixels:200},rgb,w,h,65,98);
  assert.equal(fit.edgeFit,true);
  assert.ok(fit.outline[8][1]<fit.outline[0][1]);
  assert.ok(Math.abs(fit.outline.at(-1)![1]-.97)<.04);
});

test('source receipt mismatch fails before emitting proposals',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'entrance-detect-'));
  const image=await sharp({create:{width:100,height:100,channels:3,background:'#985f4e'}}).png().toBuffer();
  const img=path.join(dir,'strip.png'),receipt=path.join(dir,'receipt.json'),out=path.join(dir,'out');
  await writeFile(img,image);
  await writeFile(receipt,JSON.stringify({status:'ok',width:100,height:100,pngSha256:createHash('sha256').update('wrong').digest('hex')}));
  await assert.rejects(run(img,receipt,out),/hash or dimensions mismatch/);
  await assert.rejects(readFile(path.join(out,'entrances.json')));
});
