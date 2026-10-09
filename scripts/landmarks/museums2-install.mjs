// node museums2-install.mjs <id>   — writes <id>-spec.json and (idempotently) appends the spec to
// manualCatalogue.json and the POI card to manual-poi-data.json. Config lives in CONFIG below.
import fs from 'node:fs';
const CONFIG={
 'torture-museum':{name:'Torture Museum',landmarkId:'extract_landmarks_417591223',suppress:['NL.IMBAG.Pand.0363100012175875'],
  sourceUrl:'https://en.wikipedia.org/wiki/Torture_Museum,_Amsterdam',
  mods:'Original texture-free model on the BAG footprint (3DBAG LoD2.2 roof faces): dark steel-and-glass shopfront, three brick storeys with white-framed windows, stone cornice and blade sign. Window positions approximate, measured from a 2025 street-level panorama. No imported mesh or photo textures.',
  colours:{brick:'#6c5a50',stone:'#8f8b84',slate:'#5a5a5e',white:'#e6e4da',glass:'#5f7581',dark:'#23272b',red:'#9b2f27'}},
 'theo-thijssen-museum':{name:'Theo Thijssen Museum',landmarkId:'extract_landmarks_1824871810',suppress:['NL.IMBAG.Pand.0363100012168755'],
  sourceUrl:'https://nl.wikipedia.org/wiki/Theo_Thijssen_Museum',
  mods:'Original texture-free model on the BAG footprint (3DBAG LoD2.2 roof faces): brick corner house with bowed ground-floor shop window, cream cornice, white-framed upper windows and the birth plaque. Dimensions approximate, measured from a 2025 street-level panorama. No imported mesh or photo textures.',
  colours:{brick:'#7a5b4d',stone:'#cfc6ae',slate:'#5d5a58',white:'#ebe8dc',glass:'#5c717a',dark:'#1f2326',frame:'#e8e2cf'}},
 'pathe-de-munt':{name:'Pathé de Munt',landmarkId:'extract_landmarks_257271103',suppress:['NL.IMBAG.Pand.0363100012179384'],
  sourceUrl:'https://nl.wikipedia.org/wiki/Path%C3%A9_de_Munt',
  mods:'Original texture-free model on the BAG footprint (3DBAG LoD2.2 roof faces): grey-brick multiplex with notched pitched volumes, glazed slits, lower entrance bays and the vertical Pathé sign. Dimensions approximate, measured from 2025 panoramas. No imported mesh or photo textures.',
  colours:{brick:'#807a74',greyBrick:'#7a7570',stone:'#a9a69f',slate:'#6a6865',white:'#e7e5dd',glass:'#667c86',dark:'#25292c',gold:'#e0b030'}},
 'houseboat-museum':{name:'Houseboat Museum (Hendrika Maria)',landmarkId:'extract_landmarks_941219842',suppress:['w174999382'],
  sourceUrl:'https://en.wikipedia.org/wiki/Woonbootmuseum',
  mods:'Original texture-free barge model: black steel hull with cream waterline band, cream cabin with portholes, dark hatch roof and mast. Proportions approximate, from a 2021 street-level panorama. No imported mesh or photo textures.',
  colours:{dark:'#1d2124',white:'#e4e1d3',stone:'#8a8f90',glass:'#5b707a',slate:'#4a3d36',brick:'#8b5e48',red:'#8d3b2a',green:'#c7c78a'}},
};
const id=process.argv[2],c=CONFIG[id];if(!c)throw Error('unknown '+id);
const fp=JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`));
const anchor=fp.anchor,mx=111320*Math.cos(anchor[1]*Math.PI/180);
const pts=fp.ring[0];let best=null;
for(let deg=0;deg<180;deg+=.5){const a=deg*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;for(const[x,z]of pts){const u=x*cs+z*sn,v=-x*sn+z*cs;u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v)}const area=(u1-u0)*(v1-v0);if(!best||area<best.area)best={area,deg,len:u1-u0,wid:v1-v0}}
let length=Math.max(best.len,best.wid),width=Math.min(best.len,best.wid),axis=best.len>=best.wid?best.deg:best.deg+90;
// axis angle is measured in (east,south) plane from east toward south => compass bearing = 90 + axis
const heading=((90+axis)%360+360)%180;
const spec={id,name:c.name,landmarkId:c.landmarkId,modelUrl:`./models/${id}.glb`,suppressOsmIds:c.suppress,spatialSuppression:false,
 footprint:{centre:anchor,headingDegrees:+heading.toFixed(3),lengthMetres:+length.toFixed(2),widthMetres:+width.toFixed(2)},
 surveyed:{anchor,northOffsetDegrees:0,source:`BAG pand ${fp.bagId} with 3DBAG LoD2.2 roofs; native east/south metres, scale 1.`},
 groundAltitudeMetres:0,facingOffsetDegrees:0,materialOverrides:c.colours,
 attribution:{title:c.name,author:'Map Recall',sourceUrl:c.sourceUrl,licence:'Original project asset',licenceUrl:'./LICENSE',modifications:c.mods}};
if(fp.ringWGS84)spec.buildingFootprint={type:'Polygon',coordinates:fp.ringWGS84};
fs.writeFileSync(`scripts/landmarks/${id}-spec.json`,JSON.stringify(spec,null,2)+'\n');
// Append-only text edits keep the large shared JSON files diff-minimal. Re-running replaces
// this id's entry in place (it is always the last or an indented block we wrote).
const indent=(v)=>JSON.stringify(v,null,2).split('\n').map(l=>'  '+l).join('\n');
function upsert(path,key,id,entry){
 let text=fs.readFileSync(path,'utf8');const arr=JSON.parse(text);const at=arr.findIndex(s=>s[key]===id);
 if(at>=0){// replace the block we previously appended (must be a 2-space-indented object at the end)
  const marker=`,\n  {\n    "${key}": "${id}"`;const i=text.lastIndexOf(marker);if(i<0)throw Error('existing entry not appended by this script: '+id);
  const j=text.indexOf('\n  }',i+marker.length);text=text.slice(0,i)+','+'\n'+indent(entry)+text.slice(j+4);
 }else{const end=text.lastIndexOf(']');text=text.slice(0,end).replace(/\s*$/,'')+',\n'+indent(entry)+'\n]\n'}
 JSON.parse(text);fs.writeFileSync(path,text);return at>=0?'updated':'appended';
}
const poi=JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-poi.json`));
console.log(JSON.stringify(spec.footprint),upsert('src/canalRecall/landmarks/manualCatalogue.json','id',id,spec),upsert('src/canalRecall/game/manual-poi-data.json','modelId',id,poi));
