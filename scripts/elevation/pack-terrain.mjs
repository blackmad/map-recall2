/** Pack unchanged PNG payloads into small range-readable archives. No runtime GeoTIFF work. */
import {readdir,readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
const root=process.argv[2]||'public/data/extracts/amsterdam/terrain',packs=new Map();
for(let z=10;z<=18;z++){
 for(const x of await readdir(`${root}/${z}`).catch(()=>[]))for(const file of await readdir(`${root}/${z}/${x}`)){
  const quality=file.endsWith('.quality.png'),y=Number(file.replace(/(?:\.quality)?\.png$/,''));if(!Number.isFinite(y))continue;
  const group=z<14?'overview':`14-${Number(x)>>(z-14)}-${y>>(z-14)}`;
  if(!packs.has(group))packs.set(group,[]);packs.get(group).push({key:`${z}/${x}/${y}${quality?':quality':''}`,path:`${root}/${z}/${x}/${file}`});
 }
}
if(!packs.size)throw Error('No unpacked PNGs found');await mkdir(`${root}/packs`,{recursive:true});let total=0;
for(const [group,entries]of packs){entries.sort((a,b)=>a.key.localeCompare(b.key));const tiles={},parts=[];let offset=0;for(const entry of entries){const bytes=await readFile(entry.path);tiles[entry.key]=[offset,bytes.length];parts.push(bytes);offset+=bytes.length;}const payload=Buffer.concat(parts);await writeFile(`${root}/packs/${group}.bin`,payload);await writeFile(`${root}/packs/${group}.json`,JSON.stringify({version:1,sha256:createHash('sha256').update(payload).digest('hex'),byteLength:payload.length,tiles})+'\n');total+=payload.length;}
const meta=JSON.parse(await readFile(`${root}/tilejson.json`,'utf8'));meta.delivery='indexed-png-pack-v1';meta.packs=packs.size;meta.payloadBytes=total;await writeFile(`${root}/tilejson.json`,JSON.stringify(meta,null,2)+'\n');
// The source build is reproducible; keep unpacked staging outside the public tree.
const cache=resolve('.cache/elevation-unpacked');await mkdir(cache,{recursive:true});for(let z=10;z<=18;z++){await rm(`${cache}/${z}`,{recursive:true,force:true});await rename(`${root}/${z}`,`${cache}/${z}`);}
await rm(`${root}/completed`,{recursive:true,force:true});console.log(JSON.stringify({packs:packs.size,payloadBytes:total}));
