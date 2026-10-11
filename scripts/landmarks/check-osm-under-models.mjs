// Fails when an OSM building way's centroid lies inside a placed manual model's footprint (nativeRing) but is not in its suppressOsmIds: the extrusion would draw through the model (Piet Hein / Bercylaan, 2026-10-11). Held models are skipped; models without a nativeRing footprint are not checked yet.
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const R=process.cwd(); const cat=JSON.parse(fs.readFileSync(R+'/src/canalRecall/landmarks/manualCatalogue.json'));
const T=R+'/public/data/extracts/amsterdam/building-tiles/14';
const tile=(lon,lat)=>{const n=2**14;const x=Math.floor((lon+180)/360*n);const r=lat*Math.PI/180;const y=Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n);return [x,y]};
const cache={};const feats=(x,y)=>{const k=x+'/'+y;if(cache[k])return cache[k];const f=`${T}/${x}/${y}.geojson.gz`;cache[k]=fs.existsSync(f)?JSON.parse(zlib.gunzipSync(fs.readFileSync(f))).features:[];return cache[k]};
const inPoly=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>p[1])!=(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))c=!c}return c};
const only=process.argv.slice(2); let bad=0, checked=0;
for(const e of cat){ if(only.length&&!only.includes(e.id))continue; if(e.status==='held')continue;
  const fp=`${R}/scripts/landmarks/${e.id}-footprints.json`; if(!fs.existsSync(fp))continue;
  const F=JSON.parse(fs.readFileSync(fp)); if(!F.nativeRing||!F.anchor)continue; checked++;
  const [lon0,lat0]=F.anchor; const mx=111320*Math.cos(lat0*Math.PI/180), my=110574;
  const ring=F.nativeRing.map(([e_,s])=>[lon0+e_/mx,lat0-s/my]);
  const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
  const [x0,y1]=tile(Math.min(...xs),Math.min(...ys)),[x1,y0]=tile(Math.max(...xs),Math.max(...ys));
  const sup=new Set((e.suppressOsmIds||[]).map(String)); const hits=[];
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(const f of feats(x,y)){
    const id=String(f.id??f.properties?.id??f.properties?.osm_id??''); if(!id||sup.has(id))continue;
    const g=f.geometry; const r=g.type==='Polygon'?g.coordinates[0]:g.type==='MultiPolygon'?g.coordinates[0][0]:null; if(!r)continue;
    const c=[r.reduce((a,p)=>a+p[0],0)/r.length,r.reduce((a,p)=>a+p[1],0)/r.length];
    if(inPoly(c,ring)) hits.push(id+(f.properties?.height?`(${f.properties.height}m)`:''));
  }
  if(hits.length){bad++;console.log(e.id, (e.category||"landmark"), "unsuppressed:", [...new Set(hits)].join(" "))}
}
console.log(`OSM-under check: ${checked} models, ${bad} with unsuppressed OSM buildings`); process.exit(bad?1:0);
