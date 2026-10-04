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
const card=index.card({id:'actual',lngLat:[0,0],footprint,featureTarget:{source:'actual',id:'actual'}})!;
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
const host:any={landmarks:[researched],_clickPoiInfo:index};
assert.equal(GameLandmarkRuntime.prototype._cardForClickedBuilding.call(host,{id:'actual',lngLat:[0,0],footprint,featureTarget:null})?.id,'research','researched card keeps priority');
host.landmarks=[{...researched,detail:''}];
assert.equal(GameLandmarkRuntime.prototype._cardForClickedBuilding.call(host,{id:'actual',lngLat:[0,0],footprint,featureTarget:null})?.id,'clicked-poi-actual','name-only owner cannot block mapped information');

const file=JSON.parse(readFileSync('public/data/extracts/amsterdam/click-poi-info.json','utf8')) as ClickPoiFile;
assert(file.points.length>1000);assert.equal(new Set(file.points.map(r=>r[0])).size,file.points.length);
for(const r of file.points){assert.match(r[0],/^[nwr]\d+$/);assert(r[1]&&r[5]);if(r[7])assert.equal(validPoiWebsite(r[7]),r[7]);}
const deRoodeLeeuw=file.points.find(r=>r[0]==='n34044093')!;
assert.equal(deRoodeLeeuw[6],'Damrak 93');assert.equal(deRoodeLeeuw[7],'https://www.brasseriederoodeleeuw.nl/');
console.log(`Contained POI checks passed: ${file.points.length} mapped places, courtyard/neighbour exclusion, exact surface, source/address/website, researched precedence.`);
