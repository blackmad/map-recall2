/**
 * 3DBAG items for the block-face tools, with the PDOK 3D Basisvoorziening blades (same TU Delft reconstruction,
 * CC BY 4.0; `scripts/building-recipes/pdok-tiles.ts`) as the fallback when api.3dbag.nl is down.
 *
 * `BLOCK_FACE_3DBAG=pdok` forces the blades; `=api` forces the API. Unset, the API is tried first and the first
 * network failure (no HTTP status) switches the rest of the run to the blades, with one warning on stderr. PDOK items
 * carry no `b3_bouwlagen` (see `UNMAPPED_3DBAG_ATTRIBUTES`); readers already treat it as unknown.
 */
import {cachedJson} from '../pand-reference/core.ts';
import {decodeThreeDBag, type CityJsonItem, type RD} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {bladeFor, cityObjectToFeature, type CityJsonTile} from '../../src/canalRecall/buildingRecipe/pdokLod2.ts';

const forced = process.env.BLOCK_FACE_3DBAG;
let usePdok = forced === 'pdok';
const isNetworkError = (e: any) => !e?.status && /fetch failed|ECONN|ETIMEDOUT|UND_ERR|timeout/i.test(String(e?.message ?? e) + String(e?.cause?.code ?? ''));

async function viaApi<T>(fn: () => Promise<T>): Promise<T | null> {
  if (usePdok) return null;
  try { return await fn(); } catch (e) {
    if (forced === 'api' || !isNetworkError(e)) throw e;
    usePdok = true;
    console.warn(`[3dbag] api.3dbag.nl unreachable (${String((e as any)?.cause?.code ?? (e as any)?.message)}); using PDOK 3D Basisvoorziening blades for the rest of this run`);
    return null;
  }
}

const blades = new Map<string, Promise<CityJsonTile>>();
async function blade(name: string): Promise<CityJsonTile> {
  if (!blades.has(name)) blades.set(name, (async () => {
    const {ensureBlade} = await import('../building-recipes/pdok-tiles.ts');
    const fs = await import('node:fs/promises');
    return JSON.parse(await fs.readFile((await ensureBlade(name)).file, 'utf8')) as CityJsonTile;
  })());
  return blades.get(name)!;
}

/** Every Building whose LoD0 footprint bbox meets the RD bbox, as 3DBAG-shaped items (blade-edge pands deduplicated). */
export async function pdokItemsInBbox(min: RD, max: RD): Promise<CityJsonItem[]> {
  const names = new Set<string>();
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) names.add(bladeFor(x, y));
  const out: CityJsonItem[] = [], seen = new Set<string>();
  for (const name of names) {
    const tile = await blade(name), t = tile.transform;
    for (const [id, o] of Object.entries(tile.CityObjects)) {
      if (o.type !== 'Building' || seen.has(id)) continue;
      const lod0 = o.geometry?.find(g => String(g.lod) === '0');
      if (!lod0) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const s of lod0.boundaries as number[][][]) for (const r of s) for (const k of r) {
        const v = tile.vertices[k], x = v[0] * t.scale[0] + t.translate[0], y = v[1] * t.scale[1] + t.translate[1];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 < min[0] || x0 > max[0] || y1 < min[1] || y0 > max[1]) continue;
      const item = cityObjectToFeature(tile, id);
      if (!item) continue;
      const it = {feature: item.feature, metadata: item.metadata} as CityJsonItem;
      // The API serves only reconstructed pands; PDOK also lists pands without a LoD2.2 solid (sheds, demolished).
      try { decodeThreeDBag(it); } catch { continue; }
      seen.add(id); out.push(it);
    }
  }
  return out;
}

/** The 3DBAG bbox query (paged, cached), or the PDOK blades. */
export async function threeDBagBbox(min: RD, max: RD, maxPages = 20): Promise<CityJsonItem[]> {
  const api = await viaApi(async () => {
    let url: string | null = `https://api.3dbag.nl/collections/pand/items?bbox=${min[0].toFixed(0)},${min[1].toFixed(0)},${max[0].toFixed(0)},${max[1].toFixed(0)}&limit=100`;
    const items: CityJsonItem[] = [];
    for (let page = 0; url && page < maxPages; page++) {
      const json: any = await cachedJson(url);
      for (const feature of json.features ?? []) items.push({feature, metadata: json.metadata});
      url = json.links?.find((l: any) => l.rel === 'next')?.href ?? null;
    }
    return items;
  });
  return api ?? pdokItemsInBbox(min, max);
}

/** One pand's 3DBAG item ({feature, metadata}), or its PDOK cut-out. */
export async function threeDBagItem(pandId: string): Promise<CityJsonItem> {
  const api = await viaApi(() => cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pandId}`));
  if (api) return api as CityJsonItem;
  const {pdokItem} = await import('../building-recipes/pdok-tiles.ts');
  const {item} = await pdokItem(pandId);
  return {feature: item.feature, metadata: item.metadata} as CityJsonItem;
}

/** Provenance label of the source this run is using (after the first call). */
export const threeDBagSourceLabel = () => usePdok ? 'PDOK 3D Basisvoorziening 2025 blades (CC BY 4.0; api.3dbag.nl unreachable)' : '3DBAG api.3dbag.nl (CC BY 4.0)';
export const threeDBagDataset = () => usePdok ? {dataset: 'pdok-3d-basisvoorziening-2025'} : {};
