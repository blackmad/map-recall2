// The trees' per-record shape cache (inventory-trees-source.js shapeOf, #129 hand-back 17) changes no instance:
// a rebuild draws the same matrices and colours as the source before the cache, on real tiles, across a ground
// base change, a repeated rebuild (cache warm) and the allotment-canopy switch.
//   node --import tsx scripts/check-tree-shape-cache.mjs [git-ref of the uncached source, default 0158e51b7]
import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import * as THREE from 'three';
globalThis.window={CanalRecallThree:{THREE}};globalThis.location??={href:'http://localhost/canal-drive/',search:''};
const ref=process.argv[2]||'0158e51b7';
const {InventoryTrees}=await import('../public/canal-drive/js/inventory-trees-source.js');
const root=pathToFileURL(process.cwd()+'/').href;
const oldSource=execFileSync('/usr/bin/git',['show',`${ref}:public/canal-drive/js/inventory-trees-source.js`],{encoding:'utf8'})
  .replace(/from '\.\.\/da-costa-block\//g,`from '${root}public/canal-drive/da-costa-block/`)
  .replace(/from '\.\/(allotment-canopy|rose-garden-data)\.js'/g,(_,f)=>`from '${root}public/canal-drive/js/${f}.js'`)
  .replace(/from '\.\.\/\.\.\/\.\.\/src\//g,`from '${root}src/`);
const tmp=`${process.cwd()}/artifacts/.tree-cache-old-${process.pid}.mjs`;fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(tmp,oldSource);
const OldTrees=(await import(pathToFileURL(tmp).href)).InventoryTrees;fs.unlinkSync(tmp);
const dir='public/data/extracts/amsterdam/municipal-trees/tiles',files=fs.readdirSync(dir).sort().slice(200,206);
const tiles=files.map(f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(`${dir}/${f}`)).toString()));
const all=tiles.flatMap(t=>t.trees),lngs=all.map(t=>t.lng),lats=all.map(t=>t.lat);
const bounds={getWest:()=>Math.min(...lngs),getEast:()=>Math.max(...lngs),getSouth:()=>Math.min(...lats),getNorth:()=>Math.max(...lats)};
const map={addLayer(){},on(){},off(){},triggerRepaint(){},getBounds:()=>bounds,getZoom:()=>17.5,getCenter:()=>({lng:lngs[0],lat:lats[0]})};
const projection={MercatorCoordinate:{fromLngLat:([lng,lat])=>{const x=(lng+180)/360,y=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2;return {x,y,z:0,meterInMercatorCoordinateUnits:()=>1/(40075016.686*Math.cos(lat*Math.PI/180))};}}};
const make=C=>{const t=new C(map,projection);tiles.forEach((tile,i)=>t.tiles.set(`t${i}`,tile.trees));return t;};
const a=make(OldTrees),b=make(InventoryTrees);
const dump=t=>t.meshes.map(m=>({n:m.count,mat:[...m.instanceMatrix.array],col:[...m.instanceColor.array]}));
let instances=0;
const steps=[['first build',()=>{}],['ground bases',t=>{t.groundBase=([lng,lat])=>Math.sin(lng*1e4)*2+Math.cos(lat*1e4);}],['warm rebuild',()=>{}],['allotment canopy on',t=>{t.allotmentCanopyEnabled=true;}],['allotment canopy off',t=>{t.allotmentCanopyEnabled=false;}]];
for(const [name,change] of steps){
  change(a);change(b);a.rebuild();b.rebuild();
  const da=dump(a),db=dump(b);
  assert.equal(db.length,da.length,`${name}: meshes`);
  for(let i=0;i<da.length;i++){assert.equal(db[i].n,da[i].n,`${name}: mesh ${i} count`);assert.deepEqual(db[i].mat,da[i].mat,`${name}: mesh ${i} matrices`);assert.deepEqual(db[i].col,da[i].col,`${name}: mesh ${i} colours`);}
  assert.equal(b.debugTrees,a.debugTrees);instances+=da.reduce((n,m)=>n+m.n,0);
}
const time=t=>{const s=performance.now();for(let i=0;i<5;i++)t.rebuild();return +((performance.now()-s)/5).toFixed(1);};
const msOld=time(a),msNew=time(b);
assert.ok(b.debugTrees>100,`a real neighbourhood (${b.debugTrees} trees)`);
console.log(JSON.stringify({rebuildMs:{uncached:msOld,cached:msNew},tiles:files.length,trees:b.debugTrees,instancesCompared:instances,steps:steps.map(s=>s[0])}));
