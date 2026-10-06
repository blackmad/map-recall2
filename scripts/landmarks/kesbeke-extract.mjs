import fs from 'node:fs';
import path from 'node:path';
import proj4 from 'proj4';
import opentype from 'opentype.js';
const archive='/private/tmp/map-recall2-jan-evertsen-source-archive/models/kesbeke/raw';
const rd='+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';
const result={schemaVersion:1,sourceRepository:'blackmad/map-recall2-source-data',sourceArchivePath:'models/kesbeke/',sourceCommit:null,coordinateConvention:'Native RD east X / south Z; Y relative local AHN5 ground; no scale correction',parts:{}};
for(const [key,id,anchorRd] of [['factory','0363100012132306',[118935,488489]],['shop','0363100012120245',[118888,488467]]]){
 const input=JSON.parse(fs.readFileSync(path.join(archive,`3dbag-${key}.json`))),f=input.feature,t=input.metadata.transform;
 const world=f.vertices.map(p=>p.map((v,i)=>v*t.scale[i]+t.translate[i]));
 const building=f.CityObjects[`NL.IMBAG.Pand.${id}`],ground=building.attributes.b3_h_maaiveld;
 const convert=p=>[p[0]-anchorRd[0],p[2]-ground,anchorRd[1]-p[1]];
 const part=Object.values(f.CityObjects).find(p=>p.type==='BuildingPart'),g=part.geometry.find(g=>g.lod==='2.2');
 const roofRegions=[];
 for(let i=0;i<g.boundaries[0].length;i++)if(g.semantics.surfaces[g.semantics.values[0][i]].type==='RoofSurface')roofRegions.push({index:i,rings:g.boundaries[0][i].map(r=>r.map(k=>convert(world[k])))});
 const outline=building.geometry.find(g=>g.lod==='0').boundaries[0].map(r=>r.map(k=>{const p=convert(world[k]);return[p[0],p[2]]}));
 result.parts[key]={id:`NL.IMBAG.Pand.${id}`,anchor:proj4(rd,'EPSG:4326',anchorRd),anchorRd,groundNap:ground,outline,roofRegions,referencePhotos:[key==='factory'?'current-corner.webp':'current-shop.jpg'],heightPolicy:'Individual planar roof regions own shell heights; b3_h_dak_max is never a whole-building extrusion height',heightRangeM:[Math.min(...roofRegions.flatMap(r=>r.rings.flat().map(p=>p[1]))),Math.max(...roofRegions.flatMap(r=>r.rings.flat().map(p=>p[1])))]};
}
// Original outline lettering derived from a standard serif italic typeface;
// a close photographic style approximation, never traced photo pixels.
function lettering(text,fontFile){
 const bytes=fs.readFileSync(fontFile),font=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),glyph=font.getPath(text,0,0,100),bounds=glyph.getBoundingBox();
 return {text,width:bounds.x2-bounds.x1,height:bounds.y2-bounds.y1,commands:glyph.commands.map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,typeof v==='number'?Math.round(v*1000)/1000:v])))};
}
result.signage={label:'Original smooth vector lettering approximation of real documented signs; standard serif italic and repo Anton outlines, never photo pixels',words:{
 kesbeke:lettering('Kesbeke','/System/Library/Fonts/Supplemental/Times New Roman Bold Italic.ttf'),
 sweetSour:lettering('zoet&zuur','src/mapRecall/fonts/Anton-Regular.ttf'),
 motherNature:lettering('van moeder natuur','src/mapRecall/fonts/Anton-Regular.ttf')
}};
fs.writeFileSync('scripts/landmarks/kesbeke-footprints.json',JSON.stringify(result,null,2)+'\n');
for(const key of ['factory','shop']){
 const p=result.parts[key],xs=p.outline.flat().map(v=>v[0]),zs=p.outline.flat().map(v=>v[1]);
 const spec={id:key==='factory'?'kesbeke':'kesbeke-shop',name:key==='factory'?'Kesbeke Fijne Tafelzuren':'Kesbeke Zoet & Zuur winkel',landmarkId:key==='factory'?'w276264363':'n9071288363',modelUrl:`./models/${key==='factory'?'kesbeke':'kesbeke-shop'}.glb`,suppressOsmIds:[p.id],spatialSuppression:false,materialOverrides:{brick:'#8a7159',gold:'#f4c400'},footprint:{centre:p.anchor,headingDegrees:0,lengthMetres:Math.max(...xs)-Math.min(...xs),widthMetres:Math.max(...zs)-Math.min(...zs)},groundAltitudeMetres:0,facingOffsetDegrees:0,surveyed:{anchor:p.anchor,northOffsetDegrees:0,source:`Native RD anchor${p.anchorRd.join('/')}; AHN5 individual semantic roof planes, groundNAP${p.groundNap}; exact official BAG address/VBO/Pand relationship`},attribution:{title:key==='factory'?'Kesbeke factory and office':'Kesbeke shop and its residential BAG parent',author:'Map Recall',sourceUrl:key==='factory'?'https://www.kesbeke.nl/contact-keuze/':'https://www.kesbeke.nl/ons-winkeltje/',licence:'Original project asset',licenceUrl:'./LICENSE',modifications:'Original native flat-color reconstruction with sharp original vector signage following actual walls; reference photos inform geometry only; no photo pixels or imported mesh.'}};
 fs.writeFileSync(`scripts/landmarks/kesbeke-${key}-spec.json`,JSON.stringify(spec,null,2)+'\n');
}
console.log('Kesbeke native roof planes and original signage outlines extracted');
