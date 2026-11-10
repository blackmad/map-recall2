// Register facts vs what the game's chain draws (#316 follow-up, 2026-11-10): per-field match rates for the
// ride-priority pands with facts. Node-side, no browser.
//   nice -n 19 npx tsx scripts/register-facts/measure-recipe-match.ts [--registerFacts=0|1] > out.json
// "Drawn" is read from the styled properties of the same chain the game runs (scripts/world/pipeline.ts).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { EXTRACT, gameChain, loadTile, readJson, COVERS } from '../world/pipeline.ts';
import { roofPlanForFeature } from '../../src/canalRecall/roofMesh.ts';
import { PERIOD_FROM } from '../../src/canalRecall/look/palette.ts';
const RIDE_PRIORITY_GEBIEDEN = new Set(['Centrum-West', 'Centrum-Oost', 'Oud-West, De Baarsjes', 'Westerpark', 'Oud-Zuid', 'De Pijp, Rivierenbuurt', 'Oud-Oost']); // as build-monument-facts.ts
import { registerFactsFromExtract, ELEMENT_COMPONENTS } from '../../src/canalRecall/facade/registerRecipe.ts';
import { WALL_COMPONENTS, chanceFor } from '../../src/canalRecall/facadeExtras.ts';

const arg = process.argv.find(a => a.startsWith('--registerFacts='));
const withReads = arg?.endsWith('=1') ?? false;
const FACTS = process.env.REGISTER_FACTS_FILE ?? `${EXTRACT}/staging/monument-facts.json`;
const facts: Record<string, any> = readJson(FACTS).buildings;
const covers = readJson(COVERS);
const modelled = new Set<string>(); for (const m of Object.values<any>(covers.models)) for (const id of m.p ?? []) modelled.add(`NL.IMBAG.Pand.${id}`);
const typed = new Set<string>(covers.buildingTypes.map(String));
const landmarks = new Set<string>(); for (const l of Object.values<string[]>(readJson(`${EXTRACT}/landmark-buildings.json`).buildings ?? {})) for (const id of l) landmarks.add(String(id));
const buurten = readJson(`${EXTRACT}/coverage-v1/buurten.json`).features as any[];
type Ring = number[][];
const inside = ([x, y]: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
const polys = (g: any): Ring[][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const gebiedAt = (p: number[]) => buurten.find(b => polys(b.geometry).some(poly => inside(p, poly[0])))?.properties?.gebied as string | undefined;

const eraOf = (y: number) => y < PERIOD_FROM.c19 ? 'canal' : y < PERIOD_FROM.school ? 'c19' : y < PERIOD_FROM.modern ? 'school' : 'modern';
const midOf = (d?: { from: number; to: number }) => d ? (d.from + d.to) / 2 : null;
function wallClass(hex?: string): 'brick' | 'light' | null {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
  return r - b > 18 && r >= g && l < 0.66 ? 'brick' : 'light';
}
type Tally = { n: number; match: number; byDrawn: Record<string, number>; confusion: Record<string, number> };
const tally = (): Tally => ({ n: 0, match: 0, byDrawn: {}, confusion: {} });
const bump = (t: Tally, want: string, got: string) => { t.n++; if (want === got) t.match++; const k = `${want}->${got}`; t.confusion[k] = (t.confusion[k] ?? 0) + 1; };

const fields: Record<string, Tally> = {};
const T = (k: string) => fields[k] ??= tally();
const elementStats: Record<string, { pands: number; generic: number; modelled: number; typed: number; landmark: number }> = {};
const paths: Record<string, number> = {};
const chain = gameChain({ registerFacts: withReads ? registerFactsFromExtract({ buildings: facts }) : null });
const seen = new Set<string>();
const base = `${EXTRACT}/building-tiles/14`;
for (const x of readdirSync(base)) for (const f of readdirSync(`${base}/${x}`)) {
  const rows = await loadTile(`${x}/${f.replace('.geojson.gz', '')}`, chain);
  for (const row of rows) {
    const id = String(row.raw.properties.id), fx = facts[id];
    if (!fx || seen.has(id)) continue;
    const ring = (row.raw.geometry.type === 'Polygon' ? row.raw.geometry.coordinates : row.raw.geometry.coordinates[0])[0];
    const c = ring.reduce((a: number[], p: number[]) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
    const gebied = gebiedAt(c);
    if (!gebied || !RIDE_PRIORITY_GEBIEDEN.has(gebied)) continue;
    seen.add(id);
    const styled = row.styled as any;
    const p = styled.properties;
    const path = landmarks.has(id) ? 'landmark' : modelled.has(id) ? 'model' : typed.has(id) ? 'buildingType' : p.facade === 'kit' ? 'kit' : p.facade ? 'generic' : 'noFacade';
    paths[path] = (paths[path] ?? 0) + 1;
    const gen = path === 'generic';
    // gable kind: the planned crown vs the register's.
    if (fx.gable) {
      const plan = path === 'generic' || path === 'kit' ? roofPlanForFeature(styled) : null;
      const drawn = !plan ? `none(${path})` : plan.kind === 'gable' || plan.kind === 'parapet' ? (plan.kind === 'parapet' ? 'parapet' : plan.gable) : plan.kind;
      bump(T('gable'), fx.gable, drawn); if (gen) bump(T('gable|generic'), fx.gable, drawn);
      // A cornice front is a straight (flat or parapet-topped) front: a flat lid, a parapet or an unplanned roof is the right silhouette.
      const flat = drawn === 'parapet' || drawn.startsWith('none(generic') || drawn === 'cornice';
      if (gen) bump(T('gable|generic|corniceReadsFlat'), fx.gable === 'cornice' ? 'flat' : fx.gable, fx.gable === 'cornice' && flat ? 'flat' : drawn);
    }
    // date: the register's facade (else core) date's era vs the drawn facade style's era.
    const rd = midOf(fx.facadeDate) ?? midOf(fx.coreDate);
    if (rd !== null && p.facadeStyle) {
      const drawn = p.facadeStyle === 'canal' || p.facadeStyle === 'c19' || p.facadeStyle === 'school' ? p.facadeStyle : 'modern';
      bump(T('era'), eraOf(rd), drawn); if (gen) bump(T('era|generic'), eraOf(rd), drawn);
      const by = Number(p.constructionYear);
      if (Number.isFinite(by)) bump(T('era|bagYearVsRegister'), eraOf(rd), eraOf(by));
      else T('era|bagYearMissing').n++;
    }
    // finish: painted/plaster/stone = light wall; brick/ornamentalBrick = brick-coloured wall.
    if (fx.finish && (p.sideColour || p.kitWallHex)) {
      const want = fx.finish === 'brick' || fx.finish === 'ornamentalBrick' ? 'brick' : 'light';
      const got = wallClass(p.kitWallHex ?? p.sideColour);
      if (got) { bump(T('finish'), want, got); if (gen) bump(T('finish|generic'), want, got); }
    }
    // storeys: drawn layers = eaves (else height) / 3.2 m; the register's count read as layers and as upper floors.
    if (fx.storeys && Number.isFinite(Number(p.height))) {
      const eaves = Number(p.roofEavesHeightM) > 0 ? Number(p.roofEavesHeightM) : Number(p.height);
      const drawn = Math.max(1, Math.round(eaves / 3.2));
      const t = T('storeys'); t.n++; if (drawn === fx.storeys || drawn === fx.storeys + 1) t.match++;
      const e = T('storeys|exactLayers'); e.n++; if (drawn === fx.storeys) e.match++;
      const w = T('storeys|withinOne'); w.n++; if (Math.abs(drawn - fx.storeys) <= 1) w.match++;
    }
    // Expected presence of the component on the street wall: the dice chance before, 1 once forced (budget permitting).
    if (gen) {
      const want = new Set<string>(); for (const e of fx.elements ?? []) for (const cid of ELEMENT_COMPONENTS[e.key] ?? []) want.add(cid);
      if (fx.stoneBands) want.add('string-courses');
      for (const cid of want) {
        const comp = WALL_COMPONENTS.find(c => c.id === cid); if (!comp) continue;
        const style = (p.facadeStyle ?? 'c19') as any;
        const forced = Array.isArray(p.registerForce) && p.registerForce.includes(cid) && (style === 'canal' || style === 'c19');
        const t = T(`element:${cid}`); t.n++; t.match += forced ? 1 : comp.styles.includes(style) ? chanceFor(comp.p, style) : 0;
      }
    }
    for (const e of fx.elements ?? []) {
      const s = elementStats[e.key] ??= { pands: 0, generic: 0, modelled: 0, typed: 0, landmark: 0 };
      s.pands++; if (gen) s.generic++; else if (path === 'model') s.modelled++; else if (path === 'buildingType' || path === 'kit') s.typed++; else if (path === 'landmark') s.landmark++;
    }
  }
}
const out = { withReads, facts: FACTS, ridePriorityPandsWithFacts: seen.size, paths, fields: Object.fromEntries(Object.entries(fields).map(([k, t]) => [k, { n: t.n, match: t.match, rate: t.n ? +(t.match / t.n).toFixed(3) : null, confusion: Object.fromEntries(Object.entries(t.confusion).sort((a, b) => b[1] - a[1]).slice(0, 12)) }])), elementStats };
const dest = process.env.OUT; if (dest) writeFileSync(dest, JSON.stringify(out, null, 1)); else console.log(JSON.stringify(out, null, 1));
