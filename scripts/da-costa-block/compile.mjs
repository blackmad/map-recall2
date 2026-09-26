import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { loadAreaConfig } from './area-config.mjs';

const area=await loadAreaConfig(),eland=area.referencePreset==='elandsgracht',custom=!area.referencePreset;
const cache=area.cacheRoot,out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||area.outputRoot;
const read = async n => JSON.parse(await readFile(`${cache}/${n}.json`, 'utf8'));
const acquisition=await read('acquisition');
if(acquisition.errors?.length)throw Error('Refusing to compile incomplete acquisition: '+acquisition.errors.join('; '));
if(custom&&acquisition.areaConfigHash!==area.configHash)throw Error('Acquisition area config hash mismatch; acquire this exact area first.');
const origin = lngLatToRd(area.origin);
const round = n => Math.round(n * 100) / 100;
const xy = ll => { const p = lngLatToRd(ll); return [round(p.x - origin.x), round(origin.y - p.y)]; };
const inRing = (p, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};
const centroid = ring => ring.slice(0, -1).reduce((p, q, _, a) => [p[0] + q[0] / a.length, p[1] + q[1] / a.length], [0, 0]);
const corners=[[area.bbox[0],area.bbox[1]],[area.bbox[0],area.bbox[3]],[area.bbox[2],area.bbox[1]],[area.bbox[2],area.bbox[3]]].map(xy);
const bounds = custom?[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))]:eland ? [-224,-134,224,140] : [-130, -147, 130, 131];
function clipRing(ring) {
  let pts = ring.slice(0, -1);
  for (const [axis, edge, greater] of [[0, bounds[0], true], [0, bounds[2], false], [1, bounds[1], true], [1, bounds[3], false]]) {
    const result = [], inside = p => greater ? p[axis] >= edge : p[axis] <= edge;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ia = inside(a), ib = inside(b);
      if (ia) result.push(a);
      if (ia !== ib) { const t = (edge - a[axis]) / (b[axis] - a[axis]); result.push([round(a[0] + t * (b[0] - a[0])), round(a[1] + t * (b[1] - a[1]))]); }
    }
    pts = result;
  }
  return pts.length >= 3 ? [...pts, pts[0]] : [];
}
function geometry(g, clip = false) {
  if (!g) return null;
  if (g.type === 'Point') return { type: g.type, coordinates: xy(g.coordinates) };
  if (g.type === 'LineString') return { type: g.type, coordinates: g.coordinates.map(xy) };
  if (g.type === 'MultiLineString') return { type: g.type, coordinates: g.coordinates.map(l => l.map(xy)) };
  const polygons = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map(p => p.map(r => clip ? clipRing(r.map(xy)) : r.map(xy))).filter(p => p[0]?.length >= 4);
  return { type: 'MultiPolygon', coordinates: polygons.map(p => [p[0], ...p.slice(1).filter(r => r.length >= 4)]) };
}
function current(features) {
  const map = new Map();
  for (const f of features) {
    const p = f.properties;
    if (p.eind_registratie || p.termination_date || p.status === 'plan') continue;
    const id = p.lokaal_id || f.id;
    if (!map.has(id) || String(p.tijdstip_registratie) > String(map.get(id).properties.tijdstip_registratie)) map.set(id, f);
  }
  return [...map.values()];
}
const rawBag = (await read('bag')).filter(f => ['Pand in gebruik', 'Verbouwing pand', 'Pand in gebruik (niet ingemeten)'].includes(f.properties.status));
const bag = new Map(rawBag.map(f => [f.properties.identificatie, f]));
const byApiId = new Map(rawBag.map(f => [f.id, f.properties.identificatie]));
const addresses = (await read('addresses')).filter(f => f.properties.status === 'Verblijfsobject in gebruik' && f.properties.hoofdadres_status === 'Naamgeving uitgegeven');
const addressMap = new Map();
for (const a of addresses) for (const url of a.properties['pand.href'] ?? []) {
  const id = byApiId.get(url.split('/').pop());
  if (id) { const list = addressMap.get(id) ?? []; list.push(a); addressMap.set(id, list); }
}
const focusRing = [[4.87274,52.37166],[4.87385,52.37186],[4.87388,52.37245],[4.8743,52.37292],[4.8737,52.373],[4.87283,52.37186],[4.87274,52.37166]].map(xy);
function isFocus(a) {
  const p = a.properties, n = p.huisnummer, s = p.openbare_ruimte_naam;
  if(custom)return true;
  if (eland) return s === 'Elandsgracht';
  return s === 'Da Costakade' && n >= 13 && n <= 49 && n % 2 === 1
    || s === 'Nassaukade' && n >= 134 && n <= 152
    || s === 'De Clercqstraat' && n >= 2 && n <= 22 && n % 2 === 0;
}
const buildings = [], byId = new Map();
for (const [id, f] of bag) {
  const footprint = geometry(f.geometry), ring = footprint.coordinates[0][0], c = centroid(ring);
  const ads = addressMap.get(id) ?? [], focus = ads.some(isFocus) || !custom && !eland && !ads.length && inRing(c, focusRing);
  const nums = [...new Set(ads.map(a => `${a.properties.openbare_ruimte_naam} ${a.properties.huisnummer}`))];
  const street = ads.find(a => isFocus(a))?.properties.openbare_ruimte_naam ?? ads[0]?.properties.openbare_ruimte_naam ?? '';
  const b = { id, footprint, center: c.map(round), year: f.properties.bouwjaar, addresses: nums, street, focus, surfaces: [],
    family: f.properties.bouwjaar >= 1945 ? 'later-infill' : !custom && street === 'De Clercqstraat' ? 'shopping-row' : 'quay-row',
    appearanceSource: custom?'Unverified construction-year family prior; no business or photographic identity asserted.':'Authored family, informed by municipal street photographs; individual window counts and colours are approximate.' };
  buildings.push(b); byId.set(id, b);
}
const sourcePages=custom?acquisition.sources.filter(s=>/^3dbag-\d+$/.test(s.name)).map(s=>s.name+'.json'):(await readdir(cache)).filter(f => /^3dbag-\d+\.json$/.test(f));
for (const file of sourcePages.sort()) {
  const page = JSON.parse(await readFile(`${cache}/${file}`, 'utf8')), t = page.metadata.transform;
  for (const f of page.features) {
    const obj = Object.values(f.CityObjects).find(o => o.type === 'Building');
    const id = String(obj?.attributes?.identificatie ?? f.id).replace('NL.IMBAG.Pand.', '');
    const b = byId.get(id); if (!b || b.surfaces.length) continue;
    b.heightSource = '3DBAG LoD2.2'; b.groundNAP = obj.attributes.b3_h_maaiveld;
    b.height = round(obj.attributes.b3_h_dak_70p - obj.attributes.b3_h_maaiveld);
    b.roofType = obj.attributes.b3_dak_type; b.pointCloudYear = obj.attributes.b3_pw_datum;
    const vertices = f.vertices.map(v => [round(v[0] * t.scale[0] + t.translate[0] - origin.x), round(v[2] * t.scale[2] + t.translate[2] - .65), round(origin.y - v[1] * t.scale[1] - t.translate[1])]);
    for (const part of Object.values(f.CityObjects)) {
      const g = part.geometry?.find(g => g.lod === '2.2'); if (!g) continue;
      const shells = g.type === 'Solid' ? g.boundaries : [g.boundaries];
      const values = g.type === 'Solid' ? g.semantics.values : [g.semantics.values];
      shells.forEach((shell, si) => shell.forEach((surface, fi) => {
        const type = g.semantics.surfaces[values[si][fi]]?.type;
        if (type === 'GroundSurface') return;
        b.surfaces.push({ type: type === 'RoofSurface' ? 'roof' : 'wall', rings: surface.map(r => r.map(i => vertices[i])) });
      }));
    }
  }
}
for (const b of buildings) if (!b.surfaces.length) {
  const r = b.footprint.coordinates[0][0];
  const area = Math.abs(r.slice(0,-1).reduce((sum,p,i) => sum+p[0]*r[i+1][1]-r[i+1][0]*p[1],0))/2;
  const smallUnaddressed = !b.addresses.length && area < 45;
  b.height = smallUnaddressed ? 2.8 : b.year >= 1945 ? 10 : 14;
  if (smallUnaddressed) b.family = 'courtyard-outbuilding';
  b.heightSource = `Approximate ${b.height} m fallback; no matched 3DBAG geometry`;
}
const layers = {};
const rejected = {};
for (const name of ['wegdeel','ondersteunendwegdeel','waterdeel','begroeidterreindeel','onbegroeidterreindeel','overbruggingsdeel','spoor','scheiding_lijn','paal','straatmeubilair']) {
  const all = await read(`bgt-${name}`), features = current(all); rejected[name] = all.length - features.length;
  // New area outputs retain complete feature topology; streaming clips visibility, not data.
  layers[name] = features.map(f => ({ id: f.properties.lokaal_id, geometry: geometry(f.geometry, !custom),
    kind: f.properties.functie ?? f.properties.type ?? f.properties.type_overbruggingsdeel ?? f.properties.fysiek_voorkomen,
    surface: f.properties.fysiek_voorkomen, detail: f.properties.plus_fysiek_voorkomen, height: f.properties.relatieve_hoogteligging ?? 0,
    date: f.properties.tijdstip_registratie })).filter(f => f.geometry?.coordinates.length);
}
const rawTrees = await read('trees');
const trees = rawTrees.filter(f => f.properties.type_object !== 'Stobbe').map(f => {
  const p = f.properties, numbers = String(p.boomhoogteklasse_actueel).match(/\d+/g)?.map(Number);
  const height = numbers?.length === 2 ? (numbers[0] + numbers[1]) / 2 : numbers?.[0] ?? 9;
  return { id: p.id, position: xy(f.geometry.coordinates), height, heightClass: p.boomhoogteklasse_actueel, species: p.soortnaam,
    type: p.type_object, year: p.jaar_van_aanleg, crownSource: 'Authored shape and width; inventory position and height class' };
});
const anchors = custom?[]:eland ? JSON.parse(await readFile('scripts/da-costa-block/eland-frontages.json', 'utf8')) : [
  { id: 'fuoco', name: 'Fuoco Vivo', street: 'De Clercqstraat', number: 12, colour: '#763b3c', trim: '#e8dfc7', sign: 'FUOCO VIVO', awning: true, terrace: [3.3,1.5],
    description: 'The red awning and dark shopfront make a small, memorable break in the commercial row.',
    evidence: 'Name/address: restaurant website. Red awning and dark frontage: July 2025 municipal panorama. Terrace footprint: 2021 municipal plan; furniture is illustrative.',
    sources: ['https://www.fuocovivo.nl/gerechten/','https://assets.amsterdam.nl/publish/pages/1038217/20211223_concept_terrassenplan_de_clercqstraat-jan_evertsenstraat.pdf'], view: 'shopping' },
  { id: 'scooter', name: 'Scooter Center West', street: 'De Clercqstraat', number: 10, colour: '#283f35', trim: '#ede1a2', sign: 'SCOOTER CENTER WEST',
    description: 'A dark green sign and a small cluster of scooters identify the next frontage along.',
    evidence: 'Shop name, sign colour and scooter cluster visible in the July 2025 municipal panorama; address agrees with local listing. Scooter positions/count are illustrative.',
    sources: ['https://www.waze.com/live-map/directions/nl/nh/amsterdam/scooter-center-west?to=place.ChIJ1wkKwd4JxkcRg_XIfYG0i14'], view: 'shopping' },
  { id: 'bagels', name: 'Bagels & Beans', street: 'De Clercqstraat', number: 22, colour: '#525045', trim: '#eee4cc', sign: 'BAGELS & BEANS', terrace: [4.5,1.5],
    description: 'A café at the canal corner: terrace, bridge and water form one useful orientation cue.',
    evidence: 'Name/address and corner location: street business association and 2021 municipal terrace plan. Sign treatment and the reduced table arrangement are authored approximations.',
    sources: ['https://declercqstraatamsterdam.nl/company/bagels-beans/','https://assets.amsterdam.nl/publish/pages/1038217/20211223_concept_terrassenplan_de_clercqstraat-jan_evertsenstraat.pdf'], view: 'shopping-2023' },
  { id: 'groot', name: 'Groot Amsterdam', street: 'Nassaukade', number: 134, colour: '#eee9d9', trim: '#31414a', sign: 'GROOT AMSTERDAM',
    description: 'The pale corner shopfront anchors the northern tip where Nassaukade meets the canal.',
    evidence: 'Name/address: business contact page. Pale corner frontage and dark lettering: June 2025 municipal panorama. Panel dimensions are approximate.',
    sources: ['https://www.grootamsterdam.nl/contact/'], view: 'north' },
  { id: 'sterk', name: 'Sterk Amsterdam', street: 'De Clercqstraat', number: 7, colour: '#293e48', trim: '#f1e5c6', sign: 'STERK',
    description: 'A familiar shop across De Clercqstraat; kept outside the target block, on its correct side of the street.',
    evidence: 'Name/address: Sterk contact page and BAG address-to-building join. Sign colours and dimensions are illustrative, not photo matched.',
    sources: ['https://sterkamsterdam.nl/contact'], view: 'shopping' },
];
if (!custom&&!eland) anchors.push({ id: 'amsta', name: 'Amsta · De Poort', street: 'Hugo de Grootkade', number: 20, addressLabel: 'Hugo de Grootkade 18–28', kind: 'institution', view: 'amsta',
  description: 'A broad institutional facade across the water: pale horizontal bands, repeated glazing and muted ochre panels give it a completely different rhythm from the houses.',
  evidence: 'Identity and address range: Amsta own location page. Horizontal bands, light frames, ochre accents and glazed base: January 2023 municipal panorama viewed from Da Costakade. Module widths and floor levels are authored approximations. No entrance or sign position is asserted.',
  sources: ['https://www.amsta.nl/locaties/de-poort'] });
for (const anchor of anchors) {
  anchor.frontages = [];
  for (const number of anchor.numbers ?? [anchor.number]) {
    const candidates = addresses.filter(f => f.properties.openbare_ruimte_naam === anchor.street && f.properties.huisnummer === number && (!anchor.letter || String(f.properties.huisletter).toUpperCase() === anchor.letter));
    const ids = [...new Set(candidates.flatMap(a => (a.properties['pand.href'] ?? []).map(url => byApiId.get(url.split('/').pop()))).filter(Boolean))];
    if (ids.length !== 1) throw new Error(`Ambiguous/missing BAG join ${anchor.id} ${number}: ${ids}`);
    const a = candidates[0], buildingId = ids[0], b = byId.get(buildingId);
    if (!b) throw new Error(`Missing building: ${anchor.id}`);
    anchor.frontages.push({ buildingId, number, position: xy(a.geometry.coordinates) });
    b.anchorIds = [...new Set([...(b.anchorIds ?? []), anchor.id])];
    if (anchor.wallColour) { b.appearance = { wallColour: anchor.wallColour, brick: anchor.brick !== false }; b.appearanceSource = 'Dominant material/colour family informed by the linked street photograph; exact colour and upper window rhythm are authored approximations.'; }
    if (anchor.kind === 'institution') {
      b.family = 'institutional-bands';
      b.appearanceSource = anchor.evidence;
      b.appearance = { wallColour: '#928b72', brick: false, family: 'institutional-bands' };
    }
  }
  anchor.buildingId = anchor.frontages[0].buildingId;
  anchor.position = anchor.frontages[0].position;
}
const references = (custom?[]:await read('reference-views')).filter(v => v.name !== 'da-costa').map(v => ({ ...v, positionLocal: xy(v.position), label: v.label || (v.name.startsWith('front-') ? `Elandsgracht ${v.name.slice(6)} · ${v.timestamp.slice(0,10)}` : null) || ({amsta:'Amsta / De Poort · January 2023',engels:'Engels Verf · June 2025','eland-west':'Western Elandsgracht · June 2025','eland-middle':'Central Elandsgracht · June 2025','eland-east':'Eastern Elandsgracht · June 2025','eland-prinsengracht':'Prinsengracht end · June 2025',shopping:'De Clercqstraat · July 2025',nassau:'Nassaukade · June 2025',north:'Northern corner · June 2025','da-costa-2023':'Da Costakade · January 2023','shopping-2023':'Shopping street · January 2023'})[v.name] }));
const moorings = (await read('moorings')).filter(f => f.properties.status === 'Plaats aangewezen').map(f => ({ id: f.properties.identificatie,
  geometry: geometry(f.geometry), address: `${f.properties.openbare_ruimte_naam} ${f.properties.huisnummer}${f.properties.huisletter || ''}`,
  evidence: 'BAG registered mooring polygon. Boat presence, hull, cabin shape and colour are illustrative, not surveyed.' }));
const data = { study: custom?area.id:eland ? 'elandsgracht' : 'da-costa', version: 2, title: custom?area.id:'One Amsterdam block', origin, bounds, acquiredAt: acquisition.acquiredAt,
  ...(custom?{areaConfigHash:area.configHash,geometryPolicy:'unclipped-source-features',verticalDatum:{offsetNAP:.65,source:'legacy study offset; not locally calibrated'}}:{}),
  buildings, layers, trees, anchors, references, focusRing: custom||eland ? [] : focusRing, moorings,
  stats: { buildings: buildings.length, focusBuildings: buildings.filter(b => b.focus).length, measuredBuildings: buildings.filter(b => b.surfaces.length).length,
    trees: trees.length, moorings: moorings.length, stumpsExcluded: rawTrees.length - trees.length, historicBgtExcluded: rejected },
  sources: [
    { name: 'BAG footprints, years, address links and moorings', url:'https://api.pdok.nl/kadaster/bag/ogc/v2', license:'CC0 1.0' },
    { name: '3DBAG LoD2.2 roofs and walls', url:'https://3dbag.nl', license:'CC BY 4.0 · 3DBAG / TU Delft / 3DGI' },
    { name: 'BGT street and water geometry', url:'https://api.pdok.nl/lv/bgt/ogc/v1', license:'CC0 1.0' },
    { name: 'Municipal tree inventory', url:'https://api.data.amsterdam.nl/v1/docs/datasets/bomen@v1.html', license:'Gemeente Amsterdam · public data' },
    { name: 'Street photographs', url:'https://data.amsterdam.nl/uitleg-gebruik', license:'Gemeente Amsterdam · Kernregistratie Panoramabeelden · linked reference images' },
  ] };
await mkdir(out, { recursive: true });
await writeFile(`${out}/block.json`, JSON.stringify(data));
await writeFile(`${out}/sources.json`, JSON.stringify(acquisition, null, 2));
console.log(JSON.stringify(data.stats, null, 2));
console.log('Anchors:', anchors.map(a => `${a.id} → ${a.buildingId}`).join(', '));
console.log(`Compiled ${(JSON.stringify(data).length / 1024).toFixed(0)} KiB → ${out}/block.json`);
