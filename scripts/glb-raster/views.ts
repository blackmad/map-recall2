/**
 * `glb:views`: render a GLB from the view vocabulary (src/canalRecall/glbRaster/views.ts) in Node (lane H12,
 * docs/house-line.md §8). The JSON landmark-views.mjs takes, no dev server, no browser, no /tmp/canal-pw.sh slot.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { glbFile, rasteriseModels, pngOf } from '../../src/canalRecall/glbRaster/render.ts';
import { galleryRig, type GlbLook } from '../../src/canalRecall/glbRaster/look.ts';
import { boxOf, gallerySheetViews, resolveView, type NamedView } from '../../src/canalRecall/glbRaster/views.ts';

export const HELP = `node --import tsx scripts/glb-raster/views.ts <id | file.glb> <views.json | - | sheet> <outDir> [flags]

Renders a GLB in Node (src/canalRecall/glbRaster: no browser, no dev server, no lock) from a list of views, the JSON
scripts/landmarks/landmark-views.mjs takes: [{name, light?, w?, hgt?, kind, ...}] with kind
  orbit  {theta, phi, zoom?}            the landmark gallery camera (vertical fov 32, fitted to the bounding sphere)
  street {x, z, h, fov, eye?, pitch?}   camera at x/z, heading h deg from north, horizontal fov, eye height (2.5 m)
  front  {a: [x, z], b: [x, z], ppm?, v0?, v1?, pad?}  orthographic elevation of the wall a -> b (a on the left),
                                        ppm px/m (50), the axis of pand-reference/rectify.ts rectifyWall
  threeq {a, b, heightM?}               render.ts frontViews' three-quarter view of that wall
light: game (default: normaliseLandmarkMaterials' Lambert under the game's hemisphere/sun/fill, the floor) or gallery
(the GLTFLoader standard materials under the gallery light, the sun following theta, no floor). Coordinates are the
GLB's own (x east, y up, z south for our models).

  <id>              public/canal-drive/models/<id>.glb; or a path to any .glb
  views.json        the view list; '-' = landmark-views.mjs's defaults (gallery card, game card, three game orbits);
                    'sheet' = the fixed sheet (gallery card, front, top, back) composed into <outDir>/sheet.png
  --wall=ax,az,bx,bz  the sheet's front wall (else the box's south face is an orbit)
  --look=<look>     override the dressing: game | gallery | recipe (render.ts's recipe look) | flat
  --ss=<n>          samples per pixel side (default 2, the 4x MSAA pattern)
  --help            this text

Writes <outDir>/<name>.png per view and prints each path with its time. Not drawn: cast shadows, anisotropic
filtering, the city-look atlas shader (use render.ts --browser or landmark-views.mjs --browser for those).`;

const LANDMARK_DEFAULTS: NamedView[] = [
  { name: 'gallery-card', light: 'gallery', kind: 'orbit', theta: 0.55, phi: 1.02 },
  { name: 'game-card', kind: 'orbit', theta: 0.55, phi: 1.02 },
  ...[1, 2, 3].map(k => ({ name: `game-orbit-${k}`, kind: 'orbit' as const, theta: 0.55 + k * Math.PI / 2, phi: 1.15 })),
];

export async function renderViews(file: string, views: NamedView[], outDir: string, opts: { look?: GlbLook; supersample?: number } = {}): Promise<{ name: string; file: string; ms: number }[]> {
  const glb = await glbFile(file), box = boxOf(glb.primitives.map(p => p.positions));
  fs.mkdirSync(outDir, { recursive: true });
  const out: { name: string; file: string; ms: number }[] = [];
  for (const v of views) {
    const look: GlbLook = opts.look ?? (v.light === 'gallery' ? 'gallery' : 'game');
    const rv = resolveView(v, box, { width: v.w ?? 1200, height: v.hgt ?? 800 });
    const theta = v.kind === 'orbit' ? v.theta : 0.55;
    const t = performance.now();
    const [img] = await rasteriseModels([{ file }], [rv], { look, supersample: opts.supersample, ...(look === 'gallery' ? { light: galleryRig(theta) } : {}) });
    const f = path.join(outDir, `${v.name}.png`);
    fs.writeFileSync(f, await pngOf(img));
    out.push({ name: v.name, file: f, ms: performance.now() - t });
  }
  return out;
}

/** The fixed sheet: the four views side by side at 600 x 400 with their names. */
export async function sheet(file: string, outDir: string, wall: { a: [number, number]; b: [number, number] } | null, opts: { look?: GlbLook; supersample?: number } = {}) {
  const shots = await renderViews(file, gallerySheetViews(wall), outDir, opts);
  const tiles = await Promise.all(shots.map(s => sharp(s.file).resize(600, 400, { fit: 'contain', background: '#f4f4f2' }).png().toBuffer()));
  const comps = tiles.flatMap((input, i) => [{ input, left: i * 606, top: 24 }, { input: Buffer.from(`<svg width="600" height="22"><text x="4" y="16" font-family="Helvetica, Arial" font-size="14" fill="#1f2328">${shots[i].name} · ${path.basename(file)}</text></svg>`), left: i * 606, top: 0 }]);
  const f = path.join(outDir, 'sheet.png');
  await sharp({ create: { width: 606 * 4 - 6, height: 424, channels: 3, background: '#f4f4f2' } }).composite(comps).png().toFile(f);
  return { file: f, shots };
}

async function main() {
  const argv = process.argv.slice(2), flag = (n: string) => argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const pos = argv.filter(a => !a.startsWith('--'));
  if (argv.includes('--help') || pos.length < 3) { console.log(HELP); return; }
  const [id, viewsArg, outDir] = pos;
  const file = id.endsWith('.glb') ? id : `public/canal-drive/models/${id}.glb`;
  const opts = { look: flag('look') as GlbLook | undefined, supersample: flag('ss') ? Number(flag('ss')) : undefined };
  const t0 = performance.now();
  if (viewsArg === 'sheet') {
    const w = flag('wall')?.split(',').map(Number);
    const r = await sheet(file, outDir, w && w.length === 4 ? { a: [w[0], w[1]], b: [w[2], w[3]] } : null, opts);
    for (const s of r.shots) console.log(`${s.file} ${Math.round(s.ms)} ms`);
    console.log(`${r.file} ${Math.round(performance.now() - t0)} ms total`);
    return;
  }
  const views: NamedView[] = viewsArg === '-' ? LANDMARK_DEFAULTS : JSON.parse(fs.readFileSync(viewsArg, 'utf8'));
  for (const s of await renderViews(file, views, outDir, opts)) console.log(`${s.file} ${Math.round(s.ms)} ms`);
}
if (process.argv[1]?.endsWith('glb-raster/views.ts')) await main();
