/**
 * Shared helpers for the public-building match scripts (libraries, civic offices): OSM via Overpass with a mirror
 * fallback, PDOK Locatieserver (address -> adresseerbaarobject), PDOK BAG WFS (verblijfsobject -> pand), and the
 * pand-reference panorama status. Open data only.
 */
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
export const UA = 'map-recall2-public-buildings-lane/1.0 (whizziwig@gmail.com)';
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
export async function overpass(q: string): Promise<{elements: any[]}> {
  for (let round = 0; round < 4; round++) for (const m of MIRRORS) {
    try {
      const r = await fetch(m, {method: 'POST', signal: AbortSignal.timeout(60000), headers: {'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded'}, body: 'data=' + encodeURIComponent(q)});
      const t = await r.text(); if (t.startsWith('{')) return JSON.parse(t);
    } catch { /* next mirror */ }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('overpass failed on every mirror');
}
const getJson = async (url: string): Promise<any> => (await fetch(url, {signal: AbortSignal.timeout(30000), headers: {'User-Agent': UA}})).json();
export interface Match { pandIds: string[]; verblijfsobject: string; bagAddress: string; gebruiksdoel: string; bouwjaar: number | null; osmToAddressM: number | null }
export const NO_MATCH: Match = {pandIds: [], verblijfsobject: '', bagAddress: '', gebruiksdoel: '', bouwjaar: null, osmToAddressM: null};
/** BAG pands under the OSM point (+-6 m), for entries whose address geocodes far from the mapped point. */
async function pandsAtPoint(c: {lat: number; lon: number}): Promise<Match> {
  const d = 0.00006, w = await getJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=bag:pand&outputFormat=application/json&count=10&srsName=urn:ogc:def:crs:EPSG::4326&bbox=${c.lat - d},${c.lon - d},${c.lat + d},${c.lon + d},urn:ogc:def:crs:EPSG::4326`);
  const f = w.features[0]?.properties;
  return {...NO_MATCH, pandIds: w.features.map((x: any) => x.properties.identificatie), gebruiksdoel: f?.gebruiksdoel ?? '', bouwjaar: f?.bouwjaar ?? null, bagAddress: '(pand under the OSM point; address geocode was far away)', osmToAddressM: 0};
}
/** Street + number + city -> BAG pand ids through the Locatieserver and the BAG WFS. */
export async function matchAddress(addr: string, c: {lat: number; lon: number}): Promise<Match> {
  const g = await getJson(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(addr)}&fq=type:adres&rows=1&fl=*`);
  const d = g.response.docs[0];
  if (!d) return NO_MATCH;
  const vbo = d.adresseerbaarobject_id as string, [lon, lat] = (d.centroide_ll.match(/[-\d.]+/g) as string[]).map(Number);
  const distM = Math.round(Math.hypot((lat - c.lat) * 111320, (lon - c.lon) * 111320 * Math.cos(lat * Math.PI / 180)));
  const f = `<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${vbo}</Literal></PropertyIsEqualTo></Filter>`;
  const w = await getJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=bag:verblijfsobject&outputFormat=application/json&filter=${encodeURIComponent(f)}`);
  if (distM > 100) return pandsAtPoint(c);
  return {
    pandIds: [...new Set<string>(w.features.map((x: any) => x.properties.pandidentificatie))], verblijfsobject: vbo, bagAddress: d.weergavenaam,
    gebruiksdoel: w.features[0]?.properties.gebruiksdoel ?? '', bouwjaar: w.features[0]?.properties.bouwjaar ?? null, osmToAddressM: distM,
  };
}
/** Run pand-reference for the pands (cached) and read back panorama years / status per pand. */
export function referenceStatus(name: string, pandIds: string[]): Record<string, {panoramaYears: number[]; referenceStatus: string}> {
  if (!pandIds.length) return {};
  spawnSync('node', ['--import', 'tsx', 'scripts/pand-reference/run.ts', `--name=${name}`, `--ids=${pandIds.join(',')}`], {stdio: 'ignore'});
  const out: Record<string, {panoramaYears: number[]; referenceStatus: string}> = {};
  for (const id of pandIds) {
    try {
      const r = JSON.parse(fs.readFileSync(`staging/pand-reference/${id}/reference.json`, 'utf8'));
      const years = [r.primary?.missionYear, r.alt?.missionYear].filter(Boolean).map(Number);
      out[id] = {panoramaYears: [...new Set<number>(years)], referenceStatus: r.status};
    } catch { out[id] = {panoramaYears: [], referenceStatus: 'missing'}; }
  }
  return out;
}
/** Shared main: query, match, attach panorama status, write JSON. */
export async function runMatch(o: {out: string; key: string; refName: string; query: string; source: string; exclude: RegExp; addrCity?: string}) {
  const prev: any[] = fs.existsSync(o.out) ? JSON.parse(fs.readFileSync(o.out, 'utf8'))[o.key] : [];
  const j = await overpass(o.query), seen = new Set<string>();
  const els = j.elements.filter((e: any) => e.tags?.name && !o.exclude.test(e.tags.name) && !seen.has(e.tags.name) && seen.add(e.tags.name));
  const rows: any[] = [];
  for (const e of els) {
    const t = e.tags, c = e.center || e, addr = t['addr:street'] ? `${t['addr:street']} ${t['addr:housenumber']}` : '';
    const m = addr ? await matchAddress(`${addr} Amsterdam`, c) : NO_MATCH;
    const old = prev.find(p => p.osm === `${e.type}/${e.id}`) ?? {};
    rows.push({name: t.name, address: addr ? `${addr}, Amsterdam` : '(no address in OSM)', osm: `${e.type}/${e.id}`, osmLatLng: [c.lat, c.lon], ...m,
      signatureElements: old.signatureElements ?? [], sharedWith: old.sharedWith ?? '', modelStatus: old.modelStatus ?? 'pending'});
  }
  const ref = referenceStatus(o.refName, rows.flatMap(r => r.pandIds));
  for (const r of rows) {
    const x = r.pandIds.map((p: string) => ref[p]).filter(Boolean);
    r.panoramaYears = [...new Set(x.flatMap((y: any) => y.panoramaYears))]; r.referenceStatus = x.map((y: any) => y.referenceStatus).join(',') || 'no-pand';
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(o.out, JSON.stringify({generatedAt: new Date().toISOString().slice(0, 10), source: o.source, [o.key]: rows}, null, 1));
  for (const r of rows) console.log(r.name.padEnd(28), r.pandIds.join(',').padEnd(34), String(r.bouwjaar).padEnd(5), r.osmToAddressM + 'm', r.panoramaYears.join('/'), r.referenceStatus, r.bagAddress);
}
