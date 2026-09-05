/**
 * The cases where a person's judgement is worth more than another measurement.
 *
 * Most of this pipeline's remaining error is not evenly spread — it sits in a
 * few identifiable classes, and for each one the machine has taken it as far as
 * geometry can. What is left is a question only a person can settle quickly, and
 * each class needs a *different* question. A deck that asks the same three
 * things about every building spends attention where it is not needed and never
 * asks the thing that would unblock a class of failures.
 *
 * So this page groups by what is actually unknown:
 *
 *   **Which wall is the front?** 22 buildings where the elevation being measured
 *   has no unobstructed view from any of ~188 candidate camera positions, while
 *   another elevation of the same pand has a median of 220. Almost certainly a
 *   rear or courtyard wall was chosen. Switching is a one-line change; being
 *   sure it is right is not, and a person can see it in a second.
 *
 *   **What is in the way?** Views where the outline sits correctly and the
 *   cross-view correlation is still noise. The geometric occlusion test only
 *   knows about buildings, so a tree, a moored boat or scaffolding is invisible
 *   to it. Naming the obstruction decides whether the answer is a tree register,
 *   a different standpoint, or a different season.
 *
 *   **Is the roofline right?** The box is drawn to 3DBAG's maximum roof height,
 *   which comes from lidar and can miss a thin parapet or cornice. A metre here
 *   is invisible in any statistic and obvious in a photograph.
 *
 * Answers go to the artifact's own store, so they reach the session that built
 * the page without a screenshot or a round trip.
 *
 * Usage: npx tsx scripts/facade-twin/build-help-wanted.ts [--per=6]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { AMSTERDAM_CAMERA, hasUsableGeometry } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import { loadTrackOffsets, planSvg, projectFootprint } from './panorama-render.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.join(CACHE, 'help-wanted');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const PER = Number(arg('per') ?? 6);

const read = async (p: string, fallback: any = null) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; } };
const registry = (await read(path.join(CACHE, `${AREA.areaId}-registry.json`))).data as Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = (await read(path.join(CACHE, `${AREA.areaId}-panoramas.json`))).data as PanoramaView[];
const byId = new Map(views.map(v => [v.panoramaId, v]));
const recon = await read(path.join(STAGING, 'recon.json'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const store = (await read(path.join(STAGING, 'measured-facades.json'), { facades: {} })).facades as Record<string, any>;
const addresses = (await read(path.join(CACHE, 'address-points.json'), { addresses: [] })).addresses as
  Array<{ street: string; houseNumber: number; rd: ProjectedPoint; pandId: string | null }>;
const reported = (await read(path.join(CACHE, 'cross-view-registration.json'), { panden: [] })).panden as any[];
const trackOffset = await loadTrackOffsets(CACHE);

const footprints = new Map<string, ProjectedPoint[]>();
for (const e of registry) if (!footprints.has(e.buildingId)) footprints.set(e.buildingId, e.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
const label = new Map<string, string>();
const addressesOf = new Map<string, ProjectedPoint[]>();
for (const a of addresses) if (a.pandId) {
  if (!label.has(a.pandId)) label.set(a.pandId, `${a.street} ${a.houseNumber}`);
  (addressesOf.get(a.pandId) ?? addressesOf.set(a.pandId, []).get(a.pandId)!).push(a.rd);
}

const posed = views.filter(hasUsableGeometry).map(v => ({ v, p: RD_NEW.fromLngLat(v.lngLat) }));
const CELL = 50, index = new Map<string, typeof posed>();
for (const q of posed) { const k = `${Math.floor(q.p.x / CELL)}:${Math.floor(q.p.y / CELL)}`; (index.get(k) ?? index.set(k, []).get(k)!).push(q); }
const nearby = (x: number, y: number) => {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); const out: typeof posed = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(index.get(`${cx + i}:${cy + j}`) ?? []));
  return out;
};
const rayHit = (a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint) => {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y, den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den, u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  return u > 1e-9 && u < 1 - 1e-9 ? t : null;
};
const blocked = (from: ProjectedPoint, to: ProjectedPoint, pandId: string) => {
  for (const [otherId, ring] of footprints) {
    if (otherId === pandId) continue;
    if (Math.hypot(ring[0].x - to.x, ring[0].y - to.y) > 90) continue;
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      const t = rayHit(from, to, ring[i], ring[j]);
      if (t !== null && t > 0.02 && t < 0.94) return true;
    }
  }
  return false;
};
const clearViews = (e: any, pandId: string) => nearby(e.midpoint.x, e.midpoint.y).filter(q => {
  if (!inFrontOf(e, q.p)) return false;
  const so = standoffM(e, q.p);
  return so >= 8 && so <= 45 && obliquityDeg(e, q.p) <= 35 && !blocked(q.p, e.midpoint, pandId);
});

const decoded = new Map<string, any>();
let downloads = 0;
async function panorama(id: string) {
  if (decoded.has(id)) return decoded.get(id);
  if (decoded.size > 4) decoded.clear();
  const file = path.join(CACHE, 'panoramas', `${id}.jpg`);
  // The alternative frontage is, by construction, seen from cameras the old
  // pipeline never used, so its panorama is usually not on disk. A page that
  // asks "which of these two" and shows one is worse than useless.
  if (!existsSync(file) && downloads < 40) {
    const view = byId.get(id);
    if (view?.imageUrl) {
      try {
        const response = await fetch(view.imageUrl, { signal: AbortSignal.timeout(90_000) });
        if (response.ok) {
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length > 100_000) { await writeFile(file, bytes); downloads++; }
        }
      } catch { /* leave it missing */ }
    }
  }
  if (!existsSync(file)) return null;
  const image = jpeg.decode(await readFile(file), { useTArray: true, formatAsRGBA: true });
  decoded.set(id, image);
  return image;
}
async function shot(pandId: string, view: PanoramaView, wall: readonly number[], width = 560) {
  const image = await panorama(view.panoramaId);
  if (!image) return null;
  const mass = massing.get(pandId);
  const out = projectFootprint(image, view, AMSTERDAM_CAMERA, footprints.get(pandId)!, wall,
    mass.groundLevel, Math.max(mass.ridgeHeight ?? 0, mass.eavesHeight ?? 0),
    { maxWidth: width, quality: 80, contextFraction: 0.55, eavesZ: mass.eavesHeight, heightOffsetM: trackOffset(view).offsetM });
  return out ? { image: out.jpeg.toString('base64'), nativeWidth: out.nativeWidth } : null;
}
const plan = (pandId: string, wall: readonly number[]) => {
  const ring = footprints.get(pandId)!;
  const neighbours: ProjectedPoint[][] = [];
  const c = { x: (wall[0] + wall[2]) / 2, y: (wall[1] + wall[3]) / 2 };
  for (const [otherId, other] of footprints) {
    if (otherId === pandId) continue;
    if (Math.hypot(other[0].x - c.x, other[0].y - c.y) < 45) neighbours.push(other);
    if (neighbours.length > 35) break;
  }
  return planSvg(ring, wall, [], addressesOf.get(pandId) ?? [], neighbours, { width: 250, minHeight: 150, maxHeight: 210 });
};

// ---- the three classes --------------------------------------------------
const cases: any[] = [];
const wallOfPand = (pandId: string) => {
  const ring = footprints.get(pandId)!, rec = store[pandId];
  const mid = { x: (rec.wall[0] + rec.wall[2]) / 2, y: (rec.wall[1] + rec.wall[3]) / 2 };
  return buildElevations(ring).map(e => {
    const ux = (e.end.x - e.start.x) / e.lengthM, uy = (e.end.y - e.start.y) / e.lengthM;
    const a = Math.max(0, Math.min(e.lengthM, (mid.x - e.start.x) * ux + (mid.y - e.start.y) * uy));
    return { e, d: Math.hypot(mid.x - (e.start.x + ux * a), mid.y - (e.start.y + uy * a)) };
  }).sort((a, b) => a.d - b.d)[0].e;
};

for (const r of reported) {
  if (cases.filter(c => c.kind === 'which-wall').length >= PER) break;
  if (Math.abs(r.shiftM) < 2) continue;
  const ring = footprints.get(r.pandId), rec = store[r.pandId], mass = massing.get(r.pandId);
  if (!ring || !rec || !Number.isFinite(mass?.groundLevel)) continue;
  const current = wallOfPand(r.pandId);
  if (clearViews(current, r.pandId).length > 0) continue;
  const better = buildElevations(ring).filter(e => e !== current && e.lengthM >= 3)
    .map(e => ({ e, n: clearViews(e, r.pandId) })).filter(x => x.n.length > 0)
    .sort((a, b) => b.n.length - a.n.length)[0];
  if (!better) continue;
  const alt = better.n.sort((a, b) => obliquityDeg(better.e, a.p) - obliquityDeg(better.e, b.p))[0];
  const currentView = byId.get(rec.panoramaId);
  const [nowShot, altShot] = [
    currentView ? await shot(r.pandId, currentView, [current.start.x, current.start.y, current.end.x, current.end.y]) : null,
    await shot(r.pandId, alt.v, [better.e.start.x, better.e.start.y, better.e.end.x, better.e.end.y]),
  ];
  // A "which of these two" question needs two pictures.
  if (!nowShot || !altShot) continue;
  cases.push({
    kind: 'which-wall', pandId: r.pandId, label: label.get(r.pandId) ?? r.pandId,
    question: 'Which of these is the street frontage?',
    plan: plan(r.pandId, [current.start.x, current.start.y, current.end.x, current.end.y]),
    facts: `wall now ${current.lengthM.toFixed(1)} m facing ${current.facingDeg.toFixed(0)}° · 0 clear views`
      + ` — alternative ${better.e.lengthM.toFixed(1)} m facing ${better.e.facingDeg.toFixed(0)}° · ${better.n.length} clear views`,
    options: ['The one on the left (current)', 'The one on the right (alternative)', 'Neither — no frontage visible', 'Cannot tell'],
    shots: [{ image: nowShot.image, caption: `current — ${current.lengthM.toFixed(1)} m, no clear view exists` },
            { image: altShot.image, caption: `alternative — ${better.e.lengthM.toFixed(1)} m, ${better.n.length} clear views` }],
  });
}

for (const r of reported) {
  if (cases.filter(c => c.kind === 'obstruction').length >= PER) break;
  if (Math.abs(r.shiftM) < 2 || r.peak > 0.12) continue;
  if (r.occludedA || r.occludedB) continue;              // a building in the way is already known
  const rec = store[r.pandId], mass = massing.get(r.pandId);
  if (!rec || !Number.isFinite(mass?.groundLevel)) continue;
  const current = wallOfPand(r.pandId);
  const view = byId.get(rec.panoramaId);
  if (!view) continue;
  const image = await shot(r.pandId, view, [current.start.x, current.start.y, current.end.x, current.end.y], 620);
  // Below about 300 native pixels the crop is a blur and the question is unfair.
  if (!image || image.nativeWidth < 300) continue;
  cases.push({
    kind: 'obstruction', pandId: r.pandId, label: label.get(r.pandId) ?? r.pandId,
    question: 'The outline looks right and two views still disagree. What is in the way?',
    plan: plan(r.pandId, [current.start.x, current.start.y, current.end.x, current.end.y]),
    facts: `correlation peak ${r.peak.toFixed(3)} — noise · shift ${r.shiftM} m · no building blocks the line of sight`,
    options: ['A tree', 'A moored boat', 'Scaffolding or hoarding', 'A parked van or lorry', 'Nothing — it looks clear', 'Something else'],
    shots: [{ image: image.image, caption: `${view.capturedAt.slice(0, 10)} · the view the measurement used · ${image.nativeWidth} px of source` }],
  });
}

for (const r of reported) {
  if (cases.filter(c => c.kind === 'roofline').length >= PER) break;
  if (Math.abs(r.shiftM) >= 1 || r.peak < 0.15) continue;   // only the ones that register well
  const rec = store[r.pandId], mass = massing.get(r.pandId);
  if (!rec || !Number.isFinite(mass?.ridgeHeight)) continue;
  const current = wallOfPand(r.pandId);
  const view = byId.get(rec.panoramaId);
  if (!view) continue;
  const image = await shot(r.pandId, view, [current.start.x, current.start.y, current.end.x, current.end.y], 560);
  if (!image || image.nativeWidth < 300) continue;
  cases.push({
    kind: 'roofline', pandId: r.pandId, label: label.get(r.pandId) ?? r.pandId,
    question: 'Green is the top of the building as 3DBAG has it. Where does the building actually stop?',
    plan: plan(r.pandId, [current.start.x, current.start.y, current.end.x, current.end.y]),
    facts: `ground ${mass.groundLevel.toFixed(2)} m · eaves ${mass.eavesHeight?.toFixed(2)} (orange) · ridge ${mass.ridgeHeight.toFixed(2)} (green top)`
      + ` · registers to ${Math.abs(r.shiftM).toFixed(2)} m sideways`,
    options: ['Green is right', 'Green is too low', 'Green is too high', 'Cannot tell'],
    shots: [{ image: image.image, caption: `${view.capturedAt.slice(0, 10)} · green top = ridge, orange = eaves · ${image.nativeWidth} px of source` }],
  });
}

await mkdir(OUT, { recursive: true });
const GROUPS = [
  { kind: 'which-wall', title: 'Which wall is the front?',
    blurb: 'The elevation being measured has no unobstructed view from any of about 188 candidate camera positions, '
      + 'while another elevation of the same building has hundreds. That reads as a rear or courtyard wall being '
      + 'measured instead of the frontage. Switching is easy; being sure is not.' },
  { kind: 'obstruction', title: 'What is in the way?',
    blurb: 'The outline sits on the right building and two independent views still refuse to agree. '
      + 'The occlusion test only knows about buildings, so a tree, a boat or scaffolding is invisible to it. '
      + 'Naming the obstruction decides whether the fix is a tree register, a different standpoint, or a different season.' },
  { kind: 'roofline', title: 'Is the roofline right?',
    blurb: 'These register well sideways, so the identity is not in doubt. The top of the box is 3DBAG’s maximum '
      + 'roof height, taken from lidar, which can miss a thin parapet or a cornice. A metre here is invisible in '
      + 'every statistic and obvious in a photograph.' },
];

const card = (c: any, i: number) => `
<article class="case" data-id="${c.pandId}-${c.kind}" data-kind="${c.kind}">
  <header><h3>${c.label}</h3><p class="facts">${c.facts}</p></header>
  <div class="body">
    <div class="plan">${c.plan}</div>
    <div class="shots">${c.shots.map((s: any) => `<figure><img src="data:image/jpeg;base64,${s.image}" alt="">
      <figcaption>${s.caption}</figcaption></figure>`).join('')}</div>
  </div>
  <div class="ask"><p class="q">${c.question}</p>
    <div class="opts">${c.options.map((o: string) => `<button type="button" data-answer="${o}">${o}</button>`).join('')}</div>
    <p class="said" aria-live="polite"></p></div>
</article>`;

const page = `<title>Help Wanted</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;600&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400&display=swap">
<style>
  :root { --paper:#f5f4ef; --panel:#fbfaf7; --ink:#191c19; --muted:#6c716b; --rule:#dedbd2;
    --ask:#8a4a1f; --good:#1f6b45; --plan:#2f6fd0; --wall:#1f8a4c;
    --display:"Zilla Slab",Georgia,serif; --body:"Source Sans 3",system-ui,sans-serif;
    --mono:"JetBrains Mono",ui-monospace,Menlo,monospace; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --paper:#141614; --panel:#1c1f1c; --ink:#eceae3; --muted:#979d96; --rule:#2d312d;
    --ask:#d9a05e; --good:#5fb98a; --plan:#7aa8e8; --wall:#5fb98a; } }
  :root[data-theme="dark"] { --paper:#141614; --panel:#1c1f1c; --ink:#eceae3; --muted:#979d96;
    --rule:#2d312d; --ask:#d9a05e; --good:#5fb98a; --plan:#7aa8e8; --wall:#5fb98a; }
  * { box-sizing:border-box; }
  body { background:var(--paper); color:var(--ink); font-family:var(--body); font-size:15px;
         line-height:1.55; margin:0; padding:2.5rem 1.25rem 5rem; }
  .wrap { max-width:1100px; margin:0 auto; }
  .eyebrow { font-family:var(--mono); font-size:.7rem; letter-spacing:.14em; text-transform:uppercase;
             color:var(--muted); margin:0 0 .6rem; }
  h1 { font-family:var(--display); font-weight:600; font-size:2.1rem; margin:0 0 .6rem; letter-spacing:-.015em; }
  .lede { color:var(--muted); max-width:66ch; margin:0 0 2rem; }
  section { border-top:1px solid var(--rule); padding-top:1.6rem; margin-bottom:2.2rem; }
  h2 { font-family:var(--display); font-size:1.35rem; margin:0 0 .4rem; }
  .blurb { color:var(--muted); max-width:70ch; margin:0 0 1.4rem; font-size:.93rem; }
  .case { background:var(--panel); border:1px solid var(--rule); border-radius:5px;
          padding:1rem 1.1rem 1.1rem; margin-bottom:1.1rem; }
  .case h3 { font-family:var(--display); font-size:1.05rem; margin:0; }
  .facts { font-family:var(--mono); font-size:.72rem; color:var(--muted); margin:.25rem 0 .9rem;
           font-variant-numeric:tabular-nums; }
  .body { display:flex; gap:1rem; align-items:flex-start; flex-wrap:wrap; }
  .plan { flex:0 0 250px; }
  .plan svg { width:100%; height:auto; background:var(--paper); border:1px solid var(--rule); border-radius:3px; }
  .plan .nb { fill:color-mix(in srgb, var(--muted) 14%, transparent); stroke:var(--rule); stroke-width:.7; }
  .plan .me { fill:color-mix(in srgb, var(--plan) 16%, transparent); stroke:var(--plan); stroke-width:1.2; }
  .plan .wall { stroke:var(--wall); stroke-width:3.2; stroke-linecap:round; }
  .plan .addr { fill:#c8912f; } .plan .ray, .plan .cam { display:none; }
  .plan .scale { stroke:var(--ink); stroke-width:1.3; }
  .plan .scaletext { font-family:var(--mono); font-size:9px; fill:var(--muted); }
  .shots { display:flex; gap:.7rem; overflow-x:auto; flex:1 1 340px; padding-bottom:.3rem; }
  figure { margin:0; flex:0 0 auto; } img { display:block; border-radius:3px; max-width:100%; }
  figcaption { font-family:var(--mono); font-size:.7rem; color:var(--muted); margin-top:.3rem; }
  .ask { border-top:1px dashed var(--rule); margin-top:.9rem; padding-top:.8rem; }
  .q { font-weight:600; margin:0 0 .55rem; color:var(--ask); font-size:.95rem; }
  .opts { display:flex; gap:.45rem; flex-wrap:wrap; }
  button { font:inherit; font-size:.86rem; padding:.4rem .8rem; border:1px solid var(--rule);
           border-radius:4px; background:var(--paper); color:var(--ink); cursor:pointer; }
  button:hover { border-color:var(--ask); } button:disabled { opacity:.5; cursor:default; }
  button:focus-visible { outline:2px solid var(--plan); outline-offset:2px; }
  button.chosen { border-color:var(--good); color:var(--good); font-weight:600; }
  .said { font-family:var(--mono); font-size:.72rem; color:var(--muted); margin:.5rem 0 0; min-height:1em; }
  footer { border-top:1px solid var(--rule); padding-top:1rem; color:var(--muted); font-size:.8rem; }
  code { font-family:var(--mono); font-size:.9em; }
</style>
<div class="wrap">
<p class="eyebrow">Amsterdam façade twin</p>
<h1>Help wanted</h1>
<p class="lede">Three classes of failure where the machine has taken it as far as geometry can, and a
person can settle it in a second. Each class needs a different question, which is why they are not in
the review deck — that asks the same three things about every building, and would never ask any of
these. Answers go straight back to the working session.</p>
${GROUPS.map(g => {
  const these = cases.filter(c => c.kind === g.kind);
  if (!these.length) return '';
  return `<section><h2>${g.title}</h2><p class="blurb">${g.blurb}</p>${these.map(card).join('')}</section>`;
}).join('')}
<footer>Street imagery © Gemeente Amsterdam, <em>Kernregistratie Panoramabeelden</em>, CC BY 4.0.
Footprints and addresses from BAG; heights from 3DBAG and AHN. Generated by
<code>scripts/facade-twin/build-help-wanted.ts</code>.</footer>
</div>
<script>
  (async () => {
    const db = await claude.use('db');
    for (const el of document.querySelectorAll('.case')) {
      const said = el.querySelector('.said');
      const buttons = [...el.querySelectorAll('.opts button')];
      if (!db) { buttons.forEach(b => b.disabled = true); said.textContent = 'answering unavailable in this view'; continue; }
      try {
        const prior = await db.collection('help').where('caseId', '==', el.dataset.id).get();
        if (prior.docs.length) {
          const last = prior.docs[prior.docs.length - 1].data();
          said.textContent = 'answered: ' + last.answer;
          buttons.find(b => b.dataset.answer === last.answer)?.classList.add('chosen');
        }
      } catch (error) { /* an empty store is not an error */ }
      for (const button of buttons) {
        button.addEventListener('click', async () => {
          buttons.forEach(b => { b.disabled = true; b.classList.remove('chosen'); });
          try {
            await db.collection('help').add({
              caseId: el.dataset.id, kind: el.dataset.kind, pandId: el.dataset.id.split('-')[0],
              answer: button.dataset.answer, at: new Date().toISOString(),
            });
            button.classList.add('chosen');
            said.textContent = 'answered: ' + button.dataset.answer;
          } catch (error) {
            said.textContent = 'could not send (' + (error && error.code ? error.code : 'unknown') + ')';
          }
          buttons.forEach(b => { b.disabled = false; });
        });
      }
    }
  })();
</script>`;
await writeFile(path.join(OUT, 'index.html'), page);
console.log(`${cases.length} cases (${GROUPS.map(g => `${g.kind} ${cases.filter(c => c.kind === g.kind).length}`).join(', ')})`);
console.log(`→ ${path.relative(process.cwd(), path.join(OUT, 'index.html'))} (${(page.length / 1e6).toFixed(1)} MB)`);
