// Design units: the gate table (storeys, roof sequence and ground kind per plot; the photo reads against today, r1 and r2).
// Reads artifacts/design-units/r2/<key>/<cond>/generic/row-layout.json (review-sheets render) and scripts/design-units/plot-reads.json.
//   node --import tsx scripts/design-units/plot-table.ts
import fs from 'node:fs';
const OUT = 'artifacts/design-units/r2';
const reads = JSON.parse(fs.readFileSync('scripts/design-units/plot-reads.json', 'utf8')).pands as Record<string, any>;
const gate = JSON.parse(fs.readFileSync('scripts/design-units/gate-blocks.json', 'utf8')) as Array<{ key: string; members: string[] }>;
const L: Record<string, string> = { dormers: 'D', mansard: 'M', pointedGable: 'P', stepGable: 'S', bellGable: 'B', flat: 'F' };
const rows: string[] = []; let gOk = 0, gN = 0;
const load = (k: string, c: string) => { const f = `${OUT}/${k}/${c}/generic/row-layout.json`; return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { layout: {}, props: {} }; };
const mode = (xs: (number | string)[]) => { const c = new Map<string, number>(); for (const x of xs) c.set(String(x), (c.get(String(x)) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1]).map(([v, n]) => n === xs.length ? v : `${v}(${n}/${xs.length})`).join(' '); };
for (const g of gate) {
  const pr = `${OUT}/layers/${g.key}/photo-row.json`; const order: string[] = fs.existsSync(pr) ? JSON.parse(fs.readFileSync(pr, 'utf8')).pands.map((p: any) => p.pandId) : g.members;
  const rj = JSON.parse(fs.readFileSync(`${OUT}/${g.key}/new/render.json`, 'utf8')); const inst = new Set(Object.values(rj.installed).flat() as string[]);
  const t = load(g.key, 'today'), r1 = load(g.key, 'r1'), r2 = load(g.key, 'new');
  const st = (x: any) => order.map(id => inst.has(id) ? 'inst' : x.layout[id]?.storeys ?? '?');
  const photo = order.map(id => reads[id]?.storeys ?? '?');
  const roofP = order.map(id => reads[id]?.roof ? L[reads[id].roof] : '.').join('');
  const roofR2 = order.map(id => { if (inst.has(id)) return 'i'; const p = r2.props[id]; if (!p) return '?'; if (p.monumentGable) return p.monumentGable === 'step' ? 'S' : p.monumentGable === 'bell' ? 'B' : 'P'; if (p.roofShape === 'flat') return 'F'; return p.designPlot?.roof === 'mansard' ? 'M' : 'D'; }).join('');
  const grP = order.map(id => reads[id]?.ground ? reads[id].ground[0] : '.').join('');
  const grR2 = order.map(id => { if (inst.has(id)) return 'i'; const p = r2.props[id]; if (!p) return '?'; return p.shop ? 's' : 'd'; }).join('');
  for (let i = 0; i < order.length; i++) if (grP[i] !== '.' && grR2[i] !== 'i' && grR2[i] !== '?') { gN++; if ((grP[i] === 's') === (grR2[i] === 's')) gOk++; }
  const rule = order.map(id => r2.props[id]?.designPlot?.rule?.[0] ?? '-').join('');
  rows.push(`| ${g.key} | ${mode(photo)} | ${mode(st(t))} | ${mode(st(r1))} | ${mode(st(r2))} | ${roofP} | ${roofR2} | ${grP} | ${grR2} | ${rule} |`);
}
console.log('| block | storeys photo | today | r1 | r2 | roof photo | roof r2 | ground photo | ground r2 | r2 rule |\n|---|---|---|---|---|---|---|---|---|---|\n' + rows.join('\n'));
console.log(`ground kind match: ${gOk}/${gN}`);
