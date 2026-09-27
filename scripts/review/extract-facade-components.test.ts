import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {components,groupPanes,classifyRgb,localWallColour,railEvidence,run} from './extract-facade-components.ts';

test('short mullion gap groups panes; masonry gap remains separate',()=>{
  const w=200,h=200,mask=new Uint8Array(w*h);
  for(const [x0,x1] of [[10,17],[22,29],[58,69]]) for(let y=20;y<50;y++)for(let x=x0;x<x1;x++)mask[y*w+x]=1;
  const grouped=groupPanes(components(mask,w,h),w,h);
  assert.equal(grouped.length,2);
  assert.deepEqual(grouped.map(b=>[b.x0,b.x1]),[[10,29],[58,69]]);
});

test('sampled wall colour excludes dark glazing',()=>{
  const w=20,h=20,data=Buffer.alloc(w*h*3),box={x0:7,y0:5,x1:13,y1:15,pixels:60};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const c=x>=7&&x<13&&y>=5&&y<15?[74,85,91]:[147,94,77];
    data.set(c,(y*w+x)*3);
  }
  const {wall,glass}=classifyRgb(data,w,h);
  assert.equal(glass[7*w+8],1);
  assert.equal(wall[7*w+8],0);
  assert.equal(localWallColour(box,data,wall,w,h).wallColour,'#935e4d');
});

test('balcony extent follows the rail and slab below glazing',()=>{
  const w=100,h=100,dark=new Uint8Array(w*h),opening={x0:30,y0:10,x1:50,y1:40,pixels:450};
  for(let y=40;y<=58;y++)for(let x=23;x<57;x++)dark[y*w+x]=1;
  const result=railEvidence(opening,dark,w,h,80);
  assert.equal(result.box.y0,38);
  assert.equal(result.box.y1,60);
  assert.ok(result.box.x0<opening.x0&&result.box.x1>opening.x1);
});

test('receipt/image binding fails closed before emitting a mask',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'facade-components-'));
  const image=await sharp({create:{width:32,height:32,channels:3,background:'#a06050'}}).png().toBuffer();
  const img=path.join(dir,'source.png'),receipt=path.join(dir,'receipt.json'),out=path.join(dir,'out');
  await writeFile(img,image);
  await writeFile(receipt,JSON.stringify({status:'ok',width:32,height:32,pngSha256:'0'.repeat(64)}));
  await assert.rejects(run(img,receipt,out),/hash or dimensions mismatch/);
  await assert.rejects(readFile(path.join(out,'glass-mask.png')));
});
