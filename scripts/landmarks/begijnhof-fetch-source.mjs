// Builds scripts/landmarks/begijnhof-source.json: BAG rings (from the BAG-keyed base tiles' index via _scratch dump) + 3DBAG heights per court pand.
// usage: node scripts/landmarks/begijnhof-fetch-source.mjs   (reads _scratch/begijn-rings.json written by _scratch/begijn-rings.ts)
import fs from 'node:fs';

const SHORT = ['12175497', '12175502', '12175511', '12175035', '12175503', '12175504', '12168061', '12168197', '12175729', '12175667', '12175668', '12168146', '12175500', '12175499', '12175501', '12175596', '12175602'];
const rings = JSON.parse(fs.readFileSync('_scratch/begijn-rings.json', 'utf8'));
const out = [];
for (const s of SHORT) {
  const id = '03631000' + s;
  const r = rings.find(x => x.id === id);
  if (!r) { console.error('no ring', id); continue; }
  const res = await fetch(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${id}`, {headers: {'User-Agent': 'map-recall-landmark-lane'}});
  if (!res.ok) { console.error('3dbag', id, res.status); continue; }
  const j = await res.json();
  const a = j.feature?.CityObjects ? Object.values(j.feature.CityObjects).find(o => o.type === 'Building')?.attributes : j.attributes;
  out.push({id, ring: r.ring, groundM: a?.b3_h_maaiveld ?? null, eaveM: a?.b3_h_dak_50p ?? null, ridgeM: a?.b3_h_nok ?? a?.b3_h_dak_max ?? null, year: a?.oorspronkelijkbouwjaar ?? null, roof: a?.b3_dak_type ?? null});
  console.log(id, out.at(-1).groundM, out.at(-1).eaveM, out.at(-1).ridgeM, out.at(-1).year, out.at(-1).roof);
}
fs.writeFileSync('scripts/landmarks/begijnhof-source.json', JSON.stringify({anchor: [4.8905, 52.3694], source: 'BAG pand footprints (CC0) and 3DBAG heights (CC BY 4.0)', pands: out}, null, 1));
