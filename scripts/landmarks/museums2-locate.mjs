// Lists building-tile features near a point (public extract; BAG ids, heights, roof info).
import fs from 'node:fs';import zlib from 'node:zlib';
const [lat,lng,rad=40]=process.argv.slice(2).map(Number);
const z=14,n=2**z,x=Math.floor((lng+180)/360*n),y=Math.floor((1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*n);
const mx=111320*Math.cos(lat*Math.PI/180),my=111320;
const out=[];
for(const dx of[-1,0,1])for(const dy of[-1,0,1]){const f=`public/data/extracts/amsterdam/building-tiles/14/${x+dx}/${y+dy}.geojson.gz`;if(!fs.existsSync(f))continue;
 for(const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(f))).features){const ring=(ft.geometry.type==='Polygon'?ft.geometry.coordinates:ft.geometry.coordinates[0])[0];
  const loc=ring.map(p=>[(p[0]-lng)*mx,-(p[1]-lat)*my]);const d=Math.min(...loc.map(p=>Math.hypot(...p)));
  let inside=false;for(let i=0,j=loc.length-1;i<loc.length;j=i++){const[a,b]=loc[i],[c,e]=loc[j];if((b>0)!==(e>0)&&0<(c-a)*(0-b)/(e-b)+a)inside=!inside}
  if(inside||d<rad)out.push({id:ft.properties.id,inside,d:+d.toFixed(1),props:ft.properties,ring,loc:loc.map(p=>p.map(v=>+v.toFixed(2)))});}}
out.sort((a,b)=>(b.inside-a.inside)||a.d-b.d);
for(const o of out.slice(0,Number(process.env.N||12)))console.log(JSON.stringify({id:o.id,inside:o.inside,d:o.d,props:o.props,n:o.loc.length,loc:o.inside?o.loc:undefined}));
