// Shared city loaders for the lane-FD CLIs (industrial audit, street faces). Node only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buurtLocator, bboxOf, polygonsOf, ringAreaM2, type Buurt, type Ring } from '../../src/canalRecall/coverage/coverage.ts';
import { addFeatures, emptyIndex, resolveSuppressed } from '../../src/canalRecall/bagPandIndex.ts';
import { fullPandId } from '../../src/canalRecall/bagTiles.ts';
import { KITS, kitIds } from '../../src/canalRecall/landmarkKits.ts';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

export interface CityPand { id: string; short: string; ring: Ring; centroid: [number, number]; areaM2: number; heightM: number; year: number | null }

/** Every BAG pand of the base tiles (bag-tiles/14), deduplicated by id. */
export function loadPands(): { pands: Map<string, CityPand>; features: any[] } {
  const dir = path.join(EXTRACT, 'bag-tiles/14');
  const pands = new Map<string, CityPand>(), all: any[] = [];
  for (const x of fs.readdirSync(dir).filter(n => /^\d+$/.test(n))) for (const file of fs.readdirSync(path.join(dir, x)).filter(n => n.endsWith('.geojson.gz'))) {
    const features = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, x, file))).toString('utf8')).features;
    all.push(...features);
    for (const f of features) {
      const id = String(f.properties?.id ?? '');
      if (!id.startsWith('NL.IMBAG.Pand.') || pands.has(id)) continue;
      const poly = polygonsOf(f.geometry ?? { type: '', coordinates: [] });
      const ring = poly.length ? poly.reduce((a, b) => (b[0].length > a[0].length ? b : a))[0] : null;
      if (!ring?.length) continue;
      const open = ring.slice(0, -1);
      const centroid: [number, number] = [open.reduce((s, p) => s + p[0], 0) / open.length, open.reduce((s, p) => s + p[1], 0) / open.length];
      const year = Number(f.properties.year);
      pands.set(id, { id, short: id.slice(14), ring, centroid, areaM2: poly.reduce((s, p) => s + ringAreaM2(p[0]), 0), heightM: Number(f.properties.height) || 0, year: year >= 1200 && year <= 2030 ? year : null });
    }
  }
  return { pands, features: all };
}

export interface BuurtInfo { code: string; name: string; stadsdeel: string }
export function loadBuurtLocator(): { locate: (pt: [number, number]) => BuurtInfo | null } {
  const fc = readJson(path.join(EXTRACT, 'coverage-v1/buurten.json'));
  const info = new Map<string, BuurtInfo>(), buurten: Buurt[] = [];
  for (const f of fc.features) {
    const polygons = polygonsOf(f.geometry);
    buurten.push({ code: f.properties.code, name: f.properties.name, polygons, bbox: bboxOf(polygons) });
    info.set(f.properties.code, { code: f.properties.code, name: f.properties.name, stadsdeel: f.properties.stadsdeel ?? '?' });
  }
  const loc = buurtLocator(buurten);
  return { locate: pt => { const c = loc(pt); return c ? info.get(c) ?? null : null; } };
}

/**
 * Pands any non-generic coverage tier claims (build-coverage.ts: placed models and chunks via covers.json and each
 * spec's suppress ids, building types, landmark kits). The complement is the generic set coverage-v1 counts.
 */
export async function claimedPandIds(features: any[]): Promise<Set<string>> {
  const { allSpecs } = await import('../lib/placedFootprints.ts');
  const index = emptyIndex();
  addFeatures(index, features);
  const covers = readJson(path.join(ROOT, 'public/canal-drive/models/covers.json')) as { models: Record<string, { p: string[] }> };
  const claimed = new Set<string>();
  for (const spec of allSpecs()) {
    for (const p of covers.models[spec.id]?.p ?? []) claimed.add(fullPandId(p));
    for (const p of resolveSuppressed(index, spec.suppressOsmIds.map(String)).pands) claimed.add(p);
  }
  for (const i of readJson(path.join(ROOT, 'public/canal-drive/building-types/instances.json')) as { pand: string }[]) claimed.add(fullPandId(i.pand));
  for (const kit of KITS) for (const p of resolveSuppressed(index, kitIds(kit)).pands) claimed.add(p);
  return claimed;
}
