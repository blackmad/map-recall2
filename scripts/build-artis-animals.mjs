/** Rebuild only from the preserved source pack; no live source requests. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {originalAnimals, retiredAnimalDetails, buildOriginalAnimal} from './artis-original-animals.mjs';

const pack = process.argv[2] || '../map-recall2-source-data/models/artis-animals';
const read = file => JSON.parse(fs.readFileSync(path.join(pack, 'raw', file)));
const features = read('all.geojson').features;
const downloads = read('downloads.json');
// One playful representative per species, not a claim about actual populations.
// The shared savannah point has two representatives separated by six metres.
const matches = [
  ['12950153661', 'Indian Elephant', 3.1, 0, 0],
  ['12950334391', 'Giraffe', 4.8, -3, 0],
  ['12950334391', 'Zebra', 1.6, 3, 0],
  ['12954884298', 'Lion', 1.2, 0, 0],
  ['12954909218', 'Penguin', .65, 0, 0],
  ['12941391669', 'Flamingo', 1.35, 0, 0],
  ['12954909756', 'Giant Tortoise', .65, 0, 0],
  ['12954909757', 'Gorilla', 1.65, 0, 0],
  ['12923412139', 'Red Panda', .6, 0, 0],
  ['12954909220', 'Ostrich', 2.4, 0, 0],
  ['12930531148', 'Raccoon', .55, 0, 0],
];
const out = 'public/canal-drive/models/artis-animals';
fs.mkdirSync(out, {recursive:true});
// This directory belongs entirely to this generator. Drop retired filenames.
for(const f of fs.readdirSync(out))if(f.endsWith('.glb'))fs.unlinkSync(`${out}/${f}`);
const animals = matches.map(([id, name, height, east, south], i) => {
  const feature = features.find(f => f.id === `n${id}`);
  if (!feature || feature.geometry.type !== 'Point' || feature.properties.attraction !== 'animal') throw Error(`Missing mapped animal ${id}`);
  const model = downloads.find(d => d.name === name && d.status === 'exported');
  if (!model) throw Error(`Missing model ${name}`);
  const bytes = fs.readFileSync(path.join(pack, 'raw/models', model.file));
  if (bytes.toString('ascii',0,4) !== 'glTF') throw Error(`Invalid GLB ${model.file}`);
  fs.writeFileSync(`${out}/${model.file}`, bytes);
  return {id:`${id}-${model.idHex}`, name, osmId:`n${id}`, mappedName:feature.properties.name,
    osmUrl:`https://www.openstreetmap.org/node/${id}`,
    anchor:feature.geometry.coordinates, offsetMetres:[east,south], heightMetres:height,
    headingDegrees:(i*137)%360, file:model.file, version:crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12),
    sourceUrl:model.url, game:model.game === 'kd' ? 'Katamari Damacy' : 'We Love Katamari'};
});
for(const [id,name,height,family,coat,detail] of originalAnimals) {
  if(retiredAnimalDetails.has(detail))continue;
  const feature=features.find(f=>f.id===`n${id}`);
  if(!feature || feature.properties.attraction!=='animal')throw Error(`Missing original animal source ${id}`);
  const file=`original-${detail}.glb`;
  const geometry=await buildOriginalAnimal(`${out}/${file}`,family,coat,detail);
  const bytes=fs.readFileSync(`${out}/${file}`);
  animals.push({id:`${id}-${detail}`,name,osmId:`n${id}`,mappedName:feature.properties.name,
    osmUrl:`https://www.openstreetmap.org/node/${id}`,
    anchor:feature.geometry.coordinates,offsetMetres:[0,0],heightMetres:height,headingDegrees:(animals.length*137)%360,
    file,version:crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12),
    sourceUrl:`https://www.openstreetmap.org/node/${id}`,game:null,original:true,...geometry});
}
// Spread only mixed-species groups around their actual mapped point. These are
// decorative representative offsets, not surveyed animal or fence positions.
for(const osmId of new Set(animals.map(a=>a.osmId))) {
  const group=animals.filter(a=>a.osmId===osmId);
  if(group.length<2)continue;
  for(const [i,a] of group.entries()) {
    const angle=i/group.length*Math.PI*2;
    a.offsetMetres=[Number((3*Math.cos(angle)).toFixed(2)),Number((3*Math.sin(angle)).toFixed(2))];
  }
}
const mapped = features.filter(f => f.geometry.type === 'Point' && f.properties.attraction === 'animal');
fs.writeFileSync(`${out}/index.json`, JSON.stringify({version:1, libraryUrl:'https://katamari.andrew-boylan.com/',
  sourcePack:{repository:'blackmad/map-recall2-source-data',commit:'33b38f0',path:'models/artis-animals'},
  attribution:'Imported models from Katamari Damacy / We Love Katamari via Andrew Boylan’s Katamari Object Library. Original game assets © their respective owners. Additional animal miniatures are original Canal Recall geometry. Locations © OpenStreetMap contributors (ODbL).',
  placementNote:'Named OSM animal points; approximate adult heights/headings and one representative per species. Mixed-species groups use a 3m radius. Hollandse Polder spoonbills/lapwings and Gierenvolière griffon vultures are confirmed by ARTIS. No building suppression or new route destinations.',
  supplementalSources:['https://www.artis.nl/en/events/event-venues-at-artis/royal-hall','https://www.artis.nl/nl/artis-park/nieuws-uit-artis-park/mannenkoppel-heeft-vale-gier-ei-uitgebroed-in-artis'],
  selectionNote:'User-requested focus on larger and distinctive animals; small extras deliberately omitted. Originals use broad angular faces, small painted eyes and flush coat markings.',
  animals, unmatched:mapped.filter(f=>!animals.some(a=>a.osmId===f.id)).map(f=>({osmId:f.id,name:f.properties.name,reason:'Deliberately omitted small-animal detail'}))},null,2)+'\n');
console.log(`${animals.length} animals at ${new Set(animals.map(a=>a.osmId)).size} mapped locations; ${fs.readdirSync(out).filter(f=>f.endsWith('.glb')).reduce((n,f)=>n+fs.statSync(`${out}/${f}`).size,0)} GLB bytes`);
