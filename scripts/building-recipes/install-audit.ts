/**
 * install-audit: hard gates on installed per-house recipe GLBs, where the game draws them (lane BA, 2026-11-13).
 * The measuring is in src/canalRecall/buildingRecipe/installAudit.ts; this reads the files and prints the table.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {lngLatToRd} from '../../src/canalRecall/rdCoordinates.ts';
import {pointInRing, auditInstall, crownSurvival, flatCrownAllowance, frontProfile, placementU, readCrown, TOL_M, OUTSIDE_MAX_M2, type FrameTri, type Ring, type StatedParts, type XY, type InstallAudit, type CrownSurvival} from '../../src/canalRecall/buildingRecipe/installAudit.ts';

const HELP = `install-audit: measure installed recipe GLBs against their BAG plot, the street front and the spec's crown.

  node --import tsx scripts/building-recipes/install-audit.ts [--ids=<pand,...>|--ids-file=<file>] [--prefix=recipe-spec-]
                                                              [--out=<file.json>] [--md=<file.md>] [--fails=<file>] [--quiet]
  --help             this text

Default set: every catalogue entry whose modelUrl is a models/ordinary-buildings/recipe-spec-*.glb (the house-line installs).
Placement is the catalogue's (instance.anchor, northOffsetDegrees, mirror) taken to RD; polygons are BAG (house facts for the
pand, public/data/extracts/amsterdam/bag-tiles/14 for its neighbours). Gates (fail = hard):

  outside     plan area > ${TOL_M} m outside the pand polygon, stated forward parts excluded     fail > ${OUTSIDE_MAX_M2} m2
  intrusion   deepest plan point inside a neighbouring pand                                  fail > ${TOL_M} m
  frontage    street front not covered laterally by the upper-storey wall band               fail > ${TOL_M} m
  protrusion  deepest point in front of a street front that no stated part explains          fail > ${TOL_M} m
  crown       spec fronts[0].gable -> intent gable -> drawn front silhouette (flat vs raised; stepped vs not)

Also printed, not gated: meshIoU (mesh plan vs pand polygon), anchor/rotation error against the facts' front frame,
the covers.json pands the install hides besides its own.
--out writes the full JSON, --md the per-pand table, --fails one pand id per line of the houses failing any hard gate.
--overlays=<dir> writes <dir>/<pand>.png: a top-down plan (north up, 1 px = 2.5 cm) of the mesh plan (cells: grey inside
the pand, red outside it, orange in a neighbour), the pand polygon (blue), its BAG neighbours (black, labelled), the street
fronts (green) and the frontage gaps (magenta).`;

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});

/** Decoded GLB triangles in the file's own (frontage) frame, with material names. */
export async function frameTriangles(file: string): Promise<FrameTri[]> {
  const doc = await io.read(file), out: FrameTri[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;
      const pos = prim.getAttribute('POSITION'); if (!pos) continue;
      const v = [0, 0, 0], P: number[][] = [];
      for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); P.push([0, 1, 2].map(k => m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k])); }
      const idx = prim.getIndices(), n = idx ? idx.getCount() : P.length, material = prim.getMaterial()?.getName() ?? '';
      for (let i = 0; i + 2 < n; i += 3) out.push({a: P[idx ? idx.getScalar(i) : i], b: P[idx ? idx.getScalar(i + 1) : i + 1], c: P[idx ? idx.getScalar(i + 2) : i + 2], material});
    }
  }
  return out;
}

// ---- BAG neighbours from the bag tiles (lng/lat) -> RD ----------------------------------------------------------------
const TILES = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
const tileXY = (lon: number, lat: number): [number, number] => {
  const n = 2 ** 14, r = (lat * Math.PI) / 180;
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
};
const tileCache = new Map<string, {id: string; rings: Ring[]; box: [number, number, number, number]}[]>();
function pandsNear(lng: number, lat: number) {
  const [tx, ty] = tileXY(lng, lat), out = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const key = `${tx + dx}/${ty + dy}`;
    if (!tileCache.has(key)) {
      const file = path.join(TILES, `${key}.geojson.gz`), list: {id: string; rings: Ring[]; box: [number, number, number, number]}[] = [];
      if (fs.existsSync(file)) for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()).features) {
        const id = String(f.properties.id ?? ''); if (!/^\d{16}$/.test(id) && !id.startsWith('NL.IMBAG')) continue;
        const polys = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : [];
        const rings: Ring[] = polys.map((p: number[][][]) => p[0].map(([x, y]) => lngLatToRd(x, y)));
        if (!rings.length) continue;
        const pts = rings.flat();
        list.push({id: id.replace(/^NL\.IMBAG\.Pand\./, ''), rings, box: [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]});
      }
      tileCache.set(key, list);
    }
    out.push(...tileCache.get(key)!);
  }
  return out;
}

// ---- stated parts from the compiled intent ------------------------------------------------------------------------------
function statedParts(intent: any, facts: any): StatedParts {
  const f = intent.fronts[0], sh: number[] = f.storeyHeights ?? [];
  const eavesM = f.eavesHeight ?? (sh.length ? sh.reduce((a: number, b: number) => a + b, 0) : facts.fronts?.[0]?.eavesM ?? 10);
  return {
    storeyHeights: sh.length ? sh : Array(f.storeys ?? 3).fill(eavesM / (f.storeys ?? 3)), eavesM,
    stoop: !!(f.stoop || f.stoopRails || f.souterrain || f.basementDoor), awning: !!f.shopfront?.awning, groundCanopy: !!f.groundCanopy,
    shopfront: !!f.shopfront, hoist: !!(f.hoist || f.dormerHoist), cornice: !!((f.cornice && f.cornice !== 'none') || f.crownCapCornice || f.entablature),
    eavesOverhang: !!f.eavesOverhang,
    bayStoreys: f.bayWindows?.storeys ?? [], balconyStoreys: [...(f.balconies?.storeys ?? []), ...(f.balconyRun?.storeys ?? [])],
  };
}

const catalogue = readJson(path.join(ROOT, 'public/canal-drive/ordinary-buildings-data/catalogue.json')).models as any[];
const covers = readJson(path.join(ROOT, 'public/canal-drive/models/covers.json')).models as Record<string, {p: string[]}>;
const prefix = arg('prefix') ?? 'recipe-spec-';
const wanted = arg('ids') ? new Set(arg('ids')!.split(',')) : arg('ids-file') ? new Set(fs.readFileSync(arg('ids-file')!, 'utf8').split(/\s+/).filter(Boolean)) : null;
const entries = catalogue.filter(m => path.basename(m.modelUrl ?? '').startsWith(prefix) && m.instance)
  .filter(m => !wanted || wanted.has(m.buildingId.replace('NL.IMBAG.Pand.', '')) || wanted.has(m.buildingId.replace('NL.IMBAG.Pand.0363100012', '')));

/** Top-down overlay of one install (RD, north up). */
async function overlay(file: string, title: string, audit: InstallAudit, own: Ring[], neighbours: {id: string; rings: Ring[]}[], fronts: any[]) {
  const {all} = audit.plan!, ppm = 40, pts = [...own.flat()], [bx0, by0, bx1, by1] = audit.meshBoundsRD;
  pts.push([bx0, by0], [bx1, by1]);
  const x0 = Math.min(...pts.map(p => p[0])) - 4, x1 = Math.max(...pts.map(p => p[0])) + 4, y0 = Math.min(...pts.map(p => p[1])) - 4, y1 = Math.max(...pts.map(p => p[1])) + 4;
  const W = Math.round((x1 - x0) * ppm), H = Math.round((y1 - y0) * ppm) + 60;
  const X = (x: number) => ((x - x0) * ppm).toFixed(1), Y = (y: number) => (60 + (y1 - y) * ppm).toFixed(1);
  const poly = (r: Ring, attrs: string) => `<polygon points="${r.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" ${attrs}/>`;
  const out: string[] = [`<rect width="${W}" height="${H}" fill="#fff"/>`];
  const inAny = (c: XY, rings: Ring[]) => rings.reduce((k, r) => k + (pointInRing(c, r) ? 1 : 0), 0) % 2 === 1;
  for (const [, , c] of all.occupied()) {
    const colour = inAny(c, own) ? '#bbb' : neighbours.some(n => inAny(c, n.rings)) ? '#f80' : '#e00';
    out.push(`<rect x="${X(c[0] - all.cell / 2)}" y="${Y(c[1] + all.cell / 2)}" width="${(all.cell * ppm).toFixed(1)}" height="${(all.cell * ppm).toFixed(1)}" fill="${colour}" fill-opacity="0.7"/>`);
  }
  for (const n of neighbours) for (const r of n.rings) {
    out.push(poly(r, 'fill="none" stroke="#000" stroke-width="1.5"'));
    const c = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length], [0, 0]);
    if (c[0] > x0 && c[0] < x1 && c[1] > y0 && c[1] < y1) out.push(`<text x="${X(c[0])}" y="${Y(c[1])}" font-size="13" font-family="sans-serif" text-anchor="middle">${n.id.slice(-6)}</text>`);
  }
  for (const r of own) out.push(poly(r, 'fill="none" stroke="#06f" stroke-width="3"'));
  audit.frontage.forEach((fa, k) => {
    const ch: XY[] = fronts[k].chainRD ?? fronts[k].endpointsRD;
    out.push(`<polyline points="${ch.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="#0a0" stroke-width="5" stroke-opacity="0.6"/>`);
    const at = (s: number): XY => { let run = 0; for (let i = 1; i < ch.length; i++) { const l = Math.hypot(ch[i][0] - ch[i - 1][0], ch[i][1] - ch[i - 1][1]); if (run + l >= s) { const t = (s - run) / l; return [ch[i - 1][0] + t * (ch[i][0] - ch[i - 1][0]), ch[i - 1][1] + t * (ch[i][1] - ch[i - 1][1])]; } run += l; } return ch.at(-1)!; };
    for (const [a, b] of fa.runs) { const p = at(a), q = at(b); out.push(`<line x1="${X(p[0])}" y1="${Y(p[1])}" x2="${X(q[0])}" y2="${Y(q[1])}" stroke="#f0f" stroke-width="9"/>`); }
  });
  const fails = audit.gates.filter(g => !g.pass).map(g => `${g.id} ${g.valueM}`).join(', ') || 'all plan gates pass';
  out.push(`<text x="8" y="22" font-size="17" font-family="sans-serif" font-weight="bold">${title}</text><text x="8" y="46" font-size="14" font-family="sans-serif">${fails}; meshIoU ${audit.meshIoU}; grey in pand, red outside, orange in a neighbour; 1 m = ${ppm} px</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(W, 520)}" height="${H}">${out.join('')}</svg>`;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  await sharp(Buffer.from(svg)).png().toFile(file);
}

interface Row { pand: string; address: string; audit: InstallAudit; crown: CrownSurvival; hiddenOthers: string[]; fail: string[] }
const rows: Row[] = [];
for (const m of entries) {
  const pand = m.buildingId.replace('NL.IMBAG.Pand.', ''), recipeId = m.recipe?.id ?? `spec-${pand}`;
  const dir = path.join(ROOT, 'scripts/building-recipes/houses', recipeId);
  const facts = readJson(path.join(dir, 'facts.json')), intent = readJson(path.join(dir, 'intent.json'));
  const specFile = path.join(ROOT, 'scripts/house-specs/specs', `${pand}.json`);
  const spec = fs.existsSync(specFile) ? readJson(specFile) : null;
  const tris = await frameTriangles(path.join(ROOT, 'public/canal-drive', m.modelUrl.replace(/^\.\//, '')));
  const anchor = m.instance.anchor as XY;
  const placement = {anchorRD: lngLatToRd(anchor[0], anchor[1]), uRD: placementU(anchor, m.instance.northOffsetDegrees, lngLatToRd), mirror: !!m.instance.mirror};
  const own: Ring[] = facts.bagFootprintRD;
  const pts = own.flat(), box = [Math.min(...pts.map(p => p[0])) - 3, Math.min(...pts.map(p => p[1])) - 3, Math.max(...pts.map(p => p[0])) + 3, Math.max(...pts.map(p => p[1])) + 3];
  const neighbours = pandsNear(anchor[0], anchor[1]).filter(p => p.id !== pand && p.box[0] < box[2] && p.box[2] > box[0] && p.box[1] < box[3] && p.box[3] > box[1]);
  const f0 = facts.fronts[0], uLen = Math.hypot(f0.endpointsRD[1][0] - f0.endpointsRD[0][0], f0.endpointsRD[1][1] - f0.endpointsRD[0][1]);
  const audit = auditInstall({
    tris, placement, own, neighbours, stated: statedParts(intent, facts),
    fronts: facts.fronts.map((f: any) => ({street: f.street, chainRD: f.chainRD ?? f.endpointsRD, outwardNormalRD: f.outwardNormalRD})),
    keepPlan: !!arg('overlays'),
    frame: {midRD: [(f0.endpointsRD[0][0] + f0.endpointsRD[1][0]) / 2, (f0.endpointsRD[0][1] + f0.endpointsRD[1][1]) / 2], uRD: [(f0.endpointsRD[1][0] - f0.endpointsRD[0][0]) / uLen, (f0.endpointsRD[1][1] - f0.endpointsRD[0][1]) / uLen]},
  });
  const crown = crownSurvival(spec?.design?.fronts?.[0]?.gable, intent.fronts[0].gable, readCrown(frontProfile(tris)), flatCrownAllowance(intent.fronts[0]));
  if (arg('overlays')) await overlay(path.join(arg('overlays')!, `${pand}.png`), m.name, audit, own, neighbours, facts.fronts);
  delete audit.plan;
  const hiddenOthers = (covers[m.id]?.p ?? []).map(String).filter(p => !pand.endsWith(p) && p !== pand);
  const fail = [...audit.gates.filter(g => !g.pass).map(g => g.id), ...(crown.pass ? [] : ['crown'])];
  rows.push({pand, address: m.name, audit, crown, hiddenOthers, fail});
  if (!process.argv.includes('--quiet')) console.error(`${pand} ${m.name.padEnd(28)} ${fail.length ? 'FAIL ' + fail.join(',') : 'pass'}`);
}

const g = (r: Row, id: string) => r.audit.gates.find(x => x.id === id)!;
const cell = (r: Row, id: string) => { const x = g(r, id); return `${x.pass ? 'pass' : '**FAIL**'} ${x.valueM}`; };
const md = [
  `| pand | address | outside m2 | intrusion m | frontage gap m | protrusion m | crown (spec / drawn) | meshIoU | anchor err m | rot err deg | hides others |`,
  `|---|---|---|---|---|---|---|---|---|---|---|`,
  ...rows.map(r => `| ${r.pand.slice(-6)} | ${r.address} | ${cell(r, 'outside')} | ${cell(r, 'intrusion')}${g(r, 'intrusion').detail ? ` (${g(r, 'intrusion').detail!.slice(-6)})` : ''} | ${cell(r, 'frontage')} | ${cell(r, 'protrusion')}${g(r, 'protrusion').detail ? ` (${g(r, 'protrusion').detail})` : ''} | ${r.crown.pass ? 'pass' : '**FAIL**'} ${r.crown.spec} / ${r.crown.drawn.kind} ${r.crown.drawn.riseM} | ${r.audit.meshIoU} | ${r.audit.placement.anchorErrorM} | ${r.audit.placement.rotationErrorDeg} | ${r.hiddenOthers.join(' ')} |`),
].join('\n');
const counts: Record<string, number> = {};
for (const r of rows) for (const f of r.fail) counts[f] = (counts[f] ?? 0) + 1;
const hard = rows.filter(r => r.fail.length);
const summary = {houses: rows.length, failAny: hard.length, failHardGeometry: rows.filter(r => r.fail.some(f => f !== 'crown')).length, counts,
  hidingOthers: rows.filter(r => r.hiddenOthers.length).length, meshIoUBelow09: rows.filter(r => r.audit.meshIoU < 0.9).length};
console.log(JSON.stringify(summary, null, 1));
if (arg('out')) { fs.mkdirSync(path.dirname(arg('out')!), {recursive: true}); fs.writeFileSync(arg('out')!, JSON.stringify({generatedAt: new Date().toISOString(), summary, rows}, null, 1) + '\n'); }
if (arg('md')) { fs.mkdirSync(path.dirname(arg('md')!), {recursive: true}); fs.writeFileSync(arg('md')!, md + '\n'); }
if (arg('fails')) fs.writeFileSync(arg('fails')!, hard.map(r => r.pand).join('\n') + '\n');
