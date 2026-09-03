/** Cache BAG-keyed semantic LoD2.2 wall planes for the façade point-cloud pilot. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractFacadeWallPlanes, extractRoofPlanes } from '../src/canalRecall/building/facadePointCloud.ts';

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/building-enrichment/panorama');
const limit = Number(arg('limit') || 30);
const buildingIdsFile = arg('building-ids');
const buildingIds = buildingIdsFile
  ? (JSON.parse(await readFile(path.resolve(buildingIdsFile), 'utf8')) as string[]).slice(0, limit)
  : [...new Set((JSON.parse(await readFile(path.join(root, 'wide-crop-manifest.json'), 'utf8')) as { crops: Array<{ buildingId: string }> })
    .crops.map((crop) => crop.buildingId))].slice(0, limit);
const output = path.join(root, 'facade-wall-planes.json');
type CachedBuilding = { buildingId: string; endpoint: string; attributes: Record<string, unknown>; walls: ReturnType<typeof extractFacadeWallPlanes>; roofs: ReturnType<typeof extractRoofPlanes> };
type Rejection = { buildingId: string; reason: string; endpoint: string };
let previous: { buildings?: CachedBuilding[]; rejections?: Rejection[] } = {};
try { previous = JSON.parse(await readFile(output, 'utf8')); } catch { /* resumable cache starts empty */ }
const byBuilding = new Map((previous.buildings || []).map((building) => [building.buildingId, building]));
const rejections = new Map((previous.rejections || []).map((rejection) => [rejection.buildingId, rejection]));
const pending = buildingIds.filter((buildingId) => !byBuilding.get(buildingId)?.roofs);
for (let offset = 0; offset < pending.length; offset += 4) {
  const fetched = await Promise.all(pending.slice(offset, offset + 4).map(async (buildingId): Promise<CachedBuilding | Rejection> => {
    const bagId = buildingId.replace('bag:', '');
    const endpoint = `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${bagId}`;
    let response: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try { response = await fetch(endpoint, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) }); } catch { response = null; }
      if (response?.ok || (response && response.status < 500)) break;
    }
    if (!response?.ok) return { buildingId, endpoint, reason: response ? `http-${response.status}` : 'network-or-timeout' };
    const source = await response.json();
    const walls = extractFacadeWallPlanes(source); const roofs = extractRoofPlanes(source);
    const attributes = source.feature?.CityObjects?.[`NL.IMBAG.Pand.${bagId}`]?.attributes || {};
    return { buildingId, endpoint, attributes, walls, roofs };
  }));
  for (const result of fetched) {
    if ('reason' in result) rejections.set(result.buildingId, result);
    else { byBuilding.set(result.buildingId, result); rejections.delete(result.buildingId); }
  }
  const manifest = { schemaVersion: 2, generatedAt: new Date().toISOString(), source: { name: '3DBAG API', crs: 'EPSG:7415', geometry: 'LoD2.2 semantic exterior WallSurface and RoofSurface' }, buildings: [...byBuilding.values()], rejections: [...rejections.values()] };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(`${output}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(`${output}.tmp`, output);
}
process.stdout.write(`Cached 3DBAG walls for ${byBuilding.size} buildings; ${rejections.size} rejected.\n`);
