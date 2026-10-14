/**
 * Measure a `kind: large` house's photographed wall groups and (with --write) put the measurements into its intent.
 *
 *   MAP_RECALL_SOURCE_DATA=<checkout> node --import tsx scripts/building-recipes/measure.ts --house=<id>[,<id>] [--write] [--no-system] [--no-bays]
 *
 * Needs the archived crops (`all-walls.ts --pand=<pand> --archive --min-len=8 --max=12`). Compiles the house as it is
 * (large.ts `compileLargeHouse`: GLB, gates, likeness), pairs each group's main panel with a crop (cropToPanel.ts),
 * measures the photo (measureFacade.ts) and writes `houses/<id>/measured.json`: per group the crop (source-data ref,
 * sha256, panorama, date), its placement, the measurement and the likeness of the current model.
 *
 * --write, per group with evidence (not NO EVIDENCE), skipping any field the group lists in `hand`:
 *   palette.brick (the light-trim-normalised wall), palette.glass (the darker not-wall cells), windowShape (w, h, sill),
 *   baysPerStorey (the measured pitch over the main panel; --no-bays keeps the count), system from the front class
 *   (punched -> brick-bay-grid, ribbon -> ribbon-windows, curtain -> curtain-wall; glazed columns stay on their system
 *   until the kit has them; --no-system keeps the system), plus `measured: {date, groups}` and the crops as sources.
 * Storey counts are reported, never written (the fit's storey lines come from 3DBAG eaves; the hand count stays).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {compileLargeHouse} from './large.ts';
import {likenessRows, likenessSummary, type GroupLikeness} from './likeness-house.ts';
import sharp from 'sharp';
import {closeRenderer} from './render.ts';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent.ts';
import type {IntentSource, LargeBuildingIntent, LargeWallIntent} from '../../src/canalRecall/buildingRecipe/intent.ts';
import {requireSourceData} from './sourceData.ts';

const HOUSES = 'scripts/building-recipes/houses';
const today = () => new Date().toISOString().slice(0, 10);
const SYSTEM_OF = {punched: 'brick-bay-grid', ribbon: 'ribbon-windows', curtain: 'curtain-wall'} as const;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The intent fields a measurement proposes for one group (nothing for groups without evidence). */
export function proposeGroup(w: LargeWallIntent, g: GroupLikeness, opts: {system: boolean; bays: boolean}): {patch: Partial<LargeWallIntent>; notes: string[]} {
  const m = g.measured, L = g.likeness, notes: string[] = [];
  if (!m || !L || L.verdict === 'NO EVIDENCE') return {patch: {}, notes};
  const hand = new Set(w.hand ?? []), patch: Partial<LargeWallIntent> = {};
  const palette = {...(w.palette ?? {})};
  if (!hand.has('palette.brick') && !hand.has('palette')) palette.brick = m.wall;
  if (!hand.has('palette.glass') && !hand.has('palette') && m.glass) palette.glass = m.glass;
  patch.palette = palette;
  let system = w.system;
  if (opts.system && !hand.has('system')) {
    if (m.frontClass === 'columns') notes.push(`walls: glazed columns measured; the kit has no glazed-columns system yet (lane C), ${w.system} kept with a full-height window shape`);
    else if (m.frontClass !== 'blank' && SYSTEM_OF[m.frontClass] && SYSTEM_OF[m.frontClass] !== w.system && w.system !== 'plinth-shopfronts') system = SYSTEM_OF[m.frontClass];
    if (system !== w.system) { patch.system = system; notes.push(`system ${w.system} -> ${system} (measured ${m.frontClass})`); }
  }
  // two wall materials along the main panel: left = palette.brick, right = wallSplit.brick (bay-snapped in the fit)
  if (m.split && m.split.at >= 0.1 && m.split.at <= 0.9 && system !== 'curtain-wall' && !w.screen && !hand.has('wallSplit') && !hand.has('palette.brick') && !hand.has('palette')) {
    palette.brick = m.split.left; patch.wallSplit = {at: m.split.at, brick: m.split.right};
    notes.push(`wall split ${m.split.left} | ${m.split.right} at ${Math.round(m.split.at * 100)} % (dE ${m.split.dE})`);
  }
  const shaped = ['brick-bay-grid', 'ribbon-windows', 'plinth-shopfronts'].includes(system) && !w.screen;
  if (shaped && m.window && !hand.has('windowShape')) {
    const h = clamp(m.window.h, 0.08, 0.98), sill = clamp(Math.min(m.window.sill, 0.98 - h), 0, 0.9);
    patch.windowShape = {w: clamp(m.window.w, 0.08, 0.98), h: +h.toFixed(3), sill: +sill.toFixed(3)};
  }
  if (opts.bays && m.bays && system !== 'curtain-wall' && !hand.has('baysPerStorey') && w.alignWith === undefined) patch.baysPerStorey = clamp(m.bays, 1, 80);
  return {patch, notes};
}

/** Every crop of the group's mosaic as an intent source (the main crop carries the panorama id). */
function cropSources(g: GroupLikeness): IntentSource[] {
  const c = g.crop!, main: IntentSource = {id: `pano-${c.capturedAt}-${c.tag}`, kind: 'street-panorama', capturedAt: c.capturedAt!, url: `https://api.data.amsterdam.nl/panorama/panoramas/${c.panoId}/`, image: c.ref, sha256: c.sha256, license: 'Gemeente Amsterdam panorama, CC BY 4.0'};
  const rest = (g.pieces ?? []).filter(q => q.tag !== c.tag).map(q => ({id: `pano-${q.capturedAt}-${q.tag}`, kind: 'street-panorama' as const, capturedAt: q.capturedAt!, image: q.ref, sha256: q.sha256, license: 'Gemeente Amsterdam panorama, CC BY 4.0'}));
  return [main, ...rest];
}

/** What the photo shows that the kit cannot say for this group (named gaps), and what the evidence cannot settle. */
export function groupGaps(w: LargeWallIntent, g: GroupLikeness): {kit: string[]; evidence: string[]} {
  const kit: string[] = [], evidence: string[] = [];
  if (g.status === 'no-photo') { evidence.push(`no photo: no archived crop within ${'0.5 m / 5 deg / 60 %'} of panel ${g.panel}`); return {kit, evidence}; }
  const m = g.measured!, L = g.likeness!;
  if (L.verdict === 'NO EVIDENCE') { evidence.push(`no evidence: ${L.reasons.join('; ')}`); return {kit, evidence}; }
  if (m.split && (m.split.at < 0.1 || m.split.at > 0.9)) kit.push(`colour-split: two wall materials, ${m.split.left} | ${m.split.right} at ${Math.round(m.split.at * 100)} % of the panel, too near an end for wallSplit (0.1..0.9)`);
  if (m.frontClass === 'columns') kit.push('glazed-columns: full-height glazing in bays across storey lines; no kit system');
  if (m.window && (m.window.w > 0.98 || m.window.h > 0.98 || m.window.w < 0.08 || m.window.h < 0.08)) kit.push(`window-shape-range: measured ${m.window.w}x${m.window.h} outside the windowShape range`);
  if (m.frontClass === 'curtain' && w.system === 'plinth-shopfronts') kit.push('curtain-over-plinth: curtain glazing above a shopfront plinth on one group; no kit system');
  return {kit, evidence};
}

export async function measureHouse(id: string, opts: {write: boolean; system: boolean; bays: boolean; debug?: boolean}) {
  requireSourceData();
  const {likeness, report} = await compileLargeHouse(id);
  if (!likeness) throw Error(`${id}: no archived crops for pand ${report.pandId} (all-walls.ts --pand=${report.pandId} --archive)`);
  const file = path.join(HOUSES, id, 'intent.json'), intent: LargeBuildingIntent = JSON.parse(await fs.readFile(file, 'utf8'));
  const summary = likenessSummary(likeness);
  const out = {id, pandId: intent.pandId, date: today(), method: 'measureFacade.ts (k=4 clusters on smoothed normalised Lab + texture, wall = clusters enriched in the floor zones, mixed edge cells by nearest pure colour, light-trim exposure normalisation, autocorrelated bay/storey rhythm, colour split along u) on all-walls.ts --archive crops paired by cropToPanel.ts; likeness.ts against the model elevation',
    groups: summary.map((row, i) => ({...row, gaps: groupGaps(intent.walls[likeness[i].group], likeness[i])}))};
  await fs.writeFile(path.join(HOUSES, id, 'measured.json'), JSON.stringify(out, null, 1) + '\n');
  for (const g of likeness) {
    if (!g.measured) { console.log(`  walls[${g.group}] panel ${g.panel}: no matched photo`); continue; }
    const m = g.measured, L = g.likeness!;
    console.log(`  walls[${g.group}] panel ${g.panel} <- ${g.crop!.tag} ${g.crop!.capturedAt} (offset ${g.match!.offsetM} m, overlap ${g.match!.overlapFraction}): wall ${m.wall} (raw ${m.wallRaw}), glass ${m.glass ?? '-'}, glazing ${m.glazing}, bays ${m.bays ?? '-'} (pitch ${m.pitchM ?? '-'} m), storey ${m.storeyM ?? '-'} m, window ${m.window ? `${m.window.w}x${m.window.h} sill ${m.window.sill} ${m.window.shape}` : '-'}, class ${m.frontClass}; usable ${m.usable}, foliage ${m.foliage}; likeness now ${L.verdict}${L.reasons.length ? ' (' + L.reasons.join('; ') + ')' : ''}`);
  }
  for (const row of out.groups) for (const t of [...row.gaps.kit.map(k => `kit gap ${k}`), ...row.gaps.evidence]) console.log(`  walls[${row.group}] ${t}`);
  if (opts.debug) for (const g of likeness) if (g.likeness) {
    const {row1, row2, width} = await likenessRows(g, 900), a = await sharp(row1).metadata(), b = await sharp(row2).metadata();
    const f = path.join('artifacts/building-recipes', id, `measure-g${g.group}.png`);
    // cluster map (cells, one colour per cluster; walls outlined in the legend), the photo's measurement grid
    const ph = g.photo!, pal = [[230, 60, 60], [60, 160, 230], [240, 200, 40], [140, 90, 200]], cm = Buffer.alloc(ph.cols * ph.rows * 3, 128);
    ph.labels?.forEach((l, k) => { if (l >= 0) cm.set(pal[l % 4], k * 3); });
    const cmap = await sharp(cm, {raw: {width: ph.cols, height: ph.rows, channels: 3}}).resize({width: Math.min(width, ph.cols * 3), kernel: 'nearest'}).png().toBuffer(), c = await sharp(cmap).metadata();
    await sharp({create: {width: Math.max(width, c.width!), height: a.height! + b.height! + c.height!, channels: 3, background: '#fff'}}).composite([{input: row1, left: 0, top: 0}, {input: row2, left: 0, top: a.height!}, {input: cmap, left: 0, top: a.height! + b.height!}]).png().toFile(f);
    console.log(`    ${f}; clusters ${JSON.stringify(g.photo!.clusters)} wall ${g.photo!.wallCluster} tau ${g.photo!.threshold}`);
  }
  if (!opts.write) return out;
  const measuredGroups: number[] = [], sources: IntentSource[] = [], notes: string[] = [];
  for (const g of likeness) {
    const w = intent.walls[g.group], {patch, notes: n} = proposeGroup(w, g, opts);
    if (!Object.keys(patch).length) continue;
    Object.assign(w, patch); measuredGroups.push(g.group); notes.push(...n.map(t => `walls[${g.group}] ${t}`));
    for (const src of cropSources(g)) if (!sources.some(s => s.id === src.id)) sources.push(src);
  }
  if (measuredGroups.length) {
    // keep sources that are not staging crops (other evidence); the archived crops replace the staging ones
    intent.sources = [...sources, ...intent.sources.filter(s => !s.image?.startsWith('staging/pand-reference-walls/') && !sources.some(n => n.id === s.id))];
    intent.measured = {date: today(), groups: measuredGroups.sort((a, b) => a - b)};
    intent.notes = [...(intent.notes ?? []).filter(t => !t.startsWith('Measured ')), `Measured ${today()} (measure.ts, evidence in measured.json): groups ${measuredGroups.join(', ')} take the photo's wall and glass colour, window shape, bay count and front class${notes.length ? '; ' + notes.join('; ') : ''}.`];
    validateLargeIntent(intent);
    await fs.writeFile(file, JSON.stringify(intent, null, 1));
    console.log(`  wrote ${file}: groups ${measuredGroups.join(', ')}`);
  }
  return out;
}

if (process.argv[1]?.endsWith('building-recipes/measure.ts')) {
  const ids = (process.argv.find(a => a.startsWith('--house='))?.slice(8) ?? '').split(',').filter(Boolean);
  if (!ids.length) throw Error('Use --house=<id>[,<id>...]');
  try {
    for (const id of ids) { console.log(id); await measureHouse(id, {write: process.argv.includes('--write'), system: !process.argv.includes('--no-system'), bays: !process.argv.includes('--no-bays'), debug: process.argv.includes('--debug')}); }
  } finally { await closeRenderer(); }
}
