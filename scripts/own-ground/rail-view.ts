// Offline perspective view of the built own ground (lane rail-look 2026-10-31): a CPU z-buffer render of every ground
// layer, flat colours with a sun term, for judging the railway tracks at a spot without the browser. Not the game's
// shader: no textures, no polygon offsets, no shadows. The ballast gets its sleepers back from the bed's UV (v along
// the track), so the tracks read as tracks.
//
//   npx tsx scripts/own-ground/rail-view.ts <lng> <lat> <bearingDeg> [distM=90] [heightM=40] [out.png] [--w=960] [--h=540] [--lod=1] [--before]
//
// The camera stands `distM` behind the spot (against the bearing) and `heightM` up, looking at the spot.
import sharp from 'sharp';
import type { BuiltCell, GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { CUT_CHANNEL, maskChannelAt } from '../../src/canalRecall/ownGround/groundCell.ts';
import { RAIL_TONES, SLEEPER_TILE_M } from '../../src/canalRecall/ownGround/railTracks.ts';
import { railCells } from './probe-rails.ts';

const C: Partial<Record<GroundLayer, readonly number[]>> = {
  land: [222, 211, 190], park: [126, 170, 96], wood: [96, 140, 76], square: [214, 206, 192], parking: [150, 150, 154], garden: [140, 168, 110],
  asphalt: [86, 88, 92], klinker: [150, 104, 88], brick: [188, 176, 166], cycle: [196, 88, 80], paving: [206, 200, 190], gravel: [196, 184, 158],
  kerb: [235, 230, 220], paint: [250, 250, 250], water: [70, 130, 190], quay: [150, 140, 128], deckBody: [160, 155, 146], deckTop: [180, 172, 160],
  tram: [60, 60, 64], bollard: [120, 40, 30], lawn: [126, 176, 92], bed: [140, 118, 90], shrub: [86, 130, 70], bark: [120, 90, 70], sand: [226, 210, 166],
  parkGravel: [200, 190, 160], parkPath: [190, 186, 180], pond: [70, 130, 190], hedge: [70, 110, 60], furniture: [90, 90, 90],
  ballast: RAIL_TONES.ballast, track: [50, 46, 44],
};

export interface View { lng: number; lat: number; bearing: number; dist: number; height: number; w: number; h: number; fovDeg?: number }

/** Render built cells from a chase-like camera. Returns raw RGB. */
export function renderView(cells: readonly BuiltCell[], at: [number, number], v: View, zAt: number): Uint8Array {
  const { w, h } = v, b = (v.bearing * Math.PI) / 180, fwd2: [number, number] = [Math.sin(b), Math.cos(b)];
  const eye = [at[0] - fwd2[0] * v.dist, at[1] - fwd2[1] * v.dist, zAt + v.height];
  const tgt = [at[0], at[1], zAt];
  let f = [tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]];
  const fl = Math.hypot(f[0], f[1], f[2]); f = f.map(c => c / fl);
  let r = [f[1], -f[0], 0]; const rl = Math.hypot(r[0], r[1]); r = r.map(c => c / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const fov = ((v.fovDeg ?? 55) * Math.PI) / 180, fy = h / 2 / Math.tan(fov / 2), near = 1;
  const img = new Uint8Array(w * h * 3), zb = new Float32Array(w * h).fill(Infinity);
  for (let i = 0; i < w * h; i++) { const t = i / w / h; img.set([150 + 60 * t, 190 + 40 * t, 235], i * 3); }
  const sun = [0.35, -0.45, 0.82]; const sl = Math.hypot(...sun); const S = sun.map(c => c / sl);
  for (const cell of cells) for (const [layer, m] of Object.entries(cell.layers) as [GroundLayer, BuiltCell['layers'][GroundLayer]][]) {
    if (!m) continue;
    const base = C[layer] ?? [255, 0, 255], P = m.positions, I = m.indices, UV = (m as { uvs?: Float32Array | number[] }).uvs, ch = CUT_CHANNEL[layer];
    const cam = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) {
      const dx = P[i] - eye[0], dy = P[i + 1] - eye[1], dz = P[i + 2] - eye[2];
      cam[i] = dx * r[0] + dy * r[1] + dz * r[2]; cam[i + 1] = dx * u[0] + dy * u[1] + dz * u[2]; cam[i + 2] = dx * f[0] + dy * f[1] + dz * f[2];
    }
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, bb = I[t + 1] * 3, c = I[t + 2] * 3;
      if (cam[a + 2] < near || cam[bb + 2] < near || cam[c + 2] < near) continue;
      // Face shade from the world normal (two-sided).
      const e1 = [P[bb] - P[a], P[bb + 1] - P[a + 1], P[bb + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nl = Math.hypot(n[0], n[1], n[2]) || 1;
      if (n[2] < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
      const shade = 0.55 + 0.45 * Math.max(0, (n[0] * S[0] + n[1] * S[1] + n[2] * S[2]) / nl);
      const sx = (k: number) => w / 2 + (cam[k] / cam[k + 2]) * fy, sy = (k: number) => h / 2 - (cam[k + 1] / cam[k + 2]) * fy;
      const ax = sx(a), ay = sy(a), bx = sx(bb), by = sy(bb), cx = sx(c), cy = sy(c);
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
      if (x0 > x1 || y0 > y1 || (x1 - x0) * (y1 - y0) > w * h) continue;
      const iza = 1 / cam[a + 2], izb = 1 / cam[bb + 2], izc = 1 / cam[c + 2];
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const qx = px + 0.5, qy = py + 0.5;
        const l0 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / d, l1 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / d, l2 = 1 - l0 - l1;
        if (l0 < 0 || l1 < 0 || l2 < 0) continue;
        const iz = l0 * iza + l1 * izb + l2 * izc, z = 1 / iz, k = py * w + px;
        if (z >= zb[k]) continue;
        const wx = (l0 * iza * P[a] + l1 * izb * P[bb] + l2 * izc * P[c]) * z, wy = (l0 * iza * P[a + 1] + l1 * izb * P[bb + 1] + l2 * izc * P[c + 1]) * z;
        if (ch !== undefined && cell.mask && maskChannelAt(cell.mask, wx, wy, ch) < 0.5) continue;
        zb[k] = z;
        let col = base;
        if (layer === 'ballast' && UV) {
          // Sleepers every 0.6 m on the top (u inside the shoulders' gravel column).
          const uu = (l0 * iza * UV[I[t] * 2] + l1 * izb * UV[I[t + 1] * 2] + l2 * izc * UV[I[t + 2] * 2]) * z;
          const vv = (l0 * iza * UV[I[t] * 2 + 1] + l1 * izb * UV[I[t + 1] * 2 + 1] + l2 * izc * UV[I[t + 2] * 2 + 1]) * z;
          if (uu > 0.2 && uu < 2.9 && ((vv % 0.6) + 0.6) % 0.6 < 0.24) col = RAIL_TONES.sleeper;
        }
        const fog = Math.min(0.5, Math.max(0, (z - 250) / 1200));
        img[k * 3] = col[0] * shade * (1 - fog) + 200 * fog; img[k * 3 + 1] = col[1] * shade * (1 - fog) + 215 * fog; img[k * 3 + 2] = col[2] * shade * (1 - fog) + 235 * fog;
      }
    }
  }
  void SLEEPER_TILE_M;
  return img;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const opt = (k: string, d: number) => Number(process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d);
  const [lng, lat, bearing, dist = 90, height = 40] = args.slice(0, 5).map(Number);
  const out = args[5] ?? `artifacts/rail-look/view-${lng}-${lat}.png`;
  const w = opt('w', 960), h = opt('h', 540), lod = process.argv.includes('--lod=1') ? 1 : 0;
  // --before: main's #145 beds without railProfile.ts (`railLevels: false`); --legacy: rail-v1 of build 04e3c88.
  const { cells, x, y } = await railCells(lng, lat, Math.max(200, dist * 2.5), lod as 0 | 1, process.argv.includes('--legacy') ? { railLegacy: true } : process.argv.includes('--before') ? { railLevels: false } : {});
  const own = cells.find(c => x >= c.rect[0] && x < c.rect[2] && y >= c.rect[1] && y < c.rect[3]);
  void own;
  const img = renderView(cells, [x, y], { lng, lat, bearing, dist, height, w, h }, 2);
  await sharp(Buffer.from(img), { raw: { width: w, height: h, channels: 3 } }).png().toFile(out);
  console.log(JSON.stringify({ out, cells: cells.length }));
}

if (process.argv[1]?.endsWith('rail-view.ts')) main().catch(e => { console.error(e); process.exit(1); });
