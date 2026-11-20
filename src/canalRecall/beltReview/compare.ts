/**
 * Belt review compare rounds (Node only): discover the blocks and layers of a round folder.
 *
 * Two folder shapes are read, the first that exists wins:
 *   A. `<root>/layers/<blockKey>/` holding `today.jpg`, `r1.jpg`, `r2.jpg`… (one image per layer) and `photo-NN.jpg`
 *      (the aimed photos; `photo-row.jpg`, when present, is the photo layer at the layers' scale; `photos.json` gives
 *      the title and a caption per photo). Optional `<root>/layers/blocks.json` (or `<root>/blocks.json`): `[{id|key, title, street}]` for
 *      order and titles; without it every directory is a block, sorted by name.
 *   B. `<root>/blocks.json` `[{id, title, street, sheet}]` and per block `<root>/<id>/<layer>/front.png` (one directory per
 *      layer) plus `sheet.jpg` (shown as the `sheet` layer). This is the design-units r2 shape of 2026-11-20.
 * Layers are ordered photo, today, r1, r2, r3…, then the rest by name, so Q/W/E/R flip photo/today/r1/r2.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { IMAGE_EXTENSIONS, readJson } from './store.ts';
import type { RoundBlock, RoundLayer, RowBoundary } from './types.ts';

const LAYER_ORDER = ['photo', 'today', 'r1', 'r2', 'r3', 'r4', 'new', 'sheet'];
export function layerRank(name: string): number {
  const i = LAYER_ORDER.indexOf(name);
  return i < 0 ? LAYER_ORDER.length : i;
}
export const sortLayers = <T extends { name: string }>(layers: T[]): T[] => [...layers].sort((a, b) => layerRank(a.name) - layerRank(b.name) || a.name.localeCompare(b.name));

interface BlockMeta { id?: string; key?: string; title?: string; street?: string }
interface PhotosJson { title?: string; layers?: { note?: string }; photos?: Array<{ file: string; pandId?: string; address?: string; date?: string; obliquityDeg?: number; usable?: boolean; rejectedBecause?: string[] }> }
/** `photo-row.json` (the overseer): each pand's x0/x1 in photo-row pixels, as `{pands: [...]}` or a bare array. Tolerant:
 *  entries without finite x0 < x1 are dropped; a missing or unreadable file gives no boundaries. */
export function parseRowBoundaries(raw: unknown): RowBoundary[] {
  const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Array.isArray((raw as { pands?: unknown }).pands)) ? (raw as { pands: unknown[] }).pands : [];
  return list.flatMap(e => {
    const o = (e ?? {}) as Record<string, unknown>, x0 = Number(o.x0), x1 = Number(o.x1);
    if (!Number.isFinite(x0) || !Number.isFinite(x1) || x1 <= x0) return [];
    const r: RowBoundary = { x0, x1 };
    if (typeof o.pandId === 'string') r.pandId = o.pandId;
    const address = o.address ?? o.label ?? o.title;
    if (typeof address === 'string') r.address = address;
    return [r];
  }).sort((a, b) => a.x0 - b.x0);
}

const isImage = (f: string) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase());
const dirs = async (p: string) => (await fs.readdir(p, { withFileTypes: true }).catch(() => [])).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name).sort();
const files = async (p: string) => (await fs.readdir(p, { withFileTypes: true }).catch(() => [])).filter(d => d.isFile() && isImage(d.name)).map(d => d.name).sort();

/** `fileUrl(rel)` makes the URL the page loads `rel` (relative to the round root) from. */
export async function discoverRound(root: string, fileUrl: (rel: string) => string): Promise<{ exists: boolean; blocks: RoundBlock[] }> {
  const exists = await fs.access(root).then(() => true, () => false);
  if (!exists) return { exists, blocks: [] };
  const layersDir = path.join(root, 'layers');
  const metaList = (await readJson<BlockMeta[] | null>(path.join(layersDir, 'blocks.json'), null)) ?? (await readJson<BlockMeta[] | null>(path.join(root, 'blocks.json'), null)) ?? [];
  const meta = new Map(metaList.map(m => [m.key ?? m.id ?? '', m]));
  const order = (keys: string[]) => {
    const listed = metaList.map(m => m.key ?? m.id ?? '').filter(k => keys.includes(k));
    return [...listed, ...keys.filter(k => !listed.includes(k))];
  };
  const block = (key: string, layers: RoundLayer[], photos: RoundLayer[]): RoundBlock => {
    const m = meta.get(key);
    return { key, title: m?.title ?? key, ...(m?.street ? { street: m.street } : {}), layers: sortLayers(layers), photos };
  };

  const shapeA = await dirs(layersDir);
  if (shapeA.length) {
    const blocks: RoundBlock[] = [];
    for (const key of order(shapeA)) {
      const names = await files(path.join(layersDir, key));
      const rel = (f: string) => fileUrl(path.posix.join('layers', key, f));
      // photos.json (the overseer's export): title and one record per photo-NN (pand, date, obliquity, usable).
      const info = await readJson<PhotosJson | null>(path.join(layersDir, key, 'photos.json'), null);
      const caption = (f: string) => {
        const p = info?.photos?.find(x => x.file === f);
        if (!p) return undefined;
        const parts = [p.address ?? (p.pandId ? `pand ${p.pandId.slice(-6)}` : null), p.date, p.obliquityDeg !== undefined ? `${Math.round(p.obliquityDeg)}° off square` : null, p.usable === false ? `flagged: ${(p.rejectedBecause ?? []).join(', ') || 'unusable'}` : null];
        return parts.filter(Boolean).join(' · ');
      };
      const photos = names.filter(f => /^photo-\d+\./i.test(f)).map(f => ({ name: f.replace(/\.[^.]+$/, ''), url: rel(f), caption: caption(f) }));
      // `photo-row` (the photos stitched at the layers' scale and left edge) is the photo layer; else the first photo.
      const layers = names.filter(f => !/^photo-\d+\./i.test(f)).map(f => ({ name: /^photo-row\./i.test(f) ? 'photo' : f.replace(/\.[^.]+$/, ''), url: rel(f) }));
      if (photos.length && !layers.some(l => l.name === 'photo')) layers.push({ name: 'photo', url: photos[0].url });
      const b = block(key, layers, photos);
      if (info?.title && !meta.get(key)?.title) b.title = info.title;
      if (info?.layers?.note) b.note = info.layers.note;
      const bounds = parseRowBoundaries(await readJson<unknown>(path.join(layersDir, key, 'photo-row.json'), null));
      if (bounds.length) b.boundaries = bounds;
      blocks.push(b);
    }
    return { exists, blocks };
  }

  const blocks: RoundBlock[] = [];
  const keys = order((await dirs(root)).filter(k => k !== 'layers'));
  for (const key of keys) {
    const dir = path.join(root, key), layers: RoundLayer[] = [], photos: RoundLayer[] = [];
    for (const sub of await dirs(dir)) {
      const imgs = await files(path.join(dir, sub));
      const pick = imgs.find(f => /^front\./i.test(f)) ?? imgs[0];
      if (pick) layers.push({ name: sub, url: fileUrl(path.posix.join(key, sub, pick)) });
    }
    for (const f of await files(dir)) {
      const name = f.replace(/\.[^.]+$/, '');
      if (/^photo-\d+$/i.test(name)) photos.push({ name, url: fileUrl(path.posix.join(key, f)) });
      else layers.push({ name, url: fileUrl(path.posix.join(key, f)) });
    }
    if (photos.length && !layers.some(l => l.name === 'photo')) layers.push({ name: 'photo', url: photos[0].url });
    if (layers.length) blocks.push(block(key, layers, photos));
  }
  return { exists, blocks };
}
