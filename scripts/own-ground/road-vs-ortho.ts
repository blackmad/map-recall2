// The R4 gate's artefact (lane roads-lanes 2026-10-23): per roadRegressions ROAD_SPOTS entry, one JPEG
// artifacts/roads/<spot>-vs-ortho.jpg: the PDOK 8 cm orthophoto | the own ground top-down in the game's palette (as
// built now, roads-v1 on, LOD 0) | the latest game frame of the spot (tests/e2e/own-ground-roads.spec.ts, chase view,
// desktop, from `frames`, else $ROADS_SHOTS_OUT, else the spec's default artifacts/own-ground-roads/bgt: <dir>/desktop-<id>.png) when there is one. check-ground-cells writes it for every spot.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import type { BuiltCell, GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import type { RoadSpot } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import { rasterTopDown } from './render-topdown.ts';
import { paletteColours } from './road-look-v2.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';

export const VS_ORTHO_DIR = 'artifacts/roads';
export const vsOrthoPath = (id: string, dir = VS_ORTHO_DIR) => join(dir, `${id}-vs-ortho.jpg`);

/** Write <dir>/<id>-vs-ortho.jpg; returns its path. `note`: one line under the images (the gate's numbers). */
export async function writeVsOrtho(cells: readonly BuiltCell[], s: RoadSpot, ortho: OrthoTiles, opts: { dir?: string; frames?: string; note?: string; colours?: Partial<Record<GroundLayer, readonly number[]>> } = {}): Promise<string> {
  const res = 0.1, [x, y] = toLocal(s.at[0], s.at[1]), w = Math.round(2 * s.halfM / res), x0 = x - s.halfM, y0 = y - s.halfM;
  const tile = 560, frameW = 896, gap = 4, head = 28, foot = 26, W = 2 * tile + frameW + 2 * gap;
  const raw = (b: Uint8Array) => sharp(Buffer.from(b), { raw: { width: w, height: w, channels: 3 } }).resize(tile, tile).png().toBuffer();
  const o = await ortho.crop(x0, y0, w, w, res);
  const top = rasterTopDown(cells, x0, y0, w, w, res, opts.colours ?? (paletteColours() as Partial<Record<GroundLayer, readonly number[]>>));
  const framePath = join(opts.frames ?? process.env.ROADS_SHOTS_OUT ?? 'artifacts/own-ground-roads/bgt', `desktop-${s.id}.png`);
  const frame = existsSync(framePath)
    ? await sharp(framePath).resize(frameW, tile, { fit: 'cover' }).png().toBuffer()
    : await sharp({ create: { width: frameW, height: tile, channels: 3, background: '#333' } }).png().toBuffer();
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const titles: [string, number][] = [[`${s.id}: PDOK 8 cm orthophoto`, tile / 2], ['own ground now (top-down, game palette)', tile + gap + tile / 2], [existsSync(framePath) ? 'game frame (chase, desktop)' : 'no game frame (run own-ground-roads.spec)', 2 * (tile + gap) + frameW / 2]];
  const header = `<svg width="${W}" height="${head}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/>${titles.map(([t, cx]) => `<text x="${cx}" y="19" font-family="Helvetica" font-size="15" fill="#fff" text-anchor="middle">${esc(t)}</text>`).join('')}</svg>`;
  const footer = `<svg width="${W}" height="${foot}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="8" y="18" font-family="Helvetica" font-size="13" fill="#ddd">${esc(`${opts.note ?? s.label} · ${2 * s.halfM} m, north up · ${ORTHO_ATTRIBUTION}`)}</text></svg>`;
  const out = vsOrthoPath(s.id, opts.dir);
  mkdirSync(dirname(out), { recursive: true });
  await sharp({ create: { width: W, height: head + tile + foot, channels: 3, background: '#222' } }).composite([
    { input: Buffer.from(header), left: 0, top: 0 },
    { input: await raw(o), left: 0, top: head },
    { input: await raw(top), left: tile + gap, top: head },
    { input: frame, left: 2 * (tile + gap), top: head },
    { input: Buffer.from(footer), left: 0, top: head + tile },
  ]).jpeg({ quality: 85 }).toFile(out);
  return out;
}
