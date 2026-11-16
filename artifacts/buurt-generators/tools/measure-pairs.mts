// Wall colour of the photo half and the Node game half of house:frames pairs, read with the buurt panorama reader.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const W = '/Users/blackmad/Code/map-recall2-worktrees/buurt-generators-20261115/';
const { frameFor } = await import(W + 'scripts/house-frames/pose.ts');
const { rectifyFromFrame } = await import(W + 'scripts/house-frames/photo.ts');
const { labOf, brickOfPixels, wallBrickOf, isFoliage } = await import(W + 'src/canalRecall/buurtGenerator/measure.ts');
const recs: any[] = (() => { const r = JSON.parse(fs.readFileSync(W + 'public/data/front-records/row-front.json', 'utf8')); const x = r.records ?? r; return Array.isArray(x) ? x : Object.values(x); })();
const recOf = new Map(recs.map(r => [r.pandId, r]));
const hexLab = (h: string) => { const n = parseInt(h.slice(1), 16); return labOf(n >> 16, (n >> 8) & 255, n & 255); };
const lch = (l: number[]) => [l[0], Math.hypot(l[1], l[2]), (Math.atan2(l[2], l[1]) * 180 / Math.PI + 360) % 360];
const fmt = (l: number[] | null) => l ? lch(l).map((v, i) => v.toFixed(i === 2 ? 0 : 3)).join('/') : '-';
async function rgb(file: string, w: number, h: number) {
  const { data, info } = await sharp(file).removeAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}
const rows: any[] = [];
for (const run of process.argv.slice(2)) {
  const prep = JSON.parse(fs.readFileSync(path.join(run, 'prepared.json'), 'utf8')).prepared as any[];
  for (const e of prep) {
    const dir = path.join(run, e.key), photoF = path.join(dir, 'likeness-photo.jpg'), gameF = path.join(dir, 'likeness.node.png');
    if (!fs.existsSync(photoF) || !fs.existsSync(gameF)) continue;
    const lp = e.likeness?.lp, pose = lp?.pose ?? e.pose, win = lp?.window ?? { width: pose.width, height: pose.height };
    const frame = frameFor(pose);
    // Both halves are the window (top rows) of the pose frame; give them the pose's full height so projection matches.
    const read = async (f: string) => {
      const img = await rgb(f, win.width, win.height);
      const full = { width: pose.width, height: pose.height, data: new Uint8Array(pose.width * pose.height * 3) };
      full.data.set(img.data.subarray(0, Math.min(img.data.length, full.data.length)));
      const r = rectifyFromFrame(full, frame, pose, e.wall, 20, e.wall.heightM);
      const len = r.width, px: any[] = [];
      const v0 = Math.round(r.height * 0.15), v1 = Math.round(r.height * (1 - Math.min(3, e.wall.heightM * 0.3) / e.wall.heightM));
      for (let j = v0; j < v1; j++) for (let i = Math.round(len * 0.1); i < Math.round(len * 0.9); i++) {
        const k = j * r.width + i; if (!r.valid[k] || j >= Math.round(win.height)) {}
        if (!r.valid[k]) continue;
        const R = r.rgb[k * 3], G = r.rgb[k * 3 + 1], B = r.rgb[k * 3 + 2];
        if (isFoliage(R, G, B) || (R + G + B) === 0) continue;
        px.push(labOf(R, G, B));
      }
      return px;
    };
    const pp = await read(photoF), gp = await read(gameF);
    const photo = brickOfPixels(pp), bal = wallBrickOf(pp), game = brickOfPixels(gp);
    const rec = recOf.get(e.pandId);
    rows.push({ pand: e.pandId, street: e.street, rec: rec?.wall?.hex, pano: e.likeness?.pano?.timestamp?.slice(0, 16), n: [pp.length, gp.length], photo: photo?.lab, bal: bal?.lab, game: game?.lab });
    console.log(e.pandId, (e.street ?? '').padEnd(22).slice(0, 22), 'rec', rec?.wall?.hex, fmt(rec?.wall?.hex ? hexLab(rec.wall.hex) : null), '| photo', fmt(photo?.lab ?? null), '| bal', fmt(bal?.lab ?? null), '| game', fmt(game?.lab ?? null), e.likeness?.pano?.timestamp?.slice(0, 13));
  }
}
fs.writeFileSync(process.env.OUT ?? '/dev/null', JSON.stringify(rows));
