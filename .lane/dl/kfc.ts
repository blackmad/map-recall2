import fs from 'node:fs'; import zlib from 'node:zlib';
import { bayLookFor } from '../../src/canalRecall/bayLook.ts';
import { buurtProfileAt } from '../../src/canalRecall/buurtProfiles/data.ts';
import { hexToOklab } from '../../src/canalRecall/houseSpec/wallColour.ts';
import { resetRealLook } from '../../src/canalRecall/look/realLook.ts';
const id='NL.IMBAG.Pand.0363100012142699';
const lng=4.9275, lat=52.3628, n=2**14, x=Math.floor((lng+180)/360*n), y=Math.floor((1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*n);
const g=JSON.parse(zlib.gunzipSync(fs.readFileSync(`public/data/extracts/amsterdam/building-tiles/14/${x}/${y}.geojson.gz`)).toString());
const f=g.features.find((f:any)=>f.properties.id===id); const ring=f.geometry.type==='Polygon'?f.geometry.coordinates[0]:f.geometry.coordinates[0][0];
const c=[ring.reduce((s:number,p:number[])=>s+p[0],0)/ring.length, ring.reduce((s:number,p:number[])=>s+p[1],0)/ring.length] as const;
console.log('props',JSON.stringify(f.properties).slice(0,400),'centroid',c);
const prof=buurtProfileAt(c[0],c[1]); console.log('profile',prof?.code, JSON.stringify(prof?.eras?.c19?.walls)?.slice(0,300), 'painted',prof?.eras?.c19?.paintedShare);
for (const m of ['0','walls']) { (globalThis as any).__canalRecallRealLook=m; resetRealLook(); const b=bayLookFor(id,1881,f.properties.height??14,'photo','quiet',undefined,undefined,prof,undefined,undefined,c); console.log(m,b.wallHex,hexToOklab(b.wallHex)[0].toFixed(3),b.profileWall,(b as any).painted); }
