/** Source-bound 100-building visual loop. Generated photographs/captures stay local. */
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.js';
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const root='.cache/wall-colour-loop';
const manifest=JSON.parse(await fs.readFile('public/data/city-expansion/current.json','utf8'));
const sample=JSON.parse(await fs.readFile('public/data/wall-colour/v1/sample.json','utf8'));
const accepted=JSON.parse(await fs.readFile('review-data/wall-colour/v1/accepted.json','utf8')).accepted;
const owners=new Map<string,any>();
for(const tile of manifest.tiles){const bytes=await fs.readFile(`public${tile.url}`);if(hash(bytes)!==tile.sha256)throw Error('Tile hash mismatch');for(const o of JSON.parse(gunzipSync(bytes).toString()).owners)owners.set(o.id,o);}
const entries=accepted.map((a:any)=>{const s=sample.entries.find((s:any)=>s.observationId===a.observationId),o=owners.get(a.buildingId),p=o?.observations.find((x:any)=>x.id===a.observationId)?.payload;if(!s||!p)return null;return {...s,photoHex:a.hex,center:rdToLngLat(p.wall.midpoint),bearing:(p.wall.facingDeg+180)%360,height:p.height,width:p.wallWidthM,geometryRevision:o.geometryRevision};}).filter(Boolean);
// Fixed target plus a reproducible spread across streets and observed colour families.
const groups=new Map<string,any[]>();for(const e of entries){const key=`${e.street}:${e.family}`;groups.set(key,[...(groups.get(key)??[]),e]);}
for(const g of groups.values())g.sort((a,b)=>hash(a.buildingId).localeCompare(hash(b.buildingId)));
const target=entries.find((e:any)=>e.buildingId==='0363100012166570');if(!target)throw Error('Named regression owner missing');
const chosen=[target],used=new Set([target.buildingId]);
while(chosen.length<100){let progress=false;for(const key of [...groups.keys()].sort()){const g=groups.get(key)!;while(g.length&&used.has(g[0].buildingId))g.shift();if(g.length&&chosen.length<100){const e=g.shift();chosen.push(e);used.add(e.buildingId);progress=true;}}if(!progress)throw Error('Fewer than 100 eligible owners');}
await fs.mkdir(root,{recursive:true});
const cohort={version:1,baselineReleaseId:manifest.releaseId,sampleSha256:sample.sha256,selectionPolicy:'Da Costakade 13 plus deterministic round-robin by street and observed family, hash order within strata; 100 unique previously accepted owners',entries:chosen.map((e,i)=>({...e,index:i}))};
await fs.writeFile('review-data/wall-colour/visual-loop/cohort.json',JSON.stringify(cohort,null,2)+'\n');
for(let start=0;start<100;start+=10){const composite:any[]=[];for(let i=start;i<start+10;i++){const e=cohort.entries[i],bytes=await fs.readFile(`public${e.crop}`);if(hash(bytes)!==e.sourceSha256)throw Error('Photo hash mismatch');const x=(i-start)%5*280,y=Math.floor((i-start)/5)*410;const photo=await sharp(bytes).resize(270,350,{fit:'contain',background:'#eeeeee'}).png().toBuffer();composite.push({input:photo,left:x,top:y+55});const label=Buffer.from(`<svg width="280" height="55"><rect width="280" height="55" fill="white"/><text x="5" y="18" font-size="15">${i} ${e.address.replaceAll('&','&amp;')}</text><text x="5" y="39" font-size="13">${e.photoHex} ${e.buildingId}</text></svg>`);composite.push({input:label,left:x,top:y});}await sharp({create:{width:1400,height:820,channels:3,background:'#ddd'}}).composite(composite).png().toFile(`${root}/references-${start}.png`);}
console.log(JSON.stringify({selected:chosen.length,streets:[...new Set(chosen.map(e=>e.street))],release:manifest.releaseId}));
