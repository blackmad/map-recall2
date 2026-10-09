/**
 * Step 2: straight-on facade crop (reusing src/canalRecall/facade/rectify.ts, the Amsterdam world-aligned camera)
 * plus a cheap aimed perspective thumbnail from /panorama/thumbnail/<pano_id>/ as a fallback.
 */
import jpeg from 'jpeg-js';
import sharp from 'sharp';
import { AMSTERDAM_WORLD_ALIGNED, rectifyFacade, type FacadePlane } from '../../src/canalRecall/facade/rectify.ts';
import { lensFor } from '../da-costa-block/neighbourhood-core.ts';
import { cachedBytes, rdToLngLat } from './core.ts';
import type { PanoPick, Wall } from './select.ts';

export const FALLBACK_GROUND_NAP = 0.4; // used when the record's published camera height is 0/implausible (2025 captures)
export const WALL_EXTRA_M = 1.5; // above the tile height: gables, parapets, roof edge

type Decoded = { width: number; height: number; data: Uint8Array };
const lru: Array<{ id: string; img: Decoded }> = [];
export async function loadPano(pick: PanoPick): Promise<{ img: Decoded; resolution: string } | null> {
  const hit = lru.find(e => e.id === pick.panoId);
  if (hit) return { img: hit.img, resolution: 'cached' };
  for (const key of ['equirectangular_full', 'equirectangular_medium']) {
    const href = pick.record._links?.[key]?.href;
    if (!href) continue;
    try {
      const bytes = await cachedBytes(href, '.jpg');
      const d = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 1536 });
      const img = { width: d.width, height: d.height, data: d.data as Uint8Array };
      lru.unshift({ id: pick.panoId, img }); lru.length = Math.min(lru.length, 2);
      return { img, resolution: key };
    } catch { /* try the next size */ }
  }
  return null;
}

export type Crop = { jpeg: Buffer; width: number; height: number; ppm: number; wallWidthM: number; wallHeightM: number; missingFraction: number; baseZ: number; groundSource: string; washedOut: number; foliage: number };

/** Share of the mid-wall that is bright and nearly colourless: scaffolding sheeting, overexposure, fog. Brick and plaster fronts score < 0.1. */
/** Share of the wall that is leaf-green (summer street trees in front of the wall). Heuristic, brick/plaster fronts score ~0. */
export function foliageFraction(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number) {
  let bad = 0, n = 0;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const i = (y * width + x) * 4; if (rgba[i + 3] !== 255) continue;
    n++; if (rgba[i + 1] > rgba[i] + 8 && rgba[i + 1] > rgba[i + 2] + 15) bad++;
  }
  return n ? bad / n : 0;
}
export function washedOutFraction(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number) {
  let bad = 0, n = 0;
  for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.9); y += 2) for (let x = 0; x < width; x += 2) {
    const i = (y * width + x) * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], hi = Math.max(r, g, b), lo = Math.min(r, g, b);
    if (rgba[i + 3] !== 255) continue;
    n++; if (lo > 150 && hi - lo < 55) bad++;
  }
  return n ? bad / n : 0;
}

export function wallHeight(tileHeightM: number) { return Math.min(Math.max(tileHeightM, 4) + WALL_EXTRA_M, 32); }

export function rectifyWall(pano: Decoded, pick: PanoPick, wall: Wall, tileHeightM: number, ppm = 50, baseZ?: number): Crop | null {
  let lens = lensFor(pick.record, baseZ);
  let groundSource = 'published camera height - 2.44 m';
  if (!lens) { lens = lensFor(pick.record, baseZ ?? FALLBACK_GROUND_NAP); groundSource = `assumed ground ${baseZ ?? FALLBACK_GROUND_NAP} m NAP`; }
  if (!lens) return null;
  let ground = baseZ ?? lens.pose.z - 2.44;
  if (baseZ === undefined && (ground < -2.5 || ground > 3)) { // implausible published height (bridge, bad datum): assume street level
    ground = FALLBACK_GROUND_NAP; lens = { ...lens, pose: { ...lens.pose, z: ground + 2.44 } }; groundSource = `published height implausible; assumed ground ${ground} m NAP`;
  }
  const plane: FacadePlane = { start: wall.a, end: wall.b, baseZ: ground, topZ: ground + wallHeight(tileHeightM) };
  const out = rectifyFacade(pano, { ...lens.pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0 }, plane, { pixelsPerMetre: ppm, camera: AMSTERDAM_WORLD_ALIGNED, maxPixels: 1_800_000 });
  // Missing pixels (behind camera / off image) render mid-grey; keep the rest.
  const rgba = Buffer.from(out.data.buffer, out.data.byteOffset, out.data.byteLength);
  const enc = jpeg.encode({ data: rgba, width: out.width, height: out.height }, 80);
  return { jpeg: enc.data, width: out.width, height: out.height, ppm, wallWidthM: out.wallWidthM, wallHeightM: out.wallHeightM, missingFraction: out.missingFraction, baseZ: ground, groundSource, washedOut: washedOutFraction(out.data, out.width, out.height), foliage: foliageFraction(out.data, out.width, out.height) };
}

/** Aimed perspective view from the chosen panorama at the wall centre, via the public thumbnail endpoint. */
export async function aimedThumbnail(pick: PanoPick, wall: Wall, tileHeightM: number): Promise<{ jpeg: Buffer; url: string; fovDeg: number; headingDeg: number } | null> {
  const [lngC, latC] = rdToLngLat(wall.mid);
  const cam = pick.record.geometry.coordinates;
  const dx = (lngC - cam[0]) * 111320 * Math.cos(latC * Math.PI / 180), dy = (latC - cam[1]) * 110540;
  const heading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, d = Math.max(pick.distM, 4), h = wallHeight(tileHeightM);
  const need = Math.max(wall.len / 2 + 1.5, h / 2 + 1);
  const fov = Math.round(Math.min(100, Math.max(40, 2 * Math.atan(need / d) * 180 / Math.PI)));
  const pitch = Math.round(Math.atan((h / 2 - 2.4) / d) * 180 / Math.PI);
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${pick.panoId}/?width=1000&aspect=1&fov=${fov}&heading=${Math.round(heading)}&pitch=${pitch}`;
  try {
    const bytes = await cachedBytes(url, '.jpg');
    const out = await sharp(bytes).resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    return { jpeg: out, url, fovDeg: fov, headingDeg: Math.round(heading) };
  } catch { return null; }
}
