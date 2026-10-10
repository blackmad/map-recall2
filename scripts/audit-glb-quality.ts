/**
 * GLB quality gate + audit.
 *
 *   npx tsx scripts/audit-glb-quality.ts --id=torture-museum        # gate one landmark (exit 1 on fail)
 *   npx tsx scripts/audit-glb-quality.ts --file=path/to.glb
 *   npx tsx scripts/audit-glb-quality.ts                            # audit every landmark GLB
 *   npx tsx scripts/audit-glb-quality.ts --set=ordinary [--limit=200]
 *   flags: --shots (contact images of top offenders), --top=15, --out=artifacts/glb-audit, --quiet
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

interface Row {id: string; file: string; status?: string; report: QualityReport; ms: number}

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

async function main(): Promise<void> {
  const targets = listTargets();
  if (!targets.length) { console.error('No matching models'); process.exit(2); }
  const th = {...DEFAULT_THRESHOLDS};
  const rows: Row[] = [];
  for (const t of targets) {
    const t0 = Date.now();
    let report: QualityReport;
    try { report = await auditFile(t.file, modelThresholds(t.id)); } catch (e) {
      report = analyseSoup({positions: new Float32Array(0), indices: new Uint32Array(0)});
      report.findings.push({kind: 'unreadable', severity: 'fail', message: String(e)});
    }
    rows.push({id: t.id, file: path.relative(ROOT, t.file), status: t.status, report, ms: Date.now() - t0});
    if (!flag('quiet') || targets.length === 1) {
      console.log(`${report.pass ? 'PASS' : 'FAIL'} ${t.id} (${report.triangles} tris, score ${report.score.toFixed(1)}, ${Date.now() - t0} ms)`);
      for (const f of report.findings) console.log(`   ${f.severity === 'fail' ? 'FAIL' : 'warn'} ${f.kind}: ${f.message}`);
    }
  }
  if (targets.length > 1 || flag('write')) {
    const out = path.resolve(ROOT, arg('out') ?? 'artifacts/glb-audit');
    fs.mkdirSync(out, {recursive: true});
    const tag = arg('set') === 'ordinary' ? 'ordinary-' : '';
    fs.writeFileSync(path.join(out, `${tag}report.json`), JSON.stringify({thresholds: th, models: rows}, null, 1));
    fs.writeFileSync(path.join(out, `${tag}summary.md`), md(rows, th));
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
