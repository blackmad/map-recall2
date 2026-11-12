// Fetch the geometry of the reviewed BGT erf exceptions (src/canalRecall/routing/bgtPlazas.ts ERF_EXCEPTIONS) from the
// PDOK OGC API and write scripts/routing/bgt-erf-exceptions.json, in the per-feature shape of the BGT cell files.
//   npx tsx scripts/routing/fetch-bgt-erf-exceptions.ts
// BGT: Kadaster, CC0 1.0. datetime 2026-11-10 matches the plaza inputs.
import { writeFileSync } from 'node:fs';
import { ERF_EXCEPTIONS } from '../../src/canalRecall/routing/bgtPlazas.ts';

const OUT = 'scripts/routing/bgt-erf-exceptions.json';
const features: unknown[] = [];
for (const e of ERF_EXCEPTIONS) {
  const [lat, lon] = e.at;
  const url = `https://api.pdok.nl/lv/bgt/ogc/v1/collections/onbegroeidterreindeel/items?f=json&limit=200&datetime=2026-11-10T00:00:00Z&bbox=${lon - 0.0003},${lat - 0.0003},${lon + 0.0003},${lat + 0.0003}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDOK ${res.status} for ${e.id}`);
  const hit = ((await res.json()) as { features: Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates: any } }> }).features
    .find(f => f.properties.lokaal_id === e.id);
  if (!hit) throw new Error(`${e.id} (${e.feedback}) not found near ${e.at}`);
  const p = hit.properties;
  if (p.fysiek_voorkomen !== 'erf') throw new Error(`${e.id} is ${p.fysiek_voorkomen}, not erf`);
  const g = hit.geometry.type === 'Polygon' ? [hit.geometry.coordinates] : hit.geometry.coordinates;
  features.push({ id: e.id, fv: p.fysiek_voorkomen, h: p.relatieve_hoogteligging, status: p.status ?? null, eind: p.eind_registratie ?? null, feedback: e.feedback, g });
}
writeFileSync(OUT, JSON.stringify({ source: 'BGT onbegroeidterreindeel 2026-11-10 (Kadaster, CC0 1.0, PDOK OGC API)', features }) + '\n');
console.log(`wrote ${OUT}: ${features.length} polygons`);
