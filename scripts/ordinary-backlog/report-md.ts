/**
 * Tables for docs/reports/ordinary-backlog-<date>.md from the JSON build.ts wrote (the findings prose is written by hand
 * above the generated block).
 *
 *   node --import tsx scripts/ordinary-backlog/report-md.ts [--date 20261120] > /tmp/tables.md
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const i = process.argv.indexOf('--date');
const DATE = i >= 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10).replace(/-/g, '');
const r = JSON.parse(fs.readFileSync(path.join(ROOT, `docs/reports/ordinary-backlog-${DATE}.json`), 'utf8'));
const out: string[] = [];
const p = (s = '') => out.push(s);
const fmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const bands = r.scope.bands as string[];

p('## Counts');
p();
p(`| Ring | Pands ≥ ${r.scope.minFootprintM2} m² scanned | Ordinary candidates | ${bands.join(' | ')} |`);
p(`|---|---:|---:|${bands.map(() => '---:').join('|')}|`);
p(`| Core ≤ ${r.scope.coreRadiusM / 1000} km | ${r.counts.scanned.core} | ${r.counts.candidates.coreTotal} | ${bands.map(b => r.counts.candidates.core[b]).join(' | ')} |`);
p(`| Ring ${r.scope.coreRadiusM / 1000}–${r.scope.outerRadiusM / 1000} km | ${r.counts.scanned.outer} | ${r.counts.candidates.outerTotal} | ${bands.map(b => r.counts.candidates.outer[b]).join(' | ')} |`);
p();
const kinds = ['generic', 'plain-kit', 'bare', 'large-blank-side'];
p(`| Ring | ${kinds.join(' | ')} | wrong period |`);
p(`|---|${kinds.map(() => '---:').join('|')}|---:|`);
for (const ring of ['core', 'outer']) p(`| ${ring} | ${kinds.map(k => r.counts.byKind[ring][k] ?? 0).join(' | ')} | ${r.counts.wrongPeriod[ring]} |`);
p();
const ex = Object.keys(r.counts.excluded);
p(`Excluded (core / ring): ${ex.map(k => `${k} ${r.counts.excluded[k].core ?? 0} / ${r.counts.excluded[k].outer ?? 0}`).join(', ')}.`);
p();
const routes = ['large-recipe', 'kit-fix', 'design-units', 'landmark'];
p(`Routes (core / ring): ${routes.map(k => `${k} ${r.counts.byRoute.core[k] ?? 0} / ${r.counts.byRoute.outer[k] ?? 0}`).join(', ')}.`);
p();
const ev = r.counts.evidence;
p(`Photo evidence checked for ${ev.checked} pands: straight ${ev.straight ?? 0}, oblique ${ev.oblique ?? 0}, blocked ${ev.blocked ?? 0}, none ${ev.none ?? 0}, unchecked ${ev.unchecked ?? 0}.`);
p();

const row = (b: any) => {
  const what = b.address ?? b.name ?? '';
  const today = `${b.today.kind}${b.today.wrongPeriod ? ', wrong period' : ''}${b.today.kind === 'generic' ? ` (air ${Math.round(b.today.plainFromAir * 100)} % plain)` : ''}${b.today.largeRecipe ? ` \`${b.today.largeRecipe}\`` : ''}`;
  return `| ${b.rank} | ${b.id} | ${what} | ${b.year ?? '?'} | ${fmt(b.footprintM2)} | ${b.heightM} | ${b.streetWallM} | ${fmt(b.rideVisibility.score / 1e6)} | ${today} | ${b.today.badness} | ${b.evidence.class}${b.evidence.obliquityDeg !== undefined ? ` ${b.evidence.obliquityDeg}°` : ''} | ${b.route} | **${b.payoff}** |`;
};
const head = '| # | Pand | Address / name | Year | m² | H m | Street wall m | Ride (M) | Today | Bad | Photo | Route | Payoff |\n|---:|---|---|---:|---:|---:|---:|---:|---|---:|---|---|---:|';
p('## Top 40 buildings, core (≤ 3 km)');
p();
p(head);
for (const b of r.core.slice(0, 40)) p(row(b));
p();
p('## Top 10 buildings, ring 3–5 km');
p();
p(head);
for (const b of r.outer.slice(0, 10)) p(row(b));
p();
p('## Top 10 clusters (era · use · form · drawing path)');
p();
p('| # | Cluster | Members (core) | Footprint m² | Street wall m | Payoff, all (core) | Photos usable / checked | Routes | Exemplars |');
p('|---:|---|---:|---:|---:|---:|---|---|---|');
r.clusters.slice(0, 10).forEach((c: any, k: number) => p(`| ${k + 1} | ${c.key} | ${c.members} (${c.core}) | ${fmt(c.footprintM2)} | ${fmt(c.streetWallM)} | **${fmt(c.payoffRaw)}** (${fmt(c.corePayoffRaw)}) | ${c.evidence.usable} / ${c.evidence.checked} | ${Object.entries(c.routes).map(([a, n]) => `${a} ${n}`).join(', ')} | ${c.exemplars.slice(0, 3).map((e: any) => `${e.address ?? e.id} (${e.year ?? '?'})`).join('; ')} |`));
p();
process.stdout.write(out.join('\n') + '\n');
