import fs from 'node:fs';
import {cachedJson, findPands, neighbourhood, normId} from '../pand-reference/core.ts';
import {exposedWalls, listPanos, rankPanos} from '../pand-reference/select.ts';
import {loadPano, rectifyWall} from '../pand-reference/rectify.ts';
const pand = normId('0363100012111082');
let fp:any = (await findPands([pand])).get(pand);
if (!fp) { const bag='0363100012111082'; const wfs = await cachedJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${bag}</Literal></PropertyIsEqualTo></Filter>`)}`);
  const g = wfs.features[0].geometry; const ring = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).map((p: number[]) => ({x: p[0], y: p[1]})); fp = {id: pand, ring, height: 20}; }
const centre = {x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length};
const walls = exposedWalls(fp, await neighbourhood(centre)).sort((a, b) => b.len - a.len);
const want = process.argv.slice(2).map(Number); const H = 44;
const out = 'artifacts/landmark-briefs/andreas-ensemble/tall'; fs.mkdirSync(out, {recursive: true});
for (const k of want) {
  const w = walls[k - 1]; const ranked = rankPanos(w, await listPanos(w.mid));
  for (const [j, pick] of ranked.slice(0, 3).entries()) {
    const pano = await loadPano(pick); const crop = rectifyWall(pano.img, pick, w, H, 25, undefined, H + 2);
    if (crop) { fs.writeFileSync(`${out}/w${String(k).padStart(2,'0')}-${j}.jpg`, crop.jpeg); console.log(k, j, pick.panoId, pick.distM?.toFixed?.(1), pick.timestamp); }
  }
}
