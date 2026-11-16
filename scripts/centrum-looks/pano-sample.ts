/** Panorama coverage sample per Centrum wijk: 20 seeded non-minor pands per wijk, panoramas (any year) and winter/recent
 *  captures within 35 m of the pand centroid (data.amsterdam.nl panorama API, 600 ms apart, repo URL as contact).
 *   node --import tsx scripts/centrum-looks/pano-sample.ts [--out=artifacts/centrum-looks/pano-sample.json] */
import fs from 'node:fs';
import { districtPands } from '../buurt-generators/generate.ts';
const fc = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/coverage-v1/buurten.json', 'utf8'));
const wijken = new Map<string, string[]>();
for (const f of fc.features) if (f.properties.stadsdeel === 'Centrum') (wijken.get(f.properties.wijk) ?? wijken.set(f.properties.wijk, []).get(f.properties.wijk)!).push(f.properties.code);
const h = (s: string) => { let x = 0x811c9dc5; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x; };
const out: Record<string, unknown> = {};
for (const [w, codes] of wijken) {
  const ps = districtPands({ buurten: codes } as never).filter(p => p.heightM && p.heightM > 5).sort((a, b) => h(a.id) - h(b.id)).slice(0, 20);
  let hit = 0, recent = 0, n = 0;
  for (const p of ps) {
    const cx = p.ring.reduce((t, c) => t + c[0], 0) / p.ring.length, cy = p.ring.reduce((t, c) => t + c[1], 0) / p.ring.length;
    const url = `https://api.data.amsterdam.nl/panorama/panoramas/?near=${cx.toFixed(6)},${cy.toFixed(6)}&radius=35&srid=4326&page_size=100`;
    try {
      const j = await (await fetch(url, { headers: { 'User-Agent': 'map-recall2 (https://github.com/blackmad/map-recall2)' } })).json() as any;
      n++; if (j.count > 0) hit++;
      if ((j._embedded?.panoramas ?? []).some((q: any) => String(q.timestamp ?? '') >= '2022')) recent++;
    } catch { /* skip */ }
    await new Promise(r => setTimeout(r, 600));
  }
  out[w] = { sampled: n, withPano: hit, with2022plus: recent };
  console.log(w, JSON.stringify(out[w]));
}
fs.mkdirSync('artifacts/centrum-looks', { recursive: true });
fs.writeFileSync(process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'artifacts/centrum-looks/pano-sample.json', JSON.stringify(out, null, 1));
