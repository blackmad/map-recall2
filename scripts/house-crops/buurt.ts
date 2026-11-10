/** Buurt membership for the crop pipeline: which BAG pands lie in one CBS buurt (coverage-v1 outline, centroid test). */
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadTile, lngLatToRd, type Footprint, type Rd } from '../pand-reference/core.ts';

const EXTRACT = path.resolve('public/data/extracts/amsterdam');
export type Buurt = { code: string; cbsCode: string; name: string; gebied: string | null; rings: Rd[][] };

export const centroid = (ring: Rd[]): Rd => ({ x: ring.reduce((s, p) => s + p.x, 0) / ring.length, y: ring.reduce((s, p) => s + p.y, 0) / ring.length });
function inRing(p: Rd, ring: Rd[]) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    if ((ring[i].y > p.y) !== (ring[j].y > p.y) && p.x < (ring[j].x - ring[i].x) * (p.y - ring[i].y) / (ring[j].y - ring[i].y) + ring[i].x) yes = !yes;
  return yes;
}

/** `key` matches the 4-letter code (AB10), the CBS code (BU0363AB10) or the buurt name, case-insensitively. */
export async function loadBuurt(key: string): Promise<Buurt> {
  const all = JSON.parse(await fs.readFile(path.join(EXTRACT, 'coverage-v1/buurten.json'), 'utf8')).features as any[];
  const k = key.toLowerCase();
  const f = all.find(x => [x.properties.code, x.properties.cbsCode, x.properties.name].some((v: string) => String(v).toLowerCase() === k));
  if (!f) throw new Error(`no buurt matches "${key}" in coverage-v1/buurten.json`);
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings: Rd[][] = polys.map((poly: number[][][]) => poly[0].map(q => lngLatToRd([q[0], q[1]])));
  return { code: f.properties.code, cbsCode: f.properties.cbsCode, name: f.properties.name, gebied: f.properties.gebied ?? null, rings };
}

/** BAG pands (NL.IMBAG.Pand.*) whose footprint centroid lies in the buurt, sorted by id. */
export async function pandsInBuurt(b: Buurt): Promise<Footprint[]> {
  const xs = b.rings.flat().map(p => p.x), ys = b.rings.flat().map(p => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs) - 50, Math.max(...xs) + 50, Math.min(...ys) - 50, Math.max(...ys) + 50];
  const root = path.join(EXTRACT, 'building-tiles/14'), out: Footprint[] = [];
  for (const xd of await fs.readdir(root)) for (const f of await fs.readdir(path.join(root, xd))) {
    for (const fp of await loadTile(Number(xd), Number(f.split('.')[0]))) {
      if (!fp.id.startsWith('NL.IMBAG.Pand.') || !fp.ring.length) continue;
      const c = centroid(fp.ring);
      if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
      if (b.rings.some(r => inRing(c, r))) out.push(fp);
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Pand ids (16 digits) named by a hand intent: block-face faces and per-house recipes. */
export async function handIntentPandIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const dir of ['scripts/block-face/faces', 'scripts/building-recipes/houses']) {
    for (const d of await fs.readdir(dir).catch(() => [] as string[])) {
      const text = await fs.readFile(path.join(dir, d, 'intent.json'), 'utf8').catch(() => '');
      for (const m of text.matchAll(/(?:NL\.IMBAG\.Pand\.)?(0363100012\d{6})/g)) ids.add(m[1]);
    }
  }
  return ids;
}
