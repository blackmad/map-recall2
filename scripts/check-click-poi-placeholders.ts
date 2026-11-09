/**
 * Lane D1 gate (issue #321): no placeholder-only POI cards, and a label tap on
 * a thin POI lands on the building. Reads the street-art file from staging/
 * when the integrator has not published it yet. Usage: tsx scripts/check-click-poi-placeholders.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ClickPoiIndex, type ClickPoiFile } from '../src/canalRecall/clickPoiInfo';
import { StreetArtIndex, streetArtCard, type StreetArtFile } from '../src/canalRecall/streetArt';
import { artHasSubstance, hasCardSubstance, isLabelOnly } from '../src/canalRecall/poiCardPolicy';

const dir = 'public/data/extracts/amsterdam';
const staged = `${dir}/staging/street-art.staged.json`;
const artFile = JSON.parse(readFileSync(existsSync(staged) ? staged : `${dir}/street-art.json`, 'utf8')) as StreetArtFile;
const clickFile = JSON.parse(readFileSync(`${dir}/click-poi-info.json`, 'utf8')) as ClickPoiFile;
const art = new StreetArtIndex(artFile);

// 1. Over the extract: every row that can open a card has text beyond its kind.
const KIND_ONLY = /^(an? )?(artwork|sculpture|statue|mural|memorial|fountain|monument|relief|art installation)(, mapped here)?\.?$/i;
let cardable = 0, labelOnly = 0, enrichedText = 0, enrichedRegister = 0, brettensuite = 0;
for (const row of clickFile.points) {
  const record = row[4] === 'art' ? art.byId(row[0]) : null;
  if (!hasCardSubstance(row, record)) { labelOnly++; continue; }
  cardable++;
  if (row[4] !== 'art' || !artHasSubstance(record)) continue; // an address/website/description row opens the building card with that line
  const card = streetArtCard(record!);
  assert.doesNotMatch(card.detail!, KIND_ONLY, `${row[1]} (${row[0]}): placeholder-only artwork card`);
  assert(!/^An artwork\b/.test(card.detail!), `${row[0]} still reads "An artwork"`);
  if (record!.e) enrichedText++; else enrichedRegister++;
  if (/^Brettensuite \d+\/20$/.test(row[1])) {
    brettensuite++;
    assert(record!.e && record!.u, `${row[1]} has the series text and a Wikipedia link`);
    assert.equal(record!.a, 'Herbert Nouwens');
  }
}
assert.equal(brettensuite, 20, 'all twenty Brettensuite nodes carry text');
const arts = clickFile.points.filter(r => r[4] === 'art');
const artLabelOnly = arts.filter(r => !hasCardSubstance(r, art.byId(r[0]))).length;
assert(arts.every(r => !isLabelOnly(r) || art.byId(r[0]) !== null), 'every label-only artwork row has a street-art record to consult');
console.log(`Click POIs ${clickFile.points.length}: card-able ${cardable}, label-only (no card) ${labelOnly}; artworks ${arts.length}: text ${enrichedText}, artist/year only ${enrichedRegister}, label-only ${artLabelOnly}; Brettensuite ${brettensuite}/20 with series text.`);

// 2. The runtime: a label tap on a thin POI.
(globalThis as any).window = { CanalRecallGameModules: [] };
const { GameLandmarkRuntime } = await import('../src/canalRecall/game/landmarkRuntime');
const proto = GameLandmarkRuntime.prototype as any;
const series = clickFile.points.find(r => r[1] === 'Brettensuite 11/20')!;
const thin = clickFile.points.find(r => r[4] === 'art' && !hasCardSubstance(r, art.byId(r[0])))!;
const box = (lng: number, lat: number) => ({ type: 'Polygon', coordinates: [[[lng, lat], [lng + .0002, lat], [lng + .0002, lat + .0002], [lng, lat + .0002], [lng, lat]]] });
const host: any = { landmarks: [], _clickPoiInfo: new ClickPoiIndex(clickFile), _streetArt: art, vectorMap: {},
  _buildingFacts: { lookup: () => [1895, -1, 0], article: () => null }, _requestBuildingFacts: () => {}, _poiCardWithArticle: proto._poiCardWithArticle,
  _cardForClickedBuilding: proto._cardForClickedBuilding };
const label = (row: typeof series, pand?: any) => ({ id: row[0], landmarkId: row[0], name: row[1], lngLat: [row[2], row[3]], poi: true, featureTarget: null, ...(pand ? { pand } : {}) });

const seriesCard = proto._cardForClickedBuilding.call(host, label(series));
assert.match(seriesCard.detail, /^Part 11 of 20 of Beeldenroute Brettensuite\./, 'Brettensuite 11/20 shows the series text');
assert.equal(seriesCard.type, 'sculpture');
assert(seriesCard.wikipediaUrl?.includes('wikipedia.org'), 'with the Wikipedia link');
assert.match(seriesCard.longDetail, /Herbert Nouwens/);

assert.equal(proto._cardForClickedBuilding.call(host, label(thin)), null, 'a thin artwork with no building under it opens nothing');
const under = proto._cardForClickedBuilding.call(host, label(thin, { id: 'NL.IMBAG.Pand.1', footprint: box(thin[2], thin[3]), height: 9 }));
assert.equal(under.type, 'building', 'a thin artwork over a building opens the building');
assert.equal(under.name, 'Built 1895');
assert.doesNotMatch(`${under.name} ${under.detail}`, /artwork/i);
console.log('Runtime: series piece opens its card; thin artwork opens the building under it, or nothing.');
