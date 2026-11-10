import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ClickPoiIndex, poiInsideBuilding, validPoiWebsite, type ClickPoiFile, type ClickPoiRow, type PolygonGeometry } from '../src/canalRecall/clickPoiInfo';

const box = (x: number, y: number, size: number) => [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const footprint: PolygonGeometry = { type: 'Polygon', coordinates: [box(4.9,52.37,.001), box(4.9004,52.3704,.0002)] };
const row = (id: string, name: string, lng: number, lat: number, website = ''): ClickPoiRow =>
  [id,name,lng,lat,'food','a café','Teststraat 12',website,''];
const index = new ClickPoiIndex({ version: 1, source: 'OSM', points: [
  row('n1','Inside Café',4.9001,52.3701,'https://example.com'),
  row('n2','Courtyard Café',4.9005,52.3705),
  row('n3','Neighbor Café',4.90101,52.3701),
  row('n4','Outer entrance',4.9,52.3702),
  row('w5','Inside Café',4.9002,52.3702),
  row('n6','Hole boundary',4.9004,52.3705),
] });
assert.deepEqual(index.contained(footprint).map(r=>r[1]), ['Inside Café','Outer entrance']);
assert.equal(poiInsideBuilding([4.9005,52.3705],footprint),false,'courtyard is not inside the building');
assert.equal(poiInsideBuilding([4.90101,52.3701],footprint),false,'close neighbour never counts as containment');
const multi: PolygonGeometry={type:'MultiPolygon',coordinates:[footprint.coordinates,[box(4.902,52.37,.001)]]};
assert(poiInsideBuilding([4.9025,52.3705],multi),'second genuine component is included');
assert(!poiInsideBuilding([4.9015,52.3705],multi),'space between components is excluded');
assert.equal(index.card({id:'actual',lngLat:[4.9,52.37],featureTarget:null}),null,'missing installed plan has no proximity fallback');
// C1 (#367): a lone cafe does not title a ~7,500 m2 building; the same cafe titles a small low one.
assert.equal(index.card({id:'actual',lngLat:[0,0],footprint,height:29,featureTarget:null}),null,'a venue does not title a large building');
assert.match(index.inside({id:'actual',lngLat:[0,0],footprint,height:29,featureTarget:null}),/^Inside: Inside Café \(café\)/);
const small:PolygonGeometry={type:'Polygon',coordinates:[box(4.9,52.37,.0001)]};
const smallIdx=new ClickPoiIndex({version:1,source:'OSM',points:[row('n9','Corner Café',4.90005,52.37005)]});
assert.equal(smallIdx.card({id:'s',lngLat:[0,0],footprint:small,height:9,featureTarget:null})?.name,'Corner Café','small low building: the place titles it');
assert.equal(smallIdx.card({id:'s',lngLat:[0,0],footprint:small,height:30,featureTarget:null}),null,'tall building: the building leads');
// The Anthony Fokkerweg 61 slab (user shot 2026-11-10) and a mall.
const slab:PolygonGeometry={type:'Polygon',coordinates:[box(4.8428,52.3405,.0004)]};
const arepaRow:ClickPoiRow=['n11663241414','Arepa Shop Amsterdam',4.8429741,52.3406765,'food','a restaurant','Anthony Fokkerweg 61','https://www.arepashopamsterdam.nl/',''];
const slabIdx=new ClickPoiIndex({version:1,source:'OSM',points:[arepaRow,['n2','Mall Shop',4.8430,52.3407,'shop','a shop','x','','']]});
assert.equal(slabIdx.card({id:'slab',lngLat:[0,0],footprint:slab,height:29,featureTarget:null}),null,'Arepa slab: the building leads');
assert.equal(slabIdx.inside({id:'slab',lngLat:[0,0],footprint:slab,height:29,featureTarget:null},n=>n==='Mall Shop'),'Inside: Arepa Shop Amsterdam (restaurant)');
assert.equal(slabIdx.inside({id:'slab',lngLat:[0,0],footprint:slab,height:29,featureTarget:null}),'Inside: Arepa Shop Amsterdam (restaurant) + 1 more');
const mallIdx=new ClickPoiIndex({version:1,source:'OSM',points:[arepaRow,['n3','Villa ArenA',4.8430,52.3407,'shop','a mall','Arena Blvd','','']]});
assert.equal(mallIdx.card({id:'mall',lngLat:[0,0],footprint:slab,height:29,featureTarget:null})?.name,'Villa ArenA + 1 mapped places','a mall titles its building');
const card=index.card({id:'actual',name:'Inside Café',lngLat:[0,0],footprint,featureTarget:{source:'actual',id:'actual'}})!;
assert.equal(card.sourceUrl,'https://www.openstreetmap.org/node/1');
assert.match(card.detail,/Inside Café is mapped as a café at Teststraat 12/);
assert.match(card.factTexts!.join('\n'),/Website: https:\/\/example.com/);
assert(!card.longDetail!.includes('https://'),'collapsed card avoids redundant raw source URLs');
assert(!card.longDetail!.includes('Courtyard Café')&&!card.longDetail!.includes('Neighbor Café'));
assert.deepEqual(card.featureTarget,{source:'actual',id:'actual'},'highlight belongs to actual clicked surface');
for(const bad of ['javascript:alert(1)','http://://bad.example','https://user:pass@example.com','file:///tmp/a','https://localhost'])assert.equal(validPoiWebsite(bad),'');
assert.equal(validPoiWebsite('example.com/info'),'https://example.com/info');

(globalThis as any).window = { CanalRecallGameModules: [] };
const { GameLandmarkRuntime } = await import('../src/canalRecall/game/landmarkRuntime');
const researched={id:'research',name:'Researched venue',detail:'Existing researched facts.',buildingIds:['actual']};
// The fake mirrors the runtime's optional facts store: lookup and article are stubbed, and the
// requester records whether the POI card asked for the building's article tile to arrive.
let requested=0, article:any=null;
const host:any={landmarks:[researched],_clickPoiInfo:index,vectorMap:{},
  _buildingFacts:{lookup:()=>null,article:()=>article},_requestBuildingFacts:()=>{requested++;},_poiCardWithArticle:GameLandmarkRuntime.prototype._poiCardWithArticle};
assert.equal(GameLandmarkRuntime.prototype._cardForClickedBuilding.call(host,{id:'actual',name:'Inside Café',lngLat:[0,0],footprint,featureTarget:null})?.id,'research','researched card keeps priority');
host.landmarks=[{...researched,detail:''}];
assert.equal(GameLandmarkRuntime.prototype._cardForClickedBuilding.call(host,{id:'actual',name:'Inside Café',lngLat:[0,0],footprint,featureTarget:null})?.id,'clicked-poi-actual','name-only owner cannot block mapped information');
assert.equal(requested,1,'no article yet: the POI card asks for the building facts tile once');
article={e:'Lede from the building article.'};
const withArticle=GameLandmarkRuntime.prototype._cardForClickedBuilding.call(host,{id:'actual',name:'Inside Café',lngLat:[0,0],footprint,featureTarget:null})!;
assert.equal(requested,1,'article already present: no facts request');
assert.equal(withArticle.detail,'Lede from the building article.','article lede leads the POI card');
assert.equal(withArticle.factTexts![0],'Lede from the building article.');

// C1: the unnamed large building keeps its own card and lists the place inside it.
const slabHost:any={...host,landmarks:[],_clickPoiInfo:slabIdx,_buildingFacts:{lookup:()=>[1968,-1,0],article:()=>null}};
const slabCard=GameLandmarkRuntime.prototype._cardForClickedBuilding.call(slabHost,{id:'slab',lngLat:[4.843,52.3407],footprint:slab,height:29,featureTarget:null})!;
assert.equal(slabCard.id,'clicked-slab','the building, not the restaurant, leads');
assert(!/Arepa/.test(slabCard.name),'restaurant does not title the slab');
assert.match(slabCard.detail,/Inside: Arepa Shop Amsterdam \(restaurant\) \+ 1 more/);
assert(!/Fokkerweg/.test(slabCard.detail),'street name not printed on the building card');

const file=JSON.parse(readFileSync('public/data/extracts/amsterdam/click-poi-info.json','utf8')) as ClickPoiFile;
assert(file.points.length>1000);assert.equal(new Set(file.points.map(r=>r[0])).size,file.points.length);
for(const r of file.points){assert.match(r[0],/^[nwr]\d+$/);assert(r[1]&&r[5]);if(r[7])assert.equal(validPoiWebsite(r[7]),r[7]);}
const deRoodeLeeuw=file.points.find(r=>r[0]==='n34044093')!;
assert.equal(deRoodeLeeuw[6],'Damrak 93');assert.equal(deRoodeLeeuw[7],'https://www.brasseriederoodeleeuw.nl/');
console.log(`Contained POI checks passed: ${file.points.length} mapped places, courtyard/neighbour exclusion, exact surface, source/address/website, researched precedence.`);
