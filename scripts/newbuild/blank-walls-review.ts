/**
 * Review sheet for the large recipes the blank-walls rule (otherWalls.ts, lane blank-walls-20261114) changes: per
 * house the installed GLB (before) beside today's compile (after), at gallery-card size (600 x 400, the gallery orbit's
 * phi), from the two sides whose window-grid area changed most, drawn in Node (glbRaster, with the game's shader window
 * grid, windowGrid.ts), plus the archived panorama crops facing those sides. Pages group houses by build-year family,
 * `--per` houses each. Flags (advisory, for the reader): grid on the end wall of a slab block (a blind gable?), grid on panels
 * lower than a storey making up over 15 % of the added grid, a storey height (3DBAG 70 % roof / stated storeys) the 3.2 m
 * grid misreads, listed walls mostly metal or
 * glass (the unlisted ones likely too), a use with tall rooms. Never installs: the after GLBs go to
 * artifacts/blank-walls-review/<id>/after.glb.
 *
 *   node --import tsx scripts/newbuild/blank-walls-review.ts --ids=<file or a,b,c> --out=<dir> [--per=12]
 *     [--source-data=~/Code/map-recall2-source-data]
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {canalhouseGroupToGlb} from '../canalhouse-recipes/export-glb.ts';
import {compileBuilding} from '../../src/canalRecall/buildingRecipe/compile.ts';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent.ts';
import {trustFactsGround, type BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {bearingOfNormal} from '../../src/canalRecall/buildingRecipe/fitLarge.ts';
import {isPartyPanel, resolveOtherWalls} from '../../src/canalRecall/buildingRecipe/otherWalls.ts';
import {OTHER_WINDOW_GRID} from '../../src/canalRecall/buildingRecipe/intent.ts';
import {sharedTerrain} from '../lib/terrainField.ts';
import {rasteriseModels, glbFile} from '../../src/canalRecall/glbRaster/render.ts';
import {boxOf, resolveView} from '../../src/canalRecall/glbRaster/views.ts';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const HOUSES = 'scripts/building-recipes/houses', MODELS = 'public/canal-drive/models/ordinary-buildings', STAGE = 'artifacts/blank-walls-review';
const idsArg = arg('ids'), out = arg('out'), per = Number(arg('per', '12'));
const sourceData = arg('source-data', path.join(os.homedir(), 'Code/map-recall2-source-data'));
if (!idsArg || !out) { console.error('usage: --ids=<file|a,b> --out=<dir> [--per=12]'); process.exit(2); }
const ids = (fs.existsSync(idsArg) ? fs.readFileSync(idsArg, 'utf8') : idsArg).split(/[\s,]+/).filter(Boolean);
fs.mkdirSync(out, {recursive: true});

/** Build-year families (one per lane in the house line). */
const FAMILIES: [string, number][] = [['pre-1850', 1850], ['1850-1905', 1906], ['1906-1940', 1941], ['1941-1970', 1971], ['1971-1995', 1996], ['1996+', 1e9]];
const familyOf = (y: number | null) => (y == null ? 'unknown year' : FAMILIES.find(([, to]) => y < to)![0]);
const TALL_USE = /kerk|church|hal\b|hallen|loods|garage|station|fabriek|gemaal|theater|theatre|museum|sporthal|bioscoop|pakhuis|werkplaats|kazerne|silo|remise|gashouder|warehouse|depot/i;
const METALLISH = new Set(['curtain-wall', 'glass-box', 'metal-panel', 'ribbon-window']);

type Side = {bearing: number; changedM2: number; addedM2: number; removedM2: number};
type Row = {id: string; pand: string; name: string; year: number | null; family: string; why: string; addedM2: number; removedM2: number; wallM2: number;
  sides: Side[]; flags: string[]; crops: {side: number; file: string; tag: string}[]; tiles: string[]};
const rows: Row[] = [];
const sectorOf = (b: number) => Math.round(b / 45) % 8;

for (const id of ids) {
  const raw = JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
  const intent = validateLargeIntent(raw);
  const facts: BuildingFacts = trustFactsGround(JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8')), sharedTerrain());
  const built = compileBuilding(intent, facts);
  const dir = path.join(STAGE, id); fs.mkdirSync(dir, {recursive: true});
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  fs.writeFileSync(path.join(dir, 'after.glb'), glb.bytes);
  const r = built.recipe, resolved = resolveOtherWalls(intent);
  const beforeGrid = intent.otherWalls === OTHER_WINDOW_GRID;
  const sectors = new Map<number, Side>();
  let added = 0, removed = 0, wall = 0;
  const unlisted = built.panels.filter(p => r.panelGroup[p.index] < 0);
  const panelW = (p: (typeof unlisted)[number]) => p.uMax - p.uMin, panelH = (p: (typeof unlisted)[number]) => p.vMax - p.vMin;
  // the footprint's long axis (PCA of the BAG outer ring, RD x east / y north -> model x east / z south) and elongation
  const ring = (facts.bagFootprintRD as unknown as [number, number][][])[0] ?? [];
  const mx = ring.reduce((s, q) => s + q[0], 0) / (ring.length || 1), my = ring.reduce((s, q) => s + q[1], 0) / (ring.length || 1);
  let sxx = 0, syy = 0, sxy = 0;
  for (const q of ring) { const dx = q[0] - mx, dy = q[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), axis = [Math.cos(ang), -Math.sin(ang)];
  const along = ring.map(q => (q[0] - mx) * Math.cos(ang) + (q[1] - my) * Math.sin(ang)), across = ring.map(q => -(q[0] - mx) * Math.sin(ang) + (q[1] - my) * Math.cos(ang));
  const elong = (Math.max(...along) - Math.min(...along)) / Math.max(1, Math.max(...across) - Math.min(...across));
  const flags: string[] = [];
  let gableM2 = 0, sliverM2 = 0;
  for (const p of built.panels) wall += p.area;
  for (const p of unlisted) {
    const after = resolved.windowGrid && !isPartyPanel(p), delta = (after ? 1 : 0) - (beforeGrid ? 1 : 0);
    if (!delta) continue;
    const b = bearingOfNormal(p.n), s = sectorOf(b), side = sectors.get(s) ?? {bearing: s * 45, changedM2: 0, addedM2: 0, removedM2: 0};
    side.changedM2 += p.area; if (delta > 0) side.addedM2 += p.area; else side.removedM2 += p.area;
    sectors.set(s, side);
    if (delta > 0) {
      added += p.area;
      // a slab block's end wall (normal along the long axis of a footprint at least 2.5 times as long as wide): often blind
      if (elong >= 2.5 && Math.abs(p.n[0] * axis[0] + p.n[2] * axis[1]) > 0.9 && panelW(p) <= 16) gableM2 += p.area;
      if (panelH(p) < 2.6) sliverM2 += p.area;
    } else removed += p.area;
  }
  const sides = [...sectors.values()].sort((a, b) => b.changedM2 - a.changedM2).slice(0, 2);
  const at = facts.attributes as Record<string, unknown>;
  const year = typeof at.oorspronkelijkbouwjaar === 'number' ? at.oorspronkelijkbouwjaar : null;
  // storey height: the 3DBAG 70th-percentile roof over the intent's tallest stated storey count
  const eaves = Number(at.b3_h_dak_70p ?? NaN) - Number(at.b3_h_maaiveld ?? 0);
  const storeys = Math.max(0, ...intent.walls.map(w => (typeof w.storeys === 'number' ? w.storeys : 0)));
  if (gableM2 > 0) flags.push(`slab end-wall grid ${Math.round(gableM2)} m2 (blind gable?)`);
  if (sliverM2 > 0.15 * added) flags.push(`grid on panels lower than a storey ${Math.round(sliverM2)} m2`);
  if (storeys > 0 && Number.isFinite(eaves)) {
    const sh = eaves / storeys;
    if (sh > 4.4 || sh < 2.6) flags.push(`storey ${sh.toFixed(1)} m vs grid 3.2 (${storeys} st stated, roof ${eaves.toFixed(1)} m)`);
  }
  const metal = intent.walls.filter(w => w.wallFamily?.kind === 'metal' || METALLISH.has(String(w.system)) || w.cladding).length;
  if (intent.walls.length && metal / intent.walls.length >= 0.5) flags.push(`listed walls ${metal}/${intent.walls.length} metal/glass/clad`);
  if (TALL_USE.test(intent.address ?? '') || TALL_USE.test(String(raw.name ?? ''))) flags.push('use with tall rooms');
  if (removed > 0) flags.push(`party walls lose stated grid ${Math.round(removed)} m2`);
  // archived panorama crops facing the chosen sides (pand-reference-walls/<pand>/w*-<bearing>.thumb.jpg)
  const crops: Row['crops'] = [];
  const pandDir = path.join(sourceData, 'pand-reference-walls', intent.pandId);
  if (fs.existsSync(pandDir)) for (const [si, s] of sides.entries()) {
    const near = fs.readdirSync(pandDir).filter(f => /^w\d+-\d+\.thumb\.jpg$/.test(f)).map(f => ({f, b: Number(f.match(/-(\d+)\.thumb/)![1])}))
      .filter(c => Math.abs(((c.b - s.bearing + 540) % 360) - 180) <= 25).slice(0, 1);
    for (const c of near) crops.push({side: si, file: path.join(pandDir, c.f), tag: c.f.replace('.thumb.jpg', '')});
  }
  // renders: before (installed) and after, gallery orbit (phi 1.02) from each side's outward bearing
  const before = path.join(MODELS, `recipe-large-${id}.glb`), tiles: string[] = [];
  for (const [si, s] of sides.entries()) {
    const theta = Math.atan2(Math.sin(s.bearing * Math.PI / 180), -Math.cos(s.bearing * Math.PI / 180));
    for (const [tag, file] of [['before', before], ['after', path.join(dir, 'after.glb')]] as const) {
      const g = await glbFile(file), box = boxOf(g.primitives.map(p => p.positions));
      const view = resolveView({kind: 'orbit', theta, phi: 1.02, zoom: 1.7}, box, {width: 600, height: 400});
      const [img] = await rasteriseModels([{file}], [view], {look: 'recipe', windowGrid: true, ground: {y: box.min[1] - 0.05, half: 400, color: '#b9b6ad'}});
      const f = path.join(dir, `side${si}-${tag}.png`);
      await sharp(Buffer.from(img.rgba.buffer, img.rgba.byteOffset, img.rgba.byteLength), {raw: {width: img.width, height: img.height, channels: 4}}).removeAlpha().png().toFile(f);
      tiles.push(f);
    }
  }
  const row: Row = {id, pand: intent.pandId, name: String(intent.address ?? id).slice(0, 110), year, family: familyOf(year), why: resolved.why, addedM2: Math.round(added), removedM2: Math.round(removed),
    wallM2: Math.round(wall), sides, flags, crops, tiles};
  rows.push(row);
  console.log(`${id} ${row.family} +${row.addedM2} -${row.removedM2} m2 sides ${sides.map(s => s.bearing).join('/')} crops ${crops.length} ${flags.join('; ')}`);
}
fs.writeFileSync(path.join(out, 'review.json'), JSON.stringify(rows.map(({tiles, ...r}) => r), null, 1) + '\n');

// pages: label strip + [before A | after A | photo A] [before B | after B | photo B]
const TW = 600, TH = 400, PW = 300, LABEL = 44, GAP = 8;
const esc = (s: string) => s.replace(/[<>&"]/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'}[c]!));
const W = 2 * (2 * TW + PW) + 3 * GAP;
const pages: string[] = [];
for (const [family] of [...FAMILIES, ['unknown year', 0] as [string, number]]) {
  const fam = rows.filter(r => r.family === family).sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  for (let k = 0; k < fam.length; k += per) {
    const chunk = fam.slice(k, k + per), H = chunk.length * (LABEL + TH + GAP) + 50;
    const comps: sharp.OverlayOptions[] = [];
    comps.push({input: Buffer.from(`<svg width="${W}" height="50"><text x="10" y="34" font-family="Helvetica" font-size="30" font-weight="bold">${esc(`${family} (${k / per + 1}/${Math.ceil(fam.length / per)}): installed (before) | blank-walls compile (after) | panorama crop facing that side`)}</text></svg>`), top: 0, left: 0});
    chunk.forEach((r, i) => {
      const y = 50 + i * (LABEL + TH + GAP);
      const label = `${r.id}  ${r.year ?? '?'}  +${r.addedM2} m2 grid${r.removedM2 ? ` / -${r.removedM2}` : ''} of ${r.wallM2}  sides ${r.sides.map(s => `${s.bearing}°`).join(' & ')}`;
      comps.push({input: Buffer.from(`<svg width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#eeeae0"/><text x="8" y="19" font-family="Helvetica" font-size="17" font-weight="bold">${esc(label)}</text><text x="8" y="39" font-family="Helvetica" font-size="15" fill="${r.flags.length ? '#a02020' : '#406040'}">${esc(r.flags.join(' | ') || 'no flags')}  —  ${esc(r.name)}</text></svg>`), top: y, left: 0});
      r.tiles.forEach((t, j) => { const si = j >> 1, x = si * (2 * TW + PW + GAP) + (j & 1) * TW; comps.push({input: t, top: y + LABEL, left: x}); });
      for (const c of r.crops) comps.push({input: c.file, top: y + LABEL, left: c.side * (2 * TW + PW + GAP) + 2 * TW, ...{}} as sharp.OverlayOptions);
    });
    // crops can be any size: resize them before compositing
    for (const c of comps) if (typeof c.input === 'string' && c.input.endsWith('.thumb.jpg')) c.input = await sharp(c.input).resize(PW, TH, {fit: 'inside'}).toBuffer();
    const file = path.join(out, `review-${family.replace(/[^a-z0-9+-]+/gi, '_')}-${k / per + 1}.jpg`);
    await sharp({create: {width: W, height: H, channels: 3, background: '#ffffff'}}).composite(comps).jpeg({quality: 82}).toFile(file);
    pages.push(file);
  }
}
console.log(JSON.stringify({houses: rows.length, pages, addedM2: rows.reduce((s, r) => s + r.addedM2, 0), removedM2: rows.reduce((s, r) => s + r.removedM2, 0)}, null, 1));
