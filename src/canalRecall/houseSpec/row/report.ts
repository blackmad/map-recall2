/**
 * House rows: the per-row report (lane D, #386) as Markdown: the series and the source of each field, the fronts,
 * the flags, members overruled, and the fields read and not drawn. Pure.
 */
import type { RowDesign, RowField, RowRecord } from './types.ts';

const show = (v: unknown): string => {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v).replace(/"/g, '');
  return String(v);
};
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ');

export function rowReport(row: RowRecord, staged: string[], problems: string[] = []): string {
  const L: string[] = [];
  L.push(`# ${row.id}: ${row.street} (${row.side})`, '');
  L.push(`Solved ${row.solvedAt}${row.face ? ` on face ${row.face}` : ''}. ${row.members.length} pands, ${row.fronts.length} fronts, ${row.series.length} series, ${staged.length} specs staged.`, '');
  L.push('## Fronts (street order, left to right as seen)', '', '| front | label | series | width m | top m (pand datum) | ground | held |', '|---|---|---|---|---|---|---|');
  for (const f of row.fronts) L.push(`| ${f.id} | ${f.label} | ${f.seriesId} | ${show(f.widthM)} | ${show(f.topM)} | ${cell(show(f.ground))} | ${f.readHeld ? cell(f.readHeld) : ''} |`);
  for (const s of row.series) {
    L.push('', `## Series ${s.id}: ${s.label}`, '', `Fronts: ${s.fronts.join(', ')}`, '', '| field | value | source | ref | votes / samples |', '|---|---|---|---|---|');
    for (const [k, fl] of Object.entries(s.design) as Array<[keyof RowDesign, RowField<unknown>]>) {
      const v = fl.votes ? fl.votes.map(x => `${show(x.value)} x${x.n}`).join('; ') : fl.samples ? fl.samples.join(', ') : '';
      L.push(`| ${k} | ${cell(show(fl.value))} | ${fl.source} | ${cell(fl.ref)} | ${cell(v)} |`);
    }
  }
  const overrides = row.fronts.filter(f => Object.keys(f.overrides).length);
  if (overrides.length) {
    L.push('', '## Front overrides (stated for that house)', '');
    for (const f of overrides) for (const [k, fl] of Object.entries(f.overrides)) L.push(`- ${f.id} ${k}: ${show((fl as RowField<unknown>).value)} (${(fl as RowField<unknown>).source}, ${(fl as RowField<unknown>).ref})`);
  }
  L.push('', `## Flags (${row.flags.length})`, '');
  for (const f of row.flags) L.push(`- **${f.kind}**${f.field ? ` ${f.field}` : ''} [${f.fronts.join(', ')}]: ${f.detail}`);
  L.push('', `## Members overruled (${row.overruled.length})`, '', '| front | field | read | drawn | by | why |', '|---|---|---|---|---|---|');
  for (const o of row.overruled) L.push(`| ${o.front} | ${o.field} | ${cell(show(o.read))} | ${cell(show(o.drawn))} | ${o.by} | ${cell(o.why)} |`);
  L.push('', `## Read, not drawn (${row.readNotDrawn.length})`, '', '| front | field | value | reason |', '|---|---|---|---|');
  for (const r of row.readNotDrawn) L.push(`| ${r.front} | ${r.field} | ${cell(show(r.value)).slice(0, 160)} | ${cell(r.reason)} |`);
  if (problems.length) L.push('', '## Specs not staged (validation)', '', ...problems.map(p => `- ${p}`));
  const notStaged = row.members.filter(m => !staged.includes(m.pandId));
  if (notStaged.length) L.push('', `Not staged: ${notStaged.map(m => m.pandId).join(', ')}`);
  L.push('');
  return L.join('\n');
}
