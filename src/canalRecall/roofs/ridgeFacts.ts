/**
 * The ridge-axes sidecar at runtime: a tile enricher (fetched with each z14 building tile, like roof-facts) that stamps
 * `roofRidgeDeg` (3DBAG's measured ridge direction, degrees ccw from east, whole degrees 0-179) on each BAG pand whose
 * LoD2.2 roof is a clean saddle (roofs/ridgeAxis.ts, scripts/roofs/build-ridge-axes.ts). roofMesh.ts draws the saddle
 * along it. A missing tile leaves the guess in place; `?ridgeAxes=0` turns it off.
 * Tile: `ridge-axes/14/x/y.json.gz` = { version: 1, ridge: { <pand16>: deg } }.
 */
type Feature = { properties: Record<string, unknown> };
type Tile = { z: number; x: number; y: number };
export const RIDGE_AXES_ZOOM = 14;
const PAND_PREFIX = 'NL.IMBAG.Pand.';

export const ridgeAxesEnabled = (search: string = typeof location !== 'undefined' ? location.search : ''): boolean =>
  new URLSearchParams(search).get('ridgeAxes') !== '0';

async function readJson(response: Response): Promise<unknown> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('gzip ridge axes need DecompressionStream');
    return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function applyRidgeAxes(features: Feature[], ridge: Record<string, number>): void {
  for (const f of features) {
    const id = String(f.properties?.id ?? '');
    if (!id.startsWith(PAND_PREFIX)) continue;
    const deg = ridge[id.slice(PAND_PREFIX.length)];
    if (typeof deg === 'number' && Number.isFinite(deg)) f.properties.roofRidgeDeg = deg;
  }
}

export function ridgeAxesEnricher(baseUrl: string, fetchImpl: typeof fetch = (...args) => fetch(...args), dir = 'ridge-axes') {
  const root = baseUrl.replace(/\/$/, '');
  return async (tile: Tile, signal?: AbortSignal) => {
    if (tile.z !== RIDGE_AXES_ZOOM) return (_features: Feature[]) => {};
    let ridge: Record<string, number> | null = null;
    try {
      const response = await fetchImpl(`${root}/${dir}/${tile.z}/${tile.x}/${tile.y}.json.gz`, { signal });
      if (response.ok) {
        const value = await readJson(response) as { version?: number; ridge?: Record<string, number> };
        if (value?.version === 1 && value.ridge && typeof value.ridge === 'object') ridge = value.ridge;
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
    }
    return (features: Feature[]) => { if (ridge) applyRidgeAxes(features, ridge); };
  };
}
