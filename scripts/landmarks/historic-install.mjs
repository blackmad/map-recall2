// node historic-install.mjs <id>   — writes <id>-spec.json and (idempotently) appends the spec to
// manualCatalogue.json and the POI card to manual-poi-data.json. Config lives in CONFIG below.
import fs from 'node:fs';
const CONFIG={
 'theater-bellevue':{name:'Theater Bellevue',landmarkId:'extract_landmarks_374802612',suppress:['NL.IMBAG.Pand.0363100012169852'],
  sourceUrl:'https://nl.wikipedia.org/wiki/Theater_Bellevue',
  mods:'Original texture-free model on the BAG footprint (3DBAG LoD2.2 roof faces): white-tiled ground floor with glazed doors, sweeping canopy and lettering around the Marnixstraat corner, cream upper floors and the mansarded east block. Openings approximate, from a 2025 street-level panorama. No imported mesh or photo textures.',
  colours:{brick:'#cfc8b3',stone:'#9a968b',slate:'#5b5e63',white:'#ebe8de',glass:'#4d616b',dark:'#24282b'}},
 'west-india-house':{name:"West India House",landmarkId:'extract_landmarks_1399359542',suppress:["NL.IMBAG.Pand.0363100012167535"],
  sourceUrl:'https://en.wikipedia.org/wiki/West-Indisch_Huis',
  mods:"Original texture-free model on the BAG footprint (3DBAG LoD2.2 roof faces): brown brick ranges around the open courtyard, white sash windows and the white pedimented doorcase on the Herenmarkt front. Openings approximate, from 2025 street-level panoramas. No imported mesh or photo textures.",
  colours:{"brick": "#7a5849", "stone": "#cfc9b8", "slate": "#585a5e", "white": "#ece9df", "glass": "#566872", "dark": "#1f2326"}},
 'compagnietheater':{name:"Compagnietheater",landmarkId:'extract_landmarks_1455669716',suppress:["NL.IMBAG.Pand.0363100012171200"],
  sourceUrl:'https://nl.wikipedia.org/wiki/Compagnietheater',
  mods:"Original texture-free model on the BAG footprint (3DBAG LoD2.2 roof faces): the long Hollands-Classicist church hall with a rusticated stone ground floor, tall arched upper windows and a slate roof. Openings approximate, from 2025 street-level panoramas. No imported mesh or photo textures.",
  colours:{"brick": "#b9a78a", "stone": "#d9d1b9", "slate": "#575a5f", "white": "#ece9df", "glass": "#566872", "dark": "#1f2326"}},
 'west-indian-warehouse':{name:"West Indian Warehouse",landmarkId:'extract_landmarks_76787173',suppress:["NL.IMBAG.Pand.0363100012170626"],
  sourceUrl:'https://nl.wikipedia.org/wiki/West-Indisch_Pakhuis',
  mods:"Original texture-free model on the BAG footprint (3DBAG LoD2.2 roof faces): brick warehouse with cream string courses, barred ground-floor openings, board doors and shuttered upper windows. Openings approximate, from 2025 street-level panoramas. No imported mesh or photo textures.",
  colours:{"brick": "#8a4f3d", "stone": "#cdbf9f", "slate": "#4f5256", "white": "#ebe7da", "glass": "#566872", "dark": "#23272a", "blue": "#7f93b3"}},
 'rijksakademie':{name:"Rijksakademie van beeldende kunsten",landmarkId:'extract_landmarks_373035281',suppress:["NL.IMBAG.Pand.0363100012165748"],
  sourceUrl:'https://en.wikipedia.org/wiki/Rijksakademie',
  mods:"Original texture-free model on the BAG footprint (3DBAG LoD2.2 roof faces): the former Kavallerie-Kazerne ring of ranges round its courtyard, brown brick with arched windows, a pedimented central gate bay and tiled hipped roofs. Openings approximate, from 2025 street-level panoramas. No imported mesh or photo textures.",
  colours:{"brick": "#7d5a46", "stone": "#cdc3a8", "slate": "#4a4d52", "white": "#e7e4d8", "glass": "#5b6f79", "dark": "#1f2326"}},
 'royal-tropical-institute':{name:"Royal Tropical Institute (KIT)",landmarkId:'extract_landmarks_1447049474',suppress:["NL.IMBAG.Pand.0363100012237251", "w750932737", "w750932738", "w750932739", "w750932740", "w750932745", "w750932746", "w750932748", "w750932755", "w750939953", "w750939954", "w750939955", "w750939956", "w750939957", "w750939958", "w750939959", "w750940954", "w751004889", "w751004890", "w751004891", "w751004892", "w751004893", "w751004894", "w751004897", "w751004895", "w751004896", "w750932741", "w750932742", "w750932743", "w750932744", "w750932747", "w750932749", "w750932750", "w750932751", "w750932752", "w750932753", "w750932754", "w750932756", "w750932757"],
  sourceUrl:'https://en.wikipedia.org/wiki/Royal_Tropical_Institute',
  mods:"Original texture-free model on the BAG footprint (3DBAG LoD2.2 roof faces): the 1926 neo-Renaissance complex as surveyed massing, brick walls with stone-framed window bays and slate roofs. Detailing is generic rather than a reproduction of the facades. Openings approximate, from 2025 street-level panoramas. No imported mesh or photo textures.",
  colours:{"brick": "#7f4b3a", "stone": "#cbbfa4", "slate": "#5b5f66", "white": "#e7e4d8", "glass": "#566872", "dark": "#1f2326"}},
};
// historic-install.mjs <id>: config entries are appended per landmark below.
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
