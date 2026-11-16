// Temporary (F1 P5): wall L* inside the target and row outlines, per stop and mode, with the row tile's tier.
import sharp from 'sharp'; import fs from 'node:fs';
const root = process.argv[2], meta = JSON.parse(fs.readFileSync(`${root}/job-off.meta.json`, 'utf8')), TILE = '33659/21540';
const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
const Lstar = (r, g, b) => { const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; const Y = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
const meanL = (data, info, outline) => { const pts = outline.filter(Boolean); if (pts.length !== 4) return null; let s = 0, n = 0; const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(info.height, Math.ceil(Math.max(...ys))); y++) for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(info.width, Math.ceil(Math.max(...xs))); x++) if (inside(pts, x, y)) { const k = (y * info.width + x) * 3; s += Lstar(data[k], data[k + 1], data[k + 2]); n++; }
  return n ? [+(s / n).toFixed(1), n] : null; };
for (const m of meta) {
  const out = {};
  for (const mode of ['off', 'far']) {
    const dir = `${root}/${mode}/${m.key}`; if (!fs.existsSync(`${dir}/game.png`)) continue;
    const g = JSON.parse(fs.readFileSync(`${dir}/game.json`, 'utf8'));
    const { data, info } = await sharp(`${dir}/game.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    out[mode] = { tier: (g.tier?.near ?? []).includes(TILE) ? 'near' : 'baked', target: meanL(data, info, m.outline), row: meanL(data, info, m.rowOutline), hits: [...new Set((g.picks?.hits ?? []).map(h => h?.id?.slice(-7) ?? '-'))].join(',') };
  }
  console.log(m.key.padEnd(16), JSON.stringify(out));
}
