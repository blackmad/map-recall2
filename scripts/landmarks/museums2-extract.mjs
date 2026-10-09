// node museums2-extract.mjs <id> <bagPandNumber e.g. 0363100012168755> <anchorLat> <anchorLng> [extraNeighbourPandIds,comma]
// Fetches 3DBAG LoD2.2 for the pand and writes scripts/landmarks/<id>-footprints.json
// in native metres: X east, Y up (above ground), Z south, origin at the anchor.
import fs from 'node:fs';import proj4 from 'proj4';import zlib from 'node:zlib';
const [id,pand,alat,alng]=process.argv.slice(2);const anchor=[Number(alng),Number(alat)];
const rd='+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';
const r=await fetch(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pand}`,{headers:{Accept:'application/city+json'}});
if(!r.ok)throw Error('3dbag '+r.status);const survey=await r.json();
const att=Object.entries(survey.feature.CityObjects).find(([k])=>k.endsWith(pand))[1].attributes;
const ground=att.b3_h_maaiveld,t=survey.metadata.transform;
const world=survey.feature.vertices.map(v=>v.map((p,i)=>p*t.scale[i]+t.translate[i]));
const mx=111320*Math.cos(anchor[1]*Math.PI/180),my=111320;
const local=ll=>[(ll[0]-anchor[0])*mx,(anchor[1]-ll[1])*my];
const conv=i=>{const p=world[i],ll=proj4(rd,'EPSG:4326',p.slice(0,2)),xz=local(ll);return[+xz[0].toFixed(3),+(p[2]-ground).toFixed(3),+xz[1].toFixed(3)]};
const roofs=[],walls=[],grounds=[];
for(const[oid,obj]of Object.entries(survey.feature.CityObjects)){const g=obj.geometry?.find(g=>g.lod==='2.2');if(!g)continue;
 const surfaces=g.semantics.surfaces,vals=g.semantics.values[0];
 g.boundaries[0].forEach((face,i)=>{const type=surfaces[vals[i]].type;const rings=face.map(ring=>ring.map(conv));
  (type==='RoofSurface'?roofs:type==='WallSurface'?walls:grounds).push({id:oid,rings});});}
// BAG footprint from the public building tile.
const z=14,n=2**z,tx=Math.floor((anchor[0]+180)/360*n),ty=Math.floor((1-Math.log(Math.tan(anchor[1]*Math.PI/180)+1/Math.cos(anchor[1]*Math.PI/180))/Math.PI)/2*n);
let tile=null;for(const dx of[-1,0,1])for(const dy of[-1,0,1]){const f=`public/data/extracts/amsterdam/building-tiles/14/${tx+dx}/${ty+dy}.geojson.gz`;if(!fs.existsSync(f))continue;
 for(const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(f))).features)if(ft.properties.id.endsWith(pand))tile=ft;}
const ringWGS=(tile.geometry.type==='Polygon'?tile.geometry.coordinates:tile.geometry.coordinates[0]);
const ring=ringWGS.map(rg=>rg.map(local).map(p=>p.map(v=>+v.toFixed(3))));
const out={id,anchor,groundNap:ground,coordinateConvention:'X east, Y above ground, Z south, metres from anchor (native runtime)',bagId:pand,bagAttributes:att,tileProperties:tile.properties,ringWGS84:ringWGS,ring,roofs,walls,grounds};
fs.writeFileSync(`scripts/landmarks/${id}-footprints.json`,JSON.stringify(out));
const hs=roofs.flatMap(r=>r.rings.flat().map(p=>p[1]));
console.log(JSON.stringify({id,ground,ringPts:ring[0].length,roofFaces:roofs.length,wallFaces:walls.length,roofMin:Math.min(...hs),roofMax:Math.max(...hs),dak:att.b3_dak_type,nok:att.b3_h_nok,eave:att.b3_h_dak_50p,year:att.oorspronkelijkbouwjaar,layers:att.b3_bouwlagen}));
