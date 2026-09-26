import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { measureLocalWallColours, upperWallCutoffRow } from './measure-local-wall-colours.ts';

const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'local-wall-colour-'));
try{
  const evidence=path.join(root,'evidence'),images=path.join(evidence,'images'),seg=path.join(root,'segmentation');
  const masks=path.join(seg,'masks','s1'),out=path.join(root,'out','wall-colours.json');
  await Promise.all([fs.mkdir(images,{recursive:true}),fs.mkdir(masks,{recursive:true})]);
  const width=48,height=48,source=Buffer.alloc(width*height*3);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*3,upper=y<29;
    source[i]=upper?145:92;source[i+1]=upper?88:105;source[i+2]=upper?66:67;
  }
  const image=await sharp(source,{raw:{width,height,channels:3}}).jpeg({quality:100}).toBuffer();
  const imageName='owner_e_1-full.jpg',imageFile=path.join(images,imageName);
  await fs.writeFile(imageFile,image);
  const sourceHash=hash(image),manifestFile=path.join(evidence,'manifest.json');
  const manifest={sourceHash:'a'.repeat(64),sourceProfile:'material-4000',records:[{
    id:'owner_e_1',buildingId:'owner',elevationId:'owner:e:1',groundNAP:0,
    images:{full:{file:imageName,sha256:sourceHash,date:'2025-01-01T00:00:00Z',
      plane:{baseZ:0,topZ:10}}},
  }]};
  await fs.writeFile(manifestFile,JSON.stringify(manifest));
  const maskFile=path.join(masks,`${sourceHash}.mask.png`),provenanceFile=path.join(seg,'s1.provenance.json');
  const writeMask=async(labels:Buffer,channels:1|4=1)=>{
    const pipeline=sharp(labels,{raw:{width,height,channels}});
    const bytes=await (channels===1?pipeline.toColourspace('b-w'):pipeline).png().toBuffer();
    await fs.writeFile(maskFile,bytes);
    const provenance={schemaVersion:1,method:'s1',classMapping:{contract:{'2':'building'}},
      records:[{file:`${sourceHash}.jpg`,stem:sourceHash,mask:`masks/s1/${sourceHash}.mask.png`,
        maskSha256:hash(bytes),width,height,pandId:'owner'}]};
    await fs.writeFile(provenanceFile,JSON.stringify(provenance));
  };
  const run=()=>measureLocalWallColours([`--manifest=${manifestFile}`,`--masks=${masks}`,`--out=${out}`]);
  assert.equal(upperWallCutoffRow(48,{baseZ:0,topZ:10},0),28);
  await writeMask(Buffer.alloc(width*height,2));
  const accepted=await run();
  assert.equal(accepted.counts.sources,1);
  assert.notEqual(accepted.rows[0].status,'withheld',JSON.stringify(accepted.rows[0]));
  assert.equal(accepted.rows[0].sourceSha256,sourceHash);
  assert.equal(accepted.rows[0].upper.cutoffRow,28);
  assert.match(accepted.rows[0].photoHex,/^#[a-f0-9]{6}$/);
  assert.equal(accepted.rows[0].upper.buildingPixels,width*28);
  assert.equal(accepted.rows[0].full.buildingPixels,width*height);
  assert.equal(accepted.rows[0].sourceIdentityUnverified,true);

  await fs.rm(maskFile);
  const missing=await run();
  assert.equal(missing.rows[0].status,'withheld');
  assert.equal(missing.rows[0].reason,'missing-mask');
  assert.equal(missing.rows[0].photoHex,null);

  await writeMask(Buffer.alloc(width*height,2));
  await fs.writeFile(maskFile,'tampered');
  const changed=await run();
  assert.equal(changed.rows[0].reason,'mask-hash-mismatch');
  assert.equal(changed.rows[0].photoHex,null);

  await writeMask(Buffer.alloc(width*height*4,2),4);
  const alpha=await run();
  assert.equal(alpha.rows[0].reason,'mask-must-be-opaque-single-channel');
  assert.equal(alpha.rows[0].photoHex,null);

  await writeMask(Buffer.alloc(width*height,3));
  const wrongLabel=await run();
  assert.equal(wrongLabel.rows[0].reason,'no-building-label-2-pixels');
  assert.equal(wrongLabel.rows[0].photoHex,null);

  await fs.writeFile(imageFile,'tampered');
  await assert.rejects(run(),/Source crop hash mismatch/);
  console.log('Local wall colours: exact bindings, metric cutoff, and fail-closed mask tests passed');
}finally{await fs.rm(root,{recursive:true,force:true});}
