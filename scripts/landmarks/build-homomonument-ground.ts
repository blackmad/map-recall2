/** Derive only the surveyed paved quay; never cover the monument's waterward tip. */
import fs from 'node:fs';
import {simplifyPublicRealmRing} from '../../src/canalRecall/cityAppearancePublicRealm';
const dir=process.argv[2]??'artifacts/homomonument-ground-source';
const raw=JSON.parse(fs.readFileSync(`${dir}/bgt-wegdeel.json`,'utf8'));
const source=raw.features.find((f:any)=>f.properties.lokaal_id==='G0363.eb965d61629d424c934f94b634ebf74f'&&!f.properties.eind_registratie&&!f.properties.termination_date);
if(!source||source.properties.functie!=='voetpad'||source.properties.fysiek_voorkomen!=='open verharding')throw Error('Current surveyed paved quay unavailable');
const anchor=[4.8846925,52.37443243333333],sx=111320*Math.cos(anchor[1]*Math.PI/180),sy=111320;
const coordinates=source.geometry.coordinates.map((ring:number[][])=>simplifyPublicRealmRing(ring.map(([lng,lat])=>[(lng-anchor[0])*sx,(lat-anchor[1])*sy]),.08).map(([x,y])=>[anchor[0]+x/sx,anchor[1]+y/sy]));
const result={type:'FeatureCollection',attribution:'BGT © Kadaster / Gemeente Amsterdam, CC0 1.0',sourceUrl:'https://api.pdok.nl/lv/bgt/ogc/v1/collections/wegdeel/items?bbox=4.8841,52.3740,4.8854,52.3749&limit=1000&f=json',retrievedAt:'2026-10-08',simplificationToleranceM:.08,features:[{type:'Feature',id:'bgt-homomonument-quay',geometry:{type:'Polygon',coordinates},properties:{role:'paved-area',park:'Westermarkt',surface:'open verharding',sourceBgtId:source.properties.lokaal_id,sourceBgtVersion:source.properties.version}}]};
fs.writeFileSync('public/data/extracts/amsterdam/homomonument-ground.geojson',JSON.stringify(result));
console.log(JSON.stringify({sourceVertices:source.geometry.coordinates.flat().length,publishedVertices:coordinates.flat().length,bytes:JSON.stringify(result).length}));
