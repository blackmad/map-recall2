// D1 belt publish units (2026-11-14 ruling: specs publish a street at a time once its row sheet reads better than today).
// Joins the row-sheet reviews (review/<side>.json, rows + pages, REVIEW.md) with row-groups.json into publish units: one per
// sheet page (a stretch of one street side, ~6 poses = ~36 fronts). A unit publishes its staged pands when the page reads
// better; inside a better page, rows judged worse are dropped (their pands listed under `dropped`). Same/worse pages hold.
// Writes <dir>/verdicts.json and prints a one-line-per-unit table.
//
//   node --import tsx scripts/house-specs/describer-d1/belt-verdicts.ts --dir artifacts/describer-d1/belt-20261114 [--rows 6]
import fs from 'node:fs';
import path from 'node:path';

type Pand = { pandId: string; number: number; staged: boolean; held: string[] };
type Row = { key: string; pands: Pand[] };
type Review = { side: string; rows: Array<{ key: string; verdict: string; why: string }>; pages?: Array<{ page: number; verdict: string; why: string }>; verdict: string; holdStretches?: string[] };

export function publishUnits(side: string, rows: Row[], review: Review, per = 6) {
  const rv = new Map(review.rows.map(r => [r.key, r]));
  const units = [];
  for (let p = 0; p * per < rows.length; p++) {
    const slice = rows.slice(p * per, (p + 1) * per);
    const page = review.pages?.find(x => x.page === p + 1);
    const verdict = (page?.verdict ?? 'missing').toLowerCase();
    const nums = slice.flatMap(r => r.pands.map(x => x.number));
    const publish: string[] = [], dropped: string[] = [], hold: string[] = [];
    for (const r of slice) {
      const rowWorse = /^worse/.test((rv.get(r.key)?.verdict ?? '').toLowerCase());
      for (const x of r.pands) {
        if (!x.staged) continue;
        if (verdict.startsWith('better') && !rowWorse) publish.push(x.pandId);
        else if (verdict.startsWith('better')) dropped.push(x.pandId);
        else hold.push(x.pandId);
      }
    }
    const street = side.split('-')[0];
    units.push({ unit: `${side}-${p + 1}`, street: street[0].toUpperCase() + street.slice(1), side: side.split('-')[1], numbers: `${Math.min(...nums)}-${Math.max(...nums)}`,
      verdict, why: page?.why ?? '', sheet: `${side}-${p + 1}.jpg`, publish: [...new Set(publish)], dropped: [...new Set(dropped)], hold: [...new Set(hold)] });
  }
  return units;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const dir = path.resolve(opt('dir')!), per = Number(opt('rows') ?? 6);
  const groups = JSON.parse(fs.readFileSync(path.join(dir, 'row-groups.json'), 'utf8')) as Record<string, Row[]>;
  const out: any = { v: 1, rule: 'publish a unit when its sheet page reads better than today; worse rows inside it are dropped', sides: {}, units: [] };
  for (const [side, rows] of Object.entries(groups)) {
    const f = path.join(dir, 'review', `${side}.json`);
    if (!fs.existsSync(f)) { console.log(`${side}: no review`); continue; }
    const review = JSON.parse(fs.readFileSync(f, 'utf8')) as Review;
    out.sides[side] = { verdict: review.verdict, holdStretches: review.holdStretches ?? [] };
    out.units.push(...publishUnits(side, rows, review, per));
  }
  out.totals = { publish: out.units.reduce((n: number, u: any) => n + u.publish.length, 0), dropped: out.units.reduce((n: number, u: any) => n + u.dropped.length, 0), hold: out.units.reduce((n: number, u: any) => n + u.hold.length, 0) };
  fs.writeFileSync(path.join(dir, 'verdicts.json'), `${JSON.stringify(out, null, 1)}\n`);
  for (const u of out.units) console.log(`${u.unit}\t${u.street} ${u.side} ${u.numbers}\t${u.verdict}\tpublish ${u.publish.length} drop ${u.dropped.length} hold ${u.hold.length}\t${u.why}`);
  console.log(JSON.stringify(out.totals));
}
