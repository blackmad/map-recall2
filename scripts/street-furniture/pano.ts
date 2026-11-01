// Panorama views of a street-furniture object (Gemeente Amsterdam panoramas, CC BY 4.0), for measuring and for the
// likeness sheets:
//
//   npx tsx scripts/street-furniture/pano.ts --at=<lng>,<lat> [--out=staging/street-furniture/x.jpg] [--fov=50] [--pitch=-8] [--min=3] [--max=14]
//
// Picks the nearest street-level (not boat) panorama between --min and --max metres, crops a perspective view aimed
// at the object (scripts/street-appearance/perspective.ts), caches the equirectangular under
// artifacts/street-furniture/panos/. Prints JSON: pano id, url, timestamp, distance, bearing, out path.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { perspectiveCrop } from '../street-appearance/perspective.ts';

const CACHE = 'artifacts/street-furniture/panos';
const KX = (lat: number) => 111320 * Math.cos(lat * Math.PI / 180), KY = 110540;

export type PanoPick = { panoId: string; url: string; timestamp: string; distanceM: number; bearingDeg: number; lng: number; lat: number; heightM: number };

async function json(url: string): Promise<any> {
  for (let i = 0; ; i++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    if (i > 4) throw new Error(`${r.status} ${url}`);
    await new Promise(res => setTimeout(res, 1500 * (i + 1)));
  }
}

export async function pickPanos(lng: number, lat: number, minM = 3, maxM = 14): Promise<PanoPick[]> {
  const url = `https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng.toFixed(6)},${lat.toFixed(6)}&radius=${Math.ceil(maxM)}&srid=4326&page_size=200`;
  const j = await json(url);
  const out: PanoPick[] = [];
  for (const p of j._embedded?.panoramas ?? []) {
    if ((p.tags ?? []).includes('surface-water')) continue;
    const [plng, plat, h] = p.geometry.coordinates;
    const dx = (lng - plng) * KX(lat), dy = (lat - plat) * KY, d = Math.hypot(dx, dy);
    if (d < minM || d > maxM) continue;
    out.push({ panoId: p.pano_id, url: p._links.equirectangular_medium.href, timestamp: p.timestamp, distanceM: +d.toFixed(2), bearingDeg: +(((Math.atan2(dx, dy) * 180 / Math.PI) + 360) % 360).toFixed(1), lng: plng, lat: plat, heightM: h });
  }
  // Newest mission first, then nearest to 7 m (close enough to measure, far enough to see the whole post).
  return out.sort((a, b) => b.timestamp.slice(0, 4).localeCompare(a.timestamp.slice(0, 4)) || Math.abs(a.distanceM - 7) - Math.abs(b.distanceM - 7));
}

export async function panoBytes(pick: PanoPick): Promise<Buffer> {
  mkdirSync(CACHE, { recursive: true });
  const file = `${CACHE}/${pick.panoId}.jpg`;
  if (!existsSync(file)) { const r = await fetch(pick.url); if (!r.ok) throw new Error(`${r.status} ${pick.url}`); writeFileSync(file, Buffer.from(await r.arrayBuffer())); }
  return readFileSync(file);
}

export async function panoView(lng: number, lat: number, o: { fov?: number; pitch?: number; min?: number; max?: number; width?: number; height?: number; nth?: number } = {}): Promise<{ pick: PanoPick; jpeg: Buffer } | null> {
  const picks = await pickPanos(lng, lat, o.min ?? 3, o.max ?? 14);
  const pick = picks[Math.min(o.nth ?? 0, picks.length - 1)];
  if (!pick) return null;
  const jpeg = perspectiveCrop(await panoBytes(pick), pick.bearingDeg, o.width ?? 900, o.height ?? 900, o.fov ?? 50, o.pitch ?? -8);
  return { pick, jpeg };
}

async function main(): Promise<void> {
  const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const [lng, lat] = (arg('at') ?? '').split(',').map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error('--at=<lng>,<lat>');
  const num = (n: string) => arg(n) === undefined ? undefined : Number(arg(n));
  const v = await panoView(lng, lat, { fov: num('fov'), pitch: num('pitch'), min: num('min'), max: num('max'), nth: num('nth'), width: num('width'), height: num('height') });
  if (!v) { console.log(JSON.stringify({ error: 'no street panorama in range' })); return; }
  const out = arg('out') ?? `staging/street-furniture/pano-${v.pick.panoId}.jpg`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, v.jpeg);
  console.log(JSON.stringify({ ...v.pick, out }));
}

if (process.argv[1]?.endsWith('pano.ts')) void main();
