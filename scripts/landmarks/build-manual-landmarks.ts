/** Original, texture-free landmark meshes. Run: npx tsx scripts/landmarks/build-manual-landmarks.ts
 * Flat palette shared with landmarkKits.ts; metres, glTF Y-up, facade toward +Z.
 * Reference photographs guide silhouette only; no downloaded meshes or pixels.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {Document, NodeIO} from '@gltf-transform/core';
import {dedup, prune, weld, meshopt} from '@gltf-transform/functions';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptEncoder} from 'meshoptimizer';
await MeshoptEncoder.ready;
import {buildCulturalLandmark} from './cultural-builders';
import {buildSilodam} from './silodam-builder';
import {buildVenueLandmark} from './venue-builders';
import {buildTheaterLandmark} from './theater-builders';
import {buildHouseMuseumLandmark} from './house-museum-builders';
import {buildCivicLandmark} from './civic-builders';
import {buildAmsterdamSchoolLandmark} from './amsterdam-school-builders';
import {buildRetailCinemaLandmark} from './retail-cinema-builders';
import {buildIndustrialTheaterLandmark} from './industrial-theater-builders';
import {buildCinemaPalaceLandmark} from './cinema-palace-builders';
import {buildHistoricChurchLandmark} from './historic-church-builders';
import {buildSecondaryChurchLandmark} from './secondary-church-builders';
import {buildHallenHouseLandmark} from './hallen-house-builders';
import {buildHistoricMuseumLandmark} from './historic-museum-builders';
import {buildPlantageMuseumLandmark} from './plantage-museum-builders';
import {buildJewishQuarterLandmark} from './jewish-quarter-builders';
import {buildMemorialLandmark} from './memorial-builders';
import {buildArtisEntryLandmark} from './artis-entry-builders';
import {buildHortusLandmark} from './hortus-builders';
import {buildArcam} from './arcam-builder';
import {buildAgnietenkapel} from './agnieten-builder';
import {buildIndependentCinemaLandmark} from './independent-cinemas-builders';
import {buildEasternBankMuseumLandmark} from './eastern-bank-museum-builders';
import {buildNesRozentheaterLandmark} from './nes-rozentheater-builders';
import {buildCanalMuseumLandmark} from './canal-museum-builders';
import hospitals from './hospital-footprints.json';
import {MANUAL_LANDMARKS} from '../../src/canalRecall/landmarks/manualModels';
import {placementFor, scaledExtent} from '../../src/canalRecall/landmarks/signaturePlacement';
const out=path.resolve('public/canal-drive/models');
const palette={brick:'#9a5240',stone:'#cfc2a6',slate:'#4a525d',white:'#efe9db',gold:'#d9b24c',glass:'#527787',dark:'#303b43',frame:'#9daaa8',red:'#ac624e',blue:'#3f5f9a',pink:'#be9295'};
type Colour=keyof typeof palette;
let parts: {g:T.BufferGeometry,c:Colour}[]=[];
function add(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,angle=0){g.rotateY(angle);g.translate(x,y,z);parts.push({g,c});}
function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,angle=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,angle);}
function prism(x:number,y:number,z:number,w:number,d:number,h:number,c:Colour){let shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,h);shape.closePath();add(new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1}),c,x,y,z-d/2);}
function gableRoof(x:number,y:number,z:number,w:number,d:number,h:number,c:Colour){
 const vertices=[[-w/2,0,-d/2],[w/2,0,-d/2],[-w/2,0,d/2],[w/2,0,d/2],[-w/2,h,0],[w/2,h,0]];
 const faces=[0,4,5,0,5,1,2,3,5,2,5,4,0,2,4,1,5,3,0,1,3,0,3,2];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(faces.flatMap(i=>vertices[i]),3));g.computeVertexNormals();add(g,c,x,y,z);
}
function hip(x:number,y:number,z:number,w:number,d:number,h:number,c:Colour){let g=new T.BufferGeometry();let p=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[0,h,0]];g.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4,0,3,2,0,2,1].flatMap(i=>p[i]),3));g.computeVertexNormals();add(g,c,x,y,z);}
function arch(x:number,y:number,z:number,w:number,h:number,c:Colour){let s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.lineTo(-w/2,0);add(new T.ExtrudeGeometry(s,{depth:.15,bevelEnabled:false,curveSegments:5}),c,x,y,z);}
function window(x:number,y:number,z:number,w:number,h:number){arch(x,y-.18,z,w+.45,h+.4,'stone');arch(x,y,z+.17,w,h,'dark');box(x,y+.2,z+.36,.13,h-.35,.12,'stone');box(x,y+h*.56,z+.36,w,.14,.12,'stone');box(x,y-.25,z,w+.7,.22,.65,'stone');}
function clock(x:number,y:number,z:number,wind=false){add(new T.CylinderGeometry(2.55,2.55,.2,16).rotateX(Math.PI/2),'gold',x,y,z);add(new T.CylinderGeometry(2.2,2.2,.23,16).rotateX(Math.PI/2),'white',x,y,z+.13);for(let i=0;i<12;i++){let a=i*Math.PI/6;box(x+1.9*Math.sin(a),y+1.9*Math.cos(a)-.13,z+.31,.14,.3,.08,'dark',-a);}box(x,y-.12,z+.4,.2,1.65,.1,'dark');box(x+.5,y-.13,z+.41,1.25,.2,.1,'dark');if(wind)box(x,y-2.3,z+.46,4.8,.12,.12,'gold');}
const letters:Record<string,string[]>={A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['111','010','010','010','010','010','111'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','11011','10001']};
Object.assign(letters,{
 F:['11111','10000','10000','11110','10000','10000','10000'],J:['00111','00010','00010','00010','10010','10010','01100'],
 K:['10001','10010','10100','11000','10100','10010','10001'],P:['11110','10001','10001','11110','10000','10000','10000'],
 Q:['01110','10001','10001','10001','10101','10010','01101'],X:['10001','10001','01010','00100','01010','10001','10001'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
 '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
});
function sign(text:string,x:number,y:number,z:number,pixel:number,c:Colour='white'){let width=[...text].reduce((n,ch)=>n+(letters[ch]?.[0].length??3)+1,0)*pixel;let u=-width/2;for(let ch of text){let rows=letters[ch];if(rows)for(let j=0;j<7;j++)for(let k=0;k<rows[j].length;k++)if(rows[j][k]==='1')box(x+u+k*pixel,y+(6-j)*pixel,z,pixel*.85,pixel*.85,.08,c);u+=((rows?.[0].length??3)+1)*pixel;}}
function station(){box(0,0,0,244,1,31,'stone');box(0,1,0,244,15.7,29,'brick');gableRoof(0,16.7,0,244,29,6.3,'slate');for(let z of [-14.65,14.65]){for(let y of [1,6.6,12.5,16])box(0,y,z,244,.4,.6,'stone');for(let x=-117;x<=117;x+=5.85){for(let y of [1.9,8.1])window(x,y,z>0?14.72:-15.1,2.5,y<3?3.7:3.4);box(x-2.8,1,z,.5,15.7,.65,'stone');}}
 // Central entrance pavilion, paired clock / wind-dial towers, steep roof and crest.
 box(0,1,14,33,19,5,'brick');prism(0,20,14,33,8,11,'brick');prism(0,20.7,14.1,29,8.3,9.5,'stone');prism(0,21.3,14.25,26,8.6,8,'brick');for(let x of [-10,0,10])window(x,1.5,16.6,5.5,7);for(let x of [-9,-3,3,9])window(x,11.3,16.6,3.7,5.4);box(0,19,16.8,31,.8,.8,'stone');box(0,27.5,18.75,3,2,.4,'gold');
 for(let x of [-23,23]){box(x,0,11,10,26,10,'brick');for(let y of [6.6,17,23.5,25.8])box(x,y,11,10.7,.55,10.7,'stone');window(x,8.5,16.1,3.2,6.2);clock(x,21,16.35,x<0);hip(x,26.5,11,11,11,8,'slate');box(x,34.5,11,.2,2,.2,'gold');for(let dx of [-4.6,4.6]){box(x+dx,24,15.7,.9,4,.9,'brick');hip(x+dx,28,15.7,1.4,1.4,2.8,'slate');}}
 for(let x of [-105,-63,63,105]){box(x,1,0,14,17,31,'brick');prism(x,18,0,14,31,8,'slate');prism(x,18,15.6,14,.8,8,'brick');prism(x,18.4,16.05,12,.4,6.8,'stone');prism(x,18.9,16.32,10,.25,5.3,'brick');window(x,19.4,16.6,2.3,3.1);for(let dx of [-6.3,6.3]){box(x+dx,18,15.9,.65,6,.7,'stone');hip(x+dx,24,15.9,1,1,2,'slate');}}
 sign('AMSTERDAM CENTRAAL',0,9.4,17.05,.22,'stone');
 for(let x of [-120,120]){box(x,1,0,8,22,31,'brick');hip(x,23,0,9,32,8,'slate');}
}
function music(){box(0,0,0,70,1.1,43,'stone');box(0,1.1,0,66,18.7,40,'glass');box(8,1.1,-3,35,17.5,28,'white'); // auditorium visible through foyer
 for(let x=-32;x<=32;x+=4){box(x,1.1,20.2,.19,18.7,.3,'frame');box(x,1.1,-20.2,.19,18.7,.3,'frame');}for(let z=-18;z<=18;z+=4){for(let x of [-33.2,33.2])box(x,1.1,z,.3,18.7,.19,'frame');}for(let y of [6,11,16]){box(0,y,20.25,66,.2,.3,'frame');box(0,y,-20.25,66,.2,.3,'frame');for(let x of [-33.25,33.25])box(x,y,0,.3,.2,40,'frame');}
 box(0,20,0,77,1.5,48,'slate');box(0,19.7,0,77,.35,48,'white');box(-13,4,21,21,1,7,'red'); // foyer connector
 // Black Bimhuis box projecting towards the city, with an open undercroft.
 box(-18,8.5,29,29,10.5,25,'dark');box(-18,8.3,29,30,.4,26,'slate');box(-18,19,29,30,.55,26,'slate');box(-18,10,41.6,26,6.8,.22,'glass');for(let x=-30;x<=-6;x+=4)box(x,10,41.8,.18,6.8,.25,'frame');for(let x of [-28,-8])box(x,1.1,28,1.1,7.2,1.1,'stone');
 sign('BIMHUIS',-18,17.2,41.9,.19);
 for(let i=0;i<7;i++)box(22,0,23+i*.9,22,(7-i)*.28,.95,'stone');box(25,1.2,23,13,.3,7,'slate');
}
function hospital(id:string){let s=hospitals.sites.find(s=>s.id===id)!;let spec=MANUAL_LANDMARKS.find(s=>s.id===id)!;let anchor=spec.surveyed!.anchor;let west=id==='olvg-west';let lon=111320*Math.cos(anchor[1]*Math.PI/180);let coord=(p:number[])=>new T.Vector2((p[0]-anchor[0])*lon,-(p[1]-anchor[1])*110540);
 for(let f of s.buildings){if(f.properties.building==='construction')continue;let main=f.properties.building==='hospital'||f.id==='w44451612';let height=Number(f.properties.height)|| (main?(west?9.5:19):4);for(let poly of f.geometry.coordinates){let shape=new T.Shape(poly[0].slice(0,-1).map(coord));shape.holes=poly.slice(1).map(r=>new T.Path(r.slice(0,-1).map(coord)));let g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,height,0);add(g,west?'white':'brick'); // shape Y becomes world Z, extrusion becomes vertical
 let roof=new T.ShapeGeometry(shape);roof.rotateX(Math.PI/2);roof.translate(0,height+.04,0);add(roof,'slate');
 for(let ring of poly){let r=ring.map(coord);for(let i=0;i<r.length-1;i++){let a=r[i],b=r[i+1],dx=b.x-a.x,dz=b.y-a.y,L=Math.hypot(dx,dz);if(L<3)continue;let angle=-Math.atan2(dz,dx);for(let y=2;y<height-1;y+=3.3){for(let u=1.7;u<L-1;u+=3.6){box(a.x+u*dx/L,y,a.y+u*dz/L,2.1,1.5,.24,west?'blue':'glass',angle);}}}}}}
 if(west){sign('OLVG WEST',66,6,46,.22,'blue'); // High ward wings around the rear courtyard; lower fingers retained from OSM outline.
 let angle=15*Math.PI/180;for(let [x,z,w,d] of [[68,6,17,48],[35,-15,53,15],[52,28,44,14]]){box(x,9.5,z,w,23,d,'white',angle);box(x,32.5,z,w+1,.45,d+1,'slate',angle);for(let y=11;y<31;y+=3.2)for(let u=-w/2+2;u<w/2-1;u+=3.3){let xx=x+u*Math.cos(angle),zz=z-u*Math.sin(angle);for(let side of [-1,1])box(xx+side*d/2*Math.sin(angle),y,zz+side*d/2*Math.cos(angle),1.8,1.45,.25,'blue',angle);}}
 }else{ // Oosterpark entrance: tall glazed hall framed by pale concrete columns.
 let p=coord([4.91615,52.35875]);sign('OLVG',p.x+18,9,p.y+6,.25,'blue');let angle=-24*Math.PI/180;box(p.x,0,p.y,33,12,8,'glass',angle);for(let u=-15;u<=15;u+=5)box(p.x+u*Math.cos(angle),0,p.y-u*Math.sin(angle),.9,13,8.5,'stone',angle);box(p.x,12.7,p.y,34,.6,9,'stone',angle);}
}
async function save(id:string){let doc=new Document();let buffer=doc.createBuffer();let scene=doc.createScene(id);doc.getRoot().setDefaultScene(scene);let mesh=doc.createMesh(id);let all:number[]=[];for(let c of Object.keys(palette) as Colour[]){let geos=parts.filter(p=>p.c===c).map(p=>p.g.index?p.g.toNonIndexed():p.g);if(!geos.length)continue;let positions=Float32Array.from(geos.flatMap(g=>Array.from(g.getAttribute('position').array)));let normals=Float32Array.from(geos.flatMap(g=>Array.from(g.getAttribute('normal').array)));for (const value of positions) all.push(value);let rgb=new T.Color(palette[c]);let material=doc.createMaterial(c).setBaseColorFactor([rgb.r,rgb.g,rgb.b,1]).setMetallicFactor(0).setRoughnessFactor(.9).setDoubleSided(true);mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer)).setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer)).setMaterial(material));}scene.addChild(doc.createNode(id).setMesh(mesh));await doc.transform(weld(),dedup(),prune());let dest=path.join(out,`${id}.glb`);await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder}).write(dest,doc);let bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(let i=0;i<all.length;i++) {let a=i%3;bounds.min[a]=Math.min(bounds.min[a],all[i]);bounds.max[a]=Math.max(bounds.max[a],all[i]);}let spec=MANUAL_LANDMARKS.find(s=>s.id===id)!;let placement=placementFor(spec,bounds as any);let triangles=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION')!.getCount())/3,0);console.log(id,triangles,fs.statSync(dest).size,bounds);return {...spec,bounds,placement,extent:spec.footprint?scaledExtent(bounds as any,1,spec.footprint):null,triangles,bytes:fs.statSync(dest).size,generatedBy:'scripts/landmarks/build-manual-landmarks.ts'};}
const manifest=JSON.parse(fs.readFileSync(path.join(out,'signature-landmarks.json'),'utf8'));
const helpers={add,box,prism,gableRoof,hip,window,clock,sign};
const venueIds=new Set(['embassy-free-mind','the-movies','delamar','magna-plaza']);
const theaterIds=new Set(['felix-meritis','kleine-komedie','de-balie']);
const houseMuseumIds=new Set(['anne-frank-house','rembrandt-house','moco-museum','museum-van-loon']);
const civicIds=new Set(['amstelkerk','he-hua-temple','haarlemmerpoort']);
const amsterdamSchoolIds=new Set(['het-schip','scheepvaarthuis']);
const retailCinemaIds=new Set(['rialto','kriterion','de-bijenkorf']);
const industrialTheaterIds=new Set(['gashouder','stadsschouwburg']);
const cinemaPalaceIds=new Set(['tuschinski','pathe-city']);
const historicChurchIds=new Set(['oude-kerk','nieuwe-kerk']);
const secondaryChurchIds=new Set(['buiksloterkerk','english-reformed-church','de-papegaai']);
const hallenHouseIds=new Set(['de-hallen','huis-bartolotti']);
const historicMuseumIds=new Set(['hart-museum','amsterdam-museum']);
const plantageMuseumIds=new Set(['national-holocaust-museum','hollandsche-schouwburg']);
const jewishQuarterIds=new Set(['jewish-museum','portuguese-synagogue']);
for(const spec of MANUAL_LANDMARKS){
  const id=spec.id;
  if(process.argv.includes('--only')&&!process.argv.includes(id))continue;
  parts=[];
  if(id==='centraal-station')station();
  else if(id==='muziekgebouw-bimhuis')music();
  else if(id.startsWith('olvg-'))hospital(id);
  else {
    const w=spec.footprint!.lengthMetres,d=spec.footprint!.widthMetres;
    if(id==='silodam')buildSilodam(w,d,helpers);
    else if(venueIds.has(id))buildVenueLandmark(id,w,d,helpers);
    else if(theaterIds.has(id))buildTheaterLandmark(id,w,d,helpers);
    else if(houseMuseumIds.has(id))buildHouseMuseumLandmark(id,w,d,helpers);
    else if(civicIds.has(id))buildCivicLandmark(id,w,d,helpers);
    else if(amsterdamSchoolIds.has(id))buildAmsterdamSchoolLandmark(id,w,d,helpers);
    else if(retailCinemaIds.has(id))buildRetailCinemaLandmark(id,w,d,helpers);
    else if(industrialTheaterIds.has(id))buildIndustrialTheaterLandmark(id,w,d,helpers);
    else if(cinemaPalaceIds.has(id))buildCinemaPalaceLandmark(id,w,d,helpers);
    else if(historicChurchIds.has(id))buildHistoricChurchLandmark(id,w,d,helpers);
    else if(secondaryChurchIds.has(id))buildSecondaryChurchLandmark(id,w,d,helpers);
    else if(hallenHouseIds.has(id))buildHallenHouseLandmark(id,w,d,helpers);
    else if(historicMuseumIds.has(id))buildHistoricMuseumLandmark(id,w,d,helpers);
    else if(plantageMuseumIds.has(id))buildPlantageMuseumLandmark(id,w,d,helpers);
    else if(jewishQuarterIds.has(id))buildJewishQuarterLandmark(id,w,d,helpers);
    else if(id==='homomonument')buildMemorialLandmark(id,w,d,helpers);
    else if(id==='micropia-ledenlokalen'||id==='artis-entrance')buildArtisEntryLandmark(id,w,d,helpers);
    else if(id==='hortus-greenhouses')buildHortusLandmark(id,w,d,helpers);
    else if(id==='arcam')buildArcam(w,d,helpers);
    else if(id==='agnietenkapel')buildAgnietenkapel(w,d,helpers);
    else if(['lab111','occii','ketelhuis'].includes(id))buildIndependentCinemaLandmark(id,w,d,helpers);
    else if(['wereldmuseum-amsterdam','dutch-resistance-museum','allard-pierson'].includes(id))buildEasternBankMuseumLandmark(id,w,d,helpers);
    else if(['brakke-grond','frascati','boom-chicago'].includes(id))buildNesRozentheaterLandmark(id,w,d,helpers);
    else if(['foam','huis-marseille','ons-lieve-heer-op-solder'].includes(id))buildCanalMuseumLandmark(id,w,d,helpers);
    else buildCulturalLandmark(id,w,d,helpers);
  }
  manifest.models[id]=await save(id);
}
fs.writeFileSync(path.join(out,'signature-landmarks.json'),JSON.stringify(manifest,null,2)+'\n');
