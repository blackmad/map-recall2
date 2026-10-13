// Usage: node scripts/landmarks/modern-install.mjs <id> <BuilderName> [bagPandId,..] (omit when spec has buildingFootprint)
// Appends the catalogue spec (+BAG footprint polygon from PDOK), POI card and builder dispatch.
import fs from 'node:fs';
const [id, fn, bags] = process.argv.slice(2);
const dir = 'scripts/landmarks/';
const spec = JSON.parse(fs.readFileSync(`${dir}${id}-spec.json`, 'utf8'));
const poi = JSON.parse(fs.readFileSync(`${dir}${id}-poi.json`, 'utf8'));

let ring = spec.buildingFootprint?.coordinates;
for (const b of ring ? [] : bags.split(',')) {
  const r = await (await fetch(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?identificatie=${b.replace(/^NL\.IMBAG\.Pand\./, '')}&f=json`)).json();
  const g = r.features[0].geometry;
  if (g.type !== 'Polygon') throw Error('not polygon');
  ring ??= g.coordinates;
}
delete spec.osmPoi;
delete spec.routeCenter;
spec.buildingFootprint = spec.buildingFootprint ?? { type: 'Polygon', coordinates: ring };
function append(file, entry) {
  let t = fs.readFileSync(file, 'utf8').replace(/\s*\]\s*$/, '');
  t += ',\n' + JSON.stringify(entry, null, 2) + '\n]\n';
  fs.writeFileSync(file, t);
}
const cat = 'src/canalRecall/landmarks/manualCatalogue.json';
if (!JSON.parse(fs.readFileSync(cat, 'utf8')).some(x => x.id === id)) append(cat, spec);
const entry = { modelId: id, landmarkId: spec.landmarkId, name: poi.name, description: poi.description };
if (poi.funFact || poi.facts) entry.funFact = poi.funFact ?? poi.facts[poi.facts.length - 1].text;
entry.sourceUrl = poi.sourceUrl ?? poi.sources?.[0]?.url ?? poi.researchSourceUrls?.[0];
const extra = (poi.additionalSources ?? poi.researchSourceUrls ?? poi.sources?.map(s => s.url) ?? []).filter(u => u !== entry.sourceUrl);
if (extra.length) entry.additionalSources = extra;
entry.preferDescription = true;
if (poi.center) entry.center = poi.center;
if (poi.sourceLinks) entry.additionalSources = poi.sourceLinks;
const rd = poi.routeDestination ?? (poi.recommendedDestination && { center: poi.recommendedDestination.center, note: poi.recommendedDestination.reason });
if (rd) entry.routeDestination = rd;
const pf = 'src/canalRecall/game/manual-poi-data.json';
if (!JSON.parse(fs.readFileSync(pf, 'utf8')).some(x => x.modelId === id)) append(pf, entry);
const bm = dir + 'build-manual-landmarks.ts';
let s = fs.readFileSync(bm, 'utf8');
if (!s.includes(`id==='${id}'`)) {
  s = `import {${fn}} from './${id}-builder';\n` + s;
  s = s.replace(/\n    if\(id===/, `\n    if(id==='${id}')${fn}(w,d,helpers);\n    else if(id===`);
  fs.writeFileSync(bm, s);
}
console.log('installed', id, ring[0].length, 'pts');
