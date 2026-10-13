/**
 * Procedural 256 px trial tiles for the shared material set (metre UVs):
 * brick (1 m × 1 m: running bond, 0.25 × 0.065 m bricks + 1 cm joints) and
 * roof tile (1 m × 1 m: 0.25 × 0.2 m courses). Greyscale-ish so the
 * per-face colour acts as a tint. Output: artifacts/building-recipes/textures/ (untracked binaries).
 */
import fs from 'node:fs/promises';
import sharp from 'sharp';

const S = 256, out = 'artifacts/building-recipes/textures';
const noise = (x: number, y: number) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };

async function tile(name: string, fn: (u: number, v: number) => number) {
  const data = Buffer.alloc(S * S * 3);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const l = Math.max(0, Math.min(255, Math.round(fn(x / S, y / S) * 255)));
    data.set([l, l, l], (y * S + x) * 3);
  }
  await fs.mkdir(out, {recursive: true});
  await sharp(data, {raw: {width: S, height: S, channels: 3}}).png().toFile(`${out}/${name}-256.png`);
}

await tile('brick', (u, v) => {
  const course = Math.floor(v / 0.075), cv = v / 0.075 - course;
  const shifted = u / 0.25 + (course % 2 ? 0.5 : 0), brick = Math.floor(shifted), cu = shifted - brick;
  if (cv > 0.86 || cu > 0.96) return 0.78; // pale mortar joint
  return 0.9 + 0.1 * noise(brick, course) - 0.05 * noise(Math.floor(u * 256), Math.floor(v * 256));
});
await tile('roof-tile', (u, v) => {
  const course = Math.floor(v / 0.2), cv = v / 0.2 - course;
  const shifted = u / 0.25 + (course % 2 ? 0.5 : 0), t = Math.floor(shifted), cu = shifted - t;
  const shade = 0.75 + 0.25 * cv - (cu < 0.04 ? 0.25 : 0); // lighter at the lower lip, dark side seam
  return Math.min(1, shade * (0.92 + 0.08 * noise(t, course)));
});
console.log('wrote', out);
