import path from 'node:path';
import { readJson, digest } from './pipeline-state.mjs';

export const AREA_PRESETS = {
  'da-costa-block': { version: 1, id: 'da-costa-block', bbox: [4.87165, 52.37115, 4.87545, 52.37365], origin: [4.87355, 52.3723], cacheRoot: '.cache/da-costa-block', outputRoot: 'public/data/da-costa-block', panorama: { center: [4.87365, 52.3724], radiusM: 180, after: '2022-01-01' } },
  elandsgracht: { version: 1, id: 'elandsgracht', bbox: [4.8773, 52.36835, 4.8839, 52.3708], origin: [4.8806, 52.3696], cacheRoot: '.cache/elandsgracht', outputRoot: 'public/data/elandsgracht', panorama: { center: [4.8806, 52.3696], radiusM: 290, after: '2024-01-01' } },
};
export function validateAreaConfig(value) {
  if (value?.version !== 1 || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(value.id ?? '')) throw Error('Area config needs version 1 and a stable lowercase ID');
  const bbox = value.bbox;
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite) || bbox[0] >= bbox[2] || bbox[1] >= bbox[3] || bbox[0] < -180 || bbox[2] > 180 || bbox[1] < -90 || bbox[3] > 90) throw Error('Area bbox must be ordered WGS84 west,south,east,north');
  const origin = value.origin ?? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  if (!Array.isArray(origin) || origin.length !== 2 || !origin.every(Number.isFinite) || origin[0] < bbox[0] || origin[0] > bbox[2] || origin[1] < bbox[1] || origin[1] > bbox[3]) throw Error('Area origin must lie inside bbox');
  const center = value.panorama?.center ?? origin;
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite) || Math.abs(center[0]) > 180 || Math.abs(center[1]) > 90) throw Error('Invalid panorama center');
  const meters = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos(center[1] * Math.PI / 180), (a[1] - b[1]) * 111320);
  const radiusM = value.panorama?.radiusM ?? Math.ceil(Math.max(...[[bbox[0], bbox[1]], [bbox[0], bbox[3]], [bbox[2], bbox[1]], [bbox[2], bbox[3]]].map(corner => meters(corner, center))) + 30);
  const after = value.panorama?.after ?? '2022-01-01';
  if (!Number.isFinite(radiusM) || radiusM <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(after) || !Number.isFinite(Date.parse(after))) throw Error('Invalid panorama radius or date');
  const cacheRoot = value.cacheRoot ?? `.cache/city-appearance/areas/${value.id}/raw`;
  const outputRoot = value.outputRoot ?? `public/data/areas/${value.id}`;
  for (const directory of [cacheRoot, outputRoot]) if (typeof directory !== 'string' || !directory || [path.parse(path.resolve(directory)).root, process.cwd()].includes(path.resolve(directory))) throw Error('Area directories must not be filesystem or workspace roots');
  return { version: 1, id: value.id, bbox, origin, cacheRoot, outputRoot, panorama: { center, radiusM, after }, concurrency: value.concurrency ?? 4 };
}
export async function loadAreaConfig(args = process.argv.slice(2)) {
  const file = args.find(value => value.startsWith('--area-config='))?.slice('--area-config='.length);
  const preset = args.find(value => value.startsWith('--area='))?.slice('--area='.length) ?? (args.includes('--elandsgracht') ? 'elandsgracht' : 'da-costa-block');
  if (!file && !AREA_PRESETS[preset]) throw Error(`Unknown area ${preset}; provide --area-config=path.json`);
  const area = validateAreaConfig(file ? await readJson(file) : structuredClone(AREA_PRESETS[preset]));
  if (!Number.isInteger(area.concurrency) || area.concurrency < 1 || area.concurrency > 4) throw Error('Public acquisition concurrency must be 1–4');
  return { ...area, configHash: digest(area), referencePreset: file ? null : preset };
}
