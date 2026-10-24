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
 *   (punched -> brick-bay-grid, ribbon -> ribbon-windows, curtain -> curtain-wall; measured glazed columns keep the
 *   group's system: `glazed-columns` needs its column bays placed by hand; --no-system keeps the system), plus
 *   `measured: {date, groups}` and the crops as sources. Groups measured before whose `hand` keeps a palette colour
 *   (hand-sampled from the crops) stay in `measured.groups` when this run has no evidence for them.
 * Storey counts are reported, never written (the fit's storey lines come from 3DBAG eaves; the hand count stays).
 *
 * Known limits, the next measurement lane's targets (reconcile review of the five large pilots, 2026-10-14):
 *   - glazing undercount: white-framed and barred panes are classed as trim, so photo glazing reads 0.12-0.34 where the
 *     overlay shows the windows lining up (Houthavenkade 26 walls[1], [3], [4]; Waagdragerhof walls[2], [3]); the
 *     refinement loop below then shrinks windows to slits, so those groups keep their measured shape by hand.
 *   - dark brick reads as paint: under overcast or winter light the wall cluster lands on mortar, shadow, frames or window
 *     surrounds (#262120, #34373a, #464746 on Waagdragerhof), family "paint"; and a mixed front (Wibautstraat 78 walls[0]:
 *     light spandrels between dark column faces, gain 1 with no light trim) averages darker than its spandrels.
 *     Those groups carry a hand colour with a note saying why.
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
import {compileBuilding} from '../../src/canalRecall/buildingRecipe/compile.ts';
import {LARGE_BUDGET_TRIANGLES} from '../../src/canalRecall/buildingRecipe/largeGates.ts';
import {proposeBands} from '../../src/canalRecall/buildingRecipe/lightBands.ts';
import {cropPredatesBuilding, curtainEvidence, glassReadsAsGlass, glazedPlinth, majoritySystem, photoBays} from '../../src/canalRecall/buildingRecipe/measureWriteback.ts';
import {draftBudgetCap, inheritedWall, isDraftIntent} from '../../src/canalRecall/buildingRecipe/draftLarge.ts';

const HOUSES = 'scripts/building-recipes/houses';
const today = () => new Date().toISOString().slice(0, 10);
const SYSTEM_OF = {punched: 'brick-bay-grid', ribbon: 'ribbon-windows', curtain: 'curtain-wall'} as const;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface ProposeOpts {
  system: boolean; bays: boolean;
  /** BAG construction year (facts.heights.builtYear): a crop taken in or before it is not evidence */
  builtYear?: number | null;
  /** the system a curtain class falls back to when its crop is not trusted (measureHouse: the building's majority) */
  fallbackSystem?: LargeWallIntent['system'];
}

/** The system a group's front class proposes and, for a curtain class, why it is not trusted (`curtainEvidence`). */
export function proposedSystem(w: LargeWallIntent, g: GroupLikeness): {system: LargeWallIntent['system'] | null; distrust: string[]} {
  const m = g.measured, L = g.likeness;
  if (!m || !L || m.frontClass === 'blank' || m.frontClass === 'columns' || !SYSTEM_OF[m.frontClass]) return {system: null, distrust: []};
  const system = SYSTEM_OF[m.frontClass];
  const distrust = system === 'curtain-wall' ? curtainEvidence({glass: m.glass, wall: m.wall, usable: m.usable, likenessUsable: L.evidence.usable, foliage: m.foliage, washedOut: m.washedOut}) : [];
  return {system, distrust};
}

/** The intent fields a measurement proposes for one group (nothing for groups without evidence). */
export function proposeGroup(w: LargeWallIntent, g: GroupLikeness, opts: ProposeOpts): {patch: Partial<LargeWallIntent>; notes: string[]} {
  const m = g.measured, L = g.likeness, notes: string[] = [];
  if (!m || !L || L.verdict === 'NO EVIDENCE') return {patch: {}, notes};
  if (cropPredatesBuilding(g.crop?.capturedAt, opts.builtYear)) {
    notes.push(`crop ${g.crop!.tag} (${g.crop!.capturedAt}) was taken in or before the construction year ${opts.builtYear}: not evidence, nothing written`);
    return {patch: {}, notes};
  }
  const hand = new Set(w.hand ?? []), patch: Partial<LargeWallIntent> = {};
  const palette = {...(w.palette ?? {})};
  if (!hand.has('palette.brick') && !hand.has('palette')) palette.brick = m.wall;
  // glass only when it reads as glass (clearly darker than the wall, nearly neutral); reflective panes in a dull photo
  // measure as wall-toned mid-greys (Waagdragerhof 198 g0 #46342d on #3d3332) and would hide the windows. The hex is
  // written as measured: it is the glass under that crop's sky (overcast reads near-black), and the look, not this
  // script, lifts it to the sky-lit pane (look/palette.ts `cityMeasuredGlassTint`, L >= MEASURED_GLASS_MIN_L), so the
  // intents keep the evidence and the fit hashes do not move when the look is retuned.
  if (!hand.has('palette.glass') && !hand.has('palette') && m.glass) {
    if (glassReadsAsGlass(m.glass, m.wall)) palette.glass = m.glass;
    else { delete palette.glass; notes.push(`glass ${m.glass} not used (not darker than the wall ${m.wall} by 10 L*, or tinted): kit glass kept`); }
  }
  patch.palette = palette;
  let system = w.system;
  // a curtain class from a crop that is not trusted: the not-wall mask is what is in doubt, so neither the system nor the
  // bays and window shape folded from that mask are written (the wall colour, from the wall cells, still is)
  const {system: proposed, distrust} = proposedSystem(w, g), maskDistrusted = proposed === 'curtain-wall' && distrust.length > 0;
  if (opts.system && !hand.has('system')) {
    if (m.frontClass === 'columns' && w.system !== 'glazed-columns') notes.push(`walls: glazed columns measured; ${w.system} kept (glazed-columns needs its column bays placed by hand)`);
    else if (proposed === 'curtain-wall' && distrust.length) {
      const fb = opts.fallbackSystem ?? w.system;
      if (w.system !== 'plinth-shopfronts') system = fb;
      notes.push(`curtain class not trusted (${distrust.join('; ')}): ${system} kept from the building's majority`);
    } else if (proposed && proposed !== w.system && w.system !== 'plinth-shopfronts') system = proposed;
    if (system !== w.system) { patch.system = system; notes.push(`system ${w.system} -> ${system} (measured ${m.frontClass})`); }
  }
  // two wall materials along the main panel: left = palette.brick, right = wallSplit.brick (bay-snapped in the fit)
  if (m.split && m.split.at >= 0.1 && m.split.at <= 0.9 && system !== 'curtain-wall' && !w.screen && !hand.has('wallSplit') && !hand.has('palette.brick') && !hand.has('palette')) {
    palette.brick = m.split.left; patch.wallSplit = {at: m.split.at, brick: m.split.right};
    notes.push(`wall split ${m.split.left} | ${m.split.right} at ${Math.round(m.split.at * 100)} % (dE ${m.split.dE})`);
  }
  // bays and window from the photo grid the likeness gate judges (photoBays), else the padded measurement
  const pb = photoBays({measuredBays: m.bays, measuredWindow: m.window, gridColumns: L.columns.photo, gridWindow: L.photoGrid?.window});
  if (pb.source === 'grid' && m.bays !== pb.bays && !maskDistrusted) notes.push(`bays ${pb.bays} from the likeness grid (padded measurement ${m.bays ?? '-'})`);
  const shaped = ['brick-bay-grid', 'ribbon-windows', 'plinth-shopfronts', 'glazed-columns', 'french-window-ledge'].includes(system) && !w.screen;
  if (maskDistrusted) notes.push('bays and window shape not written (folded from the distrusted not-wall mask)');
  if (shaped && pb.window && !hand.has('windowShape') && !maskDistrusted) {
    const h = clamp(pb.window.h, 0.08, 0.98), sill = clamp(Math.min(pb.window.sill, 0.98 - h), 0, 0.9);
    patch.windowShape = {w: clamp(pb.window.w, 0.08, 0.98), h: +h.toFixed(3), sill: +sill.toFixed(3)};
  }
  if (opts.bays && pb.bays && !maskDistrusted && system !== 'curtain-wall' && !hand.has('baysPerStorey') && w.alignWith === undefined) patch.baysPerStorey = clamp(pb.bays, 1, 80);
  // a glazed ground band far above the upper storeys: a plinth on storey 0 (glazedPlinth); never over a hand plinth,
  // a ground system of its own or a wall without a face for it
  const groundFree = (w.ground ?? 'system') === 'system' && !w.hoist && !w.gateways && !w.hallDoors && !w.souterrain && !w.loggias?.storeys.includes(0);
  if (w.plinth === undefined && !hand.has('plinth') && groundFree && !['curtain-wall', 'glazed-hall', 'glazed-columns'].includes(system) && !w.screen) {
    const gp = glazedPlinth({ground: m.ground, storeyGlazing: m.storeyGlazing, glass: m.glass, wall: m.wall, usable: Math.min(m.usable, L.evidence.usable), foliage: m.foliage, washedOut: m.washedOut});
    if (gp.plinth) { patch.plinth = gp.plinth; notes.push(`glazed plinth: ground band ${Math.round((m.ground ?? 0) * 100)} % over upper storeys ${(m.storeyGlazing ?? []).slice(1).filter(v => v !== null).map(v => Math.round(v! * 100)).join('/')} %`); }
  }
  // light bands across the wall (speklagen, stone courses) seen at the same place in two or more storeys: stone bands,
  // never over bands drawn another way (string courses, courses) or a hand `dressings`
  const bands = m.lightBands ? proposeBands(m.lightBands) : null;
  if (bands && !hand.has('dressings') && !hand.has('dressings.bands') && !w.dressings?.bands && !w.stringCourses && !w.courses && !w.stoneStoreys) {
    patch.dressings = {...(w.dressings ?? {}), bands};
    notes.push(`light bands: ${bands.at.join('+')} on storeys ${bands.storeys.join(',')} (${m.lightBands!.map(b => `${b.at}@${b.v0}-${b.v1} m ${Math.round(b.share * 100)} %`).join(', ')})`);
  }
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
  if (m.frontClass === 'columns' && w.system !== 'glazed-columns') kit.push(`glazed-columns: full-height glazing in bays across storey lines, drawn as ${w.system} (glazed-columns needs the column bays by hand)`);
  if (m.window && (m.window.w > 0.98 || m.window.h > 0.98 || m.window.w < 0.08 || m.window.h < 0.08)) kit.push(`window-shape-range: measured ${m.window.w}x${m.window.h} outside the windowShape range`);
  if (m.frontClass === 'curtain' && w.system === 'plinth-shopfronts') kit.push('curtain-over-plinth: curtain glazing above a shopfront plinth on one group; no kit system');
  return {kit, evidence};
}

/**
 * Close the loop on glazing: the folded window extents and the kit's frames and bay layout do not reproduce the photo's
 * glazing exactly, so compile, compare the model's upper-storey glazing with the photo's and rescale the group's
 * windowShape (width by photo / model, height only for what the width range cannot take, sill kept) until within 0.05, at most three rounds. Groups with
 * `windowShape` in `hand`, without a measured shape, or without evidence are left alone.
 */
async function refineGlazing(id: string, file: string) {
  for (let round = 1; round <= 3; round++) {
    const {likeness} = await compileLargeHouse(id), intent: LargeBuildingIntent = JSON.parse(await fs.readFile(file, 'utf8'));
    let changed = 0;
    for (const g of likeness ?? []) {
      const w = intent.walls[g.group], L = g.likeness;
      if (!L || L.verdict === 'NO EVIDENCE' || !w.windowShape || w.hand?.includes('windowShape') || !intent.measured?.groups.includes(g.group)) continue;
      const p = L.glazing.photoMean, m = L.glazing.modelMean;
      if (m < 0.02 || Math.abs(p - m) <= 0.05) continue;
      // width first (the storey lines fix the folded height better than the bay pitch fixes the width); height only for
      // what the width cannot take within its range
      // where the photo's window shape class is known and the model already matches it, scale width and height together
      // (the aspect, so the class, is kept: OBA IJburg walls[2] went square -> wide under width-first); else width first
      const s = w.windowShape, keepAspect = L.shape.photo !== null && L.shape.pass === true;
      const ww = clamp(+(s.w * (keepAspect ? Math.sqrt(p / m) : p / m)).toFixed(3), 0.08, 0.98), rest = (p / m) / (ww / s.w), h = clamp(+(s.h * rest).toFixed(3), 0.08, 0.98 - s.sill);
      if (Math.abs(h - s.h) < 0.005 && Math.abs(ww - s.w) < 0.005) continue;
      console.log(`  refine walls[${g.group}] round ${round}: glazing model ${m.toFixed(2)} vs photo ${p.toFixed(2)}; windowShape ${s.w}x${s.h} -> ${ww}x${h}`);
      w.windowShape = {...s, w: ww, h}; changed++;
    }
    if (!changed) return;
    validateLargeIntent(intent);
    await fs.writeFile(file, JSON.stringify(intent, null, 1));
  }
}

/** Triangles of a compiled group (the GLB export keeps every triangle: the same count as report.json `triangles`). */
function groupTriangles(g: {traverse(f: (o: any) => void): void}): number {
  let n = 0;
  g.traverse(o => { const geo = o.geometry; if (geo) n += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3; });
  return n;
}

/**
 * A drafted intent over its triangle budget: blank its unphotographed groups, most expensive first (draftBudgetCap).
 * Each group's cost is what the house loses when that group alone is drawn blank.
 */
async function capDraftBudget(id: string, file: string) {
  const intent: LargeBuildingIntent = JSON.parse(await fs.readFile(file, 'utf8')), facts = JSON.parse(await fs.readFile(path.join(HOUSES, id, 'facts.json'), 'utf8'));
  const budget = intent.budgetTriangles ?? LARGE_BUDGET_TRIANGLES, total = groupTriangles(compileBuilding(intent, facts).group);
  if (total <= budget) return;
  const measured = new Set(intent.measured?.groups ?? []);
  const costs = intent.walls.map((w, gi) => {
    if (w.system === 'blank' || measured.has(gi)) return {group: gi, cost: 0, measured: measured.has(gi), entrance: !!w.entrance};
    const x: LargeBuildingIntent = structuredClone(intent); x.walls[gi] = {...x.walls[gi], system: 'blank'};
    return {group: gi, cost: total - groupTriangles(compileBuilding(x, facts).group), measured: false, entrance: !!w.entrance};
  });
  const {blank, over} = draftBudgetCap(costs, total, budget);
  for (const gi of blank) intent.walls[gi].system = 'blank';
  intent.notes = [...(intent.notes ?? []).filter(t => !t.startsWith('Triangle budget: ')), `Triangle budget: ${total} > ${budget}; unphotographed groups ${blank.join(', ') || 'none'} drawn blank (draftBudgetCap)${over ? `; still ${over} over from the photographed groups` : ''}.`];
  validateLargeIntent(intent);
  await fs.writeFile(file, JSON.stringify(intent, null, 1));
  console.log(`  budget: ${total} > ${budget}: blanked groups ${blank.join(', ') || 'none'}${over ? `, still ${over} over` : ''}`);
}

export async function measureHouse(id: string, opts: {write: boolean; system: boolean; bays: boolean; debug?: boolean; measuredFile?: string}) {
  requireSourceData();
  const {likeness, report} = await compileLargeHouse(id);
  if (!likeness) throw Error(`${id}: no archived crops for pand ${report.pandId} (all-walls.ts --pand=${report.pandId} --archive)`);
  const file = path.join(HOUSES, id, 'intent.json'), intent: LargeBuildingIntent = JSON.parse(await fs.readFile(file, 'utf8'));
  const summary = likenessSummary(likeness);
  const out = {id, pandId: intent.pandId, date: today(), method: 'measureFacade.ts (k=4 clusters on smoothed normalised Lab + texture, wall = clusters enriched in the floor zones, mixed edge cells by nearest pure colour, light-trim exposure normalisation, autocorrelated bay/storey rhythm, colour split along u) on all-walls.ts --archive crops paired by cropToPanel.ts; likeness.ts against the model elevation',
    groups: summary.map((row, i) => ({...row, gaps: groupGaps(intent.walls[likeness[i].group], likeness[i])}))};
  const measuredFile = opts.measuredFile ?? path.join(HOUSES, id, 'measured.json');
  await fs.mkdir(path.dirname(measuredFile), {recursive: true});
  await fs.writeFile(measuredFile, JSON.stringify(out, null, 1) + '\n');
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
  const builtYear: number | null = JSON.parse(await fs.readFile(path.join(HOUSES, id, 'facts.json'), 'utf8')).heights?.builtYear ?? null;
  const areaOf = (g: GroupLikeness) => (g.box ? (g.box.u1 - g.box.u0) * (g.box.v1 - g.box.v0) : 0);
  // the building's majority measured system: the trusted proposals of the groups with evidence (a distrusted curtain falls back to it)
  const trusted = likeness.flatMap(g => {
    if (!g.likeness || g.likeness.verdict === 'NO EVIDENCE' || cropPredatesBuilding(g.crop?.capturedAt, builtYear)) return [];
    const {system, distrust} = proposedSystem(intent.walls[g.group], g);
    // a curtain wall is never the fallback for a distrusted curtain class: the majority of the other trusted systems
    return system && system !== 'curtain-wall' && !distrust.length ? [{system, areaM2: areaOf(g)}] : [];
  });
  for (const g of likeness) {
    const w = intent.walls[g.group], {patch, notes: n} = proposeGroup(w, g, {...opts, builtYear, fallbackSystem: trusted.length ? majoritySystem(trusted, w.system) : undefined});
    if (!Object.keys(patch).length) { notes.push(...n.map(t => `walls[${g.group}] ${t}`)); continue; }
    Object.assign(w, patch); measuredGroups.push(g.group); notes.push(...n.map(t => `walls[${g.group}] ${t}`));
    for (const src of cropSources(g)) if (!sources.some(s => s.id === src.id)) sources.push(src);
  }
  if (measuredGroups.length) {
    // a drafted intent: the walls no photo shows take the photographed walls' area-weighted median colour and family
    // (inheritedWall), drawn as measured (`measured.otherWalls`); a hand-authored house palette is never touched
    let inherited: ReturnType<typeof inheritedWall> = null;
    if (isDraftIntent(intent)) {
      inherited = inheritedWall(likeness.filter(g => measuredGroups.includes(g.group)).map(g => ({hex: g.measured!.wall, family: g.likeness!.wall.photoFamily, areaM2: areaOf(g)})));
      if (inherited) {
        intent.palette = {...intent.palette, brick: inherited.brick, ...(inherited.wallMaterial === 'stucco' ? {wallMaterial: 'stucco' as const} : {})};
        // under a stucco house the groups whose own photo shows brick courses keep brick
        if (inherited.wallMaterial === 'stucco') for (const g of likeness) if (measuredGroups.includes(g.group) && g.likeness!.wall.photoFamily === 'brick' && !intent.walls[g.group].wallMaterial) intent.walls[g.group].wallMaterial = 'brick';
        notes.push(`unphotographed walls take ${inherited.brick} (${inherited.wallMaterial}), the area-weighted median of groups ${measuredGroups.join(', ')}`);
      }
    }
    // keep sources that are not staging crops (other evidence); the archived crops replace the staging ones
    intent.sources = [...sources, ...intent.sources.filter(s => !s.image?.startsWith('staging/pand-reference-walls/') && !sources.some(n => n.id === s.id))];
    // groups measured earlier by hand from the crops (a palette colour kept in `hand`) stay measured
    const kept = (intent.measured?.groups ?? []).filter(gi => !measuredGroups.includes(gi) && intent.walls[gi]?.hand?.some(k => k === 'palette' || k.startsWith('palette.')));
    intent.measured = {date: today(), groups: [...measuredGroups, ...kept].sort((a, b) => a - b), ...(inherited ? {otherWalls: true} : {})};
    intent.notes = [...(intent.notes ?? []).filter(t => !t.startsWith('Measured ')), `Measured ${today()} (measure.ts, evidence in measured.json): groups ${measuredGroups.join(', ')} take the photo's wall and glass colour, window shape, bay count and front class${notes.length ? '; ' + notes.join('; ') : ''}.`];
    validateLargeIntent(intent);
    await fs.writeFile(file, JSON.stringify(intent, null, 1));
    console.log(`  wrote ${file}: groups ${measuredGroups.join(', ')}`);
    await refineGlazing(id, file);
    if (isDraftIntent(intent)) await capDraftBudget(id, file);
  }
  return out;
}

if (process.argv[1]?.endsWith('building-recipes/measure.ts')) {
  const ids = (process.argv.find(a => a.startsWith('--house='))?.slice(8) ?? '').split(',').filter(Boolean);
  if (!ids.length) throw Error('Use --house=<id>[,<id>...]');
  try {
    const measuredOut = process.argv.find(a => a.startsWith('--measured-out='))?.slice(15);
    if (measuredOut && ids.length > 1) throw Error('--measured-out takes one --house');
    for (const id of ids) { console.log(id); await measureHouse(id, {write: process.argv.includes('--write'), system: !process.argv.includes('--no-system'), bays: !process.argv.includes('--no-bays'), debug: process.argv.includes('--debug'), measuredFile: measuredOut}); }
  } finally { await closeRenderer(); }
}
