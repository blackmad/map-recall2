/** Archive the actual basemap's native water polygons, including its cartographic shoreline. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {VectorTile} from '@mapbox/vector-tile';import Pbf from 'pbf';
const arg=(k,d)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)||d;
const archive=arg('archive');if(!archive)throw Error('--archive required');
const bounds=arg('bounds','4.708,52.274,5.104,52.432').split(',').map(Number),root=`${archive}/raw/basemap-water`;
await mkdir(root,{recursive:true});
async function download(url,path){try{return await readFile(path);}catch{let last;for(let n=0;n<3;n++){try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const bytes=Buffer.from(await r.arrayBuffer());await writeFile(path,bytes);return bytes;}catch(e){last=e;if(n<2)await new Promise(r=>setTimeout(r,1000*2**n));}}throw last;}}
const source=JSON.parse((await download('https://tiles.openfreemap.org/planet',`${root}/source.json`)).toString());
const xy=(lng,lat)=>[(lng+180)/360*16384,(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*16384];
const [w,s,e,n]=bounds,[x0,y1]=xy(w,s),[x1,y0]=xy(e,n),keys=[];
for(let x=Math.floor(x0);x<=Math.floor(x1);x++)for(let y=Math.floor(y0);y<=Math.floor(y1);y++)keys.push([x,y]);
const features=[],records=[];let cursor=0;
await Promise.all(Array.from({length:6},async()=>{while(cursor<keys.length){const[x,y]=keys[cursor++],key=`14-${x}-${y}`,url=source.tiles[0].replace('{z}','14').replace('{x}',x).replace('{y}',y);const bytes=await download(url,`${root}/${key}.pbf`);const tile=new VectorTile(new Pbf(bytes)),water=tile.layers.water;
if(water)for(let i=0;i<water.length;i++){const f=water.feature(i);if(f.type===3)features.push(f.toGeoJSON(x,y,14));}
records.push({key,url,sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString(),access:'success'});
}}));
await writeFile(`${archive}/raw/basemap-water.geojson`,JSON.stringify({type:'FeatureCollection',features})+'\n');
await writeFile(`${root}/manifest.json`,JSON.stringify({bounds,sourceUrl:'https://tiles.openfreemap.org/planet',snapshot:source.tiles[0],records:records.sort((a,b)=>a.key.localeCompare(b.key))},null,2)+'\n');
console.log(JSON.stringify({tiles:records.length,waterPolygons:features.length,snapshot:source.tiles[0]}));
