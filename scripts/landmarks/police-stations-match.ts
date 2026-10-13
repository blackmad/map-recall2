/**
 * Match Amsterdam police bureaus (OSM amenity=police) to BAG pand ids. Open data only:
 * OSM via Overpass, PDOK Locatieserver (address -> adresseerbaarobject), PDOK BAG WFS (verblijfsobject -> pand).
 *   node --import tsx scripts/landmarks/police-stations-match.ts   (writes scripts/landmarks/police-stations.json base)
 */
import fs from 'node:fs';
const UA = 'map-recall2-police-lane/1.0 (whizziwig@gmail.com)';
const OUT = 'scripts/landmarks/police-stations.json';
const q = `[out:json][timeout:60];nwr["amenity"="police"](52.27,4.72,52.44,5.05);out center tags;`;
const MIRRORS = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter'];
async function overpass() {
  for (const m of MIRRORS) { try { const r = await fetch(m, { method: 'POST', signal: AbortSignal.timeout(45000), headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }); const t = await r.text(); if (t.startsWith('{')) return JSON.parse(t); } catch {} }
  throw new Error('overpass failed');
}
const j = await overpass();
const wanted = (e: any) => /^Politie(bureau|post)|^Hoofdbureau|^Politie Amsterdam/.test(e.tags.name || '') && !/Amstelveen|Zaandam|Weesp|Halfweg|Amstelland-Oost/.test(e.tags.name);
const rows: any[] = [];
for (const e of j.elements.filter(wanted)) {
  const t = e.tags, c = e.center || e;
  const addr = `${t['addr:street']} ${t['addr:housenumber']}`;
  const g: any = await (await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(addr + ' Amsterdam')}&fq=type:adres&rows=1&fl=*`, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': UA } })).json();
  const d = g.response.docs[0];
  let pandIds: string[] = [], vbo = '', gebruiksdoel = '', bouwjaar: number | null = null, matchedAddress = d?.weergavenaam ?? '', distM: number | null = null;
  if (d) {
    vbo = d.adresseerbaarobject_id;
    const [lon, lat] = d.centroide_ll.match(/[-\d.]+/g).map(Number);
    distM = Math.round(Math.hypot((lat - c.lat) * 111320, (lon - c.lon) * 111320 * Math.cos(lat * Math.PI / 180)));
    const f = `<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${vbo}</Literal></PropertyIsEqualTo></Filter>`;
    const w: any = await (await fetch(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=bag:verblijfsobject&outputFormat=application/json&filter=${encodeURIComponent(f)}`, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': UA } })).json();
    pandIds = [...new Set<string>(w.features.map((x: any) => x.properties.pandidentificatie))];
    gebruiksdoel = w.features[0]?.properties.gebruiksdoel ?? ''; bouwjaar = w.features[0]?.properties.bouwjaar ?? null;
  }
  rows.push({ name: t.name, address: `${addr}, ${t['addr:city'] ?? 'Amsterdam'}`, osm: `${e.type}/${e.id}`, osmLatLng: [c.lat, c.lon], pandIds, verblijfsobject: vbo, bagAddress: matchedAddress, gebruiksdoel, bouwjaar, osmToAddressM: distM });
}
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), source: 'OSM amenity=police (Overpass), PDOK Locatieserver + BAG WFS', stations: rows }, null, 1));
for (const r of rows) console.log(r.name.padEnd(40), r.pandIds.join(','), r.gebruiksdoel, r.bouwjaar, r.osmToAddressM + 'm', r.bagAddress);
