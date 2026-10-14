/**
 * Tall rectified crops (32 m wall height, 50 px/m) and up-looking aimed thumbnails of chosen Tropenmuseum walls, for the stages above the
 * brief's crops: node --import tsx scripts/landmarks/tropenmuseum-tall-crops.ts w12-331 w10-61 ...  (wall tags of the brief)
 * Writes artifacts/landmark-briefs/tropenmuseum/tall-<tag>-<n>.jpg and up-<tag>-<n>.jpg. Panoramas: Gemeente Amsterdam, CC BY 4.0.
 */
import fs from 'node:fs';
import sharp from 'sharp';
const R = new URL('../../', import.meta.url).pathname;
const {cachedJson, findPands, neighbourhood, normId, rdToLngLat, cachedBytes} = await import(R + 'scripts/pand-reference/core.ts');
const {exposedWalls, listPanos, rankPanos} = await import(R + 'scripts/pand-reference/select.ts');
const {loadPano, rectifyWall} = await import(R + 'scripts/pand-reference/rectify.ts');
const tags = process.argv.slice(2);
const pand = normId('0363100012237251');
let fp = (await findPands([pand])).get(pand);
if (!fp) {
  const wfs = await cachedJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent('<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>0363100012237251</Literal></PropertyIsEqualTo></Filter>')}`);
  const g = wfs.features[0].geometry;
  fp = {id: pand, ring: (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).map((q: number[]) => ({x: q[0], y: q[1]})), height: 20} as any;
}
const centre = {x: fp!.ring.reduce((s: number, p: any) => s + p.x, 0) / fp!.ring.length, y: fp!.ring.reduce((s: number, p: any) => s + p.y, 0) / fp!.ring.length};
const all = exposedWalls(fp!, await neighbourhood(centre)).sort((a: any, b: any) => b.len - a.len).filter((w: any) => w.len >= 4).slice(0, 40);
const bearingOf = (w: any) => Math.round((Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360);
const out = R + 'artifacts/landmark-briefs/tropenmuseum/';
for (const [i, w] of all.entries()) {
  const tag = `w${String(i + 1).padStart(2, '0')}-${bearingOf(w)}`;
  if (!tags.includes(tag)) continue;
  const ranked = rankPanos(w, await listPanos(w.mid));
  console.log(tag, ranked.slice(0, 6).map((p: any) => `${p.panoId} ${p.timestamp.slice(0, 10)} d${p.distM.toFixed(0)} ob${p.obliquityDeg.toFixed(0)}`).join(' | '));
  let k = 0;
  for (const pick of ranked.slice(0, 3)) {
    const pano = await loadPano(pick); if (!pano) continue;
    const crop = rectifyWall(pano.img, pick, w, 31, 50);
    if (crop) { fs.writeFileSync(`${out}tall-${tag}-${k}.jpg`, crop.jpeg); console.log('  wrote', `tall-${tag}-${k}.jpg`, crop.width, crop.height, pick.panoId); }
    // up-looking aimed view
    const [lng, lat] = rdToLngLat(w.mid), cam = pick.record.geometry.coordinates;
    const dx = (lng - cam[0]) * 111320 * Math.cos(lat * Math.PI / 180), dy = (lat - cam[1]) * 110540;
    const heading = Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360), d = Math.max(pick.distM, 4);
    for (const pitch of [Math.round(Math.atan(14 / d) * 180 / Math.PI)]) {
      const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${pick.panoId}/?width=1000&aspect=1&fov=50&heading=${heading}&pitch=${pitch}`;
      try { const bytes = await cachedBytes(url, '.jpg'); fs.writeFileSync(`${out}up-${tag}-${k}.jpg`, await sharp(bytes).jpeg({quality: 85}).toBuffer()); console.log('  wrote', `up-${tag}-${k}.jpg`); } catch (e) { console.log('  thumb failed', String(e).slice(0, 80)); }
    }
    k++;
  }
}
