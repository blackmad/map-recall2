/**
 * GLB quality gate + audit.
 *
 *   npx tsx scripts/audit-glb-quality.ts --id=torture-museum        # gate one landmark (exit 1 on fail)
 *   npx tsx scripts/audit-glb-quality.ts --file=path/to.glb
 *   npx tsx scripts/audit-glb-quality.ts                            # audit every landmark GLB
 *   npx tsx scripts/audit-glb-quality.ts --set=ordinary [--limit=200]
 *   flags: --shots (contact images of top offenders), --top=15, --out=artifacts/glb-audit, --quiet
 *
 * Landmark geometry audit (src/canalRecall/landmarks/geometryAudit.ts) runs on landmark GLBs too: detached openings
 * (window/door parts floating off, buried in, or hanging past their wall), window rhythm per facade (photo spec from
 * scripts/landmarks/<id>-elevations.json when present) and coplanar z-fighting. Existing offenders are recorded in
 * scripts/landmarks/geometry-audit-baseline.json; a model fails only when a gated count grows beyond its baseline.
 *   --no-geometry            skip it            --write-baseline     record current counts as the baseline
 *   --only-geometry          skip the shell checks (fast geometry-only run)
 *   --geometry-shots         close-up evidence of the worst issue per top offender (artifacts/glb-audit/geometry/)
 *
 * Install scripts call it with --id=<id> and must see exit code 0. Thresholds live in
 * src/canalRecall/landmarks/glbQuality.ts (DEFAULT_THRESHOLDS) and are documented there.
 */
import fs from 'node:fs';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {analyseSoup, DEFAULT_THRESHOLDS, type QualityReport, type Thresholds, type TriSoup} from '../src/canalRecall/landmarks/glbQuality';
import {geometryAudit, regressions, type GeometryAuditReport} from '../src/canalRecall/landmarks/geometryAudit';
import type {ElevationsFile} from '../src/canalRecall/landmarks/facadeCompare';
import {loadMaterialSoup} from './landmarks/material-soup';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODELS = path.join(ROOT, 'public/canal-drive/models');

export async function loadSoup(file: string): Promise<TriSoup> {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder}).read(file);
  return soupFromDocument(doc);
}

export function soupFromDocument(doc: import('@gltf-transform/core').Document): TriSoup {
  const pos: number[] = [];
  const idx: number[] = [];
  const ds: number[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;
      const position = prim.getAttribute('POSITION');
      if (!position) continue;
      const base = pos.length / 3;
      const v: number[] = [0, 0, 0];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, v);
        pos.push(
          m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
          m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
          m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
        );
      }
      const index = prim.getIndices();
      const n = index ? index.getCount() : position.getCount();
      // Mirrored transforms flip winding.
      const doubleSided = prim.getMaterial()?.getDoubleSided() ? 1 : 0;
      const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
      for (let i = 0; i + 2 < n; i += 3) {
        const a = index ? index.getScalar(i) : i, b = index ? index.getScalar(i + 1) : i + 1, c = index ? index.getScalar(i + 2) : i + 2;
        if (det < 0) idx.push(base + a, base + c, base + b); else idx.push(base + a, base + b, base + c);
        ds.push(doubleSided);
      }
    }
  }
  return {positions: new Float32Array(pos), indices: new Uint32Array(idx), doubleSided: new Uint8Array(ds)};
}

export async function auditFile(file: string, th: Partial<Thresholds> = {}): Promise<QualityReport> {
  return analyseSoup(await loadSoup(file), th);
}

/** Per-model thresholds: a model spec may list `partyWallBearings` (compass degrees) of walls that adjoin neighbouring buildings and are genuinely blind. */
function modelThresholds(id: string): Partial<Thresholds> {
  try {
    const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/landmarks', `${id}-spec.json`), 'utf8'));
    const out: Partial<Thresholds> = {};
    if (Array.isArray(spec.partyWallBearings)) out.blankWallExemptBearings = spec.partyWallBearings;
    // Declared roadways/passages through the building ({axisBearing, corridor: [[x,z],...], evidence}); see Thresholds.throughPassages.
    if (typeof spec.siteModel === 'boolean') out.siteModel = spec.siteModel;
    if (Array.isArray(spec.throughPassages)) out.throughPassages = spec.throughPassages;
    // Declared free-standing structures ({box: [minX, minZ, maxX, maxZ], evidence}) exempt from the far-outside check; see Thresholds.detachedStructures.
    if (Array.isArray(spec.detachedStructures)) out.detachedStructures = spec.detachedStructures;
    return out;
  } catch { return {}; }
}

interface Row {id: string; file: string; status?: string; report: QualityReport; ms: number; geometry?: GeometryAuditReport}

const BASELINE = path.join(ROOT, 'scripts/landmarks/geometry-audit-baseline.json');
type Baseline = {generated: string; note: string; models: Record<string, Record<string, number>>};
function readBaseline(): Baseline | undefined {
  try { return JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch { return undefined; }
}

async function auditGeometry(id: string, file: string): Promise<GeometryAuditReport> {
  const specFile = path.join(ROOT, 'scripts/landmarks', `${id}-elevations.json`);
  const spec = fs.existsSync(specFile) ? (JSON.parse(fs.readFileSync(specFile, 'utf8')) as ElevationsFile) : undefined;
  return geometryAudit(await loadMaterialSoup(file), {facades: spec?.facades});
}

/** Geometry findings join the report; within the baseline they stay warnings, growth past it fails the model. */
function mergeGeometry(report: QualityReport, g: GeometryAuditReport, base: Record<string, number> | undefined): void {
  const grown = regressions(g.counts, base);
  for (const f of g.findings) report.findings.push({kind: f.kind, severity: f.severity === 'fail' && grown.length ? 'fail' : 'warn', message: f.message + (f.severity === 'fail' && !grown.length ? ' [baselined]' : '')});
  if (grown.length) {
    report.findings.push({kind: 'geometry-regression', severity: 'fail', message: `geometry audit grew past scripts/landmarks/geometry-audit-baseline.json: ${grown.join('; ')}`});
    report.pass = false;
  }
  report.score += g.score / 10;
}

/** Strip triangle lists from the JSON report (they are only needed for the evidence shots). */
function slim(g: GeometryAuditReport) {
  return {...g, openings: {...g.openings, issues: g.openings.issues.slice(0, 40).map(({triangles, ...i}) => ({...i, triangles: triangles.length}))},
    zfight: {...g.zfight, patches: g.zfight.patches.slice(0, 40).map(({trisA, trisB, samples, ...p}) => ({...p, triangles: trisA.length + trisB.length}))},
    rhythm: g.rhythm.map(f => ({...f, mismatched: f.mismatched.slice(0, 20)}))};
}

function arg(name: string): string | undefined {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function listTargets(): {id: string; file: string; status?: string}[] {
  const file = arg('file');
  if (file) return [{id: path.basename(file, '.glb'), file: path.resolve(file)}];
  const set = arg('set') ?? 'landmarks';
  const idArg = arg('id');
  if (set === 'ordinary') {
    const dir = path.join(MODELS, 'ordinary-buildings');
    let files = fs.readdirSync(dir).filter(f => f.endsWith('.glb')).sort();
    if (idArg) files = files.filter(f => idArg.split(',').includes(f.replace('.glb', '')));
    const stride = Math.max(1, Math.floor(files.length / Number(arg('limit') ?? files.length)));
    return files.filter((_, i) => i % stride === 0).map(f => ({id: f.replace('.glb', ''), file: path.join(dir, f)}));
  }
  const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/landmarks/manualCatalogue.json'), 'utf8')) as {id: string; modelUrl: string; status?: string}[];
  const statusById = new Map(catalogue.map(c => [c.id, c.status]));
  const sig = JSON.parse(fs.readFileSync(path.join(MODELS, 'signature-landmarks.json'), 'utf8')).models as Record<string, {modelUrl: string}>;
  const all = new Map<string, string>();
  for (const [id, m] of Object.entries(sig)) all.set(id, m.modelUrl);
  for (const c of catalogue) all.set(c.id, c.modelUrl);
  let ids = [...all.keys()];
  if (idArg) ids = idArg.split(',');
  return ids
    .map(id => ({id, file: path.join(MODELS, (all.get(id) ?? `./models/${id}.glb`).replace(/^\.\/models\//, '')), status: statusById.get(id)}))
    .filter(t => fs.existsSync(t.file));
}

function md(rows: Row[], th: Thresholds): string {
  const sorted = [...rows].sort((a, b) => b.report.score - a.report.score);
  const kinds = new Map<string, {fail: number; warn: number}>();
  for (const r of rows) for (const f of r.report.findings) {
    const k = kinds.get(f.kind) ?? {fail: 0, warn: 0};
    k[f.severity]++;
    kinds.set(f.kind, k);
  }
  const failing = sorted.filter(r => !r.report.pass);
  const lines = [
    '# GLB quality audit', '',
    `${rows.length} models audited, ${failing.length} fail, ${rows.length - failing.length} pass.`, '',
    '## Counts by problem', '', '| problem | models failing | models warning |', '|---|---|---|',
    ...[...kinds.entries()].sort().map(([k, v]) => `| ${k} | ${v.fail} | ${v.warn} |`), '',
    '## Thresholds', '', '```json', JSON.stringify(th, null, 1), '```', '',
    '## Ranked (worst first)', '', '| # | id | score | tris | status | problems |', '|---|---|---|---|---|---|',
    ...sorted.filter(r => r.report.score > 0 || !r.report.pass).map((r, i) =>
      `| ${i + 1} | ${r.id} | ${r.report.score.toFixed(1)} | ${r.report.triangles} | ${r.status ?? ''} | ${r.report.findings.map(f => `${f.severity === 'fail' ? 'FAIL' : 'warn'} ${f.kind}: ${f.message}`).join('<br>')} |`),
  ];
  return lines.join('\n') + '\n';
}

function geometryMd(rows: Row[]): string {
  const g = rows.filter(r => r.geometry);
  if (!g.length) return '';
  const sum = (k: string) => g.filter(r => (r.geometry!.counts[k] ?? 0) > 0).length;
  const z = g.filter(r => r.geometry!.zfight.area >= 0.25);
  const lines = ['', '## Landmark geometry audit', '',
    `${g.length} models. Detached openings: ${sum('opening-floating')} models with floating parts (${sum('opening-floating-fail')} beyond ${'10 cm'}), ${sum('opening-overhang')} with parts hanging past a wall edge, ${sum('opening-buried')} with parts sunk behind the wall surface. Visible coplanar z-fighting >= 0.25 m2: ${z.length} models. Window-rhythm warnings: ${sum('window-mismatch') + sum('window-missing')} models.`, '',
    '| # | id | geo score | floating (fail) | overhang (fail) | buried | z-fight m2 | near m2 | hidden m2 | off-size | missing | worst |', '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...[...g].sort((a, b) => b.geometry!.score - a.geometry!.score).filter(r => r.geometry!.score > 0).map((r, i) => {
      const x = r.geometry!, c = x.counts, w = x.findings.find(f => f.severity === 'fail') ?? x.findings[0];
      return `| ${i + 1} | ${r.id} | ${x.score.toFixed(0)} | ${c['opening-floating']} (${c['opening-floating-fail']}) | ${c['opening-overhang']} (${c['opening-overhang-fail']}) | ${c['opening-buried']} | ${c['zfight-m2']} | ${c['zfight-near-m2']} | ${x.zfight.hiddenArea} | ${c['window-mismatch']} | ${c['window-missing']} | ${w ? `${w.kind}: ${w.message}` : ''} |`;
    })];
  return lines.join('\n') + '\n';
}

async function main(): Promise<void> {
  const targets = listTargets();
  if (!targets.length) { console.error('No matching models'); process.exit(2); }
  const th = {...DEFAULT_THRESHOLDS};
  const rows: Row[] = [];
  const baseline = readBaseline();
  for (const t of targets) {
    const t0 = Date.now();
    let report: QualityReport;
    try {
      // --only-geometry: skip the shell checks (fast baseline / ranking runs of the geometry audit alone).
      report = flag('only-geometry') ? analyseSoup({positions: new Float32Array(0), indices: new Uint32Array(0)}) : await auditFile(t.file, modelThresholds(t.id));
      if (flag('only-geometry')) { report.findings = []; report.pass = true; }
    } catch (e) {
      report = analyseSoup({positions: new Float32Array(0), indices: new Uint32Array(0)});
      report.findings.push({kind: 'unreadable', severity: 'fail', message: String(e)});
    }
    let geometry: GeometryAuditReport | undefined;
    if (!flag('no-geometry') && arg('set') !== 'ordinary') {
      try {
        geometry = await auditGeometry(t.id, t.file);
        mergeGeometry(report, geometry, flag('write-baseline') ? geometry.counts : baseline?.models[t.id]);
      } catch (e) { report.findings.push({kind: 'geometry-audit-error', severity: 'warn', message: String(e).slice(0, 200)}); }
    }
    rows.push({id: t.id, file: path.relative(ROOT, t.file), status: t.status, report, ms: Date.now() - t0, geometry});
    if (!flag('quiet') || targets.length === 1) {
      console.log(`${report.pass ? 'PASS' : 'FAIL'} ${t.id} (${report.triangles} tris, score ${report.score.toFixed(1)}, ${Date.now() - t0} ms)`);
      for (const f of report.findings) console.log(`   ${f.severity === 'fail' ? 'FAIL' : 'warn'} ${f.kind}: ${f.message}`);
    }
  }
  if (targets.length > 1 || flag('write')) {
    const out = path.resolve(ROOT, arg('out') ?? 'artifacts/glb-audit');
    fs.mkdirSync(out, {recursive: true});
    const tag = arg('set') === 'ordinary' ? 'ordinary-' : '';
    fs.writeFileSync(path.join(out, `${tag}report.json`), JSON.stringify({thresholds: th, models: rows.map(r => ({...r, geometry: r.geometry && slim(r.geometry)}))}, null, 1));
    fs.writeFileSync(path.join(out, `${tag}summary.md`), md(rows, th) + geometryMd(rows));
    if (flag('write-baseline')) {
      const models: Baseline['models'] = {...(baseline?.models ?? {})};
      for (const r of rows) if (r.geometry) models[r.id] = r.geometry.counts;
      const sorted = Object.fromEntries(Object.entries(models).sort(([a], [b]) => a.localeCompare(b)));
      fs.writeFileSync(BASELINE, JSON.stringify({generated: new Date().toISOString().slice(0, 10), note: 'Existing geometry-audit offenders (src/canalRecall/landmarks/geometryAudit.ts). audit:glb fails a model only when a gated count (opening-floating-fail, opening-overhang-fail, zfight-m2) grows past its entry. Lower an entry when you fix a model; never raise one to pass.', models: sorted}, null, 1) + '\n');
      console.log(`Wrote ${path.relative(ROOT, BASELINE)} (${Object.keys(sorted).length} models)`);
    }
    if (flag('geometry-shots')) {
      const {geometryShots} = await import('./landmarks/geometry-audit-evidence');
      await geometryShots(rows.filter(r => r.geometry).map(r => ({id: r.id, file: path.join(ROOT, r.file), geometry: r.geometry!})), path.join(out, 'geometry'), Number(arg('top') ?? 15));
    }
    console.log(`Wrote ${path.relative(ROOT, out)}/${tag}report.json and ${tag}summary.md`);
    if (flag('shots')) {
      const shotsModule = './audit-glb-quality-shots.mjs'; // untyped helper; keep the import dynamic
      const {renderContact} = await import(shotsModule);
      const top = [...rows].sort((a, b) => b.report.score - a.report.score).slice(0, Number(arg('top') ?? 15));
      await renderContact(top.map(r => ({id: r.id, file: path.join(ROOT, r.file), report: r.report})), path.join(out, `${tag}top`), ROOT);
    }
  }
  const failed = rows.filter(r => !r.report.pass).length;
  if (targets.length === 1) process.exit(failed ? 1 : 0);
  console.log(`${rows.length - failed} pass, ${failed} fail`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('audit-glb-quality.ts')) await main();
