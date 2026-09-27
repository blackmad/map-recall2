import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {fitBalconyPaint,run} from './fit-balcony-cleanup.ts';

const opening={id:'window-1',kind:'window',bounds:[.4,.2,.6,.5]};
const balcony={id:'balcony-1',kind:'balcony',bounds:[.35,.45,.65,.68],linkedOpeningId:'window-1',wallColour:'#906050'};
const w=100,h=100;
function painted() {
  const dark=new Uint8Array(w*h);
  for(let y=26;y<=73;y++)for(const x of [36,37,62,63])dark[y*w+x]=1;
  for(let y=70;y<=72;y++)for(let x=34;x<=66;x++)dark[y*w+x]=1;
  return dark;
}

test('linked dark side returns and slab extend cleanup beyond railing box',()=>{
  const result=fitBalconyPaint(balcony,opening,painted(),w,h);
  assert.equal(result.verified,true);
  assert.ok(result.cleanupBounds[1]<balcony.bounds[1]);
  assert.ok(result.cleanupBounds[3]>balcony.bounds[3]);
  assert.ok(result.cleanupBounds[0]<=.35&&result.cleanupBounds[2]>=.65);
});

test('overlapping unrelated opening and absent slab withhold cleanup',()=>{
  const other={id:'window-2',kind:'window',bounds:[.62,.3,.8,.5]};
  assert.equal(fitBalconyPaint(balcony,opening,painted(),w,h,[other]).verified,false);
  const noSlab=painted();for(let y=68;y<80;y++)for(let x=34;x<67;x++)noSlab[y*w+x]=0;
  assert.equal(fitBalconyPaint(balcony,opening,noSlab,w,h).verified,false);
});

test('image hash mismatch fails before output',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'balcony-cleanup-'));
  const img=path.join(dir,'image.png'),features=path.join(dir,'features.json'),out=path.join(dir,'out');
  await writeFile(img,await sharp({create:{width:100,height:100,channels:3,background:'#906050'}}).png().toBuffer());
  await writeFile(features,JSON.stringify({source:{imageSha256:'0'.repeat(64),width:100,height:100},features:[opening,balcony]}));
  await assert.rejects(run(img,features,out),/hash\/dimensions mismatch/);
  await assert.rejects(readFile(path.join(out,'balcony-cleanup.json')));
});
