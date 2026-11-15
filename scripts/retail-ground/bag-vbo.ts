// BAG verblijfsobjecten near a point (PDOK BAG OGC API v2, CC0), slimmed to what retailAddress.ts matches on and
// cached per key under .cache/retail-ground/vbo/. Shared by build-templates.ts --addresses and second-sources.ts.
import fs from 'node:fs';
import path from 'node:path';
import type { Vbo } from '../../src/canalRecall/retailAddress.ts';

export const VBO_DIR = '.cache/retail-ground/vbo', VBO_BOX_M = 30;
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;

export async function vbosNear(key: string, lon: number, lat: number): Promise<Vbo[] | null> {
  fs.mkdirSync(VBO_DIR, { recursive: true });
  const file = path.join(VBO_DIR, `${key.replace(/[^\w.-]/g, '_')}.json`);
  if (!fs.existsSync(file)) {
    const dLat = VBO_BOX_M / KY, dLon = VBO_BOX_M / KX;
    const url = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?f=json&limit=1000&bbox=${(lon - dLon).toFixed(6)},${(lat - dLat).toFixed(6)},${(lon + dLon).toFixed(6)},${(lat + dLat).toFixed(6)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)' } });
    if (!res.ok) return null;
    const j = await res.json() as { features: Array<{ properties: Record<string, unknown>; geometry: { coordinates: [number, number] } }> };
    const slim: Vbo[] = j.features.map(f => ({ street: String(f.properties.openbare_ruimte_naam ?? ''), short: String(f.properties.openbare_ruimte_naam_kort ?? ''), nr: Number(f.properties.huisnummer), letter: (f.properties.huisletter as string | null) ?? null, add: (f.properties.toevoeging as string | null) ?? null, use: String(f.properties.gebruiksdoel ?? ''), m2: Number(f.properties.oppervlakte ?? 0), at: [+f.geometry.coordinates[0].toFixed(7), +f.geometry.coordinates[1].toFixed(7)] }));
    fs.writeFileSync(file, JSON.stringify({ url, fetched: new Date().toISOString().slice(0, 10), vbos: slim }));
  }
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { vbos: Vbo[] }).vbos;
}
