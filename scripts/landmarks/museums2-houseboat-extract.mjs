// Houseboat Museum (Hendrika Maria): outline from the houseboat extract way w174999382, which contains
// the museum POI. Writes houseboat-museum-footprints.json (native east/south metres from the POI).
import fs from 'node:fs';
const id='w174999382',anchor=[4.882602,52.3701526];
const {boats}=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json'));
const boat=boats.find(b=>b.id===id);
const mx=111320*Math.cos(anchor[1]*Math.PI/180);
const ring=boat.ring.map(p=>[+((p[0]-anchor[0])*mx).toFixed(3),+(-(p[1]-anchor[1])*111320).toFixed(3)]);
const inside=(()=>{let r=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[a,b]=ring[i],[c,d]=ring[j];if((b>0)!==(d>0)&&0<(c-a)*(0-b)/(d-b)+a)r=!r}return r})();
const roofTop=2.15;
fs.writeFileSync('scripts/landmarks/houseboat-museum-footprints.json',JSON.stringify({id:'houseboat-museum',anchor,groundNap:0,coordinateConvention:'X east, Y above water level, Z south, metres from the museum POI',bagId:id,bagAttributes:{source:'houseboats.json (OSM way)',levels:boat.levels??null,roof:boat.roof??null},ringWGS84:[boat.ring],ring:[ring],roofs:[{id,rings:[ring.map(p=>[p[0],roofTop,p[1]])]}],poiInsideOutline:inside}));
console.log(JSON.stringify({pts:ring.length,poiInsideOutline:inside}));
