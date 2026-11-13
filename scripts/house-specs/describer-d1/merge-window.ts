// Zoomed-window test (D1 step 1c (c)): overlay the window read (answers-window/<pand>.json, window-v1.md) on a house answer set, so
// score.ts scores the window fields as read from the tight full-resolution window cut.
//   node --import tsx scripts/house-specs/describer-d1/merge-window.ts --answers <dir> --window <dir> --out <dir>
import fs from 'node:fs';
import path from 'node:path';

export function overlayWindow(answer: any, w: any): any {
  const out = { ...answer, image: { ...answer.image, ref: `${answer.image.ref} + ${w.image}` } };
  if (w.windows !== undefined) out.windows = w.windows;
  if (w.sills !== undefined) out.sills = w.sills;
  if (w.paneLayout !== undefined) out.paneLayout = w.paneLayout;
  if (w.windowSurround !== undefined) out.windowSurround = w.windowSurround;
  if (w.whiteFrames !== undefined && w.whiteFrames !== 'not-visible') out.whiteFrames = w.whiteFrames;
  // the window read is one upper window: it sets the upper storeys' head, the ground storey keeps the house read
  if (w.head !== undefined && Array.isArray(answer.heads) && answer.heads.length) out.heads = [answer.heads[0], ...answer.heads.slice(1).map(() => w.head)];
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  const [A, Wd, O] = [opt('answers')!, opt('window')!, opt('out')!];
  fs.mkdirSync(O, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(Wd).filter(f => f.endsWith('.json'))) {
    const a = path.join(A, f); if (!fs.existsSync(a)) continue;
    fs.writeFileSync(path.join(O, f), `${JSON.stringify(overlayWindow(JSON.parse(fs.readFileSync(a, 'utf8')), JSON.parse(fs.readFileSync(path.join(Wd, f), 'utf8'))), null, 1)}\n`);
    n++;
  }
  console.log(`overlaid ${n}`);
}
