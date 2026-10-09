// node museums2-pano.mjs <lat> <lng> <out.jpg> [radius=35] [fov=80] [index=0] [headingOverride]
// Picks the nearest Amsterdam panorama to the point, aims the perspective thumbnail at the point.
import fs from 'node:fs';
const [lat,lng,out,radius='35',fov='80',index='0',override]=process.argv.slice(2);
const list=await (await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&srid=4326&radius=${radius}&page_size=30&newest_in_range=true`)).json();
const items=(list._embedded?.panoramas??[]).map(p=>{const[plng,plat]=p.geometry.coordinates;const dx=(lng-plng)*111320*Math.cos(lat*Math.PI/180),dy=(lat-plat)*111320;return{id:p.pano_id,d:Math.hypot(dx,dy),bearing:(Math.atan2(dx,dy)*180/Math.PI+360)%360,year:p.mission_year}}).sort((a,b)=>a.d-b.d);
console.log(JSON.stringify(items.slice(0,6)));
const pick=items[Number(index)];if(!pick)throw Error('no pano');
const heading=override??pick.bearing.toFixed(0);
const url=`https://api.data.amsterdam.nl/panorama/thumbnail/${pick.id}/?width=1200&fov=${fov}&heading=${heading}`;
const r=await fetch(url);if(!r.ok)throw Error(r.status+' '+url);
fs.writeFileSync(out,Buffer.from(await r.arrayBuffer()));console.log('wrote',out,pick.id,pick.year,'heading',heading,'dist',pick.d.toFixed(1));
